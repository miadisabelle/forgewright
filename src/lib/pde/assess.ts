/**
 * Stage 3: WEST — Validation (Assess)
 *
 * Directional balance scoring, ceremony need detection,
 * ambiguity flagging (held, not resolved), neglected direction identification.
 */

import {
  DIRECTIONS,
  DIRECTION_NAMES,
  type DirectionName,
} from '../types/directions.js';
import type {
  OntologicalDecomposition,
  AmbiguityFlag,
} from '../types/pde.js';
import type { CeremonyGuidance } from '../types/ceremony.js';

// ─── Assessment result (enriches decomposition in-place) ─────────────────────

export interface AssessedDecomposition extends OntologicalDecomposition {
  // balance, neglectedDirections, ceremonyRequired already on OntologicalDecomposition
}

// ─── Ceremony practice recommendations per direction ─────────────────────────

const DIRECTION_CEREMONIES: Record<DirectionName, string> = {
  east: 'Opening prayer or smudge — invite vision clarity before acting',
  south: 'Talking circle or research protocol — deepen understanding through community inquiry',
  west: 'Reflective journaling or code review — honor accountability before delivery',
  north: 'Action ceremony or sprint ritual — consecrate the work of implementation',
};

const DIRECTION_MEDICINES: Record<DirectionName, string[]> = {
  east: ['tobacco', 'sweetgrass'],
  south: ['cedar'],
  west: ['sage'],
  north: ['sweetgrass', 'tobacco'],
};

// ─── Main assess function ────────────────────────────────────────────────────

export function assess(enriched: OntologicalDecomposition): {
  assessed: AssessedDecomposition;
  ceremonyGuidance: CeremonyGuidance | null;
} {
  const assessed = structuredClone(enriched) as AssessedDecomposition;

  // 1. Directional balance scoring
  const { balance, directionCounts, totalInsights } = computeBalance(assessed);
  assessed.balance = balance;

  // 2. Identify neglected directions
  assessed.neglectedDirections = DIRECTION_NAMES.filter(
    d => directionCounts[d] === 0,
  );

  // 3. Identify lead direction
  let maxCount = 0;
  let lead: DirectionName = 'north';
  for (const dir of DIRECTION_NAMES) {
    if (directionCounts[dir] > maxCount) {
      maxCount = directionCounts[dir];
      lead = dir;
    }
  }
  assessed.leadDirection = lead;

  // 4. Ceremony need detection
  assessed.ceremonyRequired = balance < 0.3 || assessed.neglectedDirections.length >= 2;

  // 5. Ambiguity flagging — hold, don't resolve (delayed resolution principle)
  flagAmbiguities(assessed);

  // 6. Mark ceremony recommendation per direction
  for (const dir of DIRECTION_NAMES) {
    assessed.directions[dir].ceremonyRecommended =
      directionCounts[dir] === 0 || (directionCounts[dir] / (totalInsights || 1)) < 0.1;
  }

  // 7. Build ceremony guidance if needed
  let ceremonyGuidance: CeremonyGuidance | null = null;
  if (assessed.ceremonyRequired) {
    ceremonyGuidance = buildCeremonyGuidance(assessed);
    assessed.ceremonyGuidance = ceremonyGuidance;
  }

  return { assessed, ceremonyGuidance };
}

// ─── Internals ───────────────────────────────────────────────────────────────

