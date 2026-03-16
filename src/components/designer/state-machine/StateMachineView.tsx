'use client';

// ─── State Machine View ──────────────────────────────────────────────────────
// Main view: renders SMDF as an interactive canvas with composite drill-down,
// context menus, and live state highlighting.
// See rispecs/05-visual-designer.spec.md — State Machine View.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasEngine, hierarchicalLayout } from '../canvas';
import type {
  CanvasNode as CanvasNodeType,
  CanvasEdge as CanvasEdgeType,
  CanvasMode,
  ContextMenuItem,
  SelectionState,
  Viewport,
} from '../canvas/types';
import { useDesignerStore } from '@forgewright/stores';
import { useMachineStore } from '@forgewright/stores';
import { smdfToCanvas, classifyState } from './smdf-to-canvas';
import StatePanel from './StatePanel';
import TransitionPanel from './TransitionPanel';
import EventBar from './EventBar';

// ─── Context Menu Actions ────────────────────────────────────────────────────

const CANVAS_CONTEXT_ITEMS: ContextMenuItem[] = [
  { label: 'Add State', action: 'add_state', icon: '＋' },
  { label: 'Add Transition', action: 'add_transition', icon: '→' },
];

const NODE_CONTEXT_ITEMS: ContextMenuItem[] = [
  { label: 'Set Initial', action: 'set_initial', icon: '◉' },
  { label: 'Delete State', action: 'delete_state', icon: '✕' },
  { label: 'Add Transition From', action: 'add_transition_from', icon: '→' },
];

