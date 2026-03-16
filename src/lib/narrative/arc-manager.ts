// ─── Arc Manager ─────────────────────────────────────────────────────────────
// Manages narrative arcs across the Medicine Wheel cycle.

import type { NarrativeArc, NarrativeBeat, ArcCompleteness } from '../types/narrative.js';
import type { DirectionName } from '../types/directions.js';
import { DIRECTION_NAMES, DIRECTIONS, DIRECTION_ACTS } from '../types/directions.js';
import { computeWilsonScore, type WilsonContext } from './wilson-score.js';

// ─── Create a New Arc ────────────────────────────────────────────────────────

export function createArc(sessionId: string): NarrativeArc {
  return {
    beats: [],
    currentAct: 1,
    isComplete: false,
    directionsVisited: [],
    wilsonAlignment: undefined,
  };
}

// ─── Add a Beat to the Arc ───────────────────────────────────────────────────

export function addBeat(arc: NarrativeArc, beat: NarrativeBeat): NarrativeArc {
  const updatedBeats = [...arc.beats, beat];

  // Track which directions have been visited
  const visitedSet = new Set<DirectionName>(arc.directionsVisited);
  visitedSet.add(beat.direction);
  const directionsVisited = DIRECTION_NAMES.filter(d => visitedSet.has(d));

  // Update current act to the latest beat's act
  const currentAct = beat.act;

  // Check completeness: all 4 directions represented
  const isComplete = directionsVisited.length === 4;

  // Recompute Wilson alignment from beat-level scores
  const wilsonAlignment = computeArcWilsonAlignment(updatedBeats);

  return {
    beats: updatedBeats,
    currentAct,
    isComplete,
    directionsVisited,
    wilsonAlignment,
  };
}

// ─── Wilson Alignment Across Beats ───────────────────────────────────────────

function computeArcWilsonAlignment(beats: NarrativeBeat[]): number {
  const scored = beats.filter(b => b.wilsonScore != null);
  if (scored.length === 0) return 0;

  const sum = scored.reduce((acc, b) => acc + b.wilsonScore!.score, 0);
  return Math.round((sum / scored.length) * 1000) / 1000;
}

// ─── Validate Arc Coherence ──────────────────────────────────────────────────
// Checks that beats follow the Medicine Wheel direction flow.
// The wheel turns East → South → West → North. Beats should not regress
// within a single cycle, though a new cycle can restart from East.

export interface CoherenceResult {
  coherent: boolean;
  issues: string[];
}

export function validateArcCoherence(arc: NarrativeArc): CoherenceResult {
  const issues: string[] = [];

  if (arc.beats.length === 0) {
    return { coherent: true, issues: [] };
  }

  // Check that the first beat starts at East (Act 1) or acknowledges starting mid-cycle
  const firstBeat = arc.beats[0];
  if (firstBeat.act !== 1) {
    issues.push(
      `Arc begins at ${firstBeat.direction} (Act ${firstBeat.act}) — ` +
      `consider opening with East (Waabinong) for a complete ceremonial cycle.`
    );
  }

  // Track direction flow — within a cycle, acts should not decrease
  let currentCycleMaxAct = 0;
  for (let i = 0; i < arc.beats.length; i++) {
    const beat = arc.beats[i];

    if (beat.act < currentCycleMaxAct) {
      // Could be a new cycle (restarting from East)
      if (beat.act === 1) {
        currentCycleMaxAct = 1;
      } else {
        issues.push(
          `Beat "${beat.id}" at Act ${beat.act} (${beat.direction}) regresses ` +
          `from Act ${currentCycleMaxAct} — the wheel turns sunwise, not backward.`
        );
      }
    } else {
      currentCycleMaxAct = beat.act;
    }
  }

  // Check for direction gaps (e.g., East → West skipping South)
  const directionSequence = arc.beats.map(b => b.direction);
  for (let i = 1; i < directionSequence.length; i++) {
    const prevAct = DIRECTION_ACTS[directionSequence[i - 1]];
    const currAct = DIRECTION_ACTS[directionSequence[i]];

    if (currAct > prevAct + 1 && currAct !== 1) {
      const skipped = DIRECTION_NAMES.filter(d => {
        const a = DIRECTION_ACTS[d];
        return a > prevAct && a < currAct;
      });
      if (skipped.length > 0) {
        issues.push(
          `Jump from ${directionSequence[i - 1]} to ${directionSequence[i]} ` +
          `skips ${skipped.join(', ')} — each direction holds teachings that inform the next.`
        );
      }
    }
  }

  return {
    coherent: issues.length === 0,
    issues,
  };
}

