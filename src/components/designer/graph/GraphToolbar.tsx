'use client';

import React, { useCallback, useState } from 'react';
import type { NodeType, DirectionName } from '@forgewright/lib/types';
import { DIRECTIONS, NODE_TYPES, DIRECTION_NAMES } from '@forgewright/lib/types';
import { NODE_TYPE_COLORS } from './graph-to-canvas';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LayoutMode = 'circular' | 'force';
export type ScopeMode = 'session' | 'global';

export interface GraphFilters {
  nodeTypes: Set<NodeType>;
  directions: Set<DirectionName>;
  searchQuery: string;
  layoutMode: LayoutMode;
  scope: ScopeMode;
}

export const DEFAULT_FILTERS: GraphFilters = {
  nodeTypes: new Set(NODE_TYPES),
  directions: new Set(DIRECTION_NAMES),
  searchQuery: '',
  layoutMode: 'circular',
  scope: 'session',
};

// ─── Props ───────────────────────────────────────────────────────────────────

export interface GraphToolbarProps {
  filters: GraphFilters;
  onChange: (filters: GraphFilters) => void;
  nodeCount?: number;
  edgeCount?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GraphToolbar({
  filters,
  onChange,
  nodeCount = 0,
  edgeCount = 0,
}: GraphToolbarProps) {
  const [showNodeTypes, setShowNodeTypes] = useState(false);
  const [showDirections, setShowDirections] = useState(false);

  // ── Layout toggle ─────────────────────────────────────────────────────────
  const toggleLayout = useCallback(() => {
    onChange({
      ...filters,
      layoutMode: filters.layoutMode === 'circular' ? 'force' : 'circular',
    });
  }, [filters, onChange]);

  // ── Scope toggle ──────────────────────────────────────────────────────────
  const toggleScope = useCallback(() => {
    onChange({
      ...filters,
      scope: filters.scope === 'session' ? 'global' : 'session',
    });
  }, [filters, onChange]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...filters, searchQuery: e.target.value });
    },
    [filters, onChange],
  );

  // ── Node type toggle ──────────────────────────────────────────────────────
  const toggleNodeType = useCallback(
    (type: NodeType) => {
      const next = new Set(filters.nodeTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      onChange({ ...filters, nodeTypes: next });
    },
    [filters, onChange],
  );

  // ── Direction toggle ──────────────────────────────────────────────────────
  const toggleDirection = useCallback(
    (dir: DirectionName) => {
      const next = new Set(filters.directions);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      onChange({ ...filters, directions: next });
    },
    [filters, onChange],
  );

  const btnClass =
    'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium border transition-colors';
  const activeBtnClass = `${btnClass} border-blue-500/40 bg-blue-500/20 text-blue-300`;
  const inactiveBtnClass = `${btnClass} border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300`;

  return (
    <div className="absolute left-0 top-0 z-20 flex w-full items-center gap-2 border-b border-neutral-700 bg-neutral-900/95 px-3 py-2 backdrop-blur-sm">
      {/* Layout toggle */}
      <button
        onClick={toggleLayout}
        className={filters.layoutMode === 'circular' ? activeBtnClass : inactiveBtnClass}
        title={`Layout: ${filters.layoutMode === 'circular' ? 'Four Directions (circular)' : 'Force-directed'}`}
      >
        {filters.layoutMode === 'circular' ? '🧭' : '🌀'}
        <span>{filters.layoutMode === 'circular' ? 'Four Directions' : 'Force'}</span>
      </button>

      {/* Separator */}
      <div className="h-5 w-px bg-neutral-700" />

      {/* Node type filter */}
      <div className="relative">
        <button
          onClick={() => { setShowNodeTypes(!showNodeTypes); setShowDirections(false); }}
          className={inactiveBtnClass}
        >
          ◉ Types
          {filters.nodeTypes.size < NODE_TYPES.length && (
            <span className="ml-1 rounded-full bg-blue-500/30 px-1.5 text-[10px] text-blue-300">
              {filters.nodeTypes.size}
            </span>
          )}
        </button>
        {showNodeTypes && (
          <div className="absolute left-0 top-full mt-1 z-30 w-48 rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
            {NODE_TYPES.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-700"
              >
                <input
                  type="checkbox"
                  checked={filters.nodeTypes.has(type)}
                  onChange={() => toggleNodeType(type)}
                  className="rounded border-neutral-600 bg-neutral-700 text-blue-500 focus:ring-blue-500/30"
                />
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: NODE_TYPE_COLORS[type].stroke }}
                />
                <span className="text-neutral-200">{type}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Direction filter */}
      <div className="relative">
        <button
          onClick={() => { setShowDirections(!showDirections); setShowNodeTypes(false); }}
          className={inactiveBtnClass}
        >
          🧭 Directions
          {filters.directions.size < DIRECTION_NAMES.length && (
            <span className="ml-1 rounded-full bg-blue-500/30 px-1.5 text-[10px] text-blue-300">
              {filters.directions.size}
            </span>
          )}
        </button>
        {showDirections && (
          <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
            {DIRECTION_NAMES.map((dir) => {
              const info = DIRECTIONS[dir];
              return (
                <label
                  key={dir}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-700"
                >
                  <input
                    type="checkbox"
                    checked={filters.directions.has(dir)}
                    onChange={() => toggleDirection(dir)}
                    className="rounded border-neutral-600 bg-neutral-700 text-blue-500 focus:ring-blue-500/30"
                  />
                  <span>{info.emoji}</span>
                  <span className="text-neutral-200">{info.name}</span>
                  <span className="ml-auto text-neutral-500">{info.ojibwe}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="h-5 w-px bg-neutral-700" />

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <input
          type="text"
          value={filters.searchQuery}
          onChange={handleSearch}
          placeholder="Search nodes…"
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 pl-7 text-xs text-neutral-200 placeholder-neutral-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">
          🔍
        </span>
      </div>

      {/* Scope selector */}
      <button
        onClick={toggleScope}
        className={filters.scope === 'session' ? activeBtnClass : inactiveBtnClass}
        title={`Scope: ${filters.scope}`}
      >
        {filters.scope === 'session' ? '📍' : '🌐'}
        <span>{filters.scope === 'session' ? 'Session' : 'Global'}</span>
      </button>

      {/* Stats */}
      <div className="ml-auto flex items-center gap-2 text-[10px] text-neutral-500">
        <span>{nodeCount} nodes</span>
        <span>·</span>
        <span>{edgeCount} edges</span>
      </div>
    </div>
  );
}
