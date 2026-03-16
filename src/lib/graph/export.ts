/**
 * Graph Export — Mermaid diagrams, Cypher statements, and summary stats.
 *
 * Four Directions positioning: East=right, South=bottom, West=left, North=top.
 */

import type { GraphNode, GraphEdge, NodeType, EdgeType, DirectionName } from '../types/index.js';
import { DIRECTIONS } from '../types/index.js';
import { ForgewrightGraph, type OcapContext, type SubgraphResult } from './database.js';
import { filterNodes, filterEdges } from './ocap-filter.js';

// ─── Export Scope ────────────────────────────────────────────────────────────

export interface ExportScope {
  /** Limit to a specific session. */
  sessionId?: string;
  /** Limit to specific node types. */
  nodeTypes?: NodeType[];
  /** Limit to specific edge types. */
  edgeTypes?: EdgeType[];
}

export interface MermaidOptions {
  /** Use Four Directions spatial positioning (default: true). */
  fourDirections?: boolean;
  /** Include OCAP annotations (default: false). */
  showOcap?: boolean;
  /** Graph direction: TB (top-bottom), LR (left-right). */
  graphDirection?: 'TB' | 'LR';
}

// ─── Mermaid Export ──────────────────────────────────────────────────────────

/**
 * Generate a Mermaid flowchart diagram from graph data.
 *
 * @param graph - ForgewrightGraph instance
 * @param ctx - OCAP context for filtering
 * @param scope - Optional scope to limit exported data
 * @param options - Mermaid formatting options
 * @returns Mermaid diagram string
 */
export async function toMermaid(
  graph: ForgewrightGraph,
  ctx: OcapContext,
  scope?: ExportScope,
  options?: MermaidOptions,
): Promise<string> {
  const { nodes, edges } = await collectSubgraph(graph, ctx, scope);
  const opts: Required<MermaidOptions> = {
    fourDirections: options?.fourDirections ?? true,
    showOcap: options?.showOcap ?? false,
    graphDirection: options?.graphDirection ?? 'TB',
  };

  const lines: string[] = [];
  lines.push(`graph ${opts.graphDirection}`);
  lines.push('');

  // Four Directions subgraphs
  if (opts.fourDirections) {
    const directionNodes = groupByDirection(nodes);
    for (const [dir, dirNodes] of Object.entries(directionNodes)) {
      const info = DIRECTIONS[dir as DirectionName];
      if (dirNodes.length === 0) continue;
      lines.push(`  subgraph ${info.emoji}_${info.name}["${info.emoji} ${info.name} — ${info.ojibwe}"]`);
      lines.push(`    direction ${opts.graphDirection}`);
      for (const node of dirNodes) {
        lines.push(`    ${mermaidNode(node, opts.showOcap)}`);
      }
      lines.push('  end');
      lines.push('');
    }

    // Nodes without direction
    const undirected = nodes.filter(n => !getNodeDirection(n));
    if (undirected.length > 0) {
      lines.push('  subgraph center["🔵 Center"]');
      for (const node of undirected) {
        lines.push(`    ${mermaidNode(node, opts.showOcap)}`);
      }
      lines.push('  end');
      lines.push('');
    }
  } else {
    for (const node of nodes) {
      lines.push(`  ${mermaidNode(node, opts.showOcap)}`);
    }
  }

  // Edges
  const nodeIds = new Set(nodes.map(n => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.fromId) || !nodeIds.has(edge.toId)) continue;
    const label = edge.edgeType.replace(/_/g, ' ');
    const from = sanitizeId(edge.fromId);
    const to = sanitizeId(edge.toId);
    lines.push(`  ${from} -->|${label}| ${to}`);
  }

  // Direction-based styling
  if (opts.fourDirections) {
    lines.push('');
    lines.push('  classDef east fill:#FFD700,stroke:#333,color:#000');
    lines.push('  classDef south fill:#DC143C,stroke:#333,color:#fff');
    lines.push('  classDef west fill:#1a1a2e,stroke:#ccc,color:#fff');
    lines.push('  classDef north fill:#E8E8E8,stroke:#333,color:#000');
  }

  return lines.join('\n');
}

