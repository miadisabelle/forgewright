import { NextResponse } from 'next/server';
import { getChronicleSnapshot } from '@forgewright/lib/chronicle/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getChronicleSnapshot();

    return NextResponse.json({
      status: 'healthy',
      service: 'forgewright',
      version: '0.1.0',
      capabilities: {
        chronicle: 'read-only',
        structuredPlans: 'read-only',
        stateMachines: 'deferred',
        mcpHttp: 'deferred',
      },
      dependencies: {
        medicineWheel: snapshot.source,
      },
      counts: {
        episodes: snapshot.episodes.length,
        structuredPlans: snapshot.structuredPlans.length,
        stateMachines: snapshot.stateMachines.length,
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
