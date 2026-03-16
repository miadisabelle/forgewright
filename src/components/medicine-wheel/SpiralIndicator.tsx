'use client';

import { DIRECTIONS, DIRECTION_COLORS, type DirectionName } from '@forgewright/lib/types';

// ─── Spiral geometry ─────────────────────────────────────────────────────────

const DIRECTION_ORDER: readonly DirectionName[] = ['east', 'south', 'west', 'north'] as const;

function buildSpiralPath(totalSteps: number): string {
  if (totalSteps === 0) return '';

  const cx = 20;
  const cy = 20;
  const startRadius = 4;
  const radiusGrowth = 1.8;
  const stepsPerTurn = 4;
  const arcPerStep = (2 * Math.PI) / stepsPerTurn;

  const points: string[] = [];

  for (let i = 0; i <= totalSteps; i++) {
    const angle = -Math.PI / 2 + i * arcPerStep;
    const r = startRadius + (i * radiusGrowth);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return points.join(' ');
}

function spiralTipPosition(totalSteps: number): { x: number; y: number } {
  const cx = 20;
  const cy = 20;
  const startRadius = 4;
  const radiusGrowth = 1.8;
  const stepsPerTurn = 4;
  const arcPerStep = (2 * Math.PI) / stepsPerTurn;

  const angle = -Math.PI / 2 + totalSteps * arcPerStep;
  const r = startRadius + (totalSteps * radiusGrowth);
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface SpiralIndicatorProps {
  cycleCount: number;
  currentDirection: DirectionName;
  maxCycles?: number;
}

export default function SpiralIndicator({
  cycleCount,
  currentDirection,
  maxCycles = 3,
}: SpiralIndicatorProps) {
  const directionIndex = DIRECTION_ORDER.indexOf(currentDirection);
  const totalSteps = cycleCount * 4 + directionIndex;
  const maxSteps = maxCycles * 4;

  const spiralPath = buildSpiralPath(Math.min(totalSteps, maxSteps));
  const tip = spiralTipPosition(Math.min(totalSteps, maxSteps));
  const dotColor = DIRECTION_COLORS[currentDirection];

  return (
    <svg
      viewBox="0 0 40 40"
      width={24}
      height={24}
      className="inline-block"
      role="img"
      aria-label={`Spiral: Cycle ${cycleCount}, ${DIRECTIONS[currentDirection].name}`}
    >
      {/* Spiral path */}
      {spiralPath && (
        <path
          d={spiralPath}
          fill="none"
          stroke="#555"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}

      {/* Current position dot */}
      <circle
        cx={tip.x}
        cy={tip.y}
        r={3}
        fill={dotColor}
        stroke="#fff"
        strokeWidth={0.5}
      />

      {/* Center dot */}
      <circle cx={20} cy={20} r={1.5} fill="#666" />
    </svg>
  );
}
