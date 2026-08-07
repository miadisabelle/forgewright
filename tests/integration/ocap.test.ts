/**
 * OCAP Enforcement — integration tests.
 *
 * Validates: sacred node exclusion, public access, community access,
 *            ceremony-gated access, and audit log completeness.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ForgewrightGraph, type OcapContext } from '@forgewright/lib/graph/database';
import { neighborhood } from '@forgewright/lib/graph/queries';
import {
  checkAccess,
  filterNodes,
  getAuditLog,
  clearAuditLog,
} from '@forgewright/lib/graph/ocap-filter';
import {
  GraphEdgeSchema,
  GraphNodeSchema,
  type GraphNode,
  type GraphEdge,
} from '@forgewright/lib/types/graph';
import type { OcapMetadata } from '@forgewright/lib/types/ocap';
import type { z } from 'zod';

// Fixtures built THROUGH the canonical schemas: defaults (status, urgency,
// strength) apply, and future schema drift fails loudly instead of silently.
const node = (input: z.input<typeof GraphNodeSchema>) => GraphNodeSchema.parse(input);
const edge = (input: z.input<typeof GraphEdgeSchema>) => GraphEdgeSchema.parse(input);

// Mock filesystem
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// ─── Shared OCAP metadata factories ──────────────────────────────────────────

function ocap(access: 'public' | 'community' | 'ceremony' | 'sacred'): OcapMetadata {
  return { ownership: 'system', control: 'creator', access, possession: 'local' };
}

const now = new Date().toISOString();

// ─── Context factories ───────────────────────────────────────────────────────

const PUBLIC_CTX: OcapContext = {
  requester: 'anonymous',
  maxAccessLevel: 'public',
  isCeremonyActive: false,
};

const COMMUNITY_CTX: OcapContext = {
  requester: 'community-member',
  maxAccessLevel: 'community',
  isCeremonyActive: false,
};

const CEREMONY_CTX: OcapContext = {
  requester: 'ceremony-keeper',
  maxAccessLevel: 'sacred',
  isCeremonyActive: true,
  ceremonyId: 'cer-001',
};

const INTERNAL_CTX: OcapContext = {
  requester: 'internal-agent',
  maxAccessLevel: 'community',
  isCeremonyActive: false,
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('OCAP Enforcement', () => {
  let graph: ForgewrightGraph;

  beforeEach(async () => {
    graph = await ForgewrightGraph.createInMemory();
    clearAuditLog();
  });

  afterEach(async () => {
    await graph.close();
  });

  // ── Test 1: sacred node NOT returned without ceremony context ─────────────

  it('blocks sacred node access without active ceremony', async () => {
    await graph.createNode({
      id: 'sacred-001',
      nodeType: 'Ceremony',
      name: 'Sacred Teaching',
      phase: 'active',
      ocap: ocap('sacred'),
      createdAt: now,
    });

    // Query without ceremony
    const decision = checkAccess('sacred-001', ocap('sacred'), COMMUNITY_CTX);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Sacred-level node');
    expect(decision.reason).toContain('outside active ceremony');

    // Even with high access level but no ceremony active
    const highCtx: OcapContext = {
      requester: 'admin',
      maxAccessLevel: 'sacred',
      isCeremonyActive: false,
    };
    const decision2 = checkAccess('sacred-001', ocap('sacred'), highCtx);
    expect(decision2.allowed).toBe(false);
  });

  // ── Test 2: public node ALWAYS returned ──────────────────────────────────

  it('always allows access to public nodes regardless of context', async () => {
    await graph.createNode(node({
      id: 'public-001',
      nodeType: 'Spec',
      name: 'Public Spec',
      version: '1.0.0',
      ocap: ocap('public'),
      createdAt: now,
    }));

    // Public context
    const d1 = checkAccess('public-001', ocap('public'), PUBLIC_CTX);
    expect(d1.allowed).toBe(true);

    // Community context
    const d2 = checkAccess('public-001', ocap('public'), COMMUNITY_CTX);
    expect(d2.allowed).toBe(true);

    // Ceremony context
    const d3 = checkAccess('public-001', ocap('public'), CEREMONY_CTX);
    expect(d3.allowed).toBe(true);
  });

  // ── Test 3: community node returned with proper access level ─────────────

  it('allows community-level access for community+ requesters', async () => {
    await graph.createNode(node({
      id: 'community-001',
      nodeType: 'Intent',
      description: 'Community intent',
      ocap: ocap('community'),
      createdAt: now,
    }));

    // Community requester → allowed
    const d1 = checkAccess('community-001', ocap('community'), COMMUNITY_CTX);
    expect(d1.allowed).toBe(true);

    // Public requester → denied (public < community)
    const d2 = checkAccess('community-001', ocap('community'), PUBLIC_CTX);
    expect(d2.allowed).toBe(false);
    expect(d2.reason).toContain('denied');

    // Ceremony requester → allowed (sacred > community)
    const d3 = checkAccess('community-001', ocap('community'), CEREMONY_CTX);
    expect(d3.allowed).toBe(true);
  });

  // ── Test 4: audit log records ALL access checks ──────────────────────────

  it('records every access check in the audit log', async () => {
    clearAuditLog();

    // Perform 3 access checks
    checkAccess('node-a', ocap('public'), PUBLIC_CTX);
    checkAccess('node-b', ocap('sacred'), COMMUNITY_CTX);
    checkAccess('node-c', ocap('community'), CEREMONY_CTX);

    const log = getAuditLog();
    expect(log).toHaveLength(3);

    // First: public → allowed
    expect(log[0].nodeId).toBe('node-a');
    expect(log[0].allowed).toBe(true);
    expect(log[0].requester).toBe('anonymous');

    // Second: sacred without ceremony → denied
    expect(log[1].nodeId).toBe('node-b');
    expect(log[1].allowed).toBe(false);
    expect(log[1].requester).toBe('community-member');

    // Third: community with ceremony → allowed
    expect(log[2].nodeId).toBe('node-c');
    expect(log[2].allowed).toBe(true);
    expect(log[2].requester).toBe('ceremony-keeper');
    expect(log[2].ceremonyId).toBe('cer-001');
  });

  // ── Test 5: filterNodes removes inaccessible nodes from array ────────────

  it('filterNodes removes inaccessible nodes while preserving accessible ones', () => {
    clearAuditLog();

    const nodes: GraphNode[] = [
      node({ id: 'pub', nodeType: 'Spec', name: 'Public', version: '1.0', ocap: ocap('public'), createdAt: now }),
      node({ id: 'comm', nodeType: 'Intent', description: 'Community', ocap: ocap('community'), createdAt: now }),
      { id: 'sacr', nodeType: 'Ceremony', name: 'Sacred', phase: 'active', ocap: ocap('sacred'), createdAt: now },
      { id: 'cere', nodeType: 'Ceremony', name: 'Ceremony-level', phase: 'active', ocap: ocap('ceremony'), createdAt: now },
    ];

    // Community context: should see public + community, not sacred or ceremony
    const filtered = filterNodes(nodes, COMMUNITY_CTX);
    const filteredIds = filtered.map(n => n.id);
    expect(filteredIds).toContain('pub');
    expect(filteredIds).toContain('comm');
    expect(filteredIds).not.toContain('sacr');
    expect(filteredIds).not.toContain('cere');

    // Ceremony context: should see all
    const ceremonyFiltered = filterNodes(nodes, CEREMONY_CTX);
    expect(ceremonyFiltered).toHaveLength(4);

    // Audit log should have entries for all checks
    const log = getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(8); // 4 nodes × 2 contexts
  });

  // ── Test 6: ceremony node requires active ceremony ───────────────────────

  it('blocks ceremony-level node without active ceremony', () => {
    clearAuditLog();

    const d = checkAccess('cer-node', ocap('ceremony'), COMMUNITY_CTX);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('Ceremony-level node requires active ceremony');

    // With ceremony active → allowed
    const d2 = checkAccess('cer-node', ocap('ceremony'), CEREMONY_CTX);
    expect(d2.allowed).toBe(true);
  });

  // ── Test 7: graph neighborhood query respects OCAP filtering ─────────────

  it('neighborhood query filters sacred nodes from results', async () => {
    // Create a public hub node with sacred and community neighbors
    await graph.createNode(node({
      id: 'hub',
      nodeType: 'Spec',
      name: 'Hub Spec',
      version: '1.0',
      ocap: ocap('public'),
      createdAt: now,
    }));
    await graph.createNode(node({
      id: 'neighbor-pub',
      nodeType: 'Spec',
      name: 'Public Neighbor',
      version: '1.0',
      ocap: ocap('public'),
      createdAt: now,
    }));
    await graph.createNode({
      id: 'neighbor-sacred',
      nodeType: 'Ceremony',
      name: 'Sacred Neighbor',
      phase: 'active',
      ocap: ocap('sacred'),
      createdAt: now,
    });

    await graph.createEdge(edge({
      id: 'edge-1',
      fromId: 'hub',
      toId: 'neighbor-pub',
      edgeType: 'KIN_OF',
      ocap: ocap('public'),
      createdAt: now,
    }));
    await graph.createEdge(edge({
      id: 'edge-2',
      fromId: 'hub',
      toId: 'neighbor-sacred',
      edgeType: 'GOVERNED_BY',
      ocap: ocap('sacred'),
      createdAt: now,
    }));

    // Community query — sacred neighbor should be filtered out
    const result = await neighborhood(graph, 'hub', COMMUNITY_CTX, 1);
    const nodeIds = result.nodes.map(n => n.id);
    expect(nodeIds).toContain('neighbor-pub');
    expect(nodeIds).not.toContain('neighbor-sacred');

    // Ceremony query — sacred neighbor should be visible
    const cerResult = await neighborhood(graph, 'hub', CEREMONY_CTX, 1);
    const cerNodeIds = cerResult.nodes.map(n => n.id);
    expect(cerNodeIds).toContain('neighbor-pub');
    expect(cerNodeIds).toContain('neighbor-sacred');
  });
});
