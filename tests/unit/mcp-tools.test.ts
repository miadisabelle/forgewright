/**
 * MCP Tool Handler Tests — tests tool handlers from all 6 namespaces.
 *
 * External dependencies (filesystem, graph, smcraft, ceremony runtime)
 * are mocked so each test is self-contained.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolResult } from '@forgewright/lib/mcp/guards.js';
import { clearAuditLog } from '@forgewright/lib/mcp/guards.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock PDE pipeline & storage
vi.mock('@forgewright/lib/pde/pipeline.js', () => ({
  runPipeline: vi.fn().mockResolvedValue({
    decomposition: {
      id: 'pde-test-001',
      timestamp: '2025-01-01T00:00:00.000Z',
      primary: { action: 'test', target: 'graph', confidence: 0.9 },
      leadDirection: 'west',
      balance: 0.75,
      wilsonAlignment: 0.8,
      ceremonyRequired: false,
      neglectedDirections: ['south'],
      actionStack: [{ id: 'a1', description: 'test action', direction: 'west' }],
      directions: {
        east: { insights: [], ceremonyRecommended: false },
        south: { insights: [], ceremonyRecommended: false },
        west: { insights: [{ id: 'i1' }], ceremonyRecommended: false },
        north: { insights: [], ceremonyRecommended: false },
      },
      ambiguities: [],
    },
    graphNodes: [{ id: 'n1' }],
    narrativeBeats: [{ id: 'b1' }],
    smdfSeed: null,
  }),
}));

vi.mock('@forgewright/lib/pde/storage.js', () => ({
  load: vi.fn().mockResolvedValue({
    id: 'pde-loaded-001',
    primary: { action: 'loaded', target: 'data', confidence: 1.0 },
    timestamp: '2025-01-01T00:00:00.000Z',
  }),
  list: vi.fn().mockResolvedValue([
    { id: 'pde-list-001', primary: { action: 'a', target: 'b' }, timestamp: '2025-01-01T00:00:00.000Z' },
    { id: 'pde-list-002', primary: { action: 'c', target: 'd' }, timestamp: '2025-01-02T00:00:00.000Z' },
  ]),
  renderMarkdown: vi.fn().mockReturnValue('# Four Directions\n\nTest markdown'),
}));

// Mock smcraft modules
vi.mock('@forgewright/lib/smcraft/stc-adapter.js', () => ({
  stcToSMDF: vi.fn().mockReturnValue({
    settings: { name: 'test-machine', version: '1.0.0' },
    events: [{ source: 'internal', events: [{ id: 'evt_start', description: 'start' }] }],
    state: {
      name: 'root',
      kind: 'composite',
      states: [
        { name: 'idle', kind: 'initial', transitions: [{ event: 'evt_start', nextState: 'running' }] },
        { name: 'running', kind: 'state', transitions: [{ event: 'evt_done', nextState: 'done' }] },
        { name: 'done', kind: 'final', transitions: [] },
      ],
      transitions: [],
    },
  }),
}));

vi.mock('@forgewright/lib/smcraft/runtime-bridge.js', () => ({
  createMachine: vi.fn().mockResolvedValue({
    id: 'machine-test-001',
    currentState: 'idle',
    backend: 'local',
    isRunning: true,
    stateHistory: ['idle'],
    eventLog: [],
  }),
  fireEvent: vi.fn().mockReturnValue({
    success: true,
    previousState: 'idle',
    currentState: 'running',
    event: 'evt_start',
  }),
  getMachine: vi.fn().mockReturnValue(undefined),
}));

vi.mock('@forgewright/lib/smcraft/codegen-bridge.js', () => ({
  generateCode: vi.fn().mockResolvedValue('// generated code\nconst machine = {};'),
}));

// Mock graph module
vi.mock('@forgewright/lib/graph/index.js', () => ({
  ForgewrightGraph: {
    create: vi.fn().mockResolvedValue({}),
  },
  queryCypher: vi.fn().mockResolvedValue([{ id: 'node1' }]),
  neighborhood: vi.fn().mockResolvedValue({
    nodes: [{ id: 'n1' }, { id: 'n2' }],
    edges: [{ from: 'n1', to: 'n2' }],
  }),
  ingestPDE: vi.fn().mockResolvedValue({ intentIds: ['i1'], actionStepIds: ['a1'] }),
  ingestStateMachine: vi.fn().mockResolvedValue({ machineId: 'm1', stateIds: ['s1'], eventIds: ['e1'] }),
  ingestCeremony: vi.fn().mockResolvedValue({ ceremonyId: 'c1' }),
  ingestNarrativeBeat: vi.fn().mockResolvedValue({ beatId: 'b1' }),
  ingestKinship: vi.fn().mockResolvedValue({ edgeCount: 3 }),
  toMermaid: vi.fn().mockResolvedValue('graph TD\n  A-->B'),
  toCypher: vi.fn().mockResolvedValue('CREATE (a:Node)'),
  summaryStats: vi.fn().mockResolvedValue({ nodeCount: 5, edgeCount: 3 }),
  computeWilsonAlignment: vi.fn().mockResolvedValue({
    score: 0.82,
    recommendation: 'aligned',
  }),
}));

// Mock ceremony runtime
vi.mock('@forgewright/lib/ceremony/runtime.js', () => {
  class MockCeremonyRuntime {
    private _id: string;
    private _phase = 'preparation';
    private _active = false;
    private _intention: string;
    private _participants: string[];

    constructor(intention: string, participants: string[]) {
      this._id = `ceremony_mock_${Date.now()}`;
      this._intention = intention;
      this._participants = participants;
    }

    openCeremony() {
      this._phase = 'opening';
      this._active = true;
      return {
        id: this._id,
        intention: this._intention,
        participants: this._participants,
        phase: this._phase,
      };
    }

    getCurrentPhase() { return this._phase; }
    getId() { return this._id; }
    isActive() { return this._active; }
    getRecord() {
      return {
        id: this._id,
        intention: this._intention,
        participants: this._participants,
        phase: this._phase,
      };
    }

    getCurrentGuidance() {
      return {
        balanceScore: 0.5,
        recommendation: 'proceed with intention',
        neglectedDirections: [],
      };
    }

    advancePhase() {
      const phases = ['preparation', 'opening', 'active', 'integration', 'closing'];
      const idx = phases.indexOf(this._phase);
      if (idx < phases.length - 1) {
        const from = this._phase;
        this._phase = phases[idx + 1];
        return { allowed: true, from, to: this._phase };
      }
      return { allowed: false, from: this._phase, to: this._phase, reason: 'Already at final phase' };
    }

    closeCeremony(_force?: boolean) {
      this._active = false;
      this._phase = 'closing';
      return this.getRecord();
    }
  }

  return { CeremonyRuntime: MockCeremonyRuntime };
});

// ─── Import tool modules AFTER mocks are set ─────────────────────────────────

import { handlers as pdeHandlers } from '@forgewright/lib/mcp/tools/pde.js';
import { handlers as smHandlers } from '@forgewright/lib/mcp/tools/sm.js';
import { handlers as stcHandlers } from '@forgewright/lib/mcp/tools/stc.js';
import { handlers as ceremonyHandlers, clearCeremonies } from '@forgewright/lib/mcp/tools/ceremony.js';
import { handlers as sessionHandlers, clearSessions } from '@forgewright/lib/mcp/tools/session.js';
import { handlers as graphHandlers, resetGraph } from '@forgewright/lib/mcp/tools/graph.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Community-level context that passes OCAP guards. */
const communityCtx = { accessLevel: 'community' as const };

