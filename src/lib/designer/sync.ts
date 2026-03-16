/**
 * Forgewright Designer Sync — see rispecs/05-visual-designer.spec.md
 * Layer 4: Visual designer ↔ domain engine bidirectional synchronization.
 *
 * MCP tool calls → push GraphDelta to designer store → canvas re-renders.
 * Designer interactions → push GraphDelta to server → MCP state updated.
 *
 * Conflict resolution:
 *   - Last-write-wins for simple property changes (move_node, update_node)
 *   - Merge for additive operations (add_node, add_edge)
 *   - Flag conflicts for destructive operations (remove_node, remove_edge)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  DesignerStore,
  GraphDelta,
  CanvasNode,
  CanvasEdge,
} from '../../stores/designer-store';
import type { ToolResult } from '../mcp/guards';

// ─── Conflict Types ──────────────────────────────────────────────────────────

export interface SyncConflict {
  id: string;
  type: 'destructive_collision';
  delta: GraphDelta;
  reason: string;
  timestamp: string;
  resolved: boolean;
}

// ─── Event Emitter Interface ─────────────────────────────────────────────────

type SyncEventType = 'delta:applied' | 'delta:rejected' | 'conflict:flagged' | 'sync:started' | 'sync:stopped';
type SyncListener = (data: unknown) => void;

// ─── DesignerSync Class ──────────────────────────────────────────────────────

export class DesignerSync {
  private running = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private conflicts: SyncConflict[] = [];
  private listeners = new Map<SyncEventType, Set<SyncListener>>();
  private pendingMcpDeltas: GraphDelta[] = [];

  constructor(
    private readonly mcpServer: McpServer,
    private readonly store: DesignerStore,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /** Begin bidirectional sync. Starts polling designer store for outbound deltas. */
  startSync(): void {
    if (this.running) return;
    this.running = true;

    // Poll designer store for pending deltas (from human interactions)
    this.pollInterval = setInterval(() => {
      if (!this.running) return;
      const deltas = this.store.consumeDeltas();
      for (const delta of deltas) {
        this.onDesignerChange(delta);
      }
    }, 50); // 50ms poll for near-real-time

    this.emit('sync:started', { timestamp: new Date().toISOString() });
  }

  /** Stop bidirectional sync and clean up. */
  stopSync(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.emit('sync:stopped', { timestamp: new Date().toISOString() });
  }

  isRunning(): boolean {
    return this.running;
  }

  // ─── MCP → Designer (inbound) ────────────────────────────────────────────

  /**
   * When an MCP tool modifies graph/SM state, push the delta to the designer store.
   * Called by pipeline tools or MCP handlers after state mutation.
   */
  onMcpChange(toolResult: ToolResult, toolName?: string): void {
    const deltas = this.extractDeltasFromToolResult(toolResult, toolName);

    for (const delta of deltas) {
      this.applyDeltaToStore(delta);
      this.pendingMcpDeltas.push(delta);
      this.emit('delta:applied', { source: 'mcp', delta, toolName });
    }
  }

  /** Get and flush pending MCP deltas (for WebSocket broadcast). */
  consumeMcpDeltas(): GraphDelta[] {
    const deltas = [...this.pendingMcpDeltas];
    this.pendingMcpDeltas = [];
    return deltas;
  }

  // ─── Designer → MCP (outbound) ───────────────────────────────────────────

  /**
   * When the user edits in the visual designer, process the delta
   * and update MCP-side state accordingly.
   */
  onDesignerChange(delta: GraphDelta): void {
    // Check for destructive operation conflicts
    if (this.isDestructive(delta)) {
      const conflict = this.checkConflict(delta);
      if (conflict) {
        this.conflicts.push(conflict);
        this.emit('conflict:flagged', conflict);
        this.emit('delta:rejected', { source: 'designer', delta, reason: conflict.reason });
        return;
      }
    }

    this.emit('delta:applied', { source: 'designer', delta });
  }

  // ─── Conflict Resolution ─────────────────────────────────────────────────

  getConflicts(): readonly SyncConflict[] {
    return this.conflicts;
  }

  getUnresolvedConflicts(): SyncConflict[] {
    return this.conflicts.filter(c => !c.resolved);
  }

  resolveConflict(conflictId: string, action: 'accept' | 'reject'): boolean {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict || conflict.resolved) return false;

    conflict.resolved = true;

    if (action === 'accept') {
      this.applyDeltaToStore(conflict.delta);
      this.emit('delta:applied', { source: 'conflict_resolution', delta: conflict.delta });
    }

    return true;
  }

  // ─── Event System ────────────────────────────────────────────────────────

  on(event: SyncEventType, listener: SyncListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: SyncEventType, listener: SyncListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  // ─── Internal Helpers ────────────────────────────────────────────────────

  private emit(event: SyncEventType, data: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        listener(data);
      } catch {
        // Listener errors don't break sync
      }
    }
  }

  private isDestructive(delta: GraphDelta): boolean {
    return delta.type === 'remove_node' || delta.type === 'remove_edge';
  }

  private checkConflict(delta: GraphDelta): SyncConflict | null {
    const payload = delta.payload;

    if (delta.type === 'remove_node') {
      const nodeId = payload.id as string;
      // Flag if removing a node that has edges (potential cascade)
      const nodes = this.store.nodes;
      const edges = this.store.edges;
      const hasEdges = edges.some(e => e.sourceId === nodeId || e.targetId === nodeId);

      if (hasEdges) {
        return {
          id: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'destructive_collision',
          delta,
          reason: `Removing node "${nodeId}" would orphan connected edges. Review required.`,
          timestamp: new Date().toISOString(),
          resolved: false,
        };
      }
    }

    if (delta.type === 'remove_edge') {
      // Edge removals are flagged but not blocked by default
      return {
        id: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'destructive_collision',
        delta,
        reason: `Edge removal flagged for review. Payload: ${JSON.stringify(payload)}`,
        timestamp: new Date().toISOString(),
        resolved: false,
      };
    }

    return null;
  }

  /**
   * Apply a GraphDelta to the designer store.
   * Uses last-write-wins for properties, merge for additive operations.
   */
  private applyDeltaToStore(delta: GraphDelta): void {
    const payload = delta.payload;

    switch (delta.type) {
      case 'add_node': {
        const node = payload.node as CanvasNode;
        if (node && !this.store.nodes.some(n => n.id === node.id)) {
          this.store.addNode(node);
        }
        break;
      }

      case 'remove_node': {
        const id = payload.id as string;
        if (id) {
          this.store.removeNode(id);
        }
        break;
      }

      case 'move_node': {
        const id = payload.id as string;
        const x = payload.x as number;
        const y = payload.y as number;
        if (id && typeof x === 'number' && typeof y === 'number') {
          this.store.moveNode(id, x, y);
        }
        break;
      }

      case 'update_node': {
        const id = payload.id as string;
        const updates = payload.updates as Partial<CanvasNode>;
        if (id && updates) {
          this.store.updateNode(id, updates);
        }
        break;
      }

      case 'add_edge': {
        const edge = payload.edge as CanvasEdge;
        if (edge && !this.store.edges.some(e => e.id === edge.id)) {
          this.store.addEdge(edge);
        }
        break;
      }

      case 'remove_edge': {
        const id = payload.id as string;
        if (id) {
          this.store.removeEdge(id);
        }
        break;
      }
    }
  }

  /**
   * Extract GraphDeltas from an MCP tool result.
   * Infers deltas based on tool name and result data.
   */
  private extractDeltasFromToolResult(result: ToolResult, toolName?: string): GraphDelta[] {
    if (result.isError) return [];

    const text = result.content[0]?.text;
    if (!text) return [];

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }

    const now = new Date().toISOString();
    const deltas: GraphDelta[] = [];

    // sm/create → add nodes for each state
    if (toolName === 'sm/create' && data.definition) {
      const def = data.definition as Record<string, unknown>;
      const rootState = def.state as Record<string, unknown> | undefined;
      if (rootState) {
        deltas.push(...this.extractStatesAsDeltas(rootState, null, now));
      }
    }

    // sm/fire → update_node for state change
    if (toolName === 'sm/fire' && data.currentState) {
      deltas.push({
        type: 'update_node',
        payload: {
          id: data.currentState as string,
          updates: {
            metadata: {
              active: true,
              previousState: data.previousState,
            },
          },
        },
        timestamp: now,
      });
    }

    // graph/ingest → add nodes for ingested items
    if (toolName === 'graph/ingest' && Array.isArray(data.createdNodes)) {
      for (const nodeId of data.createdNodes as string[]) {
        deltas.push({
          type: 'add_node',
          payload: {
            node: {
              id: nodeId,
              name: nodeId,
              kind: 'normal',
              x: Math.random() * 600 + 50,
              y: Math.random() * 400 + 50,
              width: 120,
              height: 60,
              parentId: null,
              metadata: { ingestType: data.ingestType },
            },
          },
          timestamp: now,
        });
      }
    }

    return deltas;
  }

  private extractStatesAsDeltas(
    state: Record<string, unknown>,
    parentId: string | null,
    timestamp: string,
    xOffset = 100,
    yOffset = 100,
  ): GraphDelta[] {
    const deltas: GraphDelta[] = [];
    const name = state.name as string;
    const children = (state.states ?? []) as Record<string, unknown>[];

    deltas.push({
      type: 'add_node',
      payload: {
        node: {
          id: name,
          name,
          kind: children.length > 0 ? 'composite' : (state.kind ?? 'normal'),
          x: xOffset,
          y: yOffset,
          width: 140,
          height: 60,
          parentId,
        },
      },
      timestamp,
    });

    children.forEach((child, i) => {
      deltas.push(
        ...this.extractStatesAsDeltas(child, name, timestamp, xOffset + 180, yOffset + i * 100),
      );
    });

    // Extract transitions as edges
    const transitions = (state.transitions ?? []) as Record<string, unknown>[];
    for (const t of transitions) {
      if (t.nextState) {
        deltas.push({
          type: 'add_edge',
          payload: {
            edge: {
              id: `${name}_${t.event}_${t.nextState}`,
              sourceId: name,
              targetId: t.nextState as string,
              event: (t.event as string) ?? '',
              condition: t.condition as string | undefined,
            },
          },
          timestamp,
        });
      }
    }

    return deltas;
  }
}

