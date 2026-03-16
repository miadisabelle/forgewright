/**
 * session/ MCP Tool Namespace — Session management operations.
 *
 * 2 tools: session/create, session/status
 *
 * Manages Forgewright development sessions with spiral tracking,
 * companion references, and checkpoint policies.
 *
 * Each tool follows the MCP handler pattern:
 *   parse input → execute logic → return { content: [{ type: 'text', text }] }
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ForgewrightSession, SpiralPosition } from '../../types/session';
import {
  withGuards,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '../guards';
import type { ToolDefinition } from './sm';

// ─── Session-scoped session store ────────────────────────────────────────────

const _sessions = new Map<string, ForgewrightSession>();

export function getSession(id: string): ForgewrightSession | undefined {
  return _sessions.get(id);
}

export function clearSessions(): void {
  _sessions.clear();
}

// ─── Input Schemas ───────────────────────────────────────────────────────────

const SessionCreateInputSchema = z.object({
  intent: z.string().describe('The primary intention or mission for this session'),
});

const SessionStatusInputSchema = z.object({
  sessionId: z.string().optional()
    .describe('ID of a specific session. If omitted, returns status of all active sessions.'),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

const sessionCreateDef: ToolDefinition = {
  name: 'session/create',
  description: [
    'Create a new Forgewright development session.',
    'Initializes spiral position at East (cycle 0), sets status to active.',
    'Returns the session ID and initial state.',
  ].join(' '),
  inputSchema: SessionCreateInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const sessionStatusDef: ToolDefinition = {
  name: 'session/status',
  description: [
    'Get the status of a session or all active sessions.',
    'Returns session state, spiral position, linked ceremony and STC chart IDs.',
  ].join(' '),
  inputSchema: SessionStatusInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * session/create handler — create a new Forgewright session.
 */
const handleSessionCreate: ToolHandler = async (args, _ctx) => {
  const parsed = SessionCreateInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for session/create',
      issues: parsed.error.issues,
    });
  }

  const { intent } = parsed.data;
  const now = new Date().toISOString();

  const spiralPosition: SpiralPosition = {
    direction: 'east',
    cycleCount: 0,
    maxCycles: 4,
    isAtCheckpoint: false,
  };

  const session: ForgewrightSession = {
    id: `session_${randomUUID().slice(0, 12)}`,
    intent,
    companions: [],
    spiralPosition,
    status: 'active',
    checkpointPolicy: {
      type: 'direction-change',
      mandatoryAt: [],
      maxAutonomousCycles: 3,
    },
    createdAt: now,
    updatedAt: now,
  };

  _sessions.set(session.id, session);

  return mcpSuccess({
    sessionId: session.id,
    intent: session.intent,
    status: session.status,
    spiralPosition: session.spiralPosition,
    createdAt: session.createdAt,
  });
};

/**
 * session/status handler — get status of one or all sessions.
 */
const handleSessionStatus: ToolHandler = async (args, _ctx) => {
  const parsed = SessionStatusInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for session/status',
      issues: parsed.error.issues,
    });
  }

  const { sessionId } = parsed.data;

  if (sessionId) {
    const session = _sessions.get(sessionId);
    if (!session) {
      return mcpError('session_not_found', {
        message: `No session found with ID "${sessionId}"`,
        sessionId,
      });
    }

    return mcpSuccess({
      sessionId: session.id,
      intent: session.intent,
      status: session.status,
      spiralPosition: session.spiralPosition,
      companions: session.companions,
      ceremonyId: session.ceremonyId ?? null,
      stcChartId: session.stcChartId ?? null,
      machineState: session.machineState ?? null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  }

  // Return all active sessions
  const active: Array<{
    sessionId: string;
    intent: string;
    status: string;
    spiralPosition: SpiralPosition;
  }> = [];

  for (const [id, session] of _sessions) {
    if (session.status === 'active' || session.status === 'paused') {
      active.push({
        sessionId: id,
        intent: session.intent,
        status: session.status,
        spiralPosition: session.spiralPosition,
      });
    }
  }

  return mcpSuccess({
    activeSessions: active,
    count: active.length,
  });
};

// ─── Guarded Handlers ────────────────────────────────────────────────────────

const guardedSessionCreate = withGuards(
  [auditLog('session/create')],
  handleSessionCreate,
);

const guardedSessionStatus = withGuards(
  [auditLog('session/status')],
  handleSessionStatus,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  sessionCreateDef,
  sessionStatusDef,
];

export const handlers: Record<string, ToolHandler> = {
  'session/create': guardedSessionCreate,
  'session/status': guardedSessionStatus,
};

/** Register all session/ tools on an McpServer instance. */
export function registerSessionTools(server: {
  registerTool: (
    name: string,
    config: { description: string; inputSchema: z.ZodType; annotations?: Record<string, boolean> },
    handler: (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
  ) => void;
}): void {
  for (const def of tools) {
    const handler = handlers[def.name];
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      handler as (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
    );
  }
}
