// ─── Forgewright Designer Canvas ─────────────────────────────────────────────
// Shared SVG canvas engine for State Machine view + Relational Graph view.
// See rispecs/05-visual-designer.spec.md

// Components
export { default as CanvasEngine } from './CanvasEngine';
export { default as CanvasNode } from './CanvasNode';
export { default as CanvasEdge } from './CanvasEdge';
export { default as ContextMenu } from './ContextMenu';
export { default as ViewportControls, Minimap, fitToViewViewport } from './Viewport';

// Layout algorithms
export { hierarchicalLayout, circularLayout, forceLayout } from './layout';

// Types
export type {
  CanvasNode as CanvasNodeType,
  CanvasEdge as CanvasEdgeType,
  CanvasNodeStyle,
  CanvasEdgeStyle,
  Viewport,
  CanvasMode,
  SelectionState,
  GraphDelta,
  MovedNode,
  ContextMenuItem,
  ResolvedEdge,
} from './types';

export {
  DEFAULT_VIEWPORT,
  EMPTY_SELECTION,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from './types';
