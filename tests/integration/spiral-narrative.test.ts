/**
 * Spiral + Narrative — integration tests.
 *
 * Validates cross-module interactions between:
 *   SpiralTracker ↔ beat-generator ↔ arc-manager ↔ wilson-score ↔ unified-wilson
 *   oscillation-detector ↔ halt recommendations
 *
 * Tests: direction changes → narrative beats, full cycle → complete arc,
 *        Wilson score from arc + session metrics, oscillation → halt.
 */

import { describe, it, expect, vi } from 'vitest';
import { SpiralTracker } from '@forgewright/lib/agent/spiral-tracker';
import { detectSessionOscillation } from '@forgewright/lib/agent/oscillation-detector';
import { generateBeat, type BeatContext } from '@forgewright/lib/narrative/beat-generator';
import {
  createArc,
  addBeat,
  validateArcCoherence,
  getArcCompleteness,
} from '@forgewright/lib/narrative/arc-manager';
import {
  computeWilsonScore,
  getWilsonRecommendation,
  type WilsonContext,
} from '@forgewright/lib/narrative/wilson-score';
import {
  computeUnifiedWilson,
  type SessionMetrics,
} from '@forgewright/lib/wilson/score';
import { WilsonTracker } from '@forgewright/lib/wilson/tracker';
import type { DirectionName } from '@forgewright/lib/types/directions';
import type { ActionStep } from '@forgewright/lib/types/stc';
import type { DirectionEntry } from '@forgewright/lib/agent/spiral-tracker';

// Mock filesystem
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── Shared Fixtures ─────────────────────────────────────────────────────────

const DIRECTIONS: DirectionName[] = ['east', 'south', 'west', 'north'];

function makeActionStep(direction: DirectionName, description: string): ActionStep {
  return {
    id: `step-${direction}`,
    description,
    direction,
    status: 'done',
    confidence: 0.85,
    dependencies: [],
  };
}

