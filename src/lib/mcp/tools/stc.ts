/**
 * stc/ MCP Tool Namespace — Structural Tension Chart operations.
 *
 * 3 tools: stc/create, stc/update, stc/assess
 *
 * Manages the creative tension between Desired Outcome and Current Reality.
 * Each chart holds action steps mapped to Medicine Wheel directions.
 *
 * Each tool follows the MCP handler pattern:
 *   parse input → execute logic → return { content: [{ type: 'text', text }] }
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { StructuralTensionChart, ActionStep } from '../../types/stc.js';
import type { DirectionName } from '../../types/directions.js';
import { DIRECTION_NAMES } from '../../types/directions.js';
import {
  withGuards,
  requireOcap,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '../guards.js';
import type { ToolDefinition } from './sm.js';

// ─── Session-scoped chart store ──────────────────────────────────────────────

const _charts = new Map<string, StructuralTensionChart>();

export function getChart(id: string): StructuralTensionChart | undefined {
  return _charts.get(id);
}

export function clearCharts(): void {
  _charts.clear();
}

// ─── Input Schemas ───────────────────────────────────────────────────────────

const StcCreateInputSchema = z.object({
  desiredOutcome: z.string().describe('The vision or goal — what you want to create'),
  currentReality: z.string().describe('Honest assessment of where things stand now'),
  actionSteps: z.array(z.string()).optional()
    .describe('Optional initial action step descriptions. Each becomes a pending step.'),
});

const StcUpdateInputSchema = z.object({
  chartId: z.string().describe('ID of the chart to update'),
  desiredOutcome: z.string().optional()
    .describe('Updated desired outcome (vision)'),
  currentReality: z.string().optional()
    .describe('Updated current reality assessment'),
});

const StcAssessInputSchema = z.object({
  chartId: z.string().describe('ID of the chart to assess'),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

const stcCreateDef: ToolDefinition = {
  name: 'stc/create',
  description: [
    'Create a new Structural Tension Chart.',
    'Captures the generative tension between desired outcome and current reality.',
    'Returns the chart with unique ID, tension level, and creative phase.',
  ].join(' '),
  inputSchema: StcCreateInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const stcUpdateDef: ToolDefinition = {
  name: 'stc/update',
  description: [
    'Update fields on an existing Structural Tension Chart.',
    'Can update desiredOutcome and/or currentReality.',
    'Automatically recalculates tension level. Returns the updated chart.',
  ].join(' '),
  inputSchema: StcUpdateInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: true },
};

const stcAssessDef: ToolDefinition = {
  name: 'stc/assess',
  description: [
    'Assess the structural tension of a chart.',
    'Computes tension level, progress toward desired outcome,',
    'direction balance across action steps, and creative phase.',
  ].join(' '),
  inputSchema: StcAssessInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIRECTION_CYCLE: readonly DirectionName[] = ['east', 'south', 'west', 'north'];

function assignDirection(index: number): DirectionName {
  return DIRECTION_CYCLE[index % DIRECTION_CYCLE.length];
}

function computeTensionLevel(chart: StructuralTensionChart): number {
  if (chart.actionSteps.length === 0) return 0.8;

  const total = chart.actionSteps.length;
  const done = chart.actionSteps.filter(s => s.status === 'done').length;
  const blocked = chart.actionSteps.filter(s => s.status === 'blocked').length;

  // Tension decreases as steps complete, increases when blocked
  const progress = done / total;
  const blockPenalty = (blocked / total) * 0.3;
  return Math.max(0, Math.min(1, 0.8 - progress * 0.7 + blockPenalty));
}

function computePhase(chart: StructuralTensionChart): 'germination' | 'assimilation' | 'completion' {
  if (chart.actionSteps.length === 0) return 'germination';

  const total = chart.actionSteps.length;
  const done = chart.actionSteps.filter(s => s.status === 'done').length;
  const progress = done / total;

  if (progress >= 0.8) return 'completion';
  if (progress >= 0.3) return 'assimilation';
  return 'germination';
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * stc/create handler — create a new structural tension chart.
 */
