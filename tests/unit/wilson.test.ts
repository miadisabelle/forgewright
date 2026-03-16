import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeUnifiedWilson,
  type UnifiedWilsonOptions,
  type SessionMetrics,
} from '@forgewright/lib/wilson/score';
import { WilsonTracker } from '@forgewright/lib/wilson/tracker';
import { generateRecommendations } from '@forgewright/lib/wilson/recommendations';
import type { WilsonScore } from '@forgewright/lib/types/narrative';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeScore(respect: number, reciprocity: number, responsibility: number): WilsonScore {
  const score = Math.round(((respect + reciprocity + responsibility) / 3) * 1000) / 1000;
  return { score, components: { respect, reciprocity, responsibility } };
}

function makeSessionMetrics(overrides?: Partial<SessionMetrics>): SessionMetrics {
  return {
    directionsVisited: ['east', 'south', 'west', 'north'],
    ceremoniesCount: 3,
    spiralDepth: 1,
    totalBeats: 8,
    ...overrides,
  };
}

// ─── Unified Wilson Score ────────────────────────────────────────────────────

describe('computeUnifiedWilson', () => {
  it('with all 3 sources produces weighted blend', () => {
    const options: UnifiedWilsonOptions = {
      graphScore: makeScore(0.8, 0.7, 0.9),
      narrativeScore: makeScore(0.6, 0.5, 0.7),
      sessionMetrics: makeSessionMetrics(),
    };

    const result = computeUnifiedWilson(options);

    expect(result.sourcesUsed).toBe(3);
    expect(result.confidence).toBeCloseTo(1.0, 2);
    expect(result.score.score).toBeGreaterThan(0);
    expect(result.score.score).toBeLessThanOrEqual(1);
    expect(result.score.components.respect).toBeGreaterThanOrEqual(0);
    expect(result.score.components.respect).toBeLessThanOrEqual(1);
    expect(result.breakdown.graph).toBeDefined();
    expect(result.breakdown.narrative).toBeDefined();
    expect(result.breakdown.session).toBeDefined();
  });

  it('single source reduces confidence', () => {
    const result = computeUnifiedWilson({
      graphScore: makeScore(0.8, 0.7, 0.6),
    });

    expect(result.sourcesUsed).toBe(1);
    expect(result.confidence).toBeCloseTo(1 / 3, 2);
    expect(result.score.score).toBeGreaterThan(0);
  });

  it('no sources returns zero score with zero confidence', () => {
    const result = computeUnifiedWilson({});

    expect(result.sourcesUsed).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.score.score).toBe(0);
  });

  it('two sources get proportionally re-weighted', () => {
    const result = computeUnifiedWilson({
      graphScore: makeScore(1.0, 1.0, 1.0),
      narrativeScore: makeScore(1.0, 1.0, 1.0),
    });

    expect(result.sourcesUsed).toBe(2);
    expect(result.confidence).toBeCloseTo(2 / 3, 2);
    // Both sources are perfect, so the blended score should be ~1.0
    expect(result.score.score).toBeCloseTo(1.0, 2);
  });
});

// ─── Wilson Tracker ──────────────────────────────────────────────────────────

describe('WilsonTracker', () => {
  let tracker: WilsonTracker;

  beforeEach(() => {
    tracker = new WilsonTracker();
  });

  it('records scores and reports trend', () => {
    // Record declining scores
    tracker.record(1000, makeScore(0.9, 0.9, 0.9));
    tracker.record(2000, makeScore(0.7, 0.7, 0.7));
    tracker.record(3000, makeScore(0.5, 0.5, 0.5));
    tracker.record(4000, makeScore(0.3, 0.3, 0.3));
    tracker.record(5000, makeScore(0.1, 0.1, 0.1));

    expect(tracker.length).toBe(5);
    expect(tracker.trend()).toBe('declining');
    expect(tracker.history()).toHaveLength(5);
    expect(tracker.latest()!.score.score).toBeCloseTo(0.1, 2);
  });

  it('reports improving trend', () => {
    tracker.record(1000, makeScore(0.1, 0.1, 0.1));
    tracker.record(2000, makeScore(0.3, 0.3, 0.3));
    tracker.record(3000, makeScore(0.5, 0.5, 0.5));
    tracker.record(4000, makeScore(0.7, 0.7, 0.7));
    tracker.record(5000, makeScore(0.9, 0.9, 0.9));

    expect(tracker.trend()).toBe('improving');
  });

  it('reports stable trend for flat scores', () => {
    tracker.record(1000, makeScore(0.5, 0.5, 0.5));
    tracker.record(2000, makeScore(0.5, 0.5, 0.5));
    tracker.record(3000, makeScore(0.5, 0.5, 0.5));

    expect(tracker.trend()).toBe('stable');
  });

  it('alertThreshold fires callback when score drops below', () => {
    const callback = vi.fn();
    tracker.alertThreshold(0.4, callback);

    // This score is above threshold — no alert
    tracker.record(1000, makeScore(0.8, 0.8, 0.8));
    expect(callback).not.toHaveBeenCalled();

    // This score drops below 0.4 — alert fires
    tracker.record(2000, makeScore(0.1, 0.1, 0.1));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ score: expect.any(Number) }),
      2000,
    );
  });

  it('unsubscribe removes alert', () => {
    const callback = vi.fn();
    const unsub = tracker.alertThreshold(0.5, callback);

    unsub();

    tracker.record(1000, makeScore(0.1, 0.1, 0.1));
    expect(callback).not.toHaveBeenCalled();
  });
});

// ─── Recommendations ─────────────────────────────────────────────────────────

describe('Wilson Recommendations', () => {
  it('low respect suggests OCAP review', () => {
    const score = makeScore(0.1, 0.8, 0.8);
    const recs = generateRecommendations(score);

    const respectRec = recs.find(r => r.pillar === 'respect');
    expect(respectRec).toBeDefined();
    expect(respectRec!.action).toContain('OCAP');
    expect(respectRec!.urgency).toBe('critical');
    expect(respectRec!.direction).toBe('south');
  });

  it('low reciprocity suggests ceremony', () => {
    const score = makeScore(0.8, 0.1, 0.8);
    const recs = generateRecommendations(score);

    const recipRec = recs.find(r => r.pillar === 'reciprocity');
    expect(recipRec).toBeDefined();
    expect(recipRec!.action.toLowerCase()).toContain('ceremony');
    expect(recipRec!.urgency).toBe('critical');
    expect(recipRec!.direction).toBe('east');
  });

  it('low responsibility suggests accountability audit', () => {
    const score = makeScore(0.8, 0.8, 0.1);
    const recs = generateRecommendations(score);

    const respRec = recs.find(r => r.pillar === 'responsibility');
    expect(respRec).toBeDefined();
    expect(respRec!.action.toLowerCase()).toContain('accountability');
    expect(respRec!.urgency).toBe('critical');
    expect(respRec!.direction).toBe('west');
  });

  it('overall low score triggers full ceremony recommendation', () => {
    const score = makeScore(0.1, 0.1, 0.1);
    const recs = generateRecommendations(score);

    const overallRec = recs.find(r => r.pillar === 'overall');
    expect(overallRec).toBeDefined();
    expect(overallRec!.action.toLowerCase()).toContain('ceremony');
    expect(overallRec!.urgency).toBe('critical');
    expect(overallRec!.direction).toBe('north');
  });

  it('good scores produce no recommendations', () => {
    const score = makeScore(0.8, 0.8, 0.8);
    const recs = generateRecommendations(score);
    expect(recs).toHaveLength(0);
  });
});
