// ─── Chronicle Episode Recordings ────────────────────────────────────────────
// Two read-only concerns, kept in one module:
//
//   1. Disk listing — audio-kind files sitting FLAT in the episode vessel under
//      MIADI_CHRONICLE_ROOT (episode 103's `260628174942.m4a` beside its
//      `transcription_*_EN.txt` sidecars is the ground truth). Mirrors
//      diagrams.ts exactly: same root law, same path-escape guards, named
//      errors — never an anonymous crash.
//
//   2. Registry enrichment — GET {MW_API_URL}/api/recordings, normalized
//      fail-closed with dropped records counted. The wheel may not serve this
//      route yet (404/503); that lands as an EMPTY enrichment carrying its
//      reason, never an error that blocks the disk listing.
//
// Nothing here writes, and nothing reaches a remote recorder. The audio is
// episode content already on local disk; streaming it out is still reading.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describeChronicleSource, type ChronicleClientOptions } from './client';
import { resolveChronicleRoot } from './diagrams';

// ─── Named errors ────────────────────────────────────────────────────────────

/** The requested episode or file parameter is unsafe or not a recording path. */
export class InvalidRecordingPathError extends Error {
  readonly name = 'InvalidRecordingPathError';
}

/** The path is well-formed but no episode folder or recording lives there. */
export class RecordingNotFoundError extends Error {
  readonly name = 'RecordingNotFoundError';
}

/** The disk itself did not answer — root unmounted, permissions, IO failure. */
export class EpisodeRecordingsUnavailableError extends Error {
  readonly name = 'EpisodeRecordingsUnavailableError';
}

// ─── Extension allowlist ─────────────────────────────────────────────────────

export type RecordingKind = 'audio' | 'midi';

const RECORDING_EXTENSIONS: Record<string, { kind: RecordingKind; contentType: string }> = {
  '.m4a': { kind: 'audio', contentType: 'audio/mp4' },
  '.mp3': { kind: 'audio', contentType: 'audio/mpeg' },
  '.wav': { kind: 'audio', contentType: 'audio/wav' },
  '.ogg': { kind: 'audio', contentType: 'audio/ogg' },
  '.opus': { kind: 'audio', contentType: 'audio/ogg' },
  '.mid': { kind: 'midi', contentType: 'audio/midi' },
  '.midi': { kind: 'midi', contentType: 'audio/midi' },
};

function recordingExtensionOf(filename: string): { kind: RecordingKind; contentType: string } | null {
  return RECORDING_EXTENSIONS[path.extname(filename).toLowerCase()] ?? null;
}

/** Kind by extension, or null when the file is not a recording at all. */
export function recordingKindOf(filename: string): RecordingKind | null {
  return recordingExtensionOf(filename)?.kind ?? null;
}

/** Content-Type the streaming proxy serves, or null when not allowlisted. */
export function contentTypeForRecording(filename: string): string | null {
  return recordingExtensionOf(filename)?.contentType ?? null;
}

// ─── Path safety (mirrors diagrams.ts) ───────────────────────────────────────

function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.includes('\\') || value.includes('\0')) return false;
  if (value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return false;
  return !value
    .split('/')
    .some((segment) => segment === '..' || segment === '.' || segment === '');
}

/** Guard for the `episode` query param — a safe relative chronicle path. */
export function isEpisodeParam(value: unknown): value is string {
  return typeof value === 'string' && isSafeRelativePath(value);
}

/** Guard for the `file` query param — a bare allowlisted filename, no separators. */
export function isRecordingFileParam(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0') &&
    value !== '.' &&
    value !== '..' &&
    recordingExtensionOf(value) !== null
  );
}

function assertEpisodePath(episodePath: string): void {
  if (!isEpisodeParam(episodePath)) {
    throw new InvalidRecordingPathError(
      `Episode must be a safe relative chronicle path: ${episodePath}`,
    );
  }
}

/** Resolve under the root and verify the prefix — the escape backstop. */
function resolveUnder(root: string, ...segments: string[]): string {
  const absolutePath = path.resolve(root, ...segments);
  if (!absolutePath.startsWith(path.resolve(root) + path.sep)) {
    throw new InvalidRecordingPathError(
      `Recording path escapes the chronicle root: ${segments.join('/')}`,
    );
  }
  return absolutePath;
}

function errnoCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

// ─── Disk listing ────────────────────────────────────────────────────────────

export interface EpisodeRecording {
  /** Bare filename inside the episode vessel, e.g. `260628174942.m4a`. */
  filename: string;
  kind: RecordingKind;
  sizeBytes: number;
  modifiedAt: string;
  /** A `<stem>.json` sidecar or a `transcription_*` file naming the stem. */
  hasTranscription: boolean;
}

/**
 * Scan ONE episode folder — flat, non-recursive — for audio-kind files by
 * extension. A missing episode folder is RecordingNotFoundError; an unreadable
 * disk is EpisodeRecordingsUnavailableError. Filenames sort ascending.
 */
