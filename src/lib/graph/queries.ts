/**
 * Graph Query Operations — read path with OCAP enforcement.
 *
 * Every query function accepts an OcapContext. Results are filtered before
 * return so that sacred/ceremony-level nodes never leak outside appropriate
 * ceremony boundaries.
 */

import type { GraphNode, GraphEdge, NodeType, EdgeType } from '../types/index';
import { ForgewrightGraph, type OcapContext, type SubgraphResult } from './database';
import { filterNodes, filterEdges, filterSubgraph, filterQuery } from './ocap-filter';

// ─── Neighborhood Query ──────────────────────────────────────────────────────

/**
 * Retrieve the N-hop neighborhood of a node, filtered by OCAP.
 *
 * @param graph - ForgewrightGraph instance
 * @param nodeId - Center node ID
 * @param ctx - OCAP context for access control
 * @param hops - Traversal depth (default: 1)
 * @returns OCAP-filtered subgraph of neighbors
 */
export async function neighborhood(
  graph: ForgewrightGraph,
  nodeId: string,
  ctx: OcapContext,
  hops = 1,
): Promise<SubgraphResult> {
  const result = await graph.getNeighbors(nodeId, hops);
  return filterSubgraph(result, ctx);
}

// ─── Shortest Path ───────────────────────────────────────────────────────────

/**
 * Find the shortest path between two nodes, respecting OCAP.
 *
 * @param graph - ForgewrightGraph instance
 * @param fromId - Source node ID
 * @param toId - Target node ID
 * @param ctx - OCAP context for access control
 * @returns OCAP-filtered shortest path, or null if unreachable
 */
export async function shortestPath(
  graph: ForgewrightGraph,
  fromId: string,
  toId: string,
  ctx: OcapContext,
): Promise<SubgraphResult | null> {
  const result = await graph.getShortestPath(fromId, toId);
  if (!result) return null;
  return filterSubgraph(result, ctx);
}

// ─── Session Subgraph ────────────────────────────────────────────────────────

/**
 * Retrieve the bounded subgraph for a session: the session node, all
 * ActionSteps that BELONGS_TO the session, governing Ceremony, and
 * NarrativeBeats that NARRATE those steps.
 *
 * @param graph - ForgewrightGraph instance
 * @param sessionId - Session node ID
 * @param ctx - OCAP context
 */
export async function subgraph(
  graph: ForgewrightGraph,
  sessionId: string,
  ctx: OcapContext,
): Promise<SubgraphResult> {
  const sessionNode = await graph.getNode(sessionId);
  if (!sessionNode) return { nodes: [], edges: [] };

  const allNodes: GraphNode[] = [sessionNode];
  const allEdges: GraphEdge[] = [];

  // ActionSteps belonging to this session (via BELONGS_TO edges)
  const belongsToEdges = await graph.findEdges('BELONGS_TO' as EdgeType);
  const sessionStepEdges = belongsToEdges.filter(e => e.toId === sessionId);
  allEdges.push(...sessionStepEdges);

  const stepIds = sessionStepEdges.map(e => e.fromId);
  for (const stepId of stepIds) {
    const step = await graph.getNode(stepId);
    if (step) allNodes.push(step);
  }

  // DEPENDS_ON between steps
  const dependsOnEdges = await graph.findEdges('DEPENDS_ON' as EdgeType);
  for (const edge of dependsOnEdges) {
    if (stepIds.includes(edge.fromId) && stepIds.includes(edge.toId)) {
      allEdges.push(edge);
    }
  }

  // Governing ceremony (via GOVERNED_BY)
  const governedByEdges = await graph.findEdges('GOVERNED_BY' as EdgeType);
  const sessionGovEdges = governedByEdges.filter(e => e.fromId === sessionId);
  allEdges.push(...sessionGovEdges);

  for (const edge of sessionGovEdges) {
    const ceremony = await graph.getNode(edge.toId);
    if (ceremony) allNodes.push(ceremony);
  }

  // NarrativeBeats narrating the steps
  const narratesEdges = await graph.findEdges('NARRATES' as EdgeType);
  for (const edge of narratesEdges) {
    if (stepIds.includes(edge.toId)) {
      allEdges.push(edge);
      const beat = await graph.getNode(edge.fromId);
      if (beat) allNodes.push(beat);
    }
  }

  return filterSubgraph({ nodes: allNodes, edges: allEdges }, ctx);
}

