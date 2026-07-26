'use client';

// ─── Chronicle narrative beats (spec 11) ─────────────────────────────────────
// A reader walks: episode → cycle → arc → direction → beat → sub-beats → the
// relations that beat honored, and back out again. Every beat is drawn where it
// belongs on the wheel, and no beat is hidden for being unbound.
//
// Medicine Wheel is the system of record. Nothing here writes: selection,
// navigation, grouping, depth, and placement are all re-derived at render and
// gone on refresh.

import { useMemo } from 'react';
import {
  type ChronicleBeats,
  type ChronicleDirection,
  type NarrativeBeatRecord,
} from '@forgewright/lib/chronicle/client';
import {
  arcBeats,
  arcBeatsForDirection,
  beatLineage,
  beatsById,
  buildChronicleArc,
  placeArcBeats,
  BEAT_DIRECTIONS,
} from '@forgewright/lib/chronicle/beats';
import {
  isUnboundLane,
  UNBOUND_LANE,
  type ChronicleParam,
  type ChronicleRoute,
} from '@forgewright/lib/chronicle/navigation';
import type { SectionProjection, SharedResource } from '@forgewright/lib/chronicle/viewCache';
import { DIRECTIONS } from '@forgewright/lib/types/directions';
import WheelDiagram from '@forgewright/components/medicine-wheel/WheelDiagram';
import Markdown from './Markdown';
import { formatTimestamp, Metric, SectionError, SectionLoading } from './sections';

export interface BeatNavigation {
  route: ChronicleRoute;
  navigate: (next: ChronicleRoute) => void;
  back: () => void;
  unresolved: ChronicleParam[];
}

const DIRECTION_TINT: Record<ChronicleDirection, string> = {
  east: 'border-forge-east/40 bg-forge-east-tint text-forge-east-ink',
  south: 'border-forge-south/40 bg-forge-south-tint text-forge-south-ink',
  west: 'border-forge-west/40 bg-forge-west-tint text-forge-west-ink',
  north: 'border-forge-north/40 bg-forge-north-tint text-forge-north-ink',
};

// ─── Metric tile ─────────────────────────────────────────────────────────────

export function NarrativeBeatMetric({
  resource,
  onRetry,
}: {
  resource: SharedResource<ChronicleBeats>;
  onRetry: () => void;
}) {
  if (resource.status === 'error') {
    return (
      <Metric
        label="Narrative beats"
        value="—"
        title={resource.error ?? 'upstream unavailable'}
        caption={
          <button
            type="button"
            onClick={onRetry}
            className="text-ember-cooling underline decoration-ember-cooling/50 underline-offset-2 transition-colors hover:decoration-ember-cooling"
          >
            No answer — retry
          </button>
        }
      />
    );
  }
  return (
    <Metric
      label="Narrative beats"
      value={resource.status === 'loading' ? '…' : resource.data?.count ?? 0}
    />
  );
}

// ─── Episode-level beat section ──────────────────────────────────────────────

export function EpisodeBeatsSection({
  episodePath,
  section,
  nav,
  onRetry,
}: {
  episodePath: string;
  section: SectionProjection<ChronicleBeats>;
  nav: BeatNavigation;
  onRetry: () => void;
}) {
  if (section.status === 'loading') return <SectionLoading label="Narrative beats" />;
  if (section.status === 'error') {
    return (
      <SectionError
        label="Narrative beats"
        message={section.error ?? 'upstream unavailable'}
        onRetry={onRetry}
      />
    );
  }
  // count 0 renders nothing — silence under an episode means "nothing
  // registered". A CHOSEN cycle says its emptiness in words instead (below).
  if (section.status === 'empty' || !section.data) return null;

  return (
    <BeatLanes
      scope={episodePath}
      beats={section.data}
      nav={nav}
      isSelectedScope={nav.route.episode === episodePath}
    />
  );
}

/**
 * Beats no registered episode claims. The wheel can hold a beat whose episode
 * was never registered as a reference; that absence is information, so the lane
 * is named rather than filtered away.
 */
