'use client';

import { useSpiralStore } from '@forgewright/stores';
import { DIRECTIONS, type DirectionName } from '@forgewright/lib/types';
import { useWheelHealth, type WheelHealth } from './useWheelHealth';

// ─── Direction ink (AA on coal) ──────────────────────────────────────────────

const DIRECTION_INK: Record<DirectionName, string> = {
  east: 'text-forge-east-ink',
  south: 'text-forge-south-ink',
  west: 'text-forge-west-ink',
  north: 'text-forge-north-ink',
};

// ─── Wheel ember — one liveness vocabulary shell-wide ────────────────────────

function WheelStatus({ health, retry }: { health: WheelHealth; retry: () => void }) {
  switch (health.state) {
    case 'checking':
      return (
        <span className="flex items-center gap-1.5 text-neutral-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-600" />
          Wheel: checking…
        </span>
      );
    case 'live':
      return (
        <span
          className="flex items-center gap-1.5 text-ember"
          title={`Medicine wheel answers · ${health.counts.episodes} episodes · ${health.counts.structuredPlans} plans · ${health.counts.stateMachines} machines`}
        >
          <span className="fw-ember-dot inline-block h-1.5 w-1.5 rounded-full" />
          Wheel: live
        </span>
      );
    case 'degraded':
      return (
        <span className="flex items-center gap-1.5 text-ember-cooling" title={health.detail}>
          <span className="fw-cooling-dot inline-block h-1.5 w-1.5 rounded-full" />
          Wheel: cooling
        </span>
      );
    case 'down':
      return (
        <span className="flex items-center gap-1.5 text-neutral-400" title={health.detail}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-600" />
          Wheel: cold — start medicine-wheel at :3940
          <button
            onClick={retry}
            className="rounded border border-neutral-700 px-1.5 py-px text-neutral-300 transition-colors duration-(--fw-dur-fast) hover:border-neutral-600 hover:bg-neutral-800 hover:text-neutral-100"
          >
            Retry
          </button>
        </span>
      );
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatusBar() {
  const currentDirection = useSpiralStore((s) => s.currentDirection);
  const directionInfo = DIRECTIONS[currentDirection];
  const { health, retry } = useWheelHealth();

  const checkedAt =
    health.state === 'checking'
      ? '—'
      : new Date(health.checkedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

  const mcpCapability = health.state === 'live' ? health.capabilities.mcpHttp : undefined;

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-neutral-800 bg-neutral-950 px-4 text-caption">
      {/* Left: direction + Wilson (honest) */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span aria-hidden>{directionInfo.emoji}</span>
          <span className={`font-medium ${DIRECTION_INK[currentDirection]}`}>
            {directionInfo.name}
          </span>
          <span className="text-neutral-500">({directionInfo.ojibwe})</span>
        </span>

        <span
          className="text-neutral-500"
          title="Wilson relational-accountability scoring is not wired yet"
        >
          Wilson —
        </span>
      </div>

      {/* Right: wheel ember + MCP + last check */}
      <div className="flex items-center gap-3">
        <WheelStatus health={health} retry={retry} />

        <span
          className="text-neutral-500"
          title={
            mcpCapability === undefined || mcpCapability === 'deferred'
              ? 'MCP over HTTP is not wired yet'
              : `MCP over HTTP: ${mcpCapability}`
          }
        >
          MCP {mcpCapability === undefined || mcpCapability === 'deferred' ? '—' : mcpCapability}
        </span>

        <span
          className="font-mono text-neutral-500 tabular-nums"
          title="Last health check"
        >
          {checkedAt}
        </span>
      </div>
    </footer>
  );
}
