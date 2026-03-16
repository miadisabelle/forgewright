/**
 * Session-level oscillation detection for direction transitions.
 *
 * Complements src/lib/smcraft/oscillation.ts which operates on state machine
 * events (Germination, Assimilation, Completion sub-states). This module
 * detects stuck patterns at the spiral/direction level:
 *
 * - Same direction revisited 3+ times without progressing
 * - Direction ping-pong (E→S→E→S repeated)
 * - Zero net progress across N transitions
 *
 * Both detectors share OscillationSeverity for consistent escalation.
 */

import type { DirectionName } from '../types/directions.js';
import type { OscillationSeverity } from '../smcraft/oscillation.js';
import type { DirectionEntry } from './spiral-tracker.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionOscillationPattern =
  | 'direction_revisit'    // Same direction visited 3+ times without advancing
  | 'direction_bounce'     // E→S→E→S repeated ping-pong
  | 'zero_net_progress';   // No forward movement over N transitions

export interface SessionOscillationReport {
  detected: true;
  severity: OscillationSeverity;
  pattern: SessionOscillationPattern;
  message: string;
  directionsInvolved: DirectionName[];
  transitionWindow: DirectionEntry[];
  recommendation: string;
}

export interface SessionOscillationConfig {
  /** Times a direction must be revisited to flag (default: 3) */
  revisitThreshold: number;
  /** Repeated direction pairs to count as bounce (default: 2) */
  bounceThreshold: number;
  /** Number of transitions to evaluate net progress (default: 8) */
  progressWindow: number;
  enabled: boolean;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SessionOscillationConfig = {
  revisitThreshold: 3,
  bounceThreshold: 2,
  progressWindow: 8,
  enabled: true,
};

// ─── Direction progress index (cycle-aware) ──────────────────────────────────

const DIRECTION_PROGRESS: Record<DirectionName, number> = {
  east: 0,
  south: 1,
  west: 2,
  north: 3,
};

function adjustedProgress(entry: DirectionEntry): number {
  return (entry.cycleCount - 1) * 4 + DIRECTION_PROGRESS[entry.direction];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyze direction transition history for session-level oscillation patterns.
 * Returns null if no oscillation detected.
 *
 * Detection order (most critical first):
 * 1. Zero net progress → critical, halt recommended
 * 2. Direction revisit → warning/critical, reassess tension
 * 3. Direction bounce → info/warning, structural adjustment
 */
export function detectSessionOscillation(
  history: readonly DirectionEntry[],
  config: Partial<SessionOscillationConfig> = {},
): SessionOscillationReport | null {
  const cfg: SessionOscillationConfig = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enabled || history.length < 2) return null;

  return (
    detectZeroNetProgress(history, cfg) ??
    detectDirectionRevisit(history, cfg) ??
    detectDirectionBounce(history, cfg)
  );
}

// ─── Pattern: Direction Revisit ──────────────────────────────────────────────

/**
 * Same direction visited `revisitThreshold`+ times without progressing past it.
 * Indicates the spiral is stuck in one phase of the work.
 */
function detectDirectionRevisit(
  history: readonly DirectionEntry[],
  config: SessionOscillationConfig,
): SessionOscillationReport | null {
  const visitCounts = new Map<DirectionName, number>();
  let highWaterMark = -1;

  for (const entry of history) {
    const progress = adjustedProgress(entry);

    if (progress > highWaterMark) {
      highWaterMark = progress;
      visitCounts.clear();
    }

    const count = (visitCounts.get(entry.direction) ?? 0) + 1;
    visitCounts.set(entry.direction, count);

    if (count >= config.revisitThreshold) {
      return {
        detected: true,
        severity: count >= config.revisitThreshold + 2 ? 'critical' : 'warning',
        pattern: 'direction_revisit',
        message: `Direction "${entry.direction}" visited ${count} times without advancing past it`,
        directionsInvolved: [entry.direction],
        transitionWindow: history.slice(-config.progressWindow) as DirectionEntry[],
        recommendation:
          'Reassess structural tension — the spiral is stuck in one direction. ' +
          'Consider decomposing the current work or adjusting the desired outcome.',
      };
    }
  }

  return null;
}

// ─── Pattern: Direction Bounce ───────────────────────────────────────────────

/**
 * Direction ping-pong: same pair of directions alternating repeatedly.
 * E.g., E→S→E→S indicates the vision↔analysis loop cannot resolve.
 */
function detectDirectionBounce(
  history: readonly DirectionEntry[],
  config: SessionOscillationConfig,
): SessionOscillationReport | null {
  const minEntries = config.bounceThreshold * 2;
  if (history.length < minEntries) return null;

  const window = history.slice(-config.progressWindow);
  if (window.length < minEntries) return null;

  for (let start = 0; start <= window.length - minEntries; start++) {
    const a = window[start].direction;
    const b = window[start + 1]?.direction;
    if (!b || a === b) continue;

    let pairs = 1;
    let pos = start + 2;

    while (pos + 1 < window.length) {
      if (window[pos].direction === a && window[pos + 1].direction === b) {
        pairs++;
        pos += 2;
      } else {
        break;
      }
    }

    if (pairs >= config.bounceThreshold) {
      return {
        detected: true,
        severity: pairs >= config.bounceThreshold + 1 ? 'warning' : 'info',
        pattern: 'direction_bounce',
        message: `Direction bounce: ${a}↔${b} repeated ${pairs} times — structural adjustment needed`,
        directionsInvolved: [a, b],
        transitionWindow: window.slice(start, pos) as DirectionEntry[],
        recommendation:
          'Break the oscillation — the work is bouncing between directions without resolution. ' +
          'Try a fundamentally different approach or decompose the problem differently.',
      };
    }
  }

  return null;
}

// ─── Pattern: Zero Net Progress ──────────────────────────────────────────────

/**
 * Net progress = 0 over the last `progressWindow` transitions.
 * Most critical pattern — the spiral is spinning without moving.
 */
function detectZeroNetProgress(
  history: readonly DirectionEntry[],
  config: SessionOscillationConfig,
): SessionOscillationReport | null {
  if (history.length < config.progressWindow) return null;

  const window = history.slice(-config.progressWindow);
  const first = window[0];
  const last = window[window.length - 1];

  const firstProgress = adjustedProgress(first);
  const lastProgress = adjustedProgress(last);
  const netProgress = lastProgress - firstProgress;

  if (netProgress <= 0) {
    const involvedDirections = new Set<DirectionName>();
    for (const entry of window) {
      involvedDirections.add(entry.direction);
    }

    return {
      detected: true,
      severity: 'critical',
      pattern: 'zero_net_progress',
      message: `No net progress over last ${config.progressWindow} transitions (net: ${netProgress})`,
      directionsInvolved: Array.from(involvedDirections),
      transitionWindow: window as DirectionEntry[],
      recommendation:
        'Halt recommended — revisit desired outcome and current reality assessment. ' +
        'The spiral has made no forward movement.',
    };
  }

  return null;
}
