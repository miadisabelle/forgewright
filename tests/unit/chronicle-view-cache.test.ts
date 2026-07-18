import { describe, expect, it, vi } from 'vitest';
import {
  findParentEpisode,
  getEpisodeInquiryPath,
  type ChronicleArtifactReference,
  type EpisodeInquiry,
  type PlanPerspectives,
} from '../../src/lib/chronicle/client';
import {
  collectDistinctEpisodePaths,
  errorResource,
  filterInquiryForEpisode,
  loadingResource,
  pathsNeedingFetch,
  projectInquirySection,
  projectPerspectiveSection,
  readyResource,
  withResource,
} from '../../src/lib/chronicle/viewCache';

function episodeRef(id: string, path: string): ChronicleArtifactReference {
  return {
    id,
    name: `Episode ${id}`,
    kind: 'chronicle_episode',
    relativePath: `${path}/episode.yaml`,
  };
}

function planRef(id: string, parentId: string): ChronicleArtifactReference {
  return {
    id,
    name: `Plan ${id}`,
    kind: 'structured_plan',
    relativePath: `plans/${id}.md`,
    parentId,
  };
}

const EPISODES = [
  episodeRef('ep-140', '2026-07-17-episode-140'),
  episodeRef('ep-139', '2026-07-16-episode-139'),
  episodeRef('ep-138', '2026-07-15-episode-138'),
];

const PLANS = [
  planRef('plan-a', 'ep-140'),
  planRef('plan-b', 'ep-140'),
  planRef('plan-c', 'ep-138'),
];

describe('collectDistinctEpisodePaths', () => {
  it('strips episode.yaml and keeps render order', () => {
    expect(collectDistinctEpisodePaths(EPISODES)).toEqual([
      '2026-07-17-episode-140',
      '2026-07-16-episode-139',
      '2026-07-15-episode-138',
    ]);
  });

  it('dedups two episode references sharing an inquiry path', () => {
    const doubled = [...EPISODES, episodeRef('ep-140-dup', '2026-07-17-episode-140')];
    expect(collectDistinctEpisodePaths(doubled)).toHaveLength(3);
  });
});

describe('filterInquiryForEpisode', () => {
  const unfiltered: EpisodeInquiry = {
    episodePath: null,
    count: 3,
    inquiries: [
      { artefact: 'a', syncState: 'in-sync', episodePath: '2026-07-17-episode-140' },
      { artefact: 'b', syncState: 'stale', episodePath: '2026-07-16-episode-139' },
      { artefact: 'c', syncState: 'never-synced', episodePath: '2026-07-17-episode-140' },
    ],
  };

  it('projects the shared fetch down to one episode with a recomputed count', () => {
    const filtered = filterInquiryForEpisode(unfiltered, '2026-07-17-episode-140');
    expect(filtered.episodePath).toBe('2026-07-17-episode-140');
    expect(filtered.count).toBe(2);
    expect(filtered.inquiries.map((relation) => relation.artefact)).toEqual(['a', 'c']);
  });

  it('excludes relations that carry no episode identity (cannot be attributed)', () => {
    const withOrphan: EpisodeInquiry = {
      episodePath: null,
      count: 1,
      inquiries: [{ artefact: 'orphan', syncState: 'in-sync' }],
    };
    expect(filterInquiryForEpisode(withOrphan, '2026-07-17-episode-140').count).toBe(0);
  });
});

describe('pathsNeedingFetch', () => {
  it('returns only unrequested paths, deduped, preserving order', () => {
    const requested = new Set(['b']);
    expect(pathsNeedingFetch(requested, ['a', 'b', 'c', 'a'])).toEqual(['a', 'c']);
  });

  it('returns nothing once every path is requested', () => {
    expect(pathsNeedingFetch(new Set(['a', 'b']), ['a', 'b'])).toEqual([]);
  });
});

describe('withResource', () => {
  it('never mutates the previous cache generation', () => {
    const before = new Map([['a', loadingResource<PlanPerspectives>()]]);
    const after = withResource(before, 'a', readyResource({ count: 0, perspectives: [] }));
    expect(before.get('a')?.status).toBe('loading');
    expect(after.get('a')?.status).toBe('ready');
  });
});

describe('projectInquirySection', () => {
  const shared = readyResource<EpisodeInquiry>({
    episodePath: null,
    count: 1,
    inquiries: [{ artefact: 'a', syncState: 'in-sync', episodePath: 'ep-path' }],
  });

  it('passes loading and error through untouched', () => {
    expect(projectInquirySection(loadingResource(), 'ep-path').status).toBe('loading');
    const failed = projectInquirySection(errorResource('boom'), 'ep-path');
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('boom');
  });

  it('filters ready data per episode: matches are ready, no matches are empty', () => {
    const ready = projectInquirySection(shared, 'ep-path');
    expect(ready.status).toBe('ready');
    expect(ready.data?.count).toBe(1);
    expect(projectInquirySection(shared, 'other-path').status).toBe('empty');
  });
});

