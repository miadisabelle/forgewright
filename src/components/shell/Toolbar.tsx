'use client';

import { useState, useCallback } from 'react';
import { useSessionStore, useSpiralStore, useCeremonyStore } from '@forgewright/stores';
import { DIRECTIONS } from '@forgewright/lib/types';

// ─── View tabs ────────────────────────────────────────────────────────────────

export type ViewTab = 'state-machine' | 'graph' | 'chronicle';

interface ToolbarProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
}

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: 'state-machine', label: 'State machine' },
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
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
      {/* Left: wordmark + session + spiral position */}
      <div className="flex items-center gap-4">
        {/* Wordmark — the one place the slab speaks for the product */}
        <span className="font-display text-[15px] font-bold tracking-tight text-neutral-100">
          Forgewright
        </span>

        <span aria-hidden className="h-4 w-px bg-neutral-800" />

        {/* Session name */}
        {currentSession ? (
          isEditingName ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              aria-label="Session name"
              className="w-48 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-caption text-neutral-100"
            />
          ) : (
            <button
              onClick={handleNameClick}
              className="max-w-48 truncate rounded text-caption font-medium text-neutral-200 transition-colors duration-(--fw-dur-fast) hover:text-neutral-100"
              title="Edit session name"
            >
              {currentSession.intent}
            </button>
          )
        ) : (
          <span className="text-caption text-neutral-500">No session yet</span>
        )}

        {/* Spiral position */}
        <span className="hidden items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-caption text-neutral-300 sm:inline-flex">
          Cycle{' '}
          <span className="font-mono font-medium tabular-nums text-neutral-200">
            {cycleCount}
          </span>{' '}
          <span aria-hidden>{directionInfo.emoji}</span> {directionInfo.name}
        </span>

        {/* Ceremony phase badge */}
        <span className="hidden items-center rounded bg-neutral-800 px-2 py-0.5 text-caption font-medium text-neutral-300 capitalize md:inline-flex">
          {currentPhase}
        </span>
      </div>

      {/* Right: view switcher */}
      <nav className="flex items-center gap-1" role="tablist" aria-label="Designer views">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeView === tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`rounded px-3 py-1.5 text-caption font-medium transition-colors duration-(--fw-dur-fast) ${
              activeView === tab.id
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
