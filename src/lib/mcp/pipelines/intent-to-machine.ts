/**
 * pipeline/intent_to_machine — Compound MCP pipeline.
 *
 * Full chain: pde/decompose → stc/create (from plan) → sm/create (from STC)
 *
 * One tool call takes a raw prompt and produces:
 *   - PDE decomposition (Four Directions analysis, action stack)
 *   - Structural Tension Chart (desired outcome, action steps)
 *   - State Machine (SMDF definition, runtime instance)
 *
 * Returns { decompositionId, chartId, machineId, summary }
 */

import { z } from 'zod';
import { handlers as pdeHandlers } from '../tools/pde';
import { handlers as stcHandlers } from '../tools/stc';
import { handlers as smHandlers } from '../tools/sm';
import {
  withGuards,
  requireOcap,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '../guards';
import type { ToolDefinition } from '../tools/sm';

// ─── Input Schema ────────────────────────────────────────────────────────────

const IntentToMachineInputSchema = z.object({
  prompt: z.string().min(1)
    .describe('The intent or prompt to decompose and instantiate as a state machine'),
  workdir: z.string().optional()
    .describe('Working directory for .pde/ storage (defaults to cwd)'),
});

// ─── Tool Definition ─────────────────────────────────────────────────────────

export const intentToMachineDef: ToolDefinition = {
  name: 'pipeline/intent_to_machine',
  description: [
    'Compound pipeline: prompt → PDE decomposition → STC chart → state machine.',
    'Takes a raw intent string and chains pde/decompose, stc/create, and sm/create',
    'to produce a fully instantiated state machine from natural language.',
    'Returns decomposition ID, chart ID, machine ID, and a summary of the chain.',
  ].join(' '),
  inputSchema: IntentToMachineInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseToolResult(result: ToolResult): { data: Record<string, unknown> | null; error: string | null } {
  const text = result.content[0]?.text;
  if (!text) return { data: null, error: 'Empty tool result' };

  try {
    const parsed = JSON.parse(text);
    if (result.isError) {
      return { data: null, error: parsed.message ?? parsed.error ?? text };
    }
    return { data: parsed, error: null };
  } catch {
    return { data: null, error: text };
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const handleIntentToMachine: ToolHandler = async (args, ctx) => {
  const parsed = IntentToMachineInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for pipeline/intent_to_machine',
      issues: parsed.error.issues,
    });
  }

  const { prompt, workdir } = parsed.data;
  const stages: string[] = [];

  // ── Stage 1: PDE Decompose ───────────────────────────────────────────────
  const pdeDecompose = pdeHandlers['pde/decompose'];
  const pdeResult = await pdeDecompose(
    { prompt, mode: 'keyword', workdir, extractImplicit: true, mapDependencies: true },
    ctx,
  );

  const pde = parseToolResult(pdeResult);
  if (pde.error) {
    return mcpError('pipeline_stage_failed', {
      stage: 'pde/decompose',
      message: pde.error,
      completedStages: stages,
    });
  }
  stages.push('pde/decompose');

  const decompositionId = pde.data!.id as string;
  const actionStack = (pde.data!.actionStack as Array<{ description: string }>) ?? [];
  const leadDirection = pde.data!.leadDirection as string;

  // ── Stage 2: STC Create ──────────────────────────────────────────────────
  const stcCreate = stcHandlers['stc/create'];
  const actionDescriptions = actionStack.length > 0
    ? actionStack.map(a => a.description)
    : [`Decompose: ${prompt}`, `Implement: ${prompt}`, `Integrate: ${prompt}`];

  const stcResult = await stcCreate(
    {
      desiredOutcome: prompt,
      currentReality: `Intent captured via PDE decomposition (lead direction: ${leadDirection})`,
      actionSteps: actionDescriptions,
    },
    ctx,
  );

  const stc = parseToolResult(stcResult);
  if (stc.error) {
    return mcpError('pipeline_stage_failed', {
      stage: 'stc/create',
      message: stc.error,
      completedStages: stages,
      decompositionId,
    });
  }
  stages.push('stc/create');

  const chartId = stc.data!.id as string;
  const chart = stc.data!;

  // ── Stage 3: SM Create ───────────────────────────────────────────────────
  const smCreate = smHandlers['sm/create'];
  const smResult = await smCreate({ chart }, ctx);

  const sm = parseToolResult(smResult);
  if (sm.error) {
    return mcpError('pipeline_stage_failed', {
      stage: 'sm/create',
      message: sm.error,
      completedStages: stages,
      decompositionId,
      chartId,
    });
  }
  stages.push('sm/create');

  const machineId = sm.data!.machineId as string;

  // ── Pipeline Complete ────────────────────────────────────────────────────
  return mcpSuccess({
    decompositionId,
    chartId,
    machineId,
    summary: {
      prompt,
      leadDirection,
      actionStepCount: actionDescriptions.length,
      currentState: sm.data!.currentState,
      stages,
    },
  });
};

// ─── Guarded Handler ─────────────────────────────────────────────────────────

export const guardedIntentToMachine = withGuards(
  [requireOcap('community'), auditLog('pipeline/intent_to_machine')],
  handleIntentToMachine,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [intentToMachineDef];

export const handlers: Record<string, ToolHandler> = {
  'pipeline/intent_to_machine': guardedIntentToMachine,
};
