// ─── Beat derivation and wheel placement (spec 11.3, 11.5) ───────────────────
// Everything here is PURE and re-derivable from what the wheel served. Nothing
// is persisted, nothing travels upstream: grouping, depth, lineage, orphan
// detection, angle and radius are view arithmetic, not record.
//
// The named derivations mirror @medicine-wheel/narrative-engine v0.5.1
// (beatsInCycle, orphanBeats, beatLineage, beatDepth, rootBeats, childBeats,
// actForDirection). ForgeWright cannot yet import that package from a Next.js
// production build — spec 11 Exportation §7 pins that to jgwill/medicine-wheel#107
// — so the read-only derivations are held here and swap to the package when it
// can be consumed. The AUTHORING exports (createBeat, telescopeBeat,
// attachBeatToCycle) are deliberately absent: ForgeWright is not a producer.

import {
  ACT_FOR_DIRECTION,
  type ChronicleArc,
  type ChronicleBeats,
  type ChronicleDirection,
  type NarrativeBeatRecord,
  type NarrativeCycleRecord,
} from './client';

export const BEAT_DIRECTIONS: readonly ChronicleDirection[] = ['east', 'south', 'west', 'north'];

export function actForDirection(direction: ChronicleDirection): number {
  return ACT_FOR_DIRECTION[direction];
}

export function beatsById(
  beats: readonly NarrativeBeatRecord[],
): ReadonlyMap<string, NarrativeBeatRecord> {
  return new Map(beats.map((beat) => [beat.id, beat]));
}

/** Membership read from BOTH sides of the relation, as beatsInCycle does. */
export function beatsInCycle(
  beats: readonly NarrativeBeatRecord[],
  cycle: NarrativeCycleRecord | null,
  cycleId?: string,
): NarrativeBeatRecord[] {
  const id = cycle?.id ?? cycleId;
  if (!id) return [];
  const members = cycle?.beatIds ?? [];
  return beats.filter((beat) => beat.cycleId === id || members.includes(beat.id));
}

/** Beats no cycle claims — surfaced in their own lane, never assigned a cycle. */
export function orphanBeats(
  beats: readonly NarrativeBeatRecord[],
  cycles: readonly NarrativeCycleRecord[],
): NarrativeBeatRecord[] {
  const claimed = new Set<string>();
  for (const cycle of cycles) {
    for (const id of cycle.beatIds) claimed.add(id);
  }
  return beats.filter((beat) => !beat.cycleId && !claimed.has(beat.id));
}

export function childBeats(
  beats: readonly NarrativeBeatRecord[],
  parentId: string,
): NarrativeBeatRecord[] {
  const parent = beats.find((beat) => beat.id === parentId);
  return beats.filter(
    (beat) => beat.parentBeatId === parentId || (parent?.subBeatIds.includes(beat.id) ?? false),
  );
}

export function rootBeats(beats: readonly NarrativeBeatRecord[]): NarrativeBeatRecord[] {
  const served = new Set(beats.map((beat) => beat.id));
  // A parent_beat_id pointing at nothing served renders at depth 0 with a
  // missing-parent flag — a broken lineage stays visible.
  return beats.filter((beat) => !beat.parentBeatId || !served.has(beat.parentBeatId));
}