function makeBeatContext(directionsVisited: DirectionName[]): BeatContext {
  return {
    wilson: {
      ocapCompliant: true,
      relationsHonored: ['community', 'land'],
      ceremoniesConducted: ['opening'],
      directionsVisited,
      totalSteps: 4,
      completedSteps: directionsVisited.length,
    },
    emotion: 'determination',
    intensity: 0.8,
    learnings: [`Progress through ${directionsVisited.length} directions`],
    relationsHonored: ['community'],
    ceremonies: ['opening'],
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Spiral + Narrative Integration', () => {

  // ── Test 1: each direction change generates a narrative beat ───────────────

  it('each spiral direction change produces a correctly tagged narrative beat', () => {
    const tracker = new SpiralTracker('beat-gen-test', { maxCycles: 3 });
    const steps = [
      makeActionStep('east', 'Define vision and intent'),
      makeActionStep('south', 'Research relational patterns'),
      makeActionStep('west', 'Implement core module'),
      makeActionStep('north', 'Integrate and reflect'),
    ];

    const beats = [];

    for (let i = 0; i < 4; i++) {
      const pos = tracker.getCurrentPosition();
      const direction = pos.direction;
      const step = steps[i];
      const ctx = makeBeatContext(DIRECTIONS.slice(0, i + 1));

      const beat = generateBeat(step, direction, ctx);

      // Beat direction matches tracker direction
      expect(beat.direction).toBe(direction);
      expect(beat.act).toBe(i + 1);
      expect(beat.content).toBe(step.description);
      expect(beat.prose).toBeTruthy();
      expect(beat.id).toContain(direction);

      // Beat carries Wilson score
      expect(beat.wilsonScore).toBeDefined();
      expect(typeof beat.wilsonScore!.score).toBe('number');

      // Beat carries context metadata
      expect(beat.ceremonies).toContain('opening');
      expect(beat.learnings!.length).toBeGreaterThan(0);

      beats.push(beat);

      // Advance to next direction (except on last)
      if (i < 3) tracker.advanceDirection();
    }

    expect(beats).toHaveLength(4);
    expect(beats[0].direction).toBe('east');
    expect(beats[1].direction).toBe('south');
    expect(beats[2].direction).toBe('west');
    expect(beats[3].direction).toBe('north');
  });

  // ── Test 2: full cycle (E→S→W→N) creates complete arc ────────────────────

  it('full Medicine Wheel cycle creates a complete narrative arc', () => {
    const tracker = new SpiralTracker('arc-test', { maxCycles: 3 });
    let arc = createArc('arc-session');

    for (let i = 0; i < 4; i++) {
      const direction = tracker.getCurrentPosition().direction;
      const step = makeActionStep(direction, `${direction} work`);
      const ctx = makeBeatContext(DIRECTIONS.slice(0, i + 1));
      const beat = generateBeat(step, direction, ctx);
      arc = addBeat(arc, beat);

      if (i < 3) tracker.advanceDirection();
    }

    // Arc is complete — all 4 directions visited
    expect(arc.isComplete).toBe(true);
    expect(arc.directionsVisited).toEqual(['east', 'south', 'west', 'north']);
    expect(arc.beats).toHaveLength(4);
    expect(arc.currentAct).toBe(4); // Last beat is North (Act 4)

    // Wilson alignment computed across beats
    expect(arc.wilsonAlignment).toBeDefined();
    expect(typeof arc.wilsonAlignment).toBe('number');
    expect(arc.wilsonAlignment!).toBeGreaterThan(0);

    // Arc coherence: sunwise flow is valid
    const coherence = validateArcCoherence(arc);
    expect(coherence.coherent).toBe(true);
    expect(coherence.issues).toHaveLength(0);
  });

  // ── Test 3: Wilson score computes from arc + session metrics ───────────────

  it('unified Wilson score integrates narrative arc and session metrics', () => {
    // Build a complete arc
    let arc = createArc('wilson-session');
    for (const dir of DIRECTIONS) {
      const step = makeActionStep(dir, `${dir} work for Wilson`);
      const ctx = makeBeatContext(DIRECTIONS);
      const beat = generateBeat(step, dir, ctx);
      arc = addBeat(arc, beat);
    }

    // Compute narrative Wilson score
    const wilsonCtx: WilsonContext = {
      ocapCompliant: true,
      relationsHonored: ['community', 'land', 'spirit', 'ancestors'],
      ceremoniesConducted: ['opening', 'talking_circle'],
      directionsVisited: arc.directionsVisited,
      totalSteps: 4,
      completedSteps: 4,
    };

    const narrativeScore = computeWilsonScore(arc.beats, wilsonCtx);
    expect(narrativeScore.score).toBeGreaterThan(0);
    expect(narrativeScore.components.respect).toBeGreaterThan(0);
    expect(narrativeScore.components.reciprocity).toBeGreaterThan(0);
    expect(narrativeScore.components.responsibility).toBeGreaterThan(0);

    // Compute session metrics
    const sessionMetrics: SessionMetrics = {
      directionsVisited: arc.directionsVisited,
      ceremoniesCount: 2,
      spiralDepth: 1,
      totalBeats: arc.beats.length,
    };

    // Compute unified Wilson score
    const unified = computeUnifiedWilson({
      narrativeScore,
      sessionMetrics,
    });

    expect(unified.sourcesUsed).toBe(2); // narrative + session
    expect(unified.confidence).toBeGreaterThan(0);
    expect(unified.score.score).toBeGreaterThan(0);
    expect(unified.breakdown.narrative).toBeDefined();
    expect(unified.breakdown.session).toBeDefined();

    // When graph score is added, confidence increases
    const withGraph = computeUnifiedWilson({
      graphScore: { score: 0.8, components: { respect: 0.8, reciprocity: 0.8, responsibility: 0.8 } },
      narrativeScore,
      sessionMetrics,
    });

    expect(withGraph.sourcesUsed).toBe(3);
    expect(withGraph.confidence).toBeGreaterThan(unified.confidence);
  });

  // ── Test 4: oscillation detection triggers halt recommendation ─────────────

  it('direction oscillation detected in tracker history triggers halt', () => {
    // Build a history with zero net progress: bouncing E→S→E→S over many transitions
    const bounceHistory: DirectionEntry[] = [];
    let cycle = 1;

    // Start at east
    bounceHistory.push({
      direction: 'east', cycleCount: cycle, timestamp: new Date().toISOString(),
    });

    // Bounce: E→S→E→S→E→S→E→S (8 transitions, no forward progress)
    for (let i = 0; i < 8; i++) {
      const prev = bounceHistory[bounceHistory.length - 1];
      const next: DirectionName = prev.direction === 'east' ? 'south' : 'east';
      bounceHistory.push({
        direction: next,
        cycleCount: cycle,
        timestamp: new Date().toISOString(),
        transitionFrom: prev.direction,
      });
    }

    // Detect oscillation
    const report = detectSessionOscillation(bounceHistory, {
      progressWindow: 8,
      bounceThreshold: 2,
    });

    expect(report).not.toBeNull();
    expect(report!.detected).toBe(true);
    expect(report!.directionsInvolved).toContain('east');
    expect(report!.directionsInvolved).toContain('south');
    expect(report!.recommendation).toBeTruthy();
    expect(report!.recommendation.toLowerCase()).toContain('halt');
  });

  // ── Test 5: arc completeness integrates with Wilson ───────────────────────

  it('arc completeness score reflects direction coverage and Wilson alignment', () => {
    // Partial arc: only east and south visited
    let arc = createArc('partial-session');
    for (const dir of ['east', 'south'] as DirectionName[]) {
      const step = makeActionStep(dir, `${dir} partial work`);
      const ctx = makeBeatContext(['east', 'south']);
      const beat = generateBeat(step, dir, ctx);
      arc = addBeat(arc, beat);
    }

    const completeness = getArcCompleteness(arc, {
      ocapCompliant: true,
      relationsHonored: ['community'],
      ceremoniesConducted: ['opening'],
      directionsVisited: arc.directionsVisited as DirectionName[],
      totalSteps: 4,
      completedSteps: 2,
    });

    expect(completeness.complete).toBe(false);
    expect(completeness.directionsVisited).toEqual(['east', 'south']);
    expect(completeness.directionsMissing).toContain('west');
    expect(completeness.directionsMissing).toContain('north');
    expect(completeness.completenessScore).toBeLessThan(1.0);
    expect(completeness.completenessScore).toBeGreaterThan(0);
    expect(completeness.ocapCompliant).toBe(true);
  });

  // ── Test 6: Wilson tracker observes alignment over time ───────────────────

  it('WilsonTracker records scores and detects trends', () => {
    const tracker = new WilsonTracker();
    const alerts: number[] = [];

    // Register alert for low scores
    const unsub = tracker.alertThreshold(0.3, (score) => {
      alerts.push(score.score);
    });

    // Record improving scores
    tracker.record(1000, { score: 0.2, components: { respect: 0.2, reciprocity: 0.2, responsibility: 0.2 } });
    tracker.record(2000, { score: 0.3, components: { respect: 0.3, reciprocity: 0.3, responsibility: 0.3 } });
    tracker.record(3000, { score: 0.5, components: { respect: 0.5, reciprocity: 0.5, responsibility: 0.5 } });
    tracker.record(4000, { score: 0.7, components: { respect: 0.7, reciprocity: 0.7, responsibility: 0.7 } });
    tracker.record(5000, { score: 0.8, components: { respect: 0.8, reciprocity: 0.8, responsibility: 0.8 } });

    // Trend should be improving
    expect(tracker.trend()).toBe('improving');

    // Alert fired for scores below 0.3
    expect(alerts).toContain(0.2);

    // History recorded
    expect(tracker.length).toBe(5);
    expect(tracker.latest()?.score.score).toBe(0.8);

    // Cleanup
    unsub();
  });

  // ── Test 7: Wilson recommendation triggers on poor alignment ──────────────

  it('low Wilson score generates actionable recommendations', () => {
    // Context with minimal ceremony, no OCAP, few directions
    const poorContext: WilsonContext = {
      ocapCompliant: false,
      relationsHonored: [],
      ceremoniesConducted: [],
      directionsVisited: ['east'],
      totalSteps: 10,
      completedSteps: 1,
    };

    const beats = [
      {
        id: 'b-1', act: 1, direction: 'east' as DirectionName,
        content: 'Barely started', timestamp: new Date().toISOString(),
        ceremonies: [], learnings: [], relations_honored: [],
      },
    ];

    const rec = getWilsonRecommendation(beats, poorContext);

    expect(rec.needsAttention).toBe(true);
    expect(rec.score.score).toBeLessThan(0.3);
    expect(rec.recommendations.length).toBeGreaterThan(0);

    // Should mention OCAP
    expect(rec.recommendations.some(r => r.toLowerCase().includes('ocap'))).toBe(true);

    // Should mention missing directions
    expect(rec.recommendations.some(r => r.includes('south') || r.includes('west') || r.includes('north'))).toBe(true);
  });

  // ── Test 8: healthy spiral produces no oscillation ────────────────────────

  it('clean forward progression through tracker produces no oscillation', () => {
    const tracker = new SpiralTracker('clean-test', { maxCycles: 3 });

    // Full clean cycle: E→S→W→N
    tracker.advanceDirection(); // → south
    tracker.advanceDirection(); // → west
    tracker.advanceDirection(); // → north
    tracker.advanceDirection(); // → east (cycle 2)

    const report = detectSessionOscillation(tracker.getHistory());
    expect(report).toBeNull();
  });

  // ── Test 9: direction revisit pattern detected ────────────────────────────

  it('detects direction_revisit when stuck at same direction', () => {
    // Manually build history with revisit pattern
    const history: DirectionEntry[] = [
      { direction: 'east', cycleCount: 1, timestamp: new Date().toISOString() },
      { direction: 'south', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'east' },
      { direction: 'east', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'south' },
      { direction: 'south', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'east' },
      { direction: 'east', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'south' },
      { direction: 'south', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'east' },
      { direction: 'east', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'south' },
      { direction: 'south', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'east' },
      { direction: 'east', cycleCount: 1, timestamp: new Date().toISOString(), transitionFrom: 'south' },
    ];

    const report = detectSessionOscillation(history, {
      revisitThreshold: 3,
      progressWindow: 8,
      bounceThreshold: 2,
      enabled: true,
    });

    expect(report).not.toBeNull();
    expect(report!.detected).toBe(true);
    // Should detect either zero_net_progress or direction_revisit or direction_bounce
    expect(['zero_net_progress', 'direction_revisit', 'direction_bounce']).toContain(report!.pattern);
    expect(report!.recommendation).toBeTruthy();
  });

  // ── Test 10: unified Wilson with zero sources ─────────────────────────────

  it('unified Wilson returns zero score with zero confidence when no sources', () => {
    const result = computeUnifiedWilson({});

    expect(result.sourcesUsed).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.score.score).toBe(0);
    expect(result.score.components.respect).toBe(0);
    expect(result.score.components.reciprocity).toBe(0);
    expect(result.score.components.responsibility).toBe(0);
  });
});
