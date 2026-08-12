import { NextResponse, type NextRequest } from 'next/server';
import { resolveChronicleRoot } from '@forgewright/lib/chronicle/diagrams';
import {
  EpisodeRecordingsUnavailableError,
  InvalidRecordingPathError,
  RecordingNotFoundError,
  fetchRecordingRecords,
  isEpisodeParam,
  listEpisodeRecordings,
  mergeRecordings,
} from '@forgewright/lib/chronicle/recordings';

export const dynamic = 'force-dynamic';

const ACCEPTED_PARAMS = ['episode'] as const;

// Read-only merge of the two recording surfaces: the disk listing of ONE
// episode vessel (authoritative rows) and the wheel's recording registry
// (enrichment fields, matched by filename). A registry the wheel does not
// serve yet lands as empty enrichment — never an error blocking the listing.
// Chronicle surfaces ship no write path (spec 11): GET is all there is.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  for (const key of params.keys()) {
    if (!(ACCEPTED_PARAMS as readonly string[]).includes(key)) {
      return NextResponse.json(
        { data: null, error: `unknown parameter ${key} — accepted: episode` },
        { status: 400 },
      );
    }
  }

  const episode = params.get('episode');
  if (!isEpisodeParam(episode)) {
    return NextResponse.json(
      { data: null, error: 'episode must be a relative chronicle path' },
      { status: 400 },
    );
  }

  const source = { root: resolveChronicleRoot() };

  try {
    const [listing, registry] = await Promise.all([
      listEpisodeRecordings(episode),
      fetchRecordingRecords(),
    ]);
    const data = mergeRecordings(episode, listing, registry);

    return NextResponse.json({
      data,
      meta: {
        readonly: true,
        episode,
        count: data.count,
        ignoredRecordCount: data.ignoredRecordCount,
        source,
        ...(registry.unavailable ? { registryUnavailable: registry.unavailable } : {}),
      },
    });
  } catch (error) {
    const status =
      error instanceof InvalidRecordingPathError ? 400
      : error instanceof RecordingNotFoundError ? 404
      : error instanceof EpisodeRecordingsUnavailableError ? 503
      : 500;

    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Episode recordings unavailable',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        source,
      },
      { status },
    );
  }
}
