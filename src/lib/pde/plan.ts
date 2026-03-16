/**
 * Stage 4: NORTH — Action (Plan)
 *
 * Topological sort, action stack generation, SMDF seed, graph nodes,
 * narrative beats.
 */

import { randomUUID } from 'node:crypto';
import {
  DIRECTIONS,
  DIRECTION_NAMES,
  DIRECTION_ACTS,
  type DirectionName,
} from '../types/directions';
import type {
  OntologicalDecomposition,
  PdeActionItem,
  StructuredPlan,
} from '../types/pde';
import type { NarrativeBeat } from '../types/narrative';
import type { StateMachineDefinition, StateDef, TransitionDef } from '../types/smdf';

// ─── Main plan function ──────────────────────────────────────────────────────

export function plan(assessed: OntologicalDecomposition): StructuredPlan {
  // 1. Topological sort by direction flow + dependency graph
  const sortedActions = topologicalSort(assessed.actionStack);

  // Replace the action stack with sorted version
  const planned = structuredClone(assessed);
  planned.actionStack = sortedActions;

  // 2. Generate SMDF seed
  const smdfSeed = generateSmdfSeed(planned);

  // 3. Generate graph nodes
  const graphNodes = generateGraphNodes(planned);

  // 4. Generate narrative beats
  const narrativeBeats = generateNarrativeBeats(planned);
  planned.narrativeBeats = narrativeBeats;

  return {
    decomposition: planned,
    smdfSeed,
    graphNodes,
    narrativeBeats,
    ceremonyGuidance: planned.ceremonyGuidance,
  };
}

// ─── Topological Sort ────────────────────────────────────────────────────────

function topologicalSort(actions: PdeActionItem[]): PdeActionItem[] {
  if (actions.length === 0) return [];

  // Build adjacency list from dependencies
  const idMap = new Map<string, PdeActionItem>();
  for (const action of actions) {
    const id = action.id ?? `action-${actions.indexOf(action)}`;
    idMap.set(id, { ...action, id });
  }

  // Direction order weight: east=0, south=1, west=2, north=3
  const dirWeight: Record<DirectionName, number> = { east: 0, south: 100, west: 200, north: 300 };

  // Build dependency graph
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const action of actions) {
    const id = action.id!;
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const action of actions) {
    const id = action.id!;
    if (action.dependency && idMap.has(action.dependency)) {
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      const deps = dependents.get(action.dependency) ?? [];
      deps.push(id);
      dependents.set(action.dependency, deps);
    }
  }

  // Kahn's algorithm with direction-priority queue
  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  // Sort queue by direction weight
  queue.sort((a, b) => {
    const aDir = idMap.get(a)?.direction ?? 'north';
    const bDir = idMap.get(b)?.direction ?? 'north';
    return dirWeight[aDir] - dirWeight[bDir];
  });

  const sorted: PdeActionItem[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const action = idMap.get(current);
    if (action) sorted.push(action);

    for (const dep of dependents.get(current) ?? []) {
      const newDegree = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) {
        queue.push(dep);
        // Re-sort to maintain direction priority
        queue.sort((a, b) => {
          const aDir = idMap.get(a)?.direction ?? 'north';
          const bDir = idMap.get(b)?.direction ?? 'north';
          return dirWeight[aDir] - dirWeight[bDir];
        });
      }
    }
  }

  // If cycle detected, append remaining items
  if (sorted.length < actions.length) {
    for (const action of actions) {
      if (!sorted.find(s => s.id === action.id)) {
        sorted.push(action);
      }
    }
  }

  return sorted;
}

// ─── SMDF Seed Generation ────────────────────────────────────────────────────

