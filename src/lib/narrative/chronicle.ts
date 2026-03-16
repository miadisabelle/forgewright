// ─── Chronicle Generator ─────────────────────────────────────────────────────
// Generates session chronicles in the Four Directions structure.

import type { NarrativeArc, NarrativeBeat } from '../types/narrative.js';
import type { ForgewrightSession } from '../types/session.js';
import type { DirectionName } from '../types/directions.js';
import { DIRECTIONS, DIRECTION_NAMES } from '../types/directions.js';
import { getWilsonRecommendation, type WilsonContext } from './wilson-score.js';
import { validateArcCoherence } from './arc-manager.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChronicleOptions {
  wilson: WilsonContext;
  /** The structural tension: desired outcome */
  desiredOutcome?: string;
  /** The structural tension: current reality at session start */
  currentReality?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function beatBlock(beat: NarrativeBeat): string {
  const lines: string[] = [];
  const time = formatTimestamp(beat.timestamp);

  lines.push(`#### ${beat.title ?? beat.content.slice(0, 80)}`);
  lines.push(`> *${time}*`);
  lines.push('');

  if (beat.prose) {
    lines.push(beat.prose);
    lines.push('');
  } else {
    lines.push(beat.content);
    lines.push('');
  }

  if (beat.emotion) {
    const bar = beat.intensity != null
      ? ` (${Math.round(beat.intensity * 100)}%)`
      : '';
    lines.push(`**Emotional tone**: ${beat.emotion}${bar}`);
    lines.push('');
  }

  if (beat.ceremonies.length > 0) {
    lines.push(`**Ceremonies**: ${beat.ceremonies.join(', ')}`);
  }
  if (beat.learnings.length > 0) {
    lines.push(`**Learnings**: ${beat.learnings.join('; ')}`);
  }
  if (beat.relations_honored.length > 0) {
    lines.push(`**Relations honored**: ${beat.relations_honored.join(', ')}`);
  }

  if (beat.wilsonScore) {
    const ws = beat.wilsonScore;
    lines.push(`**Wilson**: ${(ws.score * 100).toFixed(0)}% ` +
      `(R:${(ws.components.respect * 100).toFixed(0)} ` +
      `Rc:${(ws.components.reciprocity * 100).toFixed(0)} ` +
      `Rs:${(ws.components.responsibility * 100).toFixed(0)})`);
  }

  lines.push('');
  return lines.join('\n');
}

// ─── Direction Section Headers ───────────────────────────────────────────────

const DIRECTION_HEADERS: Record<DirectionName, string> = {
  east: 'What Was Envisioned',
  south: 'What Was Planned',
  west: 'What Was Experienced',
  north: 'What Was Reflected',
};

function directionSection(dir: DirectionName, beats: NarrativeBeat[]): string {
  const info = DIRECTIONS[dir];
  const lines: string[] = [];

  lines.push(`## ${info.emoji} ${info.name} — ${info.ojibwe}`);
  lines.push(`### ${DIRECTION_HEADERS[dir]}`);
  lines.push('');

  if (beats.length === 0) {
    lines.push(`*This direction was not visited in this session cycle.*`);
    lines.push('');
    return lines.join('\n');
  }

  for (const beat of beats) {
    lines.push(beatBlock(beat));
  }

  return lines.join('\n');
}

// ─── Main: Generate Chronicle ────────────────────────────────────────────────

export function generateChronicle(
  session: ForgewrightSession,
  arc: NarrativeArc,
  options: ChronicleOptions,
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# 📜 Session Chronicle`);
  lines.push(`**Session**: ${session.id}`);
  lines.push(`**Intent**: ${session.intent}`);
  lines.push(`**Status**: ${session.status}`);
  lines.push(`**Created**: ${formatTimestamp(session.createdAt)}`);
  lines.push('');

  // Structural Tension
  if (options.desiredOutcome || options.currentReality) {
    lines.push('---');
    lines.push('');
    lines.push('## ⚡ Structural Tension');
    lines.push('');
    if (options.desiredOutcome) {
      lines.push(`**Desired Outcome**: ${options.desiredOutcome}`);
    }
    if (options.currentReality) {
      lines.push(`**Current Reality**: ${options.currentReality}`);
    }
    lines.push('');

    // Tension resolution narrative
    if (arc.isComplete) {
      lines.push('> *The tension between vision and reality was held through a full ceremonial cycle. ' +
        'Each direction offered its medicine — from the seeds planted in the East, through the ' +
        'structures forged in the South, the experience earned in the West, to the wisdom ' +
        'crystallized in the North. The spiral advances.*');
    } else {
      const visited = new Set(arc.beats.map(b => b.direction));
      const missing = DIRECTION_NAMES.filter(d => !visited.has(d));
      lines.push(`> *The tension remains generative — ${missing.length} direction(s) ` +
        `(${missing.map(d => DIRECTIONS[d].name).join(', ')}) await their turn. ` +
        `The work continues in the next cycle.*`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Four Directions sections
  for (const dir of DIRECTION_NAMES) {
    const dirBeats = arc.beats.filter(b => b.direction === dir);
    lines.push(directionSection(dir, dirBeats));
  }

  lines.push('---');
  lines.push('');

  // Coherence check
  const coherence = validateArcCoherence(arc);
  if (!coherence.coherent) {
    lines.push('## 🔄 Coherence Notes');
    lines.push('');
    for (const issue of coherence.issues) {
      lines.push(`- ⚠️ ${issue}`);
    }
    lines.push('');
  }

  // Wilson Alignment
  const wilson = getWilsonRecommendation(arc.beats, options.wilson);
  lines.push('## 🪶 Wilson Alignment');
  lines.push('');

  const ws = wilson.score;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  lines.push(`| Component | Score |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| **Respect** (OCAP, relations) | ${pct(ws.components.respect)} |`);
  lines.push(`| **Reciprocity** (balance, learnings) | ${pct(ws.components.reciprocity)} |`);
  lines.push(`| **Responsibility** (accountability) | ${pct(ws.components.responsibility)} |`);
  lines.push(`| **Overall Alignment** | **${pct(ws.score)}** |`);
  lines.push('');

  if (wilson.needsAttention) {
    lines.push('### ⚠️ Recommendations');
    lines.push('');
    for (const rec of wilson.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Closing
  lines.push('---');
  lines.push('');
  lines.push('*Every invocation is a spiral, not a loop. Every change is a stone in the living ledger.*');
  lines.push('');

  return lines.join('\n');
}
