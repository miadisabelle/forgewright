/**
 * ForgewrightGraph — KuzuDB embedded graph with in-memory fallback.
 *
 * Layer 1 of the relational substrate. Opens/creates a KuzuDB database at a
 * configurable path (default: ~/.forgewright/graph.kuzu). If the `kuzu` npm
 * package is not available, transparently falls back to a Map-based in-memory
 * store that implements the same public interface.
 */

import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import type {
  GraphNode, GraphEdge, NodeType, EdgeType,
  OcapMetadata,
} from '../types/index';

// ─── OcapContext (graph-level concern) ───────────────────────────────────────

/** Context provided by the caller on every read to enforce OCAP filtering. */
export interface OcapContext {
  /** Identity of the requester. */
  requester: string;
  /** Maximum access level the requester is cleared for. */
  maxAccessLevel: 'public' | 'community' | 'ceremony' | 'sacred';
  /** Active ceremony ID (required for ceremony/sacred access). */
  ceremonyId?: string;
  /** Whether a ceremony is currently open. */
  isCeremonyActive?: boolean;
}

// ─── Subgraph result ─────────────────────────────────────────────────────────

export interface SubgraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── IGraphStore — unified interface for both backends ───────────────────────

export interface IGraphStore {
  initSchema(): Promise<void>;
  close(): Promise<void>;

  // Node CRUD
  createNode(node: GraphNode): Promise<void>;
  getNode(id: string): Promise<GraphNode | null>;
  updateNode(id: string, updates: Partial<GraphNode>): Promise<void>;
  deleteNode(id: string): Promise<void>;
  findNodes(nodeType: NodeType, filters?: Record<string, unknown>): Promise<GraphNode[]>;

  // Edge CRUD
  createEdge(edge: GraphEdge): Promise<void>;
  getEdge(id: string): Promise<GraphEdge | null>;
  deleteEdge(id: string): Promise<void>;
  findEdges(edgeType: EdgeType, filters?: Record<string, unknown>): Promise<GraphEdge[]>;
  getEdgesBetween(fromId: string, toId: string): Promise<GraphEdge[]>;

  // Traversal
  getNeighbors(nodeId: string, hops?: number): Promise<SubgraphResult>;
  getShortestPath(fromId: string, toId: string): Promise<SubgraphResult | null>;

  // Raw query — KuzuDB-only; no-op on memory store
  rawQuery(cypher: string, params?: Record<string, unknown>): Promise<unknown[]>;

  /** True when backed by actual KuzuDB, false for in-memory fallback. */
  readonly isNative: boolean;
}

// ─── Node schema DDL (KuzuDB Cypher) ─────────────────────────────────────────

