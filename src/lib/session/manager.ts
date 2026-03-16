/**
 * SessionManager — orchestrates session lifecycle, storage, and spiral tracking.
 *
 * Central facade for creating, resuming, pausing, and closing sessions.
 * Delegates persistence to storage.ts and lifecycle hooks to lifecycle.ts.
 */

import { randomUUID } from 'crypto';
import type { ForgewrightSession, ForgewrightConfig, SessionStatus } from '../types/session';
import type { DirectionName } from '../types/directions';
import * as storage from './storage';
import {
  onSessionCreate,
  onDirectionChange,
  onCycleComplete,
  onSessionClose,
  type LifecycleResult,
} from './lifecycle';
import { mergeConfig, DEFAULT_CONFIG, DEFAULT_CHECKPOINT_POLICY, SESSION_DEFAULTS } from './config';

// ─── SessionManager ──────────────────────────────────────────────────────────

export class SessionManager {
  private readonly config: ForgewrightConfig;
  private readonly storageDir?: string;

  constructor(config?: Partial<ForgewrightConfig>, storageDir?: string) {
    this.config = mergeConfig(config ?? {}, DEFAULT_CONFIG);
    this.storageDir = storageDir;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Create a new session with the given intent.
   * Auto-generates UUID, initializes spiral at East, runs lifecycle hook.
   */
  async createSession(
    intent: string,
    config?: Partial<ForgewrightConfig>,
  ): Promise<LifecycleResult> {
    const now = new Date().toISOString();

    const session: ForgewrightSession = {
      id: randomUUID(),
      intent,
      companions: [],
      spiralPosition: {
        direction: SESSION_DEFAULTS.initialDirection,
        cycleCount: 0,
        maxCycles: SESSION_DEFAULTS.maxCycles,
        isAtCheckpoint: false,
      },
      status: 'active',
      checkpointPolicy: { ...DEFAULT_CHECKPOINT_POLICY },
      createdAt: now,
      updatedAt: now,
    };

    const result = onSessionCreate(session);
    await storage.save(result.session, this.storageDir);
    return result;
  }

  // ─── Resume ───────────────────────────────────────────────────────────────

  /**
   * Load and resume a paused session. Sets status back to active.
   */
  async resumeSession(id: string): Promise<ForgewrightSession> {
    const session = await storage.load(id, this.storageDir);

    if (session.status === 'completed') {
      throw new Error(`Session "${id}" is completed and cannot be resumed`);
    }
    if (session.status === 'abandoned') {
      throw new Error(`Session "${id}" was abandoned and cannot be resumed`);
    }

    session.status = 'active';
    session.updatedAt = new Date().toISOString();
    await storage.save(session, this.storageDir);
    return session;
  }

  // ─── Pause ────────────────────────────────────────────────────────────────

  /**
   * Pause a session — saves current state, sets status to paused.
   */
  async pauseSession(id: string): Promise<ForgewrightSession> {
    const session = await storage.load(id, this.storageDir);

    if (session.status !== 'active') {
      throw new Error(`Session "${id}" is not active (current: ${session.status})`);
    }

    session.status = 'paused';
    session.updatedAt = new Date().toISOString();
    await storage.save(session, this.storageDir);
    return session;
  }

  // ─── Close ────────────────────────────────────────────────────────────────

  /**
   * Close a session — finalize, generate chronicle, compute Wilson.
   */
  async closeSession(id: string): Promise<LifecycleResult> {
    const session = await storage.load(id, this.storageDir);

    if (session.status === 'completed') {
      throw new Error(`Session "${id}" is already completed`);
    }

    const result = onSessionClose(session);
    await storage.save(result.session, this.storageDir);
    return result;
  }

  // ─── Direction Change ─────────────────────────────────────────────────────

  /**
   * Advance the spiral to a new direction.
   * If advancing past North, triggers onCycleComplete.
   */
  async changeDirection(
    id: string,
    newDirection: DirectionName,
  ): Promise<LifecycleResult> {
    const session = await storage.load(id, this.storageDir);

    if (session.status !== 'active') {
      throw new Error(`Session "${id}" is not active (current: ${session.status})`);
    }

    const result = onDirectionChange(session, newDirection);
    await storage.save(result.session, this.storageDir);
    return result;
  }

  /**
   * Complete the current cycle (called when North work is done).
   */
  async completeCycle(id: string): Promise<LifecycleResult> {
    const session = await storage.load(id, this.storageDir);

    if (session.status !== 'active') {
      throw new Error(`Session "${id}" is not active (current: ${session.status})`);
    }

    const result = onCycleComplete(session);
    await storage.save(result.session, this.storageDir);
    return result;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  /**
   * List all sessions with their status.
   */
  async listSessions(): Promise<Array<{ id: string; session: ForgewrightSession }>> {
    const ids = await storage.list(this.storageDir);
    const sessions: Array<{ id: string; session: ForgewrightSession }> = [];

    for (const id of ids) {
      try {
        const session = await storage.load(id, this.storageDir);
        sessions.push({ id, session });
      } catch {
        // Skip corrupted session files
      }
    }

    return sessions;
  }

  // ─── Get ──────────────────────────────────────────────────────────────────

  /**
   * Get a single session by ID.
   */
  async getSession(id: string): Promise<ForgewrightSession> {
    return storage.load(id, this.storageDir);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  /**
   * Remove a session from storage.
   */
  async deleteSession(id: string): Promise<void> {
    await storage.remove(id, this.storageDir);
  }
}
