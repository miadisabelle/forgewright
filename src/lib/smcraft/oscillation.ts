/**
 * OscillationDetector — watches event history for cycles that indicate
 * structural adjustment is needed rather than continuing the current path.
 *
 * In Fritz's creative process model, oscillation is the anti-pattern where
 * the creator cycles between states without net advancement toward the
 * desired outcome. This detector flags those patterns early.
 */

import type { StateMachineEvent } from '../types/smdf';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OscillationSeverity = 'info' | 'warning' | 'critical';

export interface OscillationReport {
  detected: true;
  severity: OscillationSeverity;
  pattern: OscillationPattern;
  message: string;
  statesInvolved: string[];
  eventWindow: StateMachineEvent[];
  recommendation: string;
}

export type OscillationPattern =
  | 'state_revisit'      // Same state visited 3+ times without advancing
  | 'phase_bounce'       // Phase retreat followed by same phase advance
  | 'zero_progress';     // Net progress = 0 over N events

// ─── Configuration ───────────────────────────────────────────────────────────

export interface OscillationConfig {
  revisitThreshold: number;    // times a state must be revisited to flag (default: 3)
  progressWindow: number;      // number of events to evaluate net progress (default: 10)
  enabled: boolean;
}

const DEFAULT_CONFIG: OscillationConfig = {
  revisitThreshold: 3,
  progressWindow: 10,
  enabled: true,
};

// ─── Phase ordering for progress calculation ─────────────────────────────────

const PHASE_ORDER: Record<string, number> = {
  // Top-level phases
  'Germination': 0,
  'Assimilation': 1,
  'Completion': 2,
  // Sub-states (Germination)
  'TaskDefinition': 10,
  'SpecGeneration': 11,
  'PDEDecomposition': 12,
  // Sub-states (Assimilation)
  'PlanGeneration': 20,
  'CodeImplementation': 21,
  'IterativeRefinement': 22,
  // Sub-states (Completion)
  'Validation': 30,
  'Review': 31,
  'Integration': 32,
};

function stateProgress(stateName: string): number {
  return PHASE_ORDER[stateName] ?? -1;
}

// ─── Detector ────────────────────────────────────────────────────────────────

export class OscillationDetector {
  private config: OscillationConfig;

  constructor(config: Partial<OscillationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze event history for oscillation patterns.
   * Returns null if no oscillation detected.
   */
  detectOscillation(eventHistory: StateMachineEvent[]): OscillationReport | null {
    if (!this.config.enabled || eventHistory.length < 2) return null;

    // Check patterns in priority order (most critical first)
    return (
      this.detectZeroProgress(eventHistory) ??
      this.detectStateRevisit(eventHistory) ??
      this.detectPhaseBounce(eventHistory)
    );
  }

  /**
   * Same state visited `revisitThreshold`+ times without advancing past it.
   */
  private detectStateRevisit(events: StateMachineEvent[]): OscillationReport | null {
    const stateVisitCounts = new Map<string, number>();
    let highWaterMark = -1;

    for (const event of events) {
      const toProgress = stateProgress(event.toState);

      if (toProgress > highWaterMark) {
        // Advancing — reset counts
        highWaterMark = toProgress;
        stateVisitCounts.clear();
      }

      const count = (stateVisitCounts.get(event.toState) ?? 0) + 1;
      stateVisitCounts.set(event.toState, count);

      if (count >= this.config.revisitThreshold) {
        return {
          detected: true,
          severity: count >= this.config.revisitThreshold + 2 ? 'critical' : 'warning',
          pattern: 'state_revisit',
          message: `State "${event.toState}" visited ${count} times without advancing beyond it`,
          statesInvolved: [event.toState],
          eventWindow: events.slice(-this.config.progressWindow),
          recommendation: 'Reassess current reality or decompose the action step further',
        };
      }
    }

    return null;
  }

  /**
   * Phase retreat immediately followed by advance back to the same phase.
   */
  private detectPhaseBounce(events: StateMachineEvent[]): OscillationReport | null {
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1];
      const curr = events[i];

      const prevFromProgress = stateProgress(prev.fromState);
      const prevToProgress = stateProgress(prev.toState);
      const currToProgress = stateProgress(curr.toState);

      // Retreat: moved backward
      const wasRetreat = prevToProgress < prevFromProgress;
      // Then advance back to same or similar position
      const bouncedBack = wasRetreat && currToProgress >= prevFromProgress;

      if (bouncedBack) {
        return {
          detected: true,
          severity: 'warning',
          pattern: 'phase_bounce',
          message: `Phase bounce: retreated from "${prev.fromState}" to "${prev.toState}", then advanced back to "${curr.toState}"`,
          statesInvolved: [prev.fromState, prev.toState, curr.toState],
          eventWindow: events.slice(Math.max(0, i - 3), i + 1),
          recommendation: 'The retreat may indicate unresolved tension — hold the space before re-advancing',
        };
      }
    }

    return null;
  }

  /**
   * Net progress = 0 over the last `progressWindow` events.
   */
  private detectZeroProgress(events: StateMachineEvent[]): OscillationReport | null {
    if (events.length < this.config.progressWindow) return null;

    const window = events.slice(-this.config.progressWindow);
    const firstProgress = stateProgress(window[0].fromState);
    const lastProgress = stateProgress(window[window.length - 1].toState);

    // Both must be known states for meaningful comparison
    if (firstProgress < 0 || lastProgress < 0) return null;

    const netProgress = lastProgress - firstProgress;

    if (netProgress <= 0) {
      const involvedStates = new Set<string>();
      for (const e of window) {
        involvedStates.add(e.fromState);
        involvedStates.add(e.toState);
      }

      return {
        detected: true,
        severity: 'critical',
        pattern: 'zero_progress',
        message: `No net progress over last ${this.config.progressWindow} events (net: ${netProgress})`,
        statesInvolved: Array.from(involvedStates),
        eventWindow: window,
        recommendation: 'Structural adjustment needed — revisit desired outcome and current reality assessment',
      };
    }

    return null;
  }
}
