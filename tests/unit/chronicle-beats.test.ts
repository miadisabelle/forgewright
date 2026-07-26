// ─── Narrative beats: projection, derivation, placement (spec 11) ────────────
// The fixtures mirror what the live wheel serves on :8040 — a BARE array of
// beats bound to cycle-ep299-isolation-addressability, each carrying
// origin.source_ref for the episode that produced it.

import { describe, expect, it, vi } from 'vitest';
import {
  beatMatchesEpisode,
  cycleMatchesEpisode,
  episodeNumberOf,
  getNarrativeBeats,
  type NarrativeBeatRecord,
} from '../../src/lib/chronicle/client';
import {
  beatAngle,
  beatDepth,
  beatLineage,
  beatRadius,
  beatsById,
  beatsInCycle,
  buildChronicleArc,
  orphanBeats,
  placeArcBeats,
  UNBOUND_RADIUS,
} from '../../src/lib/chronicle/beats';
import {
  filterBeatsForEpisode,
  filterBeatsOutsideEpisodes,
  projectBeatSection,
  projectUnclaimedBeatSection,
  readyResource,
} from '../../src/lib/chronicle/viewCache';

const CYCLE_ID = 'cycle-ep299-isolation-addressability';
const EP_299 = '2026-07-25-episode-299-isolation-and-addressability';
const EP_298 = '2026-07-24-episode-298-the-wheel-names-itself';

function beat(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'beat:east:299:opening',
    direction: 'east',
    title: 'The wheel could reason about beats it had no way to make',
    description: 'Survey found narrative-engine holding five ways to read a beat.',
    prose: 'It is a strange thing to find a system that can read a story fluently.',
    ceremonies: [],
    learnings: ['Creation and validation must not be separable'],
    timestamp: '2026-07-26T05:07:09.802Z',
    act: 1,
    relations_honored: [],
    cycle_id: CYCLE_ID,
    origin: {
      producer: 'chronicle-episode',
      source_ref: '2026-07-25-episode-299',
      method: 'authored',
    },
    ...overrides,
  };
}

const CYCLE = {
  id: CYCLE_ID,
  research_question: 'How do many things share one ground without contaminating each other?',
  start_date: '2026-07-26T05:07:00.910Z',
  current_direction: 'east',
  beats: ['beat:east:299:opening', 'beat:south:299:probing'],
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createWheel(
  beats: unknown,
  cycles: unknown = [CYCLE],
  options: { beatStatus?: number; cycleStatus?: number } = {},
) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/api/narrative/beats')) {
      return jsonResponse(beats, options.beatStatus ?? 200);
    }
    if (url.includes('/api/narrative/cycles')) {
      return jsonResponse(cycles, options.cycleStatus ?? 200);
    }
    return jsonResponse({ error: 'not found' }, 404);
  }) as unknown as typeof fetch;
}

