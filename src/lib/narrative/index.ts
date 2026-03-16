// ─── Forgewright Narrative Engine ─────────────────────────────────────────────
// Medicine Wheel narrative cycle: beats, arcs, Wilson alignment, chronicles.

export { computeWilsonScore, getWilsonRecommendation } from './wilson-score';
export type { WilsonContext, WilsonRecommendation } from './wilson-score';

export { generateBeat, generateBeatsForSteps } from './beat-generator';
export type { BeatContext } from './beat-generator';

export {
  createArc,
  addBeat,
  validateArcCoherence,
  isArcComplete,
  getArcCompleteness,
  getArcSummary,
} from './arc-manager';
export type { CoherenceResult } from './arc-manager';

export { generateChronicle } from './chronicle';
export type { ChronicleOptions } from './chronicle';

export { storeBeat, storeBeats, loadBeats, exportArc, listSessions } from './storage';
