/**
 * Event definitions for the Creative Process state machine.
 * Maps directly to spec 02 event model — each event type represents
 * a relational act in the creative ceremony.
 */

import type { StateMachineEvent } from '../types/smdf';

// ─── Event ID Constants ──────────────────────────────────────────────────────

export const EVENT_IDS = {
  TENSION_ESTABLISHED: 'tension_established',
  ACTION_STEP_COMPLETED: 'action_step_completed',
  REALITY_UPDATED: 'reality_updated',
  PHASE_ADVANCE: 'phase_advance',
  PHASE_RETREAT: 'phase_retreat',
  AI_GENERATE: 'ai_generate',
  USER_EDIT: 'user_edit',
  TENSION_RESOLVE: 'tension_resolve',
  TENSION_OSCILLATE: 'tension_oscillate',
  WORKSPACE_FORK: 'workspace_fork',
  MOMENT_OF_TRUTH: 'moment_of_truth',
} as const;

export type EventId = typeof EVENT_IDS[keyof typeof EVENT_IDS];

export const ALL_EVENT_IDS: readonly EventId[] = Object.values(EVENT_IDS);

// ─── Event Payload Types ─────────────────────────────────────────────────────

export interface TensionEstablishedPayload {
  chartId: string;
  desiredOutcome: string;
  currentReality: string;
  tensionLevel: number;
}

export interface ActionStepCompletedPayload {
  stepId: string;
  description: string;
  phase: string;
  confidence: number;
}

export interface RealityUpdatedPayload {
  previousReality: string;
  newReality: string;
  tensionDelta: number;
}

export interface PhaseAdvancePayload {
  fromPhase: string;
  toPhase: string;
  completedSteps: number;
  totalSteps: number;
}

export interface PhaseRetreatPayload {
  fromPhase: string;
  toPhase: string;
  reason: string;
}

export interface AIGeneratePayload {
  artifactType: string;
  artifactId?: string;
  prompt?: string;
}

export interface UserEditPayload {
  artifactType: string;
  artifactId?: string;
  editSummary?: string;
}

export interface TensionResolvePayload {
  chartId: string;
  finalState: string;
  duration?: number;
}

export interface TensionOscillatePayload {
  stateVisited: string;
  visitCount: number;
  netProgress: number;
}

export interface WorkspaceForkPayload {
  sourceWorkspaceId: string;
  newWorkspaceId: string;
  forkPoint: string;
}

export interface MomentOfTruthPayload {
  checkpoint: string;
  decision: 'advance' | 'retreat' | 'adjust';
  reason?: string;
}

export type EventPayload =
  | TensionEstablishedPayload
  | ActionStepCompletedPayload
  | RealityUpdatedPayload
  | PhaseAdvancePayload
  | PhaseRetreatPayload
  | AIGeneratePayload
  | UserEditPayload
  | TensionResolvePayload
  | TensionOscillatePayload
  | WorkspaceForkPayload
  | MomentOfTruthPayload;

// ─── Event Factory ───────────────────────────────────────────────────────────

let _eventCounter = 0;

function createEvent(
  eventId: EventId,
  fromState: string,
  toState: string,
  payload?: Record<string, unknown>,
): StateMachineEvent {
  return {
    id: `evt_${Date.now()}_${++_eventCounter}`,
    timestamp: new Date().toISOString(),
    eventId,
    fromState,
    toState,
    payload,
  };
}

export function tensionEstablished(
  fromState: string,
  toState: string,
  payload: TensionEstablishedPayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.TENSION_ESTABLISHED, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function actionStepCompleted(
  fromState: string,
  toState: string,
  payload: ActionStepCompletedPayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.ACTION_STEP_COMPLETED, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function realityUpdated(
  fromState: string,
  toState: string,
  payload: RealityUpdatedPayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.REALITY_UPDATED, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function phaseAdvance(
  fromState: string,
  toState: string,
  payload: PhaseAdvancePayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.PHASE_ADVANCE, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function phaseRetreat(
  fromState: string,
  toState: string,
  payload: PhaseRetreatPayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.PHASE_RETREAT, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function aiGenerate(
  fromState: string,
  toState: string,
  payload: AIGeneratePayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.AI_GENERATE, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function userEdit(
  fromState: string,
  toState: string,
  payload: UserEditPayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.USER_EDIT, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function tensionResolve(
  fromState: string,
  toState: string,
  payload: TensionResolvePayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.TENSION_RESOLVE, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function tensionOscillate(
  fromState: string,
  toState: string,
  payload: TensionOscillatePayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.TENSION_OSCILLATE, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function workspaceFork(
  fromState: string,
  toState: string,
  payload: WorkspaceForkPayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.WORKSPACE_FORK, fromState, toState, payload as unknown as Record<string, unknown>);
}

export function momentOfTruth(
  fromState: string,
  toState: string,
  payload: MomentOfTruthPayload,
): StateMachineEvent {
  return createEvent(EVENT_IDS.MOMENT_OF_TRUTH, fromState, toState, payload as unknown as Record<string, unknown>);
}
