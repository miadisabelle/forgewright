/**
 * Creative Process SMDF Template — the default machine for every session.
 *
 * Encodes Fritz's creative process as a hierarchical state machine:
 *   Root (CreativeProcess)
 *   ├── Germination (composite)
 *   │   ├── TaskDefinition
 *   │   ├── SpecGeneration
 *   │   └── PDEDecomposition
 *   ├── Assimilation (composite)
 *   │   ├── PlanGeneration
 *   │   ├── CodeImplementation
 *   │   └── IterativeRefinement
 *   └── Completion (composite)
 *       ├── Validation
 *       ├── Review
 *       └── Integration
 */

import type { StateMachineDefinition, StateDef, EventSourceDef, TransitionDef } from '../types/smdf';
import { EVENT_IDS } from './events';

// ─── Guard condition expressions ─────────────────────────────────────────────

const GUARDS = {
  tensionAboveThreshold: 'tensionLevel > 0.3',
  allStepsComplete: 'pendingSteps === 0',
  confidenceAboveThreshold: 'avgConfidence >= 0.7',
  reviewApproved: 'reviewDecision === "advance"',
  testsPass: 'validationResult === "pass"',
} as const;

// ─── Sub-state builders ──────────────────────────────────────────────────────

function germination(): StateDef {
  const taskDefinition: StateDef = {
    name: 'TaskDefinition',
    description: 'Define the creative intent and desired outcome',
    transitions: [
      {
        event: EVENT_IDS.ACTION_STEP_COMPLETED,
        nextState: 'SpecGeneration',
        description: 'Task defined → generate specifications',
      },
      {
        event: EVENT_IDS.AI_GENERATE,
        description: 'AI assists with task clarification',
      },
    ],
  };

  const specGeneration: StateDef = {
    name: 'SpecGeneration',
    description: 'Author RISE specifications from intent',
    transitions: [
      {
        event: EVENT_IDS.ACTION_STEP_COMPLETED,
        nextState: 'PDEDecomposition',
        description: 'Specs authored → decompose into action stack',
      },
      {
        event: EVENT_IDS.USER_EDIT,
        description: 'User refines specifications',
      },
    ],
  };

  const pdeDecomposition: StateDef = {
    name: 'PDEDecomposition',
    description: 'Structured plan emerges from PDE decomposition',
    transitions: [
      {
        event: EVENT_IDS.PHASE_ADVANCE,
        nextState: 'PlanGeneration',
        condition: GUARDS.allStepsComplete,
        description: 'All germination steps complete → advance to Assimilation',
      },
      {
        event: EVENT_IDS.PHASE_RETREAT,
        nextState: 'TaskDefinition',
        description: 'Decomposition reveals need to revisit task definition',
      },
    ],
  };

  return {
    name: 'Germination',
    description: 'Vision and inquiry — the seed of the creative process',
    states: [taskDefinition, specGeneration, pdeDecomposition],
    transitions: [
      {
        event: EVENT_IDS.MOMENT_OF_TRUTH,
        nextState: 'Assimilation',
        condition: GUARDS.allStepsComplete,
        description: 'Germination checkpoint — advance if ready',
      },
    ],
  };
}

