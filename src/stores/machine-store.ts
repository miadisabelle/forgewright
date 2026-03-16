// ─── Machine Store ─────────────────────────────────────────────────────────
// State machine runtime state: SMDF definition, current state, event history.
// Uses immer for immutable updates on deeply nested state machine structures.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  WorkspaceStateMachine,
  StateMachineDefinition,
  StateMachineEvent,
} from '@forgewright/lib/types';

// ─── State Shape ──────────────────────────────────────────────────────────

interface MachineState {
  currentMachine: WorkspaceStateMachine | null;
  currentState: string | null;
  tensionLevel: number;
  eventHistory: StateMachineEvent[];
  isTransitioning: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────

interface MachineActions {
  loadMachine: (machine: WorkspaceStateMachine) => void;
  fireEvent: (event: {
    eventId: string;
    toState: string;
    payload?: Record<string, unknown>;
  }) => void;
  updateReality: (updates: {
    currentState?: string;
    tensionLevel?: number;
  }) => void;
  setTensionLevel: (level: number) => void;
  unloadMachine: () => void;
  clearHistory: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────

export type MachineStore = MachineState & MachineActions;

export const useMachineStore = create<MachineStore>()(
  immer((set, get) => ({
    // State
    currentMachine: null,
    currentState: null,
    tensionLevel: 0.5,
    eventHistory: [],
    isTransitioning: false,

    // Actions
    loadMachine: (machine: WorkspaceStateMachine) => {
      set((state) => {
        state.currentMachine = machine;
        state.currentState = machine.currentState;
        state.tensionLevel = machine.tensionLevel;
        state.eventHistory = [...machine.eventHistory];
        state.isTransitioning = false;
      });
    },

    fireEvent: ({ eventId, toState, payload }) => {
      set((state) => {
        if (!state.currentMachine || !state.currentState) return;

        const event: StateMachineEvent = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          eventId,
          fromState: state.currentState,
          toState,
          payload,
        };

        state.currentState = toState;
        state.eventHistory.push(event);
        state.currentMachine.currentState = toState;
        state.currentMachine.eventHistory.push(event);
        state.currentMachine.updatedAt = new Date().toISOString();
      });
    },

    updateReality: ({ currentState, tensionLevel }) => {
      set((state) => {
        if (currentState !== undefined) {
          state.currentState = currentState;
          if (state.currentMachine) {
            state.currentMachine.currentState = currentState;
          }
        }
        if (tensionLevel !== undefined) {
          state.tensionLevel = tensionLevel;
          if (state.currentMachine) {
            state.currentMachine.tensionLevel = tensionLevel;
          }
        }
        if (state.currentMachine) {
          state.currentMachine.updatedAt = new Date().toISOString();
        }
      });
    },

    setTensionLevel: (level: number) => {
      set((state) => {
        state.tensionLevel = level;
        if (state.currentMachine) {
          state.currentMachine.tensionLevel = level;
        }
      });
    },

    unloadMachine: () => {
      set((state) => {
        state.currentMachine = null;
        state.currentState = null;
        state.tensionLevel = 0.5;
        state.eventHistory = [];
        state.isTransitioning = false;
      });
    },

    clearHistory: () => {
      set((state) => {
        state.eventHistory = [];
        if (state.currentMachine) {
          state.currentMachine.eventHistory = [];
        }
      });
    },
  })),
);
