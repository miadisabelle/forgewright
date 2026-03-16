/**
 * pipeline/session_cycle — Session direction cycle compound pipeline.
 *
 * Advances a session through the Medicine Wheel spiral, firing
 * direction-appropriate MCP tools at each step:
 *
 *   East  → pde/decompose (vision & inquiry)
 *   South → graph/query (relational context)
 *   West  → stc/assess + ceremony/status (experience & validation)
 *   North → sm/fire + graph/ingest (reflection & integration)
 *
 * Each cycle generates a narrative beat and optionally triggers a checkpoint.
 *
 * Returns { direction, beat, wilsonScore, nextDirection }
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { DirectionNameSchema, DIRECTION_NAMES, DIRECTIONS, type DirectionName } from '../../types/directions';
import { getSession } from '../tools/session';
import { handlers as pdeHandlers } from '../tools/pde';
import { handlers as graphHandlers } from '../tools/graph';
import { handlers as stcHandlers } from '../tools/stc';
import { handlers as ceremonyHandlers } from '../tools/ceremony';
import { handlers as smHandlers } from '../tools/sm';
import {
  withGuards,
  requireOcap,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '../guards';
import type { ToolDefinition } from '../tools/sm';

// ─── Input Schema ────────────────────────────────────────────────────────────

const SessionCycleInputSchema = z.object({
  sessionId: z.string().describe('ID of the active session to advance'),
  direction: DirectionNameSchema
    .describe('The direction to cycle into: east, south, west, or north'),
});

// ─── Tool Definition ─────────────────────────────────────────────────────────

export const sessionCycleDef: ToolDefinition = {
  name: 'pipeline/session_cycle',
  description: [
    'Advance a session through one direction of the Medicine Wheel spiral.',
    'East: runs pde/decompose for vision. South: runs graph/query for relational context.',
    'West: runs stc/assess + ceremony/status for validation.',
    'North: runs sm/fire + graph/ingest for integration.',
    'Generates a narrative beat and returns Wilson score + next direction.',
  ].join(' '),
  inputSchema: SessionCycleInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseToolResult(result: ToolResult): Record<string, unknown> | null {
  const text = result.content[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function nextDirection(current: DirectionName): DirectionName {
  const idx = DIRECTION_NAMES.indexOf(current);
  return DIRECTION_NAMES[(idx + 1) % DIRECTION_NAMES.length];
}

function directionToAct(d: DirectionName): number {
  return DIRECTIONS[d].act;
}

// ─── Direction Runners ───────────────────────────────────────────────────────

async function runEast(
  session: { intent: string },
  ctx?: ToolContext,
): Promise<{ directionData: Record<string, unknown>; beatContent: string }> {
  const pdeDecompose = pdeHandlers['pde/decompose'];
  const result = await pdeDecompose(
    { prompt: session.intent, mode: 'keyword', extractImplicit: true, mapDependencies: true },
    ctx,
  );
  const data = parseToolResult(result) ?? {};

  return {
    directionData: {
      tool: 'pde/decompose',
      leadDirection: data.leadDirection,
      actionStackSize: (data.actionStack as unknown[])?.length ?? 0,
      decompositionId: data.id,
    },
    beatContent: `🌅 East inquiry: decomposed intent "${session.intent}" — lead direction: ${data.leadDirection ?? 'unknown'}, ${(data.actionStack as unknown[])?.length ?? 0} action steps identified.`,
  };
}

async function runSouth(
  session: { id: string },
  ctx?: ToolContext,
): Promise<{ directionData: Record<string, unknown>; beatContent: string }> {
  const graphQuery = graphHandlers['graph/query'];
  const result = await graphQuery(
    { cypher: `MATCH (n) WHERE n.sessionId = '${session.id}' RETURN n LIMIT 50` },
    ctx,
  );
  const data = parseToolResult(result) ?? {};

  return {
    directionData: {
      tool: 'graph/query',
      resultCount: data.resultCount ?? 0,
      queryType: data.queryType,
    },
    beatContent: `🔥 South analysis: queried relational context for session — ${data.resultCount ?? 0} nodes found in graph substrate.`,
  };
}

async function runWest(
  session: { stcChartId?: string; ceremonyId?: string },
  ctx?: ToolContext,
): Promise<{ directionData: Record<string, unknown>; beatContent: string }> {
  const results: Record<string, unknown> = { tools: [] };
  const toolsRun: string[] = [];

  // STC assess if chart exists
  if (session.stcChartId) {
    const stcAssess = stcHandlers['stc/assess'];
    const stcResult = await stcAssess({ chartId: session.stcChartId }, ctx);
    const stcData = parseToolResult(stcResult);
    if (stcData) {
      results.stcAssessment = stcData;
      toolsRun.push('stc/assess');
    }
  }

  // Ceremony status if ceremony exists
  if (session.ceremonyId) {
    const ceremonyStatus = ceremonyHandlers['ceremony/status'];
    const cerResult = await ceremonyStatus({ ceremonyId: session.ceremonyId }, ctx);
    const cerData = parseToolResult(cerResult);
    if (cerData) {
      results.ceremonyStatus = cerData;
      toolsRun.push('ceremony/status');
    }
  }

  results.tools = toolsRun;
  const tensionLevel = (results.stcAssessment as Record<string, unknown>)?.tensionLevel ?? 'N/A';
  const phase = (results.ceremonyStatus as Record<string, unknown>)?.phase ?? 'none';

  return {
    directionData: results,
    beatContent: `🌊 West validation: tension level ${tensionLevel}, ceremony phase: ${phase}. Tools run: [${toolsRun.join(', ') || 'none — no chart/ceremony linked'}].`,
  };
}

async function runNorth(
  session: { machineState?: string; id: string; stcChartId?: string },
  ctx?: ToolContext,
): Promise<{ directionData: Record<string, unknown>; beatContent: string }> {
  const results: Record<string, unknown> = { tools: [] };
  const toolsRun: string[] = [];

  // Fire SM event if machine is active
  if (session.machineState) {
    const smFire = smHandlers['sm/fire'];
    const smResult = await smFire(
      { machineId: session.machineState, eventId: 'direction_cycle_complete', data: { direction: 'north' } },
      ctx,
    );
    const smData = parseToolResult(smResult);
    if (smData) {
      results.smTransition = smData;
      toolsRun.push('sm/fire');
    }
  }

  // Ingest a narrative beat into the graph
  const graphIngest = graphHandlers['graph/ingest'];
  const beatData = {
    id: `beat_${randomUUID().slice(0, 8)}`,
    act: 4,
    direction: 'north',
    content: `North integration cycle for session ${session.id}`,
    timestamp: new Date().toISOString(),
  };
  const ingestResult = await graphIngest(
    { type: 'beat', data: { ...beatData, actionStepIds: [] } },
    ctx,
  );
  const ingestData = parseToolResult(ingestResult);
  if (ingestData) {
    results.graphIngest = ingestData;
    toolsRun.push('graph/ingest');
  }

  results.tools = toolsRun;
  const transitioned = (results.smTransition as Record<string, unknown>)?.success ?? false;

  return {
    directionData: results,
    beatContent: `❄️ North integration: SM transition ${transitioned ? 'succeeded' : 'skipped/no machine'}. Beat ingested into graph. Tools run: [${toolsRun.join(', ')}].`,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const handleSessionCycle: ToolHandler = async (args, ctx) => {
  const parsed = SessionCycleInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for pipeline/session_cycle',
      issues: parsed.error.issues,
    });
  }

  const { sessionId, direction } = parsed.data;

  // Resolve session
  const session = getSession(sessionId);
  if (!session) {
    return mcpError('session_not_found', {
      message: `No session found with ID "${sessionId}"`,
      sessionId,
    });
  }

  // ── Run direction-specific tools ─────────────────────────────────────────
  let directionResult: { directionData: Record<string, unknown>; beatContent: string };

  switch (direction) {
    case 'east':
      directionResult = await runEast(session, ctx);
      break;
    case 'south':
      directionResult = await runSouth(session, ctx);
      break;
    case 'west':
      directionResult = await runWest(session, ctx);
      break;
    case 'north':
      directionResult = await runNorth(session, ctx);
      break;
  }

  // ── Generate narrative beat ──────────────────────────────────────────────
  const beat = {
    id: `beat_${randomUUID().slice(0, 8)}`,
    act: directionToAct(direction),
    direction,
    content: directionResult.beatContent,
    timestamp: new Date().toISOString(),
    ceremonies: session.ceremonyId ? [session.ceremonyId] : [],
    learnings: [],
    relations_honored: [],
  };

  // ── Compute Wilson score ─────────────────────────────────────────────────
  let wilsonScore = 0;
  try {
    const graphWilson = graphHandlers['graph/wilson'];
    const wilsonResult = await graphWilson({ scope: sessionId }, ctx);
    const wilsonData = parseToolResult(wilsonResult);
    if (wilsonData && typeof wilsonData.score === 'number') {
      wilsonScore = wilsonData.score;
    }
  } catch {
    // Wilson score is best-effort; default to 0
  }

  // ── Update session spiral position ───────────────────────────────────────
  const next = nextDirection(direction);
  const completedCycle = direction === 'north';

  session.spiralPosition.direction = next;
  if (completedCycle) {
    session.spiralPosition.cycleCount += 1;
  }

  // Check if checkpoint is needed
  const needsCheckpoint =
    session.checkpointPolicy?.mandatoryAt?.includes(direction) ||
    (completedCycle && session.spiralPosition.cycleCount >= (session.checkpointPolicy?.maxAutonomousCycles ?? 3));

  if (needsCheckpoint) {
    session.spiralPosition.isAtCheckpoint = true;
    session.status = 'paused';
  }

  session.updatedAt = new Date().toISOString();

  return mcpSuccess({
    direction,
    beat,
    wilsonScore,
    nextDirection: next,
    cycleCount: session.spiralPosition.cycleCount,
    isAtCheckpoint: session.spiralPosition.isAtCheckpoint,
    directionData: directionResult.directionData,
  });
};

// ─── Guarded Handler ─────────────────────────────────────────────────────────

export const guardedSessionCycle = withGuards(
  [requireOcap('community'), auditLog('pipeline/session_cycle')],
  handleSessionCycle,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [sessionCycleDef];

export const handlers: Record<string, ToolHandler> = {
  'pipeline/session_cycle': guardedSessionCycle,
};
