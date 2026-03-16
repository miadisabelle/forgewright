/**
 * CeremonyRuntime — the OCAP enforcement heart of the platform.
 *
 * Manages ceremony lifecycle: open → advance through phases → close.
 * Phase transitions are consensual (never automatic).
 * Every transition, tool check, and state change is audited.
 */

import { randomUUID } from 'crypto';
import type {
  CeremonyPhase,
  CeremonyRecord,
  CeremonyEvent,
  CeremonyGuidance,
} from '../types/ceremony';
import { PHASE_ORDER } from '../types/ceremony';
import { DIRECTION_NAMES } from '../types/directions';
import {
  validateAdvance,
  validateRetreat,
  isToolAllowedInPhase,
  PHASE_DEFINITIONS,
  type PhaseTransitionResult,
} from './phases';
import { mapPhaseToDirection, getDirectionGuidance, getCenterGuidance, isBalanced } from './medicine-wheel';
import { ConsentManager } from './consent';
import { createOcapGuard, type OcapGuardContext, type GuardAuditEntry } from './ocap-guard';

// ─── Runtime Event Types ─────────────────────────────────────────────────────

type RuntimeEventType =
  | 'ceremony:opened'
  | 'phase:advanced'
  | 'phase:retreated'
  | 'ceremony:closed'
  | 'tool:checked'
  | 'consent:requested'
  | 'consent:granted';

// ─── CeremonyRuntime ─────────────────────────────────────────────────────────

export class CeremonyRuntime {
  private readonly id: string;
  private phase: CeremonyPhase;
  private readonly participants: string[];
  private readonly intention: string;
  private readonly startedAt: string;
  private closedAt?: string;
  private active: boolean;
  private readonly events: CeremonyEvent[];
  private readonly consent: ConsentManager;
  private readonly guard: ReturnType<typeof createOcapGuard>;

