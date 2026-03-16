/**
 * SpiralTracker — tracks position within the Medicine Wheel development spiral.
 *
 * The spiral follows East → South → West → North, advancing one direction
 * at a time. Each full revolution (E→S→W→N) constitutes one cycle.
 * Maximum 3 cycles before mandatory human review.
 *
 * Every invocation is a spiral, not a loop — the radius expands with each cycle.
 */

import type { DirectionName } from '../types/directions.js';
import type { SpiralPosition } from '../types/session.js';
import { DIRECTION_NAMES } from '../types/directions.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DirectionEntry {
  direction: DirectionName;
  cycleCount: number;
  timestamp: string;
  transitionFrom?: DirectionName;
}

export interface CheckpointRequest {
  sessionId: string;
  position: SpiralPosition;
  reason: string;
  timestamp: string;
  requiresHumanReview: boolean;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class SpiralMaxCyclesError extends Error {
  constructor(
    public readonly currentCycle: number,
    public readonly maxCycles: number,
  ) {
    super(
      `Maximum cycles reached: ${currentCycle}/${maxCycles} — mandatory human review required`,
    );
    this.name = 'SpiralMaxCyclesError';
  }
}

// ─── Direction Flow ──────────────────────────────────────────────────────────

const NEXT_DIRECTION: Record<DirectionName, DirectionName> = {
  east: 'south',
  south: 'west',
  west: 'north',
  north: 'east',
};

// ─── SpiralTracker ───────────────────────────────────────────────────────────

export class SpiralTracker {
  private readonly sessionId: string;
  private direction: DirectionName;
  private cycleCount: number;
  private readonly maxCycles: number;
  private readonly history: DirectionEntry[];

  constructor(
    sessionId: string,
    options?: {
      startDirection?: DirectionName;
      maxCycles?: number;
      cycleCount?: number;
    },
  ) {
    this.sessionId = sessionId;
    this.direction = options?.startDirection ?? 'east';
    this.cycleCount = options?.cycleCount ?? 1;
    this.maxCycles = options?.maxCycles ?? 3;
    this.history = [
      {
        direction: this.direction,
        cycleCount: this.cycleCount,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  /**
   * Advance to the next direction on the wheel.
   * E→S→W→N, then increment cycle and return to East.
   * Throws SpiralMaxCyclesError if max cycles would be exceeded.
   */
  advanceDirection(): DirectionName {
    const previousDirection = this.direction;

    if (this.direction === 'north') {
      this.completeCycle();
      this.direction = 'east';
    } else {
      this.direction = NEXT_DIRECTION[this.direction];
    }

    this.history.push({
      direction: this.direction,
      cycleCount: this.cycleCount,
      timestamp: new Date().toISOString(),
      transitionFrom: previousDirection,
    });

    return this.direction;
  }

  /**
   * Complete the current cycle. Called when North finishes.
   * Enforces the 3-cycle maximum — throws if exceeded.
   */
  completeCycle(): void {
    if (this.cycleCount >= this.maxCycles) {
      throw new SpiralMaxCyclesError(this.cycleCount, this.maxCycles);
    }
    this.cycleCount++;
  }

  /** Current spiral position snapshot. */
  getCurrentPosition(): SpiralPosition {
    return {
      direction: this.direction,
      cycleCount: this.cycleCount,
      maxCycles: this.maxCycles,
      isAtCheckpoint: this.isAtCheckpoint(),
    };
  }

  /**
   * True at each direction boundary — any transition between directions.
   * False only at the initial position before any advancement.
   */
  isAtCheckpoint(): boolean {
    if (this.history.length < 2) return false;
    const last = this.history[this.history.length - 1];
    return (
      last.transitionFrom !== undefined &&
      last.transitionFrom !== last.direction
    );
  }

  /** Create a checkpoint request for human review enforcement. */
  triggerCheckpoint(): CheckpointRequest {
    const isFinalCycle = this.cycleCount >= this.maxCycles;
    return {
      sessionId: this.sessionId,
      position: this.getCurrentPosition(),
      reason: isFinalCycle
        ? `Final cycle ${this.cycleCount}/${this.maxCycles} — mandatory human review`
        : `Direction boundary: entering ${this.direction} (cycle ${this.cycleCount}/${this.maxCycles})`,
      timestamp: new Date().toISOString(),
      requiresHumanReview: isFinalCycle,
    };
  }

  /** Full direction transition history with timestamps. */
  getHistory(): readonly DirectionEntry[] {
    return this.history;
  }

  /** Session ID this tracker belongs to. */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Peek at next direction without advancing. */
  peekNextDirection(): DirectionName {
    return NEXT_DIRECTION[this.direction];
  }

  /** Remaining cycles before mandatory human review. */
  remainingCycles(): number {
    return Math.max(0, this.maxCycles - this.cycleCount);
  }
}
