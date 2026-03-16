/**
 * Creative Process State Machine — integration tests.
 *
 * Validates: createCreativeProcessMachine hierarchy, state transitions,
 *            phase advancement, and oscillation detection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createCreativeProcessMachine,
  getCreativeProcessStateNames,
  stateToPhase,
} from '@forgewright/lib/smcraft/creative-process.js';
import {
  createMachine,
  fireEvent,
  getCurrentState,
  destroyMachine,
  type MachineInstance,
} from '@forgewright/lib/smcraft/runtime-bridge.js';
import { EVENT_IDS } from '@forgewright/lib/smcraft/events.js';
import { OscillationDetector } from '@forgewright/lib/smcraft/oscillation.js';
import type { StateMachineEvent } from '@forgewright/lib/types/smdf.js';

// Mock filesystem
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('Creative Process State Machine', () => {
  let machine: MachineInstance;

  afterEach(() => {
    if (machine?.id) {
      destroyMachine(machine.id);
    }
  });

  // ── Test 1: All 9 leaf states present ────────────────────────────────────

  it('creates a machine with all 9 leaf states plus 4 composites', () => {
    const definition = createCreativeProcessMachine('Test creative process');
    const allNames = getCreativeProcessStateNames();

    // 13 total: 1 root + 3 phase composites + 9 leaf states
    expect(allNames).toHaveLength(13);

    // Root
    expect(allNames).toContain('CreativeProcess');

    // Germination composite + leaves
    expect(allNames).toContain('Germination');
    expect(allNames).toContain('TaskDefinition');
    expect(allNames).toContain('SpecGeneration');
    expect(allNames).toContain('PDEDecomposition');

    // Assimilation composite + leaves
    expect(allNames).toContain('Assimilation');
    expect(allNames).toContain('PlanGeneration');
    expect(allNames).toContain('CodeImplementation');
    expect(allNames).toContain('IterativeRefinement');

    // Completion composite + leaves
    expect(allNames).toContain('Completion');
    expect(allNames).toContain('Validation');
    expect(allNames).toContain('Review');
    expect(allNames).toContain('Integration');

    // Verify structure: root has 3 composite children
    expect(definition.state.states).toHaveLength(3);
    expect(definition.state.states![0].name).toBe('Germination');
    expect(definition.state.states![1].name).toBe('Assimilation');
    expect(definition.state.states![2].name).toBe('Completion');

    // Each composite has 3 leaf children
    for (const composite of definition.state.states!) {
      expect(composite.states).toHaveLength(3);
    }

    // Integration is the only final state
    const completionLeaves = definition.state.states![2].states!;
    const finalState = completionLeaves.find(s => s.kind === 'final');
    expect(finalState).toBeDefined();
    expect(finalState!.name).toBe('Integration');
  });

  // ── Test 2: tension_established → TaskDefinition ─────────────────────────

  it('advances from initial state to TaskDefinition on tension_established', async () => {
    const definition = createCreativeProcessMachine('Forge auth module');
    machine = await createMachine(definition);

    // Initial state is the first leaf of the first composite
    expect(machine.currentState).toBe('TaskDefinition');
    expect(machine.isRunning).toBe(true);

    // Fire tension_established from root-level transition
    const result = fireEvent(machine, EVENT_IDS.TENSION_ESTABLISHED);
    // Root has a transition: tension_established → TaskDefinition
    // Since we're already at TaskDefinition, this is a self-transition via root
    expect(result.event.eventId).toBe(EVENT_IDS.TENSION_ESTABLISHED);
  });

  // ── Test 3: phase_advance moves through phases ───────────────────────────

  it('moves through Germination → Assimilation → Completion with step + phase events', async () => {
    const definition = createCreativeProcessMachine('Build feature');
    machine = await createMachine(definition);

    // Start at TaskDefinition (germination)
    expect(machine.currentState).toBe('TaskDefinition');
    expect(stateToPhase(machine.currentState)).toBe('germination');

    // TaskDefinition → SpecGeneration (action_step_completed)
    const r1 = fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(r1.success).toBe(true);
    expect(machine.currentState).toBe('SpecGeneration');
    expect(stateToPhase(machine.currentState)).toBe('germination');

    // SpecGeneration → PDEDecomposition (action_step_completed)
    const r2 = fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(r2.success).toBe(true);
    expect(machine.currentState).toBe('PDEDecomposition');
    expect(stateToPhase(machine.currentState)).toBe('germination');

    // PDEDecomposition → PlanGeneration (phase_advance crosses to Assimilation)
    const r3 = fireEvent(machine, EVENT_IDS.PHASE_ADVANCE);
    expect(r3.success).toBe(true);
    expect(machine.currentState).toBe('PlanGeneration');
    expect(stateToPhase(machine.currentState)).toBe('assimilation');

    // PlanGeneration → CodeImplementation
    const r4 = fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(r4.success).toBe(true);
    expect(machine.currentState).toBe('CodeImplementation');

    // CodeImplementation → IterativeRefinement
    const r5 = fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(r5.success).toBe(true);
    expect(machine.currentState).toBe('IterativeRefinement');
    expect(stateToPhase(machine.currentState)).toBe('assimilation');

    // IterativeRefinement → Validation (phase_advance crosses to Completion)
    const r6 = fireEvent(machine, EVENT_IDS.PHASE_ADVANCE);
    expect(r6.success).toBe(true);
    expect(machine.currentState).toBe('Validation');
    expect(stateToPhase(machine.currentState)).toBe('completion');
  });

  // ── Test 4: oscillation detection when same state visited 3x ─────────────

  it('detects oscillation when a state is revisited 3+ times without advancing', () => {
    const detector = new OscillationDetector({ revisitThreshold: 3, progressWindow: 10 });

    // Simulate revisiting CodeImplementation 3 times without advancing
    const events: StateMachineEvent[] = [
      makeEvent('PlanGeneration', 'CodeImplementation', EVENT_IDS.ACTION_STEP_COMPLETED),
      makeEvent('CodeImplementation', 'IterativeRefinement', EVENT_IDS.ACTION_STEP_COMPLETED),
      makeEvent('IterativeRefinement', 'CodeImplementation', EVENT_IDS.ACTION_STEP_COMPLETED),
      makeEvent('CodeImplementation', 'IterativeRefinement', EVENT_IDS.ACTION_STEP_COMPLETED),
      makeEvent('IterativeRefinement', 'CodeImplementation', EVENT_IDS.ACTION_STEP_COMPLETED),
    ];

    const report = detector.detectOscillation(events);
    expect(report).not.toBeNull();
    expect(report!.detected).toBe(true);
    expect(report!.statesInvolved).toContain('CodeImplementation');
    expect(report!.recommendation).toBeTruthy();
  });

  // ── Test 5: no oscillation on clean forward progression ──────────────────

  it('reports no oscillation on clean forward progression', () => {
    const detector = new OscillationDetector({ revisitThreshold: 3, progressWindow: 10 });

    const events: StateMachineEvent[] = [
      makeEvent('TaskDefinition', 'SpecGeneration', EVENT_IDS.ACTION_STEP_COMPLETED),
      makeEvent('SpecGeneration', 'PDEDecomposition', EVENT_IDS.ACTION_STEP_COMPLETED),
      makeEvent('PDEDecomposition', 'PlanGeneration', EVENT_IDS.PHASE_ADVANCE),
      makeEvent('PlanGeneration', 'CodeImplementation', EVENT_IDS.ACTION_STEP_COMPLETED),
      makeEvent('CodeImplementation', 'IterativeRefinement', EVENT_IDS.ACTION_STEP_COMPLETED),
    ];

    const report = detector.detectOscillation(events);
    expect(report).toBeNull();
  });

  // ── Test 6: phase_retreat creates backward movement ──────────────────────

  it('supports phase retreat back to earlier states', async () => {
    const definition = createCreativeProcessMachine('Test retreat');
    machine = await createMachine(definition);

    // Advance to SpecGeneration
    fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(machine.currentState).toBe('SpecGeneration');

    // Advance to PDEDecomposition
    fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(machine.currentState).toBe('PDEDecomposition');

    // Retreat back to TaskDefinition
    const retreat = fireEvent(machine, EVENT_IDS.PHASE_RETREAT);
    expect(retreat.success).toBe(true);
    expect(machine.currentState).toBe('TaskDefinition');
    expect(stateToPhase(machine.currentState)).toBe('germination');
  });

  // ── Test 7: stateToPhase maps all states correctly ───────────────────────

  it('maps every creative process state to its correct phase', () => {
    expect(stateToPhase('Germination')).toBe('germination');
    expect(stateToPhase('TaskDefinition')).toBe('germination');
    expect(stateToPhase('SpecGeneration')).toBe('germination');
    expect(stateToPhase('PDEDecomposition')).toBe('germination');

    expect(stateToPhase('Assimilation')).toBe('assimilation');
    expect(stateToPhase('PlanGeneration')).toBe('assimilation');
    expect(stateToPhase('CodeImplementation')).toBe('assimilation');
    expect(stateToPhase('IterativeRefinement')).toBe('assimilation');

    expect(stateToPhase('Completion')).toBe('completion');
    expect(stateToPhase('Validation')).toBe('completion');
    expect(stateToPhase('Review')).toBe('completion');
    expect(stateToPhase('Integration')).toBe('completion');

    expect(stateToPhase('UnknownState')).toBeNull();
  });

  // ── Test 8: getCurrentState returns full path ────────────────────────────

  it('returns the full state path including composite ancestors', async () => {
    const definition = createCreativeProcessMachine('Path test');
    machine = await createMachine(definition);

    const path = getCurrentState(machine);
    // Should contain root → phase → leaf
    expect(path).toContain('CreativeProcess');
    expect(path).toContain('Germination');
    expect(path).toContain('TaskDefinition');
    expect(path.length).toBe(3);
  });

  // ── Test 9: zero_progress detection ──────────────────────────────────────

  it('detects zero_progress pattern over event window', () => {
    const detector = new OscillationDetector({
      revisitThreshold: 10, // high so state_revisit doesn't fire first
      progressWindow: 6,
    });

    // Back and forth between CodeImplementation and IterativeRefinement
    const events: StateMachineEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        makeEvent('CodeImplementation', 'IterativeRefinement', EVENT_IDS.ACTION_STEP_COMPLETED),
        makeEvent('IterativeRefinement', 'CodeImplementation', EVENT_IDS.ACTION_STEP_COMPLETED),
      );
    }

    const report = detector.detectOscillation(events);
    expect(report).not.toBeNull();
    expect(report!.detected).toBe(true);
    // Either zero_progress or state_revisit should fire
    expect(['zero_progress', 'state_revisit']).toContain(report!.pattern);
    expect(report!.severity).toBe('critical');
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _eventSeq = 0;

function makeEvent(
  fromState: string,
  toState: string,
  eventId: string,
): StateMachineEvent {
  return {
    id: `test-evt-${++_eventSeq}`,
    timestamp: new Date().toISOString(),
    eventId,
    fromState,
    toState,
  };
}
