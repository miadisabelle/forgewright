'use client';

// ─── Needs attention (ep332 loop) ────────────────────────────────────────────
// What needs a human, read from the wheel's `kind: attention` nodes — the same
// projection `passages attention` writes and verifies. forgewright is a pure
// read consumer; answering happens through the verbs, never here. A quiet
// board renders nothing: absence is a true statement, not a hidden one.

import type { ChronicleArtifactReference } from '@forgewright/lib/chronicle/client';

function episodeLabel(
  item: ChronicleArtifactReference,
  episodes: readonly ChronicleArtifactReference[],
): string {
  const parent = episodes.find((episode) => episode.id === item.parentId);
  if (parent) return parent.name;
  return item.parentId?.replace(/^chronicle:/, '') ?? '';
}

export function AttentionBoard({
  items,
  episodes,
}: {
  items: ChronicleArtifactReference[];
  episodes: readonly ChronicleArtifactReference[];
}) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Needs attention"
      className="rounded-lg border border-ember-cooling/40 bg-fw-iron px-4 py-3"
    >
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="font-display text-section font-semibold text-neutral-100">
          Needs attention
        </h3>
        <span className="font-mono text-[11px] text-ember-cooling">
          {items.length} open · what waits on a human
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-body font-medium text-neutral-100">{item.name}</span>
              {item.asked ? (
                <span className="font-mono text-[11px] text-neutral-500">{item.asked}</span>
              ) : null}
            </div>
            {item.unlocks ? (
              <p className="text-[12px] text-neutral-400">unlocks: {item.unlocks}</p>
            ) : null}
            <p className="font-mono text-[11px] text-neutral-600">
              {episodeLabel(item, episodes)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One quiet line under an episode card when open items wait inside it. */
export function EpisodeAttentionLine({
  episode,
  items,
}: {
  episode: ChronicleArtifactReference;
  items: readonly ChronicleArtifactReference[];
}) {
  const open = items.filter((item) => item.parentId === episode.id);
  if (open.length === 0) return null;
  return (
    <p className="ml-6 border-l border-ember-cooling/40 pl-4 text-[11px] text-ember-cooling">
      needs attention: {open.length} open item{open.length === 1 ? '' : 's'}
    </p>
  );
}