function assimilation(): StateDef {
  const planGeneration: StateDef = {
    name: 'PlanGeneration',
    description: 'Transform action stack into implementation plan',
    transitions: [
      {
        event: EVENT_IDS.ACTION_STEP_COMPLETED,
        nextState: 'CodeImplementation',
        description: 'Plan generated → begin implementation',
      },
      {
        event: EVENT_IDS.AI_GENERATE,
        description: 'AI generates implementation plan',
      },
    ],
  };

  const codeImplementation: StateDef = {
    name: 'CodeImplementation',
    description: 'Agent execution cycles — the act of building',
    transitions: [
      {
        event: EVENT_IDS.ACTION_STEP_COMPLETED,
        nextState: 'IterativeRefinement',
        description: 'Implementation batch complete → refine',
      },
      {
        event: EVENT_IDS.AI_GENERATE,
        description: 'AI generates code artifacts',
      },
      {
        event: EVENT_IDS.USER_EDIT,
        description: 'Human edits generated code',
      },
      {
        event: EVENT_IDS.REALITY_UPDATED,
        description: 'Reality shifts during implementation',
      },
    ],
  };

  const iterativeRefinement: StateDef = {
    name: 'IterativeRefinement',
    description: 'Spiral advancement — refine toward desired outcome',
    transitions: [
      {
        event: EVENT_IDS.PHASE_ADVANCE,
        nextState: 'Validation',
        condition: GUARDS.confidenceAboveThreshold,
        description: 'Refinement sufficient → advance to Completion',
      },
      {
        event: EVENT_IDS.ACTION_STEP_COMPLETED,
        nextState: 'CodeImplementation',
        description: 'More implementation needed — spiral back',
      },
      {
        event: EVENT_IDS.PHASE_RETREAT,
        nextState: 'PlanGeneration',
        description: 'Fundamental plan issue → revisit plan',
      },
    ],
  };

  return {
    name: 'Assimilation',
    description: 'Planning and action — holding tension in the doing',
    states: [planGeneration, codeImplementation, iterativeRefinement],
    transitions: [
      {
        event: EVENT_IDS.MOMENT_OF_TRUTH,
        nextState: 'Completion',
        condition: GUARDS.confidenceAboveThreshold,
        description: 'Assimilation checkpoint — advance if confident',
      },
      {
        event: EVENT_IDS.TENSION_OSCILLATE,
        description: 'Oscillation detected — structural adjustment needed',
      },
    ],
  };
}

function completion(): StateDef {
  const validation: StateDef = {
    name: 'Validation',
    description: 'Tests and ceremony accountability check',
    transitions: [
      {
        event: EVENT_IDS.ACTION_STEP_COMPLETED,
        nextState: 'Review',
        condition: GUARDS.testsPass,
        description: 'Validation passes → human review',
      },
      {
        event: EVENT_IDS.PHASE_RETREAT,
        nextState: 'IterativeRefinement',
        description: 'Validation fails → return to refinement',
      },
    ],
  };

  const review: StateDef = {
    name: 'Review',
    description: 'Human-in-the-loop checkpoint — the moment of truth',
    transitions: [
      {
        event: EVENT_IDS.MOMENT_OF_TRUTH,
        nextState: 'Integration',
        condition: GUARDS.reviewApproved,
        description: 'Review approved → integrate',
      },
      {
        event: EVENT_IDS.PHASE_RETREAT,
        nextState: 'CodeImplementation',
        description: 'Review requests changes → back to implementation',
      },
      {
        event: EVENT_IDS.USER_EDIT,
        description: 'Human applies direct edits during review',
      },
    ],
  };

  const integration: StateDef = {
    name: 'Integration',
    kind: 'final',
    description: 'Archive, narrative chronicle, wisdom — giving back to community',
    transitions: [
      {
        event: EVENT_IDS.TENSION_RESOLVE,
        description: 'Desired outcome achieved — ceremony complete',
      },
    ],
  };

  return {
    name: 'Completion',
    description: 'Reflection and wisdom — integrating knowledge back',
    states: [validation, review, integration],
    transitions: [
      {
        event: EVENT_IDS.TENSION_RESOLVE,
        description: 'Creative process reaches final state',
      },
    ],
  };
}

// ─── Event source definition ─────────────────────────────────────────────────