const handleStcCreate: ToolHandler = async (args, _ctx) => {
  const parsed = StcCreateInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for stc/create',
      issues: parsed.error.issues,
    });
  }

  const { desiredOutcome, currentReality, actionSteps } = parsed.data;
  const now = new Date().toISOString();

  const steps: ActionStep[] = (actionSteps ?? []).map((desc, i) => ({
    id: `step_${randomUUID().slice(0, 8)}`,
    description: desc,
    direction: assignDirection(i),
    status: 'pending' as const,
    confidence: 0.5,
    dependencies: [],
  }));

  const chart: StructuralTensionChart = {
    id: `stc_${randomUUID().slice(0, 12)}`,
    desiredOutcome,
    currentReality,
    actionSteps: steps,
    tensionLevel: 0.8,
    phase: 'germination',
    createdAt: now,
    updatedAt: now,
  };

  _charts.set(chart.id, chart);

  return mcpSuccess(chart);
};

/**
 * stc/update handler — update chart fields.
 */
const handleStcUpdate: ToolHandler = async (args, _ctx) => {
  const parsed = StcUpdateInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for stc/update',
      issues: parsed.error.issues,
    });
  }

  const { chartId, desiredOutcome, currentReality } = parsed.data;
  const chart = _charts.get(chartId);
  if (!chart) {
    return mcpError('chart_not_found', {
      message: `No STC chart found with ID "${chartId}"`,
      chartId,
    });
  }

  if (desiredOutcome !== undefined) chart.desiredOutcome = desiredOutcome;
  if (currentReality !== undefined) chart.currentReality = currentReality;

  chart.tensionLevel = computeTensionLevel(chart);
  chart.phase = computePhase(chart);
  chart.updatedAt = new Date().toISOString();

  return mcpSuccess(chart);
};

/**
 * stc/assess handler — assess structural tension and balance.
 */
const handleStcAssess: ToolHandler = async (args, _ctx) => {
  const parsed = StcAssessInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for stc/assess',
      issues: parsed.error.issues,
    });
  }

  const { chartId } = parsed.data;
  const chart = _charts.get(chartId);
  if (!chart) {
    return mcpError('chart_not_found', {
      message: `No STC chart found with ID "${chartId}"`,
      chartId,
    });
  }

  // Progress calculation
  const total = chart.actionSteps.length;
  const done = chart.actionSteps.filter(s => s.status === 'done').length;
  const inProgress = chart.actionSteps.filter(s => s.status === 'in_progress').length;
  const blocked = chart.actionSteps.filter(s => s.status === 'blocked').length;
  const pending = chart.actionSteps.filter(s => s.status === 'pending').length;
  const progress = total > 0 ? done / total : 0;

  // Direction balance
  const directionCoverage: Record<string, number> = { east: 0, south: 0, west: 0, north: 0 };
  for (const step of chart.actionSteps) {
    if (step.direction && step.direction in directionCoverage) {
      directionCoverage[step.direction]++;
    }
  }
  const representedDirections = DIRECTION_NAMES.filter(d => directionCoverage[d] > 0);
  const neglectedDirections = DIRECTION_NAMES.filter(d => directionCoverage[d] === 0);
  const directionBalance = representedDirections.length / 4;

  // Average confidence
  const avgConfidence = total > 0
    ? chart.actionSteps.reduce((sum, s) => sum + s.confidence, 0) / total
    : 0;

  return mcpSuccess({
    chartId: chart.id,
    desiredOutcome: chart.desiredOutcome,
    currentReality: chart.currentReality,
    tensionLevel: computeTensionLevel(chart),
    phase: computePhase(chart),
    progress: {
      total,
      done,
      inProgress,
      blocked,
      pending,
      percentage: Math.round(progress * 100),
    },
    directionBalance: {
      coverage: directionCoverage,
      representedDirections,
      neglectedDirections,
      balanceScore: directionBalance,
    },
    averageConfidence: Math.round(avgConfidence * 100) / 100,
  });
};

// ─── Guarded Handlers ────────────────────────────────────────────────────────

const guardedStcCreate = withGuards(
  [requireOcap('community'), auditLog('stc/create')],
  handleStcCreate,
);

const guardedStcUpdate = withGuards(
  [requireOcap('community'), auditLog('stc/update')],
  handleStcUpdate,
);

const guardedStcAssess = withGuards(
  [auditLog('stc/assess')],
  handleStcAssess,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  stcCreateDef,
  stcUpdateDef,
  stcAssessDef,
];

export const handlers: Record<string, ToolHandler> = {
  'stc/create': guardedStcCreate,
  'stc/update': guardedStcUpdate,
  'stc/assess': guardedStcAssess,
};

/** Register all stc/ tools on an McpServer instance. */
export function registerStcTools(server: {
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
