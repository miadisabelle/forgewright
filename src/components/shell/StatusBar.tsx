'use client';

import { useSpiralStore } from '@forgewright/stores';
import { DIRECTIONS, type DirectionName } from '@forgewright/lib/types';
import {
  useMwHealth,
  MwHeatDot,
  MW_HEAT,
  type MwHealthSnapshot,
} from '@forgewright/lib/useMwHealth';

// ─── Direction ink (AA on coal) ──────────────────────────────────────────────

const DIRECTION_INK: Record<DirectionName, string> = {
  east: 'text-forge-east-ink',
  south: 'text-forge-south-ink',
  west: 'text-forge-west-ink',
  north: 'text-forge-north-ink',
};

// ─── Wheel heat — shared vocabulary, rendered here for the whole shell ───────

function WheelStatus({
  health,
  refresh,
}: {
  health: MwHealthSnapshot;
  refresh: () => void;
}) {
  if (health.heat === null) {
    return (
      <span className="flex items-center gap-1.5 text-neutral-500">
        <MwHeatDot heat={null} className="h-1.5 w-1.5" />
        Wheel: checking…
      </span>
    );
  }

  const presentation = MW_HEAT[health.heat];
  const counts = health.counts
    ? `${health.counts.episodes} episodes · ${health.counts.structuredPlans} plans · ${health.counts.stateMachines} machines`
    : null;
  const title = [presentation.description, counts, health.error]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      className={`flex items-center gap-1.5 ${presentation.textClassName}`}
      title={title}
    >
      <MwHeatDot heat={health.heat} className="h-1.5 w-1.5" />
      Wheel: {presentation.label.toLowerCase()}
      {health.heat === 'cold' && (
        <>
          <span className="text-neutral-500">
            — start medicine-wheel at {health.baseUrl ?? ':3940'}
          </span>
          <button
            onClick={refresh}
            className="rounded border border-neutral-700 px-1.5 py-px text-neutral-300 transition-colors duration-(--fw-dur-fast) hover:border-neutral-600 hover:bg-neutral-800 hover:text-neutral-100"
          >
            Retry
          </button>
        </>
      )}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatusBar() {
  const currentDirection = useSpiralStore((s) => s.currentDirection);
  const directionInfo = DIRECTIONS[currentDirection];
  const { refresh, ...health } = useMwHealth();

  const checkedAt = health.checkedAt
    ? new Date(health.checkedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

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

      {/* Right: wheel heat + MCP + last check */}
      <div className="flex items-center gap-3">
        <WheelStatus health={health} refresh={refresh} />

        <span className="text-neutral-500" title="MCP over HTTP is not wired yet">
          MCP —
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
