import { z } from 'zod';
import { DirectionNameSchema, type DirectionName } from './directions';

// ─── Spiral Position ─────────────────────────────────────────────────────────

export const SpiralPositionSchema = z.object({
  direction: DirectionNameSchema,
  cycleCount: z.number().int().min(0).default(0),
  maxCycles: z.number().int().min(1).default(4),
  isAtCheckpoint: z.boolean().default(false),
});
export type SpiralPosition = z.infer<typeof SpiralPositionSchema>;

// ─── Checkpoint Policy ───────────────────────────────────────────────────────

export const CheckpointPolicySchema = z.object({
  type: z.enum(['direction-change', 'cycle-complete', 'tension-threshold', 'manual']),
  mandatoryAt: z.array(DirectionNameSchema).default([]),
  maxAutonomousCycles: z.number().int().min(1).default(3),
});
export type CheckpointPolicy = z.infer<typeof CheckpointPolicySchema>;

// ─── Companion Reference ─────────────────────────────────────────────────────

export const CompanionRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['architect', 'illuminator', 'sage', 'forger']),
});
export type CompanionRef = z.infer<typeof CompanionRefSchema>;

// ─── Session Status ──────────────────────────────────────────────────────────

export const SessionStatusSchema = z.enum(['active', 'paused', 'completed', 'abandoned']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

// ─── Forgewright Session ─────────────────────────────────────────────────────

export const ForgewrightSessionSchema = z.object({
  id: z.string(),
  intent: z.string(),
  companions: z.array(CompanionRefSchema).default([]),
  spiralPosition: SpiralPositionSchema,
  stcChartId: z.string().optional(),
  ceremonyId: z.string().optional(),
  machineState: z.string().optional(),
  status: SessionStatusSchema.default('active'),
  checkpointPolicy: CheckpointPolicySchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ForgewrightSession = z.infer<typeof ForgewrightSessionSchema>;

// ─── Forgewright Config ──────────────────────────────────────────────────────

export const ForgewrightConfigSchema = z.object({
  graphPath: z.string(),
  redisUrl: z.string().optional(),
  mcpTransport: z.enum(['stdio', 'http']).default('stdio'),
});
export type ForgewrightConfig = z.infer<typeof ForgewrightConfigSchema>;
