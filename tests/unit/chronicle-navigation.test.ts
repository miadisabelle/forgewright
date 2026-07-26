// ─── Deep-linkable chronicle navigation (spec 11.2) ──────────────────────────
// The ladder is a strict containment: episode → cycle → direction → beat.
// Back-out removes the deepest rung so browser back and the in-view back
// affordance agree, and an unresolvable parameter degrades to its nearest
// resolvable ancestor with a note — never a blank view, never a silent root.

import { describe, expect, it } from 'vitest';
import {
  backOutRoute,
  deepestParam,
  parseChronicleRoute,
  resolveChronicleRoute,
  routeToSearch,
  routesEqual,
  truncateRouteAt,
  UNBOUND_LANE,
  type ChronicleRoute,
  type RouteContext,
} from '../../src/lib/chronicle/navigation';
import type { NarrativeBeatRecord } from '../../src/lib/chronicle/client';

const EPISODE = '2026-07-25-episode-299-isolation-and-addressability';
const CYCLE_ID = 'cycle-ep299-isolation-addressability';

function record(overrides: Partial<NarrativeBeatRecord> = {}): NarrativeBeatRecord {
  return {
    id: 'beat:north:299:naming',
    direction: 'north',
    act: 4,
    title: 'The framework named its own packages',
    timestamp: '2026-07-26T05:07:09.955Z',
    ceremonies: [],
    learnings: [],
    relationsHonored: [],
    subBeatIds: [],
    cycleId: CYCLE_ID,
    ...overrides,
  };
}

function context(beats: NarrativeBeatRecord[] = [record()]): RouteContext {
  const byId = new Map(beats.map((beat) => [beat.id, beat]));
  return {
    hasEpisode: (path) => path === EPISODE,
    hasCycle: (cycleId) => cycleId === CYCLE_ID,
    getBeat: (beatId) => byId.get(beatId),
    episodeForCycle: (cycleId) => (cycleId === CYCLE_ID ? EPISODE : null),
  };
}

describe('parseChronicleRoute', () => {
  it('reads the ladder and defaults the view', () => {
    const route = parseChronicleRoute(
      `?view=chronicle&episode=${EPISODE}&cycle=${CYCLE_ID}&direction=north&beat=beat:north:299:naming`,
    );

    expect(route).toEqual({
      view: 'chronicle',
      episode: EPISODE,
      cycle: CYCLE_ID,
      direction: 'north',
      beat: 'beat:north:299:naming',
    });
    expect(parseChronicleRoute('').view).toBe('state-machine');
  });

  it('drops a value that could never be one — a bad view, direction, or path', () => {
    const route = parseChronicleRoute('?view=nowhere&direction=northeast&episode=/etc/passwd');

    expect(route).toEqual({ view: 'state-machine' });
  });

  it('round-trips through the search string', () => {
    const route: ChronicleRoute = { view: 'chronicle', episode: EPISODE, cycle: CYCLE_ID };

    expect(parseChronicleRoute(routeToSearch(route))).toEqual(route);
  });
});

describe('back-out', () => {
  it('removes exactly one rung, deepest first', () => {
    let route: ChronicleRoute = {
      view: 'chronicle',
      episode: EPISODE,
      cycle: CYCLE_ID,
      direction: 'north',
      beat: 'beat:north:299:naming',
    };

    expect(deepestParam(route)).toBe('beat');
    route = backOutRoute(route);
    expect(route.beat).toBeUndefined();
    route = backOutRoute(route);
    expect(route.direction).toBeUndefined();
    route = backOutRoute(route);
    expect(route.cycle).toBeUndefined();
    route = backOutRoute(route);
    expect(route).toEqual({ view: 'chronicle' });
    expect(backOutRoute(route)).toEqual({ view: 'chronicle' });
  });

  it('truncates a rung together with everything it contains', () => {
    const route: ChronicleRoute = {
      view: 'chronicle',
      episode: EPISODE,
      cycle: CYCLE_ID,
      direction: 'north',
      beat: 'beat:north:299:naming',
    };

    expect(truncateRouteAt(route, 'cycle')).toEqual({ view: 'chronicle', episode: EPISODE });
  });
});

describe('resolveChronicleRoute', () => {
  it('resolves a beat into the canonical full ladder', () => {
    const { route, unresolved } = resolveChronicleRoute(
      { view: 'chronicle', beat: 'beat:north:299:naming' },
      context(),
    );

    expect(unresolved).toEqual([]);
    expect(route).toEqual({
      view: 'chronicle',
      episode: EPISODE,
      cycle: CYCLE_ID,
      direction: 'north',
      beat: 'beat:north:299:naming',
    });
  });

  it('corrects a direction that contradicts the beat it names', () => {
    const { route } = resolveChronicleRoute(
      { view: 'chronicle', direction: 'east', beat: 'beat:north:299:naming' },
      context(),
    );

    expect(route.direction).toBe('north');
  });

  it('names an unbound beat its lane instead of inferring a cycle for it', () => {
    const unbound = record({ id: 'beat:west:legacy', direction: 'west', cycleId: undefined });
    const { route, unresolved } = resolveChronicleRoute(
      { view: 'chronicle', beat: 'beat:west:legacy' },
      context([unbound]),
    );

    expect(unresolved).toEqual([]);
    expect(route.cycle).toBe(UNBOUND_LANE);
    expect(route.direction).toBe('west');
    expect(route.episode).toBeUndefined();
  });

  it('degrades an unresolvable episode to the root and says so', () => {
    const { route, unresolved } = resolveChronicleRoute(
      { view: 'chronicle', episode: 'never-registered', cycle: CYCLE_ID, direction: 'north' },
      context(),
    );

    expect(unresolved).toEqual(['episode']);
    expect(route).toEqual({ view: 'chronicle' });
  });

  it('degrades an unresolvable cycle to its episode', () => {
    const { route, unresolved } = resolveChronicleRoute(
      { view: 'chronicle', episode: EPISODE, cycle: 'cycle-gone', beat: 'beat:north:299:naming' },
      context(),
    );

    expect(unresolved).toEqual(['cycle']);
    expect(route).toEqual({ view: 'chronicle', episode: EPISODE });
  });

  it('degrades an unresolvable beat while keeping the arc it was opened from', () => {
    const { route, unresolved } = resolveChronicleRoute(
      { view: 'chronicle', episode: EPISODE, cycle: CYCLE_ID, direction: 'north', beat: 'beat:gone' },
      context(),
    );

    expect(unresolved).toEqual(['beat']);
    expect(route).toEqual({
      view: 'chronicle',
      episode: EPISODE,
      cycle: CYCLE_ID,
      direction: 'north',
    });
  });

  it('keeps a cycle no registered episode claims walkable', () => {
    const anonymous: RouteContext = {
      ...context(),
      hasCycle: () => true,
      episodeForCycle: () => null,
    };

    const { route, unresolved } = resolveChronicleRoute(
      { view: 'chronicle', cycle: 'cycle-unregistered' },
      anonymous,
    );

    expect(unresolved).toEqual([]);
    expect(route).toEqual({ view: 'chronicle', cycle: 'cycle-unregistered' });
  });

  it('leaves an already-canonical route untouched', () => {
    const canonical: ChronicleRoute = {
      view: 'chronicle',
      episode: EPISODE,
      cycle: CYCLE_ID,
      direction: 'north',
      beat: 'beat:north:299:naming',
    };

    expect(routesEqual(resolveChronicleRoute(canonical, context()).route, canonical)).toBe(true);
  });
});
