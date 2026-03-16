'use client';

import { useState, useCallback } from 'react';
import { useSessionStore, useSpiralStore, useCeremonyStore } from '@forgewright/stores';
import { DIRECTIONS } from '@forgewright/lib/types';

// ─── Phase colors ─────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  preparation:  'bg-amber-900/60 text-amber-300',
  opening:      'bg-emerald-900/60 text-emerald-300',
  active:       'bg-blue-900/60 text-blue-300',
  integration:  'bg-purple-900/60 text-purple-300',
  closing:      'bg-neutral-800 text-neutral-400',
};

// ─── View tabs ────────────────────────────────────────────────────────────────

export type ViewTab = 'state-machine' | 'graph' | 'chronicle';

interface ToolbarProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
}

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: 'state-machine', label: 'State Machine' },
  { id: 'graph', label: 'Graph' },
  { id: 'chronicle', label: 'Chronicle' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Toolbar({ activeView, onViewChange }: ToolbarProps) {
  const currentSession = useSessionStore((s) => s.currentSession);
  const currentDirection = useSpiralStore((s) => s.currentDirection);
  const cycleCount = useSpiralStore((s) => s.cycleCount);
  const currentPhase = useCeremonyStore((s) => s.currentPhase);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editValue, setEditValue] = useState('');

  const directionInfo = DIRECTIONS[currentDirection];
  const phaseColor = PHASE_COLORS[currentPhase] ?? PHASE_COLORS.closing;

  const handleNameClick = useCallback(() => {
    if (!currentSession) return;
    setEditValue(currentSession.intent);
    setIsEditingName(true);
  }, [currentSession]);

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setIsEditingName(false);
      } else if (e.key === 'Escape') {
        setIsEditingName(false);
      }
    },
    [],
  );

  return (
    <header className="flex h-10 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
      {/* Left: Session name + Spiral position */}
      <div className="flex items-center gap-4">
        {/* Session name */}
        {currentSession ? (
          isEditingName ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="w-48 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-white outline-none focus:border-neutral-500"
            />
          ) : (
            <button
              onClick={handleNameClick}
              className="max-w-48 truncate text-xs font-medium text-neutral-200 hover:text-white transition-colors"
              title="Click to edit session name"
            >
              {currentSession.intent}
            </button>
          )
        ) : (
          <span className="text-xs text-neutral-500 italic">No session</span>
        )}

        {/* Spiral position */}
        <span className="hidden sm:inline-flex items-center gap-1 rounded bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-300 border border-neutral-800">
          Cycle {cycleCount} / {directionInfo.emoji} {directionInfo.name}
        </span>

        {/* Ceremony phase badge */}
        <span className={`hidden md:inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${phaseColor}`}>
          {currentPhase}
        </span>
      </div>

      {/* Right: View switcher */}
      <nav className="flex items-center gap-0.5" role="tablist" aria-label="Designer views">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeView === tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeView === tab.id
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
