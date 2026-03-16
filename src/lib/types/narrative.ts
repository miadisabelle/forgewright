import { z } from 'zod';
import { DirectionNameSchema, type DirectionName } from './directions.js';

// ─── Wilson Score ────────────────────────────────────────────────────────────

export const WilsonScoreSchema = z.object({
  score: z.number().min(0).max(1),
  components: z.object({
    respect: z.number().min(0).max(1),
    reciprocity: z.number().min(0).max(1),
    responsibility: z.number().min(0).max(1),
  }),
});
export type WilsonScore = z.infer<typeof WilsonScoreSchema>;

// ─── Narrative Beat ──────────────────────────────────────────────────────────

export const NarrativeBeatSchema = z.object({
  id: z.string(),
  act: z.number().int().min(1).max(4),
  direction: DirectionNameSchema,
  content: z.string(),
  title: z.string().optional(),
  timestamp: z.string(),
  wilsonScore: WilsonScoreSchema.optional(),
  ceremonies: z.array(z.string()).default([]),
  learnings: z.array(z.string()).default([]),
  relations_honored: z.array(z.string()).default([]),
  prose: z.string().optional(),
  emotion: z.string().optional(),
  intensity: z.number().min(0).max(1).optional(),
});
export type NarrativeBeat = z.infer<typeof NarrativeBeatSchema>;

// ─── Narrative Arc ───────────────────────────────────────────────────────────

export const NarrativeArcSchema = z.object({
  beats: z.array(NarrativeBeatSchema),
  currentAct: z.number().int().min(1).max(4),
  isComplete: z.boolean().default(false),
  directionsVisited: z.array(DirectionNameSchema).default([]),
  wilsonAlignment: z.number().min(0).max(1).optional(),
});
export type NarrativeArc = z.infer<typeof NarrativeArcSchema>;

// ─── Arc Completeness (from narrative-engine) ────────────────────────────────

export const ArcCompletenessSchema = z.object({
  complete: z.boolean(),
  directionsVisited: z.array(DirectionNameSchema),
  directionsMissing: z.array(DirectionNameSchema),
  ceremoniesPerDirection: z.record(DirectionNameSchema, z.number()),
  beatsPerDirection: z.record(DirectionNameSchema, z.number()),
  wilsonAlignment: z.number().min(0).max(1),
  ocapCompliant: z.boolean(),
  completenessScore: z.number().min(0).max(1),
});
export type ArcCompleteness = z.infer<typeof ArcCompletenessSchema>;

// ─── Cadence Phase ───────────────────────────────────────────────────────────

export const CadencePhaseSchema = z.enum(['opening', 'deepening', 'integrating', 'closing']);
export type CadencePhase = z.infer<typeof CadencePhaseSchema>;

// ─── Medicine Wheel Cycle ────────────────────────────────────────────────────

export const MedicineWheelCycleSchema = z.object({
  id: z.string(),
  research_question: z.string(),
  start_date: z.string(),
  current_direction: DirectionNameSchema,
  beats: z.array(z.string()),
  ceremonies_conducted: z.number().int(),
  relations_mapped: z.number().int(),
  wilson_alignment: z.number().min(0).max(1),
  ocap_compliant: z.boolean(),
});
export type MedicineWheelCycle = z.infer<typeof MedicineWheelCycleSchema>;
