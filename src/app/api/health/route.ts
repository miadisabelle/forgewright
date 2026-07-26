import { NextResponse } from 'next/server';
import { getChronicleSnapshot, getNarrativeBeats } from '@forgewright/lib/chronicle/client';
import { orphanBeats } from '@forgewright/lib/chronicle/beats';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getChronicleSnapshot();

    // narrativeBeats is read-only or nothing (spec 11.6): read-write here would
    // mean the boundary in 11.1 was crossed. A count is reported ONLY when the
    // wheel answered — reporting 0 for "we could not ask" is the same class of
    // dishonesty as an empty array standing in for a failed fetch.
    const beats = await getNarrativeBeats().catch(() => null);

    return NextResponse.json({
      status: 'healthy',
      service: 'forgewright',
      version: '0.1.0',
      capabilities: {
        chronicle: 'read-only',
        structuredPlans: 'read-only',
        stateMachines: 'read-only',
        narrativeBeats: beats ? 'read-only' : 'unavailable',
        mcpHttp: 'deferred',
      },
      dependencies: {
        medicineWheel: snapshot.source,
      },
      counts: {
        episodes: snapshot.episodes.length,
        structuredPlans: snapshot.structuredPlans.length,
        stateMachines: snapshot.stateMachines.length,
        ...(beats
          ? {
              narrativeBeats: beats.count,
              narrativeCycles: beats.cycles.length,
              unboundBeats: orphanBeats(beats.beats, beats.cycles).length,
            }
          : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'forgewright',
        version: '0.1.0',
        error: error instanceof Error ? error.message : 'Medicine Wheel unavailable',
      },
      { status: 503 },
    );
  }
}
