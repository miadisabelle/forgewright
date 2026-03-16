// ─── PDE Store ─────────────────────────────────────────────────────────────
// Manages Prompt Decomposition Engine state: decompositions, pipeline stages,
// and structured plans flowing through East ceremony.

import { create } from 'zustand';
import type {
  OntologicalDecomposition,
  StoredDecomposition,
  StructuredPlan,
  PipelineStage,
  DecompositionResult,
} from '@forgewright/lib/types';

// ─── State Shape ──────────────────────────────────────────────────────────

interface PdeState {
  currentDecomposition: OntologicalDecomposition | null;
  structuredPlan: StructuredPlan | null;
  pipelineStage: PipelineStage;
  decompositions: StoredDecomposition[];
  isProcessing: boolean;
  error: string | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────

interface PdeActions {
  startDecomposition: (prompt: string) => string;
  setDecomposition: (decomposition: OntologicalDecomposition) => void;
  setStage: (stage: PipelineStage) => void;
  completePipeline: (plan: StructuredPlan) => void;
  storeDecomposition: (stored: StoredDecomposition) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  clearCurrent: () => void;
  loadDecomposition: (id: string) => StoredDecomposition | null;
}

// ─── Store ────────────────────────────────────────────────────────────────

export type PdeStore = PdeState & PdeActions;

export const usePdeStore = create<PdeStore>()((set, get) => ({
  // State
  currentDecomposition: null,
  structuredPlan: null,
  pipelineStage: 'decompose',
  decompositions: [],
  isProcessing: false,
  error: null,

  // Actions
  startDecomposition: (prompt: string) => {
    const id = crypto.randomUUID();
    set({
      pipelineStage: 'decompose',
      structuredPlan: null,
      currentDecomposition: null,
      isProcessing: true,
      error: null,
    });
    return id;
  },

  setDecomposition: (decomposition: OntologicalDecomposition) => {
    set({
      currentDecomposition: decomposition,
      pipelineStage: 'enrich',
      isProcessing: false,
    });
  },

  setStage: (stage: PipelineStage) => {
    set({ pipelineStage: stage });
  },

  completePipeline: (plan: StructuredPlan) => {
    set({
      structuredPlan: plan,
      pipelineStage: 'plan',
      isProcessing: false,
    });
  },

  storeDecomposition: (stored: StoredDecomposition) => {
    set((state) => ({
      decompositions: [
        ...state.decompositions.filter((d) => d.id !== stored.id),
        stored,
      ],
    }));
  },

  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },

  setError: (error: string | null) => {
    set({ error, isProcessing: false });
  },

  clearCurrent: () => {
    set({
      currentDecomposition: null,
      structuredPlan: null,
      pipelineStage: 'decompose',
      isProcessing: false,
      error: null,
    });
  },

  loadDecomposition: (id: string) => {
    return get().decompositions.find((d) => d.id === id) ?? null;
  },
}));
