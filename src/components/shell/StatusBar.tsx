'use client';

import { useSpiralStore } from '@forgewright/stores';
import { DIRECTIONS, type DirectionName } from '@forgewright/lib/types';

// ─── Wilson score color ───────────────────────────────────────────────────────

function wilsonColor(score: number): string {
  if (score > 0.7) return 'text-emerald-400';
  if (score > 0.3) return 'text-amber-400';
  return 'text-red-400';
}

function wilsonDot(score: number): string {
  if (score > 0.7) return 'bg-emerald-500';
  if (score > 0.3) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StatusBarProps {
  wilsonScore?: number;
  mcpConnected?: boolean;
  lastActionTimestamp?: string | null;
}

export default function StatusBar({
  wilsonScore = 0,
  mcpConnected = false,
  lastActionTimestamp = null,
}: StatusBarProps) {
  const currentDirection = useSpiralStore((s) => s.currentDirection);
  const directionInfo = DIRECTIONS[currentDirection];

  const formattedTime = lastActionTimestamp
    ? new Date(lastActionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <footer className="flex h-6 items-center justify-between border-t border-neutral-800 bg-neutral-950 px-4 text-[10px]">
      {/* Left: Direction + Ojibwe name */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-neutral-300">
          {directionInfo.emoji}
          <span className="font-medium">{directionInfo.name}</span>
          <span className="text-neutral-500">({directionInfo.ojibwe})</span>
        </span>

        {/* Wilson score */}
        <span className="flex items-center gap-1">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${wilsonDot(wilsonScore)}`} />
          <span className={`font-mono font-medium ${wilsonColor(wilsonScore)}`}>
            Wilson {wilsonScore.toFixed(2)}
          </span>
        </span>
      </div>

      {/* Right: MCP status + timestamp */}
      <div className="flex items-center gap-3 text-neutral-500">
        {/* MCP connection */}
        <span className="flex items-center gap-1">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              mcpConnected ? 'bg-emerald-500' : 'bg-neutral-600'
            }`}
          />
          <span className={mcpConnected ? 'text-emerald-400' : 'text-neutral-500'}>
            MCP {mcpConnected ? 'connected' : 'offline'}
          </span>
        </span>

        {/* Last action */}
        <span className="text-neutral-600">{formattedTime}</span>
      </div>
    </footer>
  );
}
