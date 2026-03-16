'use client';

import { DIRECTIONS, DIRECTION_COLORS, type DirectionName, DIRECTION_NAMES } from '@forgewright/lib/types';

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
        `}</style>
      </defs>

      {/* Quadrants */}
      {QUADRANTS.map(({ direction, path, labelX, labelY, ojibweLabelY }) => {
        const isActive = direction === activeDirection;
        const info = DIRECTIONS[direction];
        const fill = DIRECTION_COLORS[direction];
        const textFill = direction === 'west' ? '#E8E8E8' : '#1a1a2e';

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
              fill={fill}
              stroke={isActive ? '#ffffff' : '#333'}
              strokeWidth={isActive ? 2.5 : 1}
              className={isActive ? 'wheel-active' : ''}
              opacity={isActive ? 1 : 0.75}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fill={textFill}
              fontSize={10}
              fontWeight={isActive ? 700 : 500}
            >
              {info.emoji} {info.name}
            </text>
            <text
              x={labelX}
              y={ojibweLabelY}
              textAnchor="middle"
              fill={textFill}
              fontSize={7}
              opacity={0.8}
            >
              {info.ojibwe}
            </text>
          </g>
        );
      })}

      {/* Center circle with cycle count */}
      <circle cx={100} cy={100} r={18} fill="#0a0a0a" stroke="#555" strokeWidth={1} />
      <text x={100} y={96} textAnchor="middle" fill="#E8E8E8" fontSize={8} fontWeight={600}>
        Cycle
      </text>
      <text x={100} y={110} textAnchor="middle" fill="#FFD700" fontSize={14} fontWeight={700}>
        {cycleCount}
      </text>

      {/* Outer ring */}
      <circle cx={100} cy={100} r={92} fill="none" stroke="#444" strokeWidth={0.5} />
    </svg>
  );
}