function creativeProcessEvents(): EventSourceDef {
  return {
    name: 'CreativeProcessEvents',
    description: 'Events for the Fritz creative process state machine',
    events: [
      {
        id: EVENT_IDS.TENSION_ESTABLISHED,
        name: 'Tension Established',
        description: 'STC chart created — machine energized',
        parameters: [
          { name: 'chartId', type: 'string' },
          { name: 'tensionLevel', type: 'float' },
        ],
      },
      {
        id: EVENT_IDS.ACTION_STEP_COMPLETED,
        name: 'Action Step Completed',
        description: 'User or agent marks an action step done',
        parameters: [
          { name: 'stepId', type: 'string' },
          { name: 'confidence', type: 'float' },
        ],
      },
      {
        id: EVENT_IDS.REALITY_UPDATED,
        name: 'Reality Updated',
        description: 'Current reality reassessed — guard conditions re-evaluated',
        parameters: [
          { name: 'tensionDelta', type: 'float' },
        ],
      },
      {
        id: EVENT_IDS.PHASE_ADVANCE,
        name: 'Phase Advance',
        description: 'All sub-states in current phase resolved',
        parameters: [
          { name: 'fromPhase', type: 'string' },
          { name: 'toPhase', type: 'string' },
        ],
      },
      {
        id: EVENT_IDS.PHASE_RETREAT,
        name: 'Phase Retreat',
        description: 'User returns to earlier phase via history state',
        parameters: [
          { name: 'reason', type: 'string' },
        ],
      },
      {
        id: EVENT_IDS.AI_GENERATE,
        name: 'AI Generate',
        description: 'AI produces content within current sub-state',
        parameters: [
          { name: 'artifactType', type: 'string' },
        ],
      },
      {
        id: EVENT_IDS.USER_EDIT,
        name: 'User Edit',
        description: 'Human edits artifact — may trigger guard re-evaluation',
        parameters: [
          { name: 'artifactType', type: 'string' },
        ],
      },
      {
        id: EVENT_IDS.TENSION_RESOLVE,
        name: 'Tension Resolve',
        description: 'Desired outcome achieved — final state reached',
        parameters: [
          { name: 'chartId', type: 'string' },
        ],
      },
      {
        id: EVENT_IDS.TENSION_OSCILLATE,
        name: 'Tension Oscillate',
        description: 'Cycle detected — oscillating pattern flagged',
        parameters: [
          { name: 'visitCount', type: 'int' },
          { name: 'netProgress', type: 'int' },
        ],
      },
      {
        id: EVENT_IDS.WORKSPACE_FORK,
        name: 'Workspace Fork',
        description: 'Parallel state machine spawned from branch',
        parameters: [
          { name: 'newWorkspaceId', type: 'string' },
        ],
      },
      {
        id: EVENT_IDS.MOMENT_OF_TRUTH,
        name: 'Moment of Truth',
        description: 'Review checkpoint — guard evaluates advance, retreat, or adjust',
        parameters: [
          { name: 'decision', type: 'string' },
        ],
      },
    ],
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create the default Creative Process state machine definition.
 * This is the canonical machine instantiated for every workspace session.
 *
 * @param intent - The creative intent (becomes the machine name/description)
 */
export function createCreativeProcessMachine(intent: string): StateMachineDefinition {
  const rootState: StateDef = {
    name: 'CreativeProcess',
    description: intent,
    states: [germination(), assimilation(), completion()],
    transitions: [
      {
        event: EVENT_IDS.TENSION_ESTABLISHED,
        nextState: 'TaskDefinition',
        description: 'Tension established — enter Germination',
      },
      {
        event: EVENT_IDS.WORKSPACE_FORK,
        description: 'Fork spawns parallel machine',
      },
    ],
  };

  return {
    settings: {
      namespace: 'forgewright.creative',
      name: 'CreativeProcess',
      asynchronous: true,
    },
    events: [creativeProcessEvents()],
    state: rootState,
  };
}

/**
 * Get all state names in the creative process hierarchy (flat list).
 */
export function getCreativeProcessStateNames(): string[] {
  return [
    'CreativeProcess',
    'Germination', 'TaskDefinition', 'SpecGeneration', 'PDEDecomposition',
    'Assimilation', 'PlanGeneration', 'CodeImplementation', 'IterativeRefinement',
    'Completion', 'Validation', 'Review', 'Integration',
  ];
}

/**
 * Map a creative process state name to its parent phase.
 */
export function stateToPhase(stateName: string): 'germination' | 'assimilation' | 'completion' | null {
  const phaseMap: Record<string, 'germination' | 'assimilation' | 'completion'> = {
    Germination: 'germination',
    TaskDefinition: 'germination',
    SpecGeneration: 'germination',
    PDEDecomposition: 'germination',
    Assimilation: 'assimilation',
    PlanGeneration: 'assimilation',
    CodeImplementation: 'assimilation',
    IterativeRefinement: 'assimilation',
    Completion: 'completion',
    Validation: 'completion',
    Review: 'completion',
    Integration: 'completion',
  };
  return phaseMap[stateName] ?? null;
}