/** Parse JSON from MCP ToolResult content. */
function parseResult(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0].text);
}

/** Assert MCP standard response format. */
function assertMcpFormat(result: ToolResult) {
  expect(result).toHaveProperty('content');
  expect(Array.isArray(result.content)).toBe(true);
  expect(result.content.length).toBeGreaterThanOrEqual(1);
  expect(result.content[0]).toHaveProperty('type', 'text');
  expect(typeof result.content[0].text).toBe('string');
}

// ─── PDE namespace ───────────────────────────────────────────────────────────

describe('pde/ tools', () => {
  beforeEach(() => clearAuditLog());

  it('pde/decompose returns decomposition with id', async () => {
    const result = await pdeHandlers['pde/decompose'](
      { prompt: 'Create tests for the MCP layer' },
      communityCtx,
    );

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.id).toBe('pde-test-001');
    expect(data.leadDirection).toBeDefined();
    expect(data.actionStack).toBeDefined();
  });

  it('pde/get returns stored decomposition', async () => {
    const result = await pdeHandlers['pde/get'](
      { id: 'pde-loaded-001' },
      communityCtx,
    );

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.id).toBe('pde-loaded-001');
  });

  it('pde/list returns array', async () => {
    const result = await pdeHandlers['pde/list'](
      {},
      communityCtx,
    );

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.total).toBe(2);
    expect(Array.isArray(data.decompositions)).toBe(true);
  });

  it('pde/decompose returns MCP-standard response format', async () => {
    const result = await pdeHandlers['pde/decompose'](
      { prompt: 'test' },
      communityCtx,
    );
    assertMcpFormat(result);
  });
});

