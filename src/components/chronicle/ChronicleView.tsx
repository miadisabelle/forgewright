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
import type { ChronicleBeats } from '@forgewright/lib/chronicle/client';
// Type-only: recordings.ts reads node:fs, which must never enter this client
// component's bundle. The payload type is erased at compile time.
import type { EpisodeRecordingsPayload } from '@forgewright/lib/chronicle/recordings';
import {
  collectDistinctEpisodePaths,
  errorResource,
  loadingResource,
  pathsNeedingFetch,
  projectBeatSection,
  projectInquirySection,
  projectPerspectiveSection,
  projectRecordingSection,
  projectUnclaimedBeatSection,
  readyResource,
  tallyRecordingResources,
  withResource,
  type SectionProjection,
  type SharedResource,
} from '@forgewright/lib/chronicle/viewCache';
import {
  resolveChronicleRoute,
  routesEqual,
  type ChronicleParam,
} from '@forgewright/lib/chronicle/navigation';
import { useChronicleRoute } from '@forgewright/lib/chronicle/useChronicleRoute';
import { DIRECTIONS } from '@forgewright/lib/types/directions';
import {
  MW_HEAT,
  MwHeatDot,
  deriveStatus,
  heatForStatus,
  type MwHeat,
} from '@forgewright/lib/useMwHealth';
import Markdown from './Markdown';
import { EpisodeRecordingsSection, RecordingsMetric } from './EpisodeRecordings';
import {
  EpisodeBeatsSection,
  NarrativeBeatMetric,
  UnassociatedBeatsSection,
  type BeatNavigation,
} from './NarrativeBeats';
import { formatTimestamp, Metric, SectionError, SectionLoading } from './sections';

interface ChronicleApiResponse {
  data: ChronicleSnapshot | null;
  error?: string;
  source?: ChronicleSourceInfo;
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
        <p className="mb-3 text-[11px] uppercase tracking-wide text-neutral-500">
          {parentEpisode ? `Contained in ${parentEpisode.name}` : 'Episode association unavailable'}
        </p>
      ) : null}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-hidden="true">
          {direction?.emoji ?? '📜'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body font-medium text-neutral-100">{reference.name}</h3>
            {reference.status ? (
              <span className="rounded border border-neutral-700 bg-fw-iron-2 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {reference.status}
              </span>
            ) : null}
          </div>
          {reference.description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              {reference.description}
            </p>
          ) : null}
          {reference.goalSummary ? (
            <p className="mt-2 rounded border-l-2 border-neutral-600 bg-fw-iron-2 px-2.5 py-2 text-caption leading-relaxed text-neutral-300">
              <span className="font-semibold text-neutral-100">Goal:</span> {reference.goalSummary}
            </p>
          ) : null}
          <p className="mt-3 break-all font-mono text-[11px] text-neutral-600">
            {reference.relativePath}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-600">
            {direction ? <span>{direction.ojibwe} · {direction.name}</span> : null}
            {timestamp ? <span className="font-mono tabular-nums">Updated {timestamp}</span> : null}
            {reference.schemaVersion ? <span className="font-mono">{reference.schemaVersion}</span> : null}
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
        <div className="text-body text-neutral-400 motion-safe:animate-pulse">Opening the chronicle…</div>
        <div className="mt-2 text-caption text-neutral-600">Medicine Wheel · read-only</div>
      </div>
    </div>
  );
}

// ─── Shared in-view fetch cache (miadisabelle/forgewright#7) ─────────────────
// One unfiltered inquiry request feeds the metric tile AND every episode
// section; one request per DISTINCT episode path feeds the perspectives (both
// the episode-level and plan-level sections) and the recordings (section +
// tallied metric). reloadKey invalidates every shared resource; a section's
// Retry refetches only the shared resource it reads.

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

interface SharedBeats {
  resource: SharedResource<ChronicleBeats>;
  retry: () => void;
}

/**
 * ONE unfiltered beat probe per view (spec 11, A3). The wheel serves no beat
 * filters yet, so every episode section, the unbound lane, and the metric tile
 * project from this single answer rather than refetching per card.
 */
