import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateBeat, type BeatContext } from '@forgewright/lib/narrative/beat-generator';
import {
  createArc,
  addBeat,
  validateArcCoherence,
  isArcComplete,
} from '@forgewright/lib/narrative/arc-manager';
import {
  computeWilsonScore,
  getWilsonRecommendation,
  type WilsonContext,
} from '@forgewright/lib/narrative/wilson-score';
import type { ActionStep } from '@forgewright/lib/types/stc';
import type { DirectionName } from '@forgewright/lib/types/directions';
import type { NarrativeBeat } from '@forgewright/lib/types/narrative';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeStep(overrides?: Partial<ActionStep>): ActionStep {
  return {
    id: 'step-1',
    description: 'Define creative intent',
    status: 'pending',
    confidence: 0.85,
    dependencies: [],
    ...overrides,
  };
}

function makeWilsonContext(overrides?: Partial<WilsonContext>): WilsonContext {
  return {
    ocapCompliant: true,
    relationsHonored: ['land', 'community'],
    ceremoniesConducted: ['opening'],
    directionsVisited: ['east'],
    totalSteps: 4,
    completedSteps: 1,
    ...overrides,
  };
}

function makeBeatContext(overrides?: Partial<BeatContext>): BeatContext {
  return {
    wilson: makeWilsonContext(),
    emotion: 'curiosity',
    intensity: 0.7,
    learnings: ['iteration matters'],
    relationsHonored: ['community'],
    ceremonies: ['talking_circle'],
    ...overrides,
  };
}

function makeBeat(direction: DirectionName, overrides?: Partial<NarrativeBeat>): NarrativeBeat {
  const acts: Record<DirectionName, number> = { east: 1, south: 2, west: 3, north: 4 };
  return {
    id: `beat-${direction}-${Date.now()}`,
    act: acts[direction],
    direction,
    content: `Content for ${direction}`,
    title: `Title ${direction}`,
    timestamp: new Date().toISOString(),
    ceremonies: ['opening'],
    learnings: ['learned something'],
    relations_honored: ['community'],
    prose: `Prose for ${direction}`,
    ...overrides,
  };
}

// ─── Beat Generator ──────────────────────────────────────────────────────────

describe('Beat Generator', () => {
  it('generateBeat creates a valid NarrativeBeat with content', () => {
    const step = makeStep();
    const ctx = makeBeatContext();
    const beat = generateBeat(step, 'east', ctx);

    expect(beat).toBeDefined();
    expect(beat.id).toMatch(/^beat-east-/);
    expect(beat.content).toBe(step.description);
    expect(beat.title).toBeDefined();
    expect(beat.timestamp).toBeDefined();
    expect(beat.prose).toBeDefined();
    expect(beat.prose!.length).toBeGreaterThan(0);
    expect(beat.wilsonScore).toBeDefined();
  });

  it('beat direction matches input direction', () => {
    const directions: DirectionName[] = ['east', 'south', 'west', 'north'];
    for (const dir of directions) {
      const beat = generateBeat(makeStep(), dir, makeBeatContext());
      expect(beat.direction).toBe(dir);
    }
  });

  it('beat act number matches direction', () => {
    const expected: Record<DirectionName, number> = { east: 1, south: 2, west: 3, north: 4 };
    for (const dir of Object.keys(expected) as DirectionName[]) {
      const beat = generateBeat(makeStep(), dir, makeBeatContext());
      expect(beat.act).toBe(expected[dir]);
    }
  });
});

// ─── Arc Manager ─────────────────────────────────────────────────────────────

describe('Arc Manager', () => {
  it('createArc + addBeat accumulates beats', () => {
    let arc = createArc('session-1');
    expect(arc.beats).toHaveLength(0);

    const beat1 = makeBeat('east');
    arc = addBeat(arc, beat1);
    expect(arc.beats).toHaveLength(1);
    expect(arc.directionsVisited).toContain('east');

    const beat2 = makeBeat('south');
    arc = addBeat(arc, beat2);
    expect(arc.beats).toHaveLength(2);
    expect(arc.directionsVisited).toContain('south');
  });

  it('validateArcCoherence passes for properly ordered beats', () => {
    let arc = createArc('session-coherent');
    arc = addBeat(arc, makeBeat('east'));
    arc = addBeat(arc, makeBeat('south'));
    arc = addBeat(arc, makeBeat('west'));
    arc = addBeat(arc, makeBeat('north'));

    const result = validateArcCoherence(arc);
    expect(result.coherent).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('validateArcCoherence flags direction skips', () => {
    let arc = createArc('session-skip');
    arc = addBeat(arc, makeBeat('east'));
    // Skip south and west, jump to north
    arc = addBeat(arc, makeBeat('north'));

    const result = validateArcCoherence(arc);
    expect(result.coherent).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('isArcComplete returns true when all 4 directions present', () => {
    let arc = createArc('session-complete');
    arc = addBeat(arc, makeBeat('east'));
    arc = addBeat(arc, makeBeat('south'));
    arc = addBeat(arc, makeBeat('west'));
    arc = addBeat(arc, makeBeat('north'));

    expect(isArcComplete(arc)).toBe(true);
  });

  it('isArcComplete returns false when directions are missing', () => {
    let arc = createArc('session-incomplete');
    arc = addBeat(arc, makeBeat('east'));
    arc = addBeat(arc, makeBeat('south'));

    expect(isArcComplete(arc)).toBe(false);
  });
});

// ─── Wilson Score (narrative-level) ──────────────────────────────────────────

describe('Wilson Score (narrative)', () => {
  it('components are in 0-1 range', () => {
    const beats = [makeBeat('east'), makeBeat('south')];
    const ctx = makeWilsonContext({ directionsVisited: ['east', 'south'] });

    const score = computeWilsonScore(beats, ctx);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
    expect(score.components.respect).toBeGreaterThanOrEqual(0);
    expect(score.components.respect).toBeLessThanOrEqual(1);
    expect(score.components.reciprocity).toBeGreaterThanOrEqual(0);
    expect(score.components.reciprocity).toBeLessThanOrEqual(1);
    expect(score.components.responsibility).toBeGreaterThanOrEqual(0);
    expect(score.components.responsibility).toBeLessThanOrEqual(1);
  });

  it('Wilson < 0.3 triggers ceremony recommendation', () => {
    // Create a context with minimal relational indicators
    const ctx = makeWilsonContext({
      ocapCompliant: false,
      relationsHonored: [],
      ceremoniesConducted: [],
      directionsVisited: [],
      totalSteps: 10,
      completedSteps: 0,
    });
    // No beats — everything is minimal
    const result = getWilsonRecommendation([], ctx);

    expect(result.needsAttention).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('high Wilson score does not trigger recommendations', () => {
    const ctx = makeWilsonContext({
      ocapCompliant: true,
      relationsHonored: ['land', 'water', 'community', 'elders', 'ancestors'],
      ceremoniesConducted: ['opening', 'talking_circle', 'closing'],
      directionsVisited: ['east', 'south', 'west', 'north'],
      totalSteps: 4,
      completedSteps: 4,
    });
    const beats = [
      makeBeat('east', { learnings: ['l1'], ceremonies: ['c1'] }),
      makeBeat('south', { learnings: ['l2'], ceremonies: ['c2'] }),
      makeBeat('west', { learnings: ['l3'], ceremonies: ['c3'] }),
      makeBeat('north', { learnings: ['l4'], ceremonies: ['c4'] }),
    ];

    const result = getWilsonRecommendation(beats, ctx);
    expect(result.needsAttention).toBe(false);
  });
});
