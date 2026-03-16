// ─── Designer Store ────────────────────────────────────────────────────────
// Visual designer state: nodes, edges, viewport, composite drill-down.
// Undo/redo (50-deep) via zundo temporal middleware.
// Immer for immutable updates on deeply nested state.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import type { DirectionName } from '@forgewright/lib/types';

// ─── Canvas Types ─────────────────────────────────────────────────────────

export interface CanvasNode {
  id: string;
  name: string;
  kind: 'normal' | 'final' | 'history' | 'composite' | 'parallel';
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  direction?: DirectionName;
  metadata?: Record<string, unknown>;
}

export interface CanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  event: string;
  condition?: string;
  label?: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type DesignerMode = 'select' | 'transition' | 'pan';

export interface GraphDelta {
  type: 'add_node' | 'remove_node' | 'move_node' | 'add_edge' | 'remove_edge' | 'update_node';
  payload: Record<string, unknown>;
  timestamp: string;
}

// ─── State Shape ──────────────────────────────────────────────────────────

interface DesignerState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  mode: DesignerMode;
  selection: string | null;
  navigationPath: string[];
  pendingDeltas: GraphDelta[];
}

// ─── Actions ──────────────────────────────────────────────────────────────

interface DesignerActions {
  addNode: (node: CanvasNode) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  addEdge: (edge: CanvasEdge) => void;
  removeEdge: (id: string) => void;
  setMode: (mode: DesignerMode) => void;
  setSelection: (id: string | null) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  navigateInto: (stateName: string) => void;
  navigateUp: () => void;
  navigateToRoot: () => void;
  clearCanvas: () => void;
  consumeDeltas: () => GraphDelta[];
  loadState: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function emitDelta(
  type: GraphDelta['type'],
  payload: Record<string, unknown>,
): GraphDelta {
  return { type, payload, timestamp: new Date().toISOString() };
}

// ─── Store ────────────────────────────────────────────────────────────────

export type DesignerStore = DesignerState & DesignerActions;

export const useDesignerStore = create<DesignerStore>()(
  temporal(
    immer((set, get) => ({
      // State
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: 'select' as DesignerMode,
      selection: null,
      navigationPath: [],
      pendingDeltas: [],

      // Actions
      addNode: (node: CanvasNode) => {
        set((state) => {
          state.nodes.push(node);
          state.pendingDeltas.push(
            emitDelta('add_node', { node }),
          );
        });
      },

      removeNode: (id: string) => {
        set((state) => {
          state.nodes = state.nodes.filter((n) => n.id !== id);
          state.edges = state.edges.filter(
            (e) => e.sourceId !== id && e.targetId !== id,
          );
          if (state.selection === id) state.selection = null;
          state.pendingDeltas.push(emitDelta('remove_node', { id }));
        });
      },

      moveNode: (id: string, x: number, y: number) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === id);
          if (node) {
            node.x = x;
            node.y = y;
            state.pendingDeltas.push(emitDelta('move_node', { id, x, y }));
          }
        });
      },

      updateNode: (id: string, updates: Partial<CanvasNode>) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === id);
          if (node) {
            Object.assign(node, updates);
            state.pendingDeltas.push(
              emitDelta('update_node', { id, updates }),
            );
          }
        });
      },

      addEdge: (edge: CanvasEdge) => {
        set((state) => {
          state.edges.push(edge);
          state.pendingDeltas.push(emitDelta('add_edge', { edge }));
        });
      },

      removeEdge: (id: string) => {
        set((state) => {
          state.edges = state.edges.filter((e) => e.id !== id);
          state.pendingDeltas.push(emitDelta('remove_edge', { id }));
        });
      },

      setMode: (mode: DesignerMode) => {
        set((state) => {
          state.mode = mode;
        });
      },

      setSelection: (id: string | null) => {
        set((state) => {
          state.selection = id;
        });
      },

      setViewport: (viewport: Partial<Viewport>) => {
        set((state) => {
          Object.assign(state.viewport, viewport);
        });
      },

      navigateInto: (stateName: string) => {
        set((state) => {
          state.navigationPath.push(stateName);
          state.selection = null;
        });
      },

      navigateUp: () => {
        set((state) => {
          state.navigationPath.pop();
          state.selection = null;
        });
      },

      navigateToRoot: () => {
        set((state) => {
          state.navigationPath = [];
          state.selection = null;
        });
      },

      clearCanvas: () => {
        set((state) => {
          state.nodes = [];
          state.edges = [];
          state.selection = null;
          state.navigationPath = [];
          state.pendingDeltas = [];
        });
      },

      consumeDeltas: () => {
        const deltas = [...get().pendingDeltas];
        set((state) => {
          state.pendingDeltas = [];
        });
        return deltas;
      },

      loadState: (nodes: CanvasNode[], edges: CanvasEdge[]) => {
        set((state) => {
          state.nodes = nodes;
          state.edges = edges;
          state.selection = null;
          state.pendingDeltas = [];
        });
      },
    })),
    {
      limit: 50,
      partialize: (state) => {
        const { pendingDeltas, ...tracked } = state;
        return tracked;
      },
    },
  ),
);
