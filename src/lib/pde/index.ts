/**
 * Forgewright PDE integration — see rispecs/00-platform-architecture.spec.md
 * Layer 2: Prompt Decomposition Engine (East ceremony opening)
 *
 * 4-stage pipeline: decompose → enrich → assess → plan
 */

// Stage 1: EAST — Decompose
export { decompose, buildSystemPrompt, formatUserMessage } from './decompose.js';
export type { DecomposeOptions } from './decompose.js';

// Stage 2: SOUTH — Enrich
export { enrich } from './enrich.js';
export type { GraphContext, EnrichedDecomposition } from './enrich.js';

// Stage 3: WEST — Assess
export { assess } from './assess.js';
export type { AssessedDecomposition } from './assess.js';

// Stage 4: NORTH — Plan
export { plan } from './plan.js';

// Full pipeline
export { runPipeline, buildLlmPrompt, runPipelineFromLlmResponse } from './pipeline.js';
export type { PipelineEvent, PipelineEventHandler, PipelineOptions } from './pipeline.js';

// Storage
export { store, load, list, renderMarkdown } from './storage.js';
