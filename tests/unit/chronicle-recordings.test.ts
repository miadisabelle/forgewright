// ─── Episode recordings: disk listing, registry enrichment, range, projection ─
// Inline fixtures mirror the episode-103 shape on disk — a flat `.m4a` take
// beside `transcription_*` sidecars. Registry normalization is fail-closed with
// dropped records COUNTED, and a wheel that does not serve /api/recordings at
// all lands as an EMPTY enrichment, never an error blocking the disk listing.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  EpisodeRecordingsUnavailableError,
  InvalidRecordingPathError,
  RecordingNotFoundError,
  contentTypeForRecording,
  fetchRecordingRecords,
  isEpisodeParam,
  isRecordingFileParam,
  listEpisodeRecordings,
  mergeRecordings,
  parseRangeHeader,
  recordingKindOf,
  statEpisodeRecording,
  type EpisodeRecording,
  type EpisodeRecordingsPayload,
  type RecordingRegistry,
} from '../../src/lib/chronicle/recordings';
import {
  errorResource,
  loadingResource,
  projectRecordingSection,
  readyResource,
  tallyRecordingResources,
  withResource,
  type SharedResource,
} from '../../src/lib/chronicle/viewCache';

const EP103 = '2026-06-28-episode-103-film-preprod-report-phase-2';
const BASE_URL = 'http://wheel.test:8040';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createRegistryFetch(payload: unknown, status = 200) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url === `${BASE_URL}/api/recordings`) return jsonResponse(payload, status);
    return jsonResponse({ error: 'not found' }, 404);
  }) as unknown as typeof fetch;
}

// ─── Parameter guards ────────────────────────────────────────────────────────

describe('recording parameter guards', () => {
  it('accepts a safe relative episode path and rejects escapes', () => {
    expect(isEpisodeParam(EP103)).toBe(true);
    expect(isEpisodeParam('../escape')).toBe(false);
    expect(isEpisodeParam('/absolute')).toBe(false);
    expect(isEpisodeParam('a/../b')).toBe(false);
    expect(isEpisodeParam('a//b')).toBe(false);
    expect(isEpisodeParam('.')).toBe(false);
    expect(isEpisodeParam('a\\b')).toBe(false);
    expect(isEpisodeParam('')).toBe(false);
    expect(isEpisodeParam(null)).toBe(false);
  });

  it('accepts only bare allowlisted filenames for the file param', () => {
    expect(isRecordingFileParam('260628174942.m4a')).toBe(true);
    expect(isRecordingFileParam('take.MP3')).toBe(true);
    expect(isRecordingFileParam('song.midi')).toBe(true);
    expect(isRecordingFileParam('notes.txt')).toBe(false);
    expect(isRecordingFileParam('nested/take.m4a')).toBe(false);
    expect(isRecordingFileParam('..')).toBe(false);
    expect(isRecordingFileParam('.m4a')).toBe(false);
    expect(isRecordingFileParam('')).toBe(false);
  });

  it('maps extensions to kinds and content types, null outside the allowlist', () => {
    expect(recordingKindOf('a.m4a')).toBe('audio');
    expect(recordingKindOf('a.mid')).toBe('midi');
    expect(recordingKindOf('a.pdf')).toBeNull();
    expect(contentTypeForRecording('a.m4a')).toBe('audio/mp4');
    expect(contentTypeForRecording('a.mp3')).toBe('audio/mpeg');
    expect(contentTypeForRecording('a.midi')).toBe('audio/midi');
    expect(contentTypeForRecording('a.pdf')).toBeNull();
  });
});

// ─── Disk listing over a synthetic chronicle root ────────────────────────────

