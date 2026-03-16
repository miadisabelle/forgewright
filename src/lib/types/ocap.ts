import { z } from 'zod';

// ─── Access Level ────────────────────────────────────────────────────────────

export const AccessLevelSchema = z.enum(['public', 'community', 'ceremony', 'sacred']);
export type AccessLevel = z.infer<typeof AccessLevelSchema>;

// ─── Possession Location ─────────────────────────────────────────────────────

export const PossessionLocationSchema = z.enum([
  'on-premise', 'community-server', 'cloud-sovereign', 'cloud-shared',
]);
export type PossessionLocation = z.infer<typeof PossessionLocationSchema>;

// ─── Consent State ───────────────────────────────────────────────────────────

export const ConsentStateSchema = z.enum(['active', 'withdrawn', 'expired', 'pending']);
export type ConsentState = z.infer<typeof ConsentStateSchema>;

// ─── OCAP Metadata ───────────────────────────────────────────────────────────

export const OcapMetadataSchema = z.object({
  ownership: z.string(),
  control: z.string(),
  access: AccessLevelSchema,
  possession: z.string(),
});
export type OcapMetadata = z.infer<typeof OcapMetadataSchema>;

// ─── OCAP Flags (full, from ontology-core) ───────────────────────────────────

export const OcapFlagsSchema = z.object({
  ownership: z.string(),
  control: z.string(),
  access: z.enum(['community', 'researchers', 'public', 'restricted']),
  possession: PossessionLocationSchema,
  compliant: z.boolean(),
  steward: z.string().optional(),
  consent_given: z.boolean().optional(),
  consent_scope: z.string().optional(),
  consent_state: ConsentStateSchema.optional(),
  consent_last_affirmed: z.string().optional(),
});
export type OcapFlags = z.infer<typeof OcapFlagsSchema>;

// ─── Access Decision ─────────────────────────────────────────────────────────

export const AccessDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  ocapLevel: AccessLevelSchema,
  auditEntry: z.string(),
});
export type AccessDecision = z.infer<typeof AccessDecisionSchema>;

// ─── Wilson Accountability Tracking ──────────────────────────────────────────

export const AccountabilityTrackingSchema = z.object({
  respect: z.number().min(0).max(1),
  reciprocity: z.number().min(0).max(1),
  responsibility: z.number().min(0).max(1),
  wilson_alignment: z.number().min(0).max(1),
  relations_honored: z.array(z.string()),
  last_ceremony_id: z.string().optional(),
  notes: z.string().optional(),
});
export type AccountabilityTracking = z.infer<typeof AccountabilityTrackingSchema>;