/** Telescoping depth from the root beat. Cycle-safe: a loop stops at its start. */
export function beatDepth(
  beat: NarrativeBeatRecord,
  byId: ReadonlyMap<string, NarrativeBeatRecord>,
): number {
  let depth = 0;
  let current = beat;
  const seen = new Set<string>([beat.id]);

  while (current.parentBeatId) {
    const parent = byId.get(current.parentBeatId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    current = parent;
    depth += 1;
  }

  return depth;
}

/** Self + ancestors + descendants — selecting a beat lights its whole telescope. */
export function beatLineage(
  beat: NarrativeBeatRecord,
  beats: readonly NarrativeBeatRecord[],
): Set<string> {
  const byId = beatsById(beats);
  const lineage = new Set<string>([beat.id]);

  let current: NarrativeBeatRecord | undefined = beat;
  while (current?.parentBeatId) {
    const parent: NarrativeBeatRecord | undefined = byId.get(current.parentBeatId);
    if (!parent || lineage.has(parent.id)) break;
    lineage.add(parent.id);
    current = parent;
  }

  const queue = [beat.id];
  while (queue.length > 0) {
    const parentId = queue.shift() as string;
    for (const child of childBeats(beats, parentId)) {
      if (lineage.has(child.id)) continue;
      lineage.add(child.id);
      queue.push(child.id);
    }
  }

  return lineage;
}

function byTimestampAscending(left: NarrativeBeatRecord, right: NarrativeBeatRecord): number {
  const leftTime = Date.parse(left.timestamp);
  const rightTime = Date.parse(right.timestamp);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id);
  }
  return leftTime - rightTime || left.id.localeCompare(right.id);
}

function emptyByDirection(): Record<ChronicleDirection, NarrativeBeatRecord[]> {
  return { east: [], south: [], west: [], north: [] };
}

export function groupByDirection(
  beats: readonly NarrativeBeatRecord[],
): Record<ChronicleDirection, NarrativeBeatRecord[]> {
  const grouped = emptyByDirection();
  for (const beat of beats) grouped[beat.direction].push(beat);
  for (const direction of BEAT_DIRECTIONS) grouped[direction].sort(byTimestampAscending);
  return grouped;
}

/**
 * The arc a reader walks. `cycleId` null is the unbound lane: those beats are
 * held in `unbound` and drawn on the outer ring, never dropped and never given
 * a cycle they did not declare.
 */
export function buildChronicleArc(
  source: ChronicleBeats,
  cycleId: string | null,
): ChronicleArc {
  const unbound = orphanBeats(source.beats, source.cycles).sort(byTimestampAscending);

  if (cycleId === null) {
    return {
      cycleId: null,
      byDirection: emptyByDirection(),
      unbound,
      count: unbound.length,
      droppedCount: source.droppedCount,
      discrepancies: source.discrepancies.filter((entry) =>
        unbound.some((beat) => beat.id === entry.beatId),
      ),
    };
  }

  const cycle = source.cycles.find((entry) => entry.id === cycleId) ?? null;
  const members = beatsInCycle(source.beats, cycle, cycleId);
  const inArc = new Set([...members, ...unbound].map((beat) => beat.id));

  const arc: ChronicleArc = {
    cycleId,
    byDirection: groupByDirection(members),
    unbound,
    count: members.length,
    droppedCount: source.droppedCount,
    discrepancies: source.discrepancies.filter((entry) => inArc.has(entry.beatId)),
  };
  if (cycle?.researchQuestion) arc.researchQuestion = cycle.researchQuestion;
  if (cycle?.currentDirection) arc.currentDirection = cycle.currentDirection;
  return arc;
}

/** Every beat the arc renders, in sunwise order then unbound. */
export function arcBeats(arc: ChronicleArc): NarrativeBeatRecord[] {
  const beats: NarrativeBeatRecord[] = [];
  for (const direction of BEAT_DIRECTIONS) beats.push(...arc.byDirection[direction]);
  beats.push(...arc.unbound);
  return beats;
}

export function arcBeatsForDirection(
  arc: ChronicleArc,
  direction: ChronicleDirection,
): NarrativeBeatRecord[] {
  return [
    ...arc.byDirection[direction],
    ...arc.unbound.filter((beat) => beat.direction === direction),
  ];
}

// ─── Placement on the 200×200 wheel (spec 11.3) ──────────────────────────────
// Sunwise from twelve o'clock, centre 100,100 — the geometry WheelDiagram
// already fixes. Quadrant is decided by `direction`, never by `act`.

