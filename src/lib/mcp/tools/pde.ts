/**
 * pde/ MCP Tool Namespace — Prompt Decomposition Engine.
 *
 * 4 tools: pde/decompose, pde/get, pde/list, pde/export
 *
 * Bridges MCP surface to the PDE 4-stage pipeline:
 *   - decompose (EAST)  → enrich (SOUTH)  → assess (WEST)  → plan (NORTH)
 *   - storage.ts         → .pde/ persistence layer
 *
 * Each tool follows the MCP handler pattern:
 *   parse input → execute logic → return { content: [{ type: 'text', text }] }
 */

import { z } from 'zod';
import { runPipeline } from '../../pde/pipeline';
import { load, list, renderMarkdown } from '../../pde/storage';
import type { ToolDefinition } from './sm';
import {
  withGuards,
  requireOcap,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
} from '../guards';

// ─── Input Schemas ───────────────────────────────────────────────────────────

const PdeDecomposeInputSchema = z.object({
  prompt: z.string().min(1).describe('The prompt to decompose through the full PDE pipeline'),
  mode: z.enum(['keyword', 'llm']).default('keyword')
    .describe('Decomposition mode: "keyword" for local keyword-based, "llm" reserved for future LLM-enhanced'),
  workdir: z.string().optional()
    .describe('Working directory for .pde/ storage (defaults to cwd)'),
  extractImplicit: z.boolean().default(true)
    .describe('Extract implicit intents from hedging language'),
  mapDependencies: z.boolean().default(true)
    .describe('Map dependencies between actions'),
});

const PdeGetInputSchema = z.object({
  id: z.string().min(1).describe('Decomposition ID to retrieve'),
  workdir: z.string().optional()
    .describe('Working directory for .pde/ storage (defaults to cwd)'),
});

const PdeListInputSchema = z.object({
  limit: z.number().int().positive().default(20)
    .describe('Maximum number of results to return'),
  workdir: z.string().optional()
    .describe('Working directory for .pde/ storage (defaults to cwd)'),
});

