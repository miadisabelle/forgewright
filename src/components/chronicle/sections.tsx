'use client';

// ─── Shared chronicle section furniture ──────────────────────────────────────
// Every nested Chronicle section moves through loading | error | empty | ready.
// These are the loading and error rungs, held in one place so the beat sections
// (spec 11) wear exactly what the inquiry and perspective sections already wear.

import type { ReactNode } from 'react';

export function formatTimestamp(value?: string): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export function SectionLoading({ label }: { label: string }) {
  return (
    <p
      className="ml-6 border-l border-neutral-800 pl-4 text-[11px] uppercase tracking-wide text-neutral-600 motion-safe:animate-pulse"
      role="status"
    >
      {label}…
    </p>
  );
}

export function SectionError({
  label,
  message,
  onRetry,
}: {
  label: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="ml-6 border-l border-ember-cooling/40 pl-4" role="alert">
      <div className="flex flex-wrap items-center gap-2 rounded border border-ember-cooling/30 bg-fw-iron px-3 py-2">
        <span className="text-[11px] uppercase tracking-wide text-ember-cooling">
          {label} didn&apos;t load
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500" title={message}>
          {message}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-ember-cooling/50 px-2 py-0.5 text-[11px] text-ember-cooling transition-colors hover:border-ember-cooling"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export function Metric({
  label,
  value,
  caption,
  title,
}: {
  label: string;
  value: number | string;
  caption?: ReactNode;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3" title={title}>
      <div className="font-mono text-2xl font-medium tabular-nums text-neutral-100">{value}</div>
      <div className="mt-1 text-caption text-neutral-500">{label}</div>
      {caption ? <div className="mt-0.5 text-[11px]">{caption}</div> : null}
    </div>
  );
}
