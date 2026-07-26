'use client';

// ─── The route as one shared reading (spec 11.2) ─────────────────────────────
// The Toolbar and the Chronicle both stand on the same rung, so the query
// string itself is the single source rather than two copies of React state.
// history.pushState + popstate keeps the browser's back button and the in-view
// back affordance in agreement: both remove exactly one rung.

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  backOutRoute,
  parseChronicleRoute,
  routeToSearch,
  routesEqual,
  type ChronicleRoute,
} from './navigation';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', emit);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', emit);
  };
}

function getSnapshot(): string {
  return window.location.search;
}

function getServerSnapshot(): string {
  return '';
}

function writeRoute(route: ChronicleRoute, replace: boolean): void {
  const url = `${window.location.pathname}${routeToSearch(route)}${window.location.hash}`;
  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }
  emit();
}

export interface ChronicleRouteHandle {
  route: ChronicleRoute;
  /** New history entry — the reader moved. */
  navigate: (next: ChronicleRoute) => void;
  /** Same history entry — a canonical rewrite the reader did not ask for. */
  replace: (next: ChronicleRoute) => void;
  /** Remove the deepest parameter, agreeing with browser back. */
  back: () => void;
}

export function useChronicleRoute(): ChronicleRouteHandle {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const route = useMemo(() => parseChronicleRoute(search), [search]);

  const navigate = useCallback((next: ChronicleRoute) => {
    if (routesEqual(parseChronicleRoute(window.location.search), next)) return;
    writeRoute(next, false);
  }, []);

  const replace = useCallback((next: ChronicleRoute) => {
    if (routesEqual(parseChronicleRoute(window.location.search), next)) return;
    writeRoute(next, true);
  }, []);

  const back = useCallback(() => {
    writeRoute(backOutRoute(parseChronicleRoute(window.location.search)), false);
  }, []);

  return { route, navigate, replace, back };
}
