/**
 * Runtime Bridge — connects Forgewright to smcraft's runtime engine.
 *
 * Tries to import from the smcraft package (file: dependency).
 * If unavailable, provides a standalone lightweight runtime that
 * implements the same interface for development/testing.
 */

import type {
  StateMachineDefinition,
  StateDef,
  StateMachineEvent,
} from '../types/smdf.js';
import { EVENT_IDS } from './events.js';

// ─── Runtime interface (what we expose regardless of backend) ────────────────

export interface MachineInstance {
  id: string;
  definition: StateMachineDefinition;
  currentState: string;
  stateHistory: string[];
  eventLog: StateMachineEvent[];
  isRunning: boolean;
  backend: 'smcraft' | 'standalone';
}

export interface TransitionResult {
  success: boolean;
  previousState: string;
  currentState: string;
  event: StateMachineEvent;
  error?: string;
}

// ─── smcraft import attempt ──────────────────────────────────────────────────

type SmcraftRuntime = {
  Context: new (name?: string) => {
    stateCurrent: { name: string } | null;
    enterInitialState: () => void;
    leaveCurrentState: () => void;
    setState: (name: string) => void;
    serialize: () => Record<string, unknown>;
  };
};

let _smcraftRuntime: SmcraftRuntime | null = null;
let _smcraftAttempted = false;

async function getSmcraftRuntime(): Promise<SmcraftRuntime | null> {
  if (_smcraftAttempted) return _smcraftRuntime;
  _smcraftAttempted = true;
  try {
    // @ts-expect-error — smcraft may not be built; fallback is intentional
    _smcraftRuntime = await import('smcraft/runtime') as SmcraftRuntime;
  } catch {
    _smcraftRuntime = null;
  }
  return _smcraftRuntime;
}

// ─── Standalone Runtime ──────────────────────────────────────────────────────
// Lightweight runtime that tracks state transitions without smcraft dependency.

function findInitialLeaf(state: StateDef): string {
  if (state.states && state.states.length > 0) {
    return findInitialLeaf(state.states[0]);
  }
  return state.name;
}

function findAllLeafStates(state: StateDef): Map<string, StateDef> {
  const map = new Map<string, StateDef>();

  function walk(s: StateDef): void {
    if (s.states && s.states.length > 0) {
      for (const child of s.states) walk(child);
    } else {
      map.set(s.name, s);
    }
  }

  walk(state);
  return map;
}

function findStateByName(root: StateDef, name: string): StateDef | null {
  if (root.name === name) return root;
  for (const child of root.states ?? []) {
    const found = findStateByName(child, name);
    if (found) return found;
  }
  return null;
}

function resolveTransition(
  state: StateDef,
  eventId: string,
  root: StateDef,
): string | null {
  // Check current state's transitions
  for (const t of state.transitions ?? []) {
    if (t.event === eventId && t.nextState) {
      return t.nextState;
    }
  }

  // Check parent composite state transitions (walk up hierarchy)
  function findParent(target: StateDef, current: StateDef): StateDef | null {
    for (const child of current.states ?? []) {
      if (child.name === target.name) return current;
      const found = findParent(target, child);
      if (found) return found;
    }
    return null;
  }

  let parent = findParent(state, root);
  while (parent) {
    for (const t of parent.transitions ?? []) {
      if (t.event === eventId && t.nextState) {
        return t.nextState;
      }
    }
    if (parent.name === root.name) break;
    parent = findParent(parent, root);
  }

  return null;
}

// ─── Machine store ───────────────────────────────────────────────────────────

const _machines = new Map<string, MachineInstance>();
let _idCounter = 0;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new machine instance from an SMDF definition.
 * Attempts smcraft runtime first; falls back to standalone.
 */
export async function createMachine(
  definition: StateMachineDefinition,
): Promise<MachineInstance> {
  const id = `machine_${Date.now()}_${++_idCounter}`;
  const initialState = findInitialLeaf(definition.state);
  const runtime = await getSmcraftRuntime();

  const instance: MachineInstance = {
    id,
    definition,
    currentState: initialState,
    stateHistory: [initialState],
    eventLog: [],
    isRunning: true,
    backend: runtime ? 'smcraft' : 'standalone',
  };

  _machines.set(id, instance);
  return instance;
}

/**
 * Fire an event on a machine instance and return the transition result.
 */
export function fireEvent(
  machine: MachineInstance,
  eventId: string,
  data?: Record<string, unknown>,
): TransitionResult {
  if (!machine.isRunning) {
    const event: StateMachineEvent = {
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventId,
      fromState: machine.currentState,
      toState: machine.currentState,
      payload: data,
    };
    return {
      success: false,
      previousState: machine.currentState,
      currentState: machine.currentState,
      event,
      error: 'Machine is not running',
    };
  }

  const previousState = machine.currentState;
  const currentStateDef = findStateByName(machine.definition.state, previousState);

  if (!currentStateDef) {
    const event: StateMachineEvent = {
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventId,
      fromState: previousState,
      toState: previousState,
      payload: data,
    };
    return {
      success: false,
      previousState,
      currentState: previousState,
      event,
      error: `State "${previousState}" not found in definition`,
    };
  }

  // Resolve transition
  const nextStateName = resolveTransition(currentStateDef, eventId, machine.definition.state);

  const toState = nextStateName ?? previousState;
  const event: StateMachineEvent = {
    id: `evt_${Date.now()}_${++_idCounter}`,
    timestamp: new Date().toISOString(),
    eventId,
    fromState: previousState,
    toState,
    payload: data,
  };

  machine.eventLog.push(event);

  if (nextStateName) {
    machine.currentState = nextStateName;
    machine.stateHistory.push(nextStateName);

    // Check if we reached a final state
    const nextDef = findStateByName(machine.definition.state, nextStateName);
    if (nextDef?.kind === 'final') {
      machine.isRunning = false;
    }
  }

  return {
    success: !!nextStateName,
    previousState,
    currentState: machine.currentState,
    event,
    error: nextStateName ? undefined : `No transition for event "${eventId}" from state "${previousState}"`,
  };
}

/**
 * Get the current state path (leaf state and its composite ancestors).
 */
export function getCurrentState(machine: MachineInstance): string[] {
  const path: string[] = [];

  function findPath(state: StateDef, target: string): boolean {
    if (state.name === target) {
      path.push(state.name);
      return true;
    }
    for (const child of state.states ?? []) {
      if (findPath(child, target)) {
        path.unshift(state.name);
        return true;
      }
    }
    return false;
  }

  findPath(machine.definition.state, machine.currentState);
  return path;
}

/**
 * Get a machine instance by ID.
 */
export function getMachine(id: string): MachineInstance | undefined {
  return _machines.get(id);
}

/**
 * Destroy a machine instance.
 */
export function destroyMachine(id: string): boolean {
  const machine = _machines.get(id);
  if (machine) {
    machine.isRunning = false;
    return _machines.delete(id);
  }
  return false;
}

/**
 * Check which runtime backend is available.
 */
export async function getRuntimeBackend(): Promise<'smcraft' | 'standalone'> {
  const runtime = await getSmcraftRuntime();
  return runtime ? 'smcraft' : 'standalone';
}
