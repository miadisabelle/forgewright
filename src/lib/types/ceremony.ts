import { z } from 'zod';
import { DirectionNameSchema, type DirectionName } from './directions';
import { OcapMetadataSchema, type OcapMetadata } from './ocap';

// ─── Ceremony Phase ──────────────────────────────────────────────────────────

export const CeremonyPhaseSchema = z.enum([
  'preparation', 'opening', 'active', 'integration', 'closing',
]);
export type CeremonyPhase = z.infer<typeof CeremonyPhaseSchema>;

// ─── Ceremony Type ───────────────────────────────────────────────────────────

export const CeremonyTypeSchema = z.enum([
  'smudging', 'talking_circle', 'spirit_feeding', 'opening', 'closing',
]);
export type CeremonyType = z.infer<typeof CeremonyTypeSchema>;

export const CEREMONY_ICONS: Record<CeremonyType, string> = {
  smudging: '🌿',
  talking_circle: '🔴',
  spirit_feeding: '🕯️',
  opening: '🌅',
  closing: '🌙',
};

// ─── Ceremony Event ──────────────────────────────────────────────────────────

export const CeremonyEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.string(),
  description: z.string(),
  direction: DirectionNameSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CeremonyEvent = z.infer<typeof CeremonyEventSchema>;

// ─── Ceremony Record ─────────────────────────────────────────────────────────

export const CeremonyRecordSchema = z.object({
  id: z.string(),
  type: CeremonyTypeSchema,
  phase: CeremonyPhaseSchema,
  direction: DirectionNameSchema.optional(),
  participants: z.array(z.string()),
  intention: z.string(),
  timestamp: z.string(),
  events: z.array(CeremonyEventSchema).default([]),
  medicines_used: z.array(z.string()).optional(),
  relations_honored: z.array(z.string()).optional(),
  ocap: OcapMetadataSchema.optional(),
});
export type CeremonyRecord = z.infer<typeof CeremonyRecordSchema>;

// ─── Ceremony Guidance ───────────────────────────────────────────────────────

export const CeremonyGuidanceSchema = z.object({
  balanceScore: z.number().min(0).max(1),
  recommendation: z.string(),
  neglectedDirections: z.array(DirectionNameSchema),
  opening_practice: z.string().optional(),
  intention: z.string().optional(),
  protocol: z.string().optional(),
  medicines_used: z.array(z.string()).optional(),
});
export type CeremonyGuidance = z.infer<typeof CeremonyGuidanceSchema>;

// ─── Phase Permissions ───────────────────────────────────────────────────────

export const PhasePermissionsSchema = z.record(
  CeremonyPhaseSchema,
  z.array(z.string()),
);
export type PhasePermissions = z.infer<typeof PhasePermissionsSchema>;

export const DEFAULT_PHASE_PERMISSIONS: PhasePermissions = {
  preparation: ['pde', 'graph:read'],
  opening: ['pde', 'graph:read', 'ceremony'],
  active: ['pde', 'graph:read', 'graph:write', 'smcraft', 'narrative', 'ceremony'],
  integration: ['graph:read', 'narrative', 'ceremony'],
  closing: ['graph:read', 'narrative', 'ceremony'],
};

// ─── Ceremony State (from ceremony-protocol) ─────────────────────────────────

export const CeremonyStateSchema = z.object({
  currentCycle: z.string(),
  hostSun: z.string(),
  phase: CeremonyPhaseSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type CeremonyState = z.infer<typeof CeremonyStateSchema>;

// ─── Phase Order ─────────────────────────────────────────────────────────────

export const PHASE_ORDER: readonly CeremonyPhase[] = [
  'preparation', 'opening', 'active', 'integration', 'closing',
] as const;
