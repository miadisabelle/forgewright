// ─── Session Store ─────────────────────────────────────────────────────────
// Manages Forgewright session lifecycle: creation, resumption, spiral tracking.
// Persisted to localStorage via zustand/middleware.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ForgewrightSession,
  SpiralPosition,
  CompanionRef,
  SessionStatus,
  DirectionName,
  CheckpointPolicy,
} from '@forgewright/lib/types';

// ─── State Shape ──────────────────────────────────────────────────────────

interface SessionState {
  currentSession: ForgewrightSession | null;
  sessions: ForgewrightSession[];
  isLoading: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────

interface SessionActions {
  createSession: (intent: string) => ForgewrightSession;
  resumeSession: (id: string) => void;
  updateSpiralPosition: (position: Partial<SpiralPosition>) => void;
  setCompanions: (companions: CompanionRef[]) => void;
  updateStatus: (status: SessionStatus) => void;
  setCheckpointPolicy: (policy: CheckpointPolicy) => void;
  setLoading: (loading: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────

export type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // State
      currentSession: null,
      sessions: [],
      isLoading: false,

      // Actions
      createSession: (intent: string) => {
        const now = new Date().toISOString();
        const session: ForgewrightSession = {
          id: crypto.randomUUID(),
          intent,
          companions: [],
          spiralPosition: {
            direction: 'east',
            cycleCount: 0,
            maxCycles: 4,
            isAtCheckpoint: false,
          },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          currentSession: session,
          sessions: [...state.sessions, session],
        }));

        return session;
      },

      resumeSession: (id: string) => {
        const session = get().sessions.find((s) => s.id === id) ?? null;
        set({ currentSession: session, isLoading: false });
      },

      updateSpiralPosition: (position: Partial<SpiralPosition>) => {
        const current = get().currentSession;
        if (!current) return;

        const updated: ForgewrightSession = {
          ...current,
          spiralPosition: { ...current.spiralPosition, ...position },
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          currentSession: updated,
          sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)),
        }));
      },

      setCompanions: (companions: CompanionRef[]) => {
        const current = get().currentSession;
        if (!current) return;

        const updated: ForgewrightSession = {
          ...current,
          companions,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          currentSession: updated,
          sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)),
        }));
      },

      updateStatus: (status: SessionStatus) => {
        const current = get().currentSession;
        if (!current) return;

        const updated: ForgewrightSession = {
          ...current,
          status,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          currentSession: updated,
          sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)),
        }));
      },

      setCheckpointPolicy: (policy: CheckpointPolicy) => {
        const current = get().currentSession;
        if (!current) return;

        const updated: ForgewrightSession = {
          ...current,
          checkpointPolicy: policy,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          currentSession: updated,
          sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)),
        }));
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'forgewright-session',
      partialize: (state) => ({
        currentSession: state.currentSession,
        sessions: state.sessions,
      }),
    },
  ),
);
