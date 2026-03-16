'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import CanvasNode from './CanvasNode';
import CanvasEdge from './CanvasEdge';
import ContextMenu from './ContextMenu';
import ViewportControls, { Minimap, fitToViewViewport } from './Viewport';
import type {
  CanvasNode as CanvasNodeType,
  CanvasEdge as CanvasEdgeType,
  CanvasMode,
  ContextMenuItem,
  GraphDelta,
  ResolvedEdge,
  SelectionState,
  Viewport,
} from './types';
import {
  DEFAULT_VIEWPORT,
  EMPTY_SELECTION,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from './types';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface CanvasEngineProps {
  nodes: CanvasNodeType[];
  edges: CanvasEdgeType[];
  viewport?: Viewport;
  mode?: CanvasMode;
  activeNodeId?: string | null;
  contextMenuItems?: ContextMenuItem[];

  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onEdgeDraw?: (sourceId: string, targetId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onContextMenu?: (x: number, y: number, target: { kind: 'node' | 'edge' | 'canvas'; id?: string }) => void;
  onViewportChange?: (viewport: Viewport) => void;
  onSelectionChange?: (selection: SelectionState) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onDelta?: (delta: GraphDelta) => void;
}

// ─── Resolve Edges to Screen Coordinates ─────────────────────────────────────

function resolveEdges(
  edges: CanvasEdgeType[],
  nodeMap: Map<string, CanvasNodeType>,
): ResolvedEdge[] {
  return edges.flatMap((e) => {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    if (!src || !tgt) return [];
    return [{
      ...e,
      fromX: src.x,
      fromY: src.y + src.height / 2,
      toX: tgt.x,
      toY: tgt.y - tgt.height / 2,
    }];
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CanvasEngine({
  nodes,
  edges,
  viewport: viewportProp,
  mode = 'select',
  activeNodeId,
  contextMenuItems,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeDraw,
  onEdgeClick,
  onContextMenu,
  onViewportChange,
  onSelectionChange,
  onNodeMove,
}: CanvasEngineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── State ────────────────────────────────────────────────────────────────
  const [viewport, setViewportRaw] = useState<Viewport>(viewportProp ?? DEFAULT_VIEWPORT);
  const [selection, setSelectionRaw] = useState<SelectionState>(EMPTY_SELECTION);
  const [dragState, setDragState] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
  } | null>(null);
  const [panState, setPanState] = useState<{ startX: number; startY: number; vpX: number; vpY: number } | null>(null);
  const [transitionSource, setTransitionSource] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  // Sync controlled viewport prop
  useEffect(() => {
    if (viewportProp) setViewportRaw(viewportProp);
  }, [viewportProp]);

  const setViewport = useCallback((vp: Viewport) => {
    setViewportRaw(vp);
    onViewportChange?.(vp);
  }, [onViewportChange]);

  const setSelection = useCallback((sel: SelectionState) => {
    setSelectionRaw(sel);
    onSelectionChange?.(sel);
  }, [onSelectionChange]);

  // ── Node map (memo) ──────────────────────────────────────────────────────
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const resolved = useMemo(() => resolveEdges(edges, nodeMap), [edges, nodeMap]);

  // ── Zoom ─────────────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      setViewport({
        ...viewport,
        zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom + direction * ZOOM_STEP)),
      });
    },
    [viewport, setViewport],
  );

  const zoomIn = useCallback(() => {
    setViewport({ ...viewport, zoom: Math.min(MAX_ZOOM, viewport.zoom + ZOOM_STEP) });
  }, [viewport, setViewport]);

  const zoomOut = useCallback(() => {
    setViewport({ ...viewport, zoom: Math.max(MIN_ZOOM, viewport.zoom - ZOOM_STEP) });
  }, [viewport, setViewport]);

  const fitToView = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.width / 2);
      minY = Math.min(minY, n.y - n.height / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      maxY = Math.max(maxY, n.y + n.height / 2);
    }
    setViewport(fitToViewViewport({ minX, minY, maxX, maxY }, clientWidth, clientHeight));
  }, [nodes, setViewport]);

  // ── Pan ──────────────────────────────────────────────────────────────────
  const handleSvgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle button or pan mode → start panning
      if (e.button === 1 || mode === 'pan') {
        e.preventDefault();
        setPanState({ startX: e.clientX, startY: e.clientY, vpX: viewport.x, vpY: viewport.y });
        return;
      }
      // Left click on empty canvas → deselect
      if (e.button === 0 && (e.target as Element).tagName === 'svg') {
        setSelection(EMPTY_SELECTION);
        setTransitionSource(null);
      }
    },
    [mode, viewport, setSelection],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Pan
      if (panState) {
        setViewport({
          ...viewport,
          x: panState.vpX + (e.clientX - panState.startX),
          y: panState.vpY + (e.clientY - panState.startY),
        });
        return;
      }
      // Node drag
      if (dragState) {
        const dx = (e.clientX - dragState.startX) / viewport.zoom;
        const dy = (e.clientY - dragState.startY) / viewport.zoom;
        onNodeMove?.(dragState.nodeId, dragState.nodeStartX + dx, dragState.nodeStartY + dy);
      }
    },
    [panState, dragState, viewport, onNodeMove, setViewport],
  );

  const handleMouseUp = useCallback(
    () => {
      setPanState(null);
      setDragState(null);
    },
    [],
  );

  // ── Node interactions ────────────────────────────────────────────────────
  const handleNodeMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      if (mode === 'select' && e.button === 0) {
        const node = nodeMap.get(nodeId);
        if (!node) return;
        setDragState({
          nodeId,
          startX: e.clientX,
          startY: e.clientY,
          nodeStartX: node.x,
          nodeStartY: node.y,
        });
      }
    },
    [mode, nodeMap],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (mode === 'transition' && transitionSource && transitionSource !== nodeId) {
        onEdgeDraw?.(transitionSource, nodeId);
        setTransitionSource(null);
        return;
      }
      if (mode === 'transition') {
        setTransitionSource(nodeId);
        return;
      }
      setSelection({ kind: 'node', id: nodeId });
      onNodeClick?.(nodeId);
    },
    [mode, transitionSource, onNodeClick, onEdgeDraw, setSelection],
  );

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => onNodeDoubleClick?.(nodeId),
    [onNodeDoubleClick],
  );

  const handleNodeContextMenu = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      setSelection({ kind: 'node', id: nodeId });
      setCtxMenu({ x: e.clientX, y: e.clientY });
      onContextMenu?.(e.clientX, e.clientY, { kind: 'node', id: nodeId });
    },
    [onContextMenu, setSelection],
  );

  // ── Edge interactions ────────────────────────────────────────────────────
  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      setSelection({ kind: 'edge', id: edgeId });
      onEdgeClick?.(edgeId);
    },
    [onEdgeClick, setSelection],
  );

  // ── Canvas right-click ───────────────────────────────────────────────────
  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY });
      onContextMenu?.(e.clientX, e.clientY, { kind: 'canvas' });
    },
    [onContextMenu],
  );

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelection(EMPTY_SELECTION);
        setTransitionSource(null);
        setCtxMenu(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSelection]);

  // ── Container size for minimap ───────────────────────────────────────────
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const transformStr = `translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-neutral-900"
    >
      <svg
        ref={svgRef}
        className="h-full w-full"
        onWheel={handleWheel}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleCanvasContextMenu}
      >
        {/* Grid pattern (subtle dot grid) */}
        <defs>
          <pattern id="canvas-grid" width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={0.5} fill="#334155" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#canvas-grid)" />

        {/* Transformed group: edges first (below), then nodes */}
        <g transform={transformStr}>
          {resolved.map((e) => (
            <CanvasEdge
              key={e.id}
              id={e.id}
              fromX={e.fromX}
              fromY={e.fromY}
              toX={e.toX}
              toY={e.toY}
              label={e.label}
              type={e.type}
              isSelected={selection.kind === 'edge' && selection.id === e.id}
              style={e.style}
              onClick={handleEdgeClick}
            />
          ))}
          {nodes.map((n) => (
            <CanvasNode
              key={n.id}
              id={n.id}
              x={n.x}
              y={n.y}
              width={n.width}
              height={n.height}
              label={n.label}
              kind={n.kind}
              isSelected={selection.kind === 'node' && selection.id === n.id}
              isActive={n.id === activeNodeId}
              style={n.style}
              onMouseDown={handleNodeMouseDown}
              onClick={handleNodeClick}
              onDoubleClick={handleNodeDoubleClick}
              onContextMenu={handleNodeContextMenu}
            />
          ))}
        </g>

        {/* Transition draw mode indicator */}
        {mode === 'transition' && transitionSource && (
          <text x={12} y={20} fill="#fbbf24" fontSize={12} fontFamily="monospace">
            Drawing from: {transitionSource} → click target node
          </text>
        )}
      </svg>

      {/* Viewport controls overlay */}
      <ViewportControls
        viewport={viewport}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToView={fitToView}
      />

      {/* Minimap */}
      <Minimap
        nodes={nodes}
        viewport={viewport}
        canvasWidth={size.w}
        canvasHeight={size.h}
      />

      {/* Context menu */}
      {ctxMenu && contextMenuItems && contextMenuItems.length > 0 && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={contextMenuItems}
          onSelect={(action) => {
            setCtxMenu(null);
            // Context menu actions are dispatched through the onContextMenu callback
          }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