export function UnassociatedBeatsSection({
  section,
  nav,
  onRetry,
}: {
  section: SectionProjection<ChronicleBeats>;
  nav: BeatNavigation;
  onRetry: () => void;
}) {
  if (section.status === 'loading') return <SectionLoading label="Narrative beats" />;
  if (section.status === 'error') {
    return (
      <SectionError
        label="Narrative beats"
        message={section.error ?? 'upstream unavailable'}
        onRetry={onRetry}
      />
    );
  }
  if (section.status === 'empty' || !section.data) return null;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-section font-semibold text-neutral-100">
          Beats outside a registered episode
        </h3>
        <span className="text-[11px] text-neutral-600">
          no episode reference claims these yet
        </span>
      </div>
      <BeatLanes
        scope={null}
        beats={section.data}
        nav={nav}
        isSelectedScope={nav.route.episode === undefined}
      />
    </div>
  );
}

// ─── Cycle lanes + the arc they open ─────────────────────────────────────────

function BeatLanes({
  scope,
  beats,
  nav,
  isSelectedScope,
}: {
  scope: string | null;
  beats: ChronicleBeats;
  nav: BeatNavigation;
  isSelectedScope: boolean;
}) {
  const unboundCount = useMemo(
    () => buildChronicleArc(beats, null).unbound.length,
    [beats],
  );

  const openLane = (cycleId: string) => {
    const next: ChronicleRoute = { view: 'chronicle', cycle: cycleId };
    if (scope) next.episode = scope;
    nav.navigate(next);
  };

  const selectedCycle = isSelectedScope ? nav.route.cycle : undefined;

  return (
    <div className="ml-6 space-y-2 border-l border-neutral-800 pl-4">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
        Narrative beats · <span className="font-mono tabular-nums">{beats.count}</span>
      </p>

      <div className="flex flex-wrap gap-1.5">
        {beats.cycles.map((cycle) => (
          <button
            key={cycle.id}
            type="button"
            onClick={() => openLane(cycle.id)}
            aria-pressed={selectedCycle === cycle.id}
            title={cycle.researchQuestion ?? cycle.id}
            className={`rounded border px-2 py-1 text-[11px] transition-colors ${
              selectedCycle === cycle.id
                ? 'border-neutral-500 bg-fw-iron-2 text-neutral-100'
                : 'border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
            }`}
          >
            <span aria-hidden="true">🔁</span>{' '}
            <span className="font-mono">{cycle.id}</span>
          </button>
        ))}

        {unboundCount > 0 ? (
          <button
            type="button"
            onClick={() => openLane(UNBOUND_LANE)}
            aria-pressed={isUnboundLane(selectedCycle)}
            title="Beats that declare no cycle — surfaced, never assigned one"
            className={`rounded border border-dashed px-2 py-1 text-[11px] transition-colors ${
              isUnboundLane(selectedCycle)
                ? 'border-neutral-500 bg-fw-iron-2 text-neutral-100'
                : 'border-neutral-700 bg-neutral-950/40 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
            }`}
          >
            Unbound beats · <span className="font-mono tabular-nums">{unboundCount}</span>
          </button>
        ) : null}

        {beats.cycles.length === 0 && unboundCount === 0 ? (
          <span className="text-[11px] text-neutral-600">
            beats registered, no cycle serves them yet
          </span>
        ) : null}
      </div>

      {beats.cyclesUnavailable ? (
        <p className="text-[11px] text-ember-cooling" role="status">
          Cycle membership unavailable — {beats.cyclesUnavailable}. Beats below are read from
          their own cycle_id.
        </p>
      ) : null}

      {isSelectedScope && selectedCycle ? (
        <BeatArc beats={beats} cycleId={selectedCycle} nav={nav} />
      ) : null}
    </div>
  );
}