// ─── Cypher Export ───────────────────────────────────────────────────────────

/**
 * Export graph data as Cypher CREATE statements (portable to KuzuDB/Neo4j).
 *
 * @param graph - ForgewrightGraph instance
 * @param ctx - OCAP context for filtering
 * @param scope - Optional scope to limit exported data
 * @returns Cypher CREATE statement string
 */
export async function toCypher(
  graph: ForgewrightGraph,
  ctx: OcapContext,
  scope?: ExportScope,
): Promise<string> {
  const { nodes, edges } = await collectSubgraph(graph, ctx, scope);
  const lines: string[] = [];

  lines.push('// Forgewright Graph Export — Cypher CREATE statements');
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(`// Nodes: ${nodes.length}, Edges: ${edges.length}`);
  lines.push('');

  // Node CREATE statements
  for (const node of nodes) {
    const props = nodeToCypherProps(node);
    lines.push(`CREATE (${sanitizeVar(node.id)}:${node.nodeType} ${props});`);
  }
  lines.push('');

  // Edge CREATE statements using MATCH + CREATE
  const nodeIds = new Set(nodes.map(n => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.fromId) || !nodeIds.has(edge.toId)) continue;
    const fromVar = sanitizeVar(edge.fromId);
    const toVar = sanitizeVar(edge.toId);
    const props = edgeToCypherProps(edge);
    lines.push(
      `MATCH (${fromVar}), (${toVar}) ` +
      `WHERE ${fromVar}.id = '${escStr(edge.fromId)}' AND ${toVar}.id = '${escStr(edge.toId)}' ` +
      `CREATE (${fromVar})-[:${edge.edgeType} ${props}]->(${toVar});`,
    );
  }

  return lines.join('\n');
}

// ─── Summary Stats ───────────────────────────────────────────────────────────

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  ocapDistribution: Record<string, number>;
}

/**
 * Compute summary statistics for the graph.
 *
 * @param graph - ForgewrightGraph instance
 * @param ctx - OCAP context for filtering
 * @param scope - Optional scope
 */
