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
} from '../types/smdf';

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
// smcraft@0.3.0 ships a definition-driven interpreter (`Machine`, root
// export). Contract (locked in .fw/mission-smc/handoffs.md): construction
// auto-enters the initial leaf via first-child descent; send() resolves leaf
// upward, deepest declaring state wins; internal / target-is-current-state
// resolves handled-without-change; composite targets descend to their
// initial leaf; entering a final leaf sets done.

interface SmcraftSendResult {
  handled: boolean;
  changed: boolean;
  from: string;
  to: string;
  event: string;
  error?: string;
}

interface SmcraftMachineHandle {
  state: string;
  done: boolean;
  send: (eventId: string, payload?: Record<string, unknown>) => SmcraftSendResult;
  stop: () => void;
}

/** Guard predicate per the 0.3.0 contract — guards fail closed. */
export type GuardFn = (
  condition: string,
  payload: Record<string, unknown> | undefined,
  context: Record<string, unknown>,
) => boolean;

export interface CreateMachineOptions {
  /** Guard context; the default guard resolves Boolean(context[condition]). */
  context?: Record<string, unknown>;
  /** Custom guard evaluation; overrides the default context lookup. */
  guard?: GuardFn;
}

type SmcraftRuntime = {
  Machine: new (
    definition: StateMachineDefinition,
    options?: {
      name?: string;
      context?: Record<string, unknown>;
      guard?: GuardFn;
    },
  ) => SmcraftMachineHandle;
};

const defaultGuard: GuardFn = (condition, _payload, context) => Boolean(context[condition]);

let _smcraftRuntime: SmcraftRuntime | null = null;
let _smcraftAttempted = false;

async function getSmcraftRuntime(): Promise<SmcraftRuntime | null> {
  if (_smcraftAttempted) return _smcraftRuntime;
  _smcraftAttempted = true;
  try {
    const mod = 'smcraft';
    const imported = await import(/* webpackIgnore: true */ mod) as Partial<SmcraftRuntime>;
    _smcraftRuntime = typeof imported.Machine === 'function' ? (imported as SmcraftRuntime) : null;
  } catch {
    _smcraftRuntime = null;
  }
  return _smcraftRuntime;
}

// Live interpreter per instance, keyed by machine id. Kept outside
// MachineInstance so the exported shape stays serializable.
const _engines = new Map<string, SmcraftMachineHandle>();

// Standalone fallback keeps the same fail-closed guard semantics; per-machine
// guard + context live here, keyed by machine id.
const _guards = new Map<string, { guard: GuardFn; context: Record<string, unknown> }>();

// ─── Standalone Runtime ──────────────────────────────────────────────────────
// Lightweight runtime that tracks state transitions without smcraft dependency.

function findInitialLeaf(state: StateDef): string {
  if (state.states && state.states.length > 0) {
    return findInitialLeaf(state.states[0]);
  }
  return state.name;
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
  allows: (condition: string | undefined) => boolean,
): string | null {
  // Check current state's transitions
  for (const t of state.transitions ?? []) {
    if (t.event === eventId && t.nextState && allows(t.condition)) {
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
      if (t.event === eventId && t.nextState && allows(t.condition)) {
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
  options: CreateMachineOptions = {},
): Promise<MachineInstance> {
  const id = `machine_${Date.now()}_${++_idCounter}`;
  const runtime = await getSmcraftRuntime();

  let engine: SmcraftMachineHandle | null = null;
  if (runtime) {
    try {
      engine = new runtime.Machine(definition, {
        name: definition.settings.name,
        context: options.context,
        guard: options.guard,
      });
    } catch {
      // MachineDefinitionError (V001/V002/V006) — the lenient standalone
      // runtime still accepts the definition, so fall back rather than fail.
      engine = null;
    }
  }

  const initialState = engine ? engine.state : findInitialLeaf(definition.state);
  const instance: MachineInstance = {
    id,
    definition,
    currentState: initialState,
    stateHistory: [initialState],
    eventLog: [],
    isRunning: engine ? !engine.done : true,
    backend: engine ? 'smcraft' : 'standalone',
  };

  if (engine) _engines.set(id, engine);
  _guards.set(id, { guard: options.guard ?? defaultGuard, context: options.context ?? {} });
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

  // smcraft backend: the installed interpreter drives the transition and the
  // bridge mirrors its verdict. success means the leaf actually moved
  // (SendResult.changed); a handled-but-internal event reports why.
  const engine = _engines.get(machine.id);
  if (engine) {
    const result = engine.send(eventId, data);
    const event: StateMachineEvent = {
      id: `evt_${Date.now()}_${++_idCounter}`,
      timestamp: new Date().toISOString(),
      eventId,
      fromState: result.from,
      toState: result.to,
      payload: data,
    };
    machine.eventLog.push(event);

    if (result.changed) {
      machine.currentState = result.to;
      machine.stateHistory.push(result.to);
    }
    if (engine.done) machine.isRunning = false;

    return {
      success: result.changed,
      previousState: result.from,
      currentState: machine.currentState,
      event,
      error: result.changed
        ? undefined
        : result.error
          ?? (result.handled
            ? `Event "${eventId}" was internal — no state change`
            : `No transition for event "${eventId}" from state "${result.from}"`),
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

  // Resolve transition. Contract alignment with the smcraft interpreter:
  // a composite target descends to its initial leaf, and a transition that
  // lands on the current state is internal — handled, but success (= the
  // leaf actually moved) is false.
  const guardEntry = _guards.get(machine.id) ?? { guard: defaultGuard, context: {} };
  const allows = (condition: string | undefined): boolean =>
    condition === undefined || guardEntry.guard(condition, data, guardEntry.context);
  const nextStateName = resolveTransition(currentStateDef, eventId, machine.definition.state, allows);
  const targetDef = nextStateName
    ? findStateByName(machine.definition.state, nextStateName)
    : null;
  const landedState = targetDef ? findInitialLeaf(targetDef) : nextStateName ?? previousState;
  const changed = nextStateName !== null && landedState !== previousState;

  const event: StateMachineEvent = {
    id: `evt_${Date.now()}_${++_idCounter}`,
    timestamp: new Date().toISOString(),
    eventId,
    fromState: previousState,
    toState: landedState,
    payload: data,
  };

  machine.eventLog.push(event);

  if (changed) {
    machine.currentState = landedState;
    machine.stateHistory.push(landedState);

    // Check if we reached a final state
    const landedDef = findStateByName(machine.definition.state, landedState);
    if (landedDef?.kind === 'final') {
      machine.isRunning = false;
    }
  }

  return {
    success: changed,
    previousState,
    currentState: machine.currentState,
    event,
    error: changed
      ? undefined
      : nextStateName
        ? `Event "${eventId}" was internal — no state change`
        : `No transition for event "${eventId}" from state "${previousState}"`,
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
  const engine = _engines.get(id);
  if (engine) {
    engine.stop(); // release timers per the 0.3.0 contract
    _engines.delete(id);
  }
  _guards.delete(id);
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
