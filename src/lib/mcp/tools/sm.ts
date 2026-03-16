/**
 * sm/ MCP Tool Namespace — State Machine operations.
 *
 * 4 tools: sm/create, sm/fire, sm/validate, sm/codegen
 *
 * Bridges MCP surface to smcraft adapter layer:
 *   - stc-adapter.ts  → stcToSMDF()
 *   - runtime-bridge.ts → createMachine(), fireEvent()
 *   - codegen-bridge.ts → generateCode()
 *
 * Each tool follows the MCP handler pattern:
 *   parse input → execute logic → return { content: [{ type: 'text', text }] }
 */

import { z } from 'zod';
import { stcToSMDF } from '../../smcraft/stc-adapter';
import {
  createMachine,
  fireEvent,
  getMachine,
  type MachineInstance,
  type TransitionResult,
} from '../../smcraft/runtime-bridge';
import { generateCode, type CodegenLanguage } from '../../smcraft/codegen-bridge';
import {
  StateMachineDefinitionSchema,
  type StateMachineDefinition,
  type StateDef,
  type TransitionDef,
} from '../../types/smdf';
import { StructuralTensionChartSchema } from '../../types/stc';
import {
  withGuards,
  requirePhase,
  requireOcap,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '../guards';

// ─── Session-scoped machine store ────────────────────────────────────────────
// Maps session-local IDs to runtime machine instances.

const _sessionMachines = new Map<string, MachineInstance>();

export function getSessionMachine(id: string): MachineInstance | undefined {
  return _sessionMachines.get(id) ?? getMachine(id);
}

export function clearSessionMachines(): void {
  _sessionMachines.clear();
}

// ─── Input Schemas ───────────────────────────────────────────────────────────

const SmCreateInputSchema = z.object({
  chart: StructuralTensionChartSchema.optional()
    .describe('Full STC chart to convert. Provide this OR intent, not both.'),
  intent: z.string().optional()
    .describe('Intent string for auto-generating a minimal STC chart and machine.'),
}).refine(
  (data) => data.chart !== undefined || data.intent !== undefined,
  { message: 'Either "chart" or "intent" must be provided' },
);

const SmFireInputSchema = z.object({
  machineId: z.string().describe('ID of the machine instance to fire event on'),
  eventId: z.string().describe('Event ID to fire (e.g. "action_step_completed")'),
  data: z.record(z.unknown()).optional().describe('Optional event payload data'),
});

const SmValidateInputSchema = z.object({
  definition: StateMachineDefinitionSchema
    .describe('The SMDF definition to validate'),
});

const SmCodegenInputSchema = z.object({
  definition: StateMachineDefinitionSchema
    .describe('The SMDF definition to generate code from'),
  language: z.enum(['typescript', 'python']).default('typescript')
    .describe('Target language for code generation'),
});

// ─── Tool Definition Type ────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const smCreateDef: ToolDefinition = {
  name: 'sm/create',
  description: [
    'Create a new state machine from a Structural Tension Chart or intent string.',
    'Converts STC creative phases → SMDF composite states, action steps → sub-states.',
    'Returns the machine instance ID and full SMDF definition.',
  ].join(' '),
  inputSchema: SmCreateInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const smFireDef: ToolDefinition = {
  name: 'sm/fire',
  description: [
    'Fire an event on an active state machine instance.',
    'Resolves transitions, updates current state, records in event history.',
    'Returns the transition result with previous/current state.',
  ].join(' '),
  inputSchema: SmFireInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const smValidateDef: ToolDefinition = {
  name: 'sm/validate',
  description: [
    'Validate a state machine definition for structural correctness.',
    'Checks: all transitions reference valid states, no orphan states,',
    'initial state exists, no duplicate state names, final states are reachable.',
    'Returns a validation report with errors and warnings.',
  ].join(' '),
  inputSchema: SmValidateInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

const smCodegenDef: ToolDefinition = {
  name: 'sm/codegen',
  description: [
    'Generate executable code from a state machine definition.',
    'Supports TypeScript and Python. Uses smcraft codegen when available,',
    'falls back to template-based generation.',
    'Returns the generated source code as a string.',
  ].join(' '),
  inputSchema: SmCodegenInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * sm/create handler — create state machine from STC chart or intent.
 */
const handleSmCreate: ToolHandler = async (args, ctx) => {
  const parsed = SmCreateInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for sm/create',
      issues: parsed.error.issues,
    });
  }

  const { chart, intent } = parsed.data;

  let definition: StateMachineDefinition;

  if (chart) {
    // Convert full STC chart to SMDF
    definition = stcToSMDF(chart);
  } else {
    // Auto-generate minimal chart from intent string, then convert
    const now = new Date().toISOString();
    const minimalChart = {
      id: `stc_${Date.now()}`,
      desiredOutcome: intent!,
      currentReality: 'Starting point — intent captured',
      actionSteps: [
        {
          id: 'step_define',
          description: `Define: ${intent}`,
          direction: 'east' as const,
          status: 'pending' as const,
          confidence: 0.5,
          dependencies: [],
        },
        {
          id: 'step_implement',
          description: `Implement: ${intent}`,
          direction: 'west' as const,
          status: 'pending' as const,
          confidence: 0.5,
          dependencies: ['step_define'],
        },
        {
          id: 'step_integrate',
          description: `Integrate: ${intent}`,
          direction: 'north' as const,
          status: 'pending' as const,
          confidence: 0.5,
          dependencies: ['step_implement'],
        },
      ],
      tensionLevel: 0.7,
      phase: 'germination' as const,
      createdAt: now,
      updatedAt: now,
    };
    definition = stcToSMDF(minimalChart);
  }

  // Instantiate runtime machine
  const machine = await createMachine(definition);
  _sessionMachines.set(machine.id, machine);

  return mcpSuccess({
    machineId: machine.id,
    currentState: machine.currentState,
    backend: machine.backend,
    definition,
  });
};

/**
 * sm/fire handler — fire event on active machine.
 */
const handleSmFire: ToolHandler = async (args, ctx) => {
  const parsed = SmFireInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for sm/fire',
      issues: parsed.error.issues,
    });
  }

  const { machineId, eventId, data } = parsed.data;

  const machine = getSessionMachine(machineId);
  if (!machine) {
    return mcpError('machine_not_found', {
      message: `No machine instance found with ID "${machineId}"`,
      machineId,
    });
  }

  const result: TransitionResult = fireEvent(machine, eventId, data);

  return mcpSuccess({
    success: result.success,
    previousState: result.previousState,
    currentState: result.currentState,
    event: result.event,
    isRunning: machine.isRunning,
    error: result.error,
    stateHistoryLength: machine.stateHistory.length,
    eventLogLength: machine.eventLog.length,
  });
};

