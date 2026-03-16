/**
 * Forgewright Ceremony Governance
 *
 * Five phases: Preparation → Opening → Active → Integration → Closing
 * OCAP at every layer, spiral checkpoints, directional permission mapping.
 * See rispecs/00-platform-architecture.spec.md
 */

export {
  PHASE_DEFINITIONS,
  PHASE_PERMISSIONS,
  phaseIndex,
  isValidPhase,
  validateAdvance,
  validateRetreat,
  isToolAllowedInPhase,
  getPhaseDirection,
  type PhaseDefinition,
  type DirectionAlignment,
  type PhaseTransitionResult,
} from './phases.js';

export { CeremonyRuntime } from './runtime.js';

export {
  createOcapGuard,
  type OcapGuardContext,
  type GuardRequest,
  type GuardDecision,
  type GuardCheck,
  type GuardAuditEntry,
} from './ocap-guard.js';

export {
  mapPhaseToDirection,
  getDirectionGuidance,
  getCenterGuidance,
  spiralPosition,
  isBalanced,
  type SpiralPosition,
  type BalanceResult,
} from './medicine-wheel.js';

export {
  ConsentManager,
  type ConsentRequest,
  type ConsentAuditEntry,
} from './consent.js';
