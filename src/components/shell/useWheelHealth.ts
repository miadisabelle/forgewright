'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Wheel health — the shell-wide liveness signal ───────────────────────────
// Polls /api/health and speaks the ember vocabulary: live (the wheel answers),
// degraded (cooling — one missed poll after being live, or an unhealthy
// dependency), down (cold). Interface is shared with the chronicle view; if a
// chronicle-owned hook lands behind the same shape, swapping is one import.

const POLL_INTERVAL_MS = 30_000;

export interface WheelCounts {
  episodes: number;
  structuredPlans: number;
  stateMachines: number;
}

export type WheelHealth =
  | { state: 'checking' }
  | {
      state: 'live';
      counts: WheelCounts;
      capabilities: Record<string, string>;
      checkedAt: string;
    }
  | { state: 'degraded'; detail: string; checkedAt: string }
  | { state: 'down'; detail: string; checkedAt: string };

interface HealthBody {
  status?: string;
  capabilities?: Record<string, string>;
  dependencies?: { medicineWheel?: { status?: string } };
  counts?: Partial<WheelCounts>;
  error?: string;
}

function toCounts(counts: Partial<WheelCounts> | undefined): WheelCounts {
  return {
    episodes: counts?.episodes ?? 0,
    structuredPlans: counts?.structuredPlans ?? 0,
    stateMachines: counts?.stateMachines ?? 0,
  };
}

export function useWheelHealth(): { health: WheelHealth; retry: () => void } {
  const [health, setHealth] = useState<WheelHealth>({ state: 'checking' });
  const wasLiveRef = useRef(false);
  const failuresRef = useRef(0);

  const check = useCallback(async (signal?: AbortSignal) => {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch('/api/health', { cache: 'no-store', signal });
      const body = (await response.json()) as HealthBody;

      if (response.ok && body.status === 'healthy') {
        const dependencyStatus = body.dependencies?.medicineWheel?.status;
        if (dependencyStatus && dependencyStatus !== 'healthy') {
          failuresRef.current = 0;
          setHealth({
            state: 'degraded',
            detail: `medicine-wheel reports ${dependencyStatus}`,
            checkedAt,
          });
          return;
        }
        wasLiveRef.current = true;
        failuresRef.current = 0;
        setHealth({
          state: 'live',
          counts: toCounts(body.counts),
          capabilities: body.capabilities ?? {},
          checkedAt,
        });
        return;
      }

      failuresRef.current += 1;
      const detail = body.error ?? 'Medicine wheel unavailable';
      if (wasLiveRef.current && failuresRef.current === 1) {
        setHealth({ state: 'degraded', detail: `${detail} — retrying`, checkedAt });
      } else {
        setHealth({ state: 'down', detail, checkedAt });
      }
    } catch (error) {
      if (signal?.aborted) return;
      failuresRef.current += 1;
      const detail = error instanceof Error ? error.message : 'Health check failed';
      if (wasLiveRef.current && failuresRef.current === 1) {
        setHealth({ state: 'degraded', detail: `${detail} — retrying`, checkedAt });
      } else {
        setHealth({ state: 'down', detail, checkedAt });
      }
    }
  }, []);

  const retry = useCallback(() => {
    setHealth({ state: 'checking' });
    void check();
  }, [check]);

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);

    const interval = setInterval(() => void check(controller.signal), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(controller.signal);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  return { health, retry };
}
