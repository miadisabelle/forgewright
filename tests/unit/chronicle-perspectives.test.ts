import { describe, expect, it, vi } from 'vitest';
import {
  getPlanPerspectives,
  perspectiveMatchesPlan,
  type ChronicleArtifactReference,
} from '../../src/lib/chronicle/client';

const EP_PATH = '2026-07-13-episode-130-iaip-inquiry-relational-sync-to-miadi-chronicle';
const SESSION_ID = 'f994af2d-2400-4b08-9060-55027d68cc8e';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createPerspectiveFetch(payload: unknown, status = 200) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/api/plan-perspectives')) return jsonResponse(payload, status);
    return jsonResponse({ error: 'not found' }, 404);
  }) as unknown as typeof fetch;
}

const recursivePerspective = {
  id: `plan-perspective:${SESSION_ID}`,
  perspective: 1,
  plan: {
    session_id: SESSION_ID,
    plan_path: `/a/src/_sessiondata/${SESSION_ID}/plans/mission-plan-the-evolution-abundant-quail.md`,
    plan_filename: 'mission-plan-the-evolution-abundant-quail',
    plan_sha256: 'deadbeef',
    captured_at: '2026-07-15T17:39:00Z',
  },
  narrative: {
    title: "🌸 Miette's Perspective — The Carrier Learns to Travel",
    body_markdown: '# 🌸\n\nThe perspective now travels without surrendering authorship.',
    mia_context: 'Desired outcome: PerspectiveRecord carriage.',
  },
  lineage: {
    user_inputs_path: `/a/src/_sessiondata/${SESSION_ID}/_claude_user_inputs.jsonl`,
    input_count: 3,
  },
  episodes: [
    { path: EP_PATH, number: 130 },
    { path: EP_PATH, number: 130 },
    { path: '/etc/absolute-is-rejected' },
  ],
  source: {
    package: '@miadi/plan-insight',
    generator: { system: 'claude-code', model: 'sonnet' },
    registered_at: '2026-07-15T17:40:00Z',
    updated_at: '2026-07-15T18:00:00Z',
  },
};

describe('getPlanPerspectives', () => {
  it('projects the perspective record from the Medicine Wheel contract', async () => {
    const fetchImpl = createPerspectiveFetch({
      provider: 'jsonl',
      count: 1,
      plan_perspectives: [recursivePerspective],
    });

    const result = await getPlanPerspectives(
      { episodePath: EP_PATH },
      { baseUrl: 'http://192.168.2.30:3940', fetchImpl },
    );

    expect(result.count).toBe(1);
    expect(result.perspectives[0]).toMatchObject({
      id: `plan-perspective:${SESSION_ID}`,
      sessionId: SESSION_ID,
      planFilename: 'mission-plan-the-evolution-abundant-quail',
      planSha256: 'deadbeef',
      title: "🌸 Miette's Perspective — The Carrier Learns to Travel",
      miaContext: 'Desired outcome: PerspectiveRecord carriage.',
      generator: 'claude-code · sonnet',
      registeredAt: '2026-07-15T17:40:00Z',
      updatedAt: '2026-07-15T18:00:00Z',
    });
    // duplicate paths collapse; unsafe absolute path is rejected
    expect(result.perspectives[0].episodePaths).toEqual([EP_PATH]);
  });

  it('queries the pinned endpoint with an encoded episode_path filter', async () => {
    const fetchImpl = createPerspectiveFetch({ plan_perspectives: [] });

    await getPlanPerspectives({ episodePath: EP_PATH }, { fetchImpl });

    const calledUrl = String(
      (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0],
    );
    expect(calledUrl).toContain(`/api/plan-perspectives?episode_path=${encodeURIComponent(EP_PATH)}`);
  });

  it('supports session_id and id queries with episode_path precedence', async () => {
    const fetchImpl = createPerspectiveFetch({ plan_perspectives: [] });

    await getPlanPerspectives({ sessionId: SESSION_ID }, { fetchImpl });
    await getPlanPerspectives({ id: `plan-perspective:${SESSION_ID}` }, { fetchImpl });

    const calls = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (call) => String(call[0]),
    );
    expect(calls[0]).toContain(`session_id=${SESSION_ID}`);
    expect(calls[1]).toContain(`id=${encodeURIComponent(`plan-perspective:${SESSION_ID}`)}`);
  });

  it('rejects a query without any identity', async () => {
    const fetchImpl = createPerspectiveFetch({ plan_perspectives: [] });

    await expect(getPlanPerspectives({}, { fetchImpl })).rejects.toThrow(
      'episode_path, session_id, or id',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats an empty collection as count 0 rather than an error', async () => {
    const fetchImpl = createPerspectiveFetch({ provider: 'jsonl', count: 0, plan_perspectives: [] });

    const result = await getPlanPerspectives({ episodePath: EP_PATH }, { fetchImpl });

    expect(result).toEqual({ count: 0, perspectives: [] });
  });

  it('accepts a single record fallback shape', async () => {
    const fetchImpl = createPerspectiveFetch({ record: recursivePerspective });

    const result = await getPlanPerspectives({ id: recursivePerspective.id }, { fetchImpl });

    expect(result.count).toBe(1);
  });

  it('fails closed on malformed records without breaking valid siblings', async () => {
    const fetchImpl = createPerspectiveFetch({
      plan_perspectives: [
        {}, // no id
        { ...recursivePerspective, id: 'inquiry-weave:wrong-prefix' },
        { ...recursivePerspective, narrative: { title: 'no body' } },
        { ...recursivePerspective, plan: { plan_filename: 'orphan' } }, // no session_id
        recursivePerspective,
      ],
    });

    const result = await getPlanPerspectives({ episodePath: EP_PATH }, { fetchImpl });

    expect(result.count).toBe(1);
    expect(result.perspectives[0].sessionId).toBe(SESSION_ID);
  });

  it('bounds body_markdown to 64 KiB on the client side', async () => {
    const oversized = {
      ...recursivePerspective,
      narrative: {
        ...recursivePerspective.narrative,
        body_markdown: 'x'.repeat(70 * 1024),
      },
    };
    const fetchImpl = createPerspectiveFetch({ plan_perspectives: [oversized] });

    const result = await getPlanPerspectives({ episodePath: EP_PATH }, { fetchImpl });

    expect(result.perspectives[0].bodyMarkdown.length).toBe(64 * 1024);
  });

  it('propagates upstream HTTP failures (distinct from count 0)', async () => {
    const fetchImpl = createPerspectiveFetch({ error: 'boom' }, 503);

    await expect(getPlanPerspectives({ episodePath: EP_PATH }, { fetchImpl })).rejects.toThrow(
      'returned HTTP 503',
    );
  });
});

