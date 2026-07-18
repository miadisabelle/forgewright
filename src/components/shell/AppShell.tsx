'use client';

import { useState, useEffect } from 'react';
import MedicineWheelSidebar from '@forgewright/components/medicine-wheel/MedicineWheelSidebar';
import Toolbar, { type ViewTab } from './Toolbar';
import StatusBar from './StatusBar';
import ContextPanel from './ContextPanel';
import ViewRouter from './ViewRouter';

// ─── Responsive hook ──────────────────────────────────────────────────────────

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AppShellProps {
  children?: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<ViewTab>('state-machine');

  // Auto-collapse sidebars below 1024px
  useEffect(() => {
    if (isNarrow) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [isNarrow]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Top toolbar */}
      <Toolbar activeView={activeView} onViewChange={setActiveView} />

      {/* Three-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Medicine Wheel Sidebar */}
        <MedicineWheelSidebar
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((p) => !p)}
        />

        {/* Center: Main content area */}
        <main className="flex-1 overflow-auto bg-neutral-900">
          {children ?? <ViewRouter activeView={activeView} />}
        </main>

        {/* Right: Context Panel */}
        <ContextPanel
          collapsed={rightCollapsed}
          onToggle={() => setRightCollapsed((p) => !p)}
        />
      </div>

      {/* Bottom status bar — wheel liveness lives here */}
      <StatusBar />
    </div>
  );
}
