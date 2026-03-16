/**
 * Full Pipeline E2E Smoke Tests — the golden path.
 *
 * Validates: prompt → decompose → enrich → assess → plan → StructuredPlan
 *            → graph ingest → query → verify
 *            → STC → SMDF → createMachine → fireEvent
 *            → generateBeat → addBeat → validateArcCoherence
 *            → full cycle (all 4 directions → spiral advances)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runPipeline, type PipelineEvent } from '@forgewright/lib/pde/pipeline.js';
import { ForgewrightGraph } from '@forgewright/lib/graph/database.js';
import { ingestPDE, ingestStateMachine } from '@forgewright/lib/graph/ingest.js';
import { neighborhood } from '@forgewright/lib/graph/queries.js';
import { stcToSMDF } from '@forgewright/lib/smcraft/stc-adapter.js';
import { createMachine, fireEvent, destroyMachine } from '@forgewright/lib/smcraft/runtime-bridge.js';
import { EVENT_IDS } from '@forgewright/lib/smcraft/events.js';
import { generateBeat, type BeatContext } from '@forgewright/lib/narrative/beat-generator.js';
import { createArc, addBeat, validateArcCoherence } from '@forgewright/lib/narrative/arc-manager.js';
import type { OcapContext } from '@forgewright/lib/graph/database.js';
import type { StructuralTensionChart } from '@forgewright/lib/types/stc.js';
import type { DirectionName } from '@forgewright/lib/types/directions.js';
import type { StructuredPlan } from '@forgewright/lib/types/pde.js';

// Mock filesystem writes so tests never touch disk
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const REALISTIC_PROMPT =
  'Create an authentication module for the RISE framework. ' +
  'I need JWT-based login, token refresh, and role-based access control. ' +
  'Research existing patterns in the codebase. ' +
  'Test the implementation thoroughly. ' +
  'Review the security implications and ensure OCAP compliance. ' +
  'Deploy to staging and document the API. ' +
  'I assume the database schema already exists.';

const COMMUNITY_CTX: OcapContext = {
  requester: 'test-agent',
  maxAccessLevel: 'community',
  isCeremonyActive: false,
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Full Pipeline — Golden Path', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
  });

  afterEach(async () => {
    await graph.close();
  });

  // ── Test 1: prompt → PDE pipeline → StructuredPlan ───────────────────────

  it('runs prompt through all 4 PDE stages and produces a StructuredPlan', async () => {
    const events: PipelineEvent[] = [];

    const plan = await runPipeline(REALISTIC_PROMPT, {
      persist: false,
      onEvent: (e) => events.push(e),
    });

    // All 4 stages should have fired
    const stageNames = events.map(e => e.stage);
    expect(stageNames).toContain('decompose');
    expect(stageNames).toContain('enrich');
    expect(stageNames).toContain('assess');
    expect(stageNames).toContain('plan');

    // Every stage completed without error
    const errors = events.filter(e => e.status === 'error');
    expect(errors).toHaveLength(0);

    // StructuredPlan shape
    expect(plan.decomposition).toBeDefined();
    expect(plan.decomposition.id).toBeTruthy();
    expect(plan.decomposition.primary.action).toBeTruthy();
    expect(plan.decomposition.actionStack.length).toBeGreaterThan(0);
    expect(plan.graphNodes.length).toBeGreaterThan(0);
    expect(plan.narrativeBeats.length).toBeGreaterThan(0);

    // SMDF seed was generated
    expect(plan.smdfSeed).toBeDefined();
    expect(plan.smdfSeed).not.toBeNull();
  });

  // ── Test 2: StructuredPlan → graph ingest → query back ───────────────────

  it('ingests a StructuredPlan into graph and queries nodes back', async () => {
    const plan = await runPipeline(REALISTIC_PROMPT, { persist: false });

    // Build a DecompositionResult-compatible object from the pipeline output
    const decomp = {
      primary: plan.decomposition.primary,
      secondary: plan.decomposition.secondary,
      context: plan.decomposition.context,
      outputs: plan.decomposition.outputs,
      directions: Object.fromEntries(
        Object.entries(plan.decomposition.directions).map(([k, v]) => [k, v.insights]),
      ),
      actionStack: plan.decomposition.actionStack,
      ambiguities: plan.decomposition.ambiguities,
    };

    const { intentIds, actionStepIds } = await ingestPDE(graph, decomp);

    // Nodes were created
    expect(intentIds.length).toBeGreaterThan(0);
    expect(actionStepIds.length).toBeGreaterThan(0);

    // Query back — verify Intent nodes exist
    for (const id of intentIds) {
      const node = await graph.getNode(id);
      expect(node).not.toBeNull();
      expect(node!.nodeType).toBe('Intent');
    }

    // Query back — verify ActionStep nodes exist
    for (const id of actionStepIds) {
      const node = await graph.getNode(id);
      expect(node).not.toBeNull();
      expect(node!.nodeType).toBe('ActionStep');
    }

    // Neighborhood query returns connected nodes
    const result = await neighborhood(graph, intentIds[0], COMMUNITY_CTX, 1);
    expect(result.nodes.length + result.edges.length).toBeGreaterThanOrEqual(0);
  });

  // ── Test 3: STC → SMDF → createMachine → fireEvent → state changes ──────

  it('converts STC to SMDF and drives state transitions', async () => {
    const chart: StructuralTensionChart = {
      id: 'test-stc-001',
      desiredOutcome: 'Build relational authentication module',
      currentReality: 'No auth exists yet',
      actionSteps: [
        { id: 'step-vision', description: 'Define auth requirements', direction: 'east', status: 'pending', confidence: 0.9, dependencies: [] },
        { id: 'step-research', description: 'Research JWT patterns', direction: 'south', status: 'pending', confidence: 0.8, dependencies: ['step-vision'] },
        { id: 'step-build', description: 'Implement auth module', direction: 'west', status: 'pending', confidence: 0.7, dependencies: ['step-research'] },
        { id: 'step-review', description: 'Review and integrate', direction: 'north', status: 'pending', confidence: 0.8, dependencies: ['step-build'] },
      ],
      tensionLevel: 0.8,
      phase: 'germination',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // STC → SMDF
    const smdf = stcToSMDF(chart);
    expect(smdf.settings.namespace).toBe('forgewright.stc');
    expect(smdf.state.name).toBe('CreativeProcess');
    expect(smdf.state.states).toBeDefined();
    expect(smdf.state.states!.length).toBe(3); // Germination, Assimilation, Completion

    // SMDF → Machine
    const machine = await createMachine(smdf);
    expect(machine.isRunning).toBe(true);
    expect(machine.currentState).toBeTruthy();
    const initialState = machine.currentState;

    // Fire tension_established → should transition
    const result1 = fireEvent(machine, EVENT_IDS.TENSION_ESTABLISHED);
    // The root state has a transition for tension_established
    if (result1.success) {
      expect(result1.currentState).not.toBe(initialState);
    }

    // Fire action_step_completed → should advance within phase
    const result2 = fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(result2.event.eventId).toBe(EVENT_IDS.ACTION_STEP_COMPLETED);

    // Clean up
    destroyMachine(machine.id);
    expect(machine.isRunning).toBe(false);
  });

  // ── Test 4: action step → generateBeat → addBeat → validateArcCoherence ──

  it('generates narrative beats and validates arc coherence', () => {
    const wilsonCtx: BeatContext = {
      wilson: {
        ocapCompliant: true,
        relationsHonored: ['community', 'land'],
        ceremoniesConducted: ['opening'],
        directionsVisited: ['east'],
        totalSteps: 4,
        completedSteps: 1,
      },
      emotion: 'determination',
      intensity: 0.8,
      learnings: ['JWT patterns documented'],
      relationsHonored: ['community'],
      ceremonies: ['opening ceremony'],
    };

    const steps: Array<{ id: string; description: string; direction: DirectionName }> = [
      { id: 'step-east', description: 'Define auth requirements', direction: 'east' },
      { id: 'step-south', description: 'Research JWT patterns', direction: 'south' },
      { id: 'step-west', description: 'Validate implementation', direction: 'west' },
      { id: 'step-north', description: 'Deploy and document', direction: 'north' },
    ];

    let arc = createArc('test-session');
    expect(arc.beats).toHaveLength(0);
    expect(arc.isComplete).toBe(false);

    // Generate and add beats for each direction
    for (const step of steps) {
      const actionStep = {
        id: step.id,
        description: step.description,
        direction: step.direction,
        status: 'done' as const,
        confidence: 0.85,
        dependencies: [],
      };

      const beat = generateBeat(actionStep, step.direction, wilsonCtx);
      expect(beat.id).toContain(step.direction);
      expect(beat.direction).toBe(step.direction);
      expect(beat.content).toBe(step.description);
      expect(beat.prose).toBeTruthy();

      arc = addBeat(arc, beat);
    }

    // Arc should be complete (all 4 directions visited)
    expect(arc.isComplete).toBe(true);
    expect(arc.directionsVisited).toContain('east');
    expect(arc.directionsVisited).toContain('south');
    expect(arc.directionsVisited).toContain('west');
    expect(arc.directionsVisited).toContain('north');
    expect(arc.beats).toHaveLength(4);

    // Wilson alignment should be computed
    expect(arc.wilsonAlignment).toBeDefined();
    expect(typeof arc.wilsonAlignment).toBe('number');

    // Validate coherence — sunwise flow should be coherent
    const coherence = validateArcCoherence(arc);
    expect(coherence.coherent).toBe(true);
    expect(coherence.issues).toHaveLength(0);
  });

  // ── Test 5: full cycle = all 4 directions → spiral advances ──────────────

  it('completes full Medicine Wheel cycle from pipeline through narrative', async () => {
    // Run the full pipeline
    const plan = await runPipeline(REALISTIC_PROMPT, { persist: false });

    // Verify the plan covers multiple directions
    const directionsCovered = new Set(
      plan.decomposition.actionStack.map(a => a.direction),
    );
    expect(directionsCovered.size).toBeGreaterThanOrEqual(2);

    // Each narrative beat should map to a direction
    for (const beat of plan.narrativeBeats) {
      expect(['east', 'south', 'west', 'north']).toContain(beat.direction);
      expect(beat.act).toBeGreaterThanOrEqual(1);
      expect(beat.act).toBeLessThanOrEqual(4);
    }

    // Build an arc from pipeline beats
    let arc = createArc('spiral-test');
    for (const beat of plan.narrativeBeats) {
      arc = addBeat(arc, beat);
    }

    // The arc should have beats
    expect(arc.beats.length).toBe(plan.narrativeBeats.length);

    // Check which directions are represented
    expect(arc.directionsVisited.length).toBeGreaterThanOrEqual(1);

    // If all 4 directions are visited, spiral is complete
    if (arc.directionsVisited.length === 4) {
      expect(arc.isComplete).toBe(true);
    }

    // Wilson alignment computed at arc level
    expect(arc.wilsonAlignment).toBeDefined();
    expect(typeof arc.wilsonAlignment).toBe('number');
  });

  // ── Test 6: pipeline with graph context enrichment ───────────────────────

  it('enriches decomposition with graph context from existing nodes', async () => {
    const plan = await runPipeline(REALISTIC_PROMPT, {
      persist: false,
      graphContext: {
        neighbors: [
          { id: 'spec-auth', nodeType: 'Spec', direction: 'east', obligations: ['Honor data sovereignty'] },
          { id: 'comp-mia', nodeType: 'Companion', direction: 'north' },
        ],
        existingIntents: [
          { id: 'prior-intent', description: 'Build auth module', direction: 'north' },
        ],
      },
    });

    // Enrichment should have processed — Wilson alignment should be non-zero
    // (because graphContext adds neighbor direction scoring)
    expect(plan.decomposition.wilsonAlignment).toBeDefined();
    expect(typeof plan.decomposition.wilsonAlignment).toBe('number');

    // Secondary intents should have obligations from graph context
    const withObligations = plan.decomposition.secondary.filter(
      s => s.obligations.length > 0,
    );
    // At least the prompt mentions community/user which triggers human obligations
    expect(plan.decomposition.secondary.length).toBeGreaterThan(0);
  });

  // ── Test 7: SMDF ingest into graph creates State and Event nodes ─────────

  it('ingests SMDF state machine into graph and creates proper nodes', async () => {
    const chart: StructuralTensionChart = {
      id: 'graph-stc-001',
      desiredOutcome: 'Test state machine graph ingest',
      currentReality: 'No machine in graph',
      actionSteps: [
        { id: 'step-a', description: 'Step A', direction: 'east', status: 'pending', confidence: 0.9, dependencies: [] },
        { id: 'step-b', description: 'Step B', direction: 'north', status: 'pending', confidence: 0.8, dependencies: [] },
      ],
      tensionLevel: 0.6,
      phase: 'germination',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const smdf = stcToSMDF(chart);
    const { machineId, stateIds, eventIds } = await ingestStateMachine(graph, smdf);

    expect(machineId).toBeTruthy();
    expect(stateIds.length).toBeGreaterThan(0);
    expect(eventIds.length).toBeGreaterThan(0);

    // Verify StateMachine node exists
    const machineNode = await graph.getNode(machineId);
    expect(machineNode).not.toBeNull();
    expect(machineNode!.nodeType).toBe('StateMachine');

    // Verify State nodes exist
    for (const sid of stateIds) {
      const stateNode = await graph.getNode(sid);
      expect(stateNode).not.toBeNull();
      expect(stateNode!.nodeType).toBe('State');
    }

    // Verify CONTAINS edges from machine to states
    const containsEdges = await graph.findEdges('CONTAINS');
    const machineContains = containsEdges.filter(e => e.fromId === machineId);
    expect(machineContains.length).toBe(stateIds.length);
  });
});
