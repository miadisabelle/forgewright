/**
 * MCP Server Core Tests — server factory, namespace registration, tool count.
 *
 * Tests the registerNamespace utility directly and the createForgewrightServer
 * factory via mocked MCP SDK and tool dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Track registerTool calls ────────────────────────────────────────────────

const registeredTools: Array<{ name: string; description: string }> = [];

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class MockMcpServer {
    name: string;
    version: string;
    constructor(opts: { name: string; version: string }) {
      this.name = opts.name;
      this.version = opts.version;
    }
    registerTool(name: string, config: { description: string }) {
      registeredTools.push({ name, description: config.description });
    }
    connect() { return Promise.resolve(); }
  }
  return { McpServer: MockMcpServer };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {},
}));

// Mock PDE pipeline & storage
vi.mock('@forgewright/lib/pde/pipeline.js', () => ({
  runPipeline: vi.fn().mockResolvedValue({
    decomposition: { id: 'x', timestamp: '', primary: {}, leadDirection: 'east', balance: 0, wilsonAlignment: 0, ceremonyRequired: false, neglectedDirections: [], actionStack: [], directions: { east: { insights: [], ceremonyRecommended: false }, south: { insights: [], ceremonyRecommended: false }, west: { insights: [], ceremonyRecommended: false }, north: { insights: [], ceremonyRecommended: false } }, ambiguities: [] },
    graphNodes: [], narrativeBeats: [], smdfSeed: null,
  }),
}));

vi.mock('@forgewright/lib/pde/storage.js', () => ({
  load: vi.fn(), list: vi.fn().mockResolvedValue([]), renderMarkdown: vi.fn(),
}));

// Mock smcraft
vi.mock('@forgewright/lib/smcraft/stc-adapter.js', () => ({
  stcToSMDF: vi.fn(),
}));

vi.mock('@forgewright/lib/smcraft/runtime-bridge.js', () => ({
  createMachine: vi.fn(), fireEvent: vi.fn(), getMachine: vi.fn(),
}));

vi.mock('@forgewright/lib/smcraft/codegen-bridge.js', () => ({
  generateCode: vi.fn(),
}));

// Mock graph
vi.mock('@forgewright/lib/graph/index.js', () => ({
  ForgewrightGraph: { create: vi.fn().mockResolvedValue({}) },
  queryCypher: vi.fn(), neighborhood: vi.fn(),
  ingestPDE: vi.fn(), ingestStateMachine: vi.fn(),
  ingestCeremony: vi.fn(), ingestNarrativeBeat: vi.fn(), ingestKinship: vi.fn(),
  toMermaid: vi.fn(), toCypher: vi.fn(), summaryStats: vi.fn(),
  computeWilsonAlignment: vi.fn(),
}));

// Mock ceremony
vi.mock('@forgewright/lib/ceremony/runtime.js', () => ({
  CeremonyRuntime: class {
    constructor() {}
    openCeremony() { return {}; }
    getCurrentPhase() { return 'preparation'; }
    getId() { return 'mock'; }
    getCurrentGuidance() { return {}; }
    advancePhase() { return { allowed: true }; }
    closeCeremony() { return {}; }
    isActive() { return false; }
    getRecord() { return {}; }
  },
}));

// ─── Import server AFTER mocks ───────────────────────────────────────────────

import { createForgewrightServer, registerNamespace } from '@forgewright/lib/mcp/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createForgewrightServer', () => {
  beforeEach(() => {
    registeredTools.length = 0;
  });

  it('returns a server instance', async () => {
    const server = await createForgewrightServer();
    expect(server).toBeDefined();
    expect(server).toHaveProperty('name', 'forgewright');
  });

  it('has all 6 namespaces registered', async () => {
    await createForgewrightServer();

    const namespaces = new Set(
      registeredTools.map(t => t.name.split('/')[0]),
    );

    // All 6 target namespaces must be present (real or placeholder)
    expect(namespaces.has('pde')).toBe(true);
    expect(namespaces.has('sm')).toBe(true);
    expect(namespaces.has('graph')).toBe(true);
    expect(namespaces.has('ceremony')).toBe(true);
    expect(namespaces.has('stc')).toBe(true);
    expect(namespaces.has('session')).toBe(true);
  });

  it('tool count covers all namespaces', async () => {
    await createForgewrightServer();

    // Each namespace registers at least 1 tool (real or placeholder status tool)
    // Full real count: pde(4) + sm(4) + graph(4) + ceremony(4) + stc(3) + session(2) = 21
    // Minimum (all placeholders): 6
    expect(registeredTools.length).toBeGreaterThanOrEqual(6);
  });

  it('each registered tool has a name and description', async () => {
    await createForgewrightServer();

    for (const tool of registeredTools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name).toContain('/');
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe('registerNamespace', () => {
  beforeEach(() => {
    registeredTools.length = 0;
  });

  it('registers all tools from a tool module', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const toolModule = {
      tools: [
        { name: 'ns/toolA', description: 'Tool A', inputSchema: z.object({}) },
        { name: 'ns/toolB', description: 'Tool B', inputSchema: z.object({}) },
      ],
      handlers: {
        'ns/toolA': vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }),
        'ns/toolB': vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }),
      },
    };

    registerNamespace(server, 'ns', toolModule);

    expect(registeredTools).toHaveLength(2);
    expect(registeredTools[0].name).toBe('ns/toolA');
    expect(registeredTools[1].name).toBe('ns/toolB');
  });

  it('skips tools with no matching handler', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const toolModule = {
      tools: [
        { name: 'ns/hasHandler', description: 'Has handler', inputSchema: z.object({}) },
        { name: 'ns/noHandler', description: 'No handler', inputSchema: z.object({}) },
      ],
      handlers: {
        'ns/hasHandler': vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }),
        // ns/noHandler intentionally missing
      },
    };

    registerNamespace(server, 'ns', toolModule);

    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe('ns/hasHandler');
  });
});
