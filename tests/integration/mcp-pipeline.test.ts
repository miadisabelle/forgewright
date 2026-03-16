/**
 * MCP Compound Pipeline — integration tests.
 *
 * Validates pipeline orchestration across tool namespaces:
 *   pipeline/intent_to_machine: pde/decompose → stc/create → sm/create
 *   pipeline/session_cycle: direction-appropriate MCP tools
 *
 * Tests: stage chaining, failure propagation, partial completion reporting.
 *
 * Strategy: mock underlying tool handlers to control stage outputs
 * and test the pipeline orchestration logic directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolResult, ToolContext } from '@forgewright/lib/mcp/guards.js';

// ─── Mock filesystem ─────────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock tool handlers ──────────────────────────────────────────────────────

const mockPdeDecompose = vi.fn();
const mockStcCreate = vi.fn();
const mockSmCreate = vi.fn();
const mockGraphQuery = vi.fn();
const mockGraphWilson = vi.fn();
const mockGraphIngest = vi.fn();
const mockStcAssess = vi.fn();
const mockCeremonyStatus = vi.fn();
const mockSmFire = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@forgewright/lib/mcp/tools/pde.js', () => ({
  handlers: { 'pde/decompose': (...args: unknown[]) => mockPdeDecompose(...args) },
}));

vi.mock('@forgewright/lib/mcp/tools/stc.js', () => ({
  handlers: {
    'stc/create': (...args: unknown[]) => mockStcCreate(...args),
    'stc/assess': (...args: unknown[]) => mockStcAssess(...args),
  },
}));

vi.mock('@forgewright/lib/mcp/tools/sm.js', () => ({
  handlers: {
    'sm/create': (...args: unknown[]) => mockSmCreate(...args),
    'sm/fire': (...args: unknown[]) => mockSmFire(...args),
  },
}));

vi.mock('@forgewright/lib/mcp/tools/graph.js', () => ({
  handlers: {
    'graph/query': (...args: unknown[]) => mockGraphQuery(...args),
    'graph/wilson': (...args: unknown[]) => mockGraphWilson(...args),
    'graph/ingest': (...args: unknown[]) => mockGraphIngest(...args),
  },
}));

vi.mock('@forgewright/lib/mcp/tools/ceremony.js', () => ({
  handlers: {
    'ceremony/status': (...args: unknown[]) => mockCeremonyStatus(...args),
  },
}));

vi.mock('@forgewright/lib/mcp/tools/session.js', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  clearSessions: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mcpOk(data: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function mcpErr(error: string, details?: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error, ...details }) }],
    isError: true,
  };
}

function parseResult(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0].text);
}

const CTX: ToolContext = { accessLevel: 'community' };

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('MCP Compound Pipelines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Intent-to-Machine Pipeline ────────────────────────────────────────────

  describe('pipeline/intent_to_machine', () => {
    it('chains pde/decompose → stc/create → sm/create successfully', async () => {
      // Stage 1 response
      mockPdeDecompose.mockResolvedValue(mcpOk({
        id: 'decomp-001',
        actionStack: [
          { description: 'Define auth requirements' },
          { description: 'Implement JWT tokens' },
          { description: 'Write integration tests' },
        ],
        leadDirection: 'east',
      }));

      // Stage 2 response
      mockStcCreate.mockResolvedValue(mcpOk({
        id: 'chart-001',
        desiredOutcome: 'Build auth module',
        tensionLevel: 0.7,
      }));

      // Stage 3 response
      mockSmCreate.mockResolvedValue(mcpOk({
        machineId: 'machine-001',
        currentState: 'TaskDefinition',
        definition: { state: { name: 'CreativeProcess' } },
      }));

      // Import pipeline AFTER mocks are set up
      const { handlers } = await import('@forgewright/lib/mcp/pipelines/intent-to-machine.js');
      const handler = handlers['pipeline/intent_to_machine'];

      const result = await handler(
        { prompt: 'Build authentication module for RISE' },
        CTX,
      );

      const data = parseResult(result);

      // All three IDs returned
      expect(data.decompositionId).toBe('decomp-001');
      expect(data.chartId).toBe('chart-001');
      expect(data.machineId).toBe('machine-001');

      // Summary contains all stages
      const summary = data.summary as Record<string, unknown>;
      expect(summary.prompt).toContain('authentication');
      expect(summary.leadDirection).toBe('east');
      expect(summary.actionStepCount).toBe(3);
      expect(summary.currentState).toBe('TaskDefinition');
      expect((summary.stages as string[])).toEqual(['pde/decompose', 'stc/create', 'sm/create']);

      // All three handlers were called
      expect(mockPdeDecompose).toHaveBeenCalledOnce();
      expect(mockStcCreate).toHaveBeenCalledOnce();
      expect(mockSmCreate).toHaveBeenCalledOnce();
    });

    it('reports completed stages when stage 2 (stc/create) fails', async () => {
      // Stage 1: succeeds
      mockPdeDecompose.mockResolvedValue(mcpOk({
        id: 'decomp-002',
        actionStack: [{ description: 'Step A' }],
        leadDirection: 'south',
      }));

      // Stage 2: fails
      mockStcCreate.mockResolvedValue(mcpErr('stc_validation_failed', {
        message: 'Invalid tension chart input',
      }));

      const { handlers } = await import('@forgewright/lib/mcp/pipelines/intent-to-machine.js');
      const handler = handlers['pipeline/intent_to_machine'];

      const result = await handler(
        { prompt: 'Failing pipeline test' },
        CTX,
      );

      expect(result.isError).toBe(true);
      const data = parseResult(result);

      // Error reports the failing stage
      expect(data.stage).toBe('stc/create');

      // Reports completed stages (only stage 1)
      expect(data.completedStages).toEqual(['pde/decompose']);

      // Decomposition ID preserved from stage 1
      expect(data.decompositionId).toBe('decomp-002');

      // Stage 3 was never called
      expect(mockSmCreate).not.toHaveBeenCalled();
    });

    it('reports completed stages when stage 3 (sm/create) fails', async () => {
      mockPdeDecompose.mockResolvedValue(mcpOk({
        id: 'decomp-003',
        actionStack: [{ description: 'Step X' }],
        leadDirection: 'west',
      }));

      mockStcCreate.mockResolvedValue(mcpOk({
        id: 'chart-003',
        desiredOutcome: 'Test failure at stage 3',
      }));

      mockSmCreate.mockResolvedValue(mcpErr('sm_creation_failed', {
        message: 'Could not instantiate state machine',
      }));

      const { handlers } = await import('@forgewright/lib/mcp/pipelines/intent-to-machine.js');
      const handler = handlers['pipeline/intent_to_machine'];

      const result = await handler(
        { prompt: 'Stage 3 failure test' },
        CTX,
      );

      expect(result.isError).toBe(true);
      const data = parseResult(result);

      expect(data.stage).toBe('sm/create');
      expect(data.completedStages).toEqual(['pde/decompose', 'stc/create']);
      expect(data.decompositionId).toBe('decomp-003');
      expect(data.chartId).toBe('chart-003');
    });

    it('rejects with validation error on empty prompt', async () => {
      const { handlers } = await import('@forgewright/lib/mcp/pipelines/intent-to-machine.js');
      const handler = handlers['pipeline/intent_to_machine'];

      const result = await handler({ prompt: '' }, CTX);

      expect(result.isError).toBe(true);
      const data = parseResult(result);
      expect(data.error).toBe('validation_error');
    });
  });

  // ── Session Cycle Pipeline ────────────────────────────────────────────────

  describe('pipeline/session_cycle', () => {
    const makeSession = (direction: string) => ({
      id: 'session-test-001',
      intent: 'Build auth module',
      companions: [],
      spiralPosition: {
        direction,
        cycleCount: 1,
        maxCycles: 3,
        isAtCheckpoint: false,
      },
      status: 'active',
      checkpointPolicy: {
        type: 'cycle-complete',
        mandatoryAt: ['north'],
        maxAutonomousCycles: 3,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    it('runs pde/decompose for East direction', async () => {
      const session = makeSession('east');
      mockGetSession.mockReturnValue(session);

      mockPdeDecompose.mockResolvedValue(mcpOk({
        id: 'decomp-east',
        leadDirection: 'east',
        actionStack: [{ description: 'Define requirements' }],
      }));

      mockGraphWilson.mockResolvedValue(mcpOk({ score: 0.65 }));

      const { handlers } = await import('@forgewright/lib/mcp/pipelines/session-cycle.js');
      const handler = handlers['pipeline/session_cycle'];

      const result = await handler(
        { sessionId: 'session-test-001', direction: 'east' },
        CTX,
      );

      const data = parseResult(result);
      expect(data.direction).toBe('east');
      expect(data.nextDirection).toBe('south');
      expect(data.beat).toBeDefined();
      expect((data.beat as Record<string, unknown>).direction).toBe('east');

      // PDE decompose was called for East
      expect(mockPdeDecompose).toHaveBeenCalled();
    });

    it('runs graph/query for South direction', async () => {
      const session = makeSession('south');
      mockGetSession.mockReturnValue(session);

      mockGraphQuery.mockResolvedValue(mcpOk({
        resultCount: 12,
        queryType: 'neighborhood',
      }));

      mockGraphWilson.mockResolvedValue(mcpOk({ score: 0.5 }));

      const { handlers } = await import('@forgewright/lib/mcp/pipelines/session-cycle.js');
      const handler = handlers['pipeline/session_cycle'];

      const result = await handler(
        { sessionId: 'session-test-001', direction: 'south' },
        CTX,
      );

      const data = parseResult(result);
      expect(data.direction).toBe('south');
      expect(data.nextDirection).toBe('west');
      expect(mockGraphQuery).toHaveBeenCalled();
    });

    it('runs stc/assess + ceremony/status for West direction', async () => {
      const session = {
        ...makeSession('west'),
        stcChartId: 'chart-999',
        ceremonyId: 'cer-999',
      };
      mockGetSession.mockReturnValue(session);

      mockStcAssess.mockResolvedValue(mcpOk({ tensionLevel: 0.6 }));
      mockCeremonyStatus.mockResolvedValue(mcpOk({ phase: 'active' }));
      mockGraphWilson.mockResolvedValue(mcpOk({ score: 0.7 }));

      const { handlers } = await import('@forgewright/lib/mcp/pipelines/session-cycle.js');
      const handler = handlers['pipeline/session_cycle'];

      const result = await handler(
        { sessionId: 'session-test-001', direction: 'west' },
        CTX,
      );

      const data = parseResult(result);
      expect(data.direction).toBe('west');
      expect(data.nextDirection).toBe('north');
      expect(mockStcAssess).toHaveBeenCalled();
      expect(mockCeremonyStatus).toHaveBeenCalled();
    });

    it('runs sm/fire + graph/ingest for North direction', async () => {
      const session = {
        ...makeSession('north'),
        machineState: 'machine-abc',
      };
      mockGetSession.mockReturnValue(session);

      mockSmFire.mockResolvedValue(mcpOk({ success: true, currentState: 'Review' }));
      mockGraphIngest.mockResolvedValue(mcpOk({ ingestedIds: ['beat_abc'] }));
      mockGraphWilson.mockResolvedValue(mcpOk({ score: 0.8 }));

      const { handlers } = await import('@forgewright/lib/mcp/pipelines/session-cycle.js');
      const handler = handlers['pipeline/session_cycle'];

      const result = await handler(
        { sessionId: 'session-test-001', direction: 'north' },
        CTX,
      );

      const data = parseResult(result);
      expect(data.direction).toBe('north');
      expect(data.nextDirection).toBe('east');
      expect(mockSmFire).toHaveBeenCalled();
      expect(mockGraphIngest).toHaveBeenCalled();
    });

    it('returns error for non-existent session', async () => {
      mockGetSession.mockReturnValue(undefined);

      const { handlers } = await import('@forgewright/lib/mcp/pipelines/session-cycle.js');
      const handler = handlers['pipeline/session_cycle'];

      const result = await handler(
        { sessionId: 'non-existent', direction: 'east' },
        CTX,
      );

      expect(result.isError).toBe(true);
      const data = parseResult(result);
      expect(data.error).toBe('session_not_found');
    });
  });
});
