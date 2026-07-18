// ─── Shared in-view fetch cache (miadisabelle/forgewright#7) ─────────────────
// One request per resource per view: the unfiltered inquiry projection is
// fetched once and filtered per episode, and plan perspectives are fetched
// once per DISTINCT episode path, shared between the episode-level and
// plan-level sections. Medicine Wheel 0.5.0 still requires a filter on
// /api/plan-perspectives (400 otherwise), so per-path is the batch unit there.
// These helpers are pure so the cache arithmetic is testable without React.

import {
  getEpisodeInquiryPath,
  type ChronicleArtifactReference,
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
