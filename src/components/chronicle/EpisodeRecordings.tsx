'use client';

// ─── Chronicle episode recordings (read-only) ────────────────────────────────
// The vessel already holds its audio on local disk; this section lists it and
// plays it through the streaming read proxy. Nothing here writes, and nothing
// reaches a remote recorder. A `captured` take is the irreplaceable original —
// its badge wears the amber token for emphasis, never the ember: ember is the
// liveness vocabulary and a recording is not a liveness signal.
//
// Empty renders silence; error renders SectionError with Retry — an unreadable
// disk is never shaped like an episode with nothing recorded.

import type {
  EpisodeRecordingsPayload,
  MergedRecording,
  RecordingOrigin,
} from '@forgewright/lib/chronicle/recordings';
import type { RecordingTally, SectionProjection } from '@forgewright/lib/chronicle/viewCache';
import { formatTimestamp, Metric, SectionError, SectionLoading } from './sections';

const ORIGIN_BADGES: Record<RecordingOrigin, { className: string; title: string }> = {
  captured: {
    // Emphasized: the original take cannot be re-taken. Amber token, not ember.
    className: 'border-amber-900/70 bg-amber-950/40 font-medium text-amber-300',
    title: 'original capture — irreplaceable',
  },
  derived: {
    className: 'border-neutral-700 bg-neutral-900/60 text-neutral-400',
    title: 'derived from another recording',
  },
  authored: {
    className: 'border-neutral-700 bg-neutral-900/60 text-neutral-400',
    title: 'authored content',
  },
};

export function formatRecordingSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KiB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function formatRecordingDuration(durationSeconds: number): string {
  const whole = Math.round(durationSeconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Streaming proxy URL for one take — the src the <audio> element plays. */
export function recordingAudioUrl(episodePath: string, filename: string): string {
  return `/api/chronicle/recordings/audio?episode=${encodeURIComponent(episodePath)}&file=${encodeURIComponent(filename)}`;
}

// ─── Metric tile ─────────────────────────────────────────────────────────────

export function RecordingsMetric({ tally }: { tally: RecordingTally }) {
  // Per-path fetches carry their own retries in the episode sections, so the
  // tile reports honestly instead: a dash when NO path answered, and a caption
  // when the total excludes episodes that did not.
  const value =
    tally.status === 'loading' ? '…'
    : tally.erroredPathCount > 0 && tally.total === 0 ? '—'
    : tally.total;

  return (
    <Metric
      label="Captures"
      value={value}
      caption={
        tally.status === 'ready' && tally.erroredPathCount > 0 ? (
          <span className="text-neutral-500">
            {tally.erroredPathCount} episode(s) not answering
          </span>
        ) : undefined
      }
    />
  );
}

// ─── Episode-level recordings section ────────────────────────────────────────

export function EpisodeRecordingsSection({
  episodePath,
  section,
  onRetry,
}: {
  episodePath: string;
  section: SectionProjection<EpisodeRecordingsPayload>;
  onRetry: () => void;
}) {
  if (section.status === 'loading') return <SectionLoading label="Captures" />;
  if (section.status === 'error') {
    return (
      <SectionError
        label="Captures"
        message={section.error ?? 'upstream unavailable'}
        onRetry={onRetry}
      />
    );
  }
  // count 0 renders an honest empty line — invisible silence reads as "not
  // deployed", never as "no captures yet" (ruled 2026-08-12, ep320).
  if (section.status === 'empty' || !section.data) {
    return (
      <div className="ml-6 space-y-1.5 border-l border-neutral-800 pl-4">
        <p className="text-[11px] uppercase tracking-wide text-neutral-600">
          Captures · <span className="font-mono tabular-nums">0</span>
          <span className="ml-2 normal-case tracking-normal text-neutral-700">
            none captured yet
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="ml-6 space-y-1.5 border-l border-neutral-800 pl-4">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
        Captures · <span className="font-mono tabular-nums">{section.data.count}</span>
      </p>
      {section.data.recordings.map((recording) => (
        <RecordingCard key={recording.filename} episodePath={episodePath} recording={recording} />
      ))}
      {section.data.ignoredRecordCount > 0 ? (
        <p className="text-[10px] text-neutral-700">
          {section.data.ignoredRecordCount} registry record(s) failed the contract and are held
          outside this view.
        </p>
      ) : null}
    </div>
  );
}

function RecordingCard({
  episodePath,
  recording,
}: {
  episodePath: string;
  recording: MergedRecording;
}) {
  const modified = formatTimestamp(recording.modifiedAt);
  const started = recording.startedAt ? formatTimestamp(recording.startedAt) : null;
  const origin = recording.origin ? ORIGIN_BADGES[recording.origin] : null;

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm" aria-hidden="true">
          {recording.kind === 'midi' ? '🎹' : '🎙️'}
        </span>
        <code
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-300"
          title={recording.filename}
        >
          {recording.filename}
        </code>
        <span className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-400">
          {recording.kind}
        </span>
        {origin ? (
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] ${origin.className}`}
            title={origin.title}
          >
            {recording.origin}
          </span>
        ) : null}
        {recording.hasTranscription ? (
          <span
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400"
            title="a transcription sidecar sits beside this take"
          >
            transcript
          </span>
        ) : null}
      </div>

      {recording.kind === 'audio' ? (
        // preload="none": the take streams only when the reader presses play.
        <audio
          controls
          preload="none"
          className="mt-2 h-8 w-full"
          src={recordingAudioUrl(episodePath, recording.filename)}
        />
      ) : null}

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-600">
        <span className="font-mono tabular-nums">{formatRecordingSize(recording.sizeBytes)}</span>
        {recording.durationSeconds !== undefined ? (
          <span className="font-mono tabular-nums">
            {formatRecordingDuration(recording.durationSeconds)}
          </span>
        ) : null}
        {recording.device ? <span>{recording.device}</span> : null}
        {started ? <span className="font-mono tabular-nums">Started {started}</span> : null}
        {modified ? <span className="font-mono tabular-nums">Modified {modified}</span> : null}
      </div>
    </div>
  );
}
