'use client';

// ─── State Machine View ──────────────────────────────────────────────────────
// Episode diagrams from the Miadi Chronicle, drawn on the stateloom design
// surface. See rispecs/05-visual-designer.spec.md — State Machine View.
//
// The board itself is `@miadi/stateloom-canvas` — the same component the
// stateloom designer mounts, so the two applications navigate identically and
// an improvement to either reaches both. What lives here is what is forgewright's
// own: which diagram is loaded, where its boxes sit, and the panels beside it.
//
// A diagram arrives read-only (the chronicle is read from disk, never written),
// but the *arrangement* is a reader's, not the document's: dragging a box and
// framing the view are remembered in this browser under the diagram's path.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StateMachineCanvas,
  autoLayout,
  IDENTITY_VIEWPORT,
  findState,
  type LayoutBox,
  type StateMachineCanvasHandle,
  type Viewport,
} from '@miadi/stateloom-canvas';
import { useMachineStore } from '@forgewright/stores';
import type { EpisodeDiagramRef } from '@forgewright/lib/chronicle/diagrams';
import type { StateDef, StateMachineDefinition, WorkspaceStateMachine } from '@forgewright/lib/types';
import {
  forgetBoardMemory,
  pruneToDeviations,
  readBoardMemory,
  writeBoardMemory,
} from '@forgewright/lib/designer/layout-memory';
import StatePanel from './StatePanel';
import TransitionPanel from './TransitionPanel';
import EventBar from './EventBar';

const MEMORY_DEBOUNCE_MS = 300;

