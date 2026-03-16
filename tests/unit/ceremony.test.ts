import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CeremonyRuntime } from '@forgewright/lib/ceremony/runtime';
import { ConsentManager } from '@forgewright/lib/ceremony/consent';
import { createOcapGuard, type OcapGuardContext } from '@forgewright/lib/ceremony/ocap-guard';
import { mapPhaseToDirection } from '@forgewright/lib/ceremony/medicine-wheel';
import { PHASE_ORDER, type CeremonyPhase } from '@forgewright/lib/types/ceremony';

// ─── CeremonyRuntime ─────────────────────────────────────────────────────────

describe('CeremonyRuntime', () => {
  let runtime: CeremonyRuntime;

  beforeEach(() => {
    runtime = new CeremonyRuntime('Test ceremony intention', ['participant-1', 'participant-2']);
  });

  it('opens with Opening phase', () => {
    const record = runtime.openCeremony();
    expect(runtime.getCurrentPhase()).toBe('opening');
    expect(runtime.isActive()).toBe(true);
    expect(record.phase).toBe('opening');
    expect(record.intention).toBe('Test ceremony intention');
  });

  it('advancePhase moves sequentially through all phases', () => {
    runtime.openCeremony();
    // opening → active
    const r1 = runtime.advancePhase();
    expect(r1.allowed).toBe(true);
    expect(r1.to).toBe('active');
    expect(runtime.getCurrentPhase()).toBe('active');

    // active → integration
    const r2 = runtime.advancePhase();
    expect(r2.allowed).toBe(true);
    expect(r2.to).toBe('integration');

    // integration → closing
    const r3 = runtime.advancePhase();
    expect(r3.allowed).toBe(true);
    expect(r3.to).toBe('closing');

    // closing is final — cannot advance further
    const r4 = runtime.advancePhase();
    expect(r4.allowed).toBe(false);
    expect(runtime.getCurrentPhase()).toBe('closing');
  });

  it('cannot skip phases (sequential enforcement)', () => {
    runtime.openCeremony();
    // We can only advance one step at a time — the API doesn't expose a "jump to" method.
    // Verify that after one advance we're at 'active', not 'integration'.
    runtime.advancePhase();
    expect(runtime.getCurrentPhase()).toBe('active');
    // A second advance goes to integration, not closing.
    runtime.advancePhase();
    expect(runtime.getCurrentPhase()).toBe('integration');
  });

  it('closeCeremony generates a CeremonyRecord', () => {
    runtime.openCeremony();
    // Advance to closing
    runtime.advancePhase(); // active
    runtime.advancePhase(); // integration
    runtime.advancePhase(); // closing

    const record = runtime.closeCeremony();
    expect(record).toBeDefined();
    expect(record.id).toBeDefined();
    expect(record.participants).toEqual(['participant-1', 'participant-2']);
    expect(record.intention).toBe('Test ceremony intention');
    expect(runtime.isActive()).toBe(false);
  });

  it('closeCeremony throws when not in closing phase (unless forced)', () => {
    runtime.openCeremony();
    expect(() => runtime.closeCeremony()).toThrow(/Cannot close ceremony/);
    // Force close works from any phase
    const record = runtime.closeCeremony(true);
    expect(record).toBeDefined();
    expect(runtime.isActive()).toBe(false);
  });

  it('throws when operating on inactive ceremony', () => {
    expect(() => runtime.advancePhase()).toThrow(/not active/);
    expect(() => runtime.closeCeremony()).toThrow(/not active/);
  });
});

// ─── OCAP Guard ──────────────────────────────────────────────────────────────

describe('OCAP Guard', () => {
  it('blocks sacred access without an active ceremony', () => {
    const ctx: OcapGuardContext = {
      getCurrentPhase: () => 'preparation',
      isActive: () => false,
      getCeremonyId: () => 'test-id',
      isConsented: () => true,
    };
    const guard = createOcapGuard(ctx);

    const decision = guard.check({
      action: 'read-sacred-data',
      requester: 'user-1',
      requesterAccessLevel: 'sacred',
      targetOcap: { ownership: 'community', control: 'ceremony', access: 'sacred', possession: 'local' },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.checks.some(c => c.check === 'ceremony_active' && !c.passed)).toBe(true);
  });

  it('allows public access even when ceremony is active (with consent)', () => {
    const ctx: OcapGuardContext = {
      getCurrentPhase: () => 'active',
      isActive: () => true,
      getCeremonyId: () => 'test-id',
      isConsented: () => true,
    };
    const guard = createOcapGuard(ctx);

    const decision = guard.check({
      action: 'read-public-data',
      requester: 'user-1',
      requesterAccessLevel: 'public',
      targetOcap: { ownership: 'system', control: 'open', access: 'public', possession: 'local' },
    });

    expect(decision.allowed).toBe(true);
  });

  it('audit trail records every check', () => {
    const ctx: OcapGuardContext = {
      getCurrentPhase: () => 'active',
      isActive: () => true,
      getCeremonyId: () => 'audit-test',
      isConsented: () => true,
    };
    const guard = createOcapGuard(ctx);

    guard.check({ action: 'a', requester: 'u', requesterAccessLevel: 'public' });
    guard.check({ action: 'b', requester: 'u', requesterAccessLevel: 'community' });

    expect(guard.getAuditTrail()).toHaveLength(2);
  });
});

// ─── ConsentManager ──────────────────────────────────────────────────────────

describe('ConsentManager', () => {
  let consent: ConsentManager;

  beforeEach(() => {
    consent = new ConsentManager();
  });

  it('grants, checks, and revokes consent', () => {
    const req = consent.requestConsent('test-action', 'test-context');
    expect(req.state).toBe('pending');

    consent.grantConsent(req.id);
    expect(consent.isConsented('test-action', 'test-context')).toBe(true);

    consent.revokeConsent(req.id);
    expect(consent.isConsented('test-action', 'test-context')).toBe(false);
  });

  it('expired consent is rejected', () => {
    // Create a consent that has already expired (duration 0ms)
    const req = consent.requestConsent('expire-test', 'ctx', { durationMs: 0 });
    consent.grantConsent(req.id);

    // isConsented checks expiry at call time — 0ms duration means already expired
    expect(consent.isConsented('expire-test', 'ctx')).toBe(false);
  });

  it('cannot grant already-active consent', () => {
    const req = consent.requestConsent('action', 'ctx');
    consent.grantConsent(req.id);
    expect(() => consent.grantConsent(req.id)).toThrow(/Cannot grant/);
  });

  it('cannot revoke non-active consent', () => {
    const req = consent.requestConsent('action', 'ctx');
    // Still pending — cannot revoke
    expect(() => consent.revokeConsent(req.id)).toThrow(/Cannot revoke/);
  });
});

// ─── Medicine Wheel Phase→Direction Mapping ──────────────────────────────────

describe('Medicine Wheel mapPhaseToDirection', () => {
  it('maps each phase to its correct direction', () => {
    const expected: Record<CeremonyPhase, string> = {
      preparation: 'east',
      opening: 'east',
      active: 'west',
      integration: 'north',
      closing: 'center',
    };

    for (const phase of PHASE_ORDER) {
      expect(mapPhaseToDirection(phase)).toBe(expected[phase]);
    }
  });
});
