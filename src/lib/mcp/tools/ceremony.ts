/**
 * ceremony/ MCP Tool Namespace — Ceremony governance operations.
 *
 * 4 tools: ceremony/open, ceremony/advance, ceremony/close, ceremony/status
 *
 * Bridges MCP surface to CeremonyRuntime:
 *   - runtime.ts  → CeremonyRuntime (open, advance, close, guidance)
 *   - phases.ts   → phase validation, phase definitions
 *
 * Each tool follows the MCP handler pattern:
 *   parse input → execute logic → return { content: [{ type: 'text', text }] }
 */

import { z } from 'zod';
import { CeremonyRuntime } from '../../ceremony/runtime.js';
import type { CeremonyPhase } from '../../types/ceremony.js';
import {
  withGuards,
  requirePhase,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '../guards.js';
import type { ToolDefinition } from './sm.js';

// ─── Session-scoped ceremony store ───────────────────────────────────────────

const _ceremonies = new Map<string, CeremonyRuntime>();

export function getCeremony(id: string): CeremonyRuntime | undefined {
  return _ceremonies.get(id);
}

export function clearCeremonies(): void {
  _ceremonies.clear();
}

// ─── Input Schemas ───────────────────────────────────────────────────────────

const CeremonyOpenInputSchema = z.object({
  intent: z.string().describe('The intention or purpose for opening the ceremony'),
  participants: z.array(z.string()).optional()
    .describe('List of participant identifiers. Defaults to ["system"] if not provided.'),
});

const CeremonyAdvanceInputSchema = z.object({
  ceremonyId: z.string().describe('ID of the ceremony to advance to the next phase'),
});

const CeremonyCloseInputSchema = z.object({
  ceremonyId: z.string().describe('ID of the ceremony to close'),
});

const CeremonyStatusInputSchema = z.object({
  ceremonyId: z.string().optional()
    .describe('ID of a specific ceremony. If omitted, returns status of all active ceremonies.'),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

const ceremonyOpenDef: ToolDefinition = {
  name: 'ceremony/open',
  description: [
    'Open a new ceremony with a stated intention.',
    'Creates a CeremonyRuntime, transitions to opening phase,',
    'and returns the ceremony ID, current phase, and ceremonial guidance.',
  ].join(' '),
  inputSchema: CeremonyOpenInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const ceremonyAdvanceDef: ToolDefinition = {
  name: 'ceremony/advance',
  description: [
    'Advance a ceremony to the next sequential phase.',
    'Phases follow: preparation → opening → active → integration → closing.',
    'Returns the new phase and updated ceremonial guidance.',
  ].join(' '),
  inputSchema: CeremonyAdvanceInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const ceremonyCloseDef: ToolDefinition = {
  name: 'ceremony/close',
  description: [
    'Close an active ceremony. Finalizes the ceremony record,',
    'seals the audit trail, and returns the complete CeremonyRecord.',
  ].join(' '),
  inputSchema: CeremonyCloseInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const ceremonyStatusDef: ToolDefinition = {
  name: 'ceremony/status',
  description: [
    'Get the status of a ceremony or all active ceremonies.',
    'Returns current phase, participants, and ceremonial guidance.',
  ].join(' '),
  inputSchema: CeremonyStatusInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * ceremony/open handler — create and open a new ceremony.
 */
const handleCeremonyOpen: ToolHandler = async (args, _ctx) => {
  const parsed = CeremonyOpenInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for ceremony/open',
      issues: parsed.error.issues,
    });
  }

  const { intent, participants } = parsed.data;
  const participantList = participants ?? ['system'];

  const runtime = new CeremonyRuntime(intent, participantList);
  const record = runtime.openCeremony();
  const guidance = runtime.getCurrentGuidance();

  _ceremonies.set(runtime.getId(), runtime);

  return mcpSuccess({
    ceremonyId: runtime.getId(),
    phase: runtime.getCurrentPhase(),
    guidance,
    record,
  });
};

/**
 * ceremony/advance handler — advance ceremony to next phase.
 */
const handleCeremonyAdvance: ToolHandler = async (args, _ctx) => {
  const parsed = CeremonyAdvanceInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for ceremony/advance',
      issues: parsed.error.issues,
    });
  }

  const { ceremonyId } = parsed.data;
  const runtime = _ceremonies.get(ceremonyId);
  if (!runtime) {
    return mcpError('ceremony_not_found', {
      message: `No ceremony found with ID "${ceremonyId}"`,
      ceremonyId,
    });
  }

  try {
    const result = runtime.advancePhase();
    if (!result.allowed) {
      return mcpError('phase_advance_blocked', {
        message: result.reason,
        from: result.from,
        to: result.to,
      });
    }

    const guidance = runtime.getCurrentGuidance();

    return mcpSuccess({
      phase: runtime.getCurrentPhase(),
      transition: result,
      guidance,
    });
  } catch (err) {
    return mcpError('ceremony_error', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

/**
 * ceremony/close handler — close ceremony and return final record.
 */
const handleCeremonyClose: ToolHandler = async (args, _ctx) => {
  const parsed = CeremonyCloseInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for ceremony/close',
      issues: parsed.error.issues,
    });
  }

  const { ceremonyId } = parsed.data;
  const runtime = _ceremonies.get(ceremonyId);
  if (!runtime) {
    return mcpError('ceremony_not_found', {
      message: `No ceremony found with ID "${ceremonyId}"`,
      ceremonyId,
    });
  }

  try {
    const record = runtime.closeCeremony(true);
    _ceremonies.delete(ceremonyId);
    return mcpSuccess(record);
  } catch (err) {
    return mcpError('ceremony_error', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

/**
 * ceremony/status handler — get status of one or all ceremonies.
 */
const handleCeremonyStatus: ToolHandler = async (args, _ctx) => {
  const parsed = CeremonyStatusInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for ceremony/status',
      issues: parsed.error.issues,
    });
  }

  const { ceremonyId } = parsed.data;

  if (ceremonyId) {
    const runtime = _ceremonies.get(ceremonyId);
    if (!runtime) {
      return mcpError('ceremony_not_found', {
        message: `No ceremony found with ID "${ceremonyId}"`,
        ceremonyId,
      });
    }

    return mcpSuccess({
      ceremonyId: runtime.getId(),
      phase: runtime.getCurrentPhase(),
      active: runtime.isActive(),
      participants: runtime.getRecord().participants,
      guidance: runtime.getCurrentGuidance(),
    });
  }

  // Return all active ceremonies
  const active: Array<{
    ceremonyId: string;
    phase: CeremonyPhase;
    intention: string;
  }> = [];

  for (const [id, runtime] of _ceremonies) {
    active.push({
      ceremonyId: id,
      phase: runtime.getCurrentPhase(),
      intention: runtime.getRecord().intention,
    });
  }

  return mcpSuccess({
    activeCeremonies: active,
    count: active.length,
  });
};

// ─── Guarded Handlers ────────────────────────────────────────────────────────

const guardedCeremonyOpen = withGuards(
  [auditLog('ceremony/open')],
  handleCeremonyOpen,
);

const guardedCeremonyAdvance = withGuards(
  [requirePhase('opening', 'active', 'integration'), auditLog('ceremony/advance')],
  handleCeremonyAdvance,
);

const guardedCeremonyClose = withGuards(
  [auditLog('ceremony/close')],
  handleCeremonyClose,
);

const guardedCeremonyStatus = withGuards(
  [auditLog('ceremony/status')],
  handleCeremonyStatus,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  ceremonyOpenDef,
  ceremonyAdvanceDef,
  ceremonyCloseDef,
  ceremonyStatusDef,
];

export const handlers: Record<string, ToolHandler> = {
  'ceremony/open': guardedCeremonyOpen,
  'ceremony/advance': guardedCeremonyAdvance,
  'ceremony/close': guardedCeremonyClose,
  'ceremony/status': guardedCeremonyStatus,
};

/** Register all ceremony/ tools on an McpServer instance. */
export function registerCeremonyTools(server: {
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