describe('getNarrativeBeats projection', () => {
  it('projects the bare array the live wheel serves', async () => {
    const fetchImpl = createWheel([beat(), beat({ id: 'beat:south:299:probing', direction: 'south', act: 2 })]);

    const result = await getNarrativeBeats({}, { baseUrl: 'http://127.0.0.1:8040', fetchImpl });

    expect(result.count).toBe(2);
    expect(result.droppedCount).toBe(0);
    expect(result.discrepancies).toEqual([]);
    expect(result.beats[0]).toMatchObject({
      id: 'beat:east:299:opening',
      direction: 'east',
      act: 1,
      cycleId: CYCLE_ID,
      subBeatIds: [],
      origin: {
        producer: 'chronicle-episode',
        sourceRef: '2026-07-25-episode-299',
        method: 'authored',
      },
    });
    expect(result.cycles[0]).toMatchObject({
      id: CYCLE_ID,
      currentDirection: 'east',
      beatIds: ['beat:east:299:opening', 'beat:south:299:probing'],
    });
    expect(result.cyclesUnavailable).toBeUndefined();
  });

  it('accepts the { beats: [...] } envelope as readily as a bare array', async () => {
    const fetchImpl = createWheel({ beats: [beat()], count: 1 }, { cycles: [CYCLE] });

    const result = await getNarrativeBeats({}, { fetchImpl });

    expect(result.count).toBe(1);
    expect(result.cycles).toHaveLength(1);
  });

  it('drops a record missing id, direction, title, or timestamp and counts it', async () => {
    const fetchImpl = createWheel([
      beat(),
      beat({ id: undefined }),
      beat({ direction: 'northeast' }),
      beat({ title: '' }),
      beat({ timestamp: undefined }),
    ]);

    const result = await getNarrativeBeats({}, { fetchImpl });

    expect(result.count).toBe(1);
    expect(result.droppedCount).toBe(4);
  });

  it('derives act from direction and flags the contradiction rather than trusting act', async () => {
    const fetchImpl = createWheel([beat({ direction: 'west', act: 1 })]);

    const result = await getNarrativeBeats({}, { fetchImpl });

    expect(result.beats[0].direction).toBe('west');
    expect(result.beats[0].act).toBe(3);
    expect(result.discrepancies).toEqual([
      { beatId: 'beat:east:299:opening', kind: 'act-direction-mismatch' },
    ]);
  });

  it('flags a sub_beat or parent that resolves to nothing, and still renders the beat', async () => {
    const fetchImpl = createWheel([
      beat({ sub_beats: ['beat:missing'] }),
      beat({ id: 'beat:orphaned-child', parent_beat_id: 'beat:absent' }),
    ]);

    const result = await getNarrativeBeats({}, { fetchImpl });

    expect(result.count).toBe(2);
    expect(result.discrepancies).toEqual([
      { beatId: 'beat:east:299:opening', kind: 'missing-child', ref: 'beat:missing' },
      { beatId: 'beat:orphaned-child', kind: 'missing-parent', ref: 'beat:absent' },
    ]);
  });

  it('bounds prose at 64 KiB, matching the perspective body limit', async () => {
    const fetchImpl = createWheel([beat({ prose: 'x'.repeat(70 * 1024) })]);

    const result = await getNarrativeBeats({}, { fetchImpl });

    expect(result.beats[0].prose).toHaveLength(64 * 1024);
  });

  it('keeps beats when the cycle surface is absent, and names the absence', async () => {
    const fetchImpl = createWheel([beat()], [], { cycleStatus: 404 });

    const result = await getNarrativeBeats({}, { fetchImpl });

    expect(result.count).toBe(1);
    expect(result.cycles).toEqual([]);
    expect(result.cyclesUnavailable).toContain('404');
  });

  it('lets an unreachable beat surface travel as an error, never as an empty array', async () => {
    const fetchImpl = createWheel([], [CYCLE], { beatStatus: 503 });

    await expect(getNarrativeBeats({}, { fetchImpl })).rejects.toThrow('HTTP 503');
  });

  it('treats a legacy cycle with no beats array as zero members, never an error', async () => {
    const fetchImpl = createWheel([], [{ id: 'cycle-legacy' }]);

    const result = await getNarrativeBeats({}, { fetchImpl });

    expect(result.cycles[0]).toMatchObject({ id: 'cycle-legacy', beatIds: [] });
  });

  it('honours cycle_id, direction, and episode_path client-side (the wheel serves no filters)', async () => {
    const fetchImpl = createWheel([
      beat(),
      beat({ id: 'beat:south:299:probing', direction: 'south', act: 2 }),
      beat({ id: 'beat:north:298:other', direction: 'north', act: 4, cycle_id: 'cycle-ep298', origin: undefined }),
    ]);

    const byCycle = await getNarrativeBeats({ cycleId: CYCLE_ID }, { fetchImpl });
    const byDirection = await getNarrativeBeats({ direction: 'south' }, { fetchImpl });
    const byEpisode = await getNarrativeBeats({ episodePath: EP_299 }, { fetchImpl });

    expect(byCycle.beats.map((entry) => entry.id)).toEqual([
      'beat:east:299:opening',
      'beat:south:299:probing',
    ]);
    expect(byDirection.beats.map((entry) => entry.id)).toEqual(['beat:south:299:probing']);
    expect(byEpisode.count).toBe(2);
    expect(byEpisode.cycles.map((entry) => entry.id)).toEqual([CYCLE_ID]);
  });
});