function generateSmdfSeed(planned: OntologicalDecomposition): StateMachineDefinition {
  const states: StateDef[] = [];
  const now = new Date().toISOString();

  // Initial state
  states.push({
    name: 'idle',
    kind: 'normal',
    description: 'Awaiting decomposition start',
    transitions: planned.actionStack.length > 0
      ? [{ event: 'start', nextState: planned.actionStack[0].id ?? 'action-0' }]
      : [],
  });

  // One state per action
  for (let i = 0; i < planned.actionStack.length; i++) {
    const action = planned.actionStack[i];
    const actionId = action.id ?? `action-${i}`;
    const nextId = i < planned.actionStack.length - 1
      ? (planned.actionStack[i + 1].id ?? `action-${i + 1}`)
      : 'completed';

    const transitions: TransitionDef[] = [
      {
        event: `${actionId}_done`,
        nextState: nextId,
        description: `Complete: ${action.text}`,
      },
    ];

    // If there's a dependency, add a blocked transition
    if (action.dependency) {
      transitions.push({
        event: `${actionId}_blocked`,
        nextState: actionId,
        condition: `waiting_for_${action.dependency}`,
        description: `Blocked: waiting for ${action.dependency}`,
      });
    }

    const dirInfo = DIRECTIONS[action.direction];
    states.push({
      name: actionId,
      kind: 'normal',
      description: `${dirInfo.emoji} [${dirInfo.name}] ${action.text}`,
      transitions,
    });
  }

  // Final state
  states.push({
    name: 'completed',
    kind: 'final',
    description: 'All actions completed',
  });

  // Build event sources from unique events
  const allEvents = states.flatMap(s => s.transitions?.map(t => t.event) ?? []);
  const uniqueEvents = Array.from(new Set(allEvents));

  return {
    settings: {
      namespace: `pde.${planned.id}`,
      name: `PDE Plan: ${planned.primary.action} ${planned.primary.target}`,
      asynchronous: true,
    },
    events: [{
      name: 'pde-pipeline',
      description: 'Events generated by PDE pipeline',
      events: uniqueEvents.map(e => ({
        id: e,
        name: e,
        description: `Pipeline event: ${e}`,
      })),
    }],
    state: {
      name: 'pde-plan',
      description: `PDE Plan state machine for: ${planned.primary.action} ${planned.primary.target}`,
      states,
    },
  };
}

// ─── Graph Node Generation ───────────────────────────────────────────────────

function generateGraphNodes(
  planned: OntologicalDecomposition,
): Array<{ nodeType: string; id: string; [key: string]: unknown }> {
  const nodes: Array<{ nodeType: string; id: string; [key: string]: unknown }> = [];
  const now = new Date().toISOString();

  // Primary intent → Intent node
  nodes.push({
    nodeType: 'Intent',
    id: `intent-primary-${planned.id}`,
    description: `${planned.primary.action} ${planned.primary.target}`,
    direction: planned.leadDirection,
    urgency: planned.primary.urgency,
    createdAt: now,
    isPrimary: true,
  });

  // Secondary intents → Intent nodes
  for (const intent of planned.secondary) {
    nodes.push({
      nodeType: 'Intent',
      id: `intent-${intent.id}-${planned.id}`,
      description: `${intent.action} ${intent.target}`,
      direction: intent.direction,
      urgency: 'session',
      createdAt: now,
      implicit: intent.implicit,
      wilsonAlignment: intent.wilsonAlignment,
    });
  }

  // Action stack → ActionStep nodes
  for (let i = 0; i < planned.actionStack.length; i++) {
    const action = planned.actionStack[i];
    nodes.push({
      nodeType: 'ActionStep',
      id: `action-${action.id}-${planned.id}`,
      description: action.text,
      orderIndex: i,
      status: action.completed ? 'done' : 'pending',
      direction: action.direction,
      createdAt: now,
      dependency: action.dependency,
    });
  }

  // Edges encoded as separate nodes for KuzuDB batch ingest
  for (const action of planned.actionStack) {
    if (action.dependency) {
      nodes.push({
        nodeType: '_Edge',
        id: `edge-${action.id}-depends-${action.dependency}-${planned.id}`,
        edgeType: 'DEPENDS_ON',
        fromId: `action-${action.id}-${planned.id}`,
        toId: `action-${action.dependency}-${planned.id}`,
        createdAt: now,
      });
    }

    // SERVES_DIRECTION edge
    nodes.push({
      nodeType: '_Edge',
      id: `edge-${action.id}-serves-${action.direction}-${planned.id}`,
      edgeType: 'SERVES_DIRECTION',
      fromId: `action-${action.id}-${planned.id}`,
      toId: action.direction,
      createdAt: now,
    });
  }

  return nodes;
}

// ─── Narrative Beat Generation ───────────────────────────────────────────────

function generateNarrativeBeats(planned: OntologicalDecomposition): NarrativeBeat[] {
  const beats: NarrativeBeat[] = [];
  const now = new Date().toISOString();

  for (const action of planned.actionStack) {
    const dir = action.direction;
    const dirInfo = DIRECTIONS[dir];

    beats.push({
      id: `beat-${action.id}-${planned.id}`,
      act: dirInfo.act,
      direction: dir,
      content: action.text,
      title: `${dirInfo.emoji} ${dirInfo.name}: ${action.text.substring(0, 50)}`,
      timestamp: now,
      ceremonies: planned.directions[dir].ceremonyRecommended
        ? [`${dirInfo.name} ceremony recommended`]
        : [],
      learnings: [],
      relations_honored: planned.directions[dir].obligations.flatMap(
        o => o.obligations.map(ob => ob.substring(0, 60)),
      ),
      prose: `In the ${dirInfo.name} (${dirInfo.ojibwe}) direction, the work of "${action.text}" calls forward.`,
      emotion: action.implicit ? 'uncertainty' : 'determination',
      intensity: action.confidence,
    });
  }

  return beats;
}
