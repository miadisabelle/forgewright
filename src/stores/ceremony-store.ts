// ─── Ceremony Store ────────────────────────────────────────────────────────
// Governs ceremony lifecycle and phase-based permission enforcement.
// Five phases: Preparation → Opening → Active → Integration → Closing.

import { create } from 'zustand';
import type {
  CeremonyRecord,
  CeremonyPhase,
  CeremonyType,
  AccessLevel,
  PHASE_ORDER,
  DEFAULT_PHASE_PERMISSIONS,
} from '@forgewright/lib/types';

// ─── Phase Ordering ───────────────────────────────────────────────────────

const PHASE_SEQUENCE: readonly CeremonyPhase[] = [
  'preparation', 'opening', 'active', 'integration', 'closing',
] as const;

const PHASE_PERMISSIONS: Record<CeremonyPhase, string[]> = {
  preparation: ['pde', 'graph:read'],
  opening: ['pde', 'graph:read', 'ceremony'],
  active: ['pde', 'graph:read', 'graph:write', 'smcraft', 'narrative', 'ceremony'],
  integration: ['graph:read', 'narrative', 'ceremony'],
  closing: ['graph:read', 'narrative', 'ceremony'],
};

// ─── State Shape ──────────────────────────────────────────────────────────

interface CeremonyState {
  activeCeremony: CeremonyRecord | null;
  currentPhase: CeremonyPhase;
  participants: string[];
  permissionLevel: AccessLevel;
}

// ─── Actions ──────────────────────────────────────────────────────────────

interface CeremonyActions {
  openCeremony: (params: {
    type: CeremonyType;
    intention: string;
    participants: string[];
    permissionLevel?: AccessLevel;
  }) => CeremonyRecord;
  advanceCeremony: () => CeremonyPhase | null;
  closeCeremony: () => void;
  checkPermission: (tool: string) => boolean;
  setPhase: (phase: CeremonyPhase) => void;
  addParticipant: (participant: string) => void;
  removeParticipant: (participant: string) => void;
  addEvent: (event: { type: string; description: string }) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────

export type CeremonyStore = CeremonyState & CeremonyActions;

export const useCeremonyStore = create<CeremonyStore>()((set, get) => ({
  // State
  activeCeremony: null,
  currentPhase: 'preparation',
  participants: [],
  permissionLevel: 'community',

  // Actions
  openCeremony: ({ type, intention, participants, permissionLevel }) => {
    const now = new Date().toISOString();
    const ceremony: CeremonyRecord = {
      id: crypto.randomUUID(),
      type,
      phase: 'preparation',
      participants,
      intention,
      timestamp: now,
      events: [],
    };

    set({
      activeCeremony: ceremony,
      currentPhase: 'preparation',
      participants,
      permissionLevel: permissionLevel ?? 'community',
    });

    return ceremony;
  },

  advanceCeremony: () => {
    const { activeCeremony, currentPhase } = get();
    if (!activeCeremony) return null;

    const currentIndex = PHASE_SEQUENCE.indexOf(currentPhase);
    if (currentIndex >= PHASE_SEQUENCE.length - 1) return null;

    const nextPhase = PHASE_SEQUENCE[currentIndex + 1]!;
    const now = new Date().toISOString();

    set({
      currentPhase: nextPhase,
      activeCeremony: {
        ...activeCeremony,
        phase: nextPhase,
        events: [
          ...activeCeremony.events,
          {
            id: crypto.randomUUID(),
            type: 'phase_advance',
            timestamp: now,
            description: `Advanced from ${currentPhase} to ${nextPhase}`,
          },
        ],
      },
    });

    return nextPhase;
  },

  closeCeremony: () => {
    const { activeCeremony } = get();
    if (!activeCeremony) return;

    set({
      activeCeremony: {
        ...activeCeremony,
        phase: 'closing',
        events: [
          ...activeCeremony.events,
          {
            id: crypto.randomUUID(),
            type: 'ceremony_closed',
            timestamp: new Date().toISOString(),
            description: 'Ceremony closed',
          },
        ],
      },
      currentPhase: 'closing',
    });
  },

  checkPermission: (tool: string) => {
    const { currentPhase, permissionLevel } = get();
    if (permissionLevel === 'sacred') return false;
    const allowed = PHASE_PERMISSIONS[currentPhase] ?? [];
    return allowed.includes(tool);
  },

  setPhase: (phase: CeremonyPhase) => {
    const { activeCeremony } = get();
    set({
      currentPhase: phase,
      activeCeremony: activeCeremony
        ? { ...activeCeremony, phase }
        : null,
    });
  },

  addParticipant: (participant: string) => {
    set((state) => ({
      participants: state.participants.includes(participant)
        ? state.participants
        : [...state.participants, participant],
      activeCeremony: state.activeCeremony
        ? {
            ...state.activeCeremony,
            participants: state.activeCeremony.participants.includes(participant)
              ? state.activeCeremony.participants
              : [...state.activeCeremony.participants, participant],
          }
        : null,
    }));
  },

  removeParticipant: (participant: string) => {
    set((state) => ({
      participants: state.participants.filter((p) => p !== participant),
      activeCeremony: state.activeCeremony
        ? {
            ...state.activeCeremony,
            participants: state.activeCeremony.participants.filter((p) => p !== participant),
          }
        : null,
    }));
  },

  addEvent: ({ type, description }) => {
    const { activeCeremony, currentPhase } = get();
    if (!activeCeremony) return;

    set({
      activeCeremony: {
        ...activeCeremony,
        events: [
          ...activeCeremony.events,
          {
            id: crypto.randomUUID(),
            type,
            timestamp: new Date().toISOString(),
            description,
            direction: undefined,
          },
        ],
      },
    });
  },
}));