// ─── A6: the unbound are surfaced, never filtered into invisibility ──────────

describe('unbound beats', () => {
  it('renders and counts a beat with no cycle_id, and never assigns it one', async () => {
    const fetchImpl = createWheel([
      beat(),
      beat({ id: 'beat:west:299:legacy', direction: 'west', act: 3, cycle_id: undefined }),
    ]);

    const source = await getNarrativeBeats({}, { fetchImpl });
    const unbound = orphanBeats(source.beats, source.cycles);

    expect(source.count).toBe(2);
    expect(unbound.map((entry) => entry.id)).toEqual(['beat:west:299:legacy']);
    expect(unbound[0].cycleId).toBeUndefined();

    // The unbound beat rings every arc of its scope and is counted there.
    const arc = buildChronicleArc(source, CYCLE_ID);
    expect(arc.unbound.map((entry) => entry.id)).toEqual(['beat:west:299:legacy']);
    expect(arc.byDirection.west).toEqual([]);

    // Its own lane holds it too, still with no cycle.
    const lane = buildChronicleArc(source, null);
    expect(lane.cycleId).toBeNull();
    expect(lane.count).toBe(1);
    expect(lane.unbound[0].cycleId).toBeUndefined();
  });

  it('draws an unbound beat on the outer ring in its own direction', async () => {
    const fetchImpl = createWheel([
      beat({ id: 'beat:west:299:legacy', direction: 'west', act: 3, cycle_id: undefined }),
    ]);

    const source = await getNarrativeBeats({}, { fetchImpl });
    const marks = placeArcBeats(buildChronicleArc(source, CYCLE_ID), source.beats);

    expect(marks).toHaveLength(1);
    expect(marks[0].unbound).toBe(true);
    expect(marks[0].radius).toBe(UNBOUND_RADIUS);
    // West is act 3 — 180 to 270 degrees, single beat lands mid-quadrant.
    expect(marks[0].theta).toBe(225);
  });
});

// ─── Episode ↔ beat association ─────────────────────────────────────────────

