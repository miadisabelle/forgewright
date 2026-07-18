'use client';

// ─── Medicine Wheel health — the one heat vocabulary (mission fw-2607) ────────
// Heat IS liveness. An ember means the wheel answers; cooling iron means it
// answered before but the latest probe failed (degraded — anything shown is
// going stale); cold iron means it has never answered (down or misconfigured).
// The Chronicle connection banner and the shell StatusBar must speak this
// identically, so both read their truth from this module and nothing else
// in the shell is allowed to glow.
//
// Contract for consumers (announced in .fw/ui-mission-2607/handoffs.md):
//   const health = useMwHealth();          // polls GET /api/health
//   health.heat                            // 'ember' | 'cooling' | 'cold' | null (first probe in flight)
//   health.status                          // 'checking' | 'live' | 'degraded' | 'down'
//   MW_HEAT[heat]                          // shared label / description / classes
//   <MwHeatDot heat={health.heat} />       // the ember itself — identical everywhere
//
// The ember's pixels live in src/styles/globals.css (`.fw-ember-dot`,
// `.fw-cooling-dot`, ember breathing + reduced-motion guard) — this module
// only decides WHICH heat a surface wears, never how the ember glows.

import { useCallback, useEffect, useRef, useState } from 'react';

export type MwHeat = 'ember' | 'cooling' | 'cold';
export type MwHealthStatus = 'checking' | 'live' | 'degraded' | 'down';

export interface MwRegistryCounts {
  episodes: number;
  structuredPlans: number;
  stateMachines: number;
}

export interface MwHealthSnapshot {
  status: MwHealthStatus;
  /** Heat rendering of `status`; null only while the first probe is in flight. */
  heat: MwHeat | null;
  /** Upstream Medicine Wheel origin, kept from the last probe that reported one. */
  baseUrl: string | null;
  /** Chronicle registry counts from the last LIVE probe; null until one succeeds. */
  counts: MwRegistryCounts | null;
  /** What the failed probe said; null while checking or live. */
  error: string | null;
  /** ISO timestamp of the last completed probe. */
  checkedAt: string | null;
}

export interface MwHeatPresentation {
  /** One-word state name, sentence case. */
  label: string;
  /** Full sentence for banners and tooltips: what happened, in end-user vocabulary. */
  description: string;
  dotClassName: string;
  textClassName: string;
  /** True only for ember — the only state allowed to glow. */
  glows: boolean;
}

export const MW_HEAT: Record<MwHeat, MwHeatPresentation> = {
  ember: {
    label: 'Live',
    description: 'The Medicine Wheel answers.',
    dotClassName: 'fw-ember-dot',
    textClassName: 'text-ember',
    glows: true,
  },
  cooling: {
    label: 'Cooling',
    description: 'The Medicine Wheel stopped answering. What you see is its last answer.',
    dotClassName: 'fw-cooling-dot',
    textClassName: 'text-ember-cooling',
    glows: false,
  },
  cold: {
    label: 'Cold',
    description: 'The Medicine Wheel is not answering.',
    dotClassName: 'bg-neutral-600',
    textClassName: 'text-neutral-400',
    glows: false,
  },
};

// ─── Pure derivations (unit-tested without React) ─────────────────────────────

/** A failing probe cools iron that was hot; iron that never lit stays cold. */
export function deriveStatus(probeOk: boolean, everLive: boolean): MwHealthStatus {
  if (probeOk) return 'live';
  return everLive ? 'degraded' : 'down';
}

export function heatForStatus(status: MwHealthStatus): MwHeat | null {
  switch (status) {
    case 'live':
      return 'ember';
    case 'degraded':
      return 'cooling';
    case 'down':
      return 'cold';
    case 'checking':
      return null;
  }
}

interface HealthBody {
  status?: unknown;
  error?: unknown;
  dependencies?: { medicineWheel?: { baseUrl?: unknown } };
  counts?: { episodes?: unknown; structuredPlans?: unknown; stateMachines?: unknown };
}

export interface ProbeReading {
  ok: boolean;
  baseUrl: string | null;
  counts: MwRegistryCounts | null;
  error: string | null;
}

function readCounts(body: HealthBody | null): MwRegistryCounts | null {
  const counts = body?.counts;
  if (
    typeof counts?.episodes !== 'number' ||
    typeof counts.structuredPlans !== 'number' ||
    typeof counts.stateMachines !== 'number'
  ) {
    return null;
  }
  return {
    episodes: counts.episodes,
    structuredPlans: counts.structuredPlans,
    stateMachines: counts.stateMachines,
  };
}

/** Read one GET /api/health response body into a probe verdict. */
export function readProbe(httpOk: boolean, body: HealthBody | null): ProbeReading {
  const baseUrl =
    typeof body?.dependencies?.medicineWheel?.baseUrl === 'string'
      ? body.dependencies.medicineWheel.baseUrl
      : null;
  if (httpOk && body?.status === 'healthy') {
    return { ok: true, baseUrl, counts: readCounts(body), error: null };
  }
  const error =
    typeof body?.error === 'string' && body.error.length > 0
      ? body.error
      : 'health check failed';
  return { ok: false, baseUrl, counts: null, error };
}

// ─── The dot ──────────────────────────────────────────────────────────────────

/**
 * The ember itself. `.fw-ember-dot` breathes and glows (globals.css owns the
 * animation and its reduced-motion guard — static dot, still ember-colored);
 * cooling and cold never glow. `heat === null` renders a quiet checking dot.
 */
export function MwHeatDot({ heat, className = 'h-2 w-2' }: { heat: MwHeat | null; className?: string }) {
  const dotClassName = heat === null ? 'bg-neutral-700' : MW_HEAT[heat].dotClassName;
  return (
    <span aria-hidden="true" className={`inline-block rounded-full ${dotClassName} ${className}`} />
  );
}

// ─── The hook ─────────────────────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 30_000;

export interface UseMwHealthOptions {
  /** Probe cadence; the hook skips ticks while the document is hidden. */
  intervalMs?: number;
}

export function useMwHealth(options: UseMwHealthOptions = {}): MwHealthSnapshot & {
  refresh: () => void;
} {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const [snapshot, setSnapshot] = useState<MwHealthSnapshot>({
    status: 'checking',
    heat: null,
    baseUrl: null,
    counts: null,
    error: null,
    checkedAt: null,
  });
  const everLiveRef = useRef(false);
  const [probeKey, setProbeKey] = useState(0);
  const refresh = useCallback(() => setProbeKey((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    async function probe() {
      let reading: ProbeReading;
      try {
        const response = await fetch('/api/health', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as HealthBody | null;
        reading = readProbe(response.ok, body);
      } catch (probeError) {
        if (controller.signal.aborted) return;
        reading = {
          ok: false,
          baseUrl: null,
          counts: null,
          error: probeError instanceof Error ? probeError.message : 'health check failed',
        };
      }
      if (controller.signal.aborted) return;

      if (reading.ok) everLiveRef.current = true;
      const status = deriveStatus(reading.ok, everLiveRef.current);
      setSnapshot((previous) => ({
        status,
        heat: heatForStatus(status),
        baseUrl: reading.baseUrl ?? previous.baseUrl,
        // Cooling keeps showing the last live counts — that IS the stale answer.
        counts: reading.counts ?? previous.counts,
        error: reading.error,
        checkedAt: new Date().toISOString(),
      }));
    }

    void probe();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void probe();
    }, intervalMs);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [intervalMs, probeKey]);

  return { ...snapshot, refresh };
}
