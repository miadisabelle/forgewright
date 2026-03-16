// ─── Spiral Store ──────────────────────────────────────────────────────────
// Tracks the Four Directions spiral: East → South → West → North.
// Max 3 autonomous cycles. Oscillation detection. Checkpoint enforcement.

import { create } from 'zustand';
import type {
  DirectionName,
  CheckpointPolicy,
} from '@forgewright/lib/types';

// ─── Direction Sequence ───────────────────────────────────────────────────

const DIRECTION_ORDER: readonly DirectionName[] = ['east', 'south', 'west', 'north'] as const;

// ─── Types ────────────────────────────────────────────────────────────────

export interface DirectionEntry {
  direction: DirectionName;
  timestamp: string;
  cycleCount: number;
  event?: string;
}

export interface OscillationReport {
  detected: boolean;
  pattern: string;
  visitCounts: Record<DirectionName, number>;
  recommendation: string;
}

// ─── State Shape ──────────────────────────────────────────────────────────

interface SpiralState {
  currentDirection: DirectionName;
  cycleCount: number;
  maxCycles: number;
  checkpointPolicy: CheckpointPolicy;
  stateHistory: DirectionEntry[];
}

// ─── Actions ──────────────────────────────────────────────────────────────

interface SpiralActions {
  advanceDirection: () => DirectionName;
  completeCycle: () => void;
  detectOscillation: () => OscillationReport | null;
  triggerCheckpoint: () => void;
  resetSpiral: () => void;
  setCheckpointPolicy: (policy: Partial<CheckpointPolicy>) => void;
  setDirection: (direction: DirectionName) => void;
}

// ─── Computed selectors ───────────────────────────────────────────────────

export const spiralSelectors = {
  isAtCheckpoint: (state: SpiralState): boolean => {
    const { currentDirection, cycleCount, maxCycles, checkpointPolicy } = state;
    if (cycleCount >= maxCycles) return true;
    if (checkpointPolicy.mandatoryAt.includes(currentDirection)) return true;
    if (checkpointPolicy.type === 'cycle-complete' && currentDirection === 'north') return true;
    return false;
  },

  nextDirection: (state: SpiralState): DirectionName => {
    const idx = DIRECTION_ORDER.indexOf(state.currentDirection);
    return DIRECTION_ORDER[(idx + 1) % DIRECTION_ORDER.length]!;
  },

  isMaxCyclesReached: (state: SpiralState): boolean => {
    return state.cycleCount >= state.maxCycles;
  },

  currentDirectionIndex: (state: SpiralState): number => {
    return DIRECTION_ORDER.indexOf(state.currentDirection);
  },
};

// ─── Store ────────────────────────────────────────────────────────────────

export type SpiralStore = SpiralState & SpiralActions;

export const useSpiralStore = create<SpiralStore>()((set, get) => ({
  // State
  currentDirection: 'east',
  cycleCount: 0,
  maxCycles: 3,
  checkpointPolicy: {
    type: 'cycle-complete',
    mandatoryAt: ['north'],
    maxAutonomousCycles: 3,
  },
  stateHistory: [],

  // Actions
  advanceDirection: () => {
    const state = get();
    const idx = DIRECTION_ORDER.indexOf(state.currentDirection);
    const isLastDirection = idx === DIRECTION_ORDER.length - 1;
    const nextDir = DIRECTION_ORDER[(idx + 1) % DIRECTION_ORDER.length]!;

    const entry: DirectionEntry = {
      direction: state.currentDirection,
      timestamp: new Date().toISOString(),
      cycleCount: state.cycleCount,
      event: 'advance',
    };

    set({
      currentDirection: nextDir,
      cycleCount: isLastDirection ? state.cycleCount + 1 : state.cycleCount,
      stateHistory: [...state.stateHistory, entry],
    });

    return nextDir;
  },

  completeCycle: () => {
    const state = get();
    const entry: DirectionEntry = {
      direction: 'north',
      timestamp: new Date().toISOString(),
      cycleCount: state.cycleCount,
      event: 'cycle_complete',
    };

    set({
      currentDirection: 'east',
      cycleCount: state.cycleCount + 1,
      stateHistory: [...state.stateHistory, entry],
    });
  },

  detectOscillation: () => {
    const { stateHistory } = get();
    if (stateHistory.length < 6) return null;

    const recent = stateHistory.slice(-10);
    const visitCounts: Record<DirectionName, number> = { east: 0, south: 0, west: 0, north: 0 };
    for (const entry of recent) {
      visitCounts[entry.direction]++;
    }

    // Detect: same state visited 3+ times in recent history
    const repeated = (Object.entries(visitCounts) as [DirectionName, number][])
      .filter(([, count]) => count >= 3);

    if (repeated.length > 0) {
      return {
        detected: true,
        pattern: `Repeated visits: ${repeated.map(([d, c]) => `${d}(${c})`).join(', ')}`,
        visitCounts,
        recommendation: 'Consider structural adjustment or human checkpoint review.',
      };
    }

    // Detect: retreat pattern (going backwards)
    for (let i = 2; i < recent.length; i++) {
      const prev = DIRECTION_ORDER.indexOf(recent[i - 2]!.direction);
      const mid = DIRECTION_ORDER.indexOf(recent[i - 1]!.direction);
      const cur = DIRECTION_ORDER.indexOf(recent[i]!.direction);
      if (prev === cur && mid !== prev) {
        return {
          detected: true,
          pattern: `Retreat pattern at ${recent[i - 1]!.direction}: returned to ${recent[i]!.direction}`,
          visitCounts,
          recommendation: 'Phase retreat detected — suggest different approach.',
        };
      }
    }

    return null;
  },

  triggerCheckpoint: () => {
    const state = get();
    const entry: DirectionEntry = {
      direction: state.currentDirection,
      timestamp: new Date().toISOString(),
      cycleCount: state.cycleCount,
      event: 'checkpoint',
    };

    set({
      stateHistory: [...state.stateHistory, entry],
    });
  },

  resetSpiral: () => {
    set({
      currentDirection: 'east',
      cycleCount: 0,
      stateHistory: [],
    });
  },

  setCheckpointPolicy: (policy: Partial<CheckpointPolicy>) => {
    set((state) => ({
      checkpointPolicy: { ...state.checkpointPolicy, ...policy },
    }));
  },

  setDirection: (direction: DirectionName) => {
    set({ currentDirection: direction });
  },
}));