describe('episode association', () => {
  const opening: NarrativeBeatRecord = {
    id: 'beat:east:299:opening',
    direction: 'east',
    act: 1,
    title: 'opening',
    timestamp: '2026-07-26T05:07:09.802Z',
    ceremonies: [],
    learnings: [],
    relationsHonored: [],
    subBeatIds: [],
    cycleId: CYCLE_ID,
    origin: { producer: 'chronicle-episode', sourceRef: '2026-07-25-episode-299' },
  };

  it('reads the episode number out of a path, a source_ref, and a cycle id', () => {
    expect(episodeNumberOf(EP_299)).toBe('299');
    expect(episodeNumberOf('2026-06-25-episode-093-medicine-wheel-adequate-display')).toBe('93');
    expect(episodeNumberOf(CYCLE_ID)).toBe('299');
    expect(episodeNumberOf('nothing-here')).toBeNull();
  });

  it('matches a source_ref that names the vessel before its slug', () => {
    expect(beatMatchesEpisode(opening, EP_299)).toBe(true);
  });

  it('lets an explicit source_ref decide — it is not overridden by a cycle id', () => {
    expect(beatMatchesEpisode(opening, EP_298)).toBe(false);
  });

  it('falls back to the episode number a cycle id carries when origin is silent', () => {
    const withoutOrigin: NarrativeBeatRecord = { ...opening, origin: undefined };
    expect(beatMatchesEpisode(withoutOrigin, EP_299)).toBe(true);
    expect(beatMatchesEpisode(withoutOrigin, EP_298)).toBe(false);
  });

  it('claims nothing for a beat carrying neither origin nor a cycle', () => {
    const bare: NarrativeBeatRecord = { ...opening, origin: undefined, cycleId: undefined };
    expect(beatMatchesEpisode(bare, EP_299)).toBe(false);
  });

  it('relates a cycle to an episode through its own id or a member beat', () => {
    const cycle = { id: CYCLE_ID, beatIds: [opening.id] };
    expect(cycleMatchesEpisode(cycle, EP_299, [opening])).toBe(true);
    expect(cycleMatchesEpisode({ id: 'cycle-anon', beatIds: [] }, EP_299, [opening])).toBe(false);
  });

  it('keeps a cycle with zero members reachable instead of dropping it', async () => {
    const fetchImpl = createWheel([], [{ id: 'cycle-anon' }]);
    const source = await getNarrativeBeats({}, { fetchImpl });

    const outside = filterBeatsOutsideEpisodes(source, [EP_298]);
    expect(outside.count).toBe(0);
    expect(outside.cycles.map((entry) => entry.id)).toEqual(['cycle-anon']);

    const section = projectUnclaimedBeatSection(readyResource(source), [EP_298]);
    expect(section.status).toBe('ready');

    // Opening it renders the arc-empty state rather than throwing.
    const arc = buildChronicleArc(source, 'cycle-anon');
    expect(arc.count).toBe(0);
    expect(arc.byDirection.east).toEqual([]);
  });

  it('projects the shared fetch per episode and holds the unclaimed in their own lane', async () => {
    const fetchImpl = createWheel([
      beat(),
      beat({ id: 'beat:stray', origin: { producer: 'hand' }, cycle_id: undefined }),
    ]);
    const source = await getNarrativeBeats({}, { fetchImpl });

    const forEpisode = filterBeatsForEpisode(source, EP_299);
    expect(forEpisode.beats.map((entry) => entry.id)).toEqual(['beat:east:299:opening']);

    const outside = filterBeatsOutsideEpisodes(source, [EP_299, EP_298]);
    expect(outside.beats.map((entry) => entry.id)).toEqual(['beat:stray']);

    const section = projectBeatSection(readyResource(source), EP_298);
    expect(section.status).toBe('empty');
  });
});

// ─── Placement on the wheel (11.3) ──────────────────────────────────────────

