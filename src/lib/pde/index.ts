/**
 * Forgewright PDE integration — see rispecs/00-platform-architecture.spec.md
 * Layer 2: Prompt Decomposition Engine (East ceremony opening)
 *
 * 4-stage pipeline: decompose → enrich → assess → plan
 */

// Stage 1: EAST — Decompose
export { decompose, buildSystemPrompt, formatUserMessage } from './decompose';
export type { DecomposeOptions } from './decompose';

// Stage 2: SOUTH — Enrich
export { enrich } from './enrich';
export type { GraphContext, EnrichedDecomposition } from './enrich';

// Stage 3: WEST — Assess
export { assess } from './assess';
export type { AssessedDecomposition } from './assess';

// Stage 4: NORTH — Plan
export { plan } from './plan';

// Full pipeline
export { runPipeline, buildLlmPrompt, runPipelineFromLlmResponse } from './pipeline';
export type { PipelineEvent, PipelineEventHandler, PipelineOptions } from './pipeline';

// Storage
export { store, load, list, renderMarkdown } from './storage';
