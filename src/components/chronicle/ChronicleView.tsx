'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ChronicleArtifactReference,
  ChronicleSnapshot,
} from '@forgewright/lib/chronicle/client';
import { DIRECTIONS } from '@forgewright/lib/types/directions';

interface ChronicleApiResponse {
  data: ChronicleSnapshot | null;
  error?: string;
}

function formatTimestamp(value?: string): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

function ReferenceCard({ reference }: { reference: ChronicleArtifactReference }) {
  const timestamp = formatTimestamp(reference.updatedAt ?? reference.createdAt);
  const direction = reference.direction ? DIRECTIONS[reference.direction] : null;

  return (
    <article className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 transition-colors hover:border-neutral-700">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-hidden="true">
          {direction?.emoji ?? '📜'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-neutral-100">{reference.name}</h3>
            {reference.status ? (
              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {reference.status}
              </span>
            ) : null}
          </div>
          {reference.description ? (
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              {reference.description}
            </p>
          ) : null}
          <p className="mt-3 break-all font-mono text-[10px] text-neutral-600">
            {reference.relativePath}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-600">
            {direction ? <span>{direction.ojibwe} · {direction.name}</span> : null}
            {timestamp ? <span>Updated {timestamp}</span> : null}
            {reference.schemaVersion ? <span>{reference.schemaVersion}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status">
      <div className="text-center">
        <div className="text-sm text-neutral-400">Opening the Chronicle…</div>
        <div className="mt-2 text-xs text-neutral-600">Medicine Wheel · read-only</div>
      </div>
    </div>
  );
}

export default function ChronicleView() {
  const [snapshot, setSnapshot] = useState<ChronicleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadChronicle() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/chronicle', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        const body = await response.json() as ChronicleApiResponse;

        if (!response.ok || !body.data) {
          throw new Error(body.error ?? `Chronicle request returned HTTP ${response.status}`);
        }

        setSnapshot(body.data);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setSnapshot(null);
        setError(loadError instanceof Error ? loadError.message : 'Chronicle unavailable');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadChronicle();
    return () => controller.abort();
  }, [reloadKey]);

  if (isLoading) return <LoadingState />;

  return (
    <section className="flex h-full flex-col overflow-hidden" aria-labelledby="chronicle-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="chronicle-title" className="text-sm font-semibold uppercase tracking-widest text-neutral-300">
              Miadi Chronicle
            </h2>
            <span className="rounded border border-emerald-900/70 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] text-emerald-400">
              Read-only
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Relational references served by Medicine Wheel; episode files remain canonical.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        >
          Refresh
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 [content-visibility:auto]">
        {error ? (
          <div className="rounded-lg border border-red-900/70 bg-red-950/30 p-4" role="alert">
            <p className="text-sm text-red-300">Chronicle unavailable</p>
            <p className="mt-1 text-xs text-red-400/70">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 rounded border border-red-800 px-2.5 py-1 text-xs text-red-300 hover:border-red-600"
            >
              Try again
            </button>
          </div>
        ) : snapshot ? (
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Episodes" value={snapshot.episodes.length} />
              <Metric label="Structured plans" value={snapshot.structuredPlans.length} deferred />
              <Metric label="State machines" value={snapshot.stateMachines.length} deferred />
            </div>

            {snapshot.root ? (
              <div className="rounded-lg border border-purple-900/40 bg-purple-950/15 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-purple-300">
                  <span aria-hidden="true">❄️</span>
                  <span>{snapshot.root.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-purple-500">
                    {snapshot.source.provider}
                  </span>
                </div>
              </div>
            ) : (
              <p className="rounded border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300">
                Chronicle root reference is not registered.
              </p>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Registered episodes
                </h3>
                <span className="text-[10px] text-neutral-600">{snapshot.source.baseUrl}</span>
              </div>
              {snapshot.episodes.length > 0 ? (
                <div className="space-y-3">
                  {snapshot.episodes.map((episode) => (
                    <ReferenceCard key={episode.id} reference={episode} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-xs text-neutral-600">
                  No Chronicle episode references are registered yet.
                </div>
              )}
            </div>

            {snapshot.ignoredNodeCount > 0 ? (
              <p className="text-center text-[10px] text-neutral-700">
                {snapshot.ignoredNodeCount} unrelated or incompatible Medicine Wheel node(s) held outside this view.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value, deferred = false }: { label: string; value: number; deferred?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-xl font-semibold text-neutral-200">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
        {label}{deferred ? ' · next slice' : ''}
      </div>
    </div>
  );
}
