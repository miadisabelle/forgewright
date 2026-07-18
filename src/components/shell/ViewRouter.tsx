'use client';

import { Suspense, lazy } from 'react';
import type { ViewTab } from './Toolbar';

// ─── Lazy-loaded views ───────────────────────────────────────────────────────

const StateMachineView = lazy(
  () => import('@forgewright/components/designer/state-machine/StateMachineView')
);
const ChronicleView = lazy(
  () => import('@forgewright/components/chronicle/ChronicleView')
);

// ─── Loading fallback ────────────────────────────────────────────────────────

function ViewLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-2 text-neutral-500 text-sm animate-pulse">{label}</div>
        <div className="flex items-center justify-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-600 animate-pulse" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-600 animate-pulse delay-75" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-600 animate-pulse delay-150" />
        </div>
      </div>
    </div>
  );
}

// ─── Graph placeholder ───────────────────────────────────────────────────────

function GraphViewPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm px-6 text-center">
        <p className="font-display text-section text-neutral-300">Relational graph</p>
        <p className="mt-2 text-body text-neutral-500">
          Not wired yet. This view will draw kinship networks in a Four Directions
          circular layout once the graph substrate connects.
        </p>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ViewRouterProps {
  activeView: ViewTab;
}

export default function ViewRouter({ activeView }: ViewRouterProps) {
  switch (activeView) {
    case 'state-machine':
      return (
        <Suspense fallback={<ViewLoading label="Loading State Machine Designer…" />}>
          <StateMachineView />
        </Suspense>
      );
    case 'graph':
      return <GraphViewPlaceholder />;
    case 'chronicle':
      return (
        <Suspense fallback={<ViewLoading label="Loading Miadi Chronicle…" />}>
          <ChronicleView />
        </Suspense>
      );
    default:
      return null;
  }
}
