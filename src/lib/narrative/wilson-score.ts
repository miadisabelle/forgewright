// ─── Wilson Alignment Score ──────────────────────────────────────────────────
// Implements Shawn Wilson's relational accountability as a computable metric.
// Three pillars: Respect, Reciprocity, Responsibility.

import type { NarrativeBeat, WilsonScore } from '../types/narrative.js';
import type { DirectionName } from '../types/directions.js';
import { DIRECTION_NAMES } from '../types/directions.js';

// ─── Context for Wilson Computation ──────────────────────────────────────────

export interface WilsonContext {
  /** Are OCAP principles being honored? (ownership, control, access, possession) */
  ocapCompliant: boolean;
  /** Relations explicitly acknowledged in the session */
  relationsHonored: string[];
  /** Ceremonies conducted during this arc */
  ceremoniesConducted: string[];
  /** Directions that have been visited */
  directionsVisited: DirectionName[];
  /** Total action steps in scope */
  totalSteps: number;
  /** Completed action steps */
  completedSteps: number;
}

// ─── Respect: OCAP Compliance + Relations Honored ────────────────────────────

function computeRespect(beats: NarrativeBeat[], context: WilsonContext): number {
  // Base: OCAP compliance is the foundation of respect
  const ocapBase = context.ocapCompliant ? 0.4 : 0.0;

  // Relations honored across beats (unique count normalized)
  const allRelations = new Set<string>();
  for (const beat of beats) {
    for (const r of beat.relations_honored) {
      allRelations.add(r);
    }
  }
  for (const r of context.relationsHonored) {
    allRelations.add(r);
  }

  // More relations honored → higher respect, capped at 0.3
  const relationScore = Math.min(allRelations.size / 5, 1.0) * 0.3;

  // Ceremonies conducted show respect for process
  const ceremonyScore = Math.min(context.ceremoniesConducted.length / 3, 1.0) * 0.3;

  return Math.min(ocapBase + relationScore + ceremonyScore, 1.0);
}

// ─── Reciprocity: Bidirectional Relationships ────────────────────────────────

function computeReciprocity(beats: NarrativeBeat[], context: WilsonContext): number {
  // Medicine Wheel completeness — all 4 directions should be represented
  const directionCoverage = context.directionsVisited.length / DIRECTION_NAMES.length;
  const directionScore = directionCoverage * 0.4;

  // Learnings shared back (each beat that records learnings demonstrates reciprocity)
  const beatsWithLearnings = beats.filter(b => b.learnings.length > 0).length;
  const learningRatio = beats.length > 0
    ? Math.min(beatsWithLearnings / beats.length, 1.0)
    : 0;
  const learningScore = learningRatio * 0.3;

  // Ceremonies per beat — ceremony is the reciprocal act
  const totalCeremonies = beats.reduce((sum, b) => sum + b.ceremonies.length, 0)
    + context.ceremoniesConducted.length;
  const ceremonyRatio = beats.length > 0
    ? Math.min(totalCeremonies / beats.length, 1.0)
    : 0;
  const ceremonyScore = ceremonyRatio * 0.3;

  return Math.min(directionScore + learningScore + ceremonyScore, 1.0);
}

// ─── Responsibility: Accountability Chain Completeness ───────────────────────

function computeResponsibility(beats: NarrativeBeat[], context: WilsonContext): number {
  // Completion ratio — are we following through on commitments?
  const completionRatio = context.totalSteps > 0
    ? context.completedSteps / context.totalSteps
    : 0;
  const completionScore = completionRatio * 0.4;

  // Beat quality — beats with both content and prose show narrative accountability
  const qualityBeats = beats.filter(b => b.content.length > 0 && b.prose);
  const qualityRatio = beats.length > 0
    ? Math.min(qualityBeats.length / beats.length, 1.0)
    : 0;
  const qualityScore = qualityRatio * 0.3;

  // Directional accountability — beats should be tagged with a direction
  const taggedBeats = beats.filter(b => b.direction != null);
  const taggedRatio = beats.length > 0
    ? taggedBeats.length / beats.length
    : 0;
  const taggedScore = taggedRatio * 0.3;

  return Math.min(completionScore + qualityScore + taggedScore, 1.0);
}

// ─── Main Wilson Score Computation ───────────────────────────────────────────

export function computeWilsonScore(
  beats: NarrativeBeat[],
  context: WilsonContext,
): WilsonScore {
  const respect = computeRespect(beats, context);
  const reciprocity = computeReciprocity(beats, context);
  const responsibility = computeResponsibility(beats, context);

  const score = (respect + reciprocity + responsibility) / 3;

  return {
    score: Math.round(score * 1000) / 1000,
    components: {
      respect: Math.round(respect * 1000) / 1000,
      reciprocity: Math.round(reciprocity * 1000) / 1000,
      responsibility: Math.round(responsibility * 1000) / 1000,
    },
  };
}

// ─── Recommendation Engine ───────────────────────────────────────────────────

export interface WilsonRecommendation {
  score: WilsonScore;
  needsAttention: boolean;
  recommendations: string[];
}

export function getWilsonRecommendation(
  beats: NarrativeBeat[],
  context: WilsonContext,
): WilsonRecommendation {
  const score = computeWilsonScore(beats, context);
  const recommendations: string[] = [];

  if (score.components.respect < 0.3) {
    if (!context.ocapCompliant) {
      recommendations.push('OCAP compliance is not met — review ownership, control, access, and possession of data.');
    }
    if (context.relationsHonored.length < 2) {
      recommendations.push('Few relations have been honored — acknowledge the human, land, and spirit connections in this work.');
    }
  }

  if (score.components.reciprocity < 0.3) {
    const missing = DIRECTION_NAMES.filter(d => !context.directionsVisited.includes(d));
    if (missing.length > 0) {
      recommendations.push(`Directions not yet visited: ${missing.join(', ')}. The Medicine Wheel asks for balance.`);
    }
    const beatsWithLearnings = beats.filter(b => b.learnings.length > 0).length;
    if (beatsWithLearnings === 0) {
      recommendations.push('No learnings have been recorded — what has this work taught? Reciprocity requires giving back.');
    }
  }

  if (score.components.responsibility < 0.3) {
    if (context.totalSteps > 0 && context.completedSteps / context.totalSteps < 0.3) {
      recommendations.push('Completion rate is low — consider whether commitments are realistic or if scope needs revisiting.');
    }
    const qualityBeats = beats.filter(b => b.prose);
    if (qualityBeats.length === 0 && beats.length > 0) {
      recommendations.push('No beats carry narrative prose — the story of this work is being lost. Add prose to honor the journey.');
    }
  }

  if (score.score < 0.3 && recommendations.length === 0) {
    recommendations.push('Wilson alignment is low across all dimensions. Pause and conduct a relational check-in ceremony.');
  }

  return {
    score,
    needsAttention: score.score < 0.3,
    recommendations,
  };
}
