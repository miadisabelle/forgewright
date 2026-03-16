// Forgewright smcraft integration — see rispecs/00-platform-architecture.spec.md
// Layer 2: State Machine Craft — SMDF format, runtime, codegen, validation
// Local dependency: file:../../jgwill/smcraft/ts

export { EVENT_IDS, ALL_EVENT_IDS } from './events.js';
export type { EventId, EventPayload } from './events.js';
export {
  tensionEstablished, actionStepCompleted, realityUpdated,
  phaseAdvance, phaseRetreat, aiGenerate, userEdit,
  tensionResolve, tensionOscillate, workspaceFork, momentOfTruth,
} from './events.js';

export { OscillationDetector } from './oscillation.js';
export type { OscillationReport, OscillationSeverity, OscillationPattern, OscillationConfig } from './oscillation.js';

export { createCreativeProcessMachine, getCreativeProcessStateNames, stateToPhase } from './creative-process.js';

export { stcToSMDF, smdfToSTC, syncChanges } from './stc-adapter.js';
export type { SyncResult, SyncChange } from './stc-adapter.js';

export { createMachine, fireEvent, getCurrentState, getMachine, destroyMachine, getRuntimeBackend } from './runtime-bridge.js';
export type { MachineInstance, TransitionResult } from './runtime-bridge.js';

export { generateCode, getCodegenBackend } from './codegen-bridge.js';
export type { CodegenLanguage } from './codegen-bridge.js';
