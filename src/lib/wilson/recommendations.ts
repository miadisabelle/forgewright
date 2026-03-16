/**
 * Wilson Recommendation Engine
 *
 * Translates a WilsonScore into actionable, direction-aware guidance rooted in
 * the Medicine Wheel framework. Each recommendation carries a direction so
 * callers know *where* in the wheel to focus remedial ceremony.
 */

import type { WilsonScore } from '../types/narrative';
import type { DirectionName } from '../types/directions';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Urgency = 'critical' | 'attention' | 'suggestion';

export interface Recommendation {
  /** Which pillar this recommendation addresses. */
  pillar: 'respect' | 'reciprocity' | 'responsibility' | 'overall';
  /** Medicine Wheel direction most relevant to the recommendation. */
  direction: DirectionName;
  /** Short summary of the action to take. */
  action: string;
  /** Longer guidance explaining *why* and *how*. */
  guidance: string;
  /** How urgent the recommendation is. */
  urgency: Urgency;
}

// ─── Generator ───────────────────────────────────────────────────────────────

/**
 * Produce actionable recommendations from a Wilson score.
 *
 * Thresholds:
 *   < 0.3  → critical (ceremony_recommended)
 *   < 0.5  → attention (relational_attention_needed)
 *   ≥ 0.5  → no recommendation for that pillar
 *
 * Direction mapping:
 *   respect        → south (protocol & ethics, OCAP governance)
 *   reciprocity    → east  (vision & inquiry, opening to relation)
 *   responsibility → west  (experience & action, follow-through)
 *   overall        → north (reflection & integration, ceremony)
 */
export function generateRecommendations(score: WilsonScore): Recommendation[] {
  const recs: Recommendation[] = [];

  // ── Respect ────────────────────────────────────────────────────────────────

  if (score.components.respect < 0.3) {
    recs.push({
      pillar: 'respect',
      direction: 'south',
      action: 'Conduct an OCAP review',
      guidance:
        'Respect is critically low. Review Ownership, Control, Access, and Possession ' +
        'of all data and artifacts in this cycle. Ensure sovereignty metadata is present ' +
        'on every node and that relations are being explicitly honored.',
      urgency: 'critical',
    });
  } else if (score.components.respect < 0.5) {
    recs.push({
      pillar: 'respect',
      direction: 'south',
      action: 'Strengthen OCAP compliance',
      guidance:
        'Respect needs attention. Check that new artifacts carry OCAP metadata and ' +
        'that at least two relations are explicitly acknowledged per session.',
      urgency: 'attention',
    });
  }

  // ── Reciprocity ────────────────────────────────────────────────────────────

  if (score.components.reciprocity < 0.3) {
    recs.push({
      pillar: 'reciprocity',
      direction: 'east',
      action: 'Open a relational ceremony',
      guidance:
        'Reciprocity is critically low. The Medicine Wheel asks for balance across all ' +
        'four directions. Conduct a ceremony that explicitly gives back — record learnings, ' +
        'share findings with the community, and visit any directions that have been neglected.',
      urgency: 'critical',
    });
  } else if (score.components.reciprocity < 0.5) {
    recs.push({
      pillar: 'reciprocity',
      direction: 'east',
      action: 'Record and share learnings',
      guidance:
        'Reciprocity needs attention. Ensure each narrative beat captures at least one ' +
        'learning and that all four directions are being visited across the arc.',
      urgency: 'attention',
    });
  }

  // ── Responsibility ─────────────────────────────────────────────────────────

  if (score.components.responsibility < 0.3) {
    recs.push({
      pillar: 'responsibility',
      direction: 'west',
      action: 'Conduct an accountability audit',
      guidance:
        'Responsibility is critically low. Review completion rates on committed action ' +
        'steps. Ensure every beat carries directional accountability and narrative prose ' +
        'so the story of the work is not lost.',
      urgency: 'critical',
    });
  } else if (score.components.responsibility < 0.5) {
    recs.push({
      pillar: 'responsibility',
      direction: 'west',
      action: 'Improve follow-through documentation',
      guidance:
        'Responsibility needs attention. Add narrative prose to beats and verify that ' +
        'commitments map to completed action steps.',
      urgency: 'attention',
    });
  }

  // ── Overall ────────────────────────────────────────────────────────────────

  if (score.score < 0.3) {
    recs.push({
      pillar: 'overall',
      direction: 'north',
      action: 'Pause and conduct a full relational ceremony',
      guidance:
        'Overall Wilson alignment is critically low. This is a Managerial Moment of ' +
        'Truth. Pause active work and gather in the North direction for a reflection ' +
        'ceremony. Assess what structural tensions exist between the desired outcome ' +
        'and the current reality, and rebuild relational accountability from the ground up.',
      urgency: 'critical',
    });
  } else if (score.score < 0.5) {
    recs.push({
      pillar: 'overall',
      direction: 'north',
      action: 'Schedule a relational check-in',
      guidance:
        'Overall alignment needs attention. Before advancing further in the spiral, ' +
        'spend time in the North direction reflecting on what has been learned and ' +
        'what reciprocity needs tending.',
      urgency: 'attention',
    });
  }

  return recs;
}