interface SelectedTransition {
  from: string;
  to: string;
  event: string;
  condition?: string;
  description?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StateMachineView() {
  const currentMachine = useMachineStore((s) => s.currentMachine);
  const currentState = useMachineStore((s) => s.currentState);
  const loadMachine = useMachineStore((s) => s.loadMachine);
  const unloadMachine = useMachineStore((s) => s.unloadMachine);

  // ── Episode diagram picker (GET /api/machines) ──────────────────────────
  const [diagrams, setDiagrams] = useState<EpisodeDiagramRef[]>([]);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [loadingDiagram, setLoadingDiagram] = useState(false);
  const [diagramPath, setDiagramPath] = useState<string | null>(null);

  useEffect(() => {
    if (currentMachine) return;
    let cancelled = false;
    fetch('/api/machines')
      .then(async (response) => {
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setDiagrams(body.data?.diagrams ?? []);
        setDiagramError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDiagramError(error instanceof Error ? error.message : 'Episode diagrams unavailable');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentMachine]);

  // ── Board state ─────────────────────────────────────────────────────────
  const definition = (currentMachine?.definition ?? null) as StateMachineDefinition | null;
  const canvasRef = useRef<StateMachineCanvasHandle>(null);

  const [path, setPath] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ ...IDENTITY_VIEWPORT });
  /** Only what a hand moved. Everything else follows the derivation below. */
  const [dragged, setDragged] = useState<Record<string, LayoutBox>>({});
  const [selection, setSelection] = useState<{ kind: 'state' | 'transition' | null; id: string | null }>({
    kind: null,
    id: null,
  });

  /**
   * The board: derived every render from the definition, then overlaid with
   * whatever was dragged. Deriving first is what keeps a diagram legible on
   * arrival — the layered arrangement is the same one `smcx render` draws —
   * and overlaying second is what makes a drag survive a re-render.
   */
  const derived = useMemo(
    () => (definition ? autoLayout(definition) : ({} as Record<string, LayoutBox>)),
    [definition],
  );
  const positions = useMemo(() => ({ ...derived, ...dragged }), [derived, dragged]);

  // Restore this browser's memory of the diagram as it loads, and drop the
  // previous diagram's drags on the way in.
  useEffect(() => {
    if (!diagramPath) return;
    const remembered = readBoardMemory(diagramPath);
    setDragged(remembered?.positions ?? {});
    if (remembered?.viewport) setViewport(remembered.viewport);
  }, [diagramPath]);

  // …then keep writing it back. Debounced, because a drag is a hundred moves.
  useEffect(() => {
    if (!diagramPath) return;
    const timer = setTimeout(() => {
      writeBoardMemory(diagramPath, pruneToDeviations(positions, derived), viewport);
    }, MEMORY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [diagramPath, positions, derived, viewport]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleStateMove = useCallback((name: string, box: LayoutBox) => {
    setDragged((prev) => ({ ...prev, [name]: box }));
  }, []);

  /** ⚡ Arrange — hand every box back to the layout algorithm, then frame it. */
  const handleArrange = useCallback(() => {
    setDragged({});
    if (diagramPath) forgetBoardMemory(diagramPath);
    requestAnimationFrame(() => canvasRef.current?.fit());
  }, [diagramPath]);

  const handleLoadDiagram = useCallback(
    async (relativePath: string) => {
      setLoadingDiagram(true);
      setDiagramError(null);
      try {
        const response = await fetch(`/api/machines?path=${encodeURIComponent(relativePath)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
        setPath([]);
        setSelection({ kind: null, id: null });
        setDiagramPath(relativePath);
        loadMachine(body.data as WorkspaceStateMachine);
      } catch (error: unknown) {
        setDiagramError(error instanceof Error ? error.message : 'Diagram failed to load');
      } finally {
        setLoadingDiagram(false);
      }
    },
    [loadMachine],
  );

  const handleUnloadMachine = useCallback(() => {
    setPath([]);
    setSelection({ kind: null, id: null });
    setDiagramPath(null);
    unloadMachine();
  }, [unloadMachine]);

  // ── Selected element ────────────────────────────────────────────────────

  const selectedState = useMemo((): StateDef | null => {
    if (!definition || selection.kind !== 'state' || !selection.id) return null;
    return (findState(definition.state, selection.id) as StateDef | null) ?? null;
  }, [definition, selection]);

  /**
   * A transition id is `<sourceState>:<index into its transitions>` — the
   * canvas's own naming, which survives two transitions sharing an event.
   */
  const selectedTransition = useMemo((): SelectedTransition | null => {
    if (!definition || selection.kind !== 'transition' || !selection.id) return null;
    const separator = selection.id.lastIndexOf(':');
    if (separator < 0) return null;
    const sourceName = selection.id.slice(0, separator);
    const index = Number(selection.id.slice(separator + 1));
    const source = findState(definition.state, sourceName) as StateDef | null;
    const transition = source?.transitions?.[index];
    if (!source || !transition) return null;
    return {
      from: source.name,
      to: transition.nextState ?? '(internal)',
      event: transition.event,
      condition: transition.condition,
      description: transition.description,
    };
  }, [definition, selection]);

  // ── Empty state: episode diagram picker ─────────────────────────────────
  if (!definition) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <div className="w-full max-w-md px-6 text-center">
          <p className="font-display text-section text-neutral-300">No state machine loaded</p>
          <p className="mt-1 text-body">Pick an episode diagram to begin</p>
          {diagramError && <p className="mt-3 text-body text-red-400">{diagramError}</p>}
          {!diagramError && diagrams.length === 0 && (
            <p className="mt-3 text-body text-neutral-600">
              No diagrams discovered under the chronicle root
            </p>
          )}
          <ul className="mt-4 space-y-1.5 text-left">
            {diagrams.map((diagram) => (
              <li key={diagram.relativePath}>
                <button
                  onClick={() => handleLoadDiagram(diagram.relativePath)}
                  disabled={loadingDiagram}
                  className="w-full rounded-md border border-fw-border bg-fw-iron px-3 py-2 text-left hover:bg-fw-iron-2 disabled:opacity-40"
                >
                  <span className="block text-body text-neutral-200">{diagram.name}</span>
                  <span className="block text-caption text-neutral-500">{diagram.episode}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board bar — identity on the left, what the board can do on the right.
          Zoom and Fit also live in the canvas's own HUD; these are the same
          actions where a hand already is when it arrives from the picker. */}
      <div className="flex items-center gap-2 border-b border-fw-border bg-fw-iron px-3 py-1.5 text-caption">
        <span className="truncate text-neutral-400" title={currentMachine?.workspaceId}>
          {currentMachine?.workspaceId}
        </span>
        <span className="rounded border border-fw-border bg-fw-iron-2 px-1.5 py-0.5 text-[10px] text-neutral-500">
          read-only
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleArrange}
            className="rounded px-2 py-0.5 text-neutral-400 hover:bg-fw-iron-2 hover:text-neutral-200"
            title="Re-derive the whole arrangement, discarding drags (⚡ Arrange)"
          >
            ⚡ Arrange
          </button>
          <button
            onClick={() => canvasRef.current?.fit()}
            className="rounded px-2 py-0.5 text-neutral-400 hover:bg-fw-iron-2 hover:text-neutral-200"
            title="Frame every state of the current level"
          >
            ⤢ Fit
          </button>
          <button
            onClick={handleUnloadMachine}
            className="rounded px-2 py-0.5 text-neutral-400 hover:bg-fw-iron-2 hover:text-neutral-200"
            title="Unload this diagram and pick another"
          >
            ⏏ Unload
          </button>
        </div>
      </div>

      {/* Main area: canvas + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <StateMachineCanvas
            ref={canvasRef}
            definition={definition}
            positions={positions}
            path={path}
            viewport={viewport}
            onViewportChange={setViewport}
            selection={selection}
            activeStates={currentState ? [currentState] : undefined}
            // A newly-loaded diagram lands framed instead of parked in a corner.
            fitKey={diagramPath ?? undefined}
            onSelect={(kind, id) => setSelection({ kind, id })}
            onClearSelection={() => setSelection({ kind: null, id: null })}
            onStateMove={handleStateMove}
            onNavigateInto={(name) => {
              setPath((prev) => [...prev, name]);
              setSelection({ kind: null, id: null });
            }}
            onNavigateTo={(depth) => {
              setPath((prev) => prev.slice(0, depth));
              setSelection({ kind: null, id: null });
            }}
            emptyHint="This state has no children to draw"
          />
        </div>

        {/* Side panel */}
        {(selectedState || selectedTransition) && (
          <div className="w-72 shrink-0 overflow-y-auto border-l border-fw-border bg-fw-iron">
            {selectedState && (
              <StatePanel
                state={selectedState}
                onNavigateInto={(name) => {
                  setPath((prev) => [...prev, name]);
                  setSelection({ kind: null, id: null });
                }}
              />
            )}
            {selectedTransition && <TransitionPanel transition={selectedTransition} />}
          </div>
        )}
      </div>

      {/* Event bar */}
      <EventBar />
    </div>
  );
}
