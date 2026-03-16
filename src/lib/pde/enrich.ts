/**
 * Stage 2: SOUTH — Growth (Enrich)
 *
 * Refines direction inference, maps dependencies, computes Wilson alignment,
 * assigns relational obligations from graph context.
 */

import {
  DIRECTION_NAMES,
  type DirectionName,
} from '../types/directions.js';
import type {
  OntologicalDecomposition,
  RelationalIntent,
} from '../types/pde.js';

// ─── Graph context interface (optional external dependency) ──────────────────

export interface GraphContext {
  neighbors?: Array<{
    id: string;
    nodeType: string;
    direction?: DirectionName;
    obligations?: string[];
  }>;
  existingIntents?: Array<{
    id: string;
    description: string;
    direction?: DirectionName;
  }>;
}

// ─── Enriched decomposition (same shape, richer data) ────────────────────────

export type EnrichedDecomposition = OntologicalDecomposition;

// ─── Direction refinement keywords (tighter than stage 1) ────────────────────

const REFINED_DIRECTION_SIGNALS: Record<DirectionName, RegExp[]> = {
  east: [
    /\bvision\b/i, /\benvision\b/i, /\bclarif/i, /\brequirement/i,
    /\bdesired\s+outcome/i, /\bwhat\s+is\b/i, /\bpurpose\b/i,
    /\bscope\b/i, /\bidentif/i, /\bgoal\b/i,
  ],
  south: [
    /\bresearch\b/i, /\banalyz/i, /\binvestigat/i, /\blearn\b/i,
    /\bstud/i, /\bexplor/i, /\bgrow/i, /\bpattern\b/i,
    /\barchitect/i, /\bdesign\b/i, /\bdata\b/i,
  ],
  west: [
    /\btest\b/i, /\bvalidat/i, /\breflect/i, /\breview\b/i,
    /\bverif/i, /\baudit\b/i, /\bevaluat/i, /\baccountab/i,
    /\bceremony\b/i, /\bbalance\b/i, /\bhonor\b/i,
  ],
  north: [
    /\bimplement/i, /\bbuild\b/i, /\bcreate\b/i, /\bexecut/i,
    /\bdeploy\b/i, /\bdeliver/i, /\bwrite\b/i, /\bcode\b/i,
    /\bship\b/i, /\bforge\b/i, /\bproduc/i,
  ],
};

// ─── Wilson alignment heuristic ──────────────────────────────────────────────

const WILSON_SIGNALS: Record<string, number> = {
  respect: 0.15,
  reciprocity: 0.15,
  reciproc: 0.15,
  responsibility: 0.15,
  accountab: 0.1,
  ceremony: 0.1,
  relation: 0.1,
  honor: 0.1,
  kin: 0.08,
  community: 0.08,
  land: 0.05,
  spirit: 0.05,
  ancestor: 0.05,
  future: 0.05,
  obligation: 0.1,
  decoloni: 0.1,
};

// ─── Obligation categories ───────────────────────────────────────────────────

const OBLIGATION_KEYWORDS: Record<
  'human' | 'land' | 'spirit' | 'future',
  RegExp[]
> = {
  human: [/\buser\b/i, /\bteam\b/i, /\bcommunity\b/i, /\bkin\b/i, /\bpeople\b/i, /\bcollaborat/i],
  land: [/\bland\b/i, /\benviron/i, /\bsustain/i, /\bplace\b/i, /\bterritor/i],
  spirit: [/\bspirit/i, /\bceremony\b/i, /\bsacred\b/i, /\bintention\b/i, /\bprayer\b/i],
  future: [/\bfuture\b/i, /\bnext gen/i, /\bseven gen/i, /\blegacy\b/i, /\bsustain/i],
};

// ─── Main enrich function ────────────────────────────────────────────────────

