import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stcToSMDF, smdfToSTC } from '@forgewright/lib/smcraft/stc-adapter';
import {
  createCreativeProcessMachine,
  getCreativeProcessStateNames,
} from '@forgewright/lib/smcraft/creative-process';
import {
  EVENT_IDS,
  ALL_EVENT_IDS,
  tensionEstablished,
  actionStepCompleted,
  realityUpdated,
  phaseAdvance,
  phaseRetreat,
  aiGenerate,
  userEdit,
  tensionResolve,
  tensionOscillate,
  workspaceFork,
  momentOfTruth,
} from '@forgewright/lib/smcraft/events';
import { OscillationDetector } from '@forgewright/lib/smcraft/oscillation';
import { createMachine, fireEvent } from '@forgewright/lib/smcraft/runtime-bridge';
import type { StructuralTensionChart } from '@forgewright/lib/types/stc';
import type { StateMachineEvent } from '@forgewright/lib/types/smdf';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTestChart(): StructuralTensionChart {
  return {
    id: 'test-chart-1',
    desiredOutcome: 'Build a ceremony platform',
    currentReality: 'Starting from scratch',
    actionSteps: [
      { id: 'define-intent', description: 'Define intent', direction: 'east', status: 'pending', confidence: 0.9, dependencies: [] },
      { id: 'write-specs', description: 'Write specifications', direction: 'south', status: 'pending', confidence: 0.8, dependencies: ['define-intent'] },
      { id: 'implement', description: 'Implement core', direction: 'west', status: 'pending', confidence: 0.7, dependencies: ['write-specs'] },
      { id: 'reflect', description: 'Reflect and integrate', direction: 'north', status: 'pending', confidence: 0.6, dependencies: ['implement'] },
    ],
    tensionLevel: 0.8,
    phase: 'germination',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── STC ↔ SMDF Adapter ─────────────────────────────────────────────────────

describe('stcToSMDF', () => {
  it('produces a valid StateMachineDefinition', () => {
    const chart = makeTestChart();
    const smdf = stcToSMDF(chart);

    expect(smdf).toBeDefined();
    expect(smdf.settings.namespace).toBe('forgewright.stc');
    expect(smdf.settings.name).toBe(`STC_${chart.id}`);
    expect(smdf.settings.asynchronous).toBe(true);
    expect(smdf.state).toBeDefined();
    expect(smdf.state.name).toBe('CreativeProcess');
    expect(smdf.events).toHaveLength(1);
    // Root should have composite phase children
    expect(smdf.state.states).toBeDefined();
    expect(smdf.state.states!.length).toBe(4); // TensionField + Germination, Assimilation, Completion
  });
});

describe('smdfToSTC', () => {
  it('reverse maps SMDF back to STC', () => {
    const chart = makeTestChart();
    const smdf = stcToSMDF(chart);
    const reconstructed = smdfToSTC(smdf);

    expect(reconstructed).toBeDefined();
    expect(reconstructed.desiredOutcome).toBe('Build a ceremony platform');
    expect(reconstructed.actionSteps.length).toBeGreaterThan(0);
    expect(reconstructed.phase).toBeDefined();
    expect(reconstructed.tensionLevel).toBeGreaterThanOrEqual(0);
    expect(reconstructed.tensionLevel).toBeLessThanOrEqual(1);
  });
});

// ─── Creative Process Machine ────────────────────────────────────────────────

describe('createCreativeProcessMachine', () => {
  it('has all expected states', () => {
    const machine = createCreativeProcessMachine('Test intent');
    const expectedNames = getCreativeProcessStateNames();

    // Collect all state names by walking the tree
    const allNames: string[] = [];
    function walk(state: { name: string; states?: { name: string; states?: any[] }[] }) {
      allNames.push(state.name);
      for (const child of state.states ?? []) walk(child);
    }
    walk(machine.state);

    for (const name of expectedNames) {
      expect(allNames).toContain(name);
    }
  });

  it('root state is CreativeProcess', () => {
    const machine = createCreativeProcessMachine('Build something');
    expect(machine.state.name).toBe('CreativeProcess');
    expect(machine.state.description).toBe('Build something');
  });
});

// ─── Event Factories ─────────────────────────────────────────────────────────

describe('Event Factories', () => {
  const factories = [
    { name: 'tensionEstablished', fn: () => tensionEstablished('A', 'B', { chartId: 'c', desiredOutcome: 'x', currentReality: 'y', tensionLevel: 0.5 }), expectedId: EVENT_IDS.TENSION_ESTABLISHED },
    { name: 'actionStepCompleted', fn: () => actionStepCompleted('A', 'B', { stepId: 's', description: 'd', phase: 'p', confidence: 0.9 }), expectedId: EVENT_IDS.ACTION_STEP_COMPLETED },
    { name: 'realityUpdated', fn: () => realityUpdated('A', 'B', { previousReality: 'old', newReality: 'new', tensionDelta: -0.1 }), expectedId: EVENT_IDS.REALITY_UPDATED },
    { name: 'phaseAdvance', fn: () => phaseAdvance('A', 'B', { fromPhase: 'g', toPhase: 'a', completedSteps: 3, totalSteps: 5 }), expectedId: EVENT_IDS.PHASE_ADVANCE },
    { name: 'phaseRetreat', fn: () => phaseRetreat('A', 'B', { fromPhase: 'a', toPhase: 'g', reason: 'rethink' }), expectedId: EVENT_IDS.PHASE_RETREAT },
    { name: 'aiGenerate', fn: () => aiGenerate('A', 'B', { artifactType: 'code' }), expectedId: EVENT_IDS.AI_GENERATE },
    { name: 'userEdit', fn: () => userEdit('A', 'B', { artifactType: 'spec' }), expectedId: EVENT_IDS.USER_EDIT },
    { name: 'tensionResolve', fn: () => tensionResolve('A', 'B', { chartId: 'c', finalState: 'done' }), expectedId: EVENT_IDS.TENSION_RESOLVE },
    { name: 'tensionOscillate', fn: () => tensionOscillate('A', 'B', { stateVisited: 'X', visitCount: 3, netProgress: 0 }), expectedId: EVENT_IDS.TENSION_OSCILLATE },
    { name: 'workspaceFork', fn: () => workspaceFork('A', 'B', { sourceWorkspaceId: 'ws1', newWorkspaceId: 'ws2', forkPoint: 'fp' }), expectedId: EVENT_IDS.WORKSPACE_FORK },
    { name: 'momentOfTruth', fn: () => momentOfTruth('A', 'B', { checkpoint: 'cp', decision: 'advance' }), expectedId: EVENT_IDS.MOMENT_OF_TRUTH },
  ];

  it('all 11 event factory functions produce typed events', () => {
    expect(ALL_EVENT_IDS).toHaveLength(11);

    for (const { name, fn, expectedId } of factories) {
      const event = fn();
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.eventId).toBe(expectedId);
      expect(event.fromState).toBe('A');
      expect(event.toState).toBe('B');
    }
  });
});

// ─── Oscillation Detector ────────────────────────────────────────────────────

describe('OscillationDetector', () => {
  it('flags 3+ same-state visits (state_revisit)', () => {
    const detector = new OscillationDetector({ revisitThreshold: 3 });

    // Visit the same state 3 times without advancing
    const events: StateMachineEvent[] = [
      { id: '1', timestamp: '', eventId: 'e', fromState: 'A', toState: 'TaskDefinition' },
      { id: '2', timestamp: '', eventId: 'e', fromState: 'TaskDefinition', toState: 'TaskDefinition' },
      { id: '3', timestamp: '', eventId: 'e', fromState: 'TaskDefinition', toState: 'TaskDefinition' },
    ];

    const report = detector.detectOscillation(events);
    expect(report).not.toBeNull();
    expect(report!.pattern).toBe('state_revisit');
    expect(report!.statesInvolved).toContain('TaskDefinition');
  });

  it('flags bounce pattern (A→B→A→B)', () => {
    const detector = new OscillationDetector({ revisitThreshold: 10, progressWindow: 20 });

    // Retreat from CodeImplementation to PlanGeneration, then bounce back
    const events: StateMachineEvent[] = [
      { id: '1', timestamp: '', eventId: 'e', fromState: 'CodeImplementation', toState: 'PlanGeneration' },
      { id: '2', timestamp: '', eventId: 'e', fromState: 'PlanGeneration', toState: 'CodeImplementation' },
    ];

    const report = detector.detectOscillation(events);
    expect(report).not.toBeNull();
    expect(report!.pattern).toBe('phase_bounce');
  });

  it('returns null when no oscillation detected', () => {
    const detector = new OscillationDetector();

    // Simple forward progression
    const events: StateMachineEvent[] = [
      { id: '1', timestamp: '', eventId: 'e', fromState: 'TaskDefinition', toState: 'SpecGeneration' },
      { id: '2', timestamp: '', eventId: 'e', fromState: 'SpecGeneration', toState: 'PDEDecomposition' },
    ];

    const report = detector.detectOscillation(events);
    expect(report).toBeNull();
  });
});

// ─── Runtime Bridge ──────────────────────────────────────────────────────────

describe('Runtime Bridge', () => {
  it('fireEvent on runtime bridge changes state', async () => {
    const definition = createCreativeProcessMachine('Test runtime bridge');
    const machine = await createMachine(definition);

    // Initial state should be the first leaf: TaskDefinition
    expect(machine.currentState).toBe('TaskDefinition');
    expect(machine.isRunning).toBe(true);

    // Fire ACTION_STEP_COMPLETED to move to SpecGeneration
    const result = fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(result.success).toBe(true);
    expect(result.currentState).toBe('SpecGeneration');
    expect(result.previousState).toBe('TaskDefinition');
  });

  it('fireEvent on stopped machine fails', async () => {
    const definition = createCreativeProcessMachine('Stopped test');
    const machine = await createMachine(definition);
    machine.isRunning = false;

    const result = fireEvent(machine, EVENT_IDS.ACTION_STEP_COMPLETED);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not running');
  });
});