describe('perspectiveMatchesPlan', () => {
  const planCard: ChronicleArtifactReference = {
    id: 'node-1',
    name: 'abundant quail',
    kind: 'structured_plan',
    relativePath:
      '2026-07-13-episode-130-iaip-inquiry-relational-sync-to-miadi-chronicle/plans/mission-plan-the-evolution-abundant-quail.md',
  };

  const perspective = {
    id: `plan-perspective:${SESSION_ID}`,
    sessionId: SESSION_ID,
    planFilename: 'mission-plan-the-evolution-abundant-quail',
    title: 't',
    bodyMarkdown: 'b',
    episodePaths: [],
  };

  it('matches on plan filename with or without the .md suffix', () => {
    expect(perspectiveMatchesPlan(perspective, planCard)).toBe(true);
    expect(
      perspectiveMatchesPlan({ ...perspective, planFilename: 'mission-plan-the-evolution-abundant-quail.md' }, planCard),
    ).toBe(true);
    expect(perspectiveMatchesPlan({ ...perspective, planFilename: 'another-plan' }, planCard)).toBe(false);
  });

  it('prefers session_id when both sides carry it — decisive over filename', () => {
    const keyedCard = { ...planCard, sessionId: SESSION_ID };

    // Same session wins even when filenames disagree.
    expect(
      perspectiveMatchesPlan({ ...perspective, planFilename: 'renamed-plan' }, keyedCard),
    ).toBe(true);
    // Different session refuses even when filenames collide.
    expect(
      perspectiveMatchesPlan(
        { ...perspective, sessionId: 'another-session' },
        keyedCard,
      ),
    ).toBe(false);
  });

  it('prefers plan_sha256 when session ids are unavailable on the card', () => {
    const shaCard = { ...planCard, planSha256: 'deadbeef' };

    expect(
      perspectiveMatchesPlan(
        { ...perspective, planSha256: 'deadbeef', planFilename: 'renamed-plan' },
        shaCard,
      ),
    ).toBe(true);
    expect(
      perspectiveMatchesPlan({ ...perspective, planSha256: 'feedface' }, shaCard),
    ).toBe(false);
    // A perspective without a sha falls through to the filename comparison.
    expect(perspectiveMatchesPlan(perspective, shaCard)).toBe(true);
  });
});