const PdeExportInputSchema = z.object({
  id: z.string().min(1).describe('Decomposition ID to export'),
  format: z.enum(['markdown', 'json']).default('markdown')
    .describe('Export format: "markdown" for Four Directions document, "json" for raw data'),
  workdir: z.string().optional()
    .describe('Working directory for .pde/ storage (defaults to cwd)'),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

const pdeDecomposeDef: ToolDefinition = {
  name: 'pde/decompose',
  description: [
    'Run the full PDE pipeline on a prompt: decompose (EAST) → enrich (SOUTH) → assess (WEST) → plan (NORTH).',
    'Extracts primary/secondary intents, classifies by Four Directions, builds action stack,',
    'generates SMDF seed and graph nodes. Persists result to .pde/ storage.',
    'Returns the StructuredPlan with decomposition ID, Four Directions classification, and action stack.',
  ].join(' '),
  inputSchema: PdeDecomposeInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const pdeGetDef: ToolDefinition = {
  name: 'pde/get',
  description: [
    'Retrieve a stored decomposition by ID from .pde/ storage.',
    'Returns the full OntologicalDecomposition with Four Directions map,',
    'action stack, balance score, Wilson alignment, and ceremony guidance.',
  ].join(' '),
  inputSchema: PdeGetInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

const pdeListDef: ToolDefinition = {
  name: 'pde/list',
  description: [
    'List all stored decompositions from .pde/ storage.',
    'Returns array of { id, primaryIntent, createdAt } sorted by most recent.',
    'Use limit to control how many results are returned.',
  ].join(' '),
  inputSchema: PdeListInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

const pdeExportDef: ToolDefinition = {
  name: 'pde/export',
  description: [
    'Export a stored decomposition as markdown or JSON.',
    'Markdown follows canonical Four Directions ordering with Medicine Wheel metadata.',
    'JSON returns the raw OntologicalDecomposition object.',
  ].join(' '),
  inputSchema: PdeExportInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * pde/decompose handler — run full 4-stage pipeline on a prompt.
 */
const handlePdeDecompose: ToolHandler = async (args, _ctx) => {
  const parsed = PdeDecomposeInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for pde/decompose',
      issues: parsed.error.issues,
    });
  }

  const { prompt, mode, workdir, extractImplicit, mapDependencies } = parsed.data;

  if (mode === 'llm') {
    return mcpError('unsupported_mode', {
      message: 'LLM-enhanced mode requires an external LLM call. Use "keyword" mode for local decomposition, or use the buildLlmPrompt/runPipelineFromLlmResponse functions directly.',
    });
  }

  try {
    const plan = await runPipeline(prompt, {
      workdir,
      extractImplicit,
      mapDependencies,
      persist: true,
    });

    return mcpSuccess({
      id: plan.decomposition.id,
      timestamp: plan.decomposition.timestamp,
      primary: plan.decomposition.primary,
      leadDirection: plan.decomposition.leadDirection,
      balance: plan.decomposition.balance,
      wilsonAlignment: plan.decomposition.wilsonAlignment,
      ceremonyRequired: plan.decomposition.ceremonyRequired,
      neglectedDirections: plan.decomposition.neglectedDirections,
      actionStack: plan.decomposition.actionStack,
      directions: Object.fromEntries(
        Object.entries(plan.decomposition.directions).map(([dir, data]) => [
          dir,
          { insightCount: data.insights.length, ceremonyRecommended: data.ceremonyRecommended },
        ]),
      ),
      ambiguities: plan.decomposition.ambiguities,
      graphNodeCount: plan.graphNodes.length,
      narrativeBeatCount: plan.narrativeBeats.length,
      smdfSeedGenerated: plan.smdfSeed !== null,
    });
  } catch (err) {
    return mcpError('pipeline_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

/**
 * pde/get handler — retrieve a stored decomposition by ID.
 */
const handlePdeGet: ToolHandler = async (args, _ctx) => {
  const parsed = PdeGetInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for pde/get',
      issues: parsed.error.issues,
    });
  }

  const { id, workdir } = parsed.data;

  try {
    const decomposition = await load(id, workdir);
    return mcpSuccess(decomposition);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ENOENT') || message.includes('no such file')) {
      return mcpError('not_found', {
        message: `Decomposition "${id}" not found in .pde/ storage`,
        id,
      });
    }
    return mcpError('load_failed', { message, id });
  }
};

/**
 * pde/list handler — list all stored decompositions.
 */
const handlePdeList: ToolHandler = async (args, _ctx) => {
  const parsed = PdeListInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for pde/list',
      issues: parsed.error.issues,
    });
  }

  const { limit, workdir } = parsed.data;

  try {
    const all = await list(workdir);
    const limited = all.slice(0, limit);

    return mcpSuccess({
      total: all.length,
      returned: limited.length,
      decompositions: limited.map(item => ({
        id: item.id,
        primaryIntent: item.primary,
        createdAt: item.timestamp,
      })),
    });
  } catch (err) {
    return mcpError('list_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

/**
 * pde/export handler — export decomposition as markdown or JSON.
 */
const handlePdeExport: ToolHandler = async (args, _ctx) => {
  const parsed = PdeExportInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for pde/export',
      issues: parsed.error.issues,
    });
  }

  const { id, format, workdir } = parsed.data;

  try {
    const decomposition = await load(id, workdir);

    if (format === 'json') {
      return mcpSuccess(decomposition);
    }

    // Markdown: Four Directions canonical ordering
    const markdown = renderMarkdown(decomposition);
    return {
      content: [{ type: 'text' as const, text: markdown }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ENOENT') || message.includes('no such file')) {
      return mcpError('not_found', {
        message: `Decomposition "${id}" not found in .pde/ storage`,
        id,
      });
    }
    return mcpError('export_failed', { message, id });
  }
};

// ─── Guarded Handlers ────────────────────────────────────────────────────────

const guardedPdeDecompose = withGuards(
  [requireOcap('community'), auditLog('pde/decompose')],
  handlePdeDecompose,
);

const guardedPdeGet = withGuards(
  [auditLog('pde/get')],
  handlePdeGet,
);

const guardedPdeList = withGuards(
  [auditLog('pde/list')],
  handlePdeList,
);

const guardedPdeExport = withGuards(
  [auditLog('pde/export')],
  handlePdeExport,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  pdeDecomposeDef,
  pdeGetDef,
  pdeListDef,
  pdeExportDef,
];

export const handlers: Record<string, ToolHandler> = {
  'pde/decompose': guardedPdeDecompose,
  'pde/get': guardedPdeGet,
  'pde/list': guardedPdeList,
  'pde/export': guardedPdeExport,
};

/** Register all pde/ tools on an McpServer instance. */
export function registerPdeTools(server: {
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