describe('listEpisodeRecordings', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'forgewright-recordings-'));
  const episodeDir = path.join(root, EP103);

  mkdirSync(episodeDir, { recursive: true });
  writeFileSync(path.join(episodeDir, '260628174942.m4a'), 'aaaa');
  writeFileSync(path.join(episodeDir, 'overdub.mp3'), 'bbbbbb');
  writeFileSync(path.join(episodeDir, 'overdub.json'), '{}'); // <stem>.json sidecar
  writeFileSync(path.join(episodeDir, 'motif.mid'), 'cc');
  writeFileSync(path.join(episodeDir, 'transcription_260628174942_session_EN.txt'), 'words');
  writeFileSync(path.join(episodeDir, 'notes.txt'), 'not audio');
  mkdirSync(path.join(episodeDir, 'subbranches'));
  writeFileSync(path.join(episodeDir, 'subbranches', 'inner.m4a'), 'dd'); // NOT listed — flat scan

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('lists audio-kind files flat, sorted ascending, with size and mtime', async () => {
    const recordings = await listEpisodeRecordings(EP103, root);
    expect(recordings.map((recording) => recording.filename)).toEqual([
      '260628174942.m4a',
      'motif.mid',
      'overdub.mp3',
    ]);
    expect(recordings.map((recording) => recording.kind)).toEqual(['audio', 'midi', 'audio']);
    expect(recordings[0].sizeBytes).toBe(4);
    expect(Date.parse(recordings[0].modifiedAt)).not.toBeNaN();
  });

  it('detects transcription sidecars: <stem>.json OR transcription_* naming the stem', async () => {
    const recordings = await listEpisodeRecordings(EP103, root);
    const byName = new Map(recordings.map((recording) => [recording.filename, recording]));
    expect(byName.get('260628174942.m4a')?.hasTranscription).toBe(true); // transcription_* contains stem
    expect(byName.get('overdub.mp3')?.hasTranscription).toBe(true); // overdub.json sidecar
    expect(byName.get('motif.mid')?.hasTranscription).toBe(false);
  });

  it('rejects unsafe episode paths with InvalidRecordingPathError', async () => {
    await expect(listEpisodeRecordings('../escape', root))
      .rejects.toBeInstanceOf(InvalidRecordingPathError);
    await expect(listEpisodeRecordings('/absolute', root))
      .rejects.toBeInstanceOf(InvalidRecordingPathError);
    await expect(listEpisodeRecordings('a/../b', root))
      .rejects.toBeInstanceOf(InvalidRecordingPathError);
    await expect(listEpisodeRecordings('.', root))
      .rejects.toBeInstanceOf(InvalidRecordingPathError);
  });

  it('answers RecordingNotFoundError for a missing episode folder', async () => {
    await expect(listEpisodeRecordings('2026-01-01-episode-000-nowhere', root))
      .rejects.toBeInstanceOf(RecordingNotFoundError);
  });

  it('stats one recording for streaming, with named errors on every refusal', async () => {
    const stat = await statEpisodeRecording(EP103, '260628174942.m4a', root);
    expect(stat.sizeBytes).toBe(4);
    expect(stat.contentType).toBe('audio/mp4');
    expect(stat.absolutePath).toBe(path.join(root, EP103, '260628174942.m4a'));

    await expect(statEpisodeRecording(EP103, 'none.m4a', root))
      .rejects.toBeInstanceOf(RecordingNotFoundError);
    await expect(statEpisodeRecording(EP103, 'notes.txt', root))
      .rejects.toBeInstanceOf(InvalidRecordingPathError);
    await expect(statEpisodeRecording(EP103, 'subbranches/inner.m4a', root))
      .rejects.toBeInstanceOf(InvalidRecordingPathError);
    await expect(statEpisodeRecording('../escape', 'x.m4a', root))
      .rejects.toBeInstanceOf(InvalidRecordingPathError);
  });
});

// ─── Range parsing ───────────────────────────────────────────────────────────

describe('parseRangeHeader', () => {
  it('serves the full body when no Range header is present', () => {
    expect(parseRangeHeader(null, 10)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('', 10)).toEqual({ kind: 'full' });
  });

  it('honours bounded, open-ended, and suffix ranges', () => {
    expect(parseRangeHeader('bytes=0-3', 10)).toEqual({ kind: 'partial', start: 0, end: 3 });
    expect(parseRangeHeader('bytes=4-', 10)).toEqual({ kind: 'partial', start: 4, end: 9 });
    expect(parseRangeHeader('bytes=-4', 10)).toEqual({ kind: 'partial', start: 6, end: 9 });
    expect(parseRangeHeader('bytes=-999', 10)).toEqual({ kind: 'partial', start: 0, end: 9 });
  });

  it('clamps an end past the last byte', () => {
    expect(parseRangeHeader('bytes=0-999', 10)).toEqual({ kind: 'partial', start: 0, end: 9 });
  });

  it('answers unsatisfiable when no byte can be served', () => {
    expect(parseRangeHeader('bytes=10-', 10)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=42-50', 10)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=-0', 10)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' });
    expect(parseRangeHeader('bytes=-4', 0)).toEqual({ kind: 'unsatisfiable' });
  });

  it('IGNORES malformed, multi-range, and non-bytes headers (full body)', () => {
    expect(parseRangeHeader('items=0-1', 10)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('bytes=0-1,5-6', 10)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('bytes=5-2', 10)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('bytes=-', 10)).toEqual({ kind: 'full' });
    expect(parseRangeHeader('bytes=a-b', 10)).toEqual({ kind: 'full' });
  });
});

