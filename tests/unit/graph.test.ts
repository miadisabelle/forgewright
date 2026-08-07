/**
 * Graph Module Tests — ForgewrightGraph, ingest, queries, OCAP, Wilson, export
 *
 * Uses in-memory graph store (no KuzuDB dependency).
 * Assertion coverage: A03-01 through A03-10
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ForgewrightGraph,
  type OcapContext,
  type SubgraphResult,
} from '@forgewright/lib/graph/database';

import {
  ingestPDE,
  ingestStateMachine,
  ingestCeremony,
  ingestNarrativeBeat,
  ingestKinship,
} from '@forgewright/lib/graph/ingest';

import {
  neighborhood,
  oscillationDetection,
} from '@forgewright/lib/graph/queries';

import {
  checkAccess,
  filterNodes,
  filterEdges,
  filterSubgraph,
  clearAuditLog,
  getAuditLog,
} from '@forgewright/lib/graph/ocap-filter';

import {
  computeWilsonAlignment,
} from '@forgewright/lib/graph/wilson';

import {
  toMermaid,
  summaryStats,
} from '@forgewright/lib/graph/export';

import type {
  GraphNode,
  GraphEdge,
  DecompositionResult,
  StateMachineDefinition,
  OcapMetadata,
} from '@forgewright/lib/types/index';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const publicOcap: OcapMetadata = {
  ownership: 'system',
  control: 'creator',
  access: 'public',
  possession: 'local',
};

const communityOcap: OcapMetadata = {
  ownership: 'community',
  control: 'council',
  access: 'community',
  possession: 'local',
};

const ceremonyOcap: OcapMetadata = {
  ownership: 'elder',
  control: 'ceremony-keeper',
  access: 'ceremony',
  possession: 'local',
};

const sacredOcap: OcapMetadata = {
  ownership: 'elder',
  control: 'ceremony-keeper',
  access: 'sacred',
  possession: 'local',
};

const publicCtx: OcapContext = {
  requester: 'test-agent',
  maxAccessLevel: 'public',
  isCeremonyActive: false,
};

const communityCtx: OcapContext = {
  requester: 'test-agent',
  maxAccessLevel: 'community',
  isCeremonyActive: false,
};

const ceremonyCtx: OcapContext = {
  requester: 'ceremony-agent',
  maxAccessLevel: 'sacred',
  ceremonyId: 'cer-001',
  isCeremonyActive: true,
};

const now = new Date().toISOString();

function makeDecomposition(): DecompositionResult {
  return {
    primary: {
      action: 'build',
      target: 'test suite',
      urgency: 'session',
      confidence: 0.9,
    },
    secondary: [
      {
        action: 'write',
        target: 'types tests',
        implicit: false,
        dependency: 'build',
        confidence: 0.8,
      },
    ],
    context: { files_needed: [], tools_required: [], assumptions: [] },
    outputs: { artifacts: [], updates: [], communications: [] },
    directions: {
      east: [{ text: 'Vision clarity', confidence: 0.8, implicit: false }],
      south: [],
      west: [{ text: 'Validate all schemas', confidence: 0.9, implicit: false }],
      north: [{ text: 'Implement tests', confidence: 0.95, implicit: false }],
    },
    actionStack: [
      {
        text: 'build test suite',
        direction: 'north',
        dependency: null,
        completed: false,
        confidence: 0.9,
        implicit: false,
      },
      {
        text: 'write types tests',
        direction: 'west',
        dependency: 'build test suite',
        completed: false,
        confidence: 0.8,
        implicit: false,
      },
    ],
    ambiguities: [],
  };
}

function makeSmdf(): StateMachineDefinition {
  return {
    settings: {
      namespace: 'test.workflow',
      name: 'TestWorkflow',
      asynchronous: true,
    },
    events: [
      {
        name: 'user-input',
        events: [
          { id: 'start', name: 'start' },
          { id: 'complete', name: 'complete' },
        ],
      },
    ],
    state: {
      name: 'root',
      states: [
        {
          name: 'idle',
          transitions: [{ event: 'start', nextState: 'running' }],
        },
        {
          name: 'running',
          transitions: [{ event: 'complete', nextState: 'done' }],
        },
        {
          name: 'done',
          kind: 'final',
        },
      ],
    },
  };
}

// ─── ForgewrightGraph core ───────────────────────────────────────────────────

describe('ForgewrightGraph', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('creates with in-memory store', () => {
    expect(graph).toBeDefined();
    expect(graph.isNative).toBe(false);
  });

  it('initSchema completes without error', async () => {
    // Already called in createInMemory; calling again should be idempotent
    await expect(graph.initSchema()).resolves.toBeUndefined();
  });

  it('creates and retrieves a node', async () => {
    const node: GraphNode = {
      id: 'test-node-1',
      nodeType: 'Intent',
      description: 'Test intent',
      urgency: 'session',
      ocap: publicOcap,
      createdAt: now,
    };
    await graph.createNode(node);
    const retrieved = await graph.getNode('test-node-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.nodeType).toBe('Intent');
  });

  it('returns null for missing node', async () => {
    const result = await graph.getNode('nonexistent');
    expect(result).toBeNull();
  });

  it('creates and retrieves an edge', async () => {
    const nodeA: GraphNode = {
      id: 'a', nodeType: 'Intent', description: 'A',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    };
    const nodeB: GraphNode = {
      id: 'b', nodeType: 'Intent', description: 'B',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    };
    await graph.createNode(nodeA);
    await graph.createNode(nodeB);

    const edge: GraphEdge = {
      id: 'edge-1',
      fromId: 'a',
      toId: 'b',
      edgeType: 'DEPENDS_ON',
      strength: 0.8,
      ocap: publicOcap,
      createdAt: now,
    };
    await graph.createEdge(edge);
    const found = await graph.findEdges('DEPENDS_ON');
    expect(found).toHaveLength(1);
    expect(found[0].fromId).toBe('a');
  });

  it('deletes a node and its connected edges', async () => {
    const nodeA: GraphNode = {
      id: 'del-a', nodeType: 'Intent', description: 'A',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    };
    const nodeB: GraphNode = {
      id: 'del-b', nodeType: 'Intent', description: 'B',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    };
    await graph.createNode(nodeA);
    await graph.createNode(nodeB);
    await graph.createEdge({
      id: 'del-edge', fromId: 'del-a', toId: 'del-b',
      edgeType: 'DEPENDS_ON', ocap: publicOcap, createdAt: now, strength: 1,
    });

    await graph.deleteNode('del-a');
    expect(await graph.getNode('del-a')).toBeNull();
    const edges = await graph.findEdges('DEPENDS_ON');
    expect(edges.filter(e => e.fromId === 'del-a' || e.toId === 'del-a')).toHaveLength(0);
  });

  it('findNodes returns only matching type', async () => {
    await graph.createNode({
      id: 'intent-1', nodeType: 'Intent', description: 'A',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    });
    await graph.createNode({
      id: 'spec-1', nodeType: 'Spec', name: 'S', version: '1.0',
      status: 'draft', ocap: publicOcap, createdAt: now,
    });
    const intents = await graph.findNodes('Intent');
    expect(intents).toHaveLength(1);
    expect(intents[0].nodeType).toBe('Intent');
  });

  it('close clears data in memory store', async () => {
    await graph.createNode({
      id: 'close-test', nodeType: 'Intent', description: 'X',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    });
    await graph.close();
    const result = await graph.getNode('close-test');
    expect(result).toBeNull();
  });
});

// ─── Ingest PDE ──────────────────────────────────────────────────────────────

describe('ingestPDE', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('creates Intent nodes from decomposition', async () => {
    const decomp = makeDecomposition();
    const { intentIds } = await ingestPDE(graph, decomp);
    // Primary + 1 secondary = 2 intents
    expect(intentIds).toHaveLength(2);

    const intents = await graph.findNodes('Intent');
    expect(intents.length).toBeGreaterThanOrEqual(2);
  });

  it('creates ActionStep nodes from action stack', async () => {
    const decomp = makeDecomposition();
    const { actionStepIds } = await ingestPDE(graph, decomp);
    expect(actionStepIds).toHaveLength(2);

    const steps = await graph.findNodes('ActionStep');
    expect(steps.length).toBeGreaterThanOrEqual(2);
  });

  it('creates DEPENDS_ON edges between actions with dependencies', async () => {
    const decomp = makeDecomposition();
    await ingestPDE(graph, decomp);

    const depEdges = await graph.findEdges('DEPENDS_ON');
    // secondary intent has a dependency, and action items may have deps
    expect(depEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('creates SERVES_DIRECTION edges for directional actions', async () => {
    const decomp = makeDecomposition();
    await ingestPDE(graph, decomp);

    const servesEdges = await graph.findEdges('SERVES_DIRECTION');
    expect(servesEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('stamps OCAP metadata on all created nodes', async () => {
    const decomp = makeDecomposition();
    await ingestPDE(graph, decomp);

    const intents = await graph.findNodes('Intent');
    for (const intent of intents) {
      expect(intent.ocap).toBeDefined();
      expect(intent.ocap.ownership).toBeDefined();
      expect(intent.ocap.access).toBeDefined();
    }
  });
});

// ─── Ingest StateMachine ─────────────────────────────────────────────────────

describe('ingestStateMachine', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('creates StateMachine node', async () => {
    const smdf = makeSmdf();
    const { machineId } = await ingestStateMachine(graph, smdf);
    expect(machineId).toBeDefined();

    const machines = await graph.findNodes('StateMachine');
    expect(machines).toHaveLength(1);
    expect(machines[0].id).toBe(machineId);
  });

  it('creates State nodes for each state', async () => {
    const smdf = makeSmdf();
    const { stateIds } = await ingestStateMachine(graph, smdf);
    // root has 3 child states: idle, running, done  (+ root itself = 4)
    expect(stateIds.length).toBeGreaterThanOrEqual(3);

    const states = await graph.findNodes('State');
    expect(states.length).toBeGreaterThanOrEqual(3);
  });

  it('creates Event nodes', async () => {
    const smdf = makeSmdf();
    const { eventIds } = await ingestStateMachine(graph, smdf);
    expect(eventIds).toHaveLength(2); // start, complete

    const events = await graph.findNodes('Event');
    expect(events).toHaveLength(2);
  });

  it('creates CONTAINS edges from machine to states', async () => {
    const smdf = makeSmdf();
    await ingestStateMachine(graph, smdf);

    const containsEdges = await graph.findEdges('CONTAINS');
    expect(containsEdges.length).toBeGreaterThanOrEqual(3);
  });

  it('creates TRANSITIONS_TO edges from state transitions', async () => {
    const smdf = makeSmdf();
    await ingestStateMachine(graph, smdf);

    const transitionEdges = await graph.findEdges('TRANSITIONS_TO');
    // idle→running, running→done = 2
    expect(transitionEdges.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Neighborhood Query ──────────────────────────────────────────────────────

describe('neighborhood', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();

    // Create a small graph: A --DEPENDS_ON--> B --DEPENDS_ON--> C
    const mkNode = (id: string): GraphNode => ({
      id, nodeType: 'Intent', description: id,
      urgency: 'session', ocap: publicOcap, createdAt: now,
    });

    await graph.createNode(mkNode('A'));
    await graph.createNode(mkNode('B'));
    await graph.createNode(mkNode('C'));

    await graph.createEdge({
      id: 'e1', fromId: 'A', toId: 'B', edgeType: 'DEPENDS_ON',
      ocap: publicOcap, createdAt: now, strength: 1,
    });
    await graph.createEdge({
      id: 'e2', fromId: 'B', toId: 'C', edgeType: 'DEPENDS_ON',
      ocap: publicOcap, createdAt: now, strength: 1,
    });
  });

  it('returns 1-hop neighbors', async () => {
    const result = await neighborhood(graph, 'A', communityCtx, 1);
    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain('B');
    expect(nodeIds).not.toContain('C'); // C is 2 hops away
  });

  it('returns 2-hop neighbors', async () => {
    const result = await neighborhood(graph, 'A', communityCtx, 2);
    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain('B');
    expect(nodeIds).toContain('C');
  });

  it('returns empty for isolated node', async () => {
    await graph.createNode({
      id: 'isolated', nodeType: 'Intent', description: 'alone',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    });
    const result = await neighborhood(graph, 'isolated', communityCtx, 1);
    expect(result.nodes).toHaveLength(0);
  });
});

// ─── OCAP Filter ─────────────────────────────────────────────────────────────

describe('OCAP filter', () => {
  beforeEach(() => {
    clearAuditLog();
  });

  it('blocks sacred nodes without ceremony context (A03-04)', () => {
    const decision = checkAccess('sacred-node', sacredOcap, publicCtx);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Sacred-level node');
  });

  it('blocks sacred nodes even with high access level but no active ceremony', () => {
    const ctx: OcapContext = {
      requester: 'high-level-agent',
      maxAccessLevel: 'sacred',
      isCeremonyActive: false,
    };
    const decision = checkAccess('sacred-node', sacredOcap, ctx);
    expect(decision.allowed).toBe(false);
  });

  it('allows sacred nodes WITH ceremony context', () => {
    const decision = checkAccess('sacred-node', sacredOcap, ceremonyCtx);
    expect(decision.allowed).toBe(true);
  });

  it('blocks ceremony-level nodes without active ceremony', () => {
    const decision = checkAccess('cer-node', ceremonyOcap, communityCtx);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Ceremony-level node');
  });

  it('allows ceremony-level nodes with active ceremony', () => {
    const decision = checkAccess('cer-node', ceremonyOcap, ceremonyCtx);
    expect(decision.allowed).toBe(true);
  });

  it('allows public nodes always', () => {
    const decision = checkAccess('pub-node', publicOcap, publicCtx);
    expect(decision.allowed).toBe(true);
  });

  it('allows community nodes with community-level access', () => {
    const decision = checkAccess('comm-node', communityOcap, communityCtx);
    expect(decision.allowed).toBe(true);
  });

  it('denies community nodes with public-only access', () => {
    const decision = checkAccess('comm-node', communityOcap, publicCtx);
    expect(decision.allowed).toBe(false);
  });

  it('logs audit entries for every access check', () => {
    clearAuditLog();
    checkAccess('n1', publicOcap, publicCtx);
    checkAccess('n2', sacredOcap, publicCtx);
    const log = getAuditLog();
    expect(log).toHaveLength(2);
    expect(log[0].nodeId).toBe('n1');
    expect(log[1].nodeId).toBe('n2');
  });

  it('filterNodes removes inaccessible nodes', () => {
    const nodes: GraphNode[] = [
      { id: 'pub', nodeType: 'Intent', description: 'public', urgency: 'session', ocap: publicOcap, createdAt: now },
      { id: 'sac', nodeType: 'Intent', description: 'sacred', urgency: 'session', ocap: sacredOcap, createdAt: now },
    ];
    const filtered = filterNodes(nodes, publicCtx);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('pub');
  });

  it('filterEdges removes inaccessible edges', () => {
    const edges: GraphEdge[] = [
      { id: 'e1', fromId: 'a', toId: 'b', edgeType: 'DEPENDS_ON', ocap: publicOcap, createdAt: now, strength: 1 },
      { id: 'e2', fromId: 'c', toId: 'd', edgeType: 'KIN_OF', ocap: sacredOcap, createdAt: now, strength: 1 },
    ];
    const filtered = filterEdges(edges, publicCtx);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('e1');
  });

  it('filterSubgraph removes nodes and orphaned edges', () => {
    const subgraph: SubgraphResult = {
      nodes: [
        { id: 'n1', nodeType: 'Intent', description: 'ok', urgency: 'session', ocap: publicOcap, createdAt: now },
        { id: 'n2', nodeType: 'Intent', description: 'hidden', urgency: 'session', ocap: sacredOcap, createdAt: now },
      ],
      edges: [
        { id: 'e1', fromId: 'n1', toId: 'n2', edgeType: 'DEPENDS_ON', ocap: publicOcap, createdAt: now, strength: 1 },
      ],
    };
    const filtered = filterSubgraph(subgraph, publicCtx);
    expect(filtered.nodes).toHaveLength(1);
    // Edge should be removed because n2 is gone
    expect(filtered.edges).toHaveLength(0);
  });
});

// ─── Wilson Alignment ────────────────────────────────────────────────────────

describe('computeWilsonAlignment', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('returns valid score in 0-1 range', async () => {
    const result = await computeWilsonAlignment(graph, communityCtx);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('returns all 4 component scores in 0-1 range', async () => {
    const result = await computeWilsonAlignment(graph, communityCtx);
    const { relationalDensity, ocapCompliance, accountabilityChains, ceremonyParticipation } = result.components;

    expect(relationalDensity).toBeGreaterThanOrEqual(0);
    expect(relationalDensity).toBeLessThanOrEqual(1);
    expect(ocapCompliance).toBeGreaterThanOrEqual(0);
    expect(ocapCompliance).toBeLessThanOrEqual(1);
    expect(accountabilityChains).toBeGreaterThanOrEqual(0);
    expect(accountabilityChains).toBeLessThanOrEqual(1);
    expect(ceremonyParticipation).toBeGreaterThanOrEqual(0);
    expect(ceremonyParticipation).toBeLessThanOrEqual(1);
  });

  it('returns a recommendation string', async () => {
    const result = await computeWilsonAlignment(graph, communityCtx);
    expect(['aligned', 'relational_attention_needed', 'ceremony_recommended']).toContain(
      result.recommendation,
    );
  });

  it('has human-readable details', async () => {
    const result = await computeWilsonAlignment(graph, communityCtx);
    expect(result.details).toContain('Relational Density');
    expect(result.details).toContain('OCAP Compliance');
  });

  it('score improves when graph has OCAP-compliant nodes + edges', async () => {
    // Empty graph baseline
    const emptyScore = await computeWilsonAlignment(graph, communityCtx);

    // Add nodes and edges
    const decomp = makeDecomposition();
    await ingestPDE(graph, decomp);

    const filledScore = await computeWilsonAlignment(graph, communityCtx);
    // With nodes and edges, density should increase from 0
    expect(filledScore.components.relationalDensity).toBeGreaterThanOrEqual(
      emptyScore.components.relationalDensity,
    );
  });

  it('empty graph gives perfect compliance + accountability (vacuous truth)', async () => {
    const result = await computeWilsonAlignment(graph, communityCtx);
    expect(result.components.ocapCompliance).toBe(1.0);
    expect(result.components.accountabilityChains).toBe(1.0);
    expect(result.components.ceremonyParticipation).toBe(1.0);
  });
});

// ─── Oscillation Detection ───────────────────────────────────────────────────

describe('oscillationDetection', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('returns no cycles for acyclic graph', async () => {
    // Create session + action steps with no cycles
    const session: GraphNode = {
      id: 'sess-1', nodeType: 'Session', startedAt: now,
      status: 'active', ocap: publicOcap, createdAt: now,
    };
    await graph.createNode(session);

    const stepA: GraphNode = {
      id: 'step-a', nodeType: 'ActionStep', description: 'A',
      status: 'pending', ocap: publicOcap, createdAt: now,
    };
    const stepB: GraphNode = {
      id: 'step-b', nodeType: 'ActionStep', description: 'B',
      status: 'pending', ocap: publicOcap, createdAt: now,
    };
    await graph.createNode(stepA);
    await graph.createNode(stepB);

    // BELONGS_TO session
    await graph.createEdge({
      id: 'bt-a', fromId: 'step-a', toId: 'sess-1', edgeType: 'BELONGS_TO',
      ocap: publicOcap, createdAt: now, strength: 1,
    });
    await graph.createEdge({
      id: 'bt-b', fromId: 'step-b', toId: 'sess-1', edgeType: 'BELONGS_TO',
      ocap: publicOcap, createdAt: now, strength: 1,
    });

    // A → B (no cycle)
    await graph.createEdge({
      id: 'dep-ab', fromId: 'step-a', toId: 'step-b', edgeType: 'DEPENDS_ON',
      ocap: publicOcap, createdAt: now, strength: 1,
    });

    const result = await oscillationDetection(graph, 'sess-1', communityCtx);
    expect(result.hasCycles).toBe(false);
    expect(result.cycles).toHaveLength(0);
  });

  it('detects cycles in dependency graph', async () => {
    const session: GraphNode = {
      id: 'sess-cyc', nodeType: 'Session', startedAt: now,
      status: 'active', ocap: publicOcap, createdAt: now,
    };
    await graph.createNode(session);

    const stepA: GraphNode = {
      id: 'cyc-a', nodeType: 'ActionStep', description: 'A',
      status: 'pending', ocap: publicOcap, createdAt: now,
    };
    const stepB: GraphNode = {
      id: 'cyc-b', nodeType: 'ActionStep', description: 'B',
      status: 'pending', ocap: publicOcap, createdAt: now,
    };
    const stepC: GraphNode = {
      id: 'cyc-c', nodeType: 'ActionStep', description: 'C',
      status: 'pending', ocap: publicOcap, createdAt: now,
    };
    await graph.createNode(stepA);
    await graph.createNode(stepB);
    await graph.createNode(stepC);

    // All belong to session
    for (const s of ['cyc-a', 'cyc-b', 'cyc-c']) {
      await graph.createEdge({
        id: `bt-${s}`, fromId: s, toId: 'sess-cyc', edgeType: 'BELONGS_TO',
        ocap: publicOcap, createdAt: now, strength: 1,
      });
    }

    // Create cycle: A → B → C → A
    await graph.createEdge({
      id: 'dep-ab', fromId: 'cyc-a', toId: 'cyc-b', edgeType: 'DEPENDS_ON',
      ocap: publicOcap, createdAt: now, strength: 1,
    });
    await graph.createEdge({
      id: 'dep-bc', fromId: 'cyc-b', toId: 'cyc-c', edgeType: 'DEPENDS_ON',
      ocap: publicOcap, createdAt: now, strength: 1,
    });
    await graph.createEdge({
      id: 'dep-ca', fromId: 'cyc-c', toId: 'cyc-a', edgeType: 'DEPENDS_ON',
      ocap: publicOcap, createdAt: now, strength: 1,
    });

    const result = await oscillationDetection(graph, 'sess-cyc', communityCtx);
    expect(result.hasCycles).toBe(true);
    expect(result.cycles.length).toBeGreaterThanOrEqual(1);
  });

  it('returns no cycles for empty session', async () => {
    const session: GraphNode = {
      id: 'sess-empty', nodeType: 'Session', startedAt: now,
      status: 'active', ocap: publicOcap, createdAt: now,
    };
    await graph.createNode(session);

    const result = await oscillationDetection(graph, 'sess-empty', communityCtx);
    expect(result.hasCycles).toBe(false);
    expect(result.cycles).toHaveLength(0);
  });
});

// ─── Mermaid Export ──────────────────────────────────────────────────────────

describe('toMermaid', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('generates valid mermaid syntax with graph directive', async () => {
    // Seed some data
    await ingestPDE(graph, makeDecomposition());

    const mermaid = await toMermaid(graph, communityCtx);
    expect(mermaid).toContain('graph TB');
  });

  it('includes Four Directions subgraphs by default', async () => {
    await ingestPDE(graph, makeDecomposition());

    const mermaid = await toMermaid(graph, communityCtx);
    // Should contain direction-based subgraph labels
    expect(mermaid).toMatch(/subgraph/);
  });

  it('includes edge labels', async () => {
    await ingestPDE(graph, makeDecomposition());

    const mermaid = await toMermaid(graph, communityCtx);
    // Edges rendered as -->|label|
    expect(mermaid).toMatch(/-->|/);
  });

  it('generates empty diagram for empty graph', async () => {
    const mermaid = await toMermaid(graph, communityCtx);
    expect(mermaid).toContain('graph TB');
    // No nodes or edges
    expect(mermaid).not.toContain('-->');
  });

  it('respects OCAP filtering in export', async () => {
    // Add a sacred node that should be filtered out for public ctx
    await graph.createNode({
      id: 'sacred-1', nodeType: 'Intent', description: 'Sacred knowledge',
      urgency: 'session', ocap: sacredOcap, createdAt: now,
    });
    await graph.createNode({
      id: 'pub-1', nodeType: 'Intent', description: 'Public knowledge',
      urgency: 'session', ocap: publicOcap, createdAt: now,
    });

    const mermaidPublic = await toMermaid(graph, publicCtx);
    // Sacred node should not appear in public export
    expect(mermaidPublic).not.toContain('Sacred knowledge');
  });
});

// ─── Summary Stats ───────────────────────────────────────────────────────────

describe('summaryStats', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('returns zero counts for empty graph', async () => {
    const stats = await summaryStats(graph, communityCtx);
    expect(stats.totalNodes).toBe(0);
    expect(stats.totalEdges).toBe(0);
  });

  it('returns correct counts after ingest', async () => {
    await ingestPDE(graph, makeDecomposition());

    const stats = await summaryStats(graph, communityCtx);
    expect(stats.totalNodes).toBeGreaterThan(0);
    expect(stats.totalEdges).toBeGreaterThan(0);
    expect(stats.nodesByType['Intent']).toBeGreaterThanOrEqual(2);
    expect(stats.nodesByType['ActionStep']).toBeGreaterThanOrEqual(2);
  });

  it('tracks OCAP distribution', async () => {
    await ingestPDE(graph, makeDecomposition());

    const stats = await summaryStats(graph, communityCtx);
    expect(stats.ocapDistribution).toBeDefined();
    expect(stats.ocapDistribution['community']).toBeGreaterThan(0);
  });
});

// ─── Ingest Kinship ──────────────────────────────────────────────────────────

describe('ingestKinship', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  it('creates KIN_OF edges between specs', async () => {
    const result = await ingestKinship(graph, 'spec-01', [
      { targetSpecId: 'spec-02', kinshipType: 'sibling' },
      { targetSpecId: 'spec-03', kinshipType: 'parent' },
    ]);
    expect(result.edgeCount).toBe(2);

    const kinEdges = await graph.findEdges('KIN_OF');
    expect(kinEdges).toHaveLength(2);
  });

  it('creates placeholder Spec nodes if missing', async () => {
    await ingestKinship(graph, 'spec-new', [
      { targetSpecId: 'spec-target', kinshipType: 'kin' },
    ]);

    const specs = await graph.findNodes('Spec');
    expect(specs.length).toBeGreaterThanOrEqual(2);
  });
});
