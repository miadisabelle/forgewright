import { z } from 'zod';
import { DirectionNameSchema, type DirectionName } from './directions.js';

// ─── Creative Phase ──────────────────────────────────────────────────────────

export const CreativePhaseSchema = z.enum(['germination', 'assimilation', 'completion']);
export type CreativePhase = z.infer<typeof CreativePhaseSchema>;

// ─── Action Step Status ──────────────────────────────────────────────────────

export const ActionStepStatusSchema = z.enum(['pending', 'in_progress', 'done', 'blocked']);
export type ActionStepStatus = z.infer<typeof ActionStepStatusSchema>;

// ─── Action Step ─────────────────────────────────────────────────────────────

export const ActionStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  direction: DirectionNameSchema.optional(),
  status: ActionStepStatusSchema.default('pending'),
  confidence: z.number().min(0).max(1).default(0.8),
  dependencies: z.array(z.string()).default([]),
  dueDate: z.string().optional(),
});
export type ActionStep = z.infer<typeof ActionStepSchema>;

// ─── Structural Tension Chart ────────────────────────────────────────────────

export const StructuralTensionChartSchema = z.object({
  id: z.string(),
  desiredOutcome: z.string(),
  currentReality: z.string(),
  actionSteps: z.array(ActionStepSchema),
  tensionLevel: z.number().min(0).max(1).default(0.5),
  phase: CreativePhaseSchema.default('germination'),
  direction: DirectionNameSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StructuralTensionChart = z.infer<typeof StructuralTensionChartSchema>;
