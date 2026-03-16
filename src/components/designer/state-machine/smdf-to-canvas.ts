// ─── SMDF ↔ Canvas Conversion ────────────────────────────────────────────────
// Pure functions that convert between StateMachineDefinition (domain model)
// and CanvasNode[]/CanvasEdge[] (visual rendering model).
// See rispecs/05-visual-designer.spec.md — State Machine View.

import type {
  StateMachineDefinition,
  StateDef,
  TransitionDef,
} from '@forgewright/lib/types';
import type {
  CanvasNode as CanvasNodeType,
  CanvasEdge as CanvasEdgeType,
  CanvasNodeStyle,
} from '../canvas/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_WIDTH = 150;
const NODE_HEIGHT = 50;
const COMPOSITE_WIDTH = 180;
const COMPOSITE_HEIGHT = 60;

const KIND_STYLES: Record<string, { fill: string; stroke: string }> = {
  atomic:    { fill: '#1e3a5f', stroke: '#60a5fa' },   // blue
  composite: { fill: '#14532d', stroke: '#4ade80' },   // green
  parallel:  { fill: '#3b0764', stroke: '#c084fc' },   // purple
  final:     { fill: '#1e293b', stroke: '#64748b' },
  history:   { fill: '#1e293b', stroke: '#a78bfa' },
};

// ─── State Classification ────────────────────────────────────────────────────

export type StateType = 'atomic' | 'composite' | 'parallel' | 'final' | 'history';

export function classifyState(state: StateDef): StateType {
  if (state.kind === 'final') return 'final';
  if (state.kind === 'history') return 'history';
  if (state.parallel) return 'parallel';
  if (state.states && state.states.length > 0) return 'composite';
  return 'atomic';
}

// ─── SMDF → Canvas ──────────────────────────────────────────────────────────

export interface SmdfToCanvasResult {
  nodes: CanvasNodeType[];
  edges: CanvasEdgeType[];
}

/**
 * Convert an SMDF definition into canvas nodes and edges.
 * When `parentPath` is provided, only renders the children of the state
 * at the end of that path (composite drill-down).
 */
export function smdfToCanvas(
  definition: StateMachineDefinition,
  parentPath: string[] = [],
): SmdfToCanvasResult {
  const root = definition.state;
  const target = resolveParent(root, parentPath);
  if (!target) return { nodes: [], edges: [] };

  const states = getChildStates(target);
  const nodes: CanvasNodeType[] = [];
  const edges: CanvasEdgeType[] = [];

  for (const state of states) {
    const stateType = classifyState(state);
    const isComposite = stateType === 'composite' || stateType === 'parallel';
    const w = isComposite ? COMPOSITE_WIDTH : NODE_WIDTH;
    const h = isComposite ? COMPOSITE_HEIGHT : NODE_HEIGHT;
    const colors = KIND_STYLES[stateType] ?? KIND_STYLES.atomic;
    const canvasKind = stateType === 'composite' ? 'composite' : stateType;

    const style: CanvasNodeStyle = {
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 2,
      rx: stateType === 'history' ? 30 : 6,
      strokeDasharray: stateType === 'composite' ? '4 2' : undefined,
    };

    nodes.push({
      id: state.name,
      x: 0,
      y: 0,
      width: w,
      height: h,
      label: state.name,
      kind: canvasKind,
      data: {
        stateType,
        description: state.description,
        hasOnEntry: !!(state.onEntry?.actions?.length),
        hasOnExit: !!(state.onExit?.actions?.length),
        childCount: (state.states?.length ?? 0) + (state.parallel?.states?.length ?? 0),
      },
      style,
    });

    // Map transitions to edges
    for (const t of state.transitions ?? []) {
      if (!t.nextState) continue;
      const label = t.condition ? `${t.event} [${t.condition}]` : t.event;
      edges.push({
        id: `${state.name}-${t.event}-${t.nextState}`,
        source: state.name,
        target: t.nextState,
        label,
        type: 'TRANSITIONS_TO',
      });
    }
  }

  return { nodes, edges };
}

// ─── Canvas → SMDF ──────────────────────────────────────────────────────────

/**
 * Reconstruct an SMDF definition from canvas nodes and edges.
 * Uses the original definition as a base to preserve settings/events,
 * and rebuilds the state tree from the flat canvas representation.
 */
export function canvasToSMDF(
  nodes: CanvasNodeType[],
  edges: CanvasEdgeType[],
  base: StateMachineDefinition,
  parentPath: string[] = [],
): StateMachineDefinition {
  const root = structuredClone(base);
  const target = resolveParent(root.state, parentPath);
  if (!target) return root;

  const edgesBySource = new Map<string, CanvasEdgeType[]>();
  for (const e of edges) {
    const list = edgesBySource.get(e.source) ?? [];
    list.push(e);
    edgesBySource.set(e.source, list);
  }

  const newStates: StateDef[] = nodes.map((node) => {
    const existing = findState(target, node.id);
    const transitions: TransitionDef[] = (edgesBySource.get(node.id) ?? []).map((e) => {
      const labelParts = parseEdgeLabel(e.label ?? '');
      return {
        event: labelParts.event,
        nextState: e.target,
        condition: labelParts.guard || undefined,
      };
    });

    return {
      name: node.id,
      kind: existing?.kind,
      description: existing?.description ?? (node.data?.description as string | undefined),
      onEntry: existing?.onEntry,
      onExit: existing?.onExit,
      transitions: transitions.length > 0 ? transitions : undefined,
      states: existing?.states,
      parallel: existing?.parallel,
    };
  });

  if (parentPath.length === 0) {
    root.state = {
      ...root.state,
      states: newStates,
    };
  } else {
    target.states = newStates;
  }

  return root;
}

// ─── Collect Available Events ────────────────────────────────────────────────

/**
 * Get all events available from a given state (its transitions + parent transitions).
 */
export function getAvailableEvents(
  definition: StateMachineDefinition,
  stateName: string,
): Array<{ event: string; target: string; guard?: string }> {
  const events: Array<{ event: string; target: string; guard?: string }> = [];
  const state = findState(definition.state, stateName);
  if (!state) return events;

  for (const t of state.transitions ?? []) {
    if (t.nextState) {
      events.push({
        event: t.event,
        target: t.nextState,
        guard: t.condition,
      });
    }
  }

  return events;
}

/**
 * Collect all unique event IDs from the definition's event sources.
 */
export function getAllDefinedEvents(
  definition: StateMachineDefinition,
): string[] {
  const eventIds = new Set<string>();
  for (const source of definition.events ?? []) {
    for (const evt of source.events ?? []) {
      eventIds.add(evt.id);
    }
  }
  return Array.from(eventIds);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveParent(root: StateDef, path: string[]): StateDef | null {
  let current: StateDef | null = root;
  for (const segment of path) {
    current = findState(current, segment);
    if (!current) return null;
  }
  return current;
}

function getChildStates(state: StateDef): StateDef[] {
  if (state.parallel) {
    return state.parallel.states;
  }
  return state.states ?? [];
}

function findState(parent: StateDef, name: string): StateDef | null {
  for (const child of parent.states ?? []) {
    if (child.name === name) return child;
  }
  if (parent.parallel) {
    for (const child of parent.parallel.states) {
      if (child.name === name) return child;
    }
  }
  return null;
}

function parseEdgeLabel(label: string): { event: string; guard?: string } {
  const match = label.match(/^(.+?)\s*\[(.+)\]$/);
  if (match) {
    return { event: match[1].trim(), guard: match[2].trim() };
  }
  return { event: label.trim() };
}
