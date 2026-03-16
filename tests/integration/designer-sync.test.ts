/**
 * MCP ↔ Designer Sync — integration tests.
 *
 * Validates bidirectional synchronization between:
 *   MCP tool results → DesignerSync → DesignerStore (canvas)
 *   Designer interactions → DesignerSync → conflict detection
 *
 * Tests: sm/create → canvas nodes, designer delta processing,
 *        destructive conflict detection, event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DesignerSync, type SyncConflict } from '@forgewright/lib/designer/sync.js';
import type { ToolResult } from '@forgewright/lib/mcp/guards.js';

// Mock filesystem
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── In-Memory Designer Store ────────────────────────────────────────────────

interface MockCanvasNode {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  metadata?: Record<string, unknown>;
}

interface MockCanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  event: string;
  condition?: string;
}

interface MockGraphDelta {
  type: 'add_node' | 'remove_node' | 'move_node' | 'add_edge' | 'remove_edge' | 'update_node';
  payload: Record<string, unknown>;
  timestamp: string;
}

function createMockDesignerStore() {
  const _nodes: MockCanvasNode[] = [];
  const _edges: MockCanvasEdge[] = [];
  const _pendingDeltas: MockGraphDelta[] = [];

  return {
    get nodes() { return _nodes; },
    get edges() { return _edges; },

    addNode(node: MockCanvasNode) {
      _nodes.push(node);
    },
    removeNode(id: string) {
      const idx = _nodes.findIndex(n => n.id === id);
      if (idx >= 0) _nodes.splice(idx, 1);
    },
    moveNode(id: string, x: number, y: number) {
      const node = _nodes.find(n => n.id === id);
      if (node) { node.x = x; node.y = y; }
    },
    updateNode(id: string, updates: Partial<MockCanvasNode>) {
      const node = _nodes.find(n => n.id === id);
      if (node) Object.assign(node, updates);
    },
    addEdge(edge: MockCanvasEdge) {
      _edges.push(edge);
    },
    removeEdge(id: string) {
      const idx = _edges.findIndex(e => e.id === id);
      if (idx >= 0) _edges.splice(idx, 1);
    },
    consumeDeltas(): MockGraphDelta[] {
      const deltas = [..._pendingDeltas];
      _pendingDeltas.length = 0;
      return deltas;
    },
    pushDelta(delta: MockGraphDelta) {
      _pendingDeltas.push(delta);
    },
    loadState() {},
    clearCanvas() {
      _nodes.length = 0;
      _edges.length = 0;
    },
  };
}

// Mock MCP server (DesignerSync doesn't call McpServer methods directly)
function createMockMcpServer() {
  return {} as any;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('MCP ↔ Designer Sync', () => {
  let store: ReturnType<typeof createMockDesignerStore>;
  let sync: DesignerSync;

  beforeEach(() => {
    store = createMockDesignerStore();
    sync = new DesignerSync(createMockMcpServer(), store as any);
  });

  afterEach(() => {
    sync.stopSync();
  });

  // ── Test 1: MCP sm/create → designer store receives new nodes ─────────────

  it('sm/create tool result pushes state nodes to designer store', () => {
    const smCreateResult: ToolResult = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          machineId: 'machine-001',
          currentState: 'TaskDefinition',
          definition: {
            state: {
              name: 'CreativeProcess',
              states: [
                {
                  name: 'Germination',
                  states: [
                    { name: 'TaskDefinition', kind: 'normal' },
                    { name: 'SpecGeneration', kind: 'normal' },
                  ],
                  transitions: [
                    { event: 'step_complete', nextState: 'Assimilation' },
                  ],
                },
                {
                  name: 'Assimilation',
                  states: [
                    { name: 'PlanGeneration', kind: 'normal' },
                  ],
                },
              ],
            },
          },
        }),
      }],
    };

    sync.onMcpChange(smCreateResult, 'sm/create');

    // Designer store should now have canvas nodes
    expect(store.nodes.length).toBeGreaterThan(0);

    const nodeNames = store.nodes.map(n => n.name);
    expect(nodeNames).toContain('CreativeProcess');
    expect(nodeNames).toContain('Germination');
    expect(nodeNames).toContain('TaskDefinition');
    expect(nodeNames).toContain('SpecGeneration');
    expect(nodeNames).toContain('Assimilation');
    expect(nodeNames).toContain('PlanGeneration');

    // Composite nodes should have proper kind
    const germination = store.nodes.find(n => n.name === 'Germination');
    expect(germination?.kind).toBe('composite');

    // Edges for transitions
    expect(store.edges.length).toBeGreaterThan(0);
    const transEdge = store.edges.find(
      e => e.sourceId === 'Germination' && e.targetId === 'Assimilation',
    );
    expect(transEdge).toBeDefined();
    expect(transEdge?.event).toBe('step_complete');
  });

  // ── Test 2: MCP sm/fire → designer store receives update ──────────────────

  it('sm/fire tool result updates active state in designer store', () => {
    // Pre-populate a node
    store.addNode({
      id: 'TaskDefinition', name: 'TaskDefinition', kind: 'normal',
      x: 100, y: 100, width: 120, height: 60, parentId: null,
    });

    const smFireResult: ToolResult = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          currentState: 'TaskDefinition',
          previousState: 'PDEDecomposition',
        }),
      }],
    };

    sync.onMcpChange(smFireResult, 'sm/fire');

    // MCP deltas should have been generated
    const deltas = sync.consumeMcpDeltas();
    expect(deltas.length).toBeGreaterThan(0);

    const updateDelta = deltas.find(d => d.type === 'update_node');
    expect(updateDelta).toBeDefined();
    expect(updateDelta?.payload.id).toBe('TaskDefinition');
  });

  // ── Test 3: graph/ingest → designer store receives new nodes ──────────────

  it('graph/ingest tool result adds nodes to designer store', () => {
    const ingestResult: ToolResult = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          createdNodes: ['intent-001', 'step-001', 'step-002'],
          ingestType: 'pde',
        }),
      }],
    };

    sync.onMcpChange(ingestResult, 'graph/ingest');

    // Three nodes should have been added
    expect(store.nodes).toHaveLength(3);
    const nodeIds = store.nodes.map(n => n.id);
    expect(nodeIds).toContain('intent-001');
    expect(nodeIds).toContain('step-001');
    expect(nodeIds).toContain('step-002');

    // Nodes have position data
    for (const node of store.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  // ── Test 4: designer delta → sync processes add_node ──────────────────────

  it('designer add_node delta emits delta:applied event', () => {
    const events: unknown[] = [];
    sync.on('delta:applied', (data) => events.push(data));

    sync.onDesignerChange({
      type: 'add_node',
      payload: {
        node: {
          id: 'designer-node-1',
          name: 'User-created state',
          kind: 'normal',
          x: 200, y: 300, width: 120, height: 60,
          parentId: null,
        },
      },
      timestamp: new Date().toISOString(),
    });

    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    expect(evt.source).toBe('designer');
  });

  // ── Test 5: conflict detection on destructive remove_node ─────────────────

  it('flags conflict when removing node with connected edges', () => {
    // Set up node with edges
    store.addNode({
      id: 'hub', name: 'Hub', kind: 'normal',
      x: 100, y: 100, width: 120, height: 60, parentId: null,
    });
    store.addNode({
      id: 'leaf', name: 'Leaf', kind: 'normal',
      x: 300, y: 100, width: 120, height: 60, parentId: null,
    });
    store.addEdge({
      id: 'edge-1', sourceId: 'hub', targetId: 'leaf', event: 'advance',
    });

    const conflicts: unknown[] = [];
    const rejections: unknown[] = [];
    sync.on('conflict:flagged', (data) => conflicts.push(data));
    sync.on('delta:rejected', (data) => rejections.push(data));

    // Try to remove node with edges
    sync.onDesignerChange({
      type: 'remove_node',
      payload: { id: 'hub' },
      timestamp: new Date().toISOString(),
    });

    // Conflict flagged
    expect(conflicts).toHaveLength(1);
    const conflict = conflicts[0] as SyncConflict;
    expect(conflict.type).toBe('destructive_collision');
    expect(conflict.reason).toContain('hub');
    expect(conflict.resolved).toBe(false);

    // Delta was rejected
    expect(rejections).toHaveLength(1);

    // Node was NOT removed (conflict prevents it)
    expect(store.nodes.find(n => n.id === 'hub')).toBeDefined();

    // Conflict is tracked
    expect(sync.getUnresolvedConflicts()).toHaveLength(1);
  });

  // ── Test 6: conflict resolution with 'accept' applies the delta ───────────

  it('resolving conflict with accept applies the deferred delta', () => {
    store.addNode({
      id: 'doomed', name: 'Doomed', kind: 'normal',
      x: 50, y: 50, width: 120, height: 60, parentId: null,
    });
    store.addEdge({
      id: 'edge-doom', sourceId: 'doomed', targetId: 'doomed', event: 'self',
    });

    // Trigger conflict
    sync.onDesignerChange({
      type: 'remove_node',
      payload: { id: 'doomed' },
      timestamp: new Date().toISOString(),
    });

    const unresolvedBefore = sync.getUnresolvedConflicts();
    expect(unresolvedBefore).toHaveLength(1);

    // Resolve with accept
    const resolved = sync.resolveConflict(unresolvedBefore[0].id, 'accept');
    expect(resolved).toBe(true);

    // Node was removed after resolution
    expect(store.nodes.find(n => n.id === 'doomed')).toBeUndefined();

    // No more unresolved conflicts
    expect(sync.getUnresolvedConflicts()).toHaveLength(0);
  });

  // ── Test 7: edge removal always flags conflict for review ─────────────────

  it('edge removal is flagged as conflict for review', () => {
    store.addNode({
      id: 'a', name: 'A', kind: 'normal',
      x: 0, y: 0, width: 60, height: 30, parentId: null,
    });
    store.addNode({
      id: 'b', name: 'B', kind: 'normal',
      x: 200, y: 0, width: 60, height: 30, parentId: null,
    });
    store.addEdge({ id: 'e-ab', sourceId: 'a', targetId: 'b', event: 'flow' });

    const conflicts: unknown[] = [];
    sync.on('conflict:flagged', (data) => conflicts.push(data));

    sync.onDesignerChange({
      type: 'remove_edge',
      payload: { id: 'e-ab' },
      timestamp: new Date().toISOString(),
    });

    expect(conflicts).toHaveLength(1);
    expect(sync.getConflicts()).toHaveLength(1);
  });

  // ── Test 8: sync lifecycle — start and stop ───────────────────────────────

  it('start/stop sync toggles running state and emits lifecycle events', () => {
    const events: string[] = [];
    sync.on('sync:started', () => events.push('started'));
    sync.on('sync:stopped', () => events.push('stopped'));

    expect(sync.isRunning()).toBe(false);

    sync.startSync();
    expect(sync.isRunning()).toBe(true);
    expect(events).toContain('started');

    // Starting again is a no-op
    sync.startSync();
    expect(events.filter(e => e === 'started')).toHaveLength(1);

    sync.stopSync();
    expect(sync.isRunning()).toBe(false);
    expect(events).toContain('stopped');
  });

  // ── Test 9: error in tool result produces no deltas ───────────────────────

  it('error tool results are ignored and produce no deltas', () => {
    const initialNodeCount = store.nodes.length;

    const errorResult: ToolResult = {
      content: [{ type: 'text', text: JSON.stringify({ error: 'something failed' }) }],
      isError: true,
    };

    sync.onMcpChange(errorResult, 'sm/create');

    // No nodes added
    expect(store.nodes.length).toBe(initialNodeCount);

    // No deltas produced
    expect(sync.consumeMcpDeltas()).toHaveLength(0);
  });

  // ── Test 10: MCP deltas accumulate and flush correctly ────────────────────

  it('consumeMcpDeltas returns accumulated deltas and flushes buffer', () => {
    const result1: ToolResult = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          createdNodes: ['node-a'],
          ingestType: 'pde',
        }),
      }],
    };

    const result2: ToolResult = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          createdNodes: ['node-b'],
          ingestType: 'pde',
        }),
      }],
    };

    sync.onMcpChange(result1, 'graph/ingest');
    sync.onMcpChange(result2, 'graph/ingest');

    // First consume: returns both deltas
    const deltas = sync.consumeMcpDeltas();
    expect(deltas.length).toBe(2);

    // Second consume: empty (buffer flushed)
    const empty = sync.consumeMcpDeltas();
    expect(empty).toHaveLength(0);
  });
});
