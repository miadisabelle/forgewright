/**
 * Ceremony + OCAP Guard — integration tests.
 *
 * Validates cross-module interactions between:
 *   CeremonyRuntime ↔ OcapGuard ↔ ConsentManager ↔ phase permissions
 *
 * Tests: full ceremony lifecycle, sacred access gating, consent flow,
 *        phase transition records, and tool permission enforcement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CeremonyRuntime } from '@forgewright/lib/ceremony/runtime.js';
import { ConsentManager } from '@forgewright/lib/ceremony/consent.js';
import { PHASE_ORDER } from '@forgewright/lib/types/ceremony.js';
import { isToolAllowedInPhase, PHASE_DEFINITIONS } from '@forgewright/lib/ceremony/phases.js';
import type { CeremonyPhase } from '@forgewright/lib/types/ceremony.js';

// Mock filesystem
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Ceremony + OCAP Integration', () => {

  // ── Test 1: open → advance through all phases → close ─────────────────────

  it('advances through all 5 ceremony phases in sequence', () => {
    const ceremony = new CeremonyRuntime('Test ceremony intention', ['Mia', 'Miette']);

    // Before opening: preparation phase, not active
    expect(ceremony.getCurrentPhase()).toBe('preparation');
    expect(ceremony.isActive()).toBe(false);

    // Open ceremony
    const record = ceremony.openCeremony();
    expect(ceremony.getCurrentPhase()).toBe('opening');
    expect(ceremony.isActive()).toBe(true);
    expect(record.participants).toContain('Mia');
    expect(record.participants).toContain('Miette');

    // opening → active
    const r1 = ceremony.advancePhase();
    expect(r1.allowed).toBe(true);
    expect(r1.from).toBe('opening');
    expect(r1.to).toBe('active');
    expect(ceremony.getCurrentPhase()).toBe('active');

    // active → integration
    const r2 = ceremony.advancePhase();
    expect(r2.allowed).toBe(true);
    expect(r2.from).toBe('active');
    expect(r2.to).toBe('integration');
    expect(ceremony.getCurrentPhase()).toBe('integration');

    // integration → closing
    const r3 = ceremony.advancePhase();
    expect(r3.allowed).toBe(true);
    expect(r3.from).toBe('integration');
    expect(r3.to).toBe('closing');
    expect(ceremony.getCurrentPhase()).toBe('closing');

    // Cannot advance past closing
    const r4 = ceremony.advancePhase();
    expect(r4.allowed).toBe(false);
    expect(r4.reason).toContain('final phase');

    // Close ceremony
    const closeRecord = ceremony.closeCeremony();
    expect(ceremony.isActive()).toBe(false);
    expect(closeRecord.id).toBeTruthy();
  });

  // ── Test 2: OCAP guard integrates with ceremony phase ─────────────────────

  it('sacred access denied before Opening, allowed after Active phase', () => {
    const ceremony = new CeremonyRuntime('Sacred access test', ['keeper']);
    ceremony.openCeremony();

    const guard = ceremony.getGuard();
    const consent = ceremony.getConsentManager();

    // Grant consent for the sacred access action
    const req = consent.requestConsent('access:sacred', ceremony.getId());
    consent.grantConsent(req.id);

    // At Opening phase (phaseIndex=1): sacred gate requires past Opening (>1)
    const atOpening = guard.check({
      action: 'access:sacred',
      requester: ceremony.getId(),
      requesterAccessLevel: 'sacred',
      targetOcap: { ownership: 'system', control: 'ceremony', access: 'sacred', possession: 'local' },
    });
    expect(atOpening.allowed).toBe(false);
    expect(atOpening.checks.find(c => c.check === 'sacred_gate')?.passed).toBe(false);

    // Advance to Active phase
    ceremony.advancePhase(); // opening → active
    expect(ceremony.getCurrentPhase()).toBe('active');

    // At Active phase (phaseIndex=2): sacred gate should pass
    const atActive = guard.check({
      action: 'access:sacred',
      requester: ceremony.getId(),
      requesterAccessLevel: 'sacred',
      targetOcap: { ownership: 'system', control: 'ceremony', access: 'sacred', possession: 'local' },
    });
    expect(atActive.allowed).toBe(true);
    expect(atActive.checks.every(c => c.passed)).toBe(true);
  });

  // ── Test 3: consent lifecycle within ceremony context ─────────────────────

  it('full consent lifecycle: request → grant → active check → revoke → expired', () => {
    const consent = new ConsentManager();

    // Request consent
    const req = consent.requestConsent('tool:execute', 'ceremony-001');
    expect(req.state).toBe('pending');
    expect(req.id).toBeTruthy();

    // Not yet consented (pending)
    expect(consent.isConsented('tool:execute', 'ceremony-001')).toBe(false);

    // Grant consent
    const granted = consent.grantConsent(req.id);
    expect(granted.state).toBe('active');
    expect(granted.grantedAt).toBeTruthy();

    // Now consented
    expect(consent.isConsented('tool:execute', 'ceremony-001')).toBe(true);

    // Cannot grant again (already active)
    expect(() => consent.grantConsent(req.id)).toThrow('active');

    // Revoke consent
    const revoked = consent.revokeConsent(req.id);
    expect(revoked.state).toBe('withdrawn');
    expect(revoked.revokedAt).toBeTruthy();

    // No longer consented
    expect(consent.isConsented('tool:execute', 'ceremony-001')).toBe(false);

    // Cannot revoke again (already withdrawn)
    expect(() => consent.revokeConsent(req.id)).toThrow('withdrawn');

    // Audit trail records all transitions
    const trail = consent.getAuditTrail();
    expect(trail.length).toBeGreaterThanOrEqual(3);

    // Transitions: pending→pending (request), pending→active (grant), active→withdrawn (revoke)
    const transitions = trail.map(e => `${e.transition.from}→${e.transition.to}`);
    expect(transitions).toContain('pending→pending');
    expect(transitions).toContain('pending→active');
    expect(transitions).toContain('active→withdrawn');
  });

  // ── Test 4: ceremony record includes all phase transitions ────────────────

  it('ceremony events capture every phase transition and closure', () => {
    const ceremony = new CeremonyRuntime('Full audit test', ['observer']);
    ceremony.openCeremony();

    // Advance through all phases
    ceremony.advancePhase(); // opening → active
    ceremony.advancePhase(); // active → integration
    ceremony.advancePhase(); // integration → closing

    // Close
    ceremony.closeCeremony();

    // Gather all events
    const events = ceremony.getEvents();

    // Should have: ceremony:opened + 3 phase:advanced + ceremony:closed = 5 events
    expect(events.length).toBe(5);

    const types = events.map(e => e.type);
    expect(types[0]).toBe('ceremony:opened');
    expect(types[1]).toBe('phase:advanced');
    expect(types[2]).toBe('phase:advanced');
    expect(types[3]).toBe('phase:advanced');
    expect(types[4]).toBe('ceremony:closed');

    // Each event has an ID, timestamp, and description
    for (const evt of events) {
      expect(evt.id).toBeTruthy();
      expect(evt.timestamp).toBeTruthy();
      expect(evt.description).toBeTruthy();
    }

    // Phase transitions are described in order
    expect(events[1].description).toContain('opening → active');
    expect(events[2].description).toContain('active → integration');
    expect(events[3].description).toContain('integration → closing');
  });

  // ── Test 5: OCAP guard blocks without active ceremony ─────────────────────

  it('OCAP guard blocks all non-public access when ceremony is inactive', () => {
    const ceremony = new CeremonyRuntime('Guard test', ['user']);
    const guard = ceremony.getGuard();

    // Ceremony not opened — guard should block
    const decision = guard.check({
      action: 'read:sacred',
      requester: 'user',
      requesterAccessLevel: 'sacred',
      targetOcap: { ownership: 'system', control: 'ceremony', access: 'community', possession: 'local' },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.checks.find(c => c.check === 'ceremony_active')?.passed).toBe(false);

    // Audit trail records the denial
    const trail = guard.getAuditTrail();
    expect(trail).toHaveLength(1);
    expect(trail[0].decision.allowed).toBe(false);
  });

  // ── Test 6: tool permissions change with ceremony phase ───────────────────

  it('tool permissions expand and contract across ceremony phases', () => {
    // Preparation: only pde and graph:read
    expect(isToolAllowedInPhase('pde', 'preparation')).toBe(true);
    expect(isToolAllowedInPhase('graph:read', 'preparation')).toBe(true);
    expect(isToolAllowedInPhase('smcraft', 'preparation')).toBe(false);
    expect(isToolAllowedInPhase('ceremony', 'preparation')).toBe(false);

    // Opening: adds ceremony
    expect(isToolAllowedInPhase('ceremony', 'opening')).toBe(true);
    expect(isToolAllowedInPhase('smcraft', 'opening')).toBe(false);

    // Active: full access (pde, graph:read, graph:write, smcraft, narrative, ceremony)
    expect(isToolAllowedInPhase('smcraft', 'active')).toBe(true);
    expect(isToolAllowedInPhase('graph:write', 'active')).toBe(true);
    expect(isToolAllowedInPhase('narrative', 'active')).toBe(true);

    // Integration: read + narrative + ceremony only
    expect(isToolAllowedInPhase('graph:read', 'integration')).toBe(true);
    expect(isToolAllowedInPhase('narrative', 'integration')).toBe(true);
    expect(isToolAllowedInPhase('smcraft', 'integration')).toBe(false);
    expect(isToolAllowedInPhase('graph:write', 'integration')).toBe(false);

    // Closing: same as integration
    expect(isToolAllowedInPhase('ceremony', 'closing')).toBe(true);
    expect(isToolAllowedInPhase('pde', 'closing')).toBe(false);
  });

  // ── Test 7: OCAP guard consent check integrates with ceremony ─────────────

  it('guard denies access when consent is missing even if ceremony is active', () => {
    const ceremony = new CeremonyRuntime('Consent integration test', ['agent']);
    ceremony.openCeremony();
    ceremony.advancePhase(); // → active

    const guard = ceremony.getGuard();

    // No consent granted for this action — guard should deny at consent check
    const decision = guard.check({
      action: 'write:graph',
      requester: 'agent',
      requesterAccessLevel: 'community',
      targetOcap: { ownership: 'system', control: 'ceremony', access: 'community', possession: 'local' },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.checks.find(c => c.check === 'consent')?.passed).toBe(false);

    // Now grant consent
    const cm = ceremony.getConsentManager();
    const req = cm.requestConsent('write:graph', 'agent');
    cm.grantConsent(req.id);

    // Retry — should pass now
    const decision2 = guard.check({
      action: 'write:graph',
      requester: 'agent',
      requesterAccessLevel: 'community',
      targetOcap: { ownership: 'system', control: 'ceremony', access: 'community', possession: 'local' },
    });

    expect(decision2.allowed).toBe(true);
  });

  // ── Test 8: ceremony guidance reflects Medicine Wheel balance ──────────────

  it('ceremony guidance reports neglected directions and balance score', () => {
    const ceremony = new CeremonyRuntime('Guidance test', ['seeker']);
    ceremony.openCeremony();

    // At Opening (East direction) — only East is visited
    const guidance = ceremony.getCurrentGuidance();

    expect(guidance.balanceScore).toBeLessThan(1.0);
    expect(guidance.neglectedDirections.length).toBeGreaterThan(0);
    expect(guidance.recommendation).toBeTruthy();
    expect(guidance.intention).toBe('Guidance test');
    expect(guidance.protocol).toContain('opening');
  });

  // ── Test 9: phase retreat is audited ──────────────────────────────────────

  it('phase retreat creates audit event and allows re-advancement', () => {
    const ceremony = new CeremonyRuntime('Retreat test', ['healer']);
    ceremony.openCeremony();
    ceremony.advancePhase(); // opening → active

    // Retreat: active → opening
    const retreat = ceremony.retreatPhase();
    expect(retreat.allowed).toBe(true);
    expect(retreat.from).toBe('active');
    expect(retreat.to).toBe('opening');
    expect(ceremony.getCurrentPhase()).toBe('opening');

    // Retreat is recorded in events
    const events = ceremony.getEvents();
    const retreatEvt = events.find(e => e.type === 'phase:retreated');
    expect(retreatEvt).toBeDefined();
    expect(retreatEvt!.description).toContain('active → opening');

    // Can re-advance
    const advance = ceremony.advancePhase();
    expect(advance.allowed).toBe(true);
    expect(ceremony.getCurrentPhase()).toBe('active');
  });
});
