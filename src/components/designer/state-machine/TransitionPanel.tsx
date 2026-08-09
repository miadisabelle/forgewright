'use client';

// ─── Transition Panel ────────────────────────────────────────────────────────
// What a selected arrow says: where it goes, what fires it, what guards it.
// See rispecs/05-visual-designer.spec.md — State Machine View interactions.
//
// Read-only, because the diagram is. Episode diagrams are read from the
// chronicle on disk and never written back, so a panel offering Save and Delete
// was offering something forgewright cannot do — the edits it accepted went
// into a store nothing rendered. Showing the transition truthfully is the
// honest version of the same panel.

import React from 'react';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface TransitionDetail {
  from: string;
  to: string;
  event: string;
  condition?: string;
  description?: string;
}

interface TransitionPanelProps {
  transition: TransitionDetail;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TransitionPanel({ transition }: TransitionPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <span className="rounded border border-fw-border-strong bg-fw-iron-2 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
          Transition
        </span>
      </div>

      {/* Source → Target */}
      <div className="flex flex-wrap items-center gap-2 text-body">
        <span className="rounded bg-fw-iron-2 px-2 py-0.5 font-mono text-neutral-200">
          {transition.from}
        </span>
        <span className="text-neutral-500">→</span>
        <span className="rounded bg-fw-iron-2 px-2 py-0.5 font-mono text-neutral-200">
          {transition.to}
        </span>
      </div>

      <Field label="Event">
        <span className="font-mono text-body text-forge-east-ink">{transition.event}</span>
      </Field>

      <Field label="Guard condition">
        <span className="font-mono text-body text-neutral-400">
          {transition.condition ?? '(none)'}
        </span>
      </Field>

      {transition.description && (
        <Field label="Description">
          <p className="text-body text-neutral-400">{transition.description}</p>
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-caption font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  );
}
