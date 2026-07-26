'use client';

import { DIRECTIONS, type DirectionName } from '@forgewright/lib/types';
import type { PlacedBeat } from '@forgewright/lib/chronicle/beats';

// ─── Quadrant geometry ────────────────────────────────────────────────────────

interface QuadrantDef {
  direction: DirectionName;
  path: string;
  labelX: number;
  labelY: number;
  ojibweLabelY: number;
}

const QUADRANTS: QuadrantDef[] = [
  { direction: 'east',  path: 'M 100 100 L 100 10 A 90 90 0 0 1 190 100 Z',  labelX: 152, labelY: 52,  ojibweLabelY: 66 },
  { direction: 'south', path: 'M 100 100 L 190 100 A 90 90 0 0 1 100 190 Z', labelX: 148, labelY: 152, ojibweLabelY: 166 },
  { direction: 'west',  path: 'M 100 100 L 100 190 A 90 90 0 0 1 10 100 Z',  labelX: 48,  labelY: 152, ojibweLabelY: 166 },
  { direction: 'north', path: 'M 100 100 L 10 100 A 90 90 0 0 1 100 10 Z',   labelX: 48,  labelY: 52,  ojibweLabelY: 66 },
];

// Semantic direction vars — the wheel means its colors, it does not decorate.
const QUADRANT_FILL: Record<DirectionName, string> = {
  east: 'var(--forge-east)',
  south: 'var(--forge-south)',
  west: 'var(--forge-west)',
  north: 'var(--forge-north)',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface WheelDiagramProps {
  activeDirection: DirectionName;
  cycleCount: number;
  onDirectionClick?: (direction: DirectionName) => void;
  size?: number;
  /**
   * Beats placed by src/lib/chronicle/beats.ts — quadrant by `direction`,
   * angle by timestamp rank, radius by telescoping depth (spec 11.3). Placement
   * EXTENDS this diagram; the quadrant geometry above stays the authority.
   */
  beats?: readonly PlacedBeat[];
  selectedBeatId?: string | null;
  /** Whole lineage of the selection — ancestors and descendants stay lit. */
  lineageIds?: ReadonlySet<string>;
  onBeatSelect?: (beatId: string) => void;
  unboundCount?: number;
  /** Centre label — "Cycle" in the sidebar, "Beats" on a chronicle arc. */
  centerLabel?: string;
}

export default function WheelDiagram({
  activeDirection,
  cycleCount,
  onDirectionClick,
  size = 200,
  beats,
  selectedBeatId = null,
  lineageIds,
  onBeatSelect,
  unboundCount = 0,
  centerLabel = 'Cycle',
}: WheelDiagramProps) {
  const placed = beats ?? [];
  const drawsBeats = beats !== undefined;
  // Emptiness in a direction is information — that direction has not yet had
  // its turn — so a quadrant with no beats rests rather than hides.
  const beatsPerDirection: Record<DirectionName, number> = {
    east: 0, south: 0, west: 0, north: 0,
  };
  for (const mark of placed) beatsPerDirection[mark.beat.direction] += 1;

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className="select-none"
      role="img"
      aria-label="Medicine Wheel — Four Directions"
    >
      <defs>
        <style>{`
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.85; }
            50% { opacity: 1; }
          }
          .wheel-active {
            animation: pulse-glow 2s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .wheel-active { animation: none; }
          }
        `}</style>
      </defs>

      {/* Quadrants */}
      {QUADRANTS.map(({ direction, path, labelX, labelY, ojibweLabelY }) => {
        const isActive = direction === activeDirection;
        const info = DIRECTIONS[direction];
        const atRest = drawsBeats && beatsPerDirection[direction] === 0;

        return (
          <g
            key={direction}
            onClick={() => onDirectionClick?.(direction)}
            className="cursor-pointer"
            role="button"
            aria-label={`${info.name} — ${info.ojibwe}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onDirectionClick?.(direction);
            }}
          >
            <path
              d={path}
              fill={QUADRANT_FILL[direction]}
              stroke={isActive ? 'var(--fw-bone)' : 'var(--fw-border-strong)'}
              strokeWidth={isActive ? 2.5 : 1}
              className={isActive ? 'wheel-active' : ''}
              opacity={isActive ? 1 : atRest ? 0.45 : 0.7}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fill="var(--fw-ground)"
              fontSize={10}
              fontWeight={isActive ? 700 : 500}
            >
              {info.emoji} {info.name}
            </text>
            <text
              x={labelX}
              y={ojibweLabelY}
              textAnchor="middle"
              fill="var(--fw-ground)"
              fontSize={7}
              opacity={0.8}
            >
              {info.ojibwe}
            </text>
          </g>
        );
      })}

      {/* Unbound ring — a lamp left on for beats that arrived before anyone
          thought to ask which cycle they belonged to. */}
      {unboundCount > 0 ? (
        <circle
          cx={100}
          cy={100}
          r={88}
          fill="none"
          stroke="var(--fw-border-strong)"
          strokeWidth={0.5}
          strokeDasharray="2 3"
        />
      ) : null}

      {/* Telescoping connectors — the parent STAYS drawn beside its children. */}
      {placed.map((mark) =>
        mark.parentPlacement ? (
          <line
            key={`link-${mark.beat.id}`}
            x1={mark.parentPlacement.x}
            y1={mark.parentPlacement.y}
            x2={mark.x}
            y2={mark.y}
            stroke="var(--fw-bone)"
            strokeWidth={0.6}
            strokeDasharray="1.5 1.5"
            opacity={lineageIds?.has(mark.beat.id) ? 0.8 : 0.35}
          />
        ) : null,
      )}

      {/* Beat marks */}
      {placed.map((mark) => {
        const isSelected = mark.beat.id === selectedBeatId;
        const isLit = !selectedBeatId || (lineageIds?.has(mark.beat.id) ?? false);
        const radius = mark.unbound ? 2.4 : Math.max(3.4 - mark.depth * 0.5, 2.2);

        return (
          <g
            key={mark.beat.id}
            role="button"
            tabIndex={0}
            aria-label={`${DIRECTIONS[mark.beat.direction].name} beat — ${mark.beat.title}`}
            className="cursor-pointer"
            opacity={isLit ? 1 : 0.35}
            onClick={(event) => {
              event.stopPropagation();
              onBeatSelect?.(mark.beat.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onBeatSelect?.(mark.beat.id);
            }}
          >
            <title>{mark.beat.title}</title>
            <circle
              cx={mark.x}
              cy={mark.y}
              r={radius}
              fill={mark.unbound ? 'var(--fw-iron)' : 'var(--fw-bone)'}
              stroke={isSelected ? 'var(--fw-ember)' : 'var(--fw-ground)'}
              strokeWidth={isSelected ? 1.6 : 0.8}
              strokeDasharray={mark.unbound ? '1.5 1.5' : undefined}
            />
            {mark.deeperCount > 0 ? (
              <text
                x={mark.x + radius + 1.5}
                y={mark.y + 2}
                fill="var(--fw-bone)"
                fontSize={5}
                fontFamily="var(--font-mono)"
              >
                +{mark.deeperCount}
              </text>
            ) : null}
          </g>
        );
      })}

      {/* Center circle with cycle count */}
      <circle cx={100} cy={100} r={18} fill="var(--fw-iron)" stroke="var(--fw-border-strong)" strokeWidth={1} />
      <text x={100} y={96} textAnchor="middle" fill="var(--fw-ash)" fontSize={8} fontWeight={600}>
        {centerLabel}
      </text>
      <text
        x={100}
        y={110}
        textAnchor="middle"
        fill="var(--fw-bone)"
        fontSize={14}
        fontWeight={700}
        fontFamily="var(--font-mono)"
      >
        {cycleCount}
      </text>
      {unboundCount > 0 ? (
        <text
          x={100}
          y={126}
          textAnchor="middle"
          fill="var(--fw-ash)"
          fontSize={6.5}
          fontFamily="var(--font-mono)"
        >
          {unboundCount} unbound
        </text>
      ) : null}

      {/* Outer ring */}
      <circle cx={100} cy={100} r={92} fill="none" stroke="var(--fw-border)" strokeWidth={0.5} />
    </svg>
  );
}
