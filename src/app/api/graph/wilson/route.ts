/**
 * Wilson Alignment API — compute current Wilson score.
 *
 * GET /api/graph/wilson       — get unified Wilson alignment score
 *
 * Accepts optional query params for session metrics:
 *   ?directionsVisited=east,south&ceremoniesCount=2&spiralDepth=1&totalBeats=5
 *
 * Without params, returns a zero-confidence baseline score.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  computeUnifiedWilson,
  type UnifiedWilsonOptions,
  type SessionMetrics,
} from '@forgewright/lib/wilson/index';
import type { DirectionName } from '@forgewright/lib/types/directions';

const VALID_DIRECTIONS = new Set<string>(['east', 'south', 'west', 'north']);

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const options: UnifiedWilsonOptions = {};

    // Parse session metrics from query params if provided
    const directionsRaw = sp.get('directionsVisited');
    const ceremoniesRaw = sp.get('ceremoniesCount');
    const spiralRaw = sp.get('spiralDepth');
    const beatsRaw = sp.get('totalBeats');

    if (directionsRaw || ceremoniesRaw || spiralRaw || beatsRaw) {
      const directionsVisited: DirectionName[] = directionsRaw
        ? directionsRaw.split(',').filter(d => VALID_DIRECTIONS.has(d)) as DirectionName[]
        : [];

      const sessionMetrics: SessionMetrics = {
        directionsVisited,
        ceremoniesCount: ceremoniesRaw ? parseInt(ceremoniesRaw, 10) : 0,
        spiralDepth: spiralRaw ? parseInt(spiralRaw, 10) : 0,
        totalBeats: beatsRaw ? parseInt(beatsRaw, 10) : 0,
      };

      options.sessionMetrics = sessionMetrics;
    }

    const result = computeUnifiedWilson(options);

    return NextResponse.json({
      data: result,
      meta: {
        sourcesUsed: result.sourcesUsed,
        confidence: result.confidence,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
