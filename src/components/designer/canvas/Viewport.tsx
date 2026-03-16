'use client';

import React, { useCallback } from 'react';
import type { Viewport as ViewportType } from './types';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from './types';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ViewportControlsProps {
  viewport: ViewportType;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onViewportChange?: (viewport: ViewportType) => void;
}

// ─── Fit-to-View Utility ─────────────────────────────────────────────────────

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function fitToViewViewport(
  bounds: BoundingBox,
  containerWidth: number,
  containerHeight: number,
  padding = 60,
): ViewportType {
  const bw = bounds.maxX - bounds.minX + padding * 2;
  const bh = bounds.maxY - bounds.minY + padding * 2;

  if (bw <= 0 || bh <= 0) return { x: 0, y: 0, zoom: 1 };

  const zoom = Math.min(
    Math.max(Math.min(containerWidth / bw, containerHeight / bh), MIN_ZOOM),
    MAX_ZOOM,
  );

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  return {
    x: containerWidth / 2 - cx * zoom,
    y: containerHeight / 2 - cy * zoom,
    zoom,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ViewportControls({
  viewport,
  onZoomIn,
  onZoomOut,
  onFitToView,
}: ViewportControlsProps) {
  const zoomPct = Math.round(viewport.zoom * 100);
  const canZoomIn = viewport.zoom < MAX_ZOOM - ZOOM_STEP / 2;
  const canZoomOut = viewport.zoom > MIN_ZOOM + ZOOM_STEP / 2;

  const btnClass =
    'flex h-7 w-7 items-center justify-center rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-700 text-sm';

  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 select-none">
      <button
        className={btnClass}
        onClick={onZoomOut}
        disabled={!canZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
      >
        −
      </button>

      <span className="w-12 text-center text-xs tabular-nums text-neutral-400">
        {zoomPct}%
      </span>

      <button
        className={btnClass}
        onClick={onZoomIn}
        disabled={!canZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>

      <button
        className={`${btnClass} ml-1 w-auto px-2`}
        onClick={onFitToView}
        title="Fit to view"
        aria-label="Fit to view"
      >
        ⊞
      </button>
    </div>
  );
}

// ─── Minimap ─────────────────────────────────────────────────────────────────

export interface MinimapProps {
  nodes: Array<{ x: number; y: number; width: number; height: number }>;
  viewport: ViewportType;
  canvasWidth: number;
  canvasHeight: number;
}

export const Minimap = React.memo(function Minimap({
  nodes,
  viewport,
  canvasWidth,
  canvasHeight,
}: MinimapProps) {
  const SIZE = 120;

  if (nodes.length === 0) return null;

  // Compute bounds of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2);
    minY = Math.min(minY, n.y - n.height / 2);
    maxX = Math.max(maxX, n.x + n.width / 2);
    maxY = Math.max(maxY, n.y + n.height / 2);
  }

  const pad = 40;
  const worldW = maxX - minX + pad * 2;
  const worldH = maxY - minY + pad * 2;
  const scale = Math.min(SIZE / worldW, SIZE / worldH);

  // Viewport rectangle in minimap coords
  const vpX = (-viewport.x / viewport.zoom - minX + pad) * scale;
  const vpY = (-viewport.y / viewport.zoom - minY + pad) * scale;
  const vpW = (canvasWidth / viewport.zoom) * scale;
  const vpH = (canvasHeight / viewport.zoom) * scale;

  return (
    <div className="absolute bottom-3 left-3 z-10 overflow-hidden rounded border border-neutral-700 bg-neutral-900/80">
      <svg width={SIZE} height={SIZE}>
        {nodes.map((n, i) => (
          <rect
            key={i}
            x={(n.x - n.width / 2 - minX + pad) * scale}
            y={(n.y - n.height / 2 - minY + pad) * scale}
            width={n.width * scale}
            height={n.height * scale}
            fill="#475569"
            rx={1}
          />
        ))}
        <rect
          x={vpX}
          y={vpY}
          width={vpW}
          height={vpH}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1}
          opacity={0.6}
        />
      </svg>
    </div>
  );
});

Minimap.displayName = 'Minimap';
