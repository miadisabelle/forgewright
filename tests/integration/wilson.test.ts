/**
 * Wilson Alignment — integration tests.
 *
 * Validates: empty graph scoring, well-structured graph scoring,
 *            low-score ceremony recommendation trigger, and component weighting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForgewrightGraph, type OcapContext } from '@forgewright/lib/graph/database.js';
import { computeWilsonAlignment, type WilsonAlignmentScore } from '@forgewright/lib/graph/wilson.js';
import type { OcapMetadata } from '@forgewright/lib/types/ocap.js';

// Mock filesystem
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── Shared fixtures ─────────────────────────────────────────────────────────

function ocap(access: 'public' | 'community' | 'ceremony' | 'sacred'): OcapMetadata {
  return { ownership: 'system', control: 'creator', access, possession: 'local' };
}

const now = new Date().toISOString();

const CTX: OcapContext = {
  requester: 'test-agent',
  maxAccessLevel: 'community',
  isCeremonyActive: false,
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Wilson Alignment Scoring', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  afterEach(async () => {
    await graph.close();
  });

  // ── Test 1: empty graph returns 0-ish scores ─────────────────────────────

  it('returns baseline scores for an empty graph', async () => {
    const score = await computeWilsonAlignment(graph, CTX);

    // Relational density: 0 nodes → 0
    expect(score.components.relationalDensity).toBe(0);

    // OCAP compliance: 0 nodes → 1.0 (vacuously compliant)
    expect(score.components.ocapCompliance).toBe(1.0);

    // Accountability: no accountable nodes → 1.0 (vacuously accountable)
    expect(score.components.accountabilityChains).toBe(1.0);

    // Ceremony: no sessions → 1.0 (vacuously governed)
    expect(score.components.ceremonyParticipation).toBe(1.0);

    // Overall score
    expect(score.score).toBeDefined();
    expect(typeof score.score).toBe('number');
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);

    // Recommendation
    expect(score.recommendation).toBeDefined();
    expect(['aligned', 'relational_attention_needed', 'ceremony_recommended']).toContain(
      score.recommendation,
    );

    // Details string
    expect(score.details).toBeTruthy();
    expect(score.details).toContain('Wilson Alignment');
  });

  // ── Test 2: well-structured graph returns high scores ────────────────────

  it('scores high for a well-structured graph with edges and OCAP', async () => {
    // Create a rich graph: Companion, Session, Ceremony, ActionSteps, Intents
    await graph.createNode({
      id: 'comp-mia',
      nodeType: 'Companion',
      name: 'Mia',
      role: 'architect',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'session-1',
      nodeType: 'Session',
      title: 'Auth implementation',
      startedAt: now,
      status: 'active',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'ceremony-1',
      nodeType: 'Ceremony',
      name: 'Opening ceremony',
      phase: 'active',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'intent-1',
      nodeType: 'Intent',
      description: 'Build auth module',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'step-1',
      nodeType: 'ActionStep',
      description: 'Define requirements',
      orderIndex: 0,
      status: 'done',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'step-2',
      nodeType: 'ActionStep',
      description: 'Implement JWT',
      orderIndex: 1,
      status: 'pending',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'beat-1',
      nodeType: 'NarrativeBeat',
      content: 'Vision emerges',
      emotion: 'determination',
      intensity: 0.8,
      ocap: ocap('community'),
      createdAt: now,
    });

    // Edges: session governed by ceremony
    await graph.createEdge({
      id: 'e-gov',
      fromId: 'session-1',
      toId: 'ceremony-1',
      edgeType: 'GOVERNED_BY',
      ocap: ocap('community'),
      createdAt: now,
    });

    // Edges: steps belong to session
    await graph.createEdge({
      id: 'e-bt1',
      fromId: 'step-1',
      toId: 'session-1',
      edgeType: 'BELONGS_TO',
      ocap: ocap('community'),
      createdAt: now,
    });
    await graph.createEdge({
      id: 'e-bt2',
      fromId: 'step-2',
      toId: 'session-1',
      edgeType: 'BELONGS_TO',
      ocap: ocap('community'),
      createdAt: now,
    });

    // Edges: steps accountable to companion
    await graph.createEdge({
      id: 'e-acc1',
      fromId: 'step-1',
      toId: 'comp-mia',
      edgeType: 'ACCOUNTABLE_TO',
      ocap: ocap('community'),
      createdAt: now,
    });
    await graph.createEdge({
      id: 'e-acc2',
      fromId: 'step-2',
      toId: 'comp-mia',
      edgeType: 'ACCOUNTABLE_TO',
      ocap: ocap('community'),
      createdAt: now,
    });

    // Edges: intent accountable to companion
    await graph.createEdge({
      id: 'e-acc3',
      fromId: 'intent-1',
      toId: 'comp-mia',
      edgeType: 'ACCOUNTABLE_TO',
      ocap: ocap('community'),
      createdAt: now,
    });

    // Edges: beat narrates step
    await graph.createEdge({
      id: 'e-narr',
      fromId: 'beat-1',
      toId: 'step-1',
      edgeType: 'NARRATES',
      ocap: ocap('community'),
      createdAt: now,
    });

    // Edges: step depends on step
    await graph.createEdge({
      id: 'e-dep',
      fromId: 'step-2',
      toId: 'step-1',
      edgeType: 'DEPENDS_ON',
      ocap: ocap('community'),
      createdAt: now,
    });

    const score = await computeWilsonAlignment(graph, CTX);

    // All components should be non-zero
    expect(score.components.relationalDensity).toBeGreaterThan(0);
    expect(score.components.ocapCompliance).toBe(1.0); // all nodes have OCAP
    expect(score.components.accountabilityChains).toBe(1.0); // all accountable nodes have edges
    expect(score.components.ceremonyParticipation).toBe(1.0); // session is governed

    // Overall should be high
    expect(score.score).toBeGreaterThanOrEqual(0.7);
    expect(score.recommendation).toBe('aligned');
  });

  // ── Test 3: score < 0.3 triggers ceremony_recommended ───────────────────

  it('triggers ceremony_recommended when score is below 0.3', async () => {
    // Create a sparse graph with poor relational health:
    // Nodes without edges, sessions without ceremonies, no accountability
    await graph.createNode({
      id: 'session-orphan',
      nodeType: 'Session',
      title: 'Ungoverned session',
      startedAt: now,
      status: 'active',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'step-alone',
      nodeType: 'ActionStep',
      description: 'Lonely step',
      orderIndex: 0,
      status: 'pending',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'intent-alone',
      nodeType: 'Intent',
      description: 'Unaccountable intent',
      ocap: ocap('community'),
      createdAt: now,
    });

    const score = await computeWilsonAlignment(graph, CTX);

    // Relational density: few edges → low
    expect(score.components.relationalDensity).toBe(0);

    // Accountability: no ACCOUNTABLE_TO edges → 0
    expect(score.components.accountabilityChains).toBe(0);

    // Ceremony: session exists but no GOVERNED_BY → 0
    expect(score.components.ceremonyParticipation).toBe(0);

    // OCAP compliance: all have OCAP → 1.0
    expect(score.components.ocapCompliance).toBe(1.0);

    // Overall: (0 + 1 + 0 + 0) * 0.25 = 0.25 → ceremony_recommended
    expect(score.score).toBeLessThan(0.3);
    expect(score.recommendation).toBe('ceremony_recommended');
  });

  // ── Test 4: component weights sum correctly ──────────────────────────────

  it('computes overall score as equal-weighted average of 4 components', async () => {
    const score = await computeWilsonAlignment(graph, CTX);

    const expectedScore =
      0.25 * score.components.relationalDensity +
      0.25 * score.components.ocapCompliance +
      0.25 * score.components.accountabilityChains +
      0.25 * score.components.ceremonyParticipation;

    expect(Math.abs(score.score - expectedScore)).toBeLessThan(0.001);
  });

  // ── Test 5: narrative-level Wilson score computation ──────────────────────

  it('narrative Wilson score reflects respect/reciprocity/responsibility', async () => {
    const { computeWilsonScore } = await import('@forgewright/lib/narrative/wilson-score.js');
    const { DIRECTION_NAMES } = await import('@forgewright/lib/types/directions.js');

    // Rich context with ceremonies, relations, all directions
    const context = {
      ocapCompliant: true,
      relationsHonored: ['community', 'land', 'spirit', 'future', 'ancestors'],
      ceremoniesConducted: ['opening', 'talking_circle', 'closing'],
      directionsVisited: [...DIRECTION_NAMES] as typeof DIRECTION_NAMES[number][],
      totalSteps: 10,
      completedSteps: 8,
    };

    const beats = [
      {
        id: 'beat-1', act: 1, direction: 'east' as const,
        content: 'Vision emerges', title: 'Vision',
        timestamp: now, ceremonies: ['opening'],
        learnings: ['Learned about JWT'], relations_honored: ['community'],
        prose: 'The vision comes forward with clarity',
        emotion: 'wonder', intensity: 0.8,
      },
      {
        id: 'beat-2', act: 2, direction: 'south' as const,
        content: 'Research deepens', title: 'Analysis',
        timestamp: now, ceremonies: ['talking_circle'],
        learnings: ['Patterns mapped'], relations_honored: ['land'],
        prose: 'The fire of analysis burns bright',
        emotion: 'focus', intensity: 0.7,
      },
      {
        id: 'beat-3', act: 3, direction: 'west' as const,
        content: 'Testing validates', title: 'Validation',
        timestamp: now, ceremonies: [],
        learnings: ['All tests pass'], relations_honored: ['spirit'],
        prose: 'The waters of validation run clear',
        emotion: 'confidence', intensity: 0.9,
      },
      {
        id: 'beat-4', act: 4, direction: 'north' as const,
        content: 'Integration completes', title: 'Wisdom',
        timestamp: now, ceremonies: ['closing'],
        learnings: ['Module shipped'], relations_honored: ['future'],
        prose: 'Winter wisdom crystallizes the journey',
        emotion: 'satisfaction', intensity: 0.85,
      },
    ];

    const wilsonScore = computeWilsonScore(beats, context);

    expect(wilsonScore.score).toBeGreaterThan(0.5);
    expect(wilsonScore.components.respect).toBeGreaterThan(0);
    expect(wilsonScore.components.reciprocity).toBeGreaterThan(0);
    expect(wilsonScore.components.responsibility).toBeGreaterThan(0);

    // Score is average of three components
    const expected =
      (wilsonScore.components.respect +
        wilsonScore.components.reciprocity +
        wilsonScore.components.responsibility) / 3;
    expect(Math.abs(wilsonScore.score - Math.round(expected * 1000) / 1000)).toBeLessThan(0.002);
  });

  // ── Test 6: Wilson recommendation system ─────────────────────────────────

  it('provides actionable recommendations when score is low', async () => {
    const { getWilsonRecommendation } = await import('@forgewright/lib/narrative/wilson-score.js');

    // Minimal context — everything low
    const context = {
      ocapCompliant: false,
      relationsHonored: [],
      ceremoniesConducted: [],
      directionsVisited: ['east' as const],
      totalSteps: 10,
      completedSteps: 1,
    };

    const beats = [
      {
        id: 'b1', act: 1, direction: 'east' as const,
        content: 'Just started', timestamp: now,
        ceremonies: [], learnings: [], relations_honored: [],
      },
    ];

    const rec = getWilsonRecommendation(beats, context);

    expect(rec.needsAttention).toBe(true);
    expect(rec.recommendations.length).toBeGreaterThan(0);
    expect(rec.score.score).toBeLessThan(0.3);

    // Should mention OCAP
    const hasOcapRec = rec.recommendations.some(r => r.toLowerCase().includes('ocap'));
    expect(hasOcapRec).toBe(true);
  });

  // ── Test 7: partially-structured graph gets middle recommendation ────────

  it('returns relational_attention_needed for partially-structured graph', async () => {
    // Session with ceremony, but steps without accountability
    await graph.createNode({
      id: 'session-mid',
      nodeType: 'Session',
      title: 'Partial session',
      startedAt: now,
      status: 'active',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'ceremony-mid',
      nodeType: 'Ceremony',
      name: 'Partial ceremony',
      phase: 'active',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'step-mid',
      nodeType: 'ActionStep',
      description: 'A step',
      orderIndex: 0,
      status: 'pending',
      ocap: ocap('community'),
      createdAt: now,
    });

    await graph.createNode({
      id: 'intent-mid',
      nodeType: 'Intent',
      description: 'An intent',
      ocap: ocap('community'),
      createdAt: now,
    });

    // Session governed by ceremony
    await graph.createEdge({
      id: 'e-gov-mid',
      fromId: 'session-mid',
      toId: 'ceremony-mid',
      edgeType: 'GOVERNED_BY',
      ocap: ocap('community'),
      createdAt: now,
    });

    // Step belongs to session
    await graph.createEdge({
      id: 'e-bt-mid',
      fromId: 'step-mid',
      toId: 'session-mid',
      edgeType: 'BELONGS_TO',
      ocap: ocap('community'),
      createdAt: now,
    });

    const score = await computeWilsonAlignment(graph, CTX);

    // Ceremony: 1.0 (session governed), Accountability: 0 (no ACCOUNTABLE_TO)
    // OCAP: 1.0, Density: > 0
    expect(score.score).toBeGreaterThanOrEqual(0.3);
    expect(score.score).toBeLessThan(0.7);
    expect(score.recommendation).toBe('relational_attention_needed');
  });
});
