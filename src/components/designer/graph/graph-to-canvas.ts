// ─── Graph → Canvas Conversion ───────────────────────────────────────────────
// Converts KuzuDB graph query results (GraphNode[], GraphEdge[]) into
// CanvasNode[] + CanvasEdge[] for the shared SVG canvas engine.
// Pure functions — no React, no side effects.

import type { GraphNode, GraphEdge, NodeType, EdgeType, DirectionName } from '@forgewright/lib/types';
import type {
  CanvasNode,
  CanvasEdge,
  CanvasNodeStyle,
  CanvasEdgeStyle,
} from '../canvas/types';

// ─── Node Type → Color Mapping ───────────────────────────────────────────────

const NODE_TYPE_COLORS: Record<NodeType, { fill: string; stroke: string }> = {
  Intent:        { fill: '#2a2500', stroke: '#fbbf24' },  // yellow
  StateMachine:  { fill: '#0c1929', stroke: '#3b82f6' },  // blue
  Ceremony:      { fill: '#1a0a2e', stroke: '#a855f7' },  // purple
  NarrativeBeat: { fill: '#052e16', stroke: '#22c55e' },  // green
  Spec:          { fill: '#1a1a2e', stroke: '#FFD700' },  // gold
  Companion:     { fill: '#1a0a2e', stroke: '#c084fc' },  // lavender
  Session:       { fill: '#0c1929', stroke: '#38bdf8' },  // sky
  ActionStep:    { fill: '#1c1917', stroke: '#fb923c' },  // orange
  State:         { fill: '#1e293b', stroke: '#64748b' },  // slate
  Event:         { fill: '#1a1a2e', stroke: '#22d3ee' },  // cyan
};

// ─── OCAP Access → Opacity ───────────────────────────────────────────────────

const OCAP_OPACITY: Record<string, number> = {
  public:    1.0,
  community: 0.9,
  ceremony:  0.6,
  sacred:    0.35,
};

// ─── Edge Type → Dash Pattern ────────────────────────────────────────────────

const EDGE_DASH_PATTERNS: Partial<Record<EdgeType, string>> = {
  DEPENDS_ON:       '8 4',       // dashed
  KIN_OF:           '2 4',       // dotted
  SERVES_DIRECTION: '',          // solid
  ACCOUNTABLE_TO:   '',          // solid
  BELONGS_TO:       '4 2',      // short dash
  TRANSITIONS_TO:   '',          // solid
  CONTAINS:         '6 2 2 2',  // dash-dot
  NARRATES:         '3 3',      // even dash
  AUTHORED_BY:      '',          // solid
  GOVERNED_BY:      '10 4',     // long dash
  GENERATED_FROM:   '4 4',      // medium dash
};

const EDGE_TYPE_COLORS: Record<EdgeType, string> = {
  DEPENDS_ON:       '#94a3b8',
  KIN_OF:           '#60a5fa',
  SERVES_DIRECTION: '#f472b6',
  ACCOUNTABLE_TO:   '#fbbf24',
  BELONGS_TO:       '#a78bfa',
  TRANSITIONS_TO:   '#64748b',
  CONTAINS:         '#475569',
  NARRATES:         '#34d399',
  AUTHORED_BY:      '#c084fc',
  GOVERNED_BY:      '#fb923c',
  GENERATED_FROM:   '#22d3ee',
};

// ─── Node Dimensions ─────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 140;
const DEFAULT_HEIGHT = 48;

// ─── Extract Label from GraphNode ────────────────────────────────────────────

export function getNodeLabel(node: GraphNode): string {
  switch (node.nodeType) {
    case 'Spec':          return node.name;
    case 'Companion':     return node.name;
    case 'Ceremony':      return node.name;
    case 'Session':       return node.title ?? `Session ${node.id.slice(0, 8)}`;
    case 'ActionStep':    return node.description.slice(0, 24);
    case 'NarrativeBeat': return node.content.slice(0, 24);
    case 'Intent':        return node.description.slice(0, 24);
    case 'StateMachine':  return node.name;
    case 'State':         return node.name;
    case 'Event':         return node.name;
  }
}

// ─── Extract Direction from GraphNode ────────────────────────────────────────

export function getNodeDirection(node: GraphNode): DirectionName | undefined {
  if ('direction' in node) return node.direction as DirectionName | undefined;
  return undefined;
}

// ─── Convert Single Node ─────────────────────────────────────────────────────

function graphNodeToCanvas(node: GraphNode): CanvasNode {
  const colors = NODE_TYPE_COLORS[node.nodeType];
  const opacity = OCAP_OPACITY[node.ocap.access] ?? 1.0;

  const style: CanvasNodeStyle = {
    fill: colors.fill,
    stroke: colors.stroke,
    strokeWidth: 2,
    rx: 8,
    opacity,
  };

  return {
    id: node.id,
    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    label: getNodeLabel(node),
    kind: node.nodeType,
    direction: getNodeDirection(node),
    data: { graphNode: node },
    style,
  };
}

// ─── Convert Single Edge ─────────────────────────────────────────────────────

function graphEdgeToCanvas(edge: GraphEdge): CanvasEdge {
  const style: CanvasEdgeStyle = {
    stroke: EDGE_TYPE_COLORS[edge.edgeType],
    strokeWidth: 1.5,
    strokeDasharray: EDGE_DASH_PATTERNS[edge.edgeType] ?? '',
    opacity: edge.strength ?? 1.0,
  };

  return {
    id: edge.id,
    source: edge.fromId,
    target: edge.toId,
    label: edge.edgeType.replace(/_/g, ' '),
    type: edge.edgeType,
    style,
  };
}

// ─── Main Conversion ─────────────────────────────────────────────────────────

export interface GraphToCanvasResult {
  canvasNodes: CanvasNode[];
  canvasEdges: CanvasEdge[];
}

export function graphToCanvas(
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphToCanvasResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const canvasNodes = nodes.map(graphNodeToCanvas);
  // Only include edges where both endpoints exist in the node set
  const canvasEdges = edges
    .filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId))
    .map(graphEdgeToCanvas);

  return { canvasNodes, canvasEdges };
}

// ─── Exports for external use ────────────────────────────────────────────────

export { NODE_TYPE_COLORS, OCAP_OPACITY, EDGE_DASH_PATTERNS, EDGE_TYPE_COLORS };