// ─── SM namespace ────────────────────────────────────────────────────────────

describe('sm/ tools', () => {
  beforeEach(() => clearAuditLog());

  it('sm/create returns StateMachineDefinition with intent', async () => {
    // sm/create requires phase 'active' or 'opening', plus 'community' access
    const ctx = { ceremonyPhase: 'active' as const, accessLevel: 'community' as const };
    const result = await smHandlers['sm/create'](
      { intent: 'Build a test workflow' },
      ctx,
    );

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.machineId).toBeDefined();
    expect(data.definition).toBeDefined();
    expect(data.currentState).toBeDefined();
  });

  it('sm/validate catches orphan states', async () => {
    // SMDF schema requires: settings.namespace, settings.asynchronous, events[].name
    const definition = {
      settings: { namespace: 'orphan-test', asynchronous: false },
      events: [{ name: 'internal', events: [{ id: 'go', description: 'go' }] }],
      state: {
        name: 'root',
        states: [
          { name: 'start', transitions: [{ event: 'go', nextState: 'end' }] },
          { name: 'orphan', transitions: [] },
          { name: 'end', kind: 'final' as const, transitions: [] },
        ],
        transitions: [],
      },
    };

    const result = await smHandlers['sm/validate']({ definition });

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    // Should detect orphan state
    expect(Array.isArray(data.warnings)).toBe(true);
    const warnings = data.warnings as Array<{ code: string; message: string }>;
    const orphanWarning = warnings.find(w => w.code === 'V004');
    expect(orphanWarning).toBeDefined();
    expect(orphanWarning!.message).toContain('orphan');
  });

  it('sm/validate returns valid for well-formed definition', async () => {
    const definition = {
      settings: { namespace: 'valid-sm', asynchronous: false },
      events: [{ name: 'internal', events: [{ id: 'go', description: 'go' }] }],
      state: {
        name: 'root',
        states: [
          { name: 'start', transitions: [{ event: 'go', nextState: 'done' }] },
          { name: 'done', kind: 'final' as const, transitions: [] },
        ],
        transitions: [],
      },
    };

    const result = await smHandlers['sm/validate']({ definition });
    assertMcpFormat(result);
    const data = parseResult(result);
    expect(data.valid).toBe(true);
    expect((data.errors as unknown[]).length).toBe(0);
  });

  it('sm/create returns MCP-standard response format', async () => {
    const ctx = { ceremonyPhase: 'active' as const, accessLevel: 'community' as const };
    const result = await smHandlers['sm/create']({ intent: 'test' }, ctx);
    assertMcpFormat(result);
  });
});

// ─── STC namespace ───────────────────────────────────────────────────────────

