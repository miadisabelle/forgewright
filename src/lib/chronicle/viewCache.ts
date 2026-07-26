// ─── Shared in-view fetch cache (miadisabelle/forgewright#7) ─────────────────
// One request per resource per view: the unfiltered inquiry projection is
// fetched once and filtered per episode, and plan perspectives are fetched
// once per DISTINCT episode path, shared between the episode-level and
// plan-level sections. Medicine Wheel 0.5.0 still requires a filter on
// /api/plan-perspectives (400 otherwise), so per-path is the batch unit there.
// These helpers are pure so the cache arithmetic is testable without React.

import {
  beatHasNoEpisode,
  beatMatchesEpisode,
  cycleMatchesEpisode,
  getEpisodeInquiryPath,
  type ChronicleArtifactReference,
  type ChronicleBeats,
  type EpisodeInquiry,
  type PlanPerspectives,
} from './client';

export type SharedResourceStatus = 'loading' | 'error' | 'ready';

export interface SharedResource<T> {
  status: SharedResourceStatus;
  data: T | null;
  error: string | null;
}

export function loadingResource<T>(): SharedResource<T> {
  return { status: 'loading', data: null, error: null };
}

export function readyResource<T>(data: T): SharedResource<T> {
  return { status: 'ready', data, error: null };
}

export function errorResource<T>(message: string): SharedResource<T> {
  return { status: 'error', data: null, error: message };
}

/** Distinct inquiry paths for the episode cards a snapshot renders, in render order. */
export function collectDistinctEpisodePaths(
  episodes: readonly ChronicleArtifactReference[],
): string[] {
  const seen = new Set<string>();
  for (const episode of episodes) {
    seen.add(getEpisodeInquiryPath(episode));
  }
  return [...seen];
}

/** Project the one unfiltered inquiry fetch down to a single episode's weaves. */
export function filterInquiryForEpisode(
  all: EpisodeInquiry,
  episodePath: string,
): EpisodeInquiry {
  const inquiries = all.inquiries.filter((relation) => relation.episodePath === episodePath);
  return { episodePath, count: inquiries.length, inquiries };
}

/** Paths not yet requested this generation — the dedup that collapses N+1. */
export function pathsNeedingFetch(
  requested: ReadonlySet<string>,
  paths: readonly string[],
): string[] {
  const missing: string[] = [];
  for (const path of paths) {
    if (!requested.has(path) && !missing.includes(path)) missing.push(path);
  }
  return missing;
}

/** Immutable Map update so a cache entry change propagates through React state. */
export function withResource<T>(
  cache: ReadonlyMap<string, SharedResource<T>>,
  key: string,
  entry: SharedResource<T>,
): Map<string, SharedResource<T>> {
  const next = new Map(cache);
  next.set(key, entry);
  return next;
}

// ─── Per-section lifecycle projections ───────────────────────────────────────
// Every nested Chronicle section still moves through loading|error|empty|ready.
// Empty (count 0) stays quiet; error surfaces with its own retry, so an
// unreachable upstream never masquerades as "nothing registered".

export type SectionStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface SectionProjection<T> {
  status: SectionStatus;
  data: T | null;
  error: string | null;
}

/** Per-episode inquiry lifecycle derived from the ONE shared unfiltered fetch. */
export function projectInquirySection(
  resource: SharedResource<EpisodeInquiry>,
  episodePath: string,
): SectionProjection<EpisodeInquiry> {
  if (resource.status === 'loading') return { status: 'loading', data: null, error: null };
  if (resource.status === 'error' || !resource.data) {
    return { status: 'error', data: null, error: resource.error ?? 'upstream unavailable' };
  }
  const filtered = filterInquiryForEpisode(resource.data, episodePath);
  return { status: filtered.count === 0 ? 'empty' : 'ready', data: filtered, error: null };
}

// ─── Narrative beats share the same one-fetch discipline (spec 11, A3) ───────
// The wheel serves no beat filters yet, so ONE unfiltered probe feeds the
// metric tile, every episode's beat section, the unbound lane, and every arc.
// Projection is pure filtering over that single answer.

