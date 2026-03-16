// ─── Forgewright State Machine View ──────────────────────────────────────────
// Interactive SMDF visualization with composite drill-down, event firing,
// and live state highlighting. See rispecs/05-visual-designer.spec.md.

// Components
export { default as StateMachineView } from './StateMachineView';
export { default } from './StateMachineView';
export { default as StatePanel } from './StatePanel';
export { default as TransitionPanel } from './TransitionPanel';
export { default as EventBar } from './EventBar';

// Conversion utilities
export {
  smdfToCanvas,
  canvasToSMDF,
  classifyState,
  getAvailableEvents,
  getAllDefinedEvents,
} from './smdf-to-canvas';
export type { SmdfToCanvasResult, StateType } from './smdf-to-canvas';
