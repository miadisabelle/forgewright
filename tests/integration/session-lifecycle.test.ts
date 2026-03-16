/**
 * Session Lifecycle — integration tests.
 *
 * Validates cross-module interactions between:
 *   SessionManager ↔ lifecycle hooks ↔ SpiralTracker ↔ narrative arcs
 *
 * Tests: create → spiral at East/cycle 0, advance E→S→W→N, 3 cycles → halt,
 *        pause/resume preserves state, close generates chronicle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '@forgewright/lib/session/manager';
import {
  clearSessionArcs,
  getSessionArc,
} from '@forgewright/lib/session/lifecycle';
import {
  SpiralTracker,
  SpiralMaxCyclesError,
} from '@forgewright/lib/agent/spiral-tracker';
import type { DirectionName } from '@forgewright/lib/types/directions';

// ─── In-memory filesystem mock ───────────────────────────────────────────────

const fsStore = new Map<string, string>();

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(async (path: string, data: string) => {
    fsStore.set(path, data);
  }),
  readFile: vi.fn(async (path: string) => {
    const data = fsStore.get(path);
    if (data === undefined) {
      const err = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
    return data;
  }),
  readdir: vi.fn(async (dir: string) => {
    const files: string[] = [];
    const prefix = dir.endsWith('/') ? dir : dir + '/';
    for (const key of fsStore.keys()) {
      if (key.startsWith(prefix) && key.endsWith('.json') && !key.includes('.tmp-')) {
        const filename = key.slice(prefix.length);
        if (!filename.includes('/')) files.push(filename);
      }
    }
    return files;
  }),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn(async (path: string) => {
    fsStore.delete(path);
  }),
  rename: vi.fn(async (src: string, dest: string) => {
    const data = fsStore.get(src);
    if (data !== undefined) {
      fsStore.set(dest, data);
      fsStore.delete(src);
    }
  }),
}));

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Session Lifecycle Integration', () => {
  const STORAGE_DIR = '/tmp/forgewright-test-sessions';
  let manager: SessionManager;

  beforeEach(() => {
    fsStore.clear();
    clearSessionArcs();
    manager = new SessionManager({}, STORAGE_DIR);
  });

  // ── Test 1: create session → spiral starts at East, cycle 0 ───────────────

  it('creates a session with spiral at East and cycle 0', async () => {
    const result = await manager.createSession('Build authentication module');

    expect(result.session).toBeDefined();
    expect(result.session.status).toBe('active');
    expect(result.session.intent).toBe('Build authentication module');

    // Spiral position: East, cycle 0
    expect(result.session.spiralPosition.direction).toBe('east');
    expect(result.session.spiralPosition.cycleCount).toBe(0);
    expect(result.session.spiralPosition.isAtCheckpoint).toBe(false);

    // Narrative arc created with opening beat
    expect(result.arc).toBeDefined();
    expect(result.arc!.beats).toHaveLength(1);
    expect(result.arc!.beats[0].direction).toBe('east');
    expect(result.arc!.beats[0].content).toContain('Build authentication module');

    // Message includes East/Waabinong
    expect(result.message).toContain('East');
    expect(result.message).toContain('Waabinong');
  });

  // ── Test 2: advance through E→S→W→N → cycle increments ───────────────────

  it('advances through all four directions and increments cycle', async () => {
    const { session } = await manager.createSession('Spiral test');
    const id = session.id;

    // Verify starting at East
    const s0 = await manager.getSession(id);
    expect(s0.spiralPosition.direction).toBe('east');

    // East → South
    const r1 = await manager.changeDirection(id, 'south');
    expect(r1.session.spiralPosition.direction).toBe('south');
    expect(r1.message).toContain('south');
    expect(r1.arc).toBeDefined();

    // South → West
    const r2 = await manager.changeDirection(id, 'west');
    expect(r2.session.spiralPosition.direction).toBe('west');

    // West → North
    const r3 = await manager.changeDirection(id, 'north');
    expect(r3.session.spiralPosition.direction).toBe('north');

    // Complete cycle — cycle increments, direction resets to East
    const r4 = await manager.completeCycle(id);
    expect(r4.session.spiralPosition.cycleCount).toBe(1);
    expect(r4.session.spiralPosition.direction).toBe('east');
    expect(r4.session.spiralPosition.isAtCheckpoint).toBe(true);
    expect(r4.chronicle).toBeDefined();
    expect(r4.chronicle!.length).toBeGreaterThan(0);
  });

  // ── Test 3: 3 cycles completed → SpiralTracker enforces halt ──────────────

  it('SpiralTracker throws after 3 cycles (mandatory halt)', () => {
    const tracker = new SpiralTracker('halt-test', { maxCycles: 3 });

    // Complete 2 full cycles (start at cycle 1, advance to 3)
    const directions: DirectionName[] = ['east', 'south', 'west', 'north'];

    // Cycle 1: E→S→W→N (advances from default cycle 1)
    for (let i = 0; i < 4; i++) {
      if (i < 3) {
        tracker.advanceDirection();
      } else {
        // North → East triggers completeCycle internally
        tracker.advanceDirection(); // cycle goes 1 → 2
      }
    }
    expect(tracker.getCurrentPosition().cycleCount).toBe(2);

    // Cycle 2: E→S→W→N
    for (let i = 0; i < 4; i++) {
      if (i < 3) {
        tracker.advanceDirection();
      } else {
        tracker.advanceDirection(); // cycle goes 2 → 3
      }
    }
    expect(tracker.getCurrentPosition().cycleCount).toBe(3);

    // Cycle 3: E→S→W then North should THROW
    tracker.advanceDirection(); // E→S
    tracker.advanceDirection(); // S→W
    tracker.advanceDirection(); // W→N

    expect(() => tracker.advanceDirection()).toThrow(SpiralMaxCyclesError);

    // Verify the error has the right data
    try {
      tracker.advanceDirection();
    } catch (err) {
      expect(err).toBeInstanceOf(SpiralMaxCyclesError);
      expect((err as SpiralMaxCyclesError).maxCycles).toBe(3);
    }
  });

  // ── Test 4: pause and resume preserves state ──────────────────────────────

  it('pause and resume preserves spiral position and session state', async () => {
    const { session } = await manager.createSession('Pause-resume test');
    const id = session.id;

    // Advance to South
    await manager.changeDirection(id, 'south');

    // Advance to West
    await manager.changeDirection(id, 'west');

    // Pause
    const paused = await manager.pauseSession(id);
    expect(paused.status).toBe('paused');
    expect(paused.spiralPosition.direction).toBe('west');

    // Attempt to change direction on paused session → should throw
    await expect(manager.changeDirection(id, 'north')).rejects.toThrow('not active');

    // Resume
    const resumed = await manager.resumeSession(id);
    expect(resumed.status).toBe('active');
    expect(resumed.spiralPosition.direction).toBe('west');
    expect(resumed.spiralPosition.cycleCount).toBe(0);

    // Can now advance after resume
    const r = await manager.changeDirection(id, 'north');
    expect(r.session.spiralPosition.direction).toBe('north');
  });

  // ── Test 5: close session generates chronicle with Wilson score ────────────

  it('close session generates chronicle and computes Wilson alignment', async () => {
    const { session } = await manager.createSession('Chronicle test');
    const id = session.id;

    // Walk through all four directions to build a rich arc
    await manager.changeDirection(id, 'south');
    await manager.changeDirection(id, 'west');
    await manager.changeDirection(id, 'north');
    await manager.completeCycle(id);

    // Close the session
    const result = await manager.closeSession(id);

    // Session is completed
    expect(result.session.status).toBe('completed');

    // Chronicle generated
    expect(result.chronicle).toBeDefined();
    expect(result.chronicle!).toContain('Narrative Arc');

    // Wilson score present
    expect(result.wilsonScore).toBeDefined();
    expect(typeof result.wilsonScore!.score).toBe('number');
    expect(result.wilsonScore!.score).toBeGreaterThanOrEqual(0);
    expect(result.wilsonScore!.score).toBeLessThanOrEqual(1);
    expect(result.wilsonScore!.components).toBeDefined();
    expect(typeof result.wilsonScore!.components.respect).toBe('number');
    expect(typeof result.wilsonScore!.components.reciprocity).toBe('number');
    expect(typeof result.wilsonScore!.components.responsibility).toBe('number');

    // Final arc has closing beat
    expect(result.arc).toBeDefined();
    const lastBeat = result.arc!.beats[result.arc!.beats.length - 1];
    expect(lastBeat.content).toContain('Session closed');

    // Cannot resume a completed session
    await expect(manager.resumeSession(id)).rejects.toThrow('completed');
  });

  // ── Test 6: SpiralTracker history tracks all transitions ──────────────────

  it('SpiralTracker records full direction history with timestamps', () => {
    const tracker = new SpiralTracker('history-test', { maxCycles: 3 });

    // Start at East (cycle 1)
    expect(tracker.getCurrentPosition().direction).toBe('east');
    expect(tracker.getHistory()).toHaveLength(1);

    // Advance: E→S→W→N
    tracker.advanceDirection(); // → south
    tracker.advanceDirection(); // → west
    tracker.advanceDirection(); // → north

    expect(tracker.getHistory()).toHaveLength(4);

    // Verify transitions are recorded
    const history = tracker.getHistory();
    expect(history[0].direction).toBe('east');
    expect(history[0].transitionFrom).toBeUndefined(); // initial
    expect(history[1].direction).toBe('south');
    expect(history[1].transitionFrom).toBe('east');
    expect(history[2].direction).toBe('west');
    expect(history[2].transitionFrom).toBe('south');
    expect(history[3].direction).toBe('north');
    expect(history[3].transitionFrom).toBe('west');

    // Each entry has a timestamp
    for (const entry of history) {
      expect(entry.timestamp).toBeTruthy();
      expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
    }
  });

  // ── Test 7: multiple sessions remain independent ──────────────────────────

  it('multiple sessions maintain independent spiral state', async () => {
    const r1 = await manager.createSession('Session Alpha');
    const r2 = await manager.createSession('Session Beta');

    // Advance Alpha to West
    await manager.changeDirection(r1.session.id, 'south');
    await manager.changeDirection(r1.session.id, 'west');

    // Beta stays at East
    const beta = await manager.getSession(r2.session.id);
    expect(beta.spiralPosition.direction).toBe('east');

    // Alpha is at West
    const alpha = await manager.getSession(r1.session.id);
    expect(alpha.spiralPosition.direction).toBe('west');

    // Close Alpha, Beta still active
    await manager.closeSession(r1.session.id);
    const betaStill = await manager.getSession(r2.session.id);
    expect(betaStill.status).toBe('active');
  });
});
