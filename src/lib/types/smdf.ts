import { z } from 'zod';

// ─── SMDF Types (from smcraft model.ts) ──────────────────────────────────────

export const ParameterDefSchema = z.object({
  name: z.string(),
  type: z.string(),
});
export type ParameterDef = z.infer<typeof ParameterDefSchema>;

export const EventDefSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  parameters: z.array(ParameterDefSchema).optional(),
  preAction: z.string().optional(),
  postAction: z.string().optional(),
});
export type EventDef = z.infer<typeof EventDefSchema>;

export const TimerStartActionSchema = z.object({
  timer: z.string(),
  duration: z.string(),
});
export type TimerStartAction = z.infer<typeof TimerStartActionSchema>;

export const ActionDefSchema = z.object({
  code: z.string().optional(),
  timerStart: TimerStartActionSchema.optional(),
  timerStop: z.string().optional(),
});
export type ActionDef = z.infer<typeof ActionDefSchema>;

export const TransitionDefSchema = z.object({
  event: z.string(),
  nextState: z.string().optional(),
  condition: z.string().optional(),
  description: z.string().optional(),
  actions: z.array(ActionDefSchema).optional(),
});
export type TransitionDef = z.infer<typeof TransitionDefSchema>;

export const StateKindTypeSchema = z.enum(['normal', 'final', 'history']);
export type StateKindType = z.infer<typeof StateKindTypeSchema>;

export const StateDefSchema: z.ZodType<StateDef> = z.lazy(() =>
  z.object({
    name: z.string(),
    kind: StateKindTypeSchema.optional(),
    description: z.string().optional(),
    onEntry: z.object({ actions: z.array(ActionDefSchema) }).optional(),
    onExit: z.object({ actions: z.array(ActionDefSchema) }).optional(),
    transitions: z.array(TransitionDefSchema).optional(),
    states: z.array(StateDefSchema).optional(),
    parallel: z.object({
      nextState: z.string(),
      states: z.array(StateDefSchema),
    }).optional(),
  })
);
export interface StateDef {
  name: string;
  kind?: StateKindType;
  description?: string;
  onEntry?: { actions: ActionDef[] };
  onExit?: { actions: ActionDef[] };
  transitions?: TransitionDef[];
  states?: StateDef[];
  parallel?: { nextState: string; states: StateDef[] };
}

export const TimerDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
export type TimerDef = z.infer<typeof TimerDefSchema>;

export const EventSourceDefSchema = z.object({
  name: z.string(),
  file: z.string().optional(),
  feeder: z.string().optional(),
  description: z.string().optional(),
  events: z.array(EventDefSchema).optional(),
  timers: z.array(TimerDefSchema).optional(),
});
export type EventSourceDef = z.infer<typeof EventSourceDefSchema>;

export const SettingsModelSchema = z.object({
  namespace: z.string(),
  name: z.string().optional(),
  asynchronous: z.boolean(),
  objects: z.array(z.object({
    instance: z.string(),
    class: z.string(),
    namespace: z.string().optional(),
  })).optional(),
  context: z.object({
    class: z.string().optional(),
    instance: z.string().optional(),
  }).optional(),
  using: z.array(z.string()).optional(),
});
export type SettingsModel = z.infer<typeof SettingsModelSchema>;

export const StateMachineDefinitionSchema = z.object({
  settings: SettingsModelSchema,
  events: z.array(EventSourceDefSchema),
  state: StateDefSchema,
});
export type StateMachineDefinition = z.infer<typeof StateMachineDefinitionSchema>;

// ─── Forgewright extensions ──────────────────────────────────────────────────

export const StateMachineEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventId: z.string(),
  fromState: z.string(),
  toState: z.string(),
  payload: z.record(z.unknown()).optional(),
});
export type StateMachineEvent = z.infer<typeof StateMachineEventSchema>;

export const WorkspaceStateMachineSchema = z.object({
  workspaceId: z.string(),
  definition: StateMachineDefinitionSchema,
  currentState: z.string(),
  stcChartId: z.string().optional(),
  tensionLevel: z.number().min(0).max(1).default(0.5),
  eventHistory: z.array(StateMachineEventSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkspaceStateMachine = z.infer<typeof WorkspaceStateMachineSchema>;
