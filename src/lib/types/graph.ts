import { z } from 'zod';
import { DirectionNameSchema, type DirectionName } from './directions.js';
import { OcapMetadataSchema, type OcapMetadata } from './ocap.js';

// ─── Edge Types (11 canonical relationships) ─────────────────────────────────

export const EDGE_TYPES = [
  'DEPENDS_ON',
  'BELONGS_TO',
  'SERVES_DIRECTION',
  'AUTHORED_BY',
  'GOVERNED_BY',
  'TRANSITIONS_TO',
  'CONTAINS',
  'GENERATED_FROM',
  'NARRATES',
  'ACCOUNTABLE_TO',
  'KIN_OF',
] as const;

export const EdgeTypeSchema = z.enum(EDGE_TYPES);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

// ─── Base node shape ─────────────────────────────────────────────────────────

const BaseNodeSchema = z.object({
  id: z.string(),
  ocap: OcapMetadataSchema,
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

// ─── 10 Node Types ───────────────────────────────────────────────────────────

export const SpecNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('Spec'),
  name: z.string(),
  version: z.string(),
  direction: DirectionNameSchema.optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  content: z.string().optional(),
});
export type SpecNode = z.infer<typeof SpecNodeSchema>;

export const CompanionNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('Companion'),
  name: z.string(),
  role: z.enum(['architect', 'illuminator', 'sage', 'forger']),
  embodiment: z.string().optional(),
});
export type CompanionNode = z.infer<typeof CompanionNodeSchema>;

export const CeremonyNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('Ceremony'),
  name: z.string(),
  direction: DirectionNameSchema.optional(),
  phase: z.string(),
});
export type CeremonyNode = z.infer<typeof CeremonyNodeSchema>;

export const SessionNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('Session'),
  title: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed', 'abandoned']).default('active'),
});
export type SessionNode = z.infer<typeof SessionNodeSchema>;

export const ActionStepNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('ActionStep'),
  description: z.string(),
  orderIndex: z.number().int().optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'blocked']).default('pending'),
});
export type ActionStepNode = z.infer<typeof ActionStepNodeSchema>;

export const NarrativeBeatNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('NarrativeBeat'),
  content: z.string(),
  emotion: z.string().optional(),
  intensity: z.number().min(0).max(1).default(0.5),
});
export type NarrativeBeatNode = z.infer<typeof NarrativeBeatNodeSchema>;

export const IntentNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('Intent'),
  description: z.string(),
  direction: DirectionNameSchema.optional(),
  urgency: z.enum(['immediate', 'session', 'persistent']).default('session'),
});
export type IntentNode = z.infer<typeof IntentNodeSchema>;

export const StateMachineNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('StateMachine'),
  name: z.string(),
  namespace: z.string().optional(),
  currentState: z.string(),
});
export type StateMachineNode = z.infer<typeof StateMachineNodeSchema>;

export const StateNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('State'),
  name: z.string(),
  isInitial: z.boolean().default(false),
  isFinal: z.boolean().default(false),
  kind: z.string().optional(),
});
export type StateNode = z.infer<typeof StateNodeSchema>;

export const EventNodeSchema = BaseNodeSchema.extend({
  nodeType: z.literal('Event'),
  name: z.string(),
  payload: z.string().optional(),
  firedAt: z.string().optional(),
});
export type EventNode = z.infer<typeof EventNodeSchema>;

// ─── Union of all node types ─────────────────────────────────────────────────

export const GraphNodeSchema = z.discriminatedUnion('nodeType', [
  SpecNodeSchema,
  CompanionNodeSchema,
  CeremonyNodeSchema,
  SessionNodeSchema,
  ActionStepNodeSchema,
  NarrativeBeatNodeSchema,
  IntentNodeSchema,
  StateMachineNodeSchema,
  StateNodeSchema,
  EventNodeSchema,
]);
export type GraphNode = z.infer<typeof GraphNodeSchema>;

// ─── Graph Edge ──────────────────────────────────────────────────────────────

export const GraphEdgeSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  edgeType: EdgeTypeSchema,
  strength: z.number().min(0).max(1).default(1.0),
  direction: DirectionNameSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  ocap: OcapMetadataSchema,
  createdAt: z.string(),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

// ─── Node Type Label ─────────────────────────────────────────────────────────

export const NODE_TYPES = [
  'Spec', 'Companion', 'Ceremony', 'Session', 'ActionStep',
  'NarrativeBeat', 'Intent', 'StateMachine', 'State', 'Event',
] as const;

export const NodeTypeSchema = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof NodeTypeSchema>;
