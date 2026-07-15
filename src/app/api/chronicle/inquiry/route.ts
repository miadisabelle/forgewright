import { NextResponse, type NextRequest } from 'next/server';
import { getEpisodeInquiry } from '@forgewright/lib/chronicle/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const episodePath = request.nextUrl.searchParams.get('episode_path');

  if (!episodePath) {
    return NextResponse.json(
      { data: null, error: 'episode_path query parameter is required' },
      { status: 400 },
    );
  }

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
      },
      { status: 503 },
    );
  }
}
