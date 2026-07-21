// Forgewright smcraft integration — see rispecs/00-platform-architecture.spec.md
// Layer 2: State Machine Craft — SMDF format, runtime, codegen, validation
// Local dependency: file:../../jgwill/smcraft/ts

export { EVENT_IDS, ALL_EVENT_IDS } from './events';
export type { EventId, EventPayload } from './events';
export {
  tensionEstablished, actionStepCompleted, realityUpdated,
  phaseAdvance, phaseRetreat, aiGenerate, userEdit,
  tensionResolve, tensionOscillate, workspaceFork, momentOfTruth,
} from './events';

export { OscillationDetector } from './oscillation';
export type { OscillationReport, OscillationSeverity, OscillationPattern, OscillationConfig } from './oscillation';

export { createCreativeProcessMachine, getCreativeProcessStateNames, stateToPhase } from './creative-process';

export { stcToSMDF, smdfToSTC, syncChanges } from './stc-adapter';
export type { SyncResult, SyncChange } from './stc-adapter';

export { createMachine, fireEvent, getCurrentState, getMachine, destroyMachine, getRuntimeBackend } from './runtime-bridge';
export type { MachineInstance, TransitionResult } from './runtime-bridge';

// WS8: live runtime-diagram bridge (presentational, gated on NEXT_PUBLIC_SMCRAFT_BRIDGE_URL)
export { createRuntimeBridge, isBridgeEnabled, getBridgeUrl } from './forgewright-bridge';
export type { RuntimeBridge, CreateRuntimeBridgeOptions } from './forgewright-bridge';

export { generateCode, getCodegenBackend } from './codegen-bridge';
export type { CodegenLanguage } from './codegen-bridge';
