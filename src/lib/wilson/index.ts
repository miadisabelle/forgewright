/**
 * Unified Wilson Alignment Module
 *
 * Combines graph-derived, narrative-derived, and session-derived signals into
 * a single authoritative Wilson alignment scoring system.
 *
 * This module is PURE — it receives pre-computed scores as inputs and never
 * queries graph or narrative engines directly.
 */

export {
  computeUnifiedWilson,
  type UnifiedWilsonOptions,
  type UnifiedWilsonResult,
  type SessionMetrics,
} from './score.js';

export {
  WilsonTracker,
  type TimestampedScore,
  type Trend,
  type AlertCallback,
} from './tracker.js';

export {
  generateRecommendations,
  type Recommendation,
  type Urgency,
} from './recommendations.js';
