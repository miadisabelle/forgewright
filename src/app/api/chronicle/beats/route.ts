import { NextResponse, type NextRequest } from 'next/server';
import {
  describeChronicleSource,
  getNarrativeBeats,
  isChronicleDirection,
  isEpisodePathParam,
} from '@forgewright/lib/chronicle/client';

export const dynamic = 'force-dynamic';

// Read-only proxy over the wheel's beat surface (spec 11, A1). The browser never
// learns MW_API_URL. Without filters this projects EVERY served beat — the
// metric tile, every episode section, and the unbound lane all read that one
// answer. A malformed filter is 400; an unreachable wheel is 503 naming the
// upstream, never an empty array standing in for failure.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const cycleId = params.get('cycle_id');
  const direction = params.get('direction');
  const episodePath = params.get('episode_path');

  if (cycleId !== null && cycleId.length === 0) {
    return NextResponse.json(
      { data: null, error: 'cycle_id must not be empty' },
      { status: 400 },
    );
  }
  if (direction !== null && !isChronicleDirection(direction)) {
    return NextResponse.json(
      { data: null, error: 'direction must be east, south, west, or north' },
      { status: 400 },
    );
  }
  if (episodePath !== null && !isEpisodePathParam(episodePath)) {
    return NextResponse.json(
      { data: null, error: 'episode_path must be a relative chronicle path' },
      { status: 400 },
    );
  }

  try {
    const data = await getNarrativeBeats({
      cycleId: cycleId ?? undefined,
      direction: direction ?? undefined,
      episodePath: episodePath ?? undefined,
    });

    return NextResponse.json({
      data,
      meta: {
        readonly: true,
        count: data.count,
        droppedCount: data.droppedCount,
        cycleCount: data.cycles.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Narrative beat upstream unavailable',
        source: describeChronicleSource(),
      },
      { status: 503 },
    );
  }
}
