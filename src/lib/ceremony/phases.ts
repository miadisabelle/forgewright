/**
 * Ceremony Phase Definitions & Permissions
 *
 * Five phases map to the Medicine Wheel directions plus Center:
 *   Opening → East (Vision)
 *   Grounding → South (Growth)
 *   Engagement → West (Action)
 *   Integration → North (Wisdom)
 *   Closing → Center (Completion)
 *
 * Phase transitions are sequential and require consent — never automatic.
 */

import type { CeremonyPhase, PhasePermissions } from '../types/ceremony';
import type { DirectionName } from '../types/directions';
import { PHASE_ORDER } from '../types/ceremony';

// ─── Phase ↔ Direction Alignment ─────────────────────────────────────────────

export type DirectionAlignment = DirectionName | 'center';

export interface PhaseDefinition {
  phase: CeremonyPhase;
  direction: DirectionAlignment;
  allowedTools: readonly string[];
  requiredParticipants: number;
  description: string;
}

export const PHASE_DEFINITIONS: Record<CeremonyPhase, PhaseDefinition> = {
  preparation: {
    phase: 'preparation',
    direction: 'east',
    allowedTools: ['pde', 'graph:read'],
    requiredParticipants: 1,
    description: 'Vision and intent — decompose prompts, load graph context, name structural tension',
  },
  opening: {
    phase: 'opening',
    direction: 'east',
    allowedTools: ['pde', 'graph:read', 'ceremony'],
    requiredParticipants: 1,
    description: 'Circle opened — ceremony tools available, OCAP consent affirmed',
  },
  active: {
    phase: 'active',
    direction: 'west',
    allowedTools: ['pde', 'graph:read', 'graph:write', 'smcraft', 'narrative', 'ceremony'],
    requiredParticipants: 1,
    description: 'Engaged practice — full tool access under ceremony governance',
  },
  integration: {
    phase: 'integration',
    direction: 'north',
    allowedTools: ['graph:read', 'narrative', 'ceremony'],
    requiredParticipants: 1,
    description: 'Reflection and wisdom — chronicle session, distill learnings',
  },
  closing: {
    phase: 'closing',
    direction: 'center',
    allowedTools: ['graph:read', 'narrative', 'ceremony'],
    requiredParticipants: 1,
    description: 'Circle closed — ceremony finalized, record sealed',
  },
} as const;

// ─── Phase Permissions Map ───────────────────────────────────────────────────

export const PHASE_PERMISSIONS: PhasePermissions = Object.fromEntries(
  PHASE_ORDER.map(phase => [phase, [...PHASE_DEFINITIONS[phase].allowedTools]]),
) as PhasePermissions;

// ─── Phase Index Utilities ───────────────────────────────────────────────────

export function phaseIndex(phase: CeremonyPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function isValidPhase(phase: string): phase is CeremonyPhase {
  return (PHASE_ORDER as readonly string[]).includes(phase);
}

// ─── Phase Transition Validation ─────────────────────────────────────────────

export interface PhaseTransitionResult {
  allowed: boolean;
  from: CeremonyPhase;
  to: CeremonyPhase;
  reason: string;
}

/**
 * Validate whether advancing from `current` to the next sequential phase is allowed.
 * Phases can only advance one step at a time and must not skip.
 */
export function validateAdvance(current: CeremonyPhase): PhaseTransitionResult {
  const idx = phaseIndex(current);
  if (idx === PHASE_ORDER.length - 1) {
    return {
      allowed: false,
      from: current,
      to: current,
      reason: `Cannot advance past ${current} — ceremony is at final phase`,
    };
  }

  const next = PHASE_ORDER[idx + 1];
  return {
    allowed: true,
    from: current,
    to: next,
    reason: `Transition ${current} → ${next} permitted (sequential advance)`,
  };
}

/**
 * Validate whether retreating from `current` to the previous phase is allowed.
 * Retreat is always permitted (with audit) except from the first phase.
 */
export function validateRetreat(current: CeremonyPhase): PhaseTransitionResult {
  const idx = phaseIndex(current);
  if (idx === 0) {
    return {
      allowed: false,
      from: current,
      to: current,
      reason: `Cannot retreat before ${current} — ceremony is at initial phase`,
    };
  }

  const prev = PHASE_ORDER[idx - 1];
  return {
    allowed: true,
    from: current,
    to: prev,
    reason: `Retreat ${current} → ${prev} permitted (with audit)`,
  };
}

/**
 * Check whether a specific tool is allowed in a given phase.
 */
export function isToolAllowedInPhase(toolName: string, phase: CeremonyPhase): boolean {
  const def = PHASE_DEFINITIONS[phase];
  return def.allowedTools.includes(toolName);
}

/**
 * Get the direction alignment for a phase.
 */
export function getPhaseDirection(phase: CeremonyPhase): DirectionAlignment {
  return PHASE_DEFINITIONS[phase].direction;
}
