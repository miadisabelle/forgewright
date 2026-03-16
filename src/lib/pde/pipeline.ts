/**
 * Full PDE-to-Plan pipeline orchestrator.
 *
 * Chains all 4 stages: decompose → enrich → assess → plan
 * Emits events at stage transitions, stores intermediate results.
 */

import { decompose, buildSystemPrompt, formatUserMessage, type DecomposeOptions } from './decompose.js';
import { enrich, type GraphContext } from './enrich.js';
import { assess } from './assess.js';
import { plan } from './plan.js';
import { store } from './storage.js';
import { DIRECTIONS } from '../types/directions.js';
import type {
  OntologicalDecomposition,
  StructuredPlan,
  PipelineStage,
} from '../types/pde.js';

// ─── Pipeline event emitter ──────────────────────────────────────────────────

export interface PipelineEvent {
  stage: PipelineStage;
  status: 'start' | 'complete' | 'error';
  timestamp: string;
  data?: unknown;
  error?: string;
}

export type PipelineEventHandler = (event: PipelineEvent) => void;

// ─── Pipeline options ────────────────────────────────────────────────────────

export interface PipelineOptions extends DecomposeOptions {
  graphContext?: GraphContext;
  workdir?: string;
  persist?: boolean;
  onEvent?: PipelineEventHandler;
}

// ─── LLM-enhanced mode types ─────────────────────────────────────────────────

export interface LlmPipelineOptions extends PipelineOptions {
  llmResponse: string;
}

// ─── Main pipeline function ──────────────────────────────────────────────────

export async function runPipeline(
  prompt: string,
  options: PipelineOptions = {},
): Promise<StructuredPlan> {
  const {
    graphContext,
    workdir = process.cwd(),
    persist = true,
    onEvent,
    ...decomposeOptions
  } = options;

  const emit = (stage: PipelineStage, status: 'start' | 'complete' | 'error', data?: unknown, error?: string) => {
    onEvent?.({
      stage,
      status,
      timestamp: new Date().toISOString(),
      data,
      error,
    });
  };

  // Stage 1: EAST — Decompose
  emit('decompose', 'start');
  let decomposition: OntologicalDecomposition;
  try {
    decomposition = decompose(prompt, decomposeOptions);
    emit('decompose', 'complete', { id: decomposition.id });
  } catch (err) {
    emit('decompose', 'error', undefined, String(err));
    throw err;
  }

  // Stage 2: SOUTH — Enrich
  emit('enrich', 'start');
  let enriched: OntologicalDecomposition;
  try {
    enriched = enrich(decomposition, graphContext);
    emit('enrich', 'complete', { wilsonAlignment: enriched.wilsonAlignment });
  } catch (err) {
    emit('enrich', 'error', undefined, String(err));
    throw err;
  }

  // Stage 3: WEST — Assess
  emit('assess', 'start');
  let assessed: OntologicalDecomposition;
  try {
    const result = assess(enriched);
    assessed = result.assessed;
    emit('assess', 'complete', {
      balance: assessed.balance,
      ceremonyRequired: assessed.ceremonyRequired,
    });
  } catch (err) {
    emit('assess', 'error', undefined, String(err));
    throw err;
  }

  // Stage 4: NORTH — Plan
  emit('plan', 'start');
  let structuredPlan: StructuredPlan;
  try {
    structuredPlan = plan(assessed);
    emit('plan', 'complete', {
      actionCount: structuredPlan.decomposition.actionStack.length,
      graphNodeCount: structuredPlan.graphNodes.length,
      beatCount: structuredPlan.narrativeBeats.length,
    });
  } catch (err) {
    emit('plan', 'error', undefined, String(err));
    throw err;
  }

  // Persist to .pde/ filesystem
  if (persist) {
    await store(structuredPlan.decomposition.id, structuredPlan, workdir);
  }

  return structuredPlan;
}

// ─── LLM-enhanced pipeline builder ──────────────────────────────────────────

/**
 * Builds the system prompt + user message for LLM-enhanced decomposition.
 * The caller sends these to their LLM, then feeds the response to
 * runPipelineFromLlmResponse().
 */
export function buildLlmPrompt(
  prompt: string,
  options: DecomposeOptions = {},
): { systemPrompt: string; userMessage: string; originalPrompt: string } {
  return {
    systemPrompt: buildSystemPrompt(options),
    userMessage: formatUserMessage(prompt),
    originalPrompt: prompt,
  };
}

/**
 * Run the pipeline using an LLM response as the decomposition source.
 * Falls back to keyword-based decomposition if parsing fails.
 */
