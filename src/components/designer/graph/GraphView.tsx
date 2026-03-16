'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { GraphNode, GraphEdge, DirectionName } from '@forgewright/lib/types';
import { DIRECTION_NAMES } from '@forgewright/lib/types';

import { CanvasEngine, circularLayout, forceLayout } from '../canvas';
import type { CanvasNode, CanvasEdge } from '../canvas/types';

import { graphToCanvas, getNodeLabel, getNodeDirection } from './graph-to-canvas';
import NodeDetail from './NodeDetail';
import GraphToolbar, { DEFAULT_FILTERS, type GraphFilters } from './GraphToolbar';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Callback to expand a node's 1-hop neighborhood */
  onExpandNeighborhood?: (nodeId: string) => void;
  /** External selection control */
  selectedNodeId?: string | null;
  onSelectionChange?: (nodeId: string | null) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GraphView({
  nodes,
  edges,
  onExpandNeighborhood,
  selectedNodeId: externalSelectedId,
  onSelectionChange,
}: GraphViewProps) {
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);

  const selectedNodeId = externalSelectedId ?? internalSelectedId;

  const setSelectedNodeId = useCallback(
    (id: string | null) => {
      setInternalSelectedId(id);
      onSelectionChange?.(id);
    },
    [onSelectionChange],
  );

  // ── Filter nodes ──────────────────────────────────────────────────────────
  const filteredNodes = useMemo(() => {
    let result = nodes;

    // Filter by node type
    if (filters.nodeTypes.size < 10) {
      result = result.filter((n) => filters.nodeTypes.has(n.nodeType));
    }

    // Filter by direction
    if (filters.directions.size < DIRECTION_NAMES.length) {
      result = result.filter((n) => {
        const dir = getNodeDirection(n);
        // Nodes without direction pass if any direction is enabled
        return dir ? filters.directions.has(dir) : true;
      });
    }

    // Filter by search query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter((n) => getNodeLabel(n).toLowerCase().includes(q));
    }

    return result;
  }, [nodes, filters]);

  // ── Filter edges to match visible nodes ───────────────────────────────────
  const filteredEdges = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => visibleIds.has(e.fromId) && visibleIds.has(e.toId));
  }, [edges, filteredNodes]);

  // ── Convert to canvas format ──────────────────────────────────────────────
  const { canvasNodes: rawCanvasNodes, canvasEdges } = useMemo(
    () => graphToCanvas(filteredNodes, filteredEdges),
    [filteredNodes, filteredEdges],
  );

  // ── Apply layout ──────────────────────────────────────────────────────────
  const layoutNodes: CanvasNode[] = useMemo(() => {
    if (rawCanvasNodes.length === 0) return [];

    if (filters.layoutMode === 'circular') {
      const directions: DirectionName[] = [...DIRECTION_NAMES];
      return circularLayout(rawCanvasNodes, canvasEdges, directions);
    }
    return forceLayout(rawCanvasNodes, canvasEdges);
  }, [rawCanvasNodes, canvasEdges, filters.layoutMode]);

  // ── Selected graph node ───────────────────────────────────────────────────
  const selectedGraphNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
    },
    [setSelectedNodeId],
  );

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      onExpandNeighborhood?.(nodeId);
    },
    [onExpandNeighborhood],
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
    },
    [setSelectedNodeId],
  );

  const handleNodeMove = useCallback(
    (_nodeId: string, _x: number, _y: number) => {
      // Node position updates are visual only in graph view
    },
    [],
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-neutral-900">
        <div className="text-center">
          <p className="text-lg text-neutral-500">No graph data</p>
          <p className="mt-1 text-sm text-neutral-600">
            Run a graph query or load a session to populate the relational view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Toolbar */}
      <GraphToolbar
        filters={filters}
        onChange={setFilters}
        nodeCount={layoutNodes.length}
        edgeCount={canvasEdges.length}
      />

      {/* Canvas (offset for toolbar height) */}
      <div className="absolute inset-0 pt-10">
        <CanvasEngine
          nodes={layoutNodes}
          edges={canvasEdges}
          mode="select"
          activeNodeId={selectedNodeId ?? undefined}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeMove={handleNodeMove}
        />
      </div>

      {/* Node detail panel */}
      {selectedGraphNode && (
        <div className="absolute right-0 top-10 bottom-0 z-20">
          <NodeDetail
            node={selectedGraphNode}
            edges={edges}
            allNodes={nodes}
            onClose={handleCloseDetail}
            onNavigateToNode={handleNavigateToNode}
          />
        </div>
      )}

      {/* Filtered-out indicator */}
      {filteredNodes.length < nodes.length && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-neutral-700 bg-neutral-800/90 px-3 py-1 text-xs text-neutral-400">
          Showing {filteredNodes.length} of {nodes.length} nodes
        </div>
      )}
    </div>
  );
}
