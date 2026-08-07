/**
 * STCStateAdapter — bridges Structural Tension Charts to SMDF state machines.
 *
 * The core equivalence: STC IS a state machine. This adapter doesn't
 * "translate" between metaphors — it instantiates the same reality
 * in two complementary representations.
 *
 * STC → SMDF: creative phases become composite states, action steps
 *              become sub-states, dependencies become transitions.
 * SMDF → STC: reverse mapping preserves structural tension semantics.
 * Sync: bidirectional sync when either representation is edited.
 */

import type { StructuralTensionChart, ActionStep, CreativePhase } from '../types/stc';
import type {
  StateMachineDefinition,
  StateDef,
  TransitionDef,
  EventSourceDef,
} from '../types/smdf';
import { EVENT_IDS } from './events';
import { createCreativeProcessMachine, stateToPhase } from './creative-process';

// ─── Phase → Composite State Mapping ─────────────────────────────────────────

const PHASE_NAMES: Record<CreativePhase, string> = {
  germination: 'Germination',
  assimilation: 'Assimilation',
  completion: 'Completion',
};

const PHASE_ORDER: CreativePhase[] = ['germination', 'assimilation', 'completion'];

/**
 * Initial atomic state: structural tension held, germination not yet begun.
 * The machine rests here after auto-entering the initial leaf (smcraft@0.2.0
 * contract: first-child descent at construction), so `tension_established`
 * is a REAL transition out — not a self-transition onto the state the
 * machine already occupies. Fritz semantics: germination begins WHEN
 * tension is established.
 */
export const TENSION_FIELD_STATE = 'TensionField';

