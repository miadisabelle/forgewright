import { NextResponse } from 'next/server';
import { describeChronicleSource, getChronicleSnapshot } from '@forgewright/lib/chronicle/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getChronicleSnapshot();

    return NextResponse.json({
      data: snapshot,
      meta: {
        readonly: true,
        episodeCount: snapshot.episodes.length,
        structuredPlanCount: snapshot.structuredPlans.length,
        stateMachineCount: snapshot.stateMachines.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Chronicle upstream unavailable',
        source: describeChronicleSource(),
      },
      { status: 503 },
    );
  }
}