export async function runPipelineFromLlmResponse(
  prompt: string,
  llmResponse: string,
  options: PipelineOptions = {},
): Promise<StructuredPlan> {
  const {
    graphContext,
    workdir = process.cwd(),
    persist = true,
    onEvent,
    ...decomposeOptions
  } = options;

  const emit = (stage: PipelineStage, status: 'start' | 'complete' | 'error', data?: unknown, error?: string) => {
    onEvent?.({
      stage,
      status,
      timestamp: new Date().toISOString(),
      data,
      error,
    });
  };

  // Stage 1: Parse LLM response into decomposition
  emit('decompose', 'start');
  let decomposition: OntologicalDecomposition;
  try {
    decomposition = parseLlmResponseToDecomposition(prompt, llmResponse);
    emit('decompose', 'complete', { id: decomposition.id, mode: 'llm-enhanced' });
  } catch (err) {
    // Fallback to keyword-based
    emit('decompose', 'error', undefined, `LLM parse failed, falling back: ${err}`);
    decomposition = decompose(prompt, decomposeOptions);
    emit('decompose', 'complete', { id: decomposition.id, mode: 'keyword-fallback' });
  }

  // Stages 2–4 identical to regular pipeline
  emit('enrich', 'start');
  const enriched = enrich(decomposition, graphContext);
  emit('enrich', 'complete');

  emit('assess', 'start');
  const { assessed } = assess(enriched);
  emit('assess', 'complete');

  emit('plan', 'start');
  const structuredPlan = plan(assessed);
  emit('plan', 'complete');

  if (persist) {
    await store(structuredPlan.decomposition.id, structuredPlan, workdir);
  }

  return structuredPlan;
}

// ─── LLM response parser ────────────────────────────────────────────────────

function parseLlmResponseToDecomposition(
  prompt: string,
  llmResponse: string,
): OntologicalDecomposition {
  const jsonStr = extractJsonString(llmResponse);
  const raw = JSON.parse(jsonStr);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Normalize LLM output into OntologicalDecomposition
  return {
    id,
    timestamp: now,
    prompt,
    primary: {
      action: raw.primary?.action ?? 'process',
      target: raw.primary?.target ?? prompt.substring(0, 80),
      urgency: raw.primary?.urgency ?? 'session',
      confidence: raw.primary?.confidence ?? 0.8,
    },
    secondary: (raw.secondary ?? []).map((s: Record<string, unknown>, i: number) => ({
      id: `intent-${i}`,
      action: s.action ?? 'address',
      target: s.target ?? '',
      implicit: s.implicit ?? false,
      dependency: s.dependency ?? null,
      confidence: s.confidence ?? 0.8,
      direction: 'north' as const,
      obligations: [],
      wilsonAlignment: 0,
    })),
    context: {
      files_needed: raw.context?.files_needed ?? [],
      tools_required: raw.context?.tools_required ?? [],
      assumptions: raw.context?.assumptions ?? [],
    },
    outputs: {
      artifacts: raw.outputs?.artifacts ?? [],
      updates: raw.outputs?.updates ?? [],
      communications: raw.outputs?.communications ?? [],
    },
    directions: normalizeDirectionMap(raw.directions),
    actionStack: (raw.actionStack ?? []).map((a: Record<string, unknown>, i: number) => ({
      id: `action-${i}`,
      text: a.text ?? '',
      direction: a.direction ?? 'north',
      dependency: a.dependency ?? null,
      completed: a.completed ?? false,
      confidence: 0.8,
      implicit: false,
    })),
    ambiguities: (raw.ambiguities ?? []).map((a: Record<string, unknown>) => ({
      text: a.text ?? '',
      suggestion: a.suggestion ?? '',
    })),
    balance: 0,
    leadDirection: 'north',
    neglectedDirections: [],
    ceremonyGuidance: null,
    ceremonyRequired: false,
    wilsonAlignment: 0,
    narrativeBeats: [],
  };
}

function extractJsonString(responseText: string): string {
  // Tier 1: Extract from markdown code block
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Tier 2: Raw JSON (starts with {)
  const trimmed = responseText.trim();
  if (trimmed.startsWith('{')) return trimmed;

  // Tier 3: Find first { to last }
  const firstBrace = responseText.indexOf('{');
  const lastBrace = responseText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return responseText.substring(firstBrace, lastBrace + 1);
  }

  throw new Error('No JSON found in LLM response');
}

function normalizeDirectionMap(
  raw: Record<string, unknown> | undefined,
): OntologicalDecomposition['directions'] {
  const dirs = ['east', 'south', 'west', 'north'] as const;

  const result = {} as OntologicalDecomposition['directions'];
  for (const dir of dirs) {
    const items = (raw?.[dir] ?? []) as Array<Record<string, unknown>>;
    result[dir] = {
      name: dir,
      ojibwe: DIRECTIONS[dir].ojibwe,
      season: DIRECTIONS[dir].season,
      act: DIRECTIONS[dir].act,
      insights: items.map(item => ({
        text: String(item.text ?? ''),
        confidence: Number(item.confidence ?? 0.8),
        implicit: Boolean(item.implicit ?? false),
      })),
      obligations: [],
      ceremonyRecommended: items.length === 0,
    };
  }
  return result;
}