describe('beat placement', () => {
  it('spaces beats off the quadrant seams', () => {
    expect(beatAngle('east', 0, 2)).toBe(30);
    expect(beatAngle('east', 1, 2)).toBe(60);
    expect(beatAngle('south', 0, 1)).toBe(135);
    expect(beatAngle('north', 0, 1)).toBe(315);
  });

  it('sets radius by telescoping depth and stops crowding the rim', () => {
    expect(beatRadius(0)).toBe(46);
    expect(beatRadius(1)).toBe(64);
    expect(beatRadius(2)).toBe(82);
    expect(beatRadius(5)).toBe(82);
  });

  it('places by direction even when act contradicts it', async () => {
    const fetchImpl = createWheel([beat({ direction: 'north', act: 1 })]);
    const source = await getNarrativeBeats({}, { fetchImpl });
    const marks = placeArcBeats(buildChronicleArc(source, CYCLE_ID), source.beats);

    // North is act 4 — 270 to 360 degrees. Trusting `act: 1` would draw it East.
    expect(marks[0].theta).toBe(315);
    expect(marks[0].y).toBeLessThan(100);
    expect(marks[0].x).toBeLessThan(100);
  });

  it('keeps the parent drawn when a beat telescopes, and links the two', async () => {
    const fetchImpl = createWheel(
      [
        beat({ sub_beats: ['beat:east:299:opening:sub'] }),
        beat({
          id: 'beat:east:299:opening:sub',
          parent_beat_id: 'beat:east:299:opening',
          timestamp: '2026-07-26T06:00:00.000Z',
        }),
      ],
      [{ ...CYCLE, beats: ['beat:east:299:opening', 'beat:east:299:opening:sub'] }],
    );

    const source = await getNarrativeBeats({}, { fetchImpl });
    const byId = beatsById(source.beats);
    const child = byId.get('beat:east:299:opening:sub') as NarrativeBeatRecord;

    expect(beatDepth(child, byId)).toBe(1);
    expect([...beatLineage(child, source.beats)].sort()).toEqual([
      'beat:east:299:opening',
      'beat:east:299:opening:sub',
    ]);

    const marks = placeArcBeats(buildChronicleArc(source, CYCLE_ID), source.beats);
    const parentMark = marks.find((mark) => mark.beat.id === 'beat:east:299:opening');
    const childMark = marks.find((mark) => mark.beat.id === 'beat:east:299:opening:sub');

    expect(parentMark?.radius).toBe(46);
    expect(childMark?.radius).toBe(64);
    expect(childMark?.parentPlacement).toEqual({ x: parentMark?.x, y: parentMark?.y });
  });

  it('collapses depth beyond 2 onto the deepest drawn ancestor', async () => {
    const chain = ['a', 'b', 'c', 'd', 'e'].map((suffix, index, all) =>
      beat({
        id: `beat:${suffix}`,
        parent_beat_id: index === 0 ? undefined : `beat:${all[index - 1]}`,
        timestamp: `2026-07-26T0${index}:00:00.000Z`,
      }),
    );
    const fetchImpl = createWheel(chain, [
      { ...CYCLE, beats: chain.map((entry) => entry.id as string) },
    ]);

    const source = await getNarrativeBeats({}, { fetchImpl });
    const marks = placeArcBeats(buildChronicleArc(source, CYCLE_ID), source.beats);

    expect(marks.map((mark) => mark.beat.id)).toEqual(['beat:a', 'beat:b', 'beat:c']);
    expect(marks.find((mark) => mark.beat.id === 'beat:c')?.deeperCount).toBe(2);
  });

  it('groups a cycle arc by direction, ordered by timestamp', async () => {
    const fetchImpl = createWheel([
      beat({ id: 'beat:east:late', timestamp: '2026-07-26T09:00:00.000Z' }),
      beat({ id: 'beat:east:early', timestamp: '2026-07-26T05:00:00.000Z' }),
      beat({ id: 'beat:north:one', direction: 'north', act: 4 }),
    ]);

    const source = await getNarrativeBeats({}, { fetchImpl });
    const arc = buildChronicleArc(source, CYCLE_ID);

    expect(arc.byDirection.east.map((entry) => entry.id)).toEqual([
      'beat:east:early',
      'beat:east:late',
    ]);
    expect(arc.byDirection.south).toEqual([]);
    expect(arc.researchQuestion).toContain('share one ground');
    expect(arc.currentDirection).toBe('east');
    expect(arc.count).toBe(3);
  });

  it('reads cycle membership from both sides of the relation', async () => {
    const fetchImpl = createWheel(
      [beat({ id: 'beat:listed-only', cycle_id: undefined })],
      [{ ...CYCLE, beats: ['beat:listed-only'] }],
    );

    const source = await getNarrativeBeats({}, { fetchImpl });
    const members = beatsInCycle(source.beats, source.cycles[0]);

    expect(members.map((entry) => entry.id)).toEqual(['beat:listed-only']);
    // Listed by the cycle is not orphaned, even without its own cycle_id.
    expect(orphanBeats(source.beats, source.cycles)).toEqual([]);
  });
});
