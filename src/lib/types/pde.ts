import { z } from 'zod';
import { DirectionNameSchema, type DirectionName } from './directions';
import type { CeremonyGuidance } from './ceremony';
import type { NarrativeBeat } from './narrative';
import type { StateMachineDefinition } from './smdf';

// ─── Urgency ─────────────────────────────────────────────────────────────────

export const UrgencySchema = z.enum(['immediate', 'session', 'persistent']);
export type Urgency = z.infer<typeof UrgencySchema>;

// ─── Primary Intent ──────────────────────────────────────────────────────────

export const PrimaryIntentSchema = z.object({
  action: z.string(),
  target: z.string(),
  urgency: UrgencySchema.default('session'),
  confidence: z.number().min(0).max(1).default(0.8),
});
export type PrimaryIntent = z.infer<typeof PrimaryIntentSchema>;

// ─── Secondary Intent ────────────────────────────────────────────────────────

export const SecondaryIntentSchema = z.object({
  action: z.string(),
  target: z.string(),
  implicit: z.boolean().default(false),
  dependency: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.8),
});
export type SecondaryIntent = z.infer<typeof SecondaryIntentSchema>;

// ─── Relational Intent (enriched) ────────────────────────────────────────────

export const RelationalIntentSchema = SecondaryIntentSchema.extend({
  id: z.string(),
  direction: DirectionNameSchema,
  obligations: z.array(z.object({
    category: z.enum(['human', 'land', 'spirit', 'future']),
    obligations: z.array(z.string()),
  })).default([]),
  wilsonAlignment: z.number().min(0).max(1).default(0),
});
export type RelationalIntent = z.infer<typeof RelationalIntentSchema>;

// ─── Context Requirements ────────────────────────────────────────────────────

export const ContextRequirementsSchema = z.object({
  files_needed: z.array(z.string()).default([]),
  tools_required: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});
export type ContextRequirements = z.infer<typeof ContextRequirementsSchema>;

// ─── Expected Outputs ────────────────────────────────────────────────────────

export const ExpectedOutputsSchema = z.object({
  artifacts: z.array(z.string()).default([]),
  updates: z.array(z.string()).default([]),
  communications: z.array(z.string()).default([]),
});
export type ExpectedOutputs = z.infer<typeof ExpectedOutputsSchema>;

// ─── Directional Insight ─────────────────────────────────────────────────────

export const DirectionalInsightSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  implicit: z.boolean().default(false),
});
export type DirectionalInsight = z.infer<typeof DirectionalInsightSchema>;

// ─── Direction Map (simple PDE) ──────────────────────────────────────────────

export const DirectionMapSchema = z.record(
  DirectionNameSchema,
  z.array(DirectionalInsightSchema),
);
export type DirectionMap = z.infer<typeof DirectionMapSchema>;

// ─── Ambiguity Flag ──────────────────────────────────────────────────────────

export const AmbiguityFlagSchema = z.object({
  text: z.string(),
  suggestion: z.string(),
});
export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;

// ─── Action Item (PDE action stack) ──────────────────────────────────────────

export const PdeActionItemSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  direction: DirectionNameSchema,
  dependency: z.string().nullable().default(null),
  completed: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.8),
  implicit: z.boolean().default(false),
});
export type PdeActionItem = z.infer<typeof PdeActionItemSchema>;

// ─── Decomposition Result (mcp-pde canonical) ───────────────────────────────

export const DecompositionResultSchema = z.object({
  primary: PrimaryIntentSchema,
  secondary: z.array(SecondaryIntentSchema),
  context: ContextRequirementsSchema,
  outputs: ExpectedOutputsSchema,
  directions: DirectionMapSchema,
  actionStack: z.array(PdeActionItemSchema),
  ambiguities: z.array(AmbiguityFlagSchema),
});
export type DecompositionResult = z.infer<typeof DecompositionResultSchema>;

// ─── Ontological Decomposition (medicine-wheel enriched) ─────────────────────

export interface OntologicalDirection {
  name: DirectionName;
  ojibwe: string;
  season: string;
  act: number;
  insights: DirectionalInsight[];
  obligations: Array<{ category: 'human' | 'land' | 'spirit' | 'future'; obligations: string[] }>;
  ceremonyRecommended: boolean;
}

export interface OntologicalDecomposition {
  id: string;
  timestamp: string;
  prompt: string;
  primary: PrimaryIntent;
  secondary: RelationalIntent[];
  context: ContextRequirements;
  outputs: ExpectedOutputs;
  directions: Record<DirectionName, OntologicalDirection>;
  actionStack: PdeActionItem[];
  ambiguities: AmbiguityFlag[];
  balance: number;
  leadDirection: DirectionName;
  neglectedDirections: DirectionName[];
  ceremonyGuidance: CeremonyGuidance | null;
  ceremonyRequired: boolean;
  wilsonAlignment: number;
  narrativeBeats: NarrativeBeat[];
}

// ─── Stored Decomposition ────────────────────────────────────────────────────

export const StoredDecompositionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  prompt: z.string(),
  result: DecompositionResultSchema,
  options: z.object({
    extractImplicit: z.boolean().default(true),
    mapDependencies: z.boolean().default(true),
  }),
  markdownPath: z.string().optional(),
});
export type StoredDecomposition = z.infer<typeof StoredDecompositionSchema>;

// ─── Pipeline Stage ──────────────────────────────────────────────────────────

export const PipelineStageSchema = z.enum(['decompose', 'enrich', 'assess', 'plan']);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

// ─── Structured Plan ─────────────────────────────────────────────────────────

export interface StructuredPlan {
  decomposition: OntologicalDecomposition;
  /** Real SMDF definition from plan(); null only for storage round-trips without a seed file. */
  smdfSeed: StateMachineDefinition | null;
  graphNodes: Array<{ nodeType: string; id: string; [key: string]: unknown }>;
  narrativeBeats: NarrativeBeat[];
  ceremonyGuidance: CeremonyGuidance | null;
}