export function enrich(
  decomposition: OntologicalDecomposition,
  graphContext?: GraphContext,
): EnrichedDecomposition {
  const enriched = structuredClone(decomposition);

  // 1. Refine direction per intent
  for (const intent of enriched.secondary) {
    intent.direction = refineDirection(intent);
  }

  // 2. Refine direction per action stack item
  for (const action of enriched.actionStack) {
    action.direction = refineDirectionFromText(action.text);
  }

  // 3. Map dependencies between directions (ESWNF flow)
  if (enriched.actionStack.length > 1) {
    mapDirectionDependencies(enriched);
  }

  // 4. Wilson alignment scoring
  for (const intent of enriched.secondary) {
    intent.wilsonAlignment = computeWilsonAlignment(
      `${intent.action} ${intent.target}`,
      graphContext,
    );
  }
  enriched.wilsonAlignment = enriched.secondary.length > 0
    ? enriched.secondary.reduce((sum, i) => sum + i.wilsonAlignment, 0) / enriched.secondary.length
    : computeWilsonAlignment(enriched.prompt, graphContext);

  // 5. Relational obligation assignment
  assignObligations(enriched, graphContext);

  // 6. Recalculate direction insights from enriched intents
  for (const dir of DIRECTION_NAMES) {
    const dirIntents = enriched.secondary.filter(i => i.direction === dir);
    for (const intent of dirIntents) {
      const existing = enriched.directions[dir].insights.find(
        ins => ins.text.includes(intent.target),
      );
      if (!existing) {
        enriched.directions[dir].insights.push({
          text: `${intent.action} ${intent.target}`,
          confidence: intent.confidence,
          implicit: intent.implicit,
        });
      }
    }
  }

  return enriched;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function refineDirection(intent: RelationalIntent): DirectionName {
  const text = `${intent.action} ${intent.target}`;
  return refineDirectionFromText(text);
}

function refineDirectionFromText(text: string): DirectionName {
  const scores: Record<DirectionName, number> = { east: 0, south: 0, west: 0, north: 0 };

  for (const dir of DIRECTION_NAMES) {
    for (const regex of REFINED_DIRECTION_SIGNALS[dir]) {
      if (regex.test(text)) scores[dir] += 1;
    }
  }

  let best: DirectionName = 'north';
  let max = 0;
  for (const dir of DIRECTION_NAMES) {
    if (scores[dir] > max) {
      max = scores[dir];
      best = dir;
    }
  }

  // If no signals matched, fall back to keyword count approach
  if (max === 0) return 'north';
  return best;
}

function mapDirectionDependencies(enriched: EnrichedDecomposition): void {
  // Direction flow: east → south → west → north
  const dirOrder: Record<DirectionName, number> = { east: 0, south: 1, west: 2, north: 3 };

  for (let i = 1; i < enriched.actionStack.length; i++) {
    const current = enriched.actionStack[i];
    if (current.dependency) continue; // already has dependency

    // Find the latest action in a preceding direction
    for (let j = i - 1; j >= 0; j--) {
      const prior = enriched.actionStack[j];
      if (dirOrder[prior.direction] <= dirOrder[current.direction]) {
        current.dependency = prior.id ?? `action-${j}`;
        break;
      }
    }
  }
}

function computeWilsonAlignment(text: string, graphContext?: GraphContext): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const [keyword, weight] of Object.entries(WILSON_SIGNALS)) {
    if (lower.includes(keyword)) score += weight;
  }

  // Boost from graph neighbors if available
  if (graphContext?.neighbors) {
    const neighborDirections = new Set(
      graphContext.neighbors.map(n => n.direction).filter(Boolean),
    );
    score += neighborDirections.size * 0.05;
  }

  return Math.min(1, Math.max(0, score));
}

function assignObligations(
  enriched: EnrichedDecomposition,
  graphContext?: GraphContext,
): void {
  for (const intent of enriched.secondary) {
    const text = `${intent.action} ${intent.target}`.toLowerCase();
    const obligations: Array<{ category: 'human' | 'land' | 'spirit' | 'future'; obligations: string[] }> = [];

    for (const [category, patterns] of Object.entries(OBLIGATION_KEYWORDS) as Array<
      ['human' | 'land' | 'spirit' | 'future', RegExp[]]
    >) {
      const matched: string[] = [];
      for (const regex of patterns) {
        if (regex.test(text)) {
          matched.push(`Honor ${category} relations in: ${intent.target.substring(0, 40)}`);
        }
      }
      if (matched.length > 0) {
        obligations.push({ category, obligations: matched });
      }
    }

    // Graph neighbor obligations
    if (graphContext?.neighbors) {
      for (const neighbor of graphContext.neighbors) {
        if (neighbor.obligations && neighbor.obligations.length > 0) {
          obligations.push({
            category: 'human',
            obligations: neighbor.obligations.map(
              o => `From ${neighbor.nodeType} ${neighbor.id}: ${o}`,
            ),
          });
        }
      }
    }

    intent.obligations = obligations;
  }

  // Also assign obligations to direction-level
  for (const dir of DIRECTION_NAMES) {
    const dirIntents = enriched.secondary.filter(i => i.direction === dir);
    enriched.directions[dir].obligations = dirIntents.flatMap(
      i => i.obligations.map(o => ({ category: o.category, obligations: o.obligations })),
    );
  }
}
