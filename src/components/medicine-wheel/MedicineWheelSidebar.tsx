'use client';

import { useState } from 'react';
import { useSessionStore } from '@forgewright/stores';
import { useSpiralStore } from '@forgewright/stores';
import { DIRECTIONS, type DirectionName } from '@forgewright/lib/types';
import WheelDiagram from './WheelDiagram';

// ─── Component ────────────────────────────────────────────────────────────────

export default function MedicineWheelSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const currentDirection = useSpiralStore((s) => s.currentDirection);
  const cycleCount = useSpiralStore((s) => s.cycleCount);
  const setDirection = useSpiralStore((s) => s.setDirection);

  const sessions = useSessionStore((s) => s.sessions);
  const currentSession = useSessionStore((s) => s.currentSession);
  const resumeSession = useSessionStore((s) => s.resumeSession);

  const handleDirectionClick = (direction: DirectionName) => {
    setDirection(direction);
  };

  // Collapsed state — icon rail
  if (collapsed) {
    return (
      <aside className="flex h-full w-12 flex-col items-center border-r border-neutral-800 bg-neutral-950 py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="mb-4 text-lg text-neutral-400 hover:text-white transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          ☰
        </button>
        <div className="text-2xl" title={`${DIRECTIONS[currentDirection].name} — ${DIRECTIONS[currentDirection].ojibwe}`}>
          {DIRECTIONS[currentDirection].emoji}
        </div>
        <span className="mt-1 text-[10px] text-neutral-500">{cycleCount}</span>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-70 flex-col border-r border-neutral-800 bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <span className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
          Medicine Wheel
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-neutral-500 hover:text-white transition-colors text-sm"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          ◀
        </button>
      </div>

      {/* Wheel Diagram */}
      <div className="flex justify-center px-4 py-5">
        <WheelDiagram
          activeDirection={currentDirection}
          cycleCount={cycleCount}
          onDirectionClick={handleDirectionClick}
          size={220}
        />
      </div>

      {/* Current direction info */}
      <div className="border-t border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{DIRECTIONS[currentDirection].emoji}</span>
          <div>
            <p className="text-sm font-semibold text-white">
              {DIRECTIONS[currentDirection].name}
            </p>
            <p className="text-xs text-neutral-400">
              {DIRECTIONS[currentDirection].ojibwe} · {DIRECTIONS[currentDirection].season}
            </p>
          </div>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto border-t border-neutral-800">
        <div className="px-4 py-2">
          <span className="text-[10px] font-semibold tracking-widest text-neutral-500 uppercase">
            Sessions
          </span>
        </div>
        {sessions.length === 0 ? (
          <p className="px-4 text-xs text-neutral-600">No sessions yet</p>
        ) : (
          <ul className="space-y-0.5 px-2">
            {sessions.map((session) => {
              const isActive = currentSession?.id === session.id;
              return (
                <li key={session.id}>
                  <button
                    onClick={() => resumeSession(session.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                      isActive
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                    }`}
                  >
                    <span className="block truncate font-medium">{session.intent}</span>
                    <span className="block text-[10px] text-neutral-500">
                      {DIRECTIONS[session.spiralPosition.direction].emoji}{' '}
                      Cycle {session.spiralPosition.cycleCount} · {session.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
