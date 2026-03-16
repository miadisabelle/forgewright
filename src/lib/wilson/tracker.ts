/**
 * Wilson Score Tracker — observes alignment over time.
 *
 * Pure in-memory tracker: callers record timestamped scores and query for
 * trends, alerts, and full history. No persistence — the consuming layer
 * is responsible for serialisation if needed.
 */

import type { WilsonScore } from '../types/narrative.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimestampedScore {
  timestamp: number;
  score: WilsonScore;
}

export type Trend = 'improving' | 'declining' | 'stable';

export type AlertCallback = (score: WilsonScore, timestamp: number) => void;

// ─── Tracker ─────────────────────────────────────────────────────────────────

export class WilsonTracker {
  private scores: TimestampedScore[] = [];
  private alerts: { threshold: number; callback: AlertCallback }[] = [];

  /** Append a score observation. Fires any registered alerts if below threshold. */
  record(timestamp: number, score: WilsonScore): void {
    this.scores.push({ timestamp, score });

    for (const alert of this.alerts) {
      if (score.score < alert.threshold) {
        alert.callback(score, timestamp);
      }
    }
  }

  /**
   * Compute overall trend over the last `window` samples.
   *
   * Uses simple linear regression on the overall score to classify the
   * direction of change.  A slope magnitude below 0.02 is considered stable.
   *
   * @param window - Number of most-recent samples to consider (default 5).
   */
  trend(window = 5): Trend {
    const recent = this.scores.slice(-window);
    if (recent.length < 2) return 'stable';

    // Simple least-squares slope on index → score.score
    const n = recent.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const y = recent[i].score.score;
      sumX += i;
      sumY += y;
      sumXY += i * y;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 0.02) return 'improving';
    if (slope < -0.02) return 'declining';
    return 'stable';
  }

  /**
   * Register a callback that fires whenever a recorded score drops below
   * the given threshold.
   *
   * Returns an unsubscribe function.
   */
  alertThreshold(threshold: number, callback: AlertCallback): () => void {
    const entry = { threshold, callback };
    this.alerts.push(entry);
    return () => {
      const idx = this.alerts.indexOf(entry);
      if (idx !== -1) this.alerts.splice(idx, 1);
    };
  }

  /** Return the full score timeline (oldest first). */
  history(): readonly TimestampedScore[] {
    return this.scores;
  }

  /** Number of recorded observations. */
  get length(): number {
    return this.scores.length;
  }

  /** Most recent score, or undefined if empty. */
  latest(): TimestampedScore | undefined {
    return this.scores.length > 0 ? this.scores[this.scores.length - 1] : undefined;
  }
}