const PHASE_DESCRIPTIONS: Record<CreativePhase, string> = {
  germination: 'Vision and inquiry — the seed of the creative process',
  assimilation: 'Planning and action — holding tension in the doing',
  completion: 'Reflection and wisdom — integrating knowledge back',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stepToStateName(step: ActionStep): string {
  // Create a PascalCase state name from step description
  return step.id.replace(/[^a-zA-Z0-9]/g, '_')
    .split('_')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

function groupStepsByPhase(steps: ActionStep[]): Record<CreativePhase, ActionStep[]> {
  const groups: Record<CreativePhase, ActionStep[]> = {
    germination: [],
    assimilation: [],
    completion: [],
  };

  for (const step of steps) {
    // Use step.direction to infer phase, or fall back to heuristic
    const phase = directionToPhase(step.direction) ?? inferPhaseFromIndex(steps, step);
    groups[phase].push(step);
  }

  // Ensure no phase is empty — at least one placeholder
  for (const phase of PHASE_ORDER) {
    if (groups[phase].length === 0) {
      groups[phase].push({
        id: `placeholder_${phase}`,
        description: `${PHASE_NAMES[phase]} phase`,
        status: 'pending',
        confidence: 0.5,
        dependencies: [],
      });
    }
  }

  return groups;
}

function directionToPhase(direction?: string): CreativePhase | null {
  if (!direction) return null;
  const map: Record<string, CreativePhase> = {
    east: 'germination',
    south: 'assimilation',
    west: 'assimilation',
    north: 'completion',
  };
  return map[direction] ?? null;
}

function inferPhaseFromIndex(allSteps: ActionStep[], step: ActionStep): CreativePhase {
  const idx = allSteps.indexOf(step);
  const total = allSteps.length;
  if (total <= 1) return 'germination';
  const ratio = idx / (total - 1);
  if (ratio < 0.33) return 'germination';
  if (ratio < 0.67) return 'assimilation';
  return 'completion';
}

// ─── STC → SMDF ──────────────────────────────────────────────────────────────

/**
 * Convert a StructuralTensionChart to a StateMachineDefinition.
 * Maps creative phases to composite states, action steps to sub-states,
 * and dependencies to transitions.
 */
export function stcToSMDF(chart: StructuralTensionChart): StateMachineDefinition {
  const grouped = groupStepsByPhase(chart.actionSteps);

  // Build composite states for each phase
  const phaseStates: StateDef[] = PHASE_ORDER.map((phase, phaseIdx) => {
    const steps = grouped[phase];

    // Convert each step to a sub-state with transitions
    const subStates: StateDef[] = steps.map((step, stepIdx) => {
      const transitions: TransitionDef[] = [];

      // Transition to next step in same phase
      if (stepIdx < steps.length - 1) {
        transitions.push({
          event: EVENT_IDS.ACTION_STEP_COMPLETED,
          nextState: stepToStateName(steps[stepIdx + 1]),
          description: `Step complete → ${steps[stepIdx + 1].description}`,
        });
      }

      // Last step in phase: transition to next phase's first step
      if (stepIdx === steps.length - 1 && phaseIdx < PHASE_ORDER.length - 1) {
        const nextPhase = PHASE_ORDER[phaseIdx + 1];
        const nextPhaseFirstStep = grouped[nextPhase][0];
        transitions.push({
          event: EVENT_IDS.PHASE_ADVANCE,
          nextState: stepToStateName(nextPhaseFirstStep),
          description: `Phase complete → advance to ${PHASE_NAMES[nextPhase]}`,
        });
      }

      // Last step of last phase: final transition
      if (stepIdx === steps.length - 1 && phaseIdx === PHASE_ORDER.length - 1) {
        transitions.push({
          event: EVENT_IDS.TENSION_RESOLVE,
          description: 'Desired outcome achieved',
        });
      }

      // Dependency-based transitions: steps this one depends on
      for (const depId of step.dependencies) {
        const depStep = chart.actionSteps.find(s => s.id === depId);
        if (depStep) {
          transitions.push({
            event: EVENT_IDS.ACTION_STEP_COMPLETED,
            condition: `step_${depId}_complete`,
            description: `Dependency: ${depStep.description}`,
          });
        }
      }

      // Internal events
      transitions.push(
        { event: EVENT_IDS.AI_GENERATE, description: 'AI assists with this step' },
        { event: EVENT_IDS.USER_EDIT, description: 'Human edits artifacts' },
      );

      const isFinal = phaseIdx === PHASE_ORDER.length - 1 && stepIdx === steps.length - 1;

      return {
        name: stepToStateName(step),
        kind: isFinal ? 'final' as const : undefined,
        description: step.description,
        onEntry: {
          actions: [{ code: `log("Entering: ${step.description.replace(/"/g, '\\"')}")` }],
        },
        transitions,
      };
    });

    return {
      name: PHASE_NAMES[phase],
      description: PHASE_DESCRIPTIONS[phase],
      states: subStates,
    };
  });

  // Build event source from chart events
  const eventSource: EventSourceDef = {
    name: 'STCEvents',
    description: `Events for STC: ${chart.desiredOutcome}`,
    events: [
      {
        id: EVENT_IDS.TENSION_ESTABLISHED,
        name: 'Tension Established',
        parameters: [{ name: 'chartId', type: 'string' }, { name: 'tensionLevel', type: 'float' }],
      },
      {
        id: EVENT_IDS.ACTION_STEP_COMPLETED,
        name: 'Action Step Completed',
        parameters: [{ name: 'stepId', type: 'string' }, { name: 'confidence', type: 'float' }],
      },
      {
        id: EVENT_IDS.REALITY_UPDATED,
        name: 'Reality Updated',
        parameters: [{ name: 'tensionDelta', type: 'float' }],
      },
      {
        id: EVENT_IDS.PHASE_ADVANCE,
        name: 'Phase Advance',
        parameters: [{ name: 'fromPhase', type: 'string' }, { name: 'toPhase', type: 'string' }],
      },
      {
        id: EVENT_IDS.PHASE_RETREAT,
        name: 'Phase Retreat',
        parameters: [{ name: 'reason', type: 'string' }],
      },
      {
        id: EVENT_IDS.AI_GENERATE,
        name: 'AI Generate',
        parameters: [{ name: 'artifactType', type: 'string' }],
      },
      {
        id: EVENT_IDS.USER_EDIT,
        name: 'User Edit',
        parameters: [{ name: 'artifactType', type: 'string' }],
      },
      {
        id: EVENT_IDS.TENSION_RESOLVE,
        name: 'Tension Resolve',
        parameters: [{ name: 'chartId', type: 'string' }],
      },
      {
        id: EVENT_IDS.TENSION_OSCILLATE,
        name: 'Tension Oscillate',
        parameters: [{ name: 'visitCount', type: 'int' }],
      },
      {
        id: EVENT_IDS.WORKSPACE_FORK,
        name: 'Workspace Fork',
        parameters: [{ name: 'newWorkspaceId', type: 'string' }],
      },
      {
        id: EVENT_IDS.MOMENT_OF_TRUTH,
        name: 'Moment of Truth',
        parameters: [{ name: 'decision', type: 'string' }],
      },
    ],
  };

  // Root state. TensionField is the first child, so construction lands there
  // and tension_established leaves it; the event lives ONLY on TensionField —
  // on the root it would also fire from any later state via the ancestor walk
  // and yank the machine back to Germination (oscillation, not advancement).
  const rootState: StateDef = {
    name: 'CreativeProcess',
    description: `STC: ${chart.desiredOutcome}`,
    states: [
      {
        name: TENSION_FIELD_STATE,
        description: 'Structural tension held — germination not yet begun',
        transitions: [
          {
            event: EVENT_IDS.TENSION_ESTABLISHED,
            nextState: stepToStateName(grouped.germination[0]),
            description: 'Tension established — enter Germination',
          },
        ],
      },
      ...phaseStates,
    ],
  };

  return {
    settings: {
      namespace: 'forgewright.stc',
      name: `STC_${chart.id}`,
      asynchronous: true,
    },
    events: [eventSource],
    state: rootState,
  };
}

// ─── SMDF → STC ──────────────────────────────────────────────────────────────

/**
 * Convert a StateMachineDefinition back to a StructuralTensionChart.
 * Reconstructs creative phases from composite states and action steps
 * from leaf states.
 */
export function smdfToSTC(definition: StateMachineDefinition): StructuralTensionChart {
  const root = definition.state;
  const now = new Date().toISOString();

  // Extract desired outcome from root description
  const desiredOutcome = root.description?.replace(/^STC:\s*/, '') ?? root.name;

  // Collect leaf states as action steps, grouped by phase
  const actionSteps: ActionStep[] = [];
  let currentPhase: CreativePhase = 'germination';

  function walkStates(states: StateDef[], parentPhase: CreativePhase | null): void {
    for (const state of states) {
      // TensionField is machine scaffolding, not an action step — excluding it
      // keeps STC → SMDF → STC round-trips lossless.
      if (state.name === TENSION_FIELD_STATE) continue;

      // Determine phase from state name
      const phase = stateToPhase(state.name) as CreativePhase | null ?? parentPhase;

      if (state.states && state.states.length > 0) {
        // Composite state — recurse
        walkStates(state.states, phase);
      } else {
        // Leaf state — convert to action step
        const step: ActionStep = {
          id: state.name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
          description: state.description ?? state.name,
          direction: phaseToDirection(phase),
          status: state.kind === 'final' ? 'done' : 'pending',
          confidence: 0.8,
          dependencies: extractDependencies(state),
        };
        actionSteps.push(step);
        if (phase) currentPhase = phase;
      }
    }
  }

  if (root.states) {
    walkStates(root.states, null);
  }

  // Calculate tension level from state machine structure
  const totalStates = actionSteps.length;
  const doneStates = actionSteps.filter(s => s.status === 'done').length;
  const tensionLevel = totalStates > 0 ? 1 - (doneStates / totalStates) : 0.5;

  return {
    id: definition.settings.name?.replace(/^STC_/, '') ?? `stc_${Date.now()}`,
    desiredOutcome,
    currentReality: `State machine with ${totalStates} states across 3 phases`,
    actionSteps,
    tensionLevel,
    phase: currentPhase,
    createdAt: now,
    updatedAt: now,
  };
}

function phaseToDirection(phase: CreativePhase | null): 'east' | 'south' | 'west' | 'north' | undefined {
  if (!phase) return undefined;
  const map: Record<CreativePhase, 'east' | 'south' | 'north'> = {
    germination: 'east',
    assimilation: 'south',
    completion: 'north',
  };
  return map[phase];
}

function extractDependencies(state: StateDef): string[] {
  const deps: string[] = [];
  for (const t of state.transitions ?? []) {
    if (t.condition && t.condition.startsWith('step_') && t.condition.endsWith('_complete')) {
      const depId = t.condition.replace(/^step_/, '').replace(/_complete$/, '');
      deps.push(depId);
    }
  }
  return deps;
}

// ─── Bidirectional Sync ──────────────────────────────────────────────────────

export interface SyncResult {
  chart: StructuralTensionChart;
  definition: StateMachineDefinition;
  changes: SyncChange[];
}

export interface SyncChange {
  source: 'stc' | 'smdf';
  type: 'step_added' | 'step_removed' | 'step_status_changed' | 'state_added' | 'state_removed' | 'phase_changed';
  description: string;
}

/**
 * Synchronize changes between an STC chart and its corresponding SMDF definition.
 * Compares both representations and produces a unified result.
 */
export function syncChanges(
  chart: StructuralTensionChart,
  definition: StateMachineDefinition,
): SyncResult {
  const changes: SyncChange[] = [];

  // Convert both to get "other side's view"
  const chartFromDef = smdfToSTC(definition);
  const defFromChart = stcToSMDF(chart);

  // Detect steps in chart not in definition
  const defStepIds = new Set(chartFromDef.actionSteps.map(s => s.id));
  for (const step of chart.actionSteps) {
    const normalizedId = step.id.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (!defStepIds.has(step.id) && !defStepIds.has(normalizedId)) {
      changes.push({
        source: 'stc',
        type: 'step_added',
        description: `Step "${step.description}" exists in STC but not in SMDF`,
      });
    }
  }

  // Detect states in definition not in chart
  const chartStepDescs = new Set(chart.actionSteps.map(s => s.description));
  for (const step of chartFromDef.actionSteps) {
    if (!chartStepDescs.has(step.description)) {
      changes.push({
        source: 'smdf',
        type: 'state_added',
        description: `State "${step.description}" exists in SMDF but not in STC`,
      });
    }
  }

  // Detect status changes
  for (const chartStep of chart.actionSteps) {
    const defStep = chartFromDef.actionSteps.find(s =>
      s.description === chartStep.description || s.id === chartStep.id
    );
    if (defStep && defStep.status !== chartStep.status) {
      changes.push({
        source: 'stc',
        type: 'step_status_changed',
        description: `Step "${chartStep.description}": STC=${chartStep.status}, SMDF=${defStep.status}`,
      });
    }
  }

  // Detect phase changes
  if (chart.phase !== chartFromDef.phase) {
    changes.push({
      source: 'stc',
      type: 'phase_changed',
      description: `Phase mismatch: STC=${chart.phase}, SMDF-derived=${chartFromDef.phase}`,
    });
  }

  // Produce unified result: STC is source of truth for content, SMDF for structure
  const unifiedDef = changes.some(c => c.source === 'stc')
    ? defFromChart  // STC had changes → regenerate SMDF from chart
    : definition;   // SMDF was authoritative

  const unifiedChart = changes.some(c => c.source === 'smdf' && !changes.some(cc => cc.source === 'stc'))
    ? chartFromDef   // SMDF had changes and STC didn't → update chart from def
    : chart;         // STC was authoritative

  return {
    chart: { ...unifiedChart, updatedAt: new Date().toISOString() },
    definition: unifiedDef,
    changes,
  };
}
