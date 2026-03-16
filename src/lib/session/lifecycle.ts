/**
 * Session lifecycle hooks — ceremony-aware callbacks for session state transitions.
 *
 * Each hook enriches the session with spiral tracking, narrative beats,
 * ceremony integration, and Wilson alignment computation.
 */

import { randomUUID } from 'crypto';
import type { ForgewrightSession, SpiralPosition } from '../types/session';
import type { DirectionName } from '../types/directions';
import type { NarrativeArc, NarrativeBeat } from '../types/narrative';
import { DIRECTION_NAMES, DIRECTIONS } from '../types/directions';
import { createArc, addBeat, getArcSummary } from '../narrative/arc-manager';
import { computeWilsonScore, type WilsonContext } from '../narrative/wilson-score';
import { DEFAULT_CHECKPOINT_POLICY } from './config';

// ─── Direction Cycle Order ───────────────────────────────────────────────────

const DIRECTION_ORDER: readonly DirectionName[] = ['east', 'south', 'west', 'north'];

function nextDirection(current: DirectionName): DirectionName {
  const idx = DIRECTION_ORDER.indexOf(current);
  return DIRECTION_ORDER[(idx + 1) % DIRECTION_ORDER.length];
}

// ─── Session-scoped arcs (in-memory, keyed by session ID) ────────────────────

const _sessionArcs = new Map<string, NarrativeArc>();

export function getSessionArc(sessionId: string): NarrativeArc | undefined {
  return _sessionArcs.get(sessionId);
}

export function clearSessionArcs(): void {
  _sessionArcs.clear();
}

// ─── Lifecycle Result ────────────────────────────────────────────────────────

export interface LifecycleResult {
  session: ForgewrightSession;
  message: string;
  arc?: NarrativeArc;
  chronicle?: string;
  wilsonScore?: { score: number; components: Record<string, number> };
}

// ─── onSessionCreate ─────────────────────────────────────────────────────────

/**
 * Initialize ceremony, PDE, spiral tracker when a session is created.
 * Sets initial direction to East, cycle 0, creates narrative arc.
 */
export function onSessionCreate(session: ForgewrightSession): LifecycleResult {
  // Ensure checkpoint policy
  if (!session.checkpointPolicy) {
    session.checkpointPolicy = { ...DEFAULT_CHECKPOINT_POLICY };
  }

  // Initialize spiral at East
  session.spiralPosition = {
    direction: 'east',
    cycleCount: 0,
    maxCycles: session.spiralPosition.maxCycles,
    isAtCheckpoint: false,
  };

  // Create narrative arc
  const arc = createArc(session.id);
  _sessionArcs.set(session.id, arc);

  // Record opening beat
  const openingBeat: NarrativeBeat = {
    id: randomUUID(),
    act: 1,
    direction: 'east',
    content: `Session opened with intent: ${session.intent}`,
    title: 'Session Opening',
    timestamp: session.createdAt,
    ceremonies: [],
    learnings: [],
    relations_honored: session.companions.map((c) => c.name),
  };
  const updatedArc = addBeat(arc, openingBeat);
  _sessionArcs.set(session.id, updatedArc);

  session.updatedAt = new Date().toISOString();

  return {
    session,
    message: `🌅 Session created — spiral begins at East (Waabinong). Intent: "${session.intent}"`,
    arc: updatedArc,
  };
}

// ─── onDirectionChange ───────────────────────────────────────────────────────

/**
 * Checkpoint and update narrative when direction changes.
 * Checks if we're at a mandatory checkpoint direction.
 */
