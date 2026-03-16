'use client';

import React, { useCallback, useMemo } from 'react';
import type { CanvasEdgeStyle } from './types';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface CanvasEdgeProps {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label?: string;
  type?: string;
  isSelected?: boolean;
  color?: string;
  style?: CanvasEdgeStyle;
  onClick?: (id: string, e: React.MouseEvent) => void;
}

// ─── Edge Type → Color Mapping ───────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  TRANSITIONS_TO: '#64748b',
  KIN_OF: '#60a5fa',
  DEPENDS_ON: '#94a3b8',
  ACCOUNTABLE_TO: '#fbbf24',
  BELONGS_TO: '#a78bfa',
  SERVES_DIRECTION: '#f472b6',
  CONTAINS: '#475569',
  NARRATES: '#34d399',
  AUTHORED_BY: '#c084fc',
  GOVERNED_BY: '#fb923c',
  GENERATED_FROM: '#22d3ee',
};

function resolveColor(type?: string, color?: string): string {
  if (color) return color;
  return TYPE_COLORS[type ?? ''] ?? '#64748b';
}

// ─── Arrowhead Marker ID ─────────────────────────────────────────────────────
// Each edge gets a unique marker color via a deterministic ID.

function markerIdForColor(hex: string): string {
  return `arrow-${hex.replace('#', '')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

const CanvasEdge = React.memo(function CanvasEdge({
  id,
  fromX,
  fromY,
  toX,
  toY,
  label,
  type,
  isSelected = false,
  color: colorProp,
  style,
  onClick,
}: CanvasEdgeProps) {
  const edgeColor = resolveColor(type, colorProp);
  const strokeWidth = style?.strokeWidth ?? (isSelected ? 2.5 : 1.5);
  const markerId = markerIdForColor(edgeColor);

  // Cubic Bézier: vertical midpoint control points (smcraft pattern)
  const midY = (fromY + toY) / 2;
  const pathD = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

  // Label at path midpoint
  const labelX = (fromX + toX) / 2;
  const labelY = (fromY + toY) / 2 - 8;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(id, e);
    },
    [id, onClick],
  );

  const labelWidth = useMemo(
    () => (label ? Math.min(label.length * 7 + 12, 140) : 0),
    [label],
  );

  return (
    <g data-edge-id={id} onClick={handleClick} style={{ cursor: 'pointer' }}>
      {/* Arrowhead marker definition */}
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 8 3, 0 6" fill={edgeColor} />
        </marker>
      </defs>

      {/* Hit area (invisible wider path for easier clicking) */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
      />

      {/* Selection highlight */}
      {isSelected && (
        <path
          d={pathD}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={strokeWidth + 3}
          opacity={0.35}
        />
      )}

      {/* Visible path */}
      <path
        d={pathD}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={style?.strokeDasharray || undefined}
        opacity={style?.opacity ?? 1}
        markerEnd={`url(#${markerId})`}
      />

      {/* Label */}
      {label && (
        <g>
          <rect
            x={labelX - labelWidth / 2}
            y={labelY - 10}
            width={labelWidth}
            height={18}
            rx={3}
            fill="#0f172a"
            opacity={0.85}
          />
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#cbd5e1"
            fontSize={11}
            fontFamily="Inter, system-ui, sans-serif"
            pointerEvents="none"
          >
            {label.length > 18 ? label.slice(0, 16) + '…' : label}
          </text>
        </g>
      )}
    </g>
  );
});

CanvasEdge.displayName = 'CanvasEdge';
export default CanvasEdge;
