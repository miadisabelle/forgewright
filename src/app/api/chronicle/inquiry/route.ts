import { NextResponse, type NextRequest } from 'next/server';
import { describeChronicleSource, getEpisodeInquiry } from '@forgewright/lib/chronicle/client';

export const dynamic = 'force-dynamic';

// Without episode_path this projects EVERY registered weave — the metric tile
// consumes that total; per-episode sections always pass the filter.
export async function GET(request: NextRequest) {
  const episodePath = request.nextUrl.searchParams.get('episode_path');

  try {
    const data = await getEpisodeInquiry(episodePath);

    return NextResponse.json({
      data,
      meta: { readonly: true, count: data.count },
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Inquiry upstream unavailable',
        source: describeChronicleSource(),
      },
      { status: 503 },
    );
  }
}
