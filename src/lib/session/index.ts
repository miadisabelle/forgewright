// Forgewright session management — see rispecs/00-platform-architecture.spec.md
// Layer 1: Session lifecycle, storage, spiral tracking

export { SessionManager } from './manager';
export { save, load, list, remove } from './storage';
export {
  onSessionCreate,
  onDirectionChange,
  onCycleComplete,
  onSessionClose,
  getSessionArc,
  clearSessionArcs,
  type LifecycleResult,
} from './lifecycle';
export {
  DEFAULT_CONFIG,
  DEFAULT_CHECKPOINT_POLICY,
  SESSION_DEFAULTS,
  mergeConfig,
  validateConfig,
} from './config';