const EDGE_CONTEXT_ITEMS: ContextMenuItem[] = [
  { label: 'Delete Transition', action: 'delete_transition', icon: '✕' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function StateMachineView() {
  const {
    navigationPath,
    selection,
    mode,
    viewport,
    navigateInto,
    navigateUp,
    navigateToRoot,
    setSelection,
    setMode,
    setViewport,
    addNode,
    removeNode,
    moveNode,
    addEdge,
    removeEdge,
  } = useDesignerStore();

  const {
    currentMachine,
    currentState,
  } = useMachineStore();

  const [contextTarget, setContextTarget] = useState<{
    kind: 'node' | 'edge' | 'canvas';
    id?: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectionKind, setSelectionKind] = useState<'node' | 'edge' | null>(null);
  const stateCounter = useRef(0);

  // ── Derive canvas data from SMDF ────────────────────────────────────────
  const definition = currentMachine?.definition ?? null;

  const { canvasNodes, canvasEdges } = useMemo(() => {
    if (!definition) return { canvasNodes: [], canvasEdges: [] };
    const { nodes, edges } = smdfToCanvas(definition, navigationPath);
    const laid = hierarchicalLayout(nodes, edges);
    return { canvasNodes: laid, canvasEdges: edges };
  }, [definition, navigationPath]);

  // ── Context menu items for current target ───────────────────────────────
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextTarget) return [];
    switch (contextTarget.kind) {
      case 'node': return NODE_CONTEXT_ITEMS;
      case 'edge': return EDGE_CONTEXT_ITEMS;
      case 'canvas': return CANVAS_CONTEXT_ITEMS;
      default: return [];
    }
  }, [contextTarget]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelection(nodeId);
    setSelectionKind('node');
  }, [setSelection]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    if (!definition) return;
    const { nodes } = smdfToCanvas(definition, [...navigationPath, nodeId]);
    if (nodes.length > 0) {
      navigateInto(nodeId);
    }
  }, [definition, navigationPath, navigateInto]);

  const handleEdgeDraw = useCallback((sourceId: string, targetId: string) => {
    const eventName = `Ev${targetId}`;
    addEdge({
      id: `${sourceId}-${eventName}-${targetId}`,
      sourceId,
      targetId,
      event: eventName,
      label: eventName,
    });
    setMode('select');
  }, [addEdge, setMode]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelection(edgeId);
    setSelectionKind('edge');
  }, [setSelection]);

  const handleContextMenu = useCallback(
    (x: number, y: number, target: { kind: 'node' | 'edge' | 'canvas'; id?: string }) => {
      setContextTarget({ ...target, x, y });
    },
    [],
  );

  const handleContextAction = useCallback((action: string) => {
    switch (action) {
      case 'add_state': {
        stateCounter.current += 1;
        const name = `NewState${stateCounter.current}`;
        addNode({
          id: name,
          name,
          kind: 'normal',
          x: (contextTarget?.x ?? 200) / (viewport.zoom || 1) - viewport.x,
          y: (contextTarget?.y ?? 200) / (viewport.zoom || 1) - viewport.y,
          width: 150,
          height: 50,
          parentId: navigationPath.length > 0
            ? navigationPath[navigationPath.length - 1]
            : null,
        });
        break;
      }
      case 'add_transition':
      case 'add_transition_from':
        setMode('transition');
        break;
      case 'delete_state':
        if (contextTarget?.id) removeNode(contextTarget.id);
        break;
      case 'delete_transition':
        if (contextTarget?.id) removeEdge(contextTarget.id);
        break;
      case 'set_initial':
        // Initial state = first in the states array (SMDF convention)
        break;
    }
    setContextTarget(null);
  }, [contextTarget, viewport, navigationPath, addNode, removeNode, removeEdge, setMode]);

  const handleSelectionChange = useCallback((sel: SelectionState) => {
    setSelection(sel.id);
    setSelectionKind(sel.kind);
  }, [setSelection]);

  const handleViewportChange = useCallback((vp: Viewport) => {
    setViewport(vp);
  }, [setViewport]);

  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    moveNode(nodeId, x, y);
  }, [moveNode]);

  // ── Breadcrumb navigation ───────────────────────────────────────────────
  const breadcrumb = useMemo(() => {
    const parts: Array<{ label: string; action: () => void }> = [
      { label: 'Root', action: navigateToRoot },
    ];
    navigationPath.forEach((segment, idx) => {
      const pathToHere = navigationPath.slice(0, idx + 1);
      parts.push({
        label: segment,
        action: () => {
          // Navigate to this specific level
          navigateToRoot();
          for (const s of pathToHere) navigateInto(s);
        },
      });
    });
    return parts;
  }, [navigationPath, navigateToRoot, navigateInto]);

  // ── Selected state/edge data ────────────────────────────────────────────
  const selectedState = useMemo(() => {
    if (!definition || !selection || selectionKind !== 'node') return null;
    return findStateInDef(definition.state, selection);
  }, [definition, selection, selectionKind]);

  const selectedEdge = useMemo(() => {
    if (!selection || selectionKind !== 'edge') return null;
    return canvasEdges.find((e) => e.id === selection) ?? null;
  }, [canvasEdges, selection, selectionKind]);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!definition) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <div className="text-center">
          <p className="text-lg">No state machine loaded</p>
          <p className="mt-1 text-sm">Load a workspace with an SMDF definition to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 border-b border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs">
        {breadcrumb.map((part, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-neutral-600">›</span>}
            <button
              onClick={part.action}
              className={`rounded px-1.5 py-0.5 ${
                idx === breadcrumb.length - 1
                  ? 'text-neutral-200 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {part.label}
            </button>
          </React.Fragment>
        ))}

        {/* Mode toggle */}
        <div className="ml-auto flex items-center gap-1">
          {(['select', 'transition', 'pan'] as CanvasMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m as 'select' | 'transition' | 'pan')}
              className={`rounded px-2 py-0.5 text-xs ${
                mode === m
                  ? 'bg-neutral-700 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              {m === 'select' ? '⎋ Select' : m === 'transition' ? '→ Draw' : '✋ Pan'}
            </button>
          ))}
        </div>
      </div>

      {/* Main area: canvas + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="relative flex-1">
          <CanvasEngine
            nodes={canvasNodes}
            edges={canvasEdges}
            mode={mode as CanvasMode}
            activeNodeId={currentState}
            viewport={{ x: viewport.x, y: viewport.y, zoom: viewport.zoom }}
            contextMenuItems={contextMenuItems}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeDraw={handleEdgeDraw}
            onEdgeClick={handleEdgeClick}
            onContextMenu={handleContextMenu}
            onSelectionChange={handleSelectionChange}
            onViewportChange={handleViewportChange}
            onNodeMove={handleNodeMove}
          />

          {/* Context menu action handler overlay */}
          {contextTarget && contextMenuItems.length > 0 && (
            <div className="absolute inset-0 z-40" onClick={() => setContextTarget(null)}>
              <div
                className="absolute z-50 min-w-[160px] rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-xl"
                style={{ left: contextTarget.x, top: contextTarget.y }}
                onClick={(e) => e.stopPropagation()}
              >
                {contextMenuItems.map((item) => (
                  <button
                    key={item.action}
                    disabled={item.disabled}
                    onClick={() => handleContextAction(item.action)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
                  >
                    {item.icon && <span className="w-4 text-center">{item.icon}</span>}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        {(selectedState || selectedEdge) && (
          <div className="w-72 shrink-0 overflow-y-auto border-l border-neutral-700 bg-neutral-900">
            {selectedState && selectionKind === 'node' && (
              <StatePanel state={selectedState} />
            )}
            {selectedEdge && selectionKind === 'edge' && (
              <TransitionPanel edge={selectedEdge} />
            )}
          </div>
        )}
      </div>

      {/* Event bar */}
      <EventBar />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findStateInDef(
  root: import('@forgewright/lib/types').StateDef,
  name: string,
): import('@forgewright/lib/types').StateDef | null {
  if (root.name === name) return root;
  for (const child of root.states ?? []) {
    const found = findStateInDef(child, name);
    if (found) return found;
  }
  if (root.parallel) {
    for (const child of root.parallel.states) {
      const found = findStateInDef(child, name);
      if (found) return found;
    }
  }
  return null;
}
