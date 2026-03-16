'use client';

import React, { useCallback } from 'react';
import type { CanvasNodeStyle } from './types';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface CanvasNodeProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  kind?: string;
  isSelected?: boolean;
  isActive?: boolean;
  style?: CanvasNodeStyle;
  onMouseDown?: (id: string, e: React.MouseEvent) => void;
  onClick?: (id: string, e: React.MouseEvent) => void;
  onDoubleClick?: (id: string, e: React.MouseEvent) => void;
  onContextMenu?: (id: string, e: React.MouseEvent) => void;
}

// ─── Style Defaults by Kind ──────────────────────────────────────────────────

const KIND_STYLES: Record<string, Partial<CanvasNodeStyle>> = {
  normal: { fill: '#1e293b', stroke: '#64748b', rx: 6 },
  final: { fill: '#1e293b', stroke: '#64748b', strokeDasharray: '6 3', rx: 6 },
  history: { fill: '#1e293b', stroke: '#a78bfa', rx: 30 },
  composite: { fill: '#0f172a', stroke: '#475569', strokeDasharray: '4 2', rx: 6 },
  // Graph node types
  Spec: { fill: '#1a1a2e', stroke: '#FFD700', rx: 8 },
  Companion: { fill: '#1a1a2e', stroke: '#a78bfa', rx: 8 },
  Ceremony: { fill: '#1a1a2e', stroke: '#DC143C', rx: 8 },
  Session: { fill: '#1a1a2e', stroke: '#38bdf8', rx: 8 },
  State: { fill: '#1e293b', stroke: '#64748b', rx: 6 },
  StateMachine: { fill: '#0f172a', stroke: '#475569', rx: 6 },
};

function resolveStyle(kind?: string, style?: CanvasNodeStyle): Required<CanvasNodeStyle> {
  const base = KIND_STYLES[kind ?? 'normal'] ?? KIND_STYLES.normal;
  return {
    fill: style?.fill ?? base.fill ?? '#1e293b',
    stroke: style?.stroke ?? base.stroke ?? '#64748b',
    strokeWidth: style?.strokeWidth ?? base.strokeWidth ?? 2,
    strokeDasharray: style?.strokeDasharray ?? base.strokeDasharray ?? '',
    rx: style?.rx ?? base.rx ?? 6,
    opacity: style?.opacity ?? base.opacity ?? 1,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

const CanvasNode = React.memo(function CanvasNode({
  id,
  x,
  y,
  width,
  height,
  label,
  kind,
  isSelected = false,
  isActive = false,
  style: styleProp,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu,
}: CanvasNodeProps) {
  const s = resolveStyle(kind, styleProp);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => onMouseDown?.(id, e),
    [id, onMouseDown],
  );
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(id, e);
    },
    [id, onClick],
  );
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleClick?.(id, e);
    },
    [id, onDoubleClick],
  );
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(id, e);
    },
    [id, onContextMenu],
  );

  const tx = x - width / 2;
  const ty = y - height / 2;

  return (
    <g
      data-node-id={id}
      transform={`translate(${tx}, ${ty})`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{ cursor: 'grab', opacity: s.opacity }}
    >
      {/* Selection highlight ring */}
      {isSelected && (
        <rect
          x={-3}
          y={-3}
          width={width + 6}
          height={height + 6}
          rx={s.rx + 2}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
        />
      )}

      {/* Active pulsing ring */}
      {isActive && (
        <rect
          x={-4}
          y={-4}
          width={width + 8}
          height={height + 8}
          rx={s.rx + 3}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2.5}
          className="canvas-pulse"
        >
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Body */}
      <rect
        width={width}
        height={height}
        rx={s.rx}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeDasharray={s.strokeDasharray || undefined}
      />

      {/* Label */}
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#e2e8f0"
        fontSize={13}
        fontFamily="Inter, system-ui, sans-serif"
        pointerEvents="none"
      >
        {label.length > 20 ? label.slice(0, 18) + '…' : label}
      </text>

      {/* Composite drill-down hint */}
      {kind === 'composite' && (
        <text
          x={width - 8}
          y={height - 6}
          textAnchor="end"
          fill="#94a3b8"
          fontSize={10}
          pointerEvents="none"
        >
          ▸▸
        </text>
      )}
    </g>
  );
});

CanvasNode.displayName = 'CanvasNode';
export default CanvasNode;
