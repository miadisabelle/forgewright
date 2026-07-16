import { NextResponse, type NextRequest } from 'next/server';
import { describeChronicleSource, getPlanPerspectives } from '@forgewright/lib/chronicle/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const episodePath = params.get('episode_path') ?? undefined;
  const sessionId = params.get('session_id') ?? undefined;
  const id = params.get('id') ?? undefined;

  if (!episodePath && !sessionId && !id) {
    return NextResponse.json(
      { data: null, error: 'episode_path, session_id, or id query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const data = await getPlanPerspectives({ episodePath, sessionId, id });

    return NextResponse.json({
      data,
      meta: { readonly: true, count: data.count },
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Perspective upstream unavailable',
        source: describeChronicleSource(),
      },
      { status: 503 },
    );
  }
}
