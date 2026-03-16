/**
 * OCAP Enforcement Layer — filters graph queries by ceremony context.
 *
 * Every graph read MUST pass through this layer. Sacred-level nodes are NEVER
 * returned outside an active ceremony context. All access decisions are logged
 * as audit entries, even when access is allowed.
 */

import type { AccessLevel, AccessDecision, OcapMetadata } from '../types/index';
import type { GraphNode, GraphEdge } from '../types/index';
import type { OcapContext, SubgraphResult } from './database';

// ─── Access Level Hierarchy ──────────────────────────────────────────────────

const ACCESS_HIERARCHY: Record<AccessLevel, number> = {
  public: 0,
  community: 1,
  ceremony: 2,
  sacred: 3,
};

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;
  requester: string;
  nodeId: string;
  nodeAccess: AccessLevel;
  requesterAccess: AccessLevel;
  allowed: boolean;
  reason: string;
  ceremonyId?: string;
}

const auditLog: AuditEntry[] = [];

/** Retrieve audit log entries (for accountability review). */
export function getAuditLog(): readonly AuditEntry[] {
  return auditLog;
}

/** Clear the audit log (testing/reset). */
export function clearAuditLog(): void {
  auditLog.length = 0;
}

// ─── Core Access Check ───────────────────────────────────────────────────────

/**
 * Determine whether a specific node is accessible under the given OCAP context.
 *
 * @param nodeId - ID of the node being accessed
 * @param ocap - OCAP metadata on the node
 * @param ctx - Ceremony context of the requester
 * @returns AccessDecision with audit trail
 */
export function checkAccess(
  nodeId: string,
  ocap: OcapMetadata,
  ctx: OcapContext,
): AccessDecision {
  const nodeLevel = ocap.access as AccessLevel;
  const requesterLevel = ctx.maxAccessLevel;
  const now = new Date().toISOString();

  // Sacred-level NEVER accessible outside active ceremony
  if (nodeLevel === 'sacred' && !ctx.isCeremonyActive) {
    const entry: AuditEntry = {
      timestamp: now,
      requester: ctx.requester,
      nodeId,
      nodeAccess: nodeLevel,
      requesterAccess: requesterLevel,
      allowed: false,
      reason: 'Sacred-level node cannot be accessed outside active ceremony',
      ceremonyId: ctx.ceremonyId,
    };
    auditLog.push(entry);
    return {
      allowed: false,
      reason: entry.reason,
      ocapLevel: nodeLevel,
      auditEntry: JSON.stringify(entry),
    };
  }

  // Ceremony-level requires active ceremony
  if (nodeLevel === 'ceremony' && !ctx.isCeremonyActive) {
    const entry: AuditEntry = {
      timestamp: now,
      requester: ctx.requester,
      nodeId,
      nodeAccess: nodeLevel,
      requesterAccess: requesterLevel,
      allowed: false,
      reason: 'Ceremony-level node requires active ceremony context',
      ceremonyId: ctx.ceremonyId,
    };
    auditLog.push(entry);
    return {
      allowed: false,
      reason: entry.reason,
      ocapLevel: nodeLevel,
      auditEntry: JSON.stringify(entry),
    };
  }

  // Check hierarchy: requester level must be >= node level
  const allowed = ACCESS_HIERARCHY[requesterLevel] >= ACCESS_HIERARCHY[nodeLevel];

  const entry: AuditEntry = {
    timestamp: now,
    requester: ctx.requester,
    nodeId,
    nodeAccess: nodeLevel,
    requesterAccess: requesterLevel,
    allowed,
    reason: allowed
      ? `Access granted: ${requesterLevel} >= ${nodeLevel}`
      : `Access denied: ${requesterLevel} < ${nodeLevel}`,
    ceremonyId: ctx.ceremonyId,
  };
  auditLog.push(entry);

  return {
    allowed,
    reason: entry.reason,
    ocapLevel: nodeLevel,
    auditEntry: JSON.stringify(entry),
  };
}

// ─── Node Filtering ──────────────────────────────────────────────────────────

/**
 * Filter a list of nodes by OCAP context, removing inaccessible entries.
 * Every node is checked and audited, even if allowed.
 */
export function filterNodes(nodes: GraphNode[], ctx: OcapContext): GraphNode[] {
  return nodes.filter(node => {
    const decision = checkAccess(node.id, node.ocap, ctx);
    return decision.allowed;
  });
}

/**
 * Filter a list of edges by OCAP context.
 */
export function filterEdges(edges: GraphEdge[], ctx: OcapContext): GraphEdge[] {
  return edges.filter(edge => {
    const decision = checkAccess(edge.id, edge.ocap, ctx);
    return decision.allowed;
  });
}

/**
 * Filter an entire subgraph result by OCAP context.
 */
export function filterSubgraph(result: SubgraphResult, ctx: OcapContext): SubgraphResult {
  const filteredNodes = filterNodes(result.nodes, ctx);
  const allowedNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = filterEdges(result.edges, ctx).filter(
    e => allowedNodeIds.has(e.fromId) && allowedNodeIds.has(e.toId),
  );
  return { nodes: filteredNodes, edges: filteredEdges };
}

// ─── Cypher OCAP Injection (KuzuDB-specific) ────────────────────────────────

/**
 * Inject OCAP WHERE clauses into a raw Cypher query for KuzuDB execution.
 * Appends access-level filtering and sacred-node exclusion.
 *
 * @param cypher - Base Cypher query
 * @param ctx - OCAP context for the requester
 * @returns Modified Cypher with OCAP constraints
 */
export function filterQuery(cypher: string, ctx: OcapContext): string {
  const allowedLevels = getAllowedLevels(ctx);
  const levelList = allowedLevels.map(l => `'${l}'`).join(', ');

  // Detect the node variable (first word after MATCH, usually in parens)
  const matchVar = cypher.match(/MATCH\s*\((\w+)/i)?.[1];
  if (!matchVar) return cypher;

  const ocapClause = `${matchVar}.ocap_access IN [${levelList}]`;

  if (cypher.toUpperCase().includes('WHERE')) {
    // Inject into existing WHERE
    return cypher.replace(/WHERE/i, `WHERE ${ocapClause} AND`);
  } else {
    // Add WHERE before RETURN
    const returnIdx = cypher.toUpperCase().indexOf('RETURN');
    if (returnIdx === -1) return cypher + ` WHERE ${ocapClause}`;
    return (
      cypher.slice(0, returnIdx) +
      `WHERE ${ocapClause} ` +
      cypher.slice(returnIdx)
    );
  }
}

/**
 * Get the list of access levels the requester is allowed to see.
 */
function getAllowedLevels(ctx: OcapContext): AccessLevel[] {
  const levels: AccessLevel[] = ['public'];
  const max = ACCESS_HIERARCHY[ctx.maxAccessLevel];
  if (max >= ACCESS_HIERARCHY.community) levels.push('community');
  if (max >= ACCESS_HIERARCHY.ceremony && ctx.isCeremonyActive) levels.push('ceremony');
  if (max >= ACCESS_HIERARCHY.sacred && ctx.isCeremonyActive) levels.push('sacred');
  return levels;
}
