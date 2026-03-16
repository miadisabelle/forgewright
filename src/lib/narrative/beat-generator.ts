// ─── Beat Generator ──────────────────────────────────────────────────────────
// Maps action step completion to narrative beats within the Medicine Wheel.

import type { ActionStep } from '../types/stc';
import type { NarrativeBeat } from '../types/narrative';
import type { DirectionName } from '../types/directions';
import { DIRECTIONS, DIRECTION_ACTS } from '../types/directions';
import { computeWilsonScore, type WilsonContext } from './wilson-score';

// ─── Beat Context ────────────────────────────────────────────────────────────

export interface BeatContext {
  /** Session-level Wilson context for scoring */
  wilson: WilsonContext;
  /** Optional emotion tag for the beat */
  emotion?: string;
  /** Optional intensity (0–1) */
  intensity?: number;
  /** Additional learnings to attach */
  learnings?: string[];
  /** Relations being honored in this step */
  relationsHonored?: string[];
  /** Ceremonies associated with this step */
  ceremonies?: string[];
}

// ─── Direction-Based Prose Templates ─────────────────────────────────────────

const DIRECTION_PROSE: Record<DirectionName, (step: ActionStep) => string> = {
  east: (step) =>
    `🌅 A seed is planted in ${DIRECTIONS.east.ojibwe}: "${step.description}" — ` +
    `the vision emerges with ${Math.round(step.confidence * 100)}% clarity.`,
  south: (step) =>
    `🔥 In ${DIRECTIONS.south.ojibwe}, the structure takes form: "${step.description}" — ` +
    `planning meets consent at ${Math.round(step.confidence * 100)}% confidence.`,
  west: (step) =>
    `🌊 The waters of ${DIRECTIONS.west.ojibwe} carry action: "${step.description}" — ` +
    `experience forged through practice.`,
  north: (step) =>
    `❄️ ${DIRECTIONS.north.ojibwe} holds the reflection: "${step.description}" — ` +
    `wisdom crystallized from the journey.`,
};

// ─── Direction-Based Titles ──────────────────────────────────────────────────

const DIRECTION_TITLES: Record<DirectionName, string> = {
  east: 'Vision & Inquiry',
  south: 'Planning & Consent',
  west: 'Experience & Action',
  north: 'Reflection & Wisdom',
};

// ─── Beat ID Generation ─────────────────────────────────────────────────────

function generateBeatId(direction: DirectionName, stepId: string): string {
  const timestamp = Date.now().toString(36);
  return `beat-${direction}-${stepId}-${timestamp}`;
}

// ─── Main: Generate a Narrative Beat ─────────────────────────────────────────

export function generateBeat(
  actionStep: ActionStep,
  direction: DirectionName,
  context: BeatContext,
): NarrativeBeat {
  const act = DIRECTION_ACTS[direction];
  const prose = DIRECTION_PROSE[direction](actionStep);

  // Compute Wilson score for this beat's context
  const wilsonScore = computeWilsonScore([], context.wilson);

  const beat: NarrativeBeat = {
    id: generateBeatId(direction, actionStep.id),
    act,
    direction,
    content: actionStep.description,
    title: `${DIRECTION_TITLES[direction]}: ${actionStep.description.slice(0, 60)}`,
    timestamp: new Date().toISOString(),
    wilsonScore,
    ceremonies: context.ceremonies ?? [],
    learnings: context.learnings ?? [],
    relations_honored: context.relationsHonored ?? [],
    prose,
    emotion: context.emotion,
    intensity: context.intensity,
  };

  return beat;
}

// ─── Batch: Generate beats for multiple steps ────────────────────────────────

export function generateBeatsForSteps(
  steps: ActionStep[],
  defaultDirection: DirectionName,
  context: BeatContext,
): NarrativeBeat[] {
  return steps.map(step => {
    const direction = step.direction ?? defaultDirection;
    return generateBeat(step, direction, context);
  });
}