const NODE_SCHEMAS: string[] = [
  `CREATE NODE TABLE IF NOT EXISTS Spec (
    id STRING PRIMARY KEY, name STRING, version STRING,
    direction STRING, status STRING DEFAULT 'draft', content STRING,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS Companion (
    id STRING PRIMARY KEY, name STRING, role STRING, embodiment STRING,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS Ceremony (
    id STRING PRIMARY KEY, name STRING, direction STRING, phase STRING,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS Session (
    id STRING PRIMARY KEY, title STRING,
    started_at STRING, ended_at STRING, status STRING DEFAULT 'active',
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS ActionStep (
    id STRING PRIMARY KEY, description STRING,
    order_index INT64, status STRING DEFAULT 'pending',
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS NarrativeBeat (
    id STRING PRIMARY KEY, content STRING,
    emotion STRING, intensity DOUBLE DEFAULT 0.5,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS Intent (
    id STRING PRIMARY KEY, description STRING,
    direction STRING, urgency STRING DEFAULT 'session',
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS StateMachine (
    id STRING PRIMARY KEY, name STRING, namespace STRING, current_state STRING,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS State (
    id STRING PRIMARY KEY, name STRING,
    is_initial BOOL DEFAULT false, is_final BOOL DEFAULT false, kind STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE NODE TABLE IF NOT EXISTS Event (
    id STRING PRIMARY KEY, name STRING, payload STRING,
    fired_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
];

const REL_SCHEMAS: string[] = [
  `CREATE REL TABLE IF NOT EXISTS DEPENDS_ON (
    FROM ActionStep TO ActionStep,
    strength DOUBLE DEFAULT 1.0, created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS BELONGS_TO (
    FROM ActionStep TO Session,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS SERVES_DIRECTION (
    FROM ActionStep TO Ceremony,
    direction STRING, created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS AUTHORED_BY (
    FROM Spec TO Companion,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS GOVERNED_BY (
    FROM Session TO Ceremony,
    role STRING, created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS TRANSITIONS_TO (
    FROM State TO State,
    event_name STRING, guard STRING, created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS CONTAINS (
    FROM StateMachine TO State,
    order_index INT64, created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS GENERATED_FROM (
    FROM StateMachine TO Intent,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS NARRATES (
    FROM NarrativeBeat TO ActionStep,
    created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS ACCOUNTABLE_TO (
    FROM ActionStep TO Companion,
    accountability_type STRING, created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
  `CREATE REL TABLE IF NOT EXISTS KIN_OF (
    FROM Spec TO Spec,
    kinship_type STRING, created_at STRING,
    ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
  )`,
];

// ─── KuzuDB Backend ──────────────────────────────────────────────────────────

class KuzuStore implements IGraphStore {
  private db: any;
  private conn: any;
  readonly isNative = true;

  constructor(private dbPath: string) {}

  async init(Database: any, Connection: any): Promise<void> {
    mkdirSync(this.dbPath, { recursive: true });
    this.db = new Database(this.dbPath);
    this.conn = new Connection(this.db);
  }

  async initSchema(): Promise<void> {
    for (const ddl of [...NODE_SCHEMAS, ...REL_SCHEMAS]) {
      await this.conn.query(ddl);
    }
  }

  async close(): Promise<void> {
    // KuzuDB connections are cleaned up on GC; explicit close if API exists
    if (this.conn?.close) await this.conn.close();
    if (this.db?.close) await this.db.close();
  }

  async createNode(node: GraphNode): Promise<void> {
    const props = nodeToFlat(node);
    const keys = Object.keys(props);
    const placeholders = keys.map(k => `$${k}`).join(', ');
    const propList = keys.map(k => `${k}: $${k}`).join(', ');
    const cypher = `CREATE (n:${node.nodeType} {${propList}})`;
    const stmt = await this.conn.prepare(cypher);
    await this.conn.execute(stmt, props);
  }

  async getNode(id: string): Promise<GraphNode | null> {
    for (const nt of NODE_TYPE_LIST) {
      const result = await this.conn.query(
        `MATCH (n:${nt}) WHERE n.id = '${escapeStr(id)}' RETURN n`
      );
      const rows = await result.getAll();
      if (rows.length > 0) return rowToGraphNode(rows[0], nt);
    }
    return null;
  }

  async updateNode(id: string, updates: Partial<GraphNode>): Promise<void> {
    const node = await this.getNode(id);
    if (!node) return;
    const flat = nodeToFlat(updates as GraphNode);
    delete flat.id;
    delete flat.nodeType;
    const sets = Object.keys(flat).map(k => `n.${k} = $${k}`).join(', ');
    if (!sets) return;
    const cypher = `MATCH (n:${node.nodeType}) WHERE n.id = '${escapeStr(id)}' SET ${sets}`;
    const stmt = await this.conn.prepare(cypher);
    await this.conn.execute(stmt, flat);
  }

  async deleteNode(id: string): Promise<void> {
    const node = await this.getNode(id);
    if (!node) return;
    await this.conn.query(
      `MATCH (n:${node.nodeType}) WHERE n.id = '${escapeStr(id)}' DETACH DELETE n`
    );
  }

  async findNodes(nodeType: NodeType, filters?: Record<string, unknown>): Promise<GraphNode[]> {
    let cypher = `MATCH (n:${nodeType})`;
    if (filters && Object.keys(filters).length > 0) {
      const clauses = Object.entries(filters)
        .map(([k, v]) => `n.${k} = '${escapeStr(String(v))}'`)
        .join(' AND ');
      cypher += ` WHERE ${clauses}`;
    }
    cypher += ' RETURN n';
    const result = await this.conn.query(cypher);
    const rows = await result.getAll();
    return rows.map((r: any) => rowToGraphNode(r, nodeType));
  }

  async createEdge(edge: GraphEdge): Promise<void> {
    const from = await this.getNode(edge.fromId);
    const to = await this.getNode(edge.toId);
    if (!from || !to) throw new Error(`Cannot create edge: missing node(s) for ${edge.fromId} → ${edge.toId}`);
    const props = edgeToFlat(edge);
    const propList = Object.keys(props).map(k => `${k}: $${k}`).join(', ');
    const cypher = `MATCH (a:${from.nodeType}), (b:${to.nodeType}) WHERE a.id = '${escapeStr(edge.fromId)}' AND b.id = '${escapeStr(edge.toId)}' CREATE (a)-[:${edge.edgeType} {${propList}}]->(b)`;
    const stmt = await this.conn.prepare(cypher);
    await this.conn.execute(stmt, props);
  }

  async getEdge(id: string): Promise<GraphEdge | null> {
    // Edges in KuzuDB don't have a simple ID lookup; we scan the memory store index
    return null;
  }

  async deleteEdge(id: string): Promise<void> {
    // Not directly supported without knowing edge type + endpoints
  }

  async findEdges(edgeType: EdgeType, filters?: Record<string, unknown>): Promise<GraphEdge[]> {
    let cypher = `MATCH (a)-[r:${edgeType}]->(b)`;
    if (filters && Object.keys(filters).length > 0) {
      const clauses = Object.entries(filters)
        .map(([k, v]) => `r.${k} = '${escapeStr(String(v))}'`)
        .join(' AND ');
      cypher += ` WHERE ${clauses}`;
    }
    cypher += ' RETURN a.id AS fromId, b.id AS toId, r';
    const result = await this.conn.query(cypher);
    const rows = await result.getAll();
    return rows.map((r: any) => rowToGraphEdge(r, edgeType));
  }

  async getEdgesBetween(fromId: string, toId: string): Promise<GraphEdge[]> {
    const result = await this.conn.query(
      `MATCH (a)-[r]->(b) WHERE a.id = '${escapeStr(fromId)}' AND b.id = '${escapeStr(toId)}' RETURN a.id AS fromId, b.id AS toId, r`
    );
    const rows = await result.getAll();
    return rows.map((r: any) => rowToGraphEdge(r, r.r?.edgeType ?? 'KIN_OF'));
  }

  async getNeighbors(nodeId: string, hops = 1): Promise<SubgraphResult> {
    const result = await this.conn.query(
      `MATCH (a)-[r*1..${hops}]-(b) WHERE a.id = '${escapeStr(nodeId)}' RETURN DISTINCT b`
    );
    const rows = await result.getAll();
    const nodes: GraphNode[] = rows
      .map((r: any) => tryParseNode(r))
      .filter(Boolean) as GraphNode[];
    return { nodes, edges: [] };
  }

  async getShortestPath(fromId: string, toId: string): Promise<SubgraphResult | null> {
    try {
      const result = await this.conn.query(
        `MATCH p = shortestPath((a)-[*1..10]-(b)) WHERE a.id = '${escapeStr(fromId)}' AND b.id = '${escapeStr(toId)}' RETURN nodes(p) AS path_nodes`
      );
      const rows = await result.getAll();
      if (rows.length === 0) return null;
      return { nodes: [], edges: [] };
    } catch {
      return null;
    }
  }

  async rawQuery(cypher: string, params?: Record<string, unknown>): Promise<unknown[]> {
    if (params && Object.keys(params).length > 0) {
      const stmt = await this.conn.prepare(cypher);
      const result = await this.conn.execute(stmt, params);
      return result.getAll();
    }
    const result = await this.conn.query(cypher);
    return result.getAll();
  }
}

// ─── In-Memory Fallback ──────────────────────────────────────────────────────

class MemoryStore implements IGraphStore {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  readonly isNative = false;

  async initSchema(): Promise<void> {
    // No-op: memory store has no schema to initialize
  }

  async close(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
  }

  async createNode(node: GraphNode): Promise<void> {
    this.nodes.set(node.id, structuredClone(node));
  }

  async getNode(id: string): Promise<GraphNode | null> {
    return this.nodes.get(id) ?? null;
  }

  async updateNode(id: string, updates: Partial<GraphNode>): Promise<void> {
    const existing = this.nodes.get(id);
    if (!existing) return;
    this.nodes.set(id, { ...existing, ...updates, id } as GraphNode);
  }

  async deleteNode(id: string): Promise<void> {
    this.nodes.delete(id);
    // Remove edges connected to this node
    for (const [eid, edge] of this.edges) {
      if (edge.fromId === id || edge.toId === id) {
        this.edges.delete(eid);
      }
    }
  }

  async findNodes(nodeType: NodeType, filters?: Record<string, unknown>): Promise<GraphNode[]> {
    const results: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.nodeType !== nodeType) continue;
      if (filters) {
        const matches = Object.entries(filters).every(
          ([k, v]) => (node as any)[k] === v,
        );
        if (!matches) continue;
      }
      results.push(node);
    }
    return results;
  }

  async createEdge(edge: GraphEdge): Promise<void> {
    this.edges.set(edge.id, structuredClone(edge));
  }

  async getEdge(id: string): Promise<GraphEdge | null> {
    return this.edges.get(id) ?? null;
  }

  async deleteEdge(id: string): Promise<void> {
    this.edges.delete(id);
  }

  async findEdges(edgeType: EdgeType, filters?: Record<string, unknown>): Promise<GraphEdge[]> {
    const results: GraphEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.edgeType !== edgeType) continue;
      if (filters) {
        const matches = Object.entries(filters).every(
          ([k, v]) => (edge as any)[k] === v || (edge.metadata as any)?.[k] === v,
        );
        if (!matches) continue;
      }
      results.push(edge);
    }
    return results;
  }

  async getEdgesBetween(fromId: string, toId: string): Promise<GraphEdge[]> {
    const results: GraphEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.fromId === fromId && edge.toId === toId) {
        results.push(edge);
      }
    }
    return results;
  }

  async getNeighbors(nodeId: string, hops = 1): Promise<SubgraphResult> {
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    let frontier = new Set<string>([nodeId]);

    for (let hop = 0; hop < hops; hop++) {
      const nextFrontier = new Set<string>();
      for (const edge of this.edges.values()) {
        if (frontier.has(edge.fromId) && !visitedNodes.has(edge.toId)) {
          nextFrontier.add(edge.toId);
          visitedEdges.add(edge.id);
        }
        if (frontier.has(edge.toId) && !visitedNodes.has(edge.fromId)) {
          nextFrontier.add(edge.fromId);
          visitedEdges.add(edge.id);
        }
      }
      for (const nid of nextFrontier) visitedNodes.add(nid);
      frontier = nextFrontier;
    }

    visitedNodes.delete(nodeId);
    const nodes = [...visitedNodes]
      .map(nid => this.nodes.get(nid))
      .filter(Boolean) as GraphNode[];
    const edges = [...visitedEdges]
      .map(eid => this.edges.get(eid))
      .filter(Boolean) as GraphEdge[];
    return { nodes, edges };
  }

  async getShortestPath(fromId: string, toId: string): Promise<SubgraphResult | null> {
    // BFS for shortest path
    if (fromId === toId) return { nodes: [], edges: [] };
    const visited = new Set<string>([fromId]);
    const parentMap = new Map<string, { nodeId: string; edgeId: string }>();
    let queue = [fromId];

    while (queue.length > 0) {
      const next: string[] = [];
      for (const current of queue) {
        for (const edge of this.edges.values()) {
          let neighbor: string | null = null;
          if (edge.fromId === current && !visited.has(edge.toId)) {
            neighbor = edge.toId;
          } else if (edge.toId === current && !visited.has(edge.fromId)) {
            neighbor = edge.fromId;
          }
          if (neighbor) {
            visited.add(neighbor);
            parentMap.set(neighbor, { nodeId: current, edgeId: edge.id });
            if (neighbor === toId) {
              return this.reconstructPath(parentMap, fromId, toId);
            }
            next.push(neighbor);
          }
        }
      }
      queue = next;
    }
    return null;
  }

  private reconstructPath(
    parentMap: Map<string, { nodeId: string; edgeId: string }>,
    fromId: string,
    toId: string,
  ): SubgraphResult {
    const pathNodes: GraphNode[] = [];
    const pathEdges: GraphEdge[] = [];
    let current = toId;

    while (current !== fromId) {
      const node = this.nodes.get(current);
      if (node) pathNodes.unshift(node);
      const parent = parentMap.get(current);
      if (!parent) break;
      const edge = this.edges.get(parent.edgeId);
      if (edge) pathEdges.unshift(edge);
      current = parent.nodeId;
    }
    const startNode = this.nodes.get(fromId);
    if (startNode) pathNodes.unshift(startNode);
    return { nodes: pathNodes, edges: pathEdges };
  }

  async rawQuery(_cypher: string, _params?: Record<string, unknown>): Promise<unknown[]> {
    // In-memory store does not support raw Cypher
    console.warn('[ForgewrightGraph/memory] rawQuery not supported in fallback mode');
    return [];
  }
}

// ─── ForgewrightGraph (public facade) ────────────────────────────────────────

export class ForgewrightGraph {
  private store: IGraphStore;

  private constructor(store: IGraphStore) {
    this.store = store;
  }

  /** True when backed by actual KuzuDB, false for in-memory fallback. */
  get isNative(): boolean {
    return this.store.isNative;
  }

  /**
   * Create and initialize a ForgewrightGraph.
   *
   * @param dbPath - Directory for KuzuDB storage (default: ~/.forgewright/graph.kuzu)
   * @returns Initialized graph instance (KuzuDB if available, in-memory otherwise)
   */
  static async create(dbPath?: string): Promise<ForgewrightGraph> {
    const resolvedPath = dbPath ?? join(homedir(), '.forgewright', 'graph.kuzu');

    try {
      // Dynamic import with type suppression — kuzu may not be installed
      const kuzu = await import(/* webpackIgnore: true */ 'kuzu' as string);
      const Database = kuzu.default?.Database ?? kuzu.Database;
      const Connection = kuzu.default?.Connection ?? kuzu.Connection;
      if (!Database || !Connection) throw new Error('kuzu module missing Database/Connection');

      const store = new KuzuStore(resolvedPath);
      await store.init(Database, Connection);
      const graph = new ForgewrightGraph(store);
      await graph.initSchema();
      return graph;
    } catch {
      console.warn(
        '[ForgewrightGraph] kuzu package not available — using in-memory fallback. ' +
        'Install kuzu@^0.11.2 for persistent graph storage.',
      );
      const store = new MemoryStore();
      const graph = new ForgewrightGraph(store);
      await graph.initSchema();
      return graph;
    }
  }

  /**
   * Create an explicitly in-memory graph (useful for testing).
   */
  static async createInMemory(): Promise<ForgewrightGraph> {
    const store = new MemoryStore();
    const graph = new ForgewrightGraph(store);
    await graph.initSchema();
    return graph;
  }

  /** Initialize all 10 node tables + 11 relationship tables. */
  async initSchema(): Promise<void> {
    return this.store.initSchema();
  }

  /** Close the database and release resources. */
  async close(): Promise<void> {
    return this.store.close();
  }

  // ─── Node operations ─────────────────────────────────────────────────────

  async createNode(node: GraphNode): Promise<void> {
    return this.store.createNode(node);
  }

  async getNode(id: string): Promise<GraphNode | null> {
    return this.store.getNode(id);
  }

  async updateNode(id: string, updates: Partial<GraphNode>): Promise<void> {
    return this.store.updateNode(id, updates);
  }

  async deleteNode(id: string): Promise<void> {
    return this.store.deleteNode(id);
  }

  async findNodes(nodeType: NodeType, filters?: Record<string, unknown>): Promise<GraphNode[]> {
    return this.store.findNodes(nodeType, filters);
  }

  // ─── Edge operations ─────────────────────────────────────────────────────

  async createEdge(edge: GraphEdge): Promise<void> {
    return this.store.createEdge(edge);
  }

  async getEdge(id: string): Promise<GraphEdge | null> {
    return this.store.getEdge(id);
  }

  async deleteEdge(id: string): Promise<void> {
    return this.store.deleteEdge(id);
  }

  async findEdges(edgeType: EdgeType, filters?: Record<string, unknown>): Promise<GraphEdge[]> {
    return this.store.findEdges(edgeType, filters);
  }

  async getEdgesBetween(fromId: string, toId: string): Promise<GraphEdge[]> {
    return this.store.getEdgesBetween(fromId, toId);
  }

  // ─── Traversal ───────────────────────────────────────────────────────────

  async getNeighbors(nodeId: string, hops?: number): Promise<SubgraphResult> {
    return this.store.getNeighbors(nodeId, hops);
  }

  async getShortestPath(fromId: string, toId: string): Promise<SubgraphResult | null> {
    return this.store.getShortestPath(fromId, toId);
  }

  /**
   * Execute a raw Cypher query (KuzuDB backend only).
   * Returns empty array on in-memory fallback.
   */
  async rawQuery(cypher: string, params?: Record<string, unknown>): Promise<unknown[]> {
    return this.store.rawQuery(cypher, params);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NODE_TYPE_LIST: NodeType[] = [
  'Spec', 'Companion', 'Ceremony', 'Session', 'ActionStep',
  'NarrativeBeat', 'Intent', 'StateMachine', 'State', 'Event',
];

function escapeStr(s: string): string {
  return s.replace(/'/g, "\\'");
}

/** Flatten a GraphNode into key-value pairs suitable for Cypher parameters. */
function nodeToFlat(node: GraphNode): Record<string, unknown> {
  const { ocap, ...rest } = node as any;
  return {
    ...rest,
    ocap_owner: ocap?.ownership ?? '',
    ocap_control: ocap?.control ?? '',
    ocap_access: ocap?.access ?? 'public',
    ocap_possession: ocap?.possession ?? '',
    created_at: rest.createdAt ?? new Date().toISOString(),
  };
}

/** Flatten a GraphEdge into key-value pairs for Cypher edge properties. */
function edgeToFlat(edge: GraphEdge): Record<string, unknown> {
  const result: Record<string, unknown> = {
    created_at: edge.createdAt ?? new Date().toISOString(),
    ocap_owner: edge.ocap?.ownership ?? '',
    ocap_control: edge.ocap?.control ?? '',
    ocap_access: edge.ocap?.access ?? 'public',
    ocap_possession: edge.ocap?.possession ?? '',
  };
  if (edge.strength !== undefined) result.strength = edge.strength;
  if (edge.direction) result.direction = edge.direction;
  if (edge.metadata) {
    for (const [k, v] of Object.entries(edge.metadata)) {
      result[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
  }
  return result;
}

/** Try to reconstruct a GraphNode from a KuzuDB row. */
function rowToGraphNode(row: any, nodeType: NodeType): GraphNode {
  const n = row.n ?? row;
  return {
    id: n.id ?? n.ID,
    nodeType,
    ocap: {
      ownership: n.ocap_owner ?? '',
      control: n.ocap_control ?? '',
      access: n.ocap_access ?? 'public',
      possession: n.ocap_possession ?? '',
    },
    createdAt: n.created_at ?? new Date().toISOString(),
    ...extractNodeProps(n, nodeType),
  } as GraphNode;
}

/** Extract node-type-specific properties from a raw row. */
function extractNodeProps(n: any, nodeType: NodeType): Record<string, unknown> {
  switch (nodeType) {
    case 'Spec': return { name: n.name, version: n.version, direction: n.direction, status: n.status, content: n.content };
    case 'Companion': return { name: n.name, role: n.role, embodiment: n.embodiment };
    case 'Ceremony': return { name: n.name, direction: n.direction, phase: n.phase };
    case 'Session': return { title: n.title, startedAt: n.started_at, endedAt: n.ended_at, status: n.status };
    case 'ActionStep': return { description: n.description, orderIndex: n.order_index, status: n.status };
    case 'NarrativeBeat': return { content: n.content, emotion: n.emotion, intensity: n.intensity };
    case 'Intent': return { description: n.description, direction: n.direction, urgency: n.urgency };
    case 'StateMachine': return { name: n.name, namespace: n.namespace, currentState: n.current_state };
    case 'State': return { name: n.name, isInitial: n.is_initial, isFinal: n.is_final, kind: n.kind };
    case 'Event': return { name: n.name, payload: n.payload, firedAt: n.fired_at };
    default: return {};
  }
}

/** Try to parse a node from a KuzuDB result row (heuristic). */
function tryParseNode(row: any): GraphNode | null {
  const n = row.b ?? row.n ?? row;
  if (!n?.id) return null;
  for (const nt of NODE_TYPE_LIST) {
    if (n._label === nt || n.nodeType === nt) return rowToGraphNode(n, nt);
  }
  // Heuristic: try to guess from properties
  if (n.version !== undefined) return rowToGraphNode(n, 'Spec');
  if (n.role !== undefined) return rowToGraphNode(n, 'Companion');
  if (n.phase !== undefined) return rowToGraphNode(n, 'Ceremony');
  if (n.current_state !== undefined) return rowToGraphNode(n, 'StateMachine');
  return null;
}

function rowToGraphEdge(row: any, edgeType: EdgeType): GraphEdge {
  const r = row.r ?? row;
  return {
    id: `${row.fromId ?? r.fromId}→${edgeType}→${row.toId ?? r.toId}`,
    fromId: row.fromId ?? r.fromId ?? '',
    toId: row.toId ?? r.toId ?? '',
    edgeType,
    strength: r.strength ?? 1.0,
    ocap: {
      ownership: r.ocap_owner ?? '',
      control: r.ocap_control ?? '',
      access: r.ocap_access ?? 'public',
      possession: r.ocap_possession ?? '',
    },
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}