// ─── WebSocket Bridge ────────────────────────────────────────────────────────

export interface WsMessage {
  type: 'delta' | 'sync_state' | 'conflict' | 'ping' | 'pong';
  payload: unknown;
}

export interface WsClient {
  send: (data: string) => void;
  readyState: number;
}

/**
 * Wire a WebSocket server to the DesignerSync for real-time bidirectional updates.
 *
 * Client → server: sends GraphDelta objects.
 * Server → client: broadcasts applied deltas and conflict flags.
 */
export function setupWsBridge(
  clients: Set<WsClient>,
  sync: DesignerSync,
): {
  handleMessage: (client: WsClient, raw: string) => void;
  broadcastDeltas: () => void;
  cleanup: () => void;
} {
  // Listen for applied deltas and broadcast to all connected clients
  const onDeltaApplied = (data: unknown) => {
    const msg: WsMessage = { type: 'delta', payload: data };
    broadcast(clients, msg);
  };

  const onConflictFlagged = (data: unknown) => {
    const msg: WsMessage = { type: 'conflict', payload: data };
    broadcast(clients, msg);
  };

  sync.on('delta:applied', onDeltaApplied);
  sync.on('conflict:flagged', onConflictFlagged);

  function handleMessage(client: WsClient, raw: string): void {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw) as WsMessage;
    } catch {
      return; // Silently drop malformed messages
    }

    switch (msg.type) {
      case 'delta': {
        const delta = msg.payload as GraphDelta;
        if (delta && delta.type && delta.payload) {
          sync.onDesignerChange(delta);
        }
        break;
      }

      case 'ping': {
        client.send(JSON.stringify({ type: 'pong', payload: null }));
        break;
      }
    }
  }

  function broadcastDeltas(): void {
    const mcpDeltas = sync.consumeMcpDeltas();
    for (const delta of mcpDeltas) {
      const msg: WsMessage = { type: 'delta', payload: { source: 'mcp', delta } };
      broadcast(clients, msg);
    }
  }

  function cleanup(): void {
    sync.off('delta:applied', onDeltaApplied);
    sync.off('conflict:flagged', onConflictFlagged);
  }

  return { handleMessage, broadcastDeltas, cleanup };
}

function broadcast(clients: Set<WsClient>, msg: WsMessage): void {
  const serialized = JSON.stringify(msg);
  for (const client of clients) {
    // readyState 1 = OPEN
    if (client.readyState === 1) {
      try {
        client.send(serialized);
      } catch {
        // Client send failure — let connection cleanup handle it
      }
    }
  }
}

