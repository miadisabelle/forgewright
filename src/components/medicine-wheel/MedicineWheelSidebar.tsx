'use client';

import { useSessionStore } from '@forgewright/stores';
import { useSpiralStore } from '@forgewright/stores';
import { DIRECTIONS, type DirectionName } from '@forgewright/lib/types';
import WheelDiagram from './WheelDiagram';

// ─── Direction ink (AA on coal) ──────────────────────────────────────────────

const DIRECTION_INK: Record<DirectionName, string> = {
  east: 'text-forge-east-ink',
  south: 'text-forge-south-ink',
  west: 'text-forge-west-ink',
  north: 'text-forge-north-ink',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface MedicineWheelSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function MedicineWheelSidebar({
  collapsed = false,
  onToggle,
}: MedicineWheelSidebarProps) {
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
          onClick={onToggle}
          className="mb-4 rounded px-1.5 py-0.5 text-sm text-neutral-400 transition-colors duration-(--fw-dur-fast) hover:bg-neutral-900 hover:text-neutral-100"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          »
        </button>
        <div
          className="text-2xl"
          title={`${DIRECTIONS[currentDirection].name} — ${DIRECTIONS[currentDirection].ojibwe}`}
        >
          {DIRECTIONS[currentDirection].emoji}
        </div>
        <span className="mt-1 font-mono text-[10px] tabular-nums text-neutral-500">
          {cycleCount}
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-70 flex-col border-r border-neutral-800 bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <span className="font-display text-[13px] font-semibold tracking-wide text-neutral-200">
          Medicine Wheel
        </span>
        <button
          onClick={onToggle}
          className="rounded px-1.5 py-0.5 text-sm text-neutral-400 transition-colors duration-(--fw-dur-fast) hover:bg-neutral-900 hover:text-neutral-100"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          «
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
          <span aria-hidden className="text-xl">{DIRECTIONS[currentDirection].emoji}</span>
          <div>
            <p className={`text-body font-semibold ${DIRECTION_INK[currentDirection]}`}>
              {DIRECTIONS[currentDirection].name}
            </p>
            <p className="text-caption text-neutral-400">
              {DIRECTIONS[currentDirection].ojibwe} · {DIRECTIONS[currentDirection].season}
            </p>
          </div>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto border-t border-neutral-800">
        <div className="px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Sessions
          </span>
        </div>
        {sessions.length === 0 ? (
          <p className="px-4 text-caption text-neutral-500">
            No sessions yet. One appears here when a ceremony opens.
          </p>
        ) : (
          <ul className="space-y-0.5 px-2">
            {sessions.map((session) => {
              const isActive = currentSession?.id === session.id;
              const isLive = session.status === 'active';
              return (
                <li key={session.id}>
                  <button
                    onClick={() => resumeSession(session.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-caption transition-colors duration-(--fw-dur-fast) ${
                      isActive
                        ? 'bg-neutral-800 text-neutral-100'
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                    }`}
                  >
                    <span className="block truncate font-medium">{session.intent}</span>
                    <span className="block text-[10px] text-neutral-500">
                      <span aria-hidden>
                        {DIRECTIONS[session.spiralPosition.direction].emoji}
                      </span>{' '}
                      Cycle{' '}
                      <span className="font-mono tabular-nums">
                        {session.spiralPosition.cycleCount}
                      </span>{' '}
                      ·{' '}
                      {/* A live session is one of the few things allowed to wear ember (color only — it never glows) */}
                      <span className={isLive ? 'text-ember' : undefined}>{session.status}</span>
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