function BeatArc({
  beats,
  cycleId,
  nav,
}: {
  beats: ChronicleBeats;
  cycleId: string;
  nav: BeatNavigation;
}) {
  const arc = useMemo(
    () => buildChronicleArc(beats, isUnboundLane(cycleId) ? null : cycleId),
    [beats, cycleId],
  );
  const inArc = useMemo(() => arcBeats(arc), [arc]);
  const placed = useMemo(() => placeArcBeats(arc, beats.beats), [arc, beats.beats]);
  const byId = useMemo(() => beatsById(beats.beats), [beats.beats]);

  const selectedBeat = nav.route.beat ? byId.get(nav.route.beat) ?? null : null;
  const lineage = useMemo(
    () => (selectedBeat ? beatLineage(selectedBeat, beats.beats) : undefined),
    [selectedBeat, beats.beats],
  );

  const focusDirection = nav.route.direction ?? arc.currentDirection ?? null;
  const totalInArc = inArc.length;

  const openDirection = (direction: ChronicleDirection) => {
    nav.navigate({ ...nav.route, view: 'chronicle', cycle: cycleId, direction, beat: undefined });
  };
  const openBeat = (beatId: string) => {
    const beat = byId.get(beatId);
    nav.navigate({
      ...nav.route,
      view: 'chronicle',
      cycle: cycleId,
      direction: beat?.direction ?? nav.route.direction,
      beat: beatId,
    });
  };

  const listed = focusDirection ? arcBeatsForDirection(arc, focusDirection) : inArc;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-neutral-500">Arc</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-300" title={cycleId}>
          {isUnboundLane(cycleId) ? 'unbound beats' : cycleId}
        </code>
        <button
          type="button"
          onClick={nav.back}
          className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
        >
          ← Back
        </button>
      </header>

      {arc.researchQuestion ? (
        <p className="mt-2 rounded border-l-2 border-neutral-600 bg-fw-iron-2 px-2.5 py-2 text-caption leading-relaxed text-neutral-300">
          <span className="font-semibold text-neutral-100">Research question:</span>{' '}
          {arc.researchQuestion}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-start gap-5">
        <div className="shrink-0">
          <WheelDiagram
            activeDirection={focusDirection ?? 'east'}
            cycleCount={arc.count}
            centerLabel="Beats"
            beats={placed}
            selectedBeatId={nav.route.beat ?? null}
            lineageIds={lineage}
            onBeatSelect={openBeat}
            onDirectionClick={openDirection}
            unboundCount={arc.unbound.length}
            size={220}
          />
        </div>

        <div className="min-w-56 flex-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {BEAT_DIRECTIONS.map((direction) => {
              const count = arcBeatsForDirection(arc, direction).length;
              const info = DIRECTIONS[direction];
              const isFocused = focusDirection === direction;
              return (
                <button
                  key={direction}
                  type="button"
                  onClick={() => openDirection(direction)}
                  aria-pressed={isFocused}
                  className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                    isFocused
                      ? DIRECTION_TINT[direction]
                      : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                >
                  <span aria-hidden="true">{info.emoji}</span> {info.name} ·{' '}
                  <span className="font-mono tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>

          {/* A chosen cycle is an explicit act of navigation, so silence here
              would read as breakage. The arc says it in words — and still draws
              the unbound beats ringing it. */}
          {arc.count === 0 ? (
            <p className="rounded border border-dashed border-neutral-800 px-3 py-4 text-center text-caption text-neutral-500">
              {isUnboundLane(cycleId)
                ? 'no unbound beats'
                : 'no beats recorded in this cycle yet'}
            </p>
          ) : null}

          {totalInArc > 0 ? (
            <ul className="space-y-1">
              {listed.map((beat) => (
                <li key={beat.id}>
                  <BeatRow
                    beat={beat}
                    selected={nav.route.beat === beat.id}
                    inLineage={lineage?.has(beat.id) ?? false}
                    onOpen={() => openBeat(beat.id)}
                  />
                </li>
              ))}
              {listed.length === 0 && focusDirection ? (
                <li className="px-1 text-[11px] text-neutral-600">
                  no beats in {DIRECTIONS[focusDirection].name} yet
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>

      {selectedBeat ? (
        <BeatDetail beat={selectedBeat} beats={beats} onOpenBeat={openBeat} />
      ) : null}

      {arc.droppedCount > 0 ? (
        <p className="mt-3 text-center text-[10px] text-neutral-700">
          {arc.droppedCount} beat record(s) failed the contract and are held outside this view.
        </p>
      ) : null}
    </section>
  );
}

function BeatRow({
  beat,
  selected,
  inLineage,
  onOpen,
}: {
  beat: NarrativeBeatRecord;
  selected: boolean;
  inLineage: boolean;
  onOpen: () => void;
}) {
  const info = DIRECTIONS[beat.direction];

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={`flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-left transition-colors ${
        selected
          ? 'border-neutral-500 bg-fw-iron-2'
          : inLineage
            ? 'border-neutral-700 bg-neutral-950/60 hover:border-neutral-600'
            : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-600'
      }`}
    >
      <span aria-hidden="true">{info.emoji}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-200" title={beat.title}>
        {beat.title}
      </span>
      {!beat.cycleId ? (
        <span className="rounded border border-dashed border-neutral-700 px-1 py-0.5 text-[10px] text-neutral-500">
          unbound
        </span>
      ) : null}
    </button>
  );
}

function BeatDetail({
  beat,
  beats,
  onOpenBeat,
}: {
  beat: NarrativeBeatRecord;
  beats: ChronicleBeats;
  onOpenBeat: (beatId: string) => void;
}) {
  const info = DIRECTIONS[beat.direction];
  const timestamp = formatTimestamp(beat.timestamp);
  const byId = beatsById(beats.beats);
  const parent = beat.parentBeatId ? byId.get(beat.parentBeatId) : undefined;
  const flags = beats.discrepancies.filter((entry) => entry.beatId === beat.id);

  return (
    <article className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${DIRECTION_TINT[beat.direction]}`}>
          {info.emoji} {info.name} · {info.ojibwe} · act {beat.act}
        </span>
        {!beat.cycleId ? (
          <span className="rounded border border-dashed border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400">
            unbound — no cycle claims this beat
          </span>
        ) : null}
        {timestamp ? (
          <span className="ml-auto font-mono text-[11px] tabular-nums text-neutral-600">
            {timestamp}
          </span>
        ) : null}
      </div>

      <h4 className="mt-2 text-body font-medium text-neutral-100">{beat.title}</h4>
      {beat.description ? (
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{beat.description}</p>
      ) : null}
      {beat.prose ? (
        <div className="mt-2 border-l-2 border-neutral-700 pl-3">
          <Markdown>{beat.prose}</Markdown>
        </div>
      ) : null}

      <BeatList label="Learnings" glyph="🪶" entries={beat.learnings} />
      <BeatList label="Ceremonies" glyph="🔥" entries={beat.ceremonies} />
      <BeatList label="Relations honored" glyph="🧬" entries={beat.relationsHonored} />

      {parent ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Telescoped from</p>
          <button
            type="button"
            onClick={() => onOpenBeat(parent.id)}
            className="mt-1 w-full truncate rounded border border-neutral-800 bg-neutral-950/40 px-2.5 py-1.5 text-left text-[12px] text-neutral-300 transition-colors hover:border-neutral-600"
          >
            ↑ {parent.title}
          </button>
        </div>
      ) : null}

      {beat.subBeatIds.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">
            Sub-beats · <span className="font-mono tabular-nums">{beat.subBeatIds.length}</span>
          </p>
          <ul className="mt-1 space-y-1">
            {beat.subBeatIds.map((subId) => {
              const child = byId.get(subId);
              return (
                <li key={subId}>
                  {child ? (
                    <button
                      type="button"
                      onClick={() => onOpenBeat(child.id)}
                      className="w-full truncate rounded border border-neutral-800 bg-neutral-950/40 px-2.5 py-1.5 text-left text-[12px] text-neutral-300 transition-colors hover:border-neutral-600"
                    >
                      ↓ {child.title}
                    </button>
                  ) : (
                    <span className="block truncate rounded border border-dashed border-ember-cooling/40 px-2.5 py-1.5 font-mono text-[11px] text-ember-cooling">
                      {subId} — not served
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* origin is the honesty channel: an unstated provenance and a claimed one
          must not look alike. */}
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-neutral-800 pt-2 text-[11px] text-neutral-600">
        {beat.origin ? (
          <>
            <span>
              origin <span className="font-mono text-neutral-400">{beat.origin.producer}</span>
            </span>
            {beat.origin.sourceRef ? (
              <span className="font-mono">{beat.origin.sourceRef}</span>
            ) : null}
            {beat.origin.method ? <span>{beat.origin.method}</span> : null}
          </>
        ) : (
          <span className="italic">origin unrecorded</span>
        )}
        <span className="font-mono">{beat.id}</span>
      </p>

      {flags.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {flags.map((flag, index) => (
            <li key={`${flag.kind}-${flag.ref ?? index}`} className="text-[11px] text-ember-cooling">
              ⚠ {flag.kind}
              {flag.ref ? <span className="ml-1 font-mono">{flag.ref}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function BeatList({
  label,
  glyph,
  entries,
}: {
  label: string;
  glyph: string;
  entries: readonly string[];
}) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label} · <span className="font-mono tabular-nums">{entries.length}</span>
      </p>
      <ul className="mt-1 space-y-1">
        {entries.map((entry, index) => (
          <li
            key={`${label}-${index}`}
            className="flex gap-2 rounded border border-neutral-800 bg-neutral-950/40 px-2.5 py-1.5 text-[12px] leading-relaxed text-neutral-300"
          >
            <span aria-hidden="true">{glyph}</span>
            <span className="min-w-0 flex-1">{entry}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
