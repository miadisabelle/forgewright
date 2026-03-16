// ─── Graph Store ───────────────────────────────────────────────────────────
// Caches graph query results and neighborhood traversals from KuzuDB.
// Purely client-side cache — actual queries dispatch to the MCP/API layer.

import { create } from 'zustand';
import type { GraphNode, GraphEdge, EdgeType } from '@forgewright/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface GraphQueryResult {
  id: string;
  query: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  timestamp: string;
  duration: number;
}

export interface NeighborhoodResult {
  centerId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth: number;
  edgeTypes?: EdgeType[];
}

// ─── State Shape ──────────────────────────────────────────────────────────

interface GraphState {
  lastQuery: string | null;
  queryResults: GraphQueryResult[];
  neighborhoodCache: Map<string, NeighborhoodResult>;
  isQuerying: boolean;
  error: string | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────

interface GraphActions {
  runQuery: (query: string, result: GraphQueryResult) => void;
  getNeighborhood: (centerId: string) => NeighborhoodResult | null;
  setNeighborhood: (centerId: string, result: NeighborhoodResult) => void;
  clearCache: () => void;
  setQuerying: (querying: boolean) => void;
  setError: (error: string | null) => void;
  removeQueryResult: (id: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────

export type GraphStore = GraphState & GraphActions;

export const useGraphStore = create<GraphStore>()((set, get) => ({
  // State
  lastQuery: null,
  queryResults: [],
  neighborhoodCache: new Map(),
  isQuerying: false,
  error: null,

  // Actions
  runQuery: (query: string, result: GraphQueryResult) => {
    set((state) => ({
      lastQuery: query,
      queryResults: [...state.queryResults, result],
      isQuerying: false,
      error: null,
    }));
  },

  getNeighborhood: (centerId: string) => {
    return get().neighborhoodCache.get(centerId) ?? null;
  },

  setNeighborhood: (centerId: string, result: NeighborhoodResult) => {
    set((state) => {
      const next = new Map(state.neighborhoodCache);
      next.set(centerId, result);
      return { neighborhoodCache: next };
    });
  },

  clearCache: () => {
    set({
      queryResults: [],
      neighborhoodCache: new Map(),
      lastQuery: null,
      error: null,
    });
  },

  setQuerying: (querying: boolean) => {
    set({ isQuerying: querying });
  },

  setError: (error: string | null) => {
    set({ error, isQuerying: false });
  },

  removeQueryResult: (id: string) => {
    set((state) => ({
      queryResults: state.queryResults.filter((r) => r.id !== id),
    }));
  },
}));
