// ─── Canvas-Specific Types ──────────────────────────────────────────────────
// Rendering layer types for the shared SVG canvas engine.
// Domain types (StateDef, GraphNode, etc.) live in src/lib/types/.

import type { DirectionName } from '@forgewright/lib/types';

// ─── Canvas Node ─────────────────────────────────────────────────────────────

export interface CanvasNodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  rx?: number;
  opacity?: number;
}

export interface CanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /** Domain-level kind: state kind, node type, or custom */
  kind?: string;
  /** Optional direction for Four Directions layout */
  direction?: DirectionName;
  /** Arbitrary domain data attached to this visual node */
  data?: Record<string, unknown>;
  style?: CanvasNodeStyle;
}

// ─── Canvas Edge ─────────────────────────────────────────────────────────────

export interface CanvasEdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Edge type for color coding (domain-level: TRANSITIONS_TO, KIN_OF, etc.) */
  type?: string;
  style?: CanvasEdgeStyle;
}

// ─── Viewport ────────────────────────────────────────────────────────────────

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.1;

// ─── Canvas Mode & Selection ─────────────────────────────────────────────────

export type CanvasMode = 'select' | 'transition' | 'pan';

export interface SelectionState {
  kind: 'node' | 'edge' | null;
  id: string | null;
}

export const EMPTY_SELECTION: SelectionState = { kind: null, id: null };

// ─── Graph Delta (for MCP ↔ Designer sync) ──────────────────────────────────

export interface MovedNode {
  id: string;
  x: number;
  y: number;
}

export interface GraphDelta {
  addedNodes?: CanvasNode[];
  removedNodes?: string[];
  addedEdges?: CanvasEdge[];
  removedEdges?: string[];
  movedNodes?: MovedNode[];
}

// ─── Context Menu ────────────────────────────────────────────────────────────

export interface ContextMenuItem {
  label: string;
  action: string;
  icon?: string;
  disabled?: boolean;
}

// ─── Resolved Edge Endpoints (for rendering) ────────────────────────────────

export interface ResolvedEdge extends CanvasEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}