export async function summaryStats(
  graph: ForgewrightGraph,
  ctx: OcapContext,
  scope?: ExportScope,
): Promise<GraphStats> {
  const { nodes, edges } = await collectSubgraph(graph, ctx, scope);

  const nodesByType: Record<string, number> = {};
  const ocapDistribution: Record<string, number> = {};

  for (const node of nodes) {
    nodesByType[node.nodeType] = (nodesByType[node.nodeType] ?? 0) + 1;
    const access = node.ocap?.access ?? 'unknown';
    ocapDistribution[access] = (ocapDistribution[access] ?? 0) + 1;
  }

  const edgesByType: Record<string, number> = {};
  for (const edge of edges) {
    edgesByType[edge.edgeType] = (edgesByType[edge.edgeType] ?? 0) + 1;
  }

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByType,
    edgesByType,
    ocapDistribution,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALL_NODE_TYPES: NodeType[] = [
  'Spec', 'Companion', 'Ceremony', 'Session', 'ActionStep',
  'NarrativeBeat', 'Intent', 'StateMachine', 'State', 'Event',
];

const ALL_EDGE_TYPES: EdgeType[] = [
  'DEPENDS_ON', 'BELONGS_TO', 'SERVES_DIRECTION', 'AUTHORED_BY',
  'GOVERNED_BY', 'TRANSITIONS_TO', 'CONTAINS', 'GENERATED_FROM',
  'NARRATES', 'ACCOUNTABLE_TO', 'KIN_OF',
];

async function collectSubgraph(
  graph: ForgewrightGraph,
  ctx: OcapContext,
  scope?: ExportScope,
): Promise<SubgraphResult> {
  const nodeTypes = scope?.nodeTypes ?? ALL_NODE_TYPES;
  const edgeTypes = scope?.edgeTypes ?? ALL_EDGE_TYPES;

  let allNodes: GraphNode[] = [];
  for (const nt of nodeTypes) {
    const nodes = await graph.findNodes(nt);
    allNodes.push(...nodes);
  }
  allNodes = filterNodes(allNodes, ctx);

  let allEdges: GraphEdge[] = [];
  for (const et of edgeTypes) {
    const edges = await graph.findEdges(et);
    allEdges.push(...edges);
  }
  allEdges = filterEdges(allEdges, ctx);

  // Only include edges whose endpoints are in the node set
  const nodeIds = new Set(allNodes.map(n => n.id));
  allEdges = allEdges.filter(e => nodeIds.has(e.fromId) && nodeIds.has(e.toId));

  return { nodes: allNodes, edges: allEdges };
}

function getNodeDirection(node: GraphNode): DirectionName | null {
  const n = node as any;
  if (n.direction && ['east', 'south', 'west', 'north'].includes(n.direction)) {
    return n.direction as DirectionName;
  }
  return null;
}

function groupByDirection(nodes: GraphNode[]): Record<DirectionName, GraphNode[]> {
  const groups: Record<DirectionName, GraphNode[]> = {
    east: [], south: [], west: [], north: [],
  };
  for (const node of nodes) {
    const dir = getNodeDirection(node);
    if (dir) groups[dir].push(node);
  }
  return groups;
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeVar(id: string): string {
  return 'n_' + id.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
}

function escStr(s: string): string {
  return s.replace(/'/g, "\\'");
}

function mermaidNode(node: GraphNode, showOcap: boolean): string {
  const id = sanitizeId(node.id);
  const label = getNodeLabel(node);
  const ocapTag = showOcap ? ` [${node.ocap?.access ?? '?'}]` : '';
  const shape = getNodeShape(node.nodeType);
  return `${id}${shape[0]}"${label}${ocapTag}"${shape[1]}`;
}

function getNodeLabel(node: GraphNode): string {
  const n = node as any;
  return n.name ?? n.title ?? n.description ?? n.content?.slice(0, 40) ?? node.id;
}

function getNodeShape(nodeType: NodeType): [string, string] {
  switch (nodeType) {
    case 'Ceremony': return ['{{', '}}'];     // hexagon
    case 'Session': return ['([', '])'];       // stadium
    case 'ActionStep': return ['[/', '/]'];    // parallelogram
    case 'NarrativeBeat': return ['>', ']'];   // asymmetric
    case 'Intent': return ['((', '))'];        // circle
    case 'StateMachine': return ['[[', ']]'];  // subroutine
    case 'State': return ['(', ')'];           // rounded
    case 'Event': return ['{', '}'];           // rhombus
    default: return ['[', ']'];                // rectangle
  }
}

function nodeToCypherProps(node: GraphNode): string {
  const props: Record<string, unknown> = {
    id: node.id,
    ocap_owner: node.ocap?.ownership ?? '',
    ocap_control: node.ocap?.control ?? '',
    ocap_access: node.ocap?.access ?? 'public',
    ocap_possession: node.ocap?.possession ?? '',
    created_at: node.createdAt,
  };
  const n = node as any;
  if (n.name) props.name = n.name;
  if (n.description) props.description = n.description;
  if (n.direction) props.direction = n.direction;
  if (n.status) props.status = n.status;
  if (n.version) props.version = n.version;
  if (n.content) props.content = n.content;
  if (n.phase) props.phase = n.phase;

  const pairs = Object.entries(props)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${escStr(v)}'` : v}`)
    .join(', ');
  return `{${pairs}}`;
}

function edgeToCypherProps(edge: GraphEdge): string {
  const props: Record<string, unknown> = {
    ocap_owner: edge.ocap?.ownership ?? '',
    ocap_control: edge.ocap?.control ?? '',
    ocap_access: edge.ocap?.access ?? 'public',
    ocap_possession: edge.ocap?.possession ?? '',
    created_at: edge.createdAt,
  };
  if (edge.strength !== undefined) props.strength = edge.strength;
  if (edge.direction) props.direction = edge.direction;

  const pairs = Object.entries(props)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${escStr(v)}'` : v}`)
    .join(', ');
  return `{${pairs}}`;
}
