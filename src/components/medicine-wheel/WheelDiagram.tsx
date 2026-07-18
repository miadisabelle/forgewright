'use client';

import { DIRECTIONS, type DirectionName } from '@forgewright/lib/types';

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
}

export default function WheelDiagram({
  activeDirection,
  cycleCount,
  onDirectionClick,
  size = 200,
}: WheelDiagramProps) {
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
              opacity={isActive ? 1 : 0.7}
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

      {/* Center circle with cycle count */}
      <circle cx={100} cy={100} r={18} fill="var(--fw-iron)" stroke="var(--fw-border-strong)" strokeWidth={1} />
      <text x={100} y={96} textAnchor="middle" fill="var(--fw-ash)" fontSize={8} fontWeight={600}>
        Cycle
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

      {/* Outer ring */}
      <circle cx={100} cy={100} r={92} fill="none" stroke="var(--fw-border)" strokeWidth={0.5} />
    </svg>
  );
}