function projectBeats(
  all: ChronicleBeats,
  keep: (beat: ChronicleBeats['beats'][number]) => boolean,
  keepCycle: (cycle: ChronicleBeats['cycles'][number], beats: ChronicleBeats['beats']) => boolean,
): ChronicleBeats {
  const beats = all.beats.filter(keep);
  const kept = new Set(beats.map((beat) => beat.id));
  const projected: ChronicleBeats = {
    count: beats.length,
    // droppedCount belongs to the whole answer, not to one episode's slice.
    droppedCount: all.droppedCount,
    beats,
    cycles: all.cycles.filter((cycle) => keepCycle(cycle, beats)),
    discrepancies: all.discrepancies.filter((entry) => kept.has(entry.beatId)),
  };
  if (all.cyclesUnavailable) projected.cyclesUnavailable = all.cyclesUnavailable;
  return projected;
}

/** Project the one unfiltered beat fetch down to a single episode. */
export function filterBeatsForEpisode(all: ChronicleBeats, episodePath: string): ChronicleBeats {
  return projectBeats(
    all,
    (beat) => beatMatchesEpisode(beat, episodePath),
    (cycle, beats) => cycleMatchesEpisode(cycle, episodePath, beats),
  );
}

/**
 * Beats no registered episode claims, and the cycles no registered episode
 * claims either. They are shown in their own lane rather than filtered into
 * invisibility — the wheel may hold a beat whose episode was never registered
 * as a reference, and a legacy cycle with zero members is still a cycle
 * (kin: jgwill/medicine-wheel#83). Neither absence is a reason to disappear.
 */
export function filterBeatsOutsideEpisodes(
  all: ChronicleBeats,
  episodePaths: readonly string[],
): ChronicleBeats {
  return projectBeats(
    all,
    (beat) => beatHasNoEpisode(beat, episodePaths),
    (cycle) => !episodePaths.some((path) => cycleMatchesEpisode(cycle, path, all.beats)),
  );
}

/** Nothing to show at all — no beats AND no cycle to open. */
function isSilent(projected: ChronicleBeats): boolean {
  return projected.count === 0 && projected.cycles.length === 0;
}

/** Per-episode beat lifecycle derived from the ONE shared unfiltered fetch. */
export function projectBeatSection(
  resource: SharedResource<ChronicleBeats>,
  episodePath: string,
): SectionProjection<ChronicleBeats> {
  if (resource.status === 'loading') return { status: 'loading', data: null, error: null };
  if (resource.status === 'error' || !resource.data) {
    return { status: 'error', data: null, error: resource.error ?? 'upstream unavailable' };
  }
  const filtered = filterBeatsForEpisode(resource.data, episodePath);
  return { status: isSilent(filtered) ? 'empty' : 'ready', data: filtered, error: null };
}

/** The unclaimed lane's lifecycle, on the same rule as an episode's. */
export function projectUnclaimedBeatSection(
  resource: SharedResource<ChronicleBeats>,
  episodePaths: readonly string[],
): SectionProjection<ChronicleBeats> {
  if (resource.status === 'loading') return { status: 'loading', data: null, error: null };
  if (resource.status === 'error' || !resource.data) {
    return { status: 'error', data: null, error: resource.error ?? 'upstream unavailable' };
  }
  const outside = filterBeatsOutsideEpisodes(resource.data, episodePaths);
  return { status: isSilent(outside) ? 'empty' : 'ready', data: outside, error: null };
}

/** Per-section perspectives lifecycle from the shared per-path cache. */
export function projectPerspectiveSection(
  resource: SharedResource<PlanPerspectives> | undefined,
): SectionProjection<PlanPerspectives> {
  // A path the effect has not requested yet is loading, never silently empty.
  if (!resource || resource.status === 'loading') {
    return { status: 'loading', data: null, error: null };
  }
  if (resource.status === 'error' || !resource.data) {
    return { status: 'error', data: null, error: resource.error ?? 'upstream unavailable' };
  }
  return {
    status: resource.data.count === 0 ? 'empty' : 'ready',
    data: resource.data,
    error: null,
  };
}