// ─── Registry normalization (fail-closed) ────────────────────────────────────

describe('fetchRecordingRecords', () => {
  it('normalizes records and counts every one that fails the contract', async () => {
    const fetchImpl = createRegistryFetch({
      recordings: [
        {
          filename: '260628174942.m4a',
          origin: 'captured',
          device: 'pixel-8',
          duration_seconds: 83.4,
          started_at: '2026-06-28T17:49:42Z',
          episode_path: EP103,
        },
        { filename: 'overdub.mp3', origin: 'derived' },
        { filename: 'score.mid', origin: 'authored', duration_seconds: 'not-a-number' },
        { filename: 'no-origin.m4a' }, // dropped: missing origin
        { filename: 'bad.m4a', origin: 'stolen' }, // dropped: unknown origin
        { origin: 'captured' }, // dropped: no filename
        { filename: '../escape.m4a', origin: 'captured' }, // dropped: separator
        'not a record', // dropped: not an object
      ],
    });

    const registry = await fetchRecordingRecords({ baseUrl: BASE_URL, fetchImpl });
    expect(registry.unavailable).toBeUndefined();
    expect(registry.droppedCount).toBe(5);
    expect(registry.records.map((record) => record.filename)).toEqual([
      '260628174942.m4a',
      'overdub.mp3',
      'score.mid',
    ]);

    const captured = registry.records[0];
    expect(captured.origin).toBe('captured');
    expect(captured.device).toBe('pixel-8');
    expect(captured.durationSeconds).toBe(83.4);
    expect(captured.startedAt).toBe('2026-06-28T17:49:42Z');
    expect(captured.episodePath).toBe(EP103);

    // Invalid optional fields are OMITTED without dropping the record.
    expect(registry.records[2].durationSeconds).toBeUndefined();
  });

  it('accepts a bare array and a { records } wrapper', async () => {
    const record = { filename: 'a.m4a', origin: 'captured' };
    const bare = await fetchRecordingRecords({
      baseUrl: BASE_URL,
      fetchImpl: createRegistryFetch([record]),
    });
    const wrapped = await fetchRecordingRecords({
      baseUrl: BASE_URL,
      fetchImpl: createRegistryFetch({ records: [record] }),
    });
    expect(bare.records).toHaveLength(1);
    expect(wrapped.records).toHaveLength(1);
  });

  it('lands a wheel without the route (404) as EMPTY enrichment, not an error', async () => {
    const registry = await fetchRecordingRecords({
      baseUrl: BASE_URL,
      fetchImpl: createRegistryFetch({ error: 'no such route' }, 404),
    });
    expect(registry.records).toEqual([]);
    expect(registry.droppedCount).toBe(0);
    expect(registry.unavailable).toContain('404');
  });

  it('lands a network failure and a misconfigured MW_API_URL as EMPTY enrichment', async () => {
    const failing = vi.fn(async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;

    const down = await fetchRecordingRecords({ baseUrl: BASE_URL, fetchImpl: failing });
    expect(down.records).toEqual([]);
    expect(down.unavailable).toBe('connection refused');

    const misconfigured = await fetchRecordingRecords({ baseUrl: 'ftp://not-http' });
    expect(misconfigured.records).toEqual([]);
    expect(misconfigured.unavailable).toBeTruthy();
  });
});

// ─── Merge: disk rows authoritative, registry decorates ──────────────────────

describe('mergeRecordings', () => {
  const diskRow = (filename: string, kind: 'audio' | 'midi' = 'audio'): EpisodeRecording => ({
    filename,
    kind,
    sizeBytes: 4,
    modifiedAt: '2026-06-28T18:04:00.000Z',
    hasTranscription: false,
  });

  it('enriches disk rows by filename and carries the dropped count through', () => {
    const registry: RecordingRegistry = {
      records: [
        { filename: 'take.m4a', origin: 'captured', device: 'pixel-8', durationSeconds: 12 },
      ],
      droppedCount: 2,
    };
    const merged = mergeRecordings(EP103, [diskRow('take.m4a'), diskRow('other.mp3')], registry);

    expect(merged.episodePath).toBe(EP103);
    expect(merged.count).toBe(2);
    expect(merged.ignoredRecordCount).toBe(2);
    expect(merged.recordings[0].origin).toBe('captured');
    expect(merged.recordings[0].device).toBe('pixel-8');
    expect(merged.recordings[0].durationSeconds).toBe(12);
    expect(merged.recordings[1].origin).toBeUndefined();
  });

  it('never lets a record claimed by ANOTHER episode decorate this one', () => {
    const registry: RecordingRegistry = {
      records: [
        { filename: 'take.m4a', origin: 'captured', episodePath: 'some-other-episode' },
      ],
      droppedCount: 0,
    };
    const merged = mergeRecordings(EP103, [diskRow('take.m4a')], registry);
    expect(merged.recordings[0].origin).toBeUndefined();
  });

  it('applies a record whose episodePath matches, and an unscoped one', () => {
    const scoped: RecordingRegistry = {
      records: [{ filename: 'take.m4a', origin: 'captured', episodePath: EP103 }],
      droppedCount: 0,
    };
    const unscoped: RecordingRegistry = {
      records: [{ filename: 'take.m4a', origin: 'derived' }],
      droppedCount: 0,
    };
    expect(mergeRecordings(EP103, [diskRow('take.m4a')], scoped).recordings[0].origin)
      .toBe('captured');
    expect(mergeRecordings(EP103, [diskRow('take.m4a')], unscoped).recordings[0].origin)
      .toBe('derived');
  });
});

// ─── Section projection + metric tally states ────────────────────────────────

describe('recording projection lifecycle', () => {
  const payload = (count: number): EpisodeRecordingsPayload => ({
    episodePath: EP103,
    count,
    recordings: [],
    ignoredRecordCount: 0,
  });

  it('walks loading | error | empty | ready, never shaping failure as success', () => {
    expect(projectRecordingSection(undefined).status).toBe('loading');
    expect(projectRecordingSection(loadingResource()).status).toBe('loading');

    const errored = projectRecordingSection(errorResource('disk gone'));
    expect(errored.status).toBe('error');
    expect(errored.error).toBe('disk gone');

    expect(projectRecordingSection(readyResource(payload(0))).status).toBe('empty');
    expect(projectRecordingSection(readyResource(payload(3))).status).toBe('ready');
  });

  it('tallies the metric: loading until every path answered, then sums with errors counted', () => {
    const paths = ['ep-a', 'ep-b', 'ep-c'];
    let byPath: ReadonlyMap<string, SharedResource<EpisodeRecordingsPayload>> = new Map();

    // A path not yet requested keeps the tile loading, never silently zero.
    byPath = withResource(byPath, 'ep-a', readyResource(payload(2)));
    expect(tallyRecordingResources(byPath, paths).status).toBe('loading');

    byPath = withResource(byPath, 'ep-b', errorResource('disk gone'));
    byPath = withResource(byPath, 'ep-c', readyResource(payload(1)));
    expect(tallyRecordingResources(byPath, paths)).toEqual({
      status: 'ready',
      total: 3,
      erroredPathCount: 1,
    });

    expect(tallyRecordingResources(new Map(), [])).toEqual({
      status: 'ready',
      total: 0,
      erroredPathCount: 0,
    });
  });
});

// ─── Named-error surface stays intact ────────────────────────────────────────

describe('named errors', () => {
  it('every refusal carries its name for the route status mapping', () => {
    expect(new InvalidRecordingPathError('x').name).toBe('InvalidRecordingPathError');
    expect(new RecordingNotFoundError('x').name).toBe('RecordingNotFoundError');
    expect(new EpisodeRecordingsUnavailableError('x').name)
      .toBe('EpisodeRecordingsUnavailableError');
  });
});
