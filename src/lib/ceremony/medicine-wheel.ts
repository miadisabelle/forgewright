/**
 * Medicine Wheel Integration
 *
 * Maps ceremony phases to the Four Directions, provides directional guidance,
 * computes spiral positions, and checks directional balance across cycles.
 *
 * The wheel is not decoration — it is the platform's cognitive architecture.
 */

import type { CeremonyPhase } from '../types/ceremony';
import type { DirectionName } from '../types/directions';
import type { NarrativeBeat } from '../types/narrative';
import { DIRECTIONS, DIRECTION_NAMES } from '../types/directions';
import type { DirectionAlignment } from './phases';

// ─── Phase → Direction Mapping ───────────────────────────────────────────────

const PHASE_DIRECTION_MAP: Record<CeremonyPhase, DirectionAlignment> = {
  preparation: 'east',
  opening: 'east',
  active: 'west',
  integration: 'north',
  closing: 'center',
};

/**
 * Map a ceremony phase to its corresponding Medicine Wheel direction.
 * Opening → East (Vision), Active → West (Action), Integration → North (Wisdom),
 * Closing → Center (Completion). Preparation also maps to East.
 */
export function mapPhaseToDirection(phase: CeremonyPhase): DirectionAlignment {
  return PHASE_DIRECTION_MAP[phase];
}

// ─── Direction Guidance ──────────────────────────────────────────────────────

interface DirectionGuidance {
  direction: DirectionName;
  ojibwe: string;
  emoji: string;
  season: string;
  focus: string;
  guidance: string;
  practices: readonly string[];
}

const DIRECTION_GUIDANCE: Record<DirectionName, DirectionGuidance> = {
  east: {
    direction: 'east',
    ojibwe: DIRECTIONS.east.ojibwe,
    emoji: DIRECTIONS.east.emoji,
    season: DIRECTIONS.east.season,
    focus: 'Vision, intention, emergence',
    guidance: 'What wants to emerge? What seeds are being planted? Name the structural tension.',
    practices: ['Morning prayers', 'Setting intentions', 'PDE decomposition', 'Opening ceremonies'],
  },
  south: {
    direction: 'south',
    ojibwe: DIRECTIONS.south.ojibwe,
    emoji: DIRECTIONS.south.emoji,
    season: DIRECTIONS.south.season,
    focus: 'Growth, architecture, planning',
    guidance: 'What structures support the vision? What patterns serve advancement?',
    practices: ['Specification writing', 'Dependency mapping', 'Youth mentorship', 'Cedar ceremonies'],
  },
  west: {
    direction: 'west',
    ojibwe: DIRECTIONS.west.ojibwe,
    emoji: DIRECTIONS.west.emoji,
    season: DIRECTIONS.west.season,
    focus: 'Implementation, creation, action',
    guidance: 'What is being built? How does creation serve the inquiries? Hold the tension in the doing.',
    practices: ['Coding under ceremony', 'Talking circles', 'Emotional processing', 'OCAP enforcement'],
  },
  north: {
    direction: 'north',
    ojibwe: DIRECTIONS.north.ojibwe,
    emoji: DIRECTIONS.north.emoji,
    season: DIRECTIONS.north.season,
    focus: 'Reflection, integration, wisdom',
    guidance: 'What has been learned? What reciprocity needs tending? Distill the wisdom.',
    practices: ['Story archiving', 'Session chronicles', 'Elder council', 'Knowledge sharing'],
  },
};

/**
 * Get ceremonial guidance text and metadata for a direction.
 */
export function getDirectionGuidance(direction: DirectionName): DirectionGuidance {
  return DIRECTION_GUIDANCE[direction];
}

/**
 * Get guidance for the center (closing/completion) position.
 */
export function getCenterGuidance(): { focus: string; guidance: string } {
  return {
    focus: 'Completion, integration, return',
    guidance: 'The circle closes. All directions honored. The record is sealed and given back.',
  };
}

// ─── Spiral Position ─────────────────────────────────────────────────────────

export interface SpiralPosition {
  cycle: number;
  direction: DirectionName;
  act: number;
  angle: number;
  radius: number;
}

/**
 * Compute position on the spiral for a given cycle count and direction.
 * Each cycle is a full revolution (4 directions). The spiral expands outward
 * as cycles accumulate — every invocation is a spiral, not a loop.
 *
 * @param cycleCount - Which cycle (1-based, spiral grows outward)
 * @param direction - Current direction on the wheel
 * @returns SpiralPosition with angle (0-360°) and radius
 */
export function spiralPosition(cycleCount: number, direction: DirectionName): SpiralPosition {
  const dirInfo = DIRECTIONS[direction];
  const act = dirInfo.act;

  // Angle: East=0°, South=90°, West=180°, North=270°
  const angle = (act - 1) * 90;

  // Radius grows with each cycle — spiral expansion
  const baseRadius = 1;
  const expansionRate = 0.25;
  const radius = baseRadius + (cycleCount - 1) * expansionRate;

  return { cycle: cycleCount, direction, act, angle, radius };
}

// ─── Balance Check ───────────────────────────────────────────────────────────

export interface BalanceResult {
  balanced: boolean;
  coverage: Record<DirectionName, number>;
  neglected: DirectionName[];
  balanceScore: number;
}

/**
 * Check if all 4 directions are represented in a set of narrative beats.
 * A balanced cycle visits each direction at least once.
 *
 * @param beats - Array of narrative beats to evaluate
 * @returns BalanceResult with coverage counts and neglected directions
 */
export function isBalanced(beats: NarrativeBeat[]): BalanceResult {
  const coverage: Record<DirectionName, number> = { east: 0, south: 0, west: 0, north: 0 };

  for (const beat of beats) {
    if (beat.direction && beat.direction in coverage) {
      coverage[beat.direction]++;
    }
  }

  const neglected = DIRECTION_NAMES.filter(d => coverage[d] === 0);
  const total = beats.length || 1;
  const represented = DIRECTION_NAMES.filter(d => coverage[d] > 0).length;
  const balanceScore = represented / 4;

  return {
    balanced: neglected.length === 0,
    coverage,
    neglected,
    balanceScore,
  };
}
