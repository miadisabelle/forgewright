/**
 * MCP Guard Middleware Tests
 *
 * Tests: withGuards composition, requirePhase enforcement,
 * requireOcap hierarchy, auditLog recording.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  withGuards,
  requirePhase,
  requireOcap,
  auditLog,
  getAuditLog,
  clearAuditLog,
  mcpSuccess,
  mcpError,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '@forgewright/lib/mcp/guards.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal handler that echoes args back as a success response. */
const echoHandler: ToolHandler = async (args) =>
  mcpSuccess({ received: args });

/** Parse the JSON text out of an MCP ToolResult. */
function parseResult(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0].text);
}

// ─── withGuards ──────────────────────────────────────────────────────────────

describe('withGuards', () => {
  beforeEach(() => clearAuditLog());

  it('chains multiple guards and all pass', async () => {
    const guarded = withGuards(
      [requirePhase('active'), requireOcap('community'), auditLog('test/echo')],
      echoHandler,
    );

    const ctx: ToolContext = {
      ceremonyPhase: 'active',
      accessLevel: 'community',
    };
    const result = await guarded({ foo: 1 }, ctx);

    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.received).toEqual({ foo: 1 });
    expect(getAuditLog()).toHaveLength(1);
  });

  it('short-circuits at the first failing guard', async () => {
    const guarded = withGuards(
      [requirePhase('closing'), requireOcap('sacred'), auditLog('test/blocked')],
      echoHandler,
    );

    const ctx: ToolContext = {
      ceremonyPhase: 'active',
      accessLevel: 'public',
    };
    const result = await guarded({}, ctx);

    // requirePhase fires first (outermost), blocks before requireOcap or auditLog
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toBe('phase_guard_blocked');
    // auditLog never executed because phase guard returned early
    expect(getAuditLog()).toHaveLength(0);
  });
});

// ─── requirePhase ────────────────────────────────────────────────────────────

describe('requirePhase', () => {
  it('blocks when phase does not match', async () => {
    const guarded = requirePhase('active')(echoHandler);
    const ctx: ToolContext = { ceremonyPhase: 'preparation' };

    const result = await guarded({}, ctx);
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toBe('phase_guard_blocked');
    expect(data.currentPhase).toBe('preparation');
    expect(data.allowedPhases).toEqual(['active']);
  });

  it('passes when phase matches', async () => {
    const guarded = requirePhase('opening', 'active')(echoHandler);
    const ctx: ToolContext = { ceremonyPhase: 'active' };

    const result = await guarded({ x: 42 }, ctx);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.received).toEqual({ x: 42 });
  });

  it('passes when no ceremony is active (phase undefined)', async () => {
    const guarded = requirePhase('active')(echoHandler);
    // No ctx or ctx without ceremonyPhase → non-ceremonial usage, guard passes
    const result = await guarded({ y: 7 });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.received).toEqual({ y: 7 });
  });

  it('blocks when phase is set but not in allowed list', async () => {
    const guarded = requirePhase('opening', 'closing')(echoHandler);
    const ctx: ToolContext = { ceremonyPhase: 'integration' };

    const result = await guarded({}, ctx);
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.allowedPhases).toEqual(['opening', 'closing']);
  });
});

// ─── requireOcap ─────────────────────────────────────────────────────────────

describe('requireOcap', () => {
  it('blocks insufficient access level', async () => {
    const guarded = requireOcap('ceremony')(echoHandler);
    const ctx: ToolContext = { accessLevel: 'public' };

    const result = await guarded({}, ctx);
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.error).toBe('ocap_guard_blocked');
    expect(data.requiredLevel).toBe('ceremony');
    expect(data.sessionLevel).toBe('public');
  });

  it('respects hierarchy: public < community < ceremony < sacred', async () => {
    const levels = ['public', 'community', 'ceremony', 'sacred'] as const;

    // For each required level, test all session levels
    for (let reqIdx = 0; reqIdx < levels.length; reqIdx++) {
      const guard = requireOcap(levels[reqIdx]);

      for (let sessIdx = 0; sessIdx < levels.length; sessIdx++) {
        const guarded = guard(echoHandler);
        const ctx: ToolContext = { accessLevel: levels[sessIdx] };
        const result = await guarded({}, ctx);

        if (sessIdx >= reqIdx) {
          expect(result.isError).toBeUndefined();
        } else {
          expect(result.isError).toBe(true);
        }
      }
    }
  });

  it('defaults to public when no access level in context', async () => {
    const guarded = requireOcap('community')(echoHandler);
    // No ctx → defaults to public, which is < community → blocked
    const result = await guarded({});
    expect(result.isError).toBe(true);
    const data = parseResult(result);
    expect(data.sessionLevel).toBe('public');
  });

  it('allows equal access level', async () => {
    const guarded = requireOcap('sacred')(echoHandler);
    const ctx: ToolContext = { accessLevel: 'sacred' };
    const result = await guarded({}, ctx);
    expect(result.isError).toBeUndefined();
  });
});

// ─── auditLog ────────────────────────────────────────────────────────────────

describe('auditLog', () => {
  beforeEach(() => clearAuditLog());

  it('records invocation on success', async () => {
    const guarded = auditLog('test/tool')(echoHandler);
    await guarded({ input: 'hello' }, { sessionId: 'ses-1' });

    const log = getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].toolName).toBe('test/tool');
    expect(log[0].sessionId).toBe('ses-1');
    expect(log[0].success).toBe(true);
    expect(log[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(log[0].timestamp).toBeDefined();
    expect(log[0].args).toEqual({ input: 'hello' });
  });

  it('records invocation on error response', async () => {
    const failHandler: ToolHandler = async () =>
      mcpError('some_error', { detail: 'bad' });

    const guarded = auditLog('test/fail')(failHandler);
    await guarded({});

    const log = getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].success).toBe(false);
    expect(log[0].error).toBeDefined();
  });

  it('records invocation on thrown exception', async () => {
    const throwHandler: ToolHandler = async () => {
      throw new Error('boom');
    };

    const guarded = auditLog('test/throw')(throwHandler);
    await expect(guarded({})).rejects.toThrow('boom');

    const log = getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].success).toBe(false);
    expect(log[0].error).toBe('boom');
  });

  it('captures context metadata', async () => {
    const guarded = auditLog('test/ctx')(echoHandler);
    await guarded({}, {
      sessionId: 'ses-ctx',
      ceremonyPhase: 'active',
      accessLevel: 'ceremony',
    });

    const entry = getAuditLog()[0];
    expect(entry.ceremonyPhase).toBe('active');
    expect(entry.accessLevel).toBe('ceremony');
  });

  it('clearAuditLog resets the log', async () => {
    const guarded = auditLog('test/clear')(echoHandler);
    await guarded({});
    expect(getAuditLog()).toHaveLength(1);

    clearAuditLog();
    expect(getAuditLog()).toHaveLength(0);
  });
});

// ─── mcpSuccess / mcpError helpers ───────────────────────────────────────────

describe('mcpSuccess / mcpError', () => {
  it('mcpSuccess returns MCP standard format', () => {
    const result = mcpSuccess({ hello: 'world' });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ hello: 'world' });
    expect(result.isError).toBeUndefined();
  });

  it('mcpError returns MCP standard format with isError', () => {
    const result = mcpError('test_error', { extra: 1 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe('test_error');
    expect(data.extra).toBe(1);
    expect(result.isError).toBe(true);
  });
});
