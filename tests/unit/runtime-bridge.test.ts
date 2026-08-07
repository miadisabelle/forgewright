// ─── Runtime bridge on the installed interpreter (smcraft@0.3.0) ─────────────
// Locks the drive-path contract end to end: with the published package
// installed, createMachine backs onto smcraft's Machine (backend 'smcraft'),
// lands on TensionField, and tension_established genuinely moves the leaf.
// Guard semantics fail closed on both backends.

import { describe, expect, it } from 'vitest';
import {
  createMachine,
  destroyMachine,
  fireEvent,
} from '@forgewright/lib/smcraft/runtime-bridge';
import { stcToSMDF, TENSION_FIELD_STATE } from '@forgewright/lib/smcraft/stc-adapter';
import { EVENT_IDS } from '@forgewright/lib/smcraft/events';
import type { StructuralTensionChart } from '@forgewright/lib/types/stc';

function makeChart(): StructuralTensionChart {
  return {
    id: 'bridge-stc',
    desiredOutcome: 'Drive the installed runtime',
    currentReality: 'Bridge used to only label its backend',
    actionSteps: [
      { id: 'step-vision', description: 'See it', direction: 'east', status: 'pending', confidence: 0.9, dependencies: [] },
      { id: 'step-build', description: 'Build it', direction: 'west', status: 'pending', confidence: 0.8, dependencies: [] },
      { id: 'step-review', description: 'Review it', direction: 'north', status: 'pending', confidence: 0.8, dependencies: [] },
    ],
    tensionLevel: 0.7,
    phase: 'germination',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('runtime bridge on installed smcraft', () => {
  it('backs onto the smcraft Machine and rests in TensionField', async () => {
    const machine = await createMachine(stcToSMDF(makeChart()));
    expect(machine.backend).toBe('smcraft');
    expect(machine.currentState).toBe(TENSION_FIELD_STATE);
    expect(machine.isRunning).toBe(true);
    destroyMachine(machine.id);
  });

  it('tension_established genuinely moves the leaf out of TensionField', async () => {
    const machine = await createMachine(stcToSMDF(makeChart()));
    const result = fireEvent(machine, EVENT_IDS.TENSION_ESTABLISHED);

    expect(result.success).toBe(true);
    expect(result.previousState).toBe(TENSION_FIELD_STATE);
    expect(result.currentState).not.toBe(TENSION_FIELD_STATE);
    expect(machine.currentState).toBe(result.currentState);
    expect(machine.stateHistory).toContain(result.currentState);
    destroyMachine(machine.id);
  });

  it('an unmatched event reports failure without moving the leaf', async () => {
    const machine = await createMachine(stcToSMDF(makeChart()));
    const before = machine.currentState;
    const result = fireEvent(machine, 'no_such_event');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(machine.currentState).toBe(before);
    destroyMachine(machine.id);
  });

  it('guards fail closed: a conditioned transition needs its context key', async () => {
    const definition = {
      settings: { namespace: 'test.guard', name: 'GuardTest', asynchronous: true },
      events: [{ name: 'src', events: [{ id: 'go', name: 'go' }] }],
      state: {
        name: 'Root',
        states: [
          { name: 'A', transitions: [{ event: 'go', nextState: 'B', condition: 'ready' }] },
          { name: 'B' },
        ],
      },
    };

    const closed = await createMachine(definition);
    expect(fireEvent(closed, 'go').success).toBe(false);
    destroyMachine(closed.id);

    const open = await createMachine(definition, { context: { ready: true } });
    const result = fireEvent(open, 'go');
    expect(result.success).toBe(true);
    expect(result.currentState).toBe('B');
    destroyMachine(open.id);
  });
});