function computeBalance(decomposition: OntologicalDecomposition): {
  balance: number;
  directionCounts: Record<DirectionName, number>;
  totalInsights: number;
} {
  const directionCounts = {} as Record<DirectionName, number>;

  for (const dir of DIRECTION_NAMES) {
    // Count insights from direction map + intents assigned to this direction
    const insightCount = decomposition.directions[dir]?.insights.length ?? 0;
    const intentCount = decomposition.secondary.filter(s => s.direction === dir).length;
    const actionCount = decomposition.actionStack.filter(a => a.direction === dir).length;
    directionCounts[dir] = insightCount + intentCount + actionCount;
  }

  const counts = DIRECTION_NAMES.map(d => directionCounts[d]);
  const totalInsights = counts.reduce((a, b) => a + b, 0);

  if (totalInsights === 0) {
    return { balance: 0, directionCounts, totalInsights };
  }

  // Balance = 1 - normalized standard deviation of proportions
  const proportions = counts.map(c => c / totalInsights);
  const mean = 0.25; // ideal distribution across 4 directions
  const variance = proportions.reduce((sum, p) => sum + (p - mean) ** 2, 0) / 4;
  const stdDev = Math.sqrt(variance);
  // Max possible stdDev when all in one direction = sqrt(3 * (0-0.25)^2 + (1-0.25)^2 / 4) ≈ 0.433
  const maxStdDev = Math.sqrt(3 * 0.0625 + 0.5625) / 2; // ≈ 0.433
  const balance = Math.max(0, Math.min(1, 1 - stdDev / maxStdDev));

  return { balance, directionCounts, totalInsights };
}

function flagAmbiguities(assessed: AssessedDecomposition): void {
  // Check action stack for low-confidence items
  for (const action of assessed.actionStack) {
    if (action.confidence < 0.5) {
      const existing = assessed.ambiguities.find(a => a.text.includes(action.text));
      if (!existing) {
        assessed.ambiguities.push({
          text: action.text,
          suggestion: `Low confidence (${action.confidence}) — hold this ambiguity and revisit during ceremony or review`,
        });
      }
    }
  }

  // Check for implicit intents that lack clear target
  for (const intent of assessed.secondary) {
    if (intent.implicit && intent.confidence < 0.5) {
      const existing = assessed.ambiguities.find(a => a.text.includes(intent.target));
      if (!existing) {
        assessed.ambiguities.push({
          text: `Implicit intent: ${intent.action} ${intent.target}`,
          suggestion: 'This intent was inferred from hedging language — hold for clarification, do not force resolution',
        });
      }
    }
  }

  // Check for directions with no insights — these represent held tensions
  for (const dir of DIRECTION_NAMES) {
    if (assessed.directions[dir].insights.length === 0) {
      const dirInfo = DIRECTIONS[dir];
      assessed.ambiguities.push({
        text: `${dirInfo.emoji} ${dirInfo.name} direction has no explicit intents`,
        suggestion: `The ${dirInfo.name} (${dirInfo.ojibwe}) direction is silent — hold this absence as meaningful, not as a gap to fill`,
      });
    }
  }
}

function buildCeremonyGuidance(assessed: AssessedDecomposition): CeremonyGuidance {
  const neglected = assessed.neglectedDirections;

  // Build recommendation
  const recommendations: string[] = [];
  for (const dir of neglected) {
    recommendations.push(DIRECTION_CEREMONIES[dir]);
  }

  if (assessed.balance < 0.3) {
    recommendations.unshift(
      `Directional balance is ${(assessed.balance * 100).toFixed(0)}% — ceremony strongly recommended to restore relational accountability.`,
    );
  }

  // Gather medicines from neglected directions
  const medicines = neglected.flatMap(d => DIRECTION_MEDICINES[d]);
  const uniqueMedicines = Array.from(new Set(medicines));

  // Opening practice from the most neglected direction (first in ESWN order)
  const primaryNeglected = DIRECTION_NAMES.find(d => neglected.includes(d)) ?? 'east';

  return {
    balanceScore: assessed.balance,
    recommendation: recommendations.join('\n'),
    neglectedDirections: neglected,
    opening_practice: DIRECTION_CEREMONIES[primaryNeglected],
    intention: `Restore balance by honoring the ${neglected.map(d => DIRECTIONS[d].name).join(', ')} direction(s)`,
    protocol: neglected.length >= 3
      ? 'Full medicine wheel ceremony recommended — all directions need attention'
      : `Focused ${neglected.map(d => DIRECTIONS[d].name).join(' + ')} ceremony`,
    medicines_used: uniqueMedicines,
  };
}
