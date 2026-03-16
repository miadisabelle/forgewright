'use client';

import { Suspense, lazy } from 'react';
import type { ViewTab } from './Toolbar';

// ─── Lazy-loaded views ───────────────────────────────────────────────────────

const StateMachineView = lazy(
  () => import('@forgewright/components/designer/state-machine/StateMachineView')
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
      <div className="text-center">
        <p className="text-lg text-neutral-400">🕸️ Graph View</p>
        <p className="mt-1 text-sm text-neutral-600">Building relational visualization…</p>
        <p className="mt-3 text-xs text-neutral-700">
          Four Directions circular layout · KuzuDB graph substrate · OCAP-aware traversal
        </p>
      </div>
    </div>
  );
}

// ─── Chronicle placeholder ───────────────────────────────────────────────────

function ChronicleView() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <h2 className="text-sm font-semibold tracking-widest text-neutral-400 uppercase mb-4">
        Session Chronicle
      </h2>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <p className="text-xs text-neutral-500 italic leading-relaxed">
          The chronicle records the narrative arc of each ceremony spiral.
          As you move through East → South → West → North, beats are captured here —
          vision, growth, action, and reflection woven into the living ledger.
        </p>
        <div className="mt-4 space-y-2">
          {(['🌅 East — Inquiry', '🔥 South — Growth', '🌊 West — Action', '❄️ North — Reflection'] as const).map(
            (label) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded border border-neutral-800 px-3 py-2 text-xs text-neutral-600"
              >
                <span>{label}</span>
                <span className="ml-auto text-[10px] text-neutral-700">awaiting beats…</span>
              </div>
            ),
          )}
        </div>
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
      return <ChronicleView />;
    default:
      return null;
  }
}
