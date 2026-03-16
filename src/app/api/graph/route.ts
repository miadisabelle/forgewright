/**
 * Graph API — query the ForgewrightGraph (KuzuDB / in-memory fallback).
 *
 * POST /api/graph             — query graph { cypher?, neighborhood? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ForgewrightGraph } from '@forgewright/lib/graph/database';

let _graphPromise: Promise<ForgewrightGraph> | null = null;

function getGraph(): Promise<ForgewrightGraph> {
  if (!_graphPromise) {
    _graphPromise = ForgewrightGraph.create();
  }
  return _graphPromise;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cypher, params, neighborhood } = body as {
      cypher?: string;
      params?: Record<string, unknown>;
      neighborhood?: { nodeId: string; hops?: number };
    };

    if (!cypher && !neighborhood) {
      return NextResponse.json(
        { data: null, error: 'Provide either "cypher" (raw query) or "neighborhood" ({ nodeId, hops? })' },
        { status: 400 },
      );
    }

    const graph = await getGraph();

    if (neighborhood) {
      const { nodeId, hops } = neighborhood;
      if (!nodeId) {
        return NextResponse.json(
          { data: null, error: 'neighborhood.nodeId is required' },
          { status: 400 },
        );
      }

      const subgraph = await graph.getNeighbors(nodeId, hops ?? 2);
      return NextResponse.json({
        data: subgraph,
        meta: {
          nodeCount: subgraph.nodes.length,
          edgeCount: subgraph.edges.length,
          backend: graph.isNative ? 'kuzu' : 'memory',
        },
      });
    }

    // Raw Cypher query
    const results = await graph.rawQuery(cypher!, params);
    return NextResponse.json({
      data: results,
      meta: {
        resultCount: results.length,
        backend: graph.isNative ? 'kuzu' : 'memory',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