// ─── Accountability Audit ────────────────────────────────────────────────────

export interface AccountabilityChain {
  node: GraphNode;
  accountableTo: Array<{ companion: GraphNode; edge: GraphEdge }>;
  depth: number;
}

/**
 * Trace the accountability chain from a node through ACCOUNTABLE_TO edges.
 *
 * @param graph - ForgewrightGraph instance
 * @param nodeId - Starting node ID
 * @param ctx - OCAP context
 * @param maxDepth - Maximum chain depth (default: 5)
 */
export async function accountabilityAudit(
  graph: ForgewrightGraph,
  nodeId: string,
  ctx: OcapContext,
  maxDepth = 5,
): Promise<AccountabilityChain[]> {
  const chains: AccountabilityChain[] = [];
  const accountableEdges = await graph.findEdges('ACCOUNTABLE_TO' as EdgeType);
  let frontier = [nodeId];
  const visited = new Set<string>();

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const nextFrontier: string[] = [];
    for (const currentId of frontier) {
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = await graph.getNode(currentId);
      if (!node) continue;

      const outEdges = accountableEdges.filter(e => e.fromId === currentId);
      const companions: Array<{ companion: GraphNode; edge: GraphEdge }> = [];
      for (const edge of outEdges) {
        const companion = await graph.getNode(edge.toId);
        if (companion) {
          companions.push({ companion, edge });
          nextFrontier.push(edge.toId);
        }
      }

      chains.push({ node, accountableTo: companions, depth });
    }
    frontier = nextFrontier;
  }

  // Filter by OCAP
  return chains.filter(c => {
    const nodeNodes = filterNodes([c.node], ctx);
    return nodeNodes.length > 0;
  });
}

// ─── Oscillation Detection ───────────────────────────────────────────────────

export interface OscillationResult {
  hasCycles: boolean;
  cycles: string[][];
}

/**
 * Detect cycles in the ActionStep DEPENDS_ON graph for a session.
 * Cycles indicate oscillation — going back and forth without advancing.
 *
 * @param graph - ForgewrightGraph instance
 * @param sessionId - Session to check
 * @param ctx - OCAP context
 */
export async function oscillationDetection(
  graph: ForgewrightGraph,
  sessionId: string,
  ctx: OcapContext,
): Promise<OscillationResult> {
  // Get all action steps in this session
  const belongsToEdges = await graph.findEdges('BELONGS_TO' as EdgeType);
  const stepIds = belongsToEdges
    .filter(e => e.toId === sessionId)
    .map(e => e.fromId);

  if (stepIds.length === 0) return { hasCycles: false, cycles: [] };

  // Get DEPENDS_ON edges between session steps
  const dependsOnEdges = await graph.findEdges('DEPENDS_ON' as EdgeType);
  const sessionDepEdges = dependsOnEdges.filter(
    e => stepIds.includes(e.fromId) && stepIds.includes(e.toId),
  );

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const id of stepIds) adj.set(id, []);
  for (const edge of sessionDepEdges) {
    adj.get(edge.fromId)?.push(edge.toId);
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];

  for (const id of stepIds) color.set(id, WHITE);

  function dfs(u: string): void {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        // Found a cycle — trace back
        const cycle: string[] = [v];
        let curr = u;
        while (curr !== v) {
          cycle.push(curr);
          curr = parent.get(curr) ?? v;
        }
        cycle.push(v);
        cycles.push(cycle.reverse());
      } else if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v);
      }
    }
    color.set(u, BLACK);
  }

  for (const id of stepIds) {
    if (color.get(id) === WHITE) {
      parent.set(id, null);
      dfs(id);
    }
  }

  return { hasCycles: cycles.length > 0, cycles };
}

// ─── Raw Cypher (OCAP-filtered) ──────────────────────────────────────────────

/**
 * Execute a raw Cypher query with OCAP filtering injected.
 * Only works with KuzuDB backend; returns empty on in-memory fallback.
 *
 * @param graph - ForgewrightGraph instance
 * @param cypher - Cypher query string
 * @param ctx - OCAP context
 * @param params - Parameterized query values
 */
export async function queryCypher(
  graph: ForgewrightGraph,
  cypher: string,
  ctx: OcapContext,
  params?: Record<string, unknown>,
): Promise<unknown[]> {
  const filtered = filterQuery(cypher, ctx);
  return graph.rawQuery(filtered, params);
}
