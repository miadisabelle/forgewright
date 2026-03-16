/**
 * Consent Management
 *
 * OCAP principle: nothing happens without consent.
 * Consent is time-limited, scope-limited, and revocable.
 * Every consent action is audited.
 */

import { randomUUID } from 'crypto';
import type { ConsentState } from '../types/ocap';

// ─── Consent Request ─────────────────────────────────────────────────────────

export interface ConsentRequest {
  id: string;
  action: string;
  context: string;
  state: ConsentState;
  requestedAt: string;
  grantedAt?: string;
  revokedAt?: string;
  expiresAt: string;
  scope: string;
}

export interface ConsentAuditEntry {
  timestamp: string;
  requestId: string;
  action: string;
  transition: { from: ConsentState; to: ConsentState };
  reason: string;
}

// ─── Default Consent Duration (1 hour) ───────────────────────────────────────

const DEFAULT_CONSENT_DURATION_MS = 60 * 60 * 1000;

// ─── Consent Store ───────────────────────────────────────────────────────────

export class ConsentManager {
  private readonly requests = new Map<string, ConsentRequest>();
  private readonly auditTrail: ConsentAuditEntry[] = [];

  /**
   * Create a new consent request for an action in a given context.
   * The request starts in 'pending' state and must be explicitly granted.
   */
  requestConsent(
    action: string,
    context: string,
    options?: { scope?: string; durationMs?: number },
  ): ConsentRequest {
    const now = new Date();
    const duration = options?.durationMs ?? DEFAULT_CONSENT_DURATION_MS;
    const expiresAt = new Date(now.getTime() + duration);

    const request: ConsentRequest = {
      id: randomUUID(),
      action,
      context,
      state: 'pending',
      requestedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      scope: options?.scope ?? `${action}:${context}`,
    };

    this.requests.set(request.id, request);
    this.audit(request.id, action, 'pending', 'pending', 'Consent requested');

    return request;
  }

  /**
   * Grant a pending consent request. Only pending requests can be granted.
   */
  grantConsent(requestId: string): ConsentRequest {
    const request = this.getOrThrow(requestId);
    if (request.state !== 'pending') {
      throw new Error(`Cannot grant consent ${requestId}: state is '${request.state}', expected 'pending'`);
    }

    const now = new Date().toISOString();
    request.state = 'active';
    request.grantedAt = now;
    this.audit(requestId, request.action, 'pending', 'active', 'Consent granted');

    return request;
  }

  /**
   * Revoke an active consent. Only active consents can be revoked.
   */
  revokeConsent(requestId: string): ConsentRequest {
    const request = this.getOrThrow(requestId);
    if (request.state !== 'active') {
      throw new Error(`Cannot revoke consent ${requestId}: state is '${request.state}', expected 'active'`);
    }

    const now = new Date().toISOString();
    request.state = 'withdrawn';
    request.revokedAt = now;
    this.audit(requestId, request.action, 'active', 'withdrawn', 'Consent revoked');

    return request;
  }

  /**
   * Check whether an action+context pair currently has active, non-expired consent.
   */
  isConsented(action: string, context: string): boolean {
    const now = Date.now();

    for (const request of this.requests.values()) {
      if (request.action !== action || request.context !== context) continue;
      if (request.state !== 'active') continue;

      // Check expiry
      if (new Date(request.expiresAt).getTime() <= now) {
        this.expireRequest(request);
        continue;
      }

      return true;
    }

    return false;
  }

  /**
   * Find all consent requests matching an action and context.
   */
  findRequests(action: string, context: string): ConsentRequest[] {
    const results: ConsentRequest[] = [];
    for (const request of this.requests.values()) {
      if (request.action === action && request.context === context) {
        results.push({ ...request });
      }
    }
    return results;
  }

  /**
   * Get the full audit trail for accountability review.
   */
  getAuditTrail(): readonly ConsentAuditEntry[] {
    return this.auditTrail;
  }

  /**
   * Get a consent request by ID.
   */
  getRequest(requestId: string): ConsentRequest | undefined {
    const req = this.requests.get(requestId);
    return req ? { ...req } : undefined;
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private getOrThrow(requestId: string): ConsentRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Consent request ${requestId} not found`);
    }
    return request;
  }

  private expireRequest(request: ConsentRequest): void {
    if (request.state === 'active') {
      request.state = 'expired';
      this.audit(request.id, request.action, 'active', 'expired', 'Consent expired (time limit reached)');
    }
  }

  private audit(
    requestId: string,
    action: string,
    from: ConsentState,
    to: ConsentState,
    reason: string,
  ): void {
    this.auditTrail.push({
      timestamp: new Date().toISOString(),
      requestId,
      action,
      transition: { from, to },
      reason,
    });
  }
}
