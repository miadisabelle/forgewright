/**
 * Unified Wilson Alignment Scoring
 *
 * Combines graph-derived and narrative-derived Wilson scores with live session
 * metrics into a single authoritative alignment score.
 *
 * This module is PURE — it receives pre-computed scores as inputs and never
 * queries graph or narrative engines directly. Callers are responsible for
 * mapping their domain-specific outputs into the WilsonScore shape before
 * passing them here.
 *
 * Weight distribution:
 *   graph     0.4  — structural relational health
 *   narrative 0.3  — story-level accountability
 *   session   0.3  — live ceremony & direction balance
 *
 * When fewer than three sources are available, the present sources share
 * the full weight proportionally and confidence is reduced.
 */

import type { WilsonScore } from '../types/narrative';
import type { DirectionName } from '../types/directions';
import { DIRECTION_NAMES } from '../types/directions';

// ─── Session Metrics ─────────────────────────────────────────────────────────

export interface SessionMetrics {
  /** Directions visited during the current session / arc. */
  directionsVisited: DirectionName[];
  /** Number of ceremonies conducted. */
  ceremoniesCount: number;
  /** How many full Medicine Wheel cycles have been completed (spiral depth). */
  spiralDepth: number;
  /** Total narrative beats in scope. */
  totalBeats: number;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UnifiedWilsonOptions {
  /** Wilson score derived from graph structure (relational density, OCAP, etc.). */
  graphScore?: WilsonScore;
  /** Wilson score derived from narrative beats (learnings, prose, relations). */
  narrativeScore?: WilsonScore;
  /** Live session metrics for computing the session-based score component. */
  sessionMetrics?: SessionMetrics;
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface UnifiedWilsonResult {
  /** The combined Wilson score (respect / reciprocity / responsibility). */
  score: WilsonScore;
  /** How many source signals contributed (0–3). */
  sourcesUsed: number;
  /** Confidence [0, 1] — decreases when fewer sources are available. */
  confidence: number;
  /** Per-source breakdown for transparency. */
  breakdown: {
    graph?: WilsonScore;
    narrative?: WilsonScore;
    session?: WilsonScore;
  };
}

// ─── Source Weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  graph: 0.4,
  narrative: 0.3,
  session: 0.3,
} as const;

// ─── Session → WilsonScore ───────────────────────────────────────────────────

function sessionToWilson(metrics: SessionMetrics): WilsonScore {
  // Respect: ceremony participation shows respect for process
  const ceremonyCap = Math.min(metrics.ceremoniesCount / 3, 1.0);
  const respect = round(ceremonyCap);

  // Reciprocity: direction balance — are all four directions being honored?
  const directionCoverage = metrics.directionsVisited.length / DIRECTION_NAMES.length;
  const spiralBonus = Math.min(metrics.spiralDepth * 0.1, 0.2);
  const reciprocity = round(Math.min(directionCoverage + spiralBonus, 1.0));

  // Responsibility: having beats means following through on commitments
  const beatDensity = Math.min(metrics.totalBeats / 8, 1.0);
  const spiralResponsibility = Math.min(metrics.spiralDepth * 0.15, 0.3);
  const responsibility = round(Math.min(beatDensity + spiralResponsibility, 1.0));

  const score = round((respect + reciprocity + responsibility) / 3);

  return { score, components: { respect, reciprocity, responsibility } };
}

// ─── Unified Computation ─────────────────────────────────────────────────────

/**
 * Compute a unified Wilson alignment score from up to three signal sources.
 *
 * When all three sources are present, weights are graph 0.4, narrative 0.3,
 * session 0.3.  When fewer sources are available the present weights are
 * re-normalised to sum to 1.0 and confidence is reduced proportionally.
 *
 * Returns a zero-score with 0 confidence when no sources are provided.
 */
export function computeUnifiedWilson(options: UnifiedWilsonOptions): UnifiedWilsonResult {
  const sources: { weight: number; score: WilsonScore; key: 'graph' | 'narrative' | 'session' }[] = [];

  if (options.graphScore) {
    sources.push({ weight: WEIGHTS.graph, score: options.graphScore, key: 'graph' });
  }
  if (options.narrativeScore) {
    sources.push({ weight: WEIGHTS.narrative, score: options.narrativeScore, key: 'narrative' });
  }
  if (options.sessionMetrics) {
    const sessionScore = sessionToWilson(options.sessionMetrics);
    sources.push({ weight: WEIGHTS.session, score: sessionScore, key: 'session' });
  }

  if (sources.length === 0) {
    return {
      score: { score: 0, components: { respect: 0, reciprocity: 0, responsibility: 0 } },
      sourcesUsed: 0,
      confidence: 0,
      breakdown: {},
    };
  }

  // Re-normalise weights so they sum to 1.0
  const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);

  let respect = 0;
  let reciprocity = 0;
  let responsibility = 0;
  const breakdown: UnifiedWilsonResult['breakdown'] = {};

  for (const src of sources) {
    const w = src.weight / totalWeight;
    respect += src.score.components.respect * w;
    reciprocity += src.score.components.reciprocity * w;
    responsibility += src.score.components.responsibility * w;
    breakdown[src.key] = src.score;
  }

  respect = round(respect);
  reciprocity = round(reciprocity);
  responsibility = round(responsibility);
  const overall = round((respect + reciprocity + responsibility) / 3);

  // Confidence: 1.0 when all three, reduced when fewer
  const confidence = round(sources.length / 3);

  return {
    score: { score: overall, components: { respect, reciprocity, responsibility } },
    sourcesUsed: sources.length,
    confidence,
    breakdown,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