describe('stc/ tools', () => {
  beforeEach(() => clearAuditLog());

  it('stc/create returns StructuralTensionChart', async () => {
    const result = await stcHandlers['stc/create'](
      {
        desiredOutcome: 'Full MCP test coverage',
        currentReality: 'No MCP tests exist',
        actionSteps: ['Write guard tests', 'Write tool tests'],
      },
      communityCtx,
    );

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect((data.id as string).startsWith('stc_')).toBe(true);
    expect(data.desiredOutcome).toBe('Full MCP test coverage');
    expect(data.currentReality).toBe('No MCP tests exist');
    expect(data.tensionLevel).toBeDefined();
    expect(data.phase).toBe('germination');
    expect(Array.isArray(data.actionSteps)).toBe(true);
    expect((data.actionSteps as unknown[]).length).toBe(2);
  });

  it('stc/create returns MCP-standard response format', async () => {
    const result = await stcHandlers['stc/create'](
      { desiredOutcome: 'test', currentReality: 'none' },
      communityCtx,
    );
    assertMcpFormat(result);
  });
});

// ─── Ceremony namespace ──────────────────────────────────────────────────────

describe('ceremony/ tools', () => {
  beforeEach(() => {
    clearAuditLog();
    clearCeremonies();
  });

  it('ceremony/open returns ceremony with opening phase', async () => {
    const result = await ceremonyHandlers['ceremony/open'](
      { intent: 'Test ceremony governance' },
      communityCtx,
    );

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.ceremonyId).toBeDefined();
    expect(data.phase).toBe('opening');
    expect(data.guidance).toBeDefined();
  });

  it('ceremony/open returns MCP-standard response format', async () => {
    const result = await ceremonyHandlers['ceremony/open'](
      { intent: 'test' },
      communityCtx,
    );
    assertMcpFormat(result);
  });
});

// ─── Session namespace ───────────────────────────────────────────────────────

describe('session/ tools', () => {
  beforeEach(() => {
    clearAuditLog();
    clearSessions();
  });

  it('session/create returns session with spiral position', async () => {
    const result = await sessionHandlers['session/create'](
      { intent: 'MCP unit test session' },
      communityCtx,
    );

    assertMcpFormat(result);
    expect(result.isError).toBeUndefined();
    const data = parseResult(result);
    expect(data.sessionId).toBeDefined();
    expect((data.sessionId as string).startsWith('session_')).toBe(true);
    expect(data.status).toBe('active');

    const spiral = data.spiralPosition as Record<string, unknown>;
    expect(spiral).toBeDefined();
    expect(spiral.direction).toBe('east');
    expect(spiral.cycleCount).toBe(0);
    expect(spiral.isAtCheckpoint).toBe(false);
  });

  it('session/create returns MCP-standard response format', async () => {
    const result = await sessionHandlers['session/create'](
      { intent: 'test' },
      communityCtx,
    );
    assertMcpFormat(result);
  });
});

// ─── Cross-cutting: all tools return MCP-standard format ─────────────────────

describe('MCP standard response format across all namespaces', () => {
  beforeEach(() => {
    clearAuditLog();
    clearCeremonies();
    clearSessions();
  });

  const testCases: Array<{
    name: string;
    handler: () => Promise<ToolResult>;
  }> = [
    {
      name: 'pde/decompose',
      handler: () => pdeHandlers['pde/decompose']({ prompt: 'test' }, communityCtx),
    },
    {
      name: 'pde/get',
      handler: () => pdeHandlers['pde/get']({ id: 'test' }, communityCtx),
    },
    {
      name: 'pde/list',
      handler: () => pdeHandlers['pde/list']({}, communityCtx),
    },
    {
      name: 'sm/validate',
      handler: () => smHandlers['sm/validate']({
        definition: {
          settings: { namespace: 'x', asynchronous: false },
          events: [{ name: 's', events: [] }],
          state: { name: 'root', transitions: [] },
        },
      }),
    },
    {
      name: 'stc/create',
      handler: () => stcHandlers['stc/create'](
        { desiredOutcome: 'o', currentReality: 'r' },
        communityCtx,
      ),
    },
    {
      name: 'ceremony/open',
      handler: () => ceremonyHandlers['ceremony/open']({ intent: 'test' }, communityCtx),
    },
    {
      name: 'session/create',
      handler: () => sessionHandlers['session/create']({ intent: 'test' }, communityCtx),
    },
  ];

  for (const tc of testCases) {
    it(`${tc.name} returns { content: [{ type: 'text', text }] }`, async () => {
      const result = await tc.handler();
      assertMcpFormat(result);
    });
  }
});