export function onDirectionChange(
  session: ForgewrightSession,
  newDirection: DirectionName,
): LifecycleResult {
  const prevDirection = session.spiralPosition.direction;
  const info = DIRECTIONS[newDirection];

  // Update spiral position
  session.spiralPosition = {
    ...session.spiralPosition,
    direction: newDirection,
    isAtCheckpoint: session.checkpointPolicy?.mandatoryAt?.includes(newDirection) ?? false,
  };

  // Record direction change beat
  const arc = _sessionArcs.get(session.id) ?? createArc(session.id);
  const beat: NarrativeBeat = {
    id: randomUUID(),
    act: info.act,
    direction: newDirection,
    content: `Direction changed: ${prevDirection} → ${newDirection}`,
    title: `${info.emoji} ${info.name} (${info.ojibwe})`,
    timestamp: new Date().toISOString(),
    ceremonies: [],
    learnings: [],
    relations_honored: [],
  };
  const updatedArc = addBeat(arc, beat);
  _sessionArcs.set(session.id, updatedArc);

  session.updatedAt = new Date().toISOString();

  const checkpointNote = session.spiralPosition.isAtCheckpoint
    ? ' ⚡ CHECKPOINT — human review required.'
    : '';

  return {
    session,
    message: `${info.emoji} Direction: ${prevDirection} → ${newDirection} (${info.ojibwe}).${checkpointNote}`,
    arc: updatedArc,
  };
}

// ─── onCycleComplete ─────────────────────────────────────────────────────────

/**
 * Called when North completes, triggering a cycle increment.
 * Checks max cycles. Generates cycle summary.
 */
export function onCycleComplete(session: ForgewrightSession): LifecycleResult {
  const newCycleCount = session.spiralPosition.cycleCount + 1;
  const maxReached = newCycleCount >= session.spiralPosition.maxCycles;

  session.spiralPosition = {
    ...session.spiralPosition,
    cycleCount: newCycleCount,
    direction: 'east', // spiral returns to East
    isAtCheckpoint: true, // always checkpoint at cycle boundary
  };

  const arc = _sessionArcs.get(session.id);
  const summary = arc ? getArcSummary(arc) : 'No narrative arc tracked.';

  session.updatedAt = new Date().toISOString();

  const maxNote = maxReached
    ? ` 🛑 Maximum cycles reached (${session.spiralPosition.maxCycles}). Session must close or human must extend.`
    : '';

  return {
    session,
    message: `❄️→🌅 Cycle ${newCycleCount} complete. Spiral returns to East.${maxNote}`,
    chronicle: summary,
  };
}

// ─── onSessionClose ──────────────────────────────────────────────────────────

/**
 * Finalize session: generate chronicle, compute final Wilson alignment.
 */
export function onSessionClose(session: ForgewrightSession): LifecycleResult {
  const arc = _sessionArcs.get(session.id) ?? createArc(session.id);
  const chronicle = getArcSummary(arc);

  // Build Wilson context from session data
  const wilsonCtx: WilsonContext = {
    ocapCompliant: true,
    relationsHonored: session.companions.map((c) => c.name),
    ceremoniesConducted: session.ceremonyId ? [session.ceremonyId] : [],
    directionsVisited: arc.directionsVisited,
    totalSteps: arc.beats.length,
    completedSteps: arc.beats.length,
  };

  const wilsonScore = computeWilsonScore(arc.beats, wilsonCtx);

  // Record closing beat
  const closingBeat: NarrativeBeat = {
    id: randomUUID(),
    act: 4,
    direction: 'north',
    content: `Session closed after ${session.spiralPosition.cycleCount} cycles. Wilson: ${(wilsonScore.score * 100).toFixed(1)}%`,
    title: 'Session Closing',
    timestamp: new Date().toISOString(),
    wilsonScore,
    ceremonies: session.ceremonyId ? [session.ceremonyId] : [],
    learnings: [`Completed ${session.spiralPosition.cycleCount} spiral cycles`],
    relations_honored: session.companions.map((c) => c.name),
  };
  const finalArc = addBeat(arc, closingBeat);
  _sessionArcs.set(session.id, finalArc);

  session.status = 'completed';
  session.updatedAt = new Date().toISOString();

  // Clean up arc from memory
  _sessionArcs.delete(session.id);

  return {
    session,
    message: `Session closed. Wilson alignment: ${(wilsonScore.score * 100).toFixed(1)}%. ${session.spiralPosition.cycleCount} cycles completed.`,
    chronicle: getArcSummary(finalArc),
    wilsonScore: {
      score: wilsonScore.score,
      components: wilsonScore.components,
    },
    arc: finalArc,
  };
}
