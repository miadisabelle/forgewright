/**
 * MCP Guard Middleware — reusable higher-order functions for tool access control.
 *
 * Guards wrap tool handlers to enforce ceremony phase, OCAP access level,
 * and audit logging before the handler executes. Composable via withGuards().
 *
 * Pattern from: mcp-sdk-findings.md §6 — MCP SDK has no built-in middleware,
 * so we implement via higher-order functions.
 */

import type { CeremonyPhase } from '../types/ceremony';
import type { AccessLevel } from '../types/ocap';

// ─── Types ───────────────────────────────────────────────────────────────────

/** The MCP-standard tool result shape. */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  structuredContent?: unknown;
}

/** A tool handler function: takes parsed args, returns ToolResult. */
export type ToolHandler<T = Record<string, unknown>> = (
  args: T,
  ctx?: ToolContext,
) => Promise<ToolResult>;

/** A guard function: wraps a handler, returns a handler with the same shape. */
export type Guard = <T>(handler: ToolHandler<T>) => ToolHandler<T>;

/** Contextual information available to guards and handlers. */
export interface ToolContext {
  sessionId?: string;
  ceremonyPhase?: CeremonyPhase;
  accessLevel?: AccessLevel;
  [key: string]: unknown;
}

/** Audit log entry produced by auditLog guard. */
export interface AuditEntry {
  timestamp: string;
  toolName: string;
  sessionId?: string;
  ceremonyPhase?: string;
  accessLevel?: string;
  args?: Record<string, unknown>;
  durationMs?: number;
  success: boolean;
  error?: string;
}

// ─── Audit log store (in-memory, exportable) ─────────────────────────────────

const _auditLog: AuditEntry[] = [];

export function getAuditLog(): readonly AuditEntry[] {
  return _auditLog;
}

export function clearAuditLog(): void {
  _auditLog.length = 0;
}

// ─── Guard: withGuards ───────────────────────────────────────────────────────

/**
 * Compose multiple guards around a handler.
 * Guards are applied right-to-left (outermost guard listed first).
 *
 * @example
 * ```ts
 * withGuards(
 *   [requirePhase('active'), requireOcap('community'), auditLog('sm/create')],
 *   actualHandler,
 * )
 * ```
 */
export function withGuards<T>(
  guards: Guard[],
  handler: ToolHandler<T>,
): ToolHandler<T> {
  return guards.reduceRight(
    (h, guard) => guard(h),
    handler,
  ) as ToolHandler<T>;
}

// ─── Guard: requirePhase ─────────────────────────────────────────────────────

/**
 * Guard that checks if the current ceremony phase matches the allowed phase(s).
 * If no ceremony is active (ctx.ceremonyPhase is undefined), the guard passes
 * to allow non-ceremonial usage.
 */
export function requirePhase(...allowedPhases: CeremonyPhase[]): Guard {
  return <T>(handler: ToolHandler<T>): ToolHandler<T> => {
    return async (args: T, ctx?: ToolContext): Promise<ToolResult> => {
      const currentPhase = ctx?.ceremonyPhase;

      // No active ceremony → allow through (non-ceremonial context)
      if (currentPhase === undefined) {
        return handler(args, ctx);
      }

      if (!allowedPhases.includes(currentPhase)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'phase_guard_blocked',
              message: `Tool blocked: ceremony phase "${currentPhase}" not in allowed phases [${allowedPhases.join(', ')}]`,
              currentPhase,
              allowedPhases,
            }),
          }],
          isError: true,
        };
      }

      return handler(args, ctx);
    };
  };
}

// ─── Guard: requireOcap ──────────────────────────────────────────────────────

/**
 * Access level hierarchy: public < community < ceremony < sacred.
 * The guard checks if the session's access level meets or exceeds the required level.
 */
const ACCESS_HIERARCHY: Record<AccessLevel, number> = {
  public: 0,
  community: 1,
  ceremony: 2,
  sacred: 3,
};

export function requireOcap(minimumLevel: AccessLevel): Guard {
  return <T>(handler: ToolHandler<T>): ToolHandler<T> => {
    return async (args: T, ctx?: ToolContext): Promise<ToolResult> => {
      const sessionLevel = ctx?.accessLevel ?? 'public';
      const required = ACCESS_HIERARCHY[minimumLevel];
      const current = ACCESS_HIERARCHY[sessionLevel];

      if (current < required) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'ocap_guard_blocked',
              message: `Access denied: requires "${minimumLevel}" level, session has "${sessionLevel}"`,
              requiredLevel: minimumLevel,
              sessionLevel,
            }),
          }],
          isError: true,
        };
      }

      return handler(args, ctx);
    };
  };
}

// ─── Guard: auditLog ─────────────────────────────────────────────────────────

/**
 * Guard that logs every tool invocation with timing.
 * Logs both successful and failed invocations.
 * Entries are stored in-memory and retrievable via getAuditLog().
 */
export function auditLog(toolName: string): Guard {
  return <T>(handler: ToolHandler<T>): ToolHandler<T> => {
    return async (args: T, ctx?: ToolContext): Promise<ToolResult> => {
      const start = Date.now();
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        toolName,
        sessionId: ctx?.sessionId,
        ceremonyPhase: ctx?.ceremonyPhase,
        accessLevel: ctx?.accessLevel,
        args: args as Record<string, unknown>,
        durationMs: 0,
        success: false,
      };

      try {
        const result = await handler(args, ctx);
        entry.durationMs = Date.now() - start;
        entry.success = !result.isError;
        if (result.isError) {
          entry.error = result.content[0]?.text;
        }
        _auditLog.push(entry);
        return result;
      } catch (err) {
        entry.durationMs = Date.now() - start;
        entry.success = false;
        entry.error = err instanceof Error ? err.message : String(err);
        _auditLog.push(entry);
        throw err;
      }
    };
  };
}

// ─── Helper: error response ──────────────────────────────────────────────────

/** Create a standard MCP error response. */
export function mcpError(error: string, details?: Record<string, unknown>): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ error, ...details }),
    }],
    isError: true,
  };
}

/** Create a standard MCP success response. */
export function mcpSuccess(data: unknown): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2),
    }],
  };
}