// ─── Is Arc Complete? ────────────────────────────────────────────────────────

export function isArcComplete(arc: NarrativeArc): boolean {
  const visited = new Set(arc.beats.map(b => b.direction));
  return DIRECTION_NAMES.every(d => visited.has(d));
}

// ─── Arc Completeness (detailed) ─────────────────────────────────────────────

export function getArcCompleteness(arc: NarrativeArc, wilsonContext: WilsonContext): ArcCompleteness {
  const visited = new Set(arc.beats.map(b => b.direction));
  const directionsVisited = DIRECTION_NAMES.filter(d => visited.has(d));
  const directionsMissing = DIRECTION_NAMES.filter(d => !visited.has(d));

  const ceremoniesPerDirection: Partial<Record<DirectionName, number>> = {};
  const beatsPerDirection: Partial<Record<DirectionName, number>> = {};

  for (const dir of DIRECTION_NAMES) {
    const dirBeats = arc.beats.filter(b => b.direction === dir);
    beatsPerDirection[dir] = dirBeats.length;
    ceremoniesPerDirection[dir] = dirBeats.reduce((sum, b) => sum + b.ceremonies.length, 0);
  }

  const wilsonScore = computeWilsonScore(arc.beats, wilsonContext);
  const wilsonAlignment = wilsonScore.score;

  // Completeness score: direction coverage (50%) + Wilson alignment (30%) + ceremony density (20%)
  const directionScore = directionsVisited.length / DIRECTION_NAMES.length;
  const totalCeremonies = Object.values(ceremoniesPerDirection).reduce((a, b) => a + (b ?? 0), 0);
  const ceremonyDensity = arc.beats.length > 0
    ? Math.min(totalCeremonies / arc.beats.length, 1.0)
    : 0;
  const completenessScore = Math.round(
    (directionScore * 0.5 + wilsonAlignment * 0.3 + ceremonyDensity * 0.2) * 1000
  ) / 1000;

  return {
    complete: directionsMissing.length === 0,
    directionsVisited,
    directionsMissing,
    ceremoniesPerDirection: ceremoniesPerDirection as Record<DirectionName, number>,
    beatsPerDirection: beatsPerDirection as Record<DirectionName, number>,
    wilsonAlignment,
    ocapCompliant: wilsonContext.ocapCompliant,
    completenessScore,
  };
}

// ─── Arc Summary ─────────────────────────────────────────────────────────────

export function getArcSummary(arc: NarrativeArc): string {
  const lines: string[] = [];

  lines.push(`## Narrative Arc — ${arc.beats.length} Beats`);
  lines.push('');

  if (arc.isComplete) {
    lines.push('✅ **Full cycle complete** — all four directions have been honored.');
  } else {
    const visited = new Set(arc.beats.map(b => b.direction));
    const missing = DIRECTION_NAMES.filter(d => !visited.has(d));
    lines.push(`⏳ **In progress** — ${missing.map(d => `${DIRECTIONS[d].emoji} ${DIRECTIONS[d].name}`).join(', ')} still awaiting.`);
  }
  lines.push('');

  if (arc.wilsonAlignment != null) {
    const alignment = arc.wilsonAlignment;
    const status = alignment >= 0.7 ? '🟢 Strong'
      : alignment >= 0.3 ? '🟡 Developing'
      : '🔴 Needs attention';
    lines.push(`**Wilson Alignment**: ${(alignment * 100).toFixed(1)}% — ${status}`);
    lines.push('');
  }

  // Group beats by direction
  for (const dir of DIRECTION_NAMES) {
    const dirBeats = arc.beats.filter(b => b.direction === dir);
    if (dirBeats.length === 0) continue;

    const info = DIRECTIONS[dir];
    lines.push(`### ${info.emoji} ${info.name} (${info.ojibwe}) — Act ${info.act}`);

    for (const beat of dirBeats) {
      lines.push(`- ${beat.prose ?? beat.content}`);
      if (beat.learnings.length > 0) {
        lines.push(`  - 📖 Learnings: ${beat.learnings.join('; ')}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
