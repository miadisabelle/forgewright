/**
 * Ceremony API — open ceremonies and query status.
 *
 * POST /api/ceremony          — open a new ceremony { intent, participants? }
 * GET  /api/ceremony          — get active ceremony status
 */

import { NextRequest, NextResponse } from 'next/server';
import { CeremonyRuntime } from '@forgewright/lib/ceremony/runtime.js';

// In-memory ceremony registry (keyed by ID).
// Production would persist to Redis / graph, but for the REST surface
// this singleton map is sufficient for session-scoped ceremonies.
const ceremonies = new Map<string, CeremonyRuntime>();

/** Exported for use by the [id] route. */
export function getCeremonyRegistry() {
  return ceremonies;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, participants } = body as {
      intent?: string;
      participants?: string[];
    };

    if (!intent || typeof intent !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Missing required field: intent (string)' },
        { status: 400 },
      );
    }

    const runtime = new CeremonyRuntime(intent, participants ?? ['human']);
    const record = runtime.openCeremony();
    ceremonies.set(runtime.getId(), runtime);

    return NextResponse.json(
      {
        data: record,
        meta: {
          phase: runtime.getCurrentPhase(),
          active: runtime.isActive(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const activeCeremonies = Array.from(ceremonies.entries())
      .filter(([, rt]) => rt.isActive())
      .map(([id, rt]) => ({
        id,
        phase: rt.getCurrentPhase(),
        active: rt.isActive(),
        guidance: rt.getCurrentGuidance(),
        record: rt.getRecord(),
      }));

    return NextResponse.json({
      data: activeCeremonies,
      meta: {
        activeCount: activeCeremonies.length,
        totalRegistered: ceremonies.size,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