export const BEAT_BASE_RADIUS = 46;
export const BEAT_DEPTH_STEP = 18;
export const BEAT_MAX_DRAWN_DEPTH = 2;
export const UNBOUND_RADIUS = 88;

export interface PlacedBeat {
  beat: NarrativeBeatRecord;
  x: number;
  y: number;
  radius: number;
  theta: number;
  depth: number;
  unbound: boolean;
  /** Descendants past the drawn depth, collapsed onto this mark. */
  deeperCount: number;
  parentPlacement?: { x: number; y: number };
}

export function beatAngle(direction: ChronicleDirection, index: number, total: number): number {
  // (k+1)/(n+1) keeps every mark off the quadrant seams, so a beat never sits
  // ambiguously between two directions.
  return 90 * (actForDirection(direction) - 1) + (90 * (index + 1)) / (total + 1);
}

export function beatRadius(depth: number): number {
  return BEAT_BASE_RADIUS + BEAT_DEPTH_STEP * Math.min(depth, BEAT_MAX_DRAWN_DEPTH);
}

function pointAt(theta: number, radius: number): { x: number; y: number } {
  const radians = (theta * Math.PI) / 180;
  return {
    x: 100 + radius * Math.sin(radians),
    y: 100 - radius * Math.cos(radians),
  };
}

/**
 * Place an arc's beats. Depth beyond 2 is not crowded onto the rim: it is
 * collapsed into a `+N deeper` count on its deepest drawn ancestor, and the
 * parent is ALWAYS kept drawn when a beat telescopes.
 */
export function placeArcBeats(
  arc: ChronicleArc,
  allBeats: readonly NarrativeBeatRecord[] = arcBeats(arc),
): PlacedBeat[] {
  const byId = beatsById(allBeats);
  const placed = new Map<string, PlacedBeat>();
  const deeper = new Map<string, number>();

  const place = (
    beat: NarrativeBeatRecord,
    index: number,
    total: number,
    unbound: boolean,
  ): void => {
    const depth = beatDepth(beat, byId);
    if (depth > BEAT_MAX_DRAWN_DEPTH && !unbound) {
      // Attribute to the deepest drawn ancestor rather than drawing past the rim.
      let ancestor: NarrativeBeatRecord | undefined = beat;
      let ancestorDepth = depth;
      const seen = new Set<string>();
      while (ancestor && ancestorDepth > BEAT_MAX_DRAWN_DEPTH && !seen.has(ancestor.id)) {
        seen.add(ancestor.id);
        ancestor = ancestor.parentBeatId ? byId.get(ancestor.parentBeatId) : undefined;
        ancestorDepth -= 1;
      }
      if (ancestor) deeper.set(ancestor.id, (deeper.get(ancestor.id) ?? 0) + 1);
      return;
    }

    const theta = beatAngle(beat.direction, index, total);
    const radius = unbound ? UNBOUND_RADIUS : beatRadius(depth);
    const { x, y } = pointAt(theta, radius);
    placed.set(beat.id, { beat, x, y, radius, theta, depth, unbound, deeperCount: 0 });
  };

  for (const direction of BEAT_DIRECTIONS) {
    const inQuadrant = arc.byDirection[direction];
    inQuadrant.forEach((beat, index) => place(beat, index, inQuadrant.length, false));
  }

  const unboundByDirection = groupByDirection(arc.unbound);
  for (const direction of BEAT_DIRECTIONS) {
    const ring = unboundByDirection[direction];
    ring.forEach((beat, index) => place(beat, index, ring.length, true));
  }

  const marks = [...placed.values()];
  for (const mark of marks) {
    mark.deeperCount = deeper.get(mark.beat.id) ?? 0;
    const parentId = mark.beat.parentBeatId;
    const parent = parentId ? placed.get(parentId) : undefined;
    if (parent) mark.parentPlacement = { x: parent.x, y: parent.y };
  }

  return marks;
}
