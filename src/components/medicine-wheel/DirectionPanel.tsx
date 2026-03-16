'use client';

import { DIRECTIONS, DIRECTION_COLORS, type DirectionName } from '@forgewright/lib/types';
import { useSpiralStore } from '@forgewright/stores';

// ─── Direction guidance ──────────────────────────────────────────────────────

const DIRECTION_GUIDANCE: Record<DirectionName, string> = {
  east: 'Vision & Inquiry — Decompose the prompt. Identify structural tension. Name what must become.',
  south: 'Growth & Specification — Grow the specs. Track narrative beats. Map dependencies in the graph.',
  west: 'Action & Implementation — Code under ceremony governance. OCAP enforced. Accountability audited.',
  north: 'Reflection & Wisdom — Chronicle the session. Visualize the graph. Close ceremony. Distill wisdom.',
};

const DIRECTION_TOOLS: Record<DirectionName, string[]> = {
  east: ['PDE', 'Graph Read', 'Structural Tension'],
  south: ['Narrative Engine', 'Graph Read/Write', 'Spec Builder'],
  west: ['SMCraft', 'Ceremony Protocol', 'Graph Write', 'OCAP Audit'],
  north: ['Graph Viz', 'Narrative Archive', 'Wilson Scoring', 'Chronicle'],
};

const DIRECTION_TW_BG: Record<DirectionName, string> = {
  east: 'bg-amber-950/40 border-amber-800/50',
  south: 'bg-red-950/40 border-red-800/50',
  west: 'bg-slate-900/60 border-slate-700/50',
  north: 'bg-neutral-900/60 border-neutral-700/50',
};

const DIRECTION_TW_TEXT: Record<DirectionName, string> = {
  east: 'text-amber-300',
  south: 'text-red-300',
  west: 'text-blue-300',
  north: 'text-neutral-200',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface DirectionPanelProps {
  direction: DirectionName;
}

export default function DirectionPanel({ direction }: DirectionPanelProps) {
  const setDirection = useSpiralStore((s) => s.setDirection);
  const currentDirection = useSpiralStore((s) => s.currentDirection);

  const info = DIRECTIONS[direction];
  const isActive = direction === currentDirection;

  return (
    <button
      onClick={() => setDirection(direction)}
      className={`w-full rounded-lg border p-3 text-left transition-all ${DIRECTION_TW_BG[direction]} ${
        isActive ? 'ring-1 ring-white/30' : 'hover:ring-1 hover:ring-white/10'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{info.emoji}</span>
        <div>
          <span className={`text-sm font-semibold ${DIRECTION_TW_TEXT[direction]}`}>
            {info.name}
          </span>
          <span className="ml-2 text-xs text-neutral-400">
            {info.ojibwe}
          </span>
        </div>
        <span className="ml-auto text-[10px] text-neutral-500 uppercase tracking-wide">
          {info.season}
        </span>
      </div>

      {/* Guidance */}
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        {DIRECTION_GUIDANCE[direction]}
      </p>

      {/* Available tools */}
      <div className="mt-2 flex flex-wrap gap-1">
        {DIRECTION_TOOLS[direction].map((tool) => (
          <span
            key={tool}
            className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-[9px] text-neutral-400"
          >
            {tool}
          </span>
        ))}
      </div>
    </button>
  );
}
