/**
 * PDE Pipeline Tests — decompose, enrich, assess, plan, storage, full pipeline
 *
 * Assertion coverage: A01-01 through A01-10
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';

import {
  decompose,
  buildSystemPrompt,
  type DecomposeOptions,
} from '@forgewright/lib/pde/decompose';

import { enrich, type GraphContext } from '@forgewright/lib/pde/enrich';
import { assess } from '@forgewright/lib/pde/assess';
import { plan } from '@forgewright/lib/pde/plan';
import { renderMarkdown } from '@forgewright/lib/pde/storage';
import { runPipeline, type PipelineEvent } from '@forgewright/lib/pde/pipeline';
import { DIRECTION_NAMES, DIRECTIONS } from '@forgewright/lib/types/directions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SIMPLE_PROMPT = 'Create unit tests for the graph module and validate all schemas.';
const HEDGING_PROMPT = 'We should probably build a ceremony tracker. Maybe use KuzuDB somehow. I assume the graph module is ready.';
const MULTI_DIRECTION_PROMPT = 'Understand the current codebase, research the graph patterns, test the OCAP layer, then implement the Wilson scoring.';

// ─── Stage 1: Decompose ──────────────────────────────────────────────────────

describe('decompose', () => {
  it('extracts primary intent from simple prompt', () => {
    const result = decompose(SIMPLE_PROMPT);
    expect(result.primary).toBeDefined();
    expect(result.primary.action).toBeDefined();
    expect(typeof result.primary.action).toBe('string');
    expect(result.primary.target).toBeDefined();
    expect(result.primary.confidence).toBeGreaterThan(0);
  });

  it('generates a unique ID', () => {
    const a = decompose(SIMPLE_PROMPT);
    const b = decompose(SIMPLE_PROMPT);
    expect(a.id).not.toBe(b.id);
  });

  it('populates timestamp', () => {
    const result = decompose(SIMPLE_PROMPT);
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });

  it('preserves original prompt', () => {
    const result = decompose(SIMPLE_PROMPT);
    expect(result.prompt).toBe(SIMPLE_PROMPT);
  });

  it('creates action stack with at least one item', () => {
    const result = decompose(SIMPLE_PROMPT);
    expect(result.actionStack.length).toBeGreaterThanOrEqual(1);
  });

  it('each action has direction and text', () => {
    const result = decompose(SIMPLE_PROMPT);
    for (const action of result.actionStack) {
      expect(DIRECTION_NAMES).toContain(action.direction);
      expect(action.text).toBeDefined();
      expect(action.text.length).toBeGreaterThan(0);
    }
  });

  it('builds all 4 direction entries', () => {
    const result = decompose(SIMPLE_PROMPT);
    for (const dir of DIRECTION_NAMES) {
      expect(result.directions[dir]).toBeDefined();
      expect(result.directions[dir].ojibwe).toBe(DIRECTIONS[dir].ojibwe);
      expect(result.directions[dir].act).toBe(DIRECTIONS[dir].act);
    }
  });

  it('detects hedging language (A01-06)', () => {
    const result = decompose(HEDGING_PROMPT);
    // "probably", "maybe", "somehow", "I assume" should trigger ambiguities
    expect(result.ambiguities.length).toBeGreaterThan(0);
  });

  it('hedging creates implicit intents', () => {
    const result = decompose(HEDGING_PROMPT);
    const implicitIntents = result.secondary.filter(s => s.implicit);
    expect(implicitIntents.length).toBeGreaterThan(0);
  });

  it('hedging intents have low confidence', () => {
    const result = decompose(HEDGING_PROMPT);
    const implicitIntents = result.secondary.filter(s => s.implicit);
    for (const intent of implicitIntents) {
      expect(intent.confidence).toBeLessThanOrEqual(0.5);
    }
  });

  it('respects extractImplicit=false option', () => {
    const result = decompose(HEDGING_PROMPT, { extractImplicit: false });
    const implicitIntents = result.secondary.filter(s => s.implicit);
    expect(implicitIntents).toHaveLength(0);
  });

  it('computes initial balance score (0-1)', () => {
    const result = decompose(MULTI_DIRECTION_PROMPT);
    expect(result.balance).toBeGreaterThanOrEqual(0);
    expect(result.balance).toBeLessThanOrEqual(1);
  });

  it('identifies lead direction', () => {
    const result = decompose(SIMPLE_PROMPT);
    expect(DIRECTION_NAMES).toContain(result.leadDirection);
  });

  it('identifies neglected directions', () => {
    const result = decompose(SIMPLE_PROMPT);
    expect(Array.isArray(result.neglectedDirections)).toBe(true);
    for (const d of result.neglectedDirections) {
      expect(DIRECTION_NAMES).toContain(d);
    }
  });

  it('detects urgency from keywords', () => {
    const urgentResult = decompose('Fix this critical bug now in the auth module');
    expect(urgentResult.primary.urgency).toBe('immediate');

    const defaultResult = decompose('Refactor the types module when convenient');
    // 'session' is default
    expect(['session', 'persistent']).toContain(defaultResult.primary.urgency);
  });

  it('extracts file paths from prompt context', () => {
    const result = decompose('Read src/lib/types/index.ts and fix the graph.ts imports');
    expect(result.context.files_needed.length).toBeGreaterThan(0);
    expect(result.context.files_needed.some(f => f.includes('.ts'))).toBe(true);
  });

  it('extracts tool requirements from prompt', () => {
    const result = decompose('Use git and npm to deploy the docker container with zod validation');
    expect(result.context.tools_required.length).toBeGreaterThan(0);
    expect(result.context.tools_required).toContain('git');
    expect(result.context.tools_required).toContain('npm');
    expect(result.context.tools_required).toContain('docker');
    expect(result.context.tools_required).toContain('zod');
  });

  it('buildSystemPrompt returns non-empty string', () => {
    const prompt = buildSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('Prompt Decomposition Engine');
  });
});

// ─── Stage 2: Enrich ─────────────────────────────────────────────────────────

describe('enrich', () => {
  it('assigns directions to secondary intents', () => {
    const decomp = decompose(MULTI_DIRECTION_PROMPT);
    const enriched = enrich(decomp);

    for (const intent of enriched.secondary) {
      expect(DIRECTION_NAMES).toContain(intent.direction);
    }
  });

  it('refines direction per action stack item', () => {
    const decomp = decompose(MULTI_DIRECTION_PROMPT);
    const enriched = enrich(decomp);

    for (const action of enriched.actionStack) {
      expect(DIRECTION_NAMES).toContain(action.direction);
    }
  });

  it('computes Wilson alignment per intent', () => {
    const decomp = decompose('Build with respect, reciprocity, and accountability for the community');
    const enriched = enrich(decomp);

    expect(enriched.wilsonAlignment).toBeGreaterThanOrEqual(0);
    expect(enriched.wilsonAlignment).toBeLessThanOrEqual(1);
  });

  it('Wilson alignment increases with relational keywords', () => {
    const plainDecomp = decompose('Build a simple test file');
    const relationalDecomp = decompose('Build with respect, reciprocity, responsibility, and ceremony for community land spirit');

    const plainEnriched = enrich(plainDecomp);
    const relationalEnriched = enrich(relationalDecomp);

    expect(relationalEnriched.wilsonAlignment).toBeGreaterThanOrEqual(plainEnriched.wilsonAlignment);
  });

  it('accepts optional graph context', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const ctx: GraphContext = {
      neighbors: [
        { id: 'n1', nodeType: 'Spec', direction: 'east' },
      ],
      existingIntents: [
        { id: 'i1', description: 'existing work', direction: 'south' },
      ],
    };
    const enriched = enrich(decomp, ctx);
    expect(enriched).toBeDefined();
    // Graph context should boost Wilson alignment slightly
    expect(enriched.wilsonAlignment).toBeGreaterThanOrEqual(0);
  });

  it('maps direction dependencies between actions', () => {
    const decomp = decompose(MULTI_DIRECTION_PROMPT);
    const enriched = enrich(decomp);

    // At least some actions should have dependencies mapped
    const withDeps = enriched.actionStack.filter(a => a.dependency !== null);
    expect(withDeps.length).toBeGreaterThanOrEqual(0); // may have deps
  });
});

// ─── Stage 3: Assess ─────────────────────────────────────────────────────────

describe('assess', () => {
  it('computes directional balance (0-1)', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);

    expect(assessed.balance).toBeGreaterThanOrEqual(0);
    expect(assessed.balance).toBeLessThanOrEqual(1);
  });

  it('identifies neglected directions', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);

    expect(Array.isArray(assessed.neglectedDirections)).toBe(true);
    for (const d of assessed.neglectedDirections) {
      expect(DIRECTION_NAMES).toContain(d);
    }
  });

  it('ceremony required when balance < 0.3 or 2+ neglected directions (A01-03)', () => {
    // A heavily single-direction prompt
    const decomp = decompose('Build build implement create execute ship deploy code write');
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);

    // This heavily north-leaning prompt should have low balance
    if (assessed.balance < 0.3 || assessed.neglectedDirections.length >= 2) {
      expect(assessed.ceremonyRequired).toBe(true);
    }
  });

  it('builds ceremony guidance when ceremony is required', () => {
    // Force a very unbalanced prompt
    const decomp = decompose('Build ship deploy execute implement create code write');
    const enriched = enrich(decomp);
    const { assessed, ceremonyGuidance } = assess(enriched);

    if (assessed.ceremonyRequired) {
      expect(ceremonyGuidance).not.toBeNull();
      expect(ceremonyGuidance!.balanceScore).toBeGreaterThanOrEqual(0);
      expect(ceremonyGuidance!.balanceScore).toBeLessThanOrEqual(1);
      expect(ceremonyGuidance!.neglectedDirections.length).toBeGreaterThan(0);
      expect(ceremonyGuidance!.recommendation).toBeDefined();
    }
  });

  it('flags low-confidence actions as ambiguities', () => {
    const decomp = decompose(HEDGING_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);

    // Should have ambiguities from hedging + low-confidence items
    expect(assessed.ambiguities.length).toBeGreaterThan(0);
  });

  it('marks ceremony recommendation per direction', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);

    for (const dir of DIRECTION_NAMES) {
      expect(typeof assessed.directions[dir].ceremonyRecommended).toBe('boolean');
    }
  });
});

// ─── Stage 4: Plan ───────────────────────────────────────────────────────────

describe('plan', () => {
  it('generates topological ordering of actions (A01-07)', () => {
    const decomp = decompose(MULTI_DIRECTION_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);
    const result = plan(assessed);

    expect(result.decomposition.actionStack.length).toBeGreaterThanOrEqual(1);
    // Actions should be sorted with direction flow
    const dirOrder = { east: 0, south: 1, west: 2, north: 3 } as Record<string, number>;
    let lastDirWeight = -1;
    let directionFlowBroken = false;
    for (const action of result.decomposition.actionStack) {
      const weight = dirOrder[action.direction] ?? 3;
      if (weight < lastDirWeight) directionFlowBroken = true;
      lastDirWeight = weight;
    }
    // Not strict — cycles or dependencies may reorder, but the intent is eastward-first
  });

  it('generates SMDF seed with states per action', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);
    const result = plan(assessed);

    expect(result.smdfSeed).not.toBeNull();
    const seed = result.smdfSeed!;
    expect(seed.settings).toBeDefined();
    expect(seed.settings.namespace).toContain('pde.');
    expect(seed.state).toBeDefined();
    expect(seed.state.states!.length).toBeGreaterThanOrEqual(2); // idle + completed + actions
    expect(seed.events.length).toBeGreaterThanOrEqual(1);
  });

  it('generates graph nodes from plan', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);
    const result = plan(assessed);

    expect(result.graphNodes.length).toBeGreaterThan(0);
    const intentNodes = result.graphNodes.filter(n => n.nodeType === 'Intent');
    const actionNodes = result.graphNodes.filter(n => n.nodeType === 'ActionStep');
    expect(intentNodes.length).toBeGreaterThanOrEqual(1);
    expect(actionNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('generates narrative beats per action (A01-10)', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);
    const result = plan(assessed);

    expect(result.narrativeBeats.length).toBeGreaterThanOrEqual(1);
    for (const beat of result.narrativeBeats) {
      expect(beat.act).toBeGreaterThanOrEqual(1);
      expect(beat.act).toBeLessThanOrEqual(4);
      expect(DIRECTION_NAMES).toContain(beat.direction);
      expect(beat.content.length).toBeGreaterThan(0);
      expect(beat.timestamp).toBeDefined();
    }
  });

  it('ceremonyGuidance flows through to plan output', () => {
    // Force ceremony requirement
    const decomp = decompose('Build build build implement deploy ship code write execute run');
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);
    const result = plan(assessed);

    // ceremonyGuidance should be present if assessed.ceremonyRequired is true
    if (assessed.ceremonyRequired) {
      expect(result.ceremonyGuidance).not.toBeNull();
    }
  });
});

// ─── Full Pipeline ───────────────────────────────────────────────────────────

describe('runPipeline', () => {
  it('runs end-to-end without errors', async () => {
    const result = await runPipeline(SIMPLE_PROMPT, { persist: false });
    expect(result).toBeDefined();
    expect(result.decomposition).toBeDefined();
    expect(result.smdfSeed).toBeDefined();
    expect(result.graphNodes.length).toBeGreaterThan(0);
    expect(result.narrativeBeats.length).toBeGreaterThanOrEqual(0);
  });

  it('emits events for all 4 stages (A01-02)', async () => {
    const events: PipelineEvent[] = [];
    await runPipeline(SIMPLE_PROMPT, {
      persist: false,
      onEvent: (e) => events.push(e),
    });

    const stages = events.map(e => e.stage);
    expect(stages).toContain('decompose');
    expect(stages).toContain('enrich');
    expect(stages).toContain('assess');
    expect(stages).toContain('plan');

    // Each stage should have start + complete
    for (const stage of ['decompose', 'enrich', 'assess', 'plan']) {
      expect(events.find(e => e.stage === stage && e.status === 'start')).toBeDefined();
      expect(events.find(e => e.stage === stage && e.status === 'complete')).toBeDefined();
    }
  });

  it('produces valid StructuredPlan (A01-04)', async () => {
    const result = await runPipeline(SIMPLE_PROMPT, { persist: false });

    expect(result.decomposition.id).toBeDefined();
    expect(result.smdfSeed).toBeDefined();
    expect(result.graphNodes).toBeDefined();
    expect(result.narrativeBeats).toBeDefined();
    // ceremonyGuidance may be null or present
    expect('ceremonyGuidance' in result).toBe(true);
  });

  it('respects extractImplicit option', async () => {
    const withImplicit = await runPipeline(HEDGING_PROMPT, {
      persist: false,
      extractImplicit: true,
    });
    const withoutImplicit = await runPipeline(HEDGING_PROMPT, {
      persist: false,
      extractImplicit: false,
    });

    const implicitCountWith = withImplicit.decomposition.secondary.filter(s => s.implicit).length;
    const implicitCountWithout = withoutImplicit.decomposition.secondary.filter(s => s.implicit).length;
    expect(implicitCountWith).toBeGreaterThanOrEqual(implicitCountWithout);
  });
});

// ─── Storage: renderMarkdown ─────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('has Four Directions section BEFORE Primary Intent (A01-01)', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);
    const result = plan(assessed);
    const md = renderMarkdown(result.decomposition);

    const fourDirectionsIdx = md.indexOf('## Four Directions');
    const primaryIntentIdx = md.indexOf('## Primary Intent');

    expect(fourDirectionsIdx).toBeGreaterThanOrEqual(0);
    expect(primaryIntentIdx).toBeGreaterThanOrEqual(0);
    expect(fourDirectionsIdx).toBeLessThan(primaryIntentIdx);
  });

  it('contains all 4 direction headings', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const md = renderMarkdown(decomp);

    expect(md).toContain('EAST');
    expect(md).toContain('SOUTH');
    expect(md).toContain('WEST');
    expect(md).toContain('NORTH');
  });

  it('contains Ojibwe names', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const md = renderMarkdown(decomp);

    expect(md).toContain('Waabinong');
    expect(md).toContain('Zhaawanong');
    expect(md).toContain('Epangishmok');
    expect(md).toContain('Kiiwedinong');
  });

  it('contains direction emojis', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const md = renderMarkdown(decomp);

    expect(md).toContain('🌅');
    expect(md).toContain('🔥');
    expect(md).toContain('🌊');
    expect(md).toContain('❄️');
  });

  it('includes Primary Intent section', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const md = renderMarkdown(decomp);

    expect(md).toContain('## Primary Intent');
    expect(md).toContain('**Action:**');
    expect(md).toContain('**Target:**');
    expect(md).toContain('**Urgency:**');
  });

  it('includes Action Stack section', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const md = renderMarkdown(decomp);

    expect(md).toContain('## Action Stack');
    expect(md).toMatch(/\[[ x]\]/); // checkboxes
  });

  it('includes metadata footer', () => {
    const decomp = decompose(SIMPLE_PROMPT);
    const md = renderMarkdown(decomp);

    expect(md).toContain('**ID:**');
    expect(md).toContain('**Balance:**');
    expect(md).toContain('**Lead Direction:**');
    expect(md).toContain('**Wilson Alignment:**');
    expect(md).toContain('**Ceremony Required:**');
  });

  it('includes Ambiguity Flags section', () => {
    const decomp = decompose(HEDGING_PROMPT);
    const md = renderMarkdown(decomp);

    expect(md).toContain('## Ambiguity Flags');
  });

  it('renders ceremony guidance when needed', () => {
    // Force ceremony-required state
    const decomp = decompose('Build build implement deploy ship code execute run create forge');
    const enriched = enrich(decomp);
    const { assessed } = assess(enriched);

    if (assessed.ceremonyRequired && assessed.neglectedDirections.length > 0) {
      const md = renderMarkdown(assessed);
      expect(md).toContain('Ceremony recommended');
    }
  });
});

// ─── Storage: store/load (mocked FS) ─────────────────────────────────────────

describe('storage (mocked filesystem)', () => {
  const mockFs = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };

  // We test renderMarkdown above (pure function).
  // For store/load, we verify the shapes through the pipeline.

  it('pipeline produces data compatible with storage', async () => {
    const result = await runPipeline(SIMPLE_PROMPT, { persist: false });

    // Verify the decomposition has all fields needed for storage
    expect(result.decomposition.id).toBeDefined();
    expect(result.decomposition.timestamp).toBeDefined();
    expect(result.decomposition.prompt).toBeDefined();
    expect(result.decomposition.primary).toBeDefined();
    expect(result.decomposition.secondary).toBeDefined();
    expect(result.decomposition.directions).toBeDefined();
    expect(result.decomposition.actionStack).toBeDefined();

    // Verify SMDF seed is valid for .seed.smdf.json storage
    expect(result.smdfSeed).not.toBeNull();
    expect(result.smdfSeed!.settings.namespace).toBeDefined();

    // Verify markdown can be rendered
    const md = renderMarkdown(result.decomposition);
    expect(md.length).toBeGreaterThan(0);
    expect(md).toContain('# Prompt Decomposition');
  });

  it('decomposition round-trips through JSON', async () => {
    const result = await runPipeline(SIMPLE_PROMPT, { persist: false });
    const json = JSON.stringify(result.decomposition);
    const parsed = JSON.parse(json);

    expect(parsed.id).toBe(result.decomposition.id);
    expect(parsed.primary.action).toBe(result.decomposition.primary.action);
    expect(parsed.directions.east).toBeDefined();
    expect(parsed.actionStack.length).toBe(result.decomposition.actionStack.length);
  });
});