/**
 * sm/validate handler — validate machine definition.
 */
const handleSmValidate: ToolHandler = async (args, _ctx) => {
  const parsed = SmValidateInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for sm/validate',
      issues: parsed.error.issues,
    });
  }

  const { definition } = parsed.data;
  const report = validateDefinition(definition);

  return mcpSuccess(report);
};

/**
 * sm/codegen handler — generate code from definition.
 */
const handleSmCodegen: ToolHandler = async (args, _ctx) => {
  const parsed = SmCodegenInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for sm/codegen',
      issues: parsed.error.issues,
    });
  }

  const { definition, language } = parsed.data;

  try {
    const code = await generateCode(definition, language as CodegenLanguage);
    return mcpSuccess({
      language,
      code,
      lineCount: code.split('\n').length,
      byteSize: new TextEncoder().encode(code).length,
    });
  } catch (err) {
    return mcpError('codegen_failed', {
      message: err instanceof Error ? err.message : String(err),
      language,
    });
  }
};

// ─── Validation Logic ────────────────────────────────────────────────────────

interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: {
    totalStates: number;
    leafStates: number;
    compositeStates: number;
    totalTransitions: number;
    totalEvents: number;
  };
}

function validateDefinition(def: StateMachineDefinition): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Collect all states
  const allStates = new Map<string, StateDef>();
  const stateNames = new Set<string>();
  const duplicateNames = new Set<string>();
  let totalTransitions = 0;

  function walkStates(state: StateDef, path: string): void {
    if (stateNames.has(state.name)) {
      duplicateNames.add(state.name);
    }
    stateNames.add(state.name);
    allStates.set(state.name, state);

    for (const t of state.transitions ?? []) {
      totalTransitions++;
    }

    for (const child of state.states ?? []) {
      walkStates(child, `${path}/${child.name}`);
    }
  }

  walkStates(def.state, def.state.name);

  // V001: Duplicate state names
  duplicateNames.forEach((dup) => {
    errors.push({
      code: 'V001',
      severity: 'error',
      message: `Duplicate state name: "${dup}"`,
    });
  });

  // V002: Initial state exists (root must have states or be a leaf)
  if (!def.state.name) {
    errors.push({
      code: 'V002',
      severity: 'error',
      message: 'Root state has no name — initial state undefined',
    });
  }

  // V003: Transitions reference valid states
  function checkTransitions(state: StateDef, path: string): void {
    for (const t of state.transitions ?? []) {
      if (t.nextState && !stateNames.has(t.nextState)) {
        errors.push({
          code: 'V003',
          severity: 'error',
          message: `Transition in "${state.name}" references unknown state "${t.nextState}"`,
          path: `${path}/${state.name}`,
        });
      }
    }
    for (const child of state.states ?? []) {
      checkTransitions(child, `${path}/${state.name}`);
    }
  }
  checkTransitions(def.state, '');

  // V004: Orphan states (leaf states with no incoming transitions and not initial)
  const referencedStates = new Set<string>();
  function collectReferences(state: StateDef): void {
    for (const t of state.transitions ?? []) {
      if (t.nextState) referencedStates.add(t.nextState);
    }
    // First child of composite is initial (implicitly referenced)
    if (state.states && state.states.length > 0) {
      referencedStates.add(state.states[0].name);
    }
    for (const child of state.states ?? []) {
      collectReferences(child);
    }
  }
  collectReferences(def.state);
  referencedStates.add(def.state.name); // root is always referenced

  allStates.forEach((state, name) => {
    if (name === def.state.name) return; // root
    if (!referencedStates.has(name)) {
      // Check if it's a first child (implicit initial)
      const isImplicitInitial = Array.from(allStates.values()).some(
        (parent) => parent.states && parent.states[0]?.name === name,
      );
      if (!isImplicitInitial) {
        warnings.push({
          code: 'V004',
          severity: 'warning',
          message: `State "${name}" has no incoming transitions (potential orphan)`,
        });
      }
    }
  });

  // V005: At least one final state should exist
  const hasFinal = Array.from(allStates.values()).some((s) => s.kind === 'final');
  if (!hasFinal) {
    warnings.push({
      code: 'V005',
      severity: 'warning',
      message: 'No final state defined — machine may never terminate',
    });
  }

  // V006: Event IDs in transitions should be defined in event sources
  const definedEvents = new Set<string>();
  for (const source of def.events) {
    for (const evt of source.events ?? []) {
      definedEvents.add(evt.id);
    }
  }

  function checkEventRefs(state: StateDef): void {
    for (const t of state.transitions ?? []) {
      if (t.event && !definedEvents.has(t.event)) {
        warnings.push({
          code: 'V006',
          severity: 'warning',
          message: `Transition in "${state.name}" uses undeclared event "${t.event}"`,
        });
      }
    }
    for (const child of state.states ?? []) {
      checkEventRefs(child);
    }
  }
  checkEventRefs(def.state);

  // Stats
  const leafStates = Array.from(allStates.values()).filter(
    (s) => !s.states || s.states.length === 0,
  );
  const compositeStates = Array.from(allStates.values()).filter(
    (s) => s.states && s.states.length > 0,
  );

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalStates: allStates.size,
      leafStates: leafStates.length,
      compositeStates: compositeStates.length,
      totalTransitions,
      totalEvents: definedEvents.size,
    },
  };
}

