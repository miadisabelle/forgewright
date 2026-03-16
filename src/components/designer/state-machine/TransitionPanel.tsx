'use client';

// ─── Transition Panel ────────────────────────────────────────────────────────
// Side panel showing details of a selected transition: source, target, event,
// guard, action. Supports inline editing and deletion.
// See rispecs/05-visual-designer.spec.md — State Machine View interactions.

import React, { useCallback, useState } from 'react';
import type { CanvasEdge as CanvasEdgeType } from '../canvas/types';
import { useDesignerStore } from '@forgewright/stores';

// ─── Props ───────────────────────────────────────────────────────────────────

interface TransitionPanelProps {
  edge: CanvasEdgeType;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLabel(label?: string): { event: string; guard?: string } {
  if (!label) return { event: '' };
  const match = label.match(/^(.+?)\s*\[(.+)\]$/);
  if (match) return { event: match[1].trim(), guard: match[2].trim() };
  return { event: label.trim() };
}

function buildLabel(event: string, guard?: string): string {
  if (guard) return `${event} [${guard}]`;
  return event;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TransitionPanel({ edge }: TransitionPanelProps) {
  const removeEdge = useDesignerStore((s) => s.removeEdge);
  const addEdge = useDesignerStore((s) => s.addEdge);

  const parsed = parseLabel(edge.label);
  const [eventName, setEventName] = useState(parsed.event);
  const [guard, setGuard] = useState(parsed.guard ?? '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = useCallback(() => {
    if (!eventName.trim()) return;
    // Remove old edge, add updated one (edges are immutable in the store)
    removeEdge(edge.id);
    const newLabel = buildLabel(eventName.trim(), guard.trim() || undefined);
    addEdge({
      id: `${edge.source}-${eventName.trim()}-${edge.target}`,
      sourceId: edge.source,
      targetId: edge.target,
      event: eventName.trim(),
      condition: guard.trim() || undefined,
      label: newLabel,
    });
    setIsEditing(false);
  }, [edge, eventName, guard, removeEdge, addEdge]);

  const handleDelete = useCallback(() => {
    removeEdge(edge.id);
  }, [edge.id, removeEdge]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      const p = parseLabel(edge.label);
      setEventName(p.event);
      setGuard(p.guard ?? '');
      setIsEditing(false);
    }
  }, [handleSave, edge.label]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div>
        <span className="rounded border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
          Transition
        </span>
      </div>

      {/* Source → Target */}
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-neutral-200">
          {edge.source}
        </span>
        <span className="text-neutral-500">→</span>
        <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-neutral-200">
          {edge.target}
        </span>
      </div>

      {/* Event Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-400">
          Event
        </label>
        {isEditing ? (
          <input
            autoFocus
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none ring-1 ring-blue-500"
            placeholder="Event name"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-amber-400">{parsed.event || '(none)'}</span>
            <button
              onClick={() => setIsEditing(true)}
              className="text-[10px] text-neutral-500 hover:text-neutral-300"
              title="Edit"
            >
              ✎
            </button>
          </div>
        )}
      </div>

      {/* Guard Condition */}
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-400">
          Guard Condition
        </label>
        {isEditing ? (
          <input
            value={guard}
            onChange={(e) => setGuard(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none ring-1 ring-neutral-600 focus:ring-blue-500"
            placeholder="Optional guard expression"
          />
        ) : (
          <span className="font-mono text-sm text-neutral-400">
            {parsed.guard || '(none)'}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
            >
              Save
            </button>
            <button
              onClick={() => {
                const p = parseLabel(edge.label);
                setEventName(p.event);
                setGuard(p.guard ?? '');
                setIsEditing(false);
              }}
              className="rounded bg-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-600"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded bg-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-600"
          >
            Edit
          </button>
        )}
        <button
          onClick={handleDelete}
          className="ml-auto rounded bg-red-900/60 px-3 py-1 text-xs text-red-300 hover:bg-red-800/60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
