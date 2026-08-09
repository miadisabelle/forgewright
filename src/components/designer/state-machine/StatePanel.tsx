'use client';

// ─── State Panel ─────────────────────────────────────────────────────────────
// Side panel showing details of a selected state: name, type, actions, transitions.
// See rispecs/05-visual-designer.spec.md — State Machine View interactions.

import React from 'react';
import type { StateDef, ActionDef } from '@forgewright/lib/types';
import { classifyState } from './smdf-to-canvas';

// ─── Props ───────────────────────────────────────────────────────────────────

interface StatePanelProps {
  state: StateDef;
  /** Drill into this state's children. Absent for a state that has none. */
  onNavigateInto?: (name: string) => void;
}

// ─── Type Badge Colors ───────────────────────────────────────────────────────

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  atomic:    { label: 'Atomic',    color: 'bg-blue-900/50 text-blue-300 border-blue-700' },
  composite: { label: 'Composite', color: 'bg-green-900/50 text-green-300 border-green-700' },
  parallel:  { label: 'Parallel',  color: 'bg-purple-900/50 text-purple-300 border-purple-700' },
  final:     { label: 'Final',     color: 'bg-neutral-800 text-neutral-300 border-neutral-600' },
  history:   { label: 'History',   color: 'bg-violet-900/50 text-violet-300 border-violet-700' },
};

// ─── Component ───────────────────────────────────────────────────────────────

// Read-only, because the diagram is: episode diagrams are read from the
// chronicle on disk and never written back, so the rename this panel used to
// offer wrote into a store nothing rendered.
export default function StatePanel({ state, onNavigateInto }: StatePanelProps) {
  const stateType = classifyState(state);
  const badge = TYPE_BADGES[stateType] ?? TYPE_BADGES.atomic;
  const hasChildren = stateType === 'composite' || stateType === 'parallel';

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${badge.color}`}>
            {badge.label}
          </span>
          {hasChildren && onNavigateInto && (
            <button
              onClick={() => onNavigateInto(state.name)}
              className="text-[10px] text-blue-400 hover:text-blue-300"
              title="Drill into children"
            >
              Drill ▸
            </button>
          )}
        </div>

        <h3 className="text-body font-semibold text-neutral-100">{state.name}</h3>

        {state.description && (
          <p className="mt-1 text-xs text-neutral-400">{state.description}</p>
        )}
      </div>

      {/* Entry Actions */}
      <ActionSection title="Entry Actions" actions={state.onEntry?.actions} />

      {/* Exit Actions */}
      <ActionSection title="Exit Actions" actions={state.onExit?.actions} />

      {/* Outgoing Transitions */}
      {state.transitions && state.transitions.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-medium text-neutral-400">
            Outgoing Transitions ({state.transitions.length})
          </h4>
          <div className="flex flex-col gap-1">
            {state.transitions.map((t, idx) => (
              <div
                key={`${t.event}-${t.nextState ?? 'self'}-${idx}`}
                className="rounded border border-neutral-700 bg-neutral-800/50 px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-amber-400">{t.event}</span>
                  {t.nextState && (
                    <>
                      <span className="text-neutral-600">→</span>
                      <span className="text-neutral-200">{t.nextState}</span>
                    </>
                  )}
                </div>
                {t.condition && (
                  <div className="mt-0.5 text-neutral-500">
                    guard: <span className="font-mono text-neutral-400">{t.condition}</span>
                  </div>
                )}
                {t.description && (
                  <div className="mt-0.5 text-neutral-500">{t.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Child States (for composite/parallel) */}
      {hasChildren && (
        <div>
          <h4 className="mb-1.5 text-xs font-medium text-neutral-400">
            Child States
          </h4>
          <div className="flex flex-wrap gap-1">
            {(state.states ?? state.parallel?.states ?? []).map((child) => (
              <span
                key={child.name}
                className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
              >
                {child.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action List Sub-Component ───────────────────────────────────────────────

function ActionSection({
  title,
  actions,
}: {
  title: string;
  actions?: ActionDef[];
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium text-neutral-400">{title}</h4>
      <div className="flex flex-col gap-1">
        {actions.map((action, idx) => (
          <div
            key={idx}
            className="rounded border border-neutral-700 bg-neutral-800/50 px-2.5 py-1.5 font-mono text-xs text-neutral-300"
          >
            {action.code && <span>{action.code}</span>}
            {action.timerStart && (
              <span>
                timer.start({action.timerStart.timer}, {action.timerStart.duration})
              </span>
            )}
            {action.timerStop && <span>timer.stop({action.timerStop})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