function useSharedBeats(reloadKey: number): SharedBeats {
  const [resource, setResource] = useState<SharedResource<ChronicleBeats>>(loadingResource);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setResource(loadingResource());

    async function load() {
      try {
        const response = await fetch('/api/chronicle/beats', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        const body = (await response.json()) as { data: ChronicleBeats | null; error?: string };
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

interface PerPathResources<T> {
  byPath: ReadonlyMap<string, SharedResource<T>>;
  retryPath: (episodePath: string) => void;
}

interface PerPathGeneration {
  generation: number;
  requested: Set<string>;
  controller: AbortController;
}

/**
 * One fetch per DISTINCT episode path, cached for the view's generation.
 * Perspectives introduced this lifecycle (the wheel requires a filter there);
 * recordings share it because their proxy is intrinsically per-episode — it
 * lists ONE vessel's folder on disk. The request URL is the only variation.
 */
function usePerPathResources<T>(
  episodePaths: readonly string[],
  reloadKey: number,
  requestPathFor: (episodePath: string) => string,
): PerPathResources<T> {
  const [byPath, setByPath] = useState<ReadonlyMap<string, SharedResource<T>>>(
    () => new Map(),
  );
  const trackerRef = useRef<PerPathGeneration | null>(null);

  const runFetch = useCallback((episodePath: string) => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    const { generation, controller } = tracker;

    const apply = (entry: SharedResource<T>) => {
      if (controller.signal.aborted || trackerRef.current?.generation !== generation) return;
      setByPath((previous) => withResource(previous, episodePath, entry));
    };

    async function load() {
      try {
        const response = await fetch(requestPathFor(episodePath), {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        const body = (await response.json()) as { data: T | null; error?: string };
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
    // Callers below pass module-level constants, so this stays stable.
  }, [requestPathFor]);

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
      let next: ReadonlyMap<string, SharedResource<T>> = previous;
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

type SharedPerspectives = PerPathResources<PlanPerspectives>;
type SharedRecordings = PerPathResources<EpisodeRecordingsPayload>;

const perspectivesRequestPath = (episodePath: string) =>
  `/api/chronicle/perspectives?episode_path=${encodeURIComponent(episodePath)}`;

const recordingsRequestPath = (episodePath: string) =>
  `/api/chronicle/recordings?episode=${encodeURIComponent(episodePath)}`;

function useSharedPerspectives(
  episodePaths: readonly string[],
  reloadKey: number,
): SharedPerspectives {
  return usePerPathResources<PlanPerspectives>(episodePaths, reloadKey, perspectivesRequestPath);
}

function useSharedRecordings(
  episodePaths: readonly string[],
  reloadKey: number,
): SharedRecordings {
  return usePerPathResources<EpisodeRecordingsPayload>(
    episodePaths,
    reloadKey,
    recordingsRequestPath,
  );
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
  const sharedBeats = useSharedBeats(reloadKey);
  const episodePaths = useMemo(
    () => (snapshot ? collectDistinctEpisodePaths(snapshot.episodes) : []),
    [snapshot],
  );
  const sharedPerspectives = useSharedPerspectives(episodePaths, reloadKey);
  const sharedRecordings = useSharedRecordings(episodePaths, reloadKey);
  const recordingTally = useMemo(
    () => tallyRecordingResources(sharedRecordings.byPath, episodePaths),
    [sharedRecordings.byPath, episodePaths],
  );

  // ─── Where the reader is standing (spec 11.2) ──────────────────────────────
  // The URL is the position. It is canonicalized against what the wheel served,
  // and an unresolvable parameter degrades to its nearest resolvable ancestor
  // with an explicit note — never a blank view, never a silent drop to root.
  const { route, navigate, back, replace } = useChronicleRoute();
  const beatData = sharedBeats.resource.data;

  const resolved = useMemo(() => {
    if (!beatData || !snapshot) return { route, unresolved: [] as ChronicleParam[] };
    const beatIndex = new Map(beatData.beats.map((beat) => [beat.id, beat]));
    return resolveChronicleRoute(route, {
      hasEpisode: (path) => episodePaths.includes(path),
      hasCycle: (cycleId) => beatData.cycles.some((cycle) => cycle.id === cycleId),
      getBeat: (beatId) => beatIndex.get(beatId),
      episodeForCycle: (cycleId) => {
        for (const path of episodePaths) {
          const scoped = projectBeatSection(sharedBeats.resource, path);
          if (scoped.data?.cycles.some((cycle) => cycle.id === cycleId)) return path;
        }
        return null;
      },
    });
  }, [route, beatData, snapshot, episodePaths, sharedBeats.resource]);

  // The canonical rewrite makes the unresolved parameter disappear from the URL,
  // so the note is held here until the reader moves on their own. A link that
  // could not be honoured says so; it does not quietly become a different link.
  const [degraded, setDegraded] = useState<ChronicleParam[]>([]);

  useEffect(() => {
    if (route.view !== 'chronicle') return;
    if (routesEqual(route, resolved.route)) return;
    if (resolved.unresolved.length > 0) setDegraded(resolved.unresolved);
    replace(resolved.route);
  }, [route, resolved, replace]);

  const beatNav: BeatNavigation = useMemo(
    () => ({
      route: resolved.route,
      navigate: (next) => {
        setDegraded([]);
        navigate(next);
      },
      back: () => {
        setDegraded([]);
        back();
      },
      unresolved: resolved.unresolved.length > 0 ? resolved.unresolved : degraded,
    }),
    [resolved.route, resolved.unresolved, degraded, navigate, back],
  );

  const unassociatedBeats: SectionProjection<ChronicleBeats> = useMemo(
    () => projectUnclaimedBeatSection(sharedBeats.resource, episodePaths),
    [sharedBeats.resource, episodePaths],
  );

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
        // Keep the last snapshot: a failed refresh means the iron is COOLING,
        // and cooling shows the wheel's last answer rather than a blank page.
        setError(loadError instanceof Error ? loadError.message : 'Chronicle unavailable');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadChronicle();
    return () => controller.abort();
  }, [reloadKey]);

  if (isLoading && !snapshot) return <LoadingState />;

  // The chronicle's own fetch is its probe of the wheel: a fresh answer is
  // ember, a failed refresh over a kept snapshot is cooling, nothing at all
  // is cold. Same pure derivation the StatusBar uses (useMwHealth).
  const status = deriveStatus(!error && snapshot !== null, snapshot !== null);
  const heat = heatForStatus(status);

  return (
    <section className="flex h-full flex-col overflow-hidden" aria-labelledby="chronicle-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-6 py-4">
        <div>
          <div className="flex items-baseline gap-2.5">
            <h2 id="chronicle-title" className="font-display text-title font-semibold text-neutral-100">
              Miadi Chronicle
            </h2>
            <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400">
              Read-only
            </span>
          </div>
          <p className="mt-1 text-caption text-neutral-500">
            Relational references served by the Medicine Wheel. Episode files stay canonical.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 [content-visibility:auto]">
        {snapshot ? (
          <div className="mx-auto max-w-4xl space-y-6">
            <ConnectionBanner
              source={snapshot.source}
              heat={heat ?? 'ember'}
              error={error}
              onRetry={refresh}
            />

            {beatNav.unresolved.length > 0 ? (
              <p
                className="rounded-lg border border-ember-cooling/30 bg-fw-iron px-4 py-2.5 text-caption text-ember-cooling"
                role="alert"
              >
                could not resolve {beatNav.unresolved.join(', ')} — this link degraded to the
                nearest step the wheel still serves
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Metric label="Episodes" value={snapshot.episodes.length} />
              <Metric label="Structured plans" value={snapshot.structuredPlans.length} />
              <InquiryWeaveMetric resource={sharedInquiry.resource} onRetry={sharedInquiry.retry} />
              <NarrativeBeatMetric resource={sharedBeats.resource} onRetry={sharedBeats.retry} />
              <RecordingsMetric tally={recordingTally} />
              <Metric label="State machines" value={snapshot.stateMachines.length} />
            </div>

            {snapshot.root ? (
              // North holds the archive — the root wears the north direction by meaning.
              <div className="rounded-lg border border-forge-north/40 bg-forge-north-tint px-4 py-3">
                <div className="flex items-center gap-2 text-caption text-forge-north-ink">
                  <span aria-hidden="true">❄️</span>
                  <span>{snapshot.root.name}</span>
                  <span className="ml-auto font-mono text-[11px] text-forge-north-ink/70">
                    {snapshot.source.provider}
                  </span>
                </div>
              </div>
            ) : (
              <p className="rounded border border-neutral-700 bg-fw-iron p-3 text-caption text-neutral-400">
                No chronicle root is registered yet. Register MIADI_CHRONICLE_ROOT with the
                Medicine Wheel to anchor this view.
              </p>
            )}

            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-section font-semibold text-neutral-100">
                  Registered episodes
                </h3>
                <span className="text-[11px] text-neutral-600">Medicine Wheel references</span>
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
                      <EpisodeBeatsSection
                        episodePath={getEpisodeInquiryPath(episode)}
                        section={projectBeatSection(
                          sharedBeats.resource,
                          getEpisodeInquiryPath(episode),
                        )}
                        nav={beatNav}
                        onRetry={sharedBeats.retry}
                      />
                      <EpisodePerspectiveSection
                        episodePath={getEpisodeInquiryPath(episode)}
                        perspectives={sharedPerspectives}
                      />
                      <EpisodeRecordingsSection
                        episodePath={getEpisodeInquiryPath(episode)}
                        section={projectRecordingSection(
                          sharedRecordings.byPath.get(getEpisodeInquiryPath(episode)),
                        )}
                        onRetry={() => sharedRecordings.retryPath(getEpisodeInquiryPath(episode))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-caption text-neutral-500">
                  No episodes registered yet. When Miadi registers a chronicle episode with the
                  Medicine Wheel, it appears here.
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-section font-semibold text-neutral-100">
                  Registered structured plans
                </h3>
                <span className="text-[11px] text-neutral-600">Medicine Wheel relations</span>
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
                <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-caption text-neutral-500">
                  No structured plans registered yet. Plans registered against an episode appear
                  here, with Miette&apos;s perspective beside them.
                </div>
              )}
            </div>

            <UnassociatedBeatsSection
              section={unassociatedBeats}
              nav={beatNav}
              onRetry={sharedBeats.retry}
            />

            {snapshot.stateMachines.length > 0 ? (
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-section font-semibold text-neutral-100">
                    Registered state machines
                  </h3>
                  <span className="text-[11px] text-neutral-600">Medicine Wheel references</span>
                </div>
                <div className="space-y-3">
                  {snapshot.stateMachines.map((machine) => (
                    <ReferenceCard key={machine.id} reference={machine} />
                  ))}
                </div>
              </div>
            ) : null}

            {snapshot.ignoredNodeCount > 0 ? (
              <p className="text-center text-[10px] text-neutral-700">
                {snapshot.ignoredNodeCount} unrelated or incompatible Medicine Wheel node(s) held outside this view.
              </p>
            ) : null}
          </div>
        ) : error ? (
          <ColdCard error={error} errorSource={errorSource} onRetry={refresh} />
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
            className="rounded border border-neutral-700 bg-fw-iron-2 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300 underline decoration-neutral-600 underline-offset-2 transition-colors hover:border-neutral-500 hover:text-neutral-100"
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
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
        Inquiry · <span className="font-mono tabular-nums">{section.data.count}</span>
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
      <summary className="cursor-pointer list-none">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm" aria-hidden="true">🌸</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-pink-200" title={perspective.title}>
            {perspective.title}
          </span>
          <span className="rounded border border-pink-900/60 px-1.5 py-0.5 text-[10px] text-pink-400 transition-colors group-hover:border-pink-700 group-open:hidden">
            Expand
          </span>
          <span className="hidden rounded border border-pink-900/60 px-1.5 py-0.5 text-[10px] text-pink-400 transition-colors group-hover:border-pink-700 group-open:inline">
            Collapse
          </span>
        </span>
        <span className="mt-1 block text-caption leading-relaxed text-neutral-400 group-open:hidden">
          {excerpt}
        </span>
      </summary>
      <div className="mt-2 border-t border-pink-900/30 pt-2">
        <Markdown>{perspective.bodyMarkdown}</Markdown>
      </div>
      {perspective.miaContext ? (
        // Mia's voice: the engineer's margin note — steel rule, raised iron,
        // mono label. Distinct from Miette's rose narrative around it.
        <aside className="mt-2.5 rounded border border-fw-border border-l-2 border-l-neutral-500 bg-fw-iron-2 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            <span aria-hidden="true">🧠</span> Mia · structural context
          </p>
          <Markdown className="mt-1.5">{perspective.miaContext}</Markdown>
        </aside>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-600">
        <span className="font-mono">{perspective.planFilename}</span>
        {perspective.generator ? <span>{perspective.generator}</span> : null}
        {timestamp ? <span className="font-mono tabular-nums">Updated {timestamp}</span> : null}
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
      <p className="text-[11px] uppercase tracking-wide text-pink-500/80">
        Miette perspective · <span className="font-mono tabular-nums">{section.data.count}</span>
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
      <p className="text-[11px] uppercase tracking-wide text-pink-500/80">
        Miette perspective on this plan
      </p>
      {matching.map((perspective) => (
        <PerspectiveRow key={perspective.id} perspective={perspective} />
      ))}
    </div>
  );
}

// ─── Connection as heat ──────────────────────────────────────────────────────
// The banner and the StatusBar ember speak one vocabulary (useMwHealth):
// glowing ember = the wheel answers, cooling iron = a failed refresh over the
// kept snapshot, cold iron = nothing to show at all (ColdCard below).

function ConnectionBanner({
  source,
  heat,
  error,
  onRetry,
}: {
  source: ChronicleSnapshot['source'];
  heat: MwHeat;
  error: string | null;
  onRetry: () => void;
}) {
  const presentation = MW_HEAT[heat];

  return (
    <div
      className={`rounded-lg border px-4 py-2.5 ${
        heat === 'ember' ? 'border-fw-border bg-fw-iron' : 'border-ember-cooling/40 bg-fw-iron'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <MwHeatDot heat={heat} />
        <span className="text-caption font-medium text-neutral-100">Medicine Wheel</span>
        <span className={`text-caption font-medium ${presentation.textClassName}`}>
          {presentation.label}
        </span>
        <code
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-500"
          title={source.baseUrl}
        >
          {source.baseUrl}
        </code>
        <span className="rounded border border-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
          {source.provider}
        </span>
      </div>
      {heat === 'cooling' ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ember-cooling/20 pt-2" role="alert">
          <p className="min-w-0 flex-1 text-caption text-ember-cooling">
            {MW_HEAT.cooling.description}
            {error ? <span className="ml-2 font-mono text-[11px] opacity-80">{error}</span> : null}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-ember-cooling/50 px-2.5 py-1 text-caption text-ember-cooling transition-colors hover:border-ember-cooling"
          >
            Reheat
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ColdCard({
  error,
  errorSource,
  onRetry,
}: {
  error: string;
  errorSource: ChronicleSourceInfo | null;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-fw-border bg-fw-iron p-5" role="alert">
      <div className="flex items-center gap-2.5">
        <MwHeatDot heat="cold" />
        <p className="text-body font-medium text-neutral-100">The Medicine Wheel is not answering</p>
      </div>
      <p className="mt-2 text-caption leading-relaxed text-neutral-400">
        The chronicle reads everything from the wheel, so there is nothing to show while it is
        cold. Start the wheel — or check MW_API_URL — then try again.
      </p>
      <p className="mt-3 font-mono text-[11px] text-neutral-500">{error}</p>
      {errorSource ? (
        <p className="mt-1 font-mono text-[11px] text-neutral-600">
          {errorSource.baseUrl
            ? `upstream: ${errorSource.service} · ${errorSource.baseUrl}`
            : `misconfigured: ${errorSource.configError ?? 'MW_API_URL is invalid'}`}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded border border-neutral-700 px-3 py-1.5 text-caption text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
      >
        Try again
      </button>
    </div>
  );
}

function InquiryWeaveMetric({
  resource,
  onRetry,
}: {
  resource: SharedResource<EpisodeInquiry>;
  onRetry: () => void;
}) {
  if (resource.status === 'error') {
    return (
      <Metric
        label="Inquiry weaves"
        value="—"
        title={resource.error ?? 'upstream unavailable'}
        caption={
          <button
            type="button"
            onClick={onRetry}
            className="text-ember-cooling underline decoration-ember-cooling/50 underline-offset-2 transition-colors hover:decoration-ember-cooling"
          >
            No answer — retry
          </button>
        }
      />
    );
  }
  return (
    <Metric
      label="Inquiry weaves"
      value={resource.status === 'loading' ? '…' : resource.data?.count ?? 0}
    />
  );
}