describe('projectPerspectiveSection', () => {
  it('treats a not-yet-requested path as loading, never silently empty', () => {
    expect(projectPerspectiveSection(undefined).status).toBe('loading');
  });

  it('maps error, empty, and ready from the shared resource', () => {
    expect(projectPerspectiveSection(errorResource('down')).error).toBe('down');
    expect(
      projectPerspectiveSection(readyResource({ count: 0, perspectives: [] })).status,
    ).toBe('empty');
    const ready = projectPerspectiveSection(
      readyResource({
        count: 1,
        perspectives: [
          {
            id: 'plan-perspective:x',
            sessionId: 's',
            planFilename: 'p.md',
            title: 't',
            bodyMarkdown: 'b',
            episodePaths: [],
          },
        ],
      }),
    );
    expect(ready.status).toBe('ready');
    expect(ready.data?.count).toBe(1);
  });
});

// ─── Request counts: one request per resource per view ───────────────────────
// Drives a mocked fetch through the exact sequence the view issues — one
// snapshot, one unfiltered inquiry, then the shared per-path perspective cache
// visited in card order (episode sections first, then plan sections) — and
// compares against the per-card N+1 the previous ChronicleView produced.

function simulateSharedView(
  episodes: readonly ChronicleArtifactReference[],
  plans: readonly ChronicleArtifactReference[],
  fetchImpl: (url: string) => void,
): void {
  fetchImpl('/api/chronicle');
  fetchImpl('/api/chronicle/inquiry'); // metric + every episode inquiry section

  const requested = new Set<string>();
  const visit = (paths: readonly string[]) => {
    for (const path of pathsNeedingFetch(requested, paths)) {
      requested.add(path);
      fetchImpl(`/api/chronicle/perspectives?episode_path=${encodeURIComponent(path)}`);
    }
  };

  // Episode cards render first and warm the cache…
  visit(collectDistinctEpisodePaths(episodes));
  // …then every plan card reads its parent episode's entry from the same cache.
  for (const plan of plans) {
    const parent = findParentEpisode(plan, episodes);
    if (parent) visit([getEpisodeInquiryPath(parent)]);
  }
}

function simulateLegacyView(
  episodes: readonly ChronicleArtifactReference[],
  plans: readonly ChronicleArtifactReference[],
  fetchImpl: (url: string) => void,
): void {
  fetchImpl('/api/chronicle');
  fetchImpl('/api/chronicle/inquiry'); // metric tile
  for (const episode of episodes) {
    const path = getEpisodeInquiryPath(episode);
    fetchImpl(`/api/chronicle/inquiry?episode_path=${encodeURIComponent(path)}`);
    fetchImpl(`/api/chronicle/perspectives?episode_path=${encodeURIComponent(path)}`);
  }
  for (const plan of plans) {
    const parent = findParentEpisode(plan, episodes);
    if (parent) {
      const path = getEpisodeInquiryPath(parent);
      fetchImpl(`/api/chronicle/perspectives?episode_path=${encodeURIComponent(path)}`);
    }
  }
}

describe('request counts per view', () => {
  it('3 episodes + 3 plans: 11 legacy requests collapse to 5', () => {
    const legacy = vi.fn();
    simulateLegacyView(EPISODES, PLANS, legacy);
    // 1 snapshot + 1 metric + 3 per-episode inquiry + 3 per-episode perspectives
    // + 3 per-plan perspectives = 11
    expect(legacy).toHaveBeenCalledTimes(11);

    const shared = vi.fn();
    simulateSharedView(EPISODES, PLANS, shared);
    // 1 snapshot + 1 inquiry + 3 distinct episode paths = 5
    expect(shared).toHaveBeenCalledTimes(5);
    const urls = shared.mock.calls.map((call) => String(call[0]));
    expect(new Set(urls).size).toBe(urls.length); // every request is distinct
  });

  it('grows by episodes only, not by cards: 112 episodes + 40 plans → 114, not 266', () => {
    const manyEpisodes = Array.from({ length: 112 }, (_, index) =>
      episodeRef(`ep-${index}`, `episode-${index}`),
    );
    const manyPlans = Array.from({ length: 40 }, (_, index) =>
      planRef(`plan-${index}`, `ep-${index % 112}`),
    );

    const legacy = vi.fn();
    simulateLegacyView(manyEpisodes, manyPlans, legacy);
    expect(legacy).toHaveBeenCalledTimes(1 + 1 + 112 + 112 + 40); // 266

    const shared = vi.fn();
    simulateSharedView(manyEpisodes, manyPlans, shared);
    expect(shared).toHaveBeenCalledTimes(1 + 1 + 112); // 114
  });

  it('reloadKey invalidation starts a fresh generation that refetches shared resources', () => {
    const fetchImpl = vi.fn();
    simulateSharedView(EPISODES, PLANS, fetchImpl);
    // Refresh = new generation with an empty requested set: same per-view count again.
    simulateSharedView(EPISODES, PLANS, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });
});