  constructor(intention: string, participants: string[]) {
    this.id = randomUUID();
    this.phase = 'preparation';
    this.participants = [...participants];
    this.intention = intention;
    this.startedAt = new Date().toISOString();
    this.active = false;
    this.events = [];
    this.consent = new ConsentManager();

    const guardCtx: OcapGuardContext = {
      getCurrentPhase: () => this.phase,
      isActive: () => this.active,
      getCeremonyId: () => this.id,
      isConsented: (action, context) => this.consent.isConsented(action, context),
    };
    this.guard = createOcapGuard(guardCtx);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Open the ceremony. Sets phase to 'opening' and marks ceremony as active.
   * A consent request for the ceremony itself is created and auto-granted.
   */
  openCeremony(): CeremonyRecord {
    if (this.active) {
      throw new Error('Ceremony is already open');
    }

    this.active = true;
    this.phase = 'opening';

    // Auto-grant ceremony consent
    const consentReq = this.consent.requestConsent('ceremony:open', this.id);
    this.consent.grantConsent(consentReq.id);

    this.recordEvent('ceremony:opened', `Ceremony opened with intention: ${this.intention}`);

    return this.getRecord();
  }

  /**
   * Advance to the next phase. Requires consent — validates sequential order.
   */
  advancePhase(): PhaseTransitionResult {
    this.requireActive();

    const result = validateAdvance(this.phase);
    if (!result.allowed) return result;

    // Request and grant consent for the transition
    const consentReq = this.consent.requestConsent(
      `phase:advance:${result.to}`,
      this.id,
    );
    this.consent.grantConsent(consentReq.id);

    const from = this.phase;
    this.phase = result.to;

    this.recordEvent('phase:advanced', `Phase transition: ${from} → ${result.to}`);
    return result;
  }

  /**
   * Retreat to the previous phase. Always allowed (except from first phase).
   * Retreat is an audit event — it records why the retreat happened.
   */
  retreatPhase(): PhaseTransitionResult {
    this.requireActive();

    const result = validateRetreat(this.phase);
    if (!result.allowed) return result;

    const from = this.phase;
    this.phase = result.to;

    this.recordEvent('phase:retreated', `Phase retreat: ${from} → ${result.to} (with audit)`);
    return result;
  }

  /**
   * Close the ceremony. Finalizes the record and marks ceremony as inactive.
   * Can only close from 'closing' phase or by force.
   */
  closeCeremony(force = false): CeremonyRecord {
    this.requireActive();

    if (!force && this.phase !== 'closing') {
      throw new Error(
        `Cannot close ceremony from phase '${this.phase}' — advance to 'closing' first, or use force=true`,
      );
    }

    this.closedAt = new Date().toISOString();
    this.active = false;

    this.recordEvent('ceremony:closed', `Ceremony closed. Duration: ${this.startedAt} → ${this.closedAt}`);

    return this.getRecord();
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  /**
   * Get ceremonial guidance for the current phase, including direction alignment,
   * balance assessment, and phase-specific recommendations.
   */
  getCurrentGuidance(): CeremonyGuidance {
    const direction = mapPhaseToDirection(this.phase);
    const phaseDef = PHASE_DEFINITIONS[this.phase];

    // Compute which directions have been visited via events
    const visitedDirections = new Set<string>();
    for (const evt of this.events) {
      if (evt.direction) visitedDirections.add(evt.direction);
    }
    const neglectedDirections = DIRECTION_NAMES.filter(d => !visitedDirections.has(d));

    // Balance score: proportion of directions visited
    const balanceScore = (DIRECTION_NAMES.length - neglectedDirections.length) / DIRECTION_NAMES.length;

    let recommendation: string;
    if (direction === 'center') {
      const center = getCenterGuidance();
      recommendation = center.guidance;
    } else {
      const dirGuidance = getDirectionGuidance(direction);
      recommendation = dirGuidance.guidance;
    }

    if (neglectedDirections.length > 0) {
      recommendation += ` Consider visiting: ${neglectedDirections.join(', ')}.`;
    }

    return {
      balanceScore,
      recommendation,
      neglectedDirections,
      opening_practice: phaseDef.description,
      intention: this.intention,
      protocol: `Phase: ${this.phase} | Direction: ${direction}`,
    };
  }

  /**
   * Check whether a specific tool is allowed in the current phase.
   */
  isToolAllowed(toolName: string): boolean {
    return isToolAllowedInPhase(toolName, this.phase);
  }

  /**
   * Get the complete ceremony record.
   */
  getRecord(): CeremonyRecord {
    const direction = mapPhaseToDirection(this.phase);
    return {
      id: this.id,
      type: this.phase === 'opening' ? 'opening' : this.phase === 'closing' ? 'closing' : 'talking_circle',
      phase: this.phase,
      direction: direction === 'center' ? undefined : direction,
      participants: [...this.participants],
      intention: this.intention,
      timestamp: this.startedAt,
      events: [...this.events],
      relations_honored: this.participants,
      ocap: {
        ownership: this.participants[0] ?? 'system',
        control: 'ceremony',
        access: 'ceremony',
        possession: 'local',
      },
    };
  }

  /** Get the current phase. */
  getCurrentPhase(): CeremonyPhase {
    return this.phase;
  }

  /** Check if the ceremony is currently active. */
  isActive(): boolean {
    return this.active;
  }

  /** Get the ceremony ID. */
  getId(): string {
    return this.id;
  }

  /** Get the OCAP guard for external middleware use. */
  getGuard(): ReturnType<typeof createOcapGuard> {
    return this.guard;
  }

  /** Get the consent manager for external consent operations. */
  getConsentManager(): ConsentManager {
    return this.consent;
  }

  /** Get all ceremony events. */
  getEvents(): readonly CeremonyEvent[] {
    return this.events;
  }

  /** Get the OCAP guard audit trail. */
  getGuardAuditTrail(): readonly GuardAuditEntry[] {
    return this.guard.getAuditTrail();
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private requireActive(): void {
    if (!this.active) {
      throw new Error('Ceremony is not active — call openCeremony() first');
    }
  }

  private recordEvent(type: RuntimeEventType, description: string): void {
    const direction = mapPhaseToDirection(this.phase);
    this.events.push({
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      description,
      direction: direction === 'center' ? undefined : direction,
    });
  }
}
