import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveChronicleRoot } from '@forgewright/lib/chronicle/diagrams';
import {
  EpisodeRecordingsUnavailableError,
  InvalidRecordingPathError,
  RecordingNotFoundError,
  parseRangeHeader,
  statEpisodeRecording,
} from '@forgewright/lib/chronicle/recordings';

export const dynamic = 'force-dynamic';

const ACCEPTED_PARAMS = ['episode', 'file'] as const;

// GET-only streaming of ONE recording already on local disk under the
// chronicle root — the same disk diagrams.ts reads, behind the same guards:
// validated relative episode path, bare allowlisted filename, resolve-then-
// prefix-check. Range requests answer 206 so an <audio> element can seek.
// This route touches no remote recorder and ships no write method.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  for (const key of params.keys()) {
    if (!(ACCEPTED_PARAMS as readonly string[]).includes(key)) {
      return NextResponse.json(
        { data: null, error: `unknown parameter ${key} — accepted: episode, file` },
        { status: 400 },
      );
    }
  }

  const episode = params.get('episode');
  const file = params.get('file');
  if (episode === null || file === null) {
    return NextResponse.json(
      { data: null, error: 'episode and file are both required' },
      { status: 400 },
    );
  }

  const source = { root: resolveChronicleRoot() };

  try {
    // statEpisodeRecording enforces the full guard set (safe relative episode
    // path, bare allowlisted filename, escape checks) with named errors.
    const stat = await statEpisodeRecording(episode, file);
    const range = parseRangeHeader(request.headers.get('range'), stat.sizeBytes);

    if (range.kind === 'unsatisfiable') {
      return new NextResponse(null, {
        status: 416,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes */${stat.sizeBytes}`,
        },
      });
    }

    const headers = new Headers({
      'Content-Type': stat.contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });

    if (stat.sizeBytes === 0) {
      headers.set('Content-Length', '0');
      return new NextResponse(null, { status: 200, headers });
    }

    const start = range.kind === 'partial' ? range.start : 0;
    const end = range.kind === 'partial' ? range.end : stat.sizeBytes - 1;
    headers.set('Content-Length', String(end - start + 1));
    if (range.kind === 'partial') {
      headers.set('Content-Range', `bytes ${start}-${end}/${stat.sizeBytes}`);
    }

    const stream = createReadStream(stat.absolutePath, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: range.kind === 'partial' ? 206 : 200,
      headers,
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
        error: error instanceof Error ? error.message : 'Episode recording unavailable',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        source,
      },
      { status },
    );
  }
}
