// ─── Deep-linkable chronicle navigation (spec 11.2) ──────────────────────────
// The shell keeps its single page; where a reader is standing becomes query
// state on that page:
//
//   /?view=chronicle&episode=<path>&cycle=<id>&direction=<east…north>&beat=<id>
//
// Pure arithmetic only — parsing, canonical rewrite, degradation, and
// deepest-parameter back-out, so browser back and the in-view back affordance
// agree. Selection and navigation are ForgeWright's to own; nothing here is
// ever written to the wheel.

import { isChronicleDirection, isEpisodePathParam, type ChronicleDirection, type NarrativeBeatRecord } from './client';

export const VIEW_TABS = ['state-machine', 'graph', 'chronicle'] as const;
export type ViewTab = (typeof VIEW_TABS)[number];

export const DEFAULT_VIEW: ViewTab = 'state-machine';

/** Ladder order — containment, deepest last. Back-out removes the last present. */
export const CHRONICLE_PARAMS = ['episode', 'cycle', 'direction', 'beat'] as const;
export type ChronicleParam = (typeof CHRONICLE_PARAMS)[number];

export interface ChronicleRoute {
  view: ViewTab;
  episode?: string;
  cycle?: string;
  direction?: ChronicleDirection;
  beat?: string;
}

/**
 * The unbound lane occupies the cycle rung so the ladder — and back-out — reads
 * the same whether a reader walked in through a cycle or through the beats no
 * cycle claims. `~` cannot begin a served cycle id, so nothing collides.
 */
export const UNBOUND_LANE = '~unbound';

export function isUnboundLane(cycleId?: string): boolean {
  return cycleId === UNBOUND_LANE;
}

function isViewTab(value: unknown): value is ViewTab {
  return typeof value === 'string' && (VIEW_TABS as readonly string[]).includes(value);
}

export function parseChronicleRoute(search: string): ChronicleRoute {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const view = params.get('view');
  const route: ChronicleRoute = { view: isViewTab(view) ? view : DEFAULT_VIEW };

  const episode = params.get('episode');
  const cycle = params.get('cycle');
  const direction = params.get('direction');
  const beat = params.get('beat');

  if (isEpisodePathParam(episode)) route.episode = episode;
  if (cycle) route.cycle = cycle;
  if (isChronicleDirection(direction)) route.direction = direction;
  if (beat) route.beat = beat;

  return route;
}

export function routeToSearch(route: ChronicleRoute): string {
  const params = new URLSearchParams();
  params.set('view', route.view);
  if (route.episode) params.set('episode', route.episode);
  if (route.cycle) params.set('cycle', route.cycle);
  if (route.direction) params.set('direction', route.direction);
  if (route.beat) params.set('beat', route.beat);
  return `?${params.toString()}`;
}

export function deepestParam(route: ChronicleRoute): ChronicleParam | null {
  for (let index = CHRONICLE_PARAMS.length - 1; index >= 0; index -= 1) {
    const param = CHRONICLE_PARAMS[index];
    if (route[param]) return param;
  }
  return null;
}

/** Back-out removes the deepest parameter — one rung of the ladder per step. */
export function backOutRoute(route: ChronicleRoute): ChronicleRoute {
  const deepest = deepestParam(route);
  if (!deepest) return { view: route.view };
  const next: ChronicleRoute = { ...route };
  delete next[deepest];
  return next;
}

/** Drop this parameter and everything it contains. */
export function truncateRouteAt(route: ChronicleRoute, param: ChronicleParam): ChronicleRoute {
  const next: ChronicleRoute = { ...route };
  const from = CHRONICLE_PARAMS.indexOf(param);
  for (const deeper of CHRONICLE_PARAMS.slice(from)) delete next[deeper];
  return next;
}

export function routesEqual(left: ChronicleRoute, right: ChronicleRoute): boolean {
  return (
    left.view === right.view
    && left.episode === right.episode
    && left.cycle === right.cycle
    && left.direction === right.direction
    && left.beat === right.beat
  );
}

export interface RouteContext {
  hasEpisode: (episodePath: string) => boolean;
  hasCycle: (cycleId: string) => boolean;
  getBeat: (beatId: string) => NarrativeBeatRecord | undefined;
  /**
   * The episode a cycle belongs to, or null when no registered episode claims
   * it. A cycle outside every registered episode is still walkable — hiding it
   * would be the one thing this spec refuses.
   */
  episodeForCycle: (cycleId: string) => string | null;
}

export interface ResolvedRoute {
  route: ChronicleRoute;
  /** Parameters that named something the wheel did not serve. */
  unresolved: ChronicleParam[];
}

/**
 * Canonicalize against what the wheel actually served: fill the ladder a beat
 * implies, and degrade an unresolvable parameter to its nearest resolvable
 * ancestor with an explicit note — never a blank view, never a silent drop to
 * the root.
 */
export function resolveChronicleRoute(
  route: ChronicleRoute,
  context: RouteContext,
): ResolvedRoute {
  const unresolved: ChronicleParam[] = [];
  let next: ChronicleRoute = { ...route };

  if (next.episode && !context.hasEpisode(next.episode)) {
    unresolved.push('episode');
    next = truncateRouteAt(next, 'episode');
  }

  if (next.cycle && !isUnboundLane(next.cycle) && !context.hasCycle(next.cycle)) {
    unresolved.push('cycle');
    next = truncateRouteAt(next, 'cycle');
  }

  if (next.beat) {
    const beat = context.getBeat(next.beat);
    if (!beat) {
      unresolved.push('beat');
      delete next.beat;
    } else {
      // A beat carries its own direction and membership: the canonical URL says
      // the full ladder even when the reader arrived with only `beat`.
      next.direction = beat.direction;
      if (beat.cycleId && context.hasCycle(beat.cycleId)) {
        next.cycle = beat.cycleId;
      } else if (!beat.cycleId) {
        // Never infer a cycle for an unbound beat — name the lane it is in.
        next.cycle = UNBOUND_LANE;
      }
    }
  }

  if (next.cycle && !isUnboundLane(next.cycle) && !next.episode) {
    const episodePath = context.episodeForCycle(next.cycle);
    if (episodePath) next.episode = episodePath;
  }

  return { route: next, unresolved };
}
