'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findParentEpisode,
  getEpisodeInquiryPath,
  perspectiveMatchesPlan,
  type ChronicleArtifactReference,
  type ChronicleSnapshot,
  type ChronicleSourceInfo,
  type EpisodeInquiry,
  type InquiryRelation,
  type InquirySyncState,
  type PlanPerspective,
  type PlanPerspectives,
} from '@forgewright/lib/chronicle/client';
import {
  collectDistinctEpisodePaths,
  errorResource,
  loadingResource,
  pathsNeedingFetch,
  projectInquirySection,
  projectPerspectiveSection,
  readyResource,
  withResource,
  type SharedResource,
} from '@forgewright/lib/chronicle/viewCache';
import { DIRECTIONS } from '@forgewright/lib/types/directions';
import Markdown from './Markdown';

interface ChronicleApiResponse {
  data: ChronicleSnapshot | null;
  error?: string;
  source?: ChronicleSourceInfo;
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

function ReferenceCard({
  reference,
  parentEpisode,
}: {
  reference: ChronicleArtifactReference;
  parentEpisode?: ChronicleArtifactReference | null;
}) {
  const timestamp = formatTimestamp(reference.updatedAt ?? reference.createdAt);
  const direction = reference.direction ? DIRECTIONS[reference.direction] : null;

  return (
    <article className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 transition-colors hover:border-neutral-700">
      {reference.kind === 'structured_plan' ? (
        <p className="mb-3 text-[10px] uppercase tracking-wide text-cyan-500">
          {parentEpisode ? `Contained in ${parentEpisode.name}` : 'Episode association unavailable'}
        </p>
      ) : null}
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
          {reference.goalSummary ? (
            <p className="mt-2 rounded border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-xs leading-relaxed text-amber-200/80">
              <span className="font-medium text-amber-400">Goal:</span> {reference.goalSummary}
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

// ─── Shared in-view fetch cache (miadisabelle/forgewright#7) ─────────────────
// One unfiltered inquiry request feeds the metric tile AND every episode
// section; one perspectives request per DISTINCT episode path feeds both the
// episode-level and plan-level sections. reloadKey invalidates every shared
// resource; a section's Retry refetches only the shared resource it reads.

interface SharedInquiry {
  resource: SharedResource<EpisodeInquiry>;
  retry: () => void;
}

function useSharedInquiry(reloadKey: number): SharedInquiry {
  const [resource, setResource] = useState<SharedResource<EpisodeInquiry>>(loadingResource);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setResource(loadingResource());

    async function load() {
      try {
        const response = await fetch('/api/chronicle/inquiry', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        const body = (await response.json()) as { data: EpisodeInquiry | null; error?: string };
        if (!response.ok || body.data == null) {
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }
        if (controller.signal.aborted) return;
        setResource(readyResource(body.data));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setResource(
          errorResource(loadError instanceof Error ? loadError.message : 'section unavailable'),
        );
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadKey, attempt]);

  return { resource, retry };
}

interface SharedPerspectives {
  byPath: ReadonlyMap<string, SharedResource<PlanPerspectives>>;
  retryPath: (episodePath: string) => void;
}

interface PerspectiveGeneration {
  generation: number;
  requested: Set<string>;
  controller: AbortController;
}

function useSharedPerspectives(
  episodePaths: readonly string[],
  reloadKey: number,
): SharedPerspectives {
  const [byPath, setByPath] = useState<ReadonlyMap<string, SharedResource<PlanPerspectives>>>(
    () => new Map(),
  );
  const trackerRef = useRef<PerspectiveGeneration | null>(null);

  const runFetch = useCallback((episodePath: string) => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    const { generation, controller } = tracker;

    const apply = (entry: SharedResource<PlanPerspectives>) => {
      if (controller.signal.aborted || trackerRef.current?.generation !== generation) return;
      setByPath((previous) => withResource(previous, episodePath, entry));
    };

    async function load() {
      try {
        const response = await fetch(
          `/api/chronicle/perspectives?episode_path=${encodeURIComponent(episodePath)}`,
          {
            cache: 'no-store',
            headers: { accept: 'application/json' },
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as { data: PlanPerspectives | null; error?: string };
        if (!response.ok || body.data == null) {
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }
        apply(readyResource(body.data));
      } catch (loadError) {
        if (controller.signal.aborted) return;
        apply(
          errorResource(loadError instanceof Error ? loadError.message : 'section unavailable'),
        );
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker || tracker.generation !== reloadKey) {
      tracker?.controller.abort();
      trackerRef.current = {
        generation: reloadKey,
        requested: new Set(),
        controller: new AbortController(),
      };
      setByPath(new Map());
    }

    const current = trackerRef.current!;
    const missing = pathsNeedingFetch(current.requested, episodePaths);
    if (missing.length === 0) return;

    for (const path of missing) current.requested.add(path);
    setByPath((previous) => {
      let next: ReadonlyMap<string, SharedResource<PlanPerspectives>> = previous;
      for (const path of missing) next = withResource(next, path, loadingResource());
      return next;
    });
    for (const path of missing) runFetch(path);
  }, [episodePaths, reloadKey, runFetch]);

  // Unmount: abort in-flight fetches and drop the generation so a strict-mode
  // remount starts a fresh one instead of trusting aborted requests.
  useEffect(
    () => () => {
      trackerRef.current?.controller.abort();
      trackerRef.current = null;
    },
    [],
  );

  const retryPath = useCallback(
    (episodePath: string) => {
      const tracker = trackerRef.current;
      if (!tracker) return;
      tracker.requested.add(episodePath);
      setByPath((previous) => withResource(previous, episodePath, loadingResource()));
      runFetch(episodePath);
    },
    [runFetch],
  );

  return { byPath, retryPath };
}

export default function ChronicleView() {
  const [snapshot, setSnapshot] = useState<ChronicleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<ChronicleSourceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  const sharedInquiry = useSharedInquiry(reloadKey);
  const episodePaths = useMemo(
    () => (snapshot ? collectDistinctEpisodePaths(snapshot.episodes) : []),
    [snapshot],
  );
  const sharedPerspectives = useSharedPerspectives(episodePaths, reloadKey);

  useEffect(() => {
    const controller = new AbortController();

    async function loadChronicle() {
      setIsLoading(true);
      setError(null);
      setErrorSource(null);

      try {
        const response = await fetch('/api/chronicle', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        const body = await response.json() as ChronicleApiResponse;

        if (!response.ok || !body.data) {
          if (body.source) setErrorSource(body.source);
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
            {errorSource ? (
              <p className="mt-2 font-mono text-[10px] text-red-400/60">
                {errorSource.baseUrl
                  ? `upstream: ${errorSource.service} · ${errorSource.baseUrl}`
                  : `misconfigured: ${errorSource.configError ?? 'MW_API_URL is invalid'}`}
              </p>
            ) : null}
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
            <SourceBanner source={snapshot.source} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Episodes" value={snapshot.episodes.length} />
              <Metric label="Structured plans" value={snapshot.structuredPlans.length} />
              <InquiryWeaveMetric resource={sharedInquiry.resource} />
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
                <span className="text-[10px] text-neutral-600">Medicine Wheel references</span>
              </div>
              {snapshot.episodes.length > 0 ? (
                <div className="space-y-3">
                  {snapshot.episodes.map((episode) => (
                    <div key={episode.id} className="space-y-2">
                      <ReferenceCard reference={episode} />
                      <EpisodeInquirySection
                        episodePath={getEpisodeInquiryPath(episode)}
                        inquiry={sharedInquiry}
                      />
                      <EpisodePerspectiveSection
                        episodePath={getEpisodeInquiryPath(episode)}
                        perspectives={sharedPerspectives}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-xs text-neutral-600">
                  No Chronicle episode references are registered yet.
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Registered structured plans
                </h3>
                <span className="text-[10px] text-neutral-600">Medicine Wheel relations</span>
              </div>
              {snapshot.structuredPlans.length > 0 ? (
                <div className="space-y-3">
                  {snapshot.structuredPlans.map((plan) => {
                    const parentEpisode = findParentEpisode(plan, snapshot.episodes);
                    return (
                      <div key={plan.id} className="space-y-2">
                        <ReferenceCard reference={plan} parentEpisode={parentEpisode} />
                        <PlanPerspectiveSection
                          plan={plan}
                          parentEpisode={parentEpisode}
                          perspectives={sharedPerspectives}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-xs text-neutral-600">
                  No structured-plan references are registered yet.
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

const SYNC_STATE_STYLES: Record<
  InquirySyncState,
  { glyph: string; label: string; className: string }
> = {
  'in-sync': {
    glyph: '🟢',
    label: 'in sync',
    className: 'border-emerald-900/70 bg-emerald-950/40 text-emerald-400',
  },
  stale: {
    glyph: '🟡',
    label: 'stale',
    className: 'border-amber-900/70 bg-amber-950/40 text-amber-400',
  },
  'never-synced': {
    glyph: '⚪',
    label: 'never synced',
    className: 'border-neutral-700 bg-neutral-900/60 text-neutral-400',
  },
  'episode-copy-diverged': {
    glyph: '🔴',
    label: 'copy diverged',
    className: 'border-red-900/70 bg-red-950/40 text-red-400',
  },
};

function InquiryRow({ relation }: { relation: InquiryRelation }) {
  const sync = SYNC_STATE_STYLES[relation.syncState];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2">
      <span className="text-sm" aria-hidden="true">🧬</span>
      <code
        className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-300"
        title={relation.artefact}
      >
        {relation.artefact}
      </code>
      {relation.issueRef ? (
        relation.issueUrl ? (
          <a
            href={relation.issueUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded border border-cyan-900/60 bg-cyan-950/30 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300 transition-colors hover:border-cyan-700 hover:text-cyan-200"
          >
            {relation.issueRef}
          </a>
        ) : (
          <span className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
            {relation.issueRef}
          </span>
        )
      ) : (
        <span className="rounded border border-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600">
          no issue
        </span>
      )}
      <span
        className={`rounded border px-1.5 py-0.5 text-[10px] ${sync.className}`}
        title={relation.syncedAt ? `last sync ${relation.syncedAt}` : undefined}
      >
        {sync.glyph} {sync.label}
      </span>
    </div>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <p
      className="ml-6 animate-pulse border-l border-neutral-800 pl-4 text-[10px] uppercase tracking-wide text-neutral-600"
      role="status"
    >
      {label}…
    </p>
  );
}

function SectionError({
  label,
  message,
  onRetry,
}: {
  label: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="ml-6 border-l border-red-900/60 pl-4" role="alert">
      <div className="flex flex-wrap items-center gap-2 rounded border border-red-900/50 bg-red-950/20 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wide text-red-400">{label} unavailable</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-red-400/60" title={message}>
          {message}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-red-800 px-2 py-0.5 text-[10px] text-red-300 transition-colors hover:border-red-600"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function EpisodeInquirySection({
  episodePath,
  inquiry,
}: {
  episodePath: string;
  inquiry: SharedInquiry;
}) {
  const section = projectInquirySection(inquiry.resource, episodePath);

  if (section.status === 'loading') return <SectionLoading label="Inquiry" />;
  if (section.status === 'error') {
    return (
      <SectionError
        label="Inquiry"
        message={section.error ?? 'upstream unavailable'}
        onRetry={inquiry.retry}
      />
    );
  }
  // count 0 renders nothing — silence here means "no weaves", never "broken".
  if (section.status === 'empty' || !section.data) return null;

  return (
    <div className="ml-6 space-y-1.5 border-l border-neutral-800 pl-4">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">
        Inquiry · {section.data.count}
      </p>
      {section.data.inquiries.map((relation, index) => (
        <InquiryRow key={`${relation.artefact}-${index}`} relation={relation} />
      ))}
    </div>
  );
}

const PERSPECTIVE_EXCERPT_LIMIT = 240;

function PerspectiveRow({ perspective }: { perspective: PlanPerspective }) {
  const timestamp = formatTimestamp(perspective.updatedAt ?? perspective.registeredAt);
  const excerpt =
    perspective.bodyMarkdown.length > PERSPECTIVE_EXCERPT_LIMIT
      ? `${perspective.bodyMarkdown.slice(0, PERSPECTIVE_EXCERPT_LIMIT).trimEnd()}…`
      : perspective.bodyMarkdown;

  return (
    <details className="group rounded border border-pink-900/40 bg-pink-950/10 px-3 py-2">
      <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-700">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm" aria-hidden="true">🌸</span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-pink-200" title={perspective.title}>
            {perspective.title}
          </span>
          <span className="rounded border border-pink-900/60 px-1.5 py-0.5 text-[10px] text-pink-400 group-open:hidden">
            expand
          </span>
          <span className="hidden rounded border border-pink-900/60 px-1.5 py-0.5 text-[10px] text-pink-400 group-open:inline">
            collapse
          </span>
        </span>
        <span className="mt-1 block text-[11px] leading-relaxed text-neutral-400 group-open:hidden">
          {excerpt}
        </span>
      </summary>
      <div className="mt-2 border-t border-pink-900/30 pt-2">
        <Markdown>{perspective.bodyMarkdown}</Markdown>
      </div>
      {perspective.miaContext ? (
        <div className="mt-2 rounded border border-cyan-900/40 bg-cyan-950/10 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-cyan-500">🧠 Mia context</p>
          <Markdown className="mt-1">{perspective.miaContext}</Markdown>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-600">
        <span className="font-mono">{perspective.planFilename}</span>
        {perspective.generator ? <span>{perspective.generator}</span> : null}
        {timestamp ? <span>Updated {timestamp}</span> : null}
      </div>
    </details>
  );
}

function EpisodePerspectiveSection({
  episodePath,
  perspectives,
}: {
  episodePath: string;
  perspectives: SharedPerspectives;
}) {
  const section = projectPerspectiveSection(perspectives.byPath.get(episodePath));

  if (section.status === 'loading') return <SectionLoading label="Miette perspective" />;
  if (section.status === 'error') {
    return (
      <SectionError
        label="Miette perspective"
        message={section.error ?? 'upstream unavailable'}
        onRetry={() => perspectives.retryPath(episodePath)}
      />
    );
  }
  // count 0 renders nothing — silence here means "no perspectives", never "broken".
  if (section.status === 'empty' || !section.data) return null;

  return (
    <div className="ml-6 space-y-1.5 border-l border-pink-900/40 pl-4">
      <p className="text-[10px] uppercase tracking-wide text-pink-500/80">
        Miette perspective · {section.data.count}
      </p>
      {section.data.perspectives.map((perspective) => (
        <PerspectiveRow key={perspective.id} perspective={perspective} />
      ))}
    </div>
  );
}

function PlanPerspectiveSection({
  plan,
  parentEpisode,
  perspectives,
}: {
  plan: ChronicleArtifactReference;
  parentEpisode: ChronicleArtifactReference | null;
  perspectives: SharedPerspectives;
}) {
  // No episode association → no path to read from; stay quiet like before.
  if (!parentEpisode) return null;

  const episodePath = getEpisodeInquiryPath(parentEpisode);
  const section = projectPerspectiveSection(perspectives.byPath.get(episodePath));

  if (section.status === 'loading') return <SectionLoading label="Miette perspective" />;
  if (section.status === 'error') {
    return (
      <SectionError
        label="Miette perspective"
        message={section.error ?? 'upstream unavailable'}
        onRetry={() => perspectives.retryPath(episodePath)}
      />
    );
  }
  if (section.status === 'empty' || !section.data) return null;

  const matching = section.data.perspectives.filter((perspective) =>
    perspectiveMatchesPlan(perspective, plan),
  );
  if (matching.length === 0) return null;

  return (
    <div className="ml-6 space-y-1.5 border-l border-pink-900/40 pl-4">
      <p className="text-[10px] uppercase tracking-wide text-pink-500/80">
        Miette perspective on this plan
      </p>
      {matching.map((perspective) => (
        <PerspectiveRow key={perspective.id} perspective={perspective} />
      ))}
    </div>
  );
}

function SourceBanner({ source }: { source: ChronicleSnapshot['source'] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/10 px-4 py-2">
      <span aria-hidden="true">🟢</span>
      <span className="text-[11px] font-medium text-emerald-300">{source.service}</span>
      <code
        className="min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-500"
        title={source.baseUrl}
      >
        {source.baseUrl}
      </code>
      <span className="rounded border border-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
        {source.provider}
      </span>
      <span className="rounded border border-emerald-900/70 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] text-emerald-400">
        {source.status}
      </span>
    </div>
  );
}

function InquiryWeaveMetric({ resource }: { resource: SharedResource<EpisodeInquiry> }) {
  const value =
    resource.status === 'ready'
      ? resource.data?.count ?? 0
      : resource.status === 'loading'
        ? '…'
        : '—';

  return (
    <Metric
      label="Inquiry weaves"
      value={value}
      title={resource.status === 'error' ? resource.error ?? 'upstream unavailable' : undefined}
    />
  );
}

function Metric({
  label,
  value,
  deferred = false,
  title,
}: {
  label: string;
  value: number | string;
  deferred?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3" title={title}>
      <div className="text-xl font-semibold text-neutral-200">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
        {label}{deferred ? ' · next slice' : ''}
      </div>
    </div>
  );
}
