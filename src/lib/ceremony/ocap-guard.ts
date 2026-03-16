/**
 * OCAP Enforcement Middleware
 *
 * Creates a guard function tied to a ceremony runtime that enforces:
 *   - Consent state (action must be consented)
 *   - Access level (requester level must meet node level)
 *   - Phase permissions (tool must be allowed in current phase)
 *   - Sacred-level access requires Opening phase to be complete
 *
 * OCAP principles mapped to operations:
 *   Ownership  → who created / stewards the data
 *   Control    → who decides how data is used
 *   Access     → who can see the data (hierarchy: public < community < ceremony < sacred)
 *   Possession → where data physically resides
 *
 * All access decisions are logged to an audit trail.
 */

import type { AccessLevel, OcapMetadata, ConsentState } from '../types/ocap.js';
import type { CeremonyPhase } from '../types/ceremony.js';
import { phaseIndex, isToolAllowedInPhase } from './phases.js';

// ─── Access Hierarchy ────────────────────────────────────────────────────────

const ACCESS_HIERARCHY: Record<AccessLevel, number> = {
  public: 0,
  community: 1,
  ceremony: 2,
  sacred: 3,
};

// ─── Guard Types ─────────────────────────────────────────────────────────────

export interface OcapGuardContext {
  getCurrentPhase: () => CeremonyPhase;
  isActive: () => boolean;
  getCeremonyId: () => string;
  isConsented: (action: string, context: string) => boolean;
}

export interface GuardRequest {
  action: string;
  toolName?: string;
  requester: string;
  requesterAccessLevel: AccessLevel;
  targetOcap?: OcapMetadata;
  targetNodeId?: string;
}

export interface GuardDecision {
  allowed: boolean;
  reason: string;
  checks: GuardCheck[];
}

export interface GuardCheck {
  check: 'consent' | 'access_level' | 'phase_permission' | 'sacred_gate' | 'ceremony_active';
  passed: boolean;
  detail: string;
}

export interface GuardAuditEntry {
  timestamp: string;
  ceremonyId: string;
  phase: CeremonyPhase;
  request: GuardRequest;
  decision: GuardDecision;
}

// ─── Guard Factory ───────────────────────────────────────────────────────────

/**
 * Create an OCAP guard function bound to a ceremony context.
 * The guard checks consent, access level, phase permissions, and sacred gates.
 * Every decision is logged to the returned audit trail.
 */
export function createOcapGuard(ctx: OcapGuardContext): {
  check: (request: GuardRequest) => GuardDecision;
  getAuditTrail: () => readonly GuardAuditEntry[];
} {
  const auditTrail: GuardAuditEntry[] = [];

  function check(request: GuardRequest): GuardDecision {
    const checks: GuardCheck[] = [];
    const phase = ctx.getCurrentPhase();
    let allowed = true;
    let failReason = '';

    // 1. Ceremony must be active
    const ceremonyActive = ctx.isActive();
    checks.push({
      check: 'ceremony_active',
      passed: ceremonyActive,
      detail: ceremonyActive
        ? 'Ceremony is active'
        : 'No active ceremony — all non-public access denied',
    });
    if (!ceremonyActive) {
      allowed = false;
      failReason = 'No active ceremony context';
    }

    // 2. Consent check — action must be consented in context
    if (allowed) {
      const consented = ctx.isConsented(request.action, request.requester);
      checks.push({
        check: 'consent',
        passed: consented,
        detail: consented
          ? `Consent active for action '${request.action}'`
          : `No active consent for action '${request.action}' — OCAP Control violated`,
      });
      if (!consented) {
        allowed = false;
        failReason = `Consent not granted for action '${request.action}'`;
      }
    }

    // 3. Phase permission check — tool must be allowed in current phase
    if (allowed && request.toolName) {
      const toolAllowed = isToolAllowedInPhase(request.toolName, phase);
      checks.push({
        check: 'phase_permission',
        passed: toolAllowed,
        detail: toolAllowed
          ? `Tool '${request.toolName}' allowed in phase '${phase}'`
          : `Tool '${request.toolName}' not permitted in phase '${phase}'`,
      });
      if (!toolAllowed) {
        allowed = false;
        failReason = `Tool '${request.toolName}' not permitted in phase '${phase}'`;
      }
    }

    // 4. Access level hierarchy check
    if (allowed && request.targetOcap) {
      const nodeLevel = request.targetOcap.access;
      const requesterLevel = request.requesterAccessLevel;
      const meetsLevel = ACCESS_HIERARCHY[requesterLevel] >= ACCESS_HIERARCHY[nodeLevel];
      checks.push({
        check: 'access_level',
        passed: meetsLevel,
        detail: meetsLevel
          ? `Access granted: ${requesterLevel}(${ACCESS_HIERARCHY[requesterLevel]}) >= ${nodeLevel}(${ACCESS_HIERARCHY[nodeLevel]})`
          : `Access denied: ${requesterLevel}(${ACCESS_HIERARCHY[requesterLevel]}) < ${nodeLevel}(${ACCESS_HIERARCHY[nodeLevel]}) — OCAP Access violated`,
      });
      if (!meetsLevel) {
        allowed = false;
        failReason = `Insufficient access level: ${requesterLevel} < ${nodeLevel}`;
      }
    }

    // 5. Sacred gate — sacred access requires Opening phase to be complete
    if (allowed && request.targetOcap?.access === 'sacred') {
      const openingComplete = phaseIndex(phase) > 1; // past 'opening'
      checks.push({
        check: 'sacred_gate',
        passed: openingComplete,
        detail: openingComplete
          ? 'Sacred access: Opening phase complete, ceremony context established'
          : 'Sacred access denied: Opening phase not yet complete',
      });
      if (!openingComplete) {
        allowed = false;
        failReason = 'Sacred-level access requires Opening phase to be complete';
      }
    }

    const decision: GuardDecision = {
      allowed,
      reason: allowed ? 'All OCAP checks passed' : failReason,
      checks,
    };

    // Audit every decision
    auditTrail.push({
      timestamp: new Date().toISOString(),
      ceremonyId: ctx.getCeremonyId(),
      phase,
      request,
      decision,
    });

    return decision;
  }

  return { check, getAuditTrail: () => auditTrail };
}