export async function listEpisodeRecordings(
  episodePath: string,
  root: string = resolveChronicleRoot(),
): Promise<EpisodeRecording[]> {
  assertEpisodePath(episodePath);
  const episodeDir = resolveUnder(root, episodePath);

  let entries;
  try {
    entries = await fs.readdir(episodeDir, { withFileTypes: true });
  } catch (error) {
    const code = errnoCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new RecordingNotFoundError(`No episode folder at ${episodePath} under ${root}`);
    }
    throw new EpisodeRecordingsUnavailableError(
      `Episode folder is not readable: ${episodePath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const fileNames = new Set(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );

  const recordings: EpisodeRecording[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = recordingExtensionOf(entry.name);
    if (!extension) continue;

    let stat;
    try {
      stat = await fs.stat(path.join(episodeDir, entry.name));
    } catch {
      continue; // vanished mid-scan — contributes nothing, breaks nothing
    }

    const stem = entry.name.slice(0, entry.name.length - path.extname(entry.name).length);
    const hasTranscription =
      fileNames.has(`${stem}.json`) ||
      [...fileNames].some((name) => name.startsWith('transcription_') && name.includes(stem));

    recordings.push({
      filename: entry.name,
      kind: extension.kind,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      hasTranscription,
    });
  }

  return recordings.sort((left, right) => left.filename.localeCompare(right.filename));
}

// ─── One recording file, resolved and stat'ed for streaming ──────────────────

export interface RecordingFileStat {
  absolutePath: string;
  sizeBytes: number;
  modifiedAt: string;
  contentType: string;
}

/**
 * Validate + resolve + stat one recording under `<root>/<episode>/<file>`.
 * The file param is a BARE filename (recordings sit flat in the vessel), its
 * extension must be allowlisted, and the resolved path must stay inside the
 * episode folder — the same guard discipline diagrams.ts applies.
 */
export async function statEpisodeRecording(
  episodePath: string,
  filename: string,
  root: string = resolveChronicleRoot(),
): Promise<RecordingFileStat> {
  assertEpisodePath(episodePath);
  if (!isRecordingFileParam(filename)) {
    throw new InvalidRecordingPathError(
      `File must be a bare allowlisted recording filename: ${filename}`,
    );
  }

  const episodeDir = resolveUnder(root, episodePath);
  const absolutePath = path.resolve(episodeDir, filename);
  if (!absolutePath.startsWith(episodeDir + path.sep)) {
    throw new InvalidRecordingPathError(
      `Recording path escapes the episode folder: ${episodePath}/${filename}`,
    );
  }

  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch (error) {
    const code = errnoCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new RecordingNotFoundError(`No recording at ${episodePath}/${filename} under ${root}`);
    }
    throw new EpisodeRecordingsUnavailableError(
      `Recording is not readable: ${episodePath}/${filename} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (!stat.isFile()) {
    throw new RecordingNotFoundError(`No recording at ${episodePath}/${filename} under ${root}`);
  }

  return {
    absolutePath,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    // The param guard already proved the extension is allowlisted.
    contentType: contentTypeForRecording(filename) ?? 'application/octet-stream',
  };
}

// ─── Range parsing (pure — RFC 7233, single range) ───────────────────────────

export type RecordingRange =
  | { kind: 'full' }
  | { kind: 'partial'; start: number; end: number }
  | { kind: 'unsatisfiable' };

/**
 * Parse a Range header against a known size. Only a single `bytes=` range is
 * honoured; a malformed or multi-range header is IGNORED (full body, as RFC
 * 7233 permits) rather than guessed at. A range no byte can satisfy answers
 * `unsatisfiable` so the route can say 416 with the real size.
 */
export function parseRangeHeader(header: string | null, sizeBytes: number): RecordingRange {
  if (!header) return { kind: 'full' };

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { kind: 'full' };

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return { kind: 'full' };

  // Suffix range: the last N bytes.
  if (rawStart === '') {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (suffixLength === 0 || sizeBytes === 0) return { kind: 'unsatisfiable' };
    return { kind: 'partial', start: Math.max(sizeBytes - suffixLength, 0), end: sizeBytes - 1 };
  }

  const start = Number.parseInt(rawStart, 10);
  if (start >= sizeBytes) return { kind: 'unsatisfiable' };

  if (rawEnd === '') return { kind: 'partial', start, end: sizeBytes - 1 };

  const end = Number.parseInt(rawEnd, 10);
  if (end < start) return { kind: 'full' }; // syntactically invalid — ignored
  return { kind: 'partial', start, end: Math.min(end, sizeBytes - 1) };
}

// ─── Registry enrichment (fail-closed, optional data) ────────────────────────

export const RECORDING_ORIGINS = ['captured', 'derived', 'authored'] as const;

export type RecordingOrigin = (typeof RECORDING_ORIGINS)[number];

export interface RecordingRecord {
  filename: string;
  origin: RecordingOrigin;
  device?: string;
  durationSeconds?: number;
  startedAt?: string;
  episodePath?: string;
}

export interface RecordingRegistry {
  records: RecordingRecord[];
  /** Records that failed the contract — surfaced, like ignoredNodeCount. */
  droppedCount: number;
  /**
   * Set when the wheel did not answer this surface at all (route absent,
   * 404/503, timeout, misconfigured MW_API_URL). Enrichment is then EMPTY —
   * the disk listing stays authoritative and unblocked.
   */
  unavailable?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isRecordingOrigin(value: unknown): value is RecordingOrigin {
  return typeof value === 'string' && (RECORDING_ORIGINS as readonly string[]).includes(value);
}

function normalizeRecordingRecord(value: unknown): RecordingRecord | null {
  if (!isRecord(value)) return null;

  // Fail closed: no safe bare filename or no recognizable origin → the record
  // is dropped and counted. A half-normalized record would read as truth.
  const filename = optionalString(value.filename);
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0') ||
    filename === '.' ||
    filename === '..' ||
    !isRecordingOrigin(value.origin)
  ) {
    return null;
  }

  const record: RecordingRecord = { filename, origin: value.origin };

  const device = optionalString(value.device);
  const startedAt = optionalString(value.started_at) ?? optionalString(value.startedAt);
  const episodePath = optionalString(value.episode_path) ?? optionalString(value.episodePath);
  const duration = value.duration_seconds ?? value.durationSeconds;

  if (device) record.device = device;
  if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
    record.durationSeconds = duration;
  }
  if (startedAt) record.startedAt = startedAt;
  if (episodePath && isSafeRelativePath(episodePath)) record.episodePath = episodePath;

  return record;
}

