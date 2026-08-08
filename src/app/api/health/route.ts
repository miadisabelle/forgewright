import { NextResponse } from 'next/server';
import { getChronicleSnapshot, getNarrativeBeats } from '@forgewright/lib/chronicle/client';
import { orphanBeats } from '@forgewright/lib/chronicle/beats';
import { listEpisodeDiagrams } from '@forgewright/lib/chronicle/diagrams';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getChronicleSnapshot();

    // narrativeBeats is read-only or nothing (spec 11.6): read-write here would
    // mean the boundary in 11.1 was crossed. A count is reported ONLY when the
    // wheel answered — reporting 0 for "we could not ask" is the same class of
    // dishonesty as an empty array standing in for a failed fetch.
    const beats = await getNarrativeBeats().catch(() => null);

    // stateMachines counts what /api/machines can actually serve: the episode
    // diagrams discovered under MIADI_CHRONICLE_ROOT on disk. Same honesty rule
    // as beats — no count when the root did not answer.
    const diagrams = await listEpisodeDiagrams().catch(() => null);

    return NextResponse.json({
      status: 'healthy',
      service: 'forgewright',
      version: '0.1.0',
      capabilities: {
        chronicle: 'read-only',
        structuredPlans: 'read-only',
        stateMachines: diagrams ? 'read-only' : 'unavailable',
        narrativeBeats: beats ? 'read-only' : 'unavailable',
        recordings: 'read-only',
        mcpHttp: 'deferred',
      },
      dependencies: {
        medicineWheel: snapshot.source,
      },
      counts: {
        episodes: snapshot.episodes.length,
        structuredPlans: snapshot.structuredPlans.length,
        ...(diagrams ? { stateMachines: diagrams.length } : {}),
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