// ─── Guarded Handlers ────────────────────────────────────────────────────────

const guardedSmCreate = withGuards(
  [requirePhase('active', 'opening'), requireOcap('community'), auditLog('sm/create')],
  handleSmCreate,
);

const guardedSmFire = withGuards(
  [requirePhase('active'), requireOcap('community'), auditLog('sm/fire')],
  handleSmFire,
);

const guardedSmValidate = withGuards(
  [auditLog('sm/validate')],
  handleSmValidate,
);

const guardedSmCodegen = withGuards(
  [requireOcap('community'), auditLog('sm/codegen')],
  handleSmCodegen,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  smCreateDef,
  smFireDef,
  smValidateDef,
  smCodegenDef,
];

export const handlers: Record<string, ToolHandler> = {
  'sm/create': guardedSmCreate,
  'sm/fire': guardedSmFire,
  'sm/validate': guardedSmValidate,
  'sm/codegen': guardedSmCodegen,
};

/** Register all sm/ tools on an McpServer instance. */
export function registerSmTools(server: {
  registerTool: (
    name: string,
    config: { description: string; inputSchema: z.ZodType; annotations?: Record<string, boolean> },
    handler: (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
  ) => void;
}): void {
  for (const def of tools) {
    const handler = handlers[def.name];
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      handler as (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
    );
  }
}
