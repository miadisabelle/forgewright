/**
 * Checkpoint policy enforcement for the spiral development loop.
 *
 * Manages when to pause for human review based on configurable policies:
 * - direction-change: checkpoint at every direction boundary
 * - cycle-complete: checkpoint only when a full cycle finishes
 * - tension-threshold: checkpoint when oscillation is detected
 * - manual: human explicitly triggers checkpoints
 *
 * Non-negotiable: max 3 autonomous cycles, then mandatory stop regardless
 * of policy. Ceremony opening always requires human approval.
 */

import type { SpiralPosition, CheckpointPolicy, ForgewrightSession } from '../types/session';
import type { SessionOscillationReport } from './oscillation-detector';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string;
  sessionId: string;
  position: SpiralPosition;
  timestamp: string;
  reason: string;
  sessionSnapshot: SessionSnapshot;
  oscillationReport?: SessionOscillationReport;
}

export interface SessionSnapshot {
  sessionId: string;
  intent: string;
  spiralPosition: SpiralPosition;
  machineState?: string;
  status: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type CheckpointDecision = 'continue' | 'adjust' | 'fork' | 'stop';

// ─── CheckpointManager ──────────────────────────────────────────────────────

export class CheckpointManager {
  private readonly checkpoints: Map<string, Checkpoint> = new Map();
  private counter = 0;

  /**
   * Determine whether a checkpoint should be created at the current position.
   *
   * Always returns true at max cycles — this is a non-negotiable sovereignty
   * guarantee. Policy governs intermediate checkpoints.
   */
  shouldCheckpoint(
    position: SpiralPosition,
    policy: CheckpointPolicy,
    oscillationDetected = false,
  ): boolean {
    // Non-negotiable: always checkpoint at max cycles
    if (position.cycleCount >= policy.maxAutonomousCycles) return true;

    // Mandatory directions always trigger (default: ['north'])
    if (policy.mandatoryAt.includes(position.direction)) return true;

    switch (policy.type) {
      case 'direction-change':
        // Checkpoint at every direction boundary
        return position.isAtCheckpoint;

      case 'cycle-complete':
        // Checkpoint only when returning to East after a full cycle
        return position.direction === 'east' && position.cycleCount > 1;

      case 'tension-threshold':
        // Checkpoint only when oscillation is detected
        return oscillationDetected;

      case 'manual':
        // Never auto-checkpoint (except mandatory ones above)
        return false;

      default:
        return false;
    }
  }

  /**
   * Create a checkpoint capturing the current session state.
   * This is the pause point where human sovereignty is exercised.
   */
  createCheckpoint(
    session: ForgewrightSession,
    reason: string,
    oscillationReport?: SessionOscillationReport,
  ): Checkpoint {
    const id = `ckpt-${session.id}-${++this.counter}`;

    const checkpoint: Checkpoint = {
      id,
      sessionId: session.id,
      position: { ...session.spiralPosition },
      timestamp: new Date().toISOString(),
      reason,
      sessionSnapshot: {
        sessionId: session.id,
        intent: session.intent,
        spiralPosition: { ...session.spiralPosition },
        machineState: session.machineState,
        status: session.status,
        timestamp: new Date().toISOString(),
      },
      oscillationReport,
    };

    this.checkpoints.set(id, checkpoint);
    return checkpoint;
  }

  /**
   * Restore session state from a checkpoint snapshot.
   * Returns a copy of the snapshot — the original remains immutable.
   */
  restoreCheckpoint(id: string): SessionSnapshot {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${id}`);
    }
    return {
      ...checkpoint.sessionSnapshot,
      spiralPosition: { ...checkpoint.sessionSnapshot.spiralPosition },
    };
  }

  /** Get a specific checkpoint by ID. */
  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  /** List all checkpoints, optionally filtered by session. */
  listCheckpoints(sessionId?: string): Checkpoint[] {
    const all = Array.from(this.checkpoints.values());
    return sessionId ? all.filter((c) => c.sessionId === sessionId) : all;
  }

  /** Number of checkpoints recorded. */
  get count(): number {
    return this.checkpoints.size;
  }
}