/** A bare array and `{ recordings: [...] }` / `{ records: [...] }` are accepted. */
function collectRawRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.recordings)) return value.recordings;
  if (Array.isArray(value.records)) return value.records;
  return [];
}

/**
 * GET {MW_API_URL}/api/recordings with the same timeout / no-store / accept
 * discipline client.ts applies. NEVER throws: any failure — including a wheel
 * that does not serve the route yet — is an empty registry naming its reason.
 */
export async function fetchRecordingRecords(
  options: ChronicleClientOptions = {},
): Promise<RecordingRegistry> {
  const source = describeChronicleSource(options.baseUrl);
  if (!source.baseUrl) {
    return { records: [], droppedCount: 0, unavailable: source.configError ?? 'MW_API_URL is invalid' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let value: unknown;
  try {
    const response = await fetchImpl(`${source.baseUrl}/api/recordings`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
    });
    if (!response.ok) {
      return {
        records: [],
        droppedCount: 0,
        unavailable: `Medicine Wheel /api/recordings returned HTTP ${response.status}`,
      };
    }
    value = await response.json();
  } catch (error) {
    return {
      records: [],
      droppedCount: 0,
      unavailable:
        error instanceof Error ? error.message : 'Medicine Wheel /api/recordings is unavailable',
    };
  }

  const raw = collectRawRecords(value);
  const records = raw
    .map((record) => normalizeRecordingRecord(record))
    .filter((record): record is RecordingRecord => record !== null);

  return { records, droppedCount: raw.length - records.length };
}

// ─── Merge: disk rows are authoritative, registry fields enrich ──────────────

export interface MergedRecording extends EpisodeRecording {
  origin?: RecordingOrigin;
  device?: string;
  durationSeconds?: number;
  startedAt?: string;
}

export interface EpisodeRecordingsPayload {
  episodePath: string;
  count: number;
  recordings: MergedRecording[];
  /** Registry records that failed the contract — carried, never hidden. */
  ignoredRecordCount: number;
}

/**
 * Every row comes from disk; the registry only decorates. A registry record is
 * matched by filename, and one that names ANOTHER episode's path never
 * decorates this one. A registry that did not answer decorates nothing.
 */
export function mergeRecordings(
  episodePath: string,
  listing: readonly EpisodeRecording[],
  registry: RecordingRegistry,
): EpisodeRecordingsPayload {
  const recordings = listing.map((recording): MergedRecording => {
    const record = registry.records.find(
      (candidate) =>
        candidate.filename === recording.filename &&
        (candidate.episodePath === undefined || candidate.episodePath === episodePath),
    );
    if (!record) return { ...recording };

    const merged: MergedRecording = { ...recording, origin: record.origin };
    if (record.device) merged.device = record.device;
    if (record.durationSeconds !== undefined) merged.durationSeconds = record.durationSeconds;
    if (record.startedAt) merged.startedAt = record.startedAt;
    return merged;
  });

  return {
    episodePath,
    count: recordings.length,
    recordings,
    ignoredRecordCount: registry.droppedCount,
  };
}
