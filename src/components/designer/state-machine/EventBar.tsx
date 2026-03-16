'use client';

// ─── Event Bar ───────────────────────────────────────────────────────────────
// Bottom bar for firing events on the running state machine.
// Shows available events for the current state and an event history log.
// See rispecs/05-visual-designer.spec.md — Live State Indicator.

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { useMachineStore } from '@forgewright/stores';
import { getAvailableEvents, getAllDefinedEvents } from './smdf-to-canvas';

// ─── Component ───────────────────────────────────────────────────────────────

export default function EventBar() {
  const {
    currentMachine,
    currentState,
    eventHistory,
    fireEvent,
  } = useMachineStore();

  const logRef = useRef<HTMLDivElement>(null);

  const definition = currentMachine?.definition ?? null;

  // Available events from current state's transitions
  const availableEvents = useMemo(() => {
    if (!definition || !currentState) return [];
    return getAvailableEvents(definition, currentState);
  }, [definition, currentState]);

  // All defined events (for reference)
  const allEvents = useMemo(() => {
    if (!definition) return [];
    return getAllDefinedEvents(definition);
  }, [definition]);

  // Auto-scroll log to top (latest first)
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [eventHistory.length]);

  const handleFireEvent = useCallback((eventId: string, toState: string) => {
    fireEvent({ eventId, toState });
  }, [fireEvent]);

  if (!definition) return null;

  const reversedHistory = [...eventHistory].reverse();

  return (
    <div className="flex shrink-0 border-t border-neutral-700 bg-neutral-900">
      {/* Available Events */}
      <div className="flex flex-1 flex-col border-r border-neutral-700 p-2">
        <div className="mb-1.5 flex items-center gap-2">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Events
          </h4>
          {currentState && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
              from: <span className="text-neutral-200">{currentState}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {availableEvents.length > 0 ? (
            availableEvents.map((evt) => (
              <button
                key={`${evt.event}-${evt.target}`}
                onClick={() => handleFireEvent(evt.event, evt.target)}
                className="group flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs hover:border-amber-600 hover:bg-amber-900/30"
                title={evt.guard ? `Guard: ${evt.guard}` : undefined}
              >
                <span className="text-amber-400 group-hover:text-amber-300">
                  {evt.event}
                </span>
                <span className="text-neutral-600">→</span>
                <span className="text-neutral-400 group-hover:text-neutral-200">
                  {evt.target}
                </span>
                {evt.guard && (
                  <span className="text-[9px] text-neutral-600">[{evt.guard}]</span>
                )}
              </button>
            ))
          ) : (
            <span className="text-xs text-neutral-600 italic">
              {currentState ? 'No transitions from current state' : 'No state machine running'}
            </span>
          )}
        </div>
      </div>

      {/* Event History Log */}
      <div className="flex w-80 shrink-0 flex-col p-2">
        <div className="mb-1.5 flex items-center gap-2">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            History
          </h4>
          <span className="text-[10px] text-neutral-600">
            {eventHistory.length} event{eventHistory.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div
          ref={logRef}
          className="max-h-24 overflow-y-auto text-xs"
        >
          {reversedHistory.length > 0 ? (
            reversedHistory.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center gap-1.5 border-b border-neutral-800 py-0.5 last:border-0"
              >
                <span className="shrink-0 text-[9px] text-neutral-600">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-mono text-amber-400/80">{evt.eventId}</span>
                <span className="text-neutral-600">:</span>
                <span className="text-neutral-500">{evt.fromState}</span>
                <span className="text-neutral-700">→</span>
                <span className="text-neutral-300">{evt.toState}</span>
              </div>
            ))
          ) : (
            <span className="text-neutral-600 italic">No events fired yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
