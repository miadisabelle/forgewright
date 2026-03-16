/**
 * Wilson Alignment Scoring — computes relational health from graph structure.
 *
 * Based on Shawn Wilson's "Research Is Ceremony" framework: relational density,
 * OCAP compliance, accountability chains, and ceremony participation together
 * form a quantitative measure of relational alignment.
 *
 * Score < 0.3 → ceremony_recommended
 * Score 0.3–0.7 → relational_attention_needed
 * Score > 0.7 → aligned
 */

import type { NodeType, EdgeType } from '../types/index.js';
import { ForgewrightGraph, type OcapContext } from './database.js';

// ─── Wilson Score ────────────────────────────────────────────────────────────

export interface WilsonAlignmentScore {
  /** Overall alignment score [0, 1]. */
  score: number;
  /** Individual component scores. */
  components: {
    /** Edge density relative to node count — are relations being honored? */
    relationalDensity: number;
    /** Fraction of nodes with valid OCAP metadata. */
    ocapCompliance: number;
    /** Fraction of nodes with at least one ACCOUNTABLE_TO edge. */
    accountabilityChains: number;
    /** Fraction of sessions governed by a ceremony. */
    ceremonyParticipation: number;
  };
  /** Human-readable recommendation. */
  recommendation: 'aligned' | 'relational_attention_needed' | 'ceremony_recommended';
  /** Detailed breakdown for narrative. */
  details: string;
}

export interface WilsonScope {
  /** Limit to specific session. If omitted, scores the entire graph. */
  sessionId?: string;
  /** Limit to specific node types. */
  nodeTypes?: NodeType[];
}

// ─── Component Calculators ───────────────────────────────────────────────────

/**
 * Relational density: ratio of edges to the maximum possible edges.
 * For a graph with N nodes, max directed edges = N * (N - 1).
 * We use a softer curve to avoid penalizing small graphs.
 */
async function computeRelationalDensity(
  graph: ForgewrightGraph,
  ctx: OcapContext,
): Promise<number> {
  const nodeTypes: NodeType[] = [
    'Spec', 'Companion', 'Ceremony', 'Session', 'ActionStep',
    'NarrativeBeat', 'Intent', 'StateMachine', 'State', 'Event',
  ];
  let totalNodes = 0;
  for (const nt of nodeTypes) {
    const nodes = await graph.findNodes(nt);
    totalNodes += nodes.length;
  }

  if (totalNodes <= 1) return 0;

  const edgeTypes: EdgeType[] = [
    'DEPENDS_ON', 'BELONGS_TO', 'SERVES_DIRECTION', 'AUTHORED_BY',
    'GOVERNED_BY', 'TRANSITIONS_TO', 'CONTAINS', 'GENERATED_FROM',
    'NARRATES', 'ACCOUNTABLE_TO', 'KIN_OF',
  ];
  let totalEdges = 0;
  for (const et of edgeTypes) {
    const edges = await graph.findEdges(et);
    totalEdges += edges.length;
  }

  // Soft density: saturates towards 1.0 with a log curve
  const maxPossible = totalNodes * (totalNodes - 1);
  const rawDensity = totalEdges / maxPossible;
  // Apply softmax so even moderate density scores well
  return Math.min(1.0, rawDensity * 10);
}

/**
 * OCAP compliance: fraction of nodes with non-empty OCAP metadata.
 */
async function computeOcapCompliance(
  graph: ForgewrightGraph,
  ctx: OcapContext,
): Promise<number> {
  const nodeTypes: NodeType[] = [
    'Spec', 'Companion', 'Ceremony', 'Session', 'ActionStep',
    'NarrativeBeat', 'Intent', 'StateMachine', 'State', 'Event',
  ];
  let total = 0;
  let compliant = 0;

  for (const nt of nodeTypes) {
    const nodes = await graph.findNodes(nt);
    for (const node of nodes) {
      total++;
      if (
        node.ocap &&
        node.ocap.ownership &&
        node.ocap.control &&
        node.ocap.access &&
        node.ocap.possession
      ) {
        compliant++;
      }
    }
  }

  return total === 0 ? 1.0 : compliant / total;
}

/**
 * Accountability chains: fraction of ActionStep/Intent nodes that have
 * at least one ACCOUNTABLE_TO edge.
 */
async function computeAccountabilityChains(
  graph: ForgewrightGraph,
  ctx: OcapContext,
): Promise<number> {
  const accountableEdges = await graph.findEdges('ACCOUNTABLE_TO' as EdgeType);
  const accountedFromIds = new Set(accountableEdges.map(e => e.fromId));

  const actionSteps = await graph.findNodes('ActionStep');
  const intents = await graph.findNodes('Intent');
  const accountableNodes = [...actionSteps, ...intents];

  if (accountableNodes.length === 0) return 1.0;

  const accounted = accountableNodes.filter(n => accountedFromIds.has(n.id));
  return accounted.length / accountableNodes.length;
}

/**
 * Ceremony participation: fraction of Session nodes that have a
 * GOVERNED_BY edge to a Ceremony.
 */
async function computeCeremonyParticipation(
  graph: ForgewrightGraph,
  ctx: OcapContext,
): Promise<number> {
  const sessions = await graph.findNodes('Session');
  if (sessions.length === 0) return 1.0;

  const governedByEdges = await graph.findEdges('GOVERNED_BY' as EdgeType);
  const governedSessionIds = new Set(governedByEdges.map(e => e.fromId));

  const governed = sessions.filter(s => governedSessionIds.has(s.id));
  return governed.length / sessions.length;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute Wilson alignment score from graph structure.
 *
 * Components are weighted equally by default:
 * - relationalDensity (25%): are nodes being connected?
 * - ocapCompliance (25%): is sovereignty metadata present?
 * - accountabilityChains (25%): are actions accountable to relations?
 * - ceremonyParticipation (25%): are sessions governed ceremonially?
 *
 * @param graph - ForgewrightGraph instance
 * @param ctx - OCAP context
 * @param scope - Optional scope to limit scoring
 */
export async function computeWilsonAlignment(
  graph: ForgewrightGraph,
  ctx: OcapContext,
  scope?: WilsonScope,
): Promise<WilsonAlignmentScore> {
  const relationalDensity = await computeRelationalDensity(graph, ctx);
  const ocapCompliance = await computeOcapCompliance(graph, ctx);
  const accountabilityChains = await computeAccountabilityChains(graph, ctx);
  const ceremonyParticipation = await computeCeremonyParticipation(graph, ctx);

  const score =
    0.25 * relationalDensity +
    0.25 * ocapCompliance +
    0.25 * accountabilityChains +
    0.25 * ceremonyParticipation;

  let recommendation: WilsonAlignmentScore['recommendation'];
  if (score < 0.3) {
    recommendation = 'ceremony_recommended';
  } else if (score < 0.7) {
    recommendation = 'relational_attention_needed';
  } else {
    recommendation = 'aligned';
  }

  const details = [
    `Relational Density: ${(relationalDensity * 100).toFixed(1)}%`,
    `OCAP Compliance: ${(ocapCompliance * 100).toFixed(1)}%`,
    `Accountability Chains: ${(accountabilityChains * 100).toFixed(1)}%`,
    `Ceremony Participation: ${(ceremonyParticipation * 100).toFixed(1)}%`,
    `Overall Wilson Alignment: ${(score * 100).toFixed(1)}%`,
    `Recommendation: ${recommendation}`,
  ].join('\n');

  return {
    score,
    components: {
      relationalDensity,
      ocapCompliance,
      accountabilityChains,
      ceremonyParticipation,
    },
    recommendation,
    details,
  };
}
