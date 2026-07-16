import { describe, expect, it, vi } from 'vitest';
import { getEpisodeInquiry } from '../../src/lib/chronicle/client';

const EP_PATH = '2026-07-13-episode-126-mila-ai-indigenous-gathering';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createInquiryFetch(payload: unknown, status = 200) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/api/inquiry-weaves')) return jsonResponse(payload, status);
    return jsonResponse({ error: 'not found' }, 404);
  }) as unknown as typeof fetch;
}

const ep126Inquiry = {
  id: `inquiry-weave:${EP_PATH}:ep126-mila-ai-event-260715-b08218a8-0441-4596-a16e-47483d3ab57c`,
  weave: 1,
  artefact: {
    id: 'ep126-mila-ai-event-260715-b08218a8-0441-4596-a16e-47483d3ab57c',
    path: '/src/IAIP/prototypes/artefacts/ep126-mila-ai-event-260715-b08218a8-0441-4596-a16e-47483d3ab57c',
  },
  issue: 'miadisabelle/Etuaptmumk-RSM#245',
  issue_url: 'https://github.com/miadisabelle/Etuaptmumk-RSM/issues/245',
  episode: { number: 126, path: EP_PATH },
  last_sync: {
    state: 'in-sync',
    at: '2026-07-15T01:00:00Z',
    tree_sha256: 'abc123',
    file_count: 4,
    bytes_total: 341001,
  },
};

const weavePayload = {
  provider: 'jsonl',
  count: 1,
  inquiry_weaves: [ep126Inquiry],
};

describe('getEpisodeInquiry', () => {
  it('projects the three identities and last_sync state from the Medicine Wheel contract', async () => {
    const fetchImpl = createInquiryFetch(weavePayload);

    const result = await getEpisodeInquiry(EP_PATH, {
      baseUrl: 'http://192.168.2.30:3940/',
      fetchImpl,
    });

    expect(result.count).toBe(1);
    expect(result.inquiries[0]).toEqual({
      artefact: 'ep126-mila-ai-event-260715-b08218a8-0441-4596-a16e-47483d3ab57c',
      issueRef: 'miadisabelle/Etuaptmumk-RSM#245',
      issueUrl: 'https://github.com/miadisabelle/Etuaptmumk-RSM/issues/245',
      syncState: 'in-sync',
      syncedAt: '2026-07-15T01:00:00Z',
    });
  });

  it('queries the pinned endpoint with an encoded episode_path filter', async () => {
    const fetchImpl = createInquiryFetch(weavePayload);

    await getEpisodeInquiry(EP_PATH, { baseUrl: 'http://192.168.2.30:3940', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = String((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(calledUrl).toBe(
      `http://192.168.2.30:3940/api/inquiry-weaves?episode_path=${encodeURIComponent(EP_PATH)}`,
    );
  });

  it('flattens weaves when episode_number matches several episodes', async () => {
    const legacyInquiry = {
      ...ep126Inquiry,
      artefact: ep126Inquiry.artefact.id,
    };
    const fetchImpl = createInquiryFetch({
      weaves: [
        { episode: { number: 126, path: `${EP_PATH}-a` }, inquiries: [legacyInquiry] },
        {
          episode: { number: 126, path: `${EP_PATH}-b` },
          inquiries: [{ artefact: 'ep126-second', last_sync: { state: 'stale' } }],
        },
      ],
    });

    const result = await getEpisodeInquiry('126', { fetchImpl });

    expect(result.count).toBe(2);
    expect(result.inquiries.map((relation) => relation.artefact)).toEqual([
      'ep126-mila-ai-event-260715-b08218a8-0441-4596-a16e-47483d3ab57c',
      'ep126-second',
    ]);
    expect(result.inquiries[1].syncState).toBe('stale');
  });

  it('projects every registered weave when no episode filter is given', async () => {
    const fetchImpl = createInquiryFetch({
      provider: 'jsonl',
      count: 2,
      inquiry_weaves: [ep126Inquiry, { ...ep126Inquiry, artefact: { id: 'ep128-second' } }],
    });

    const result = await getEpisodeInquiry(null, {
      baseUrl: 'http://192.168.2.30:3940',
      fetchImpl,
    });

    const calledUrl = String((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(calledUrl).toBe('http://192.168.2.30:3940/api/inquiry-weaves');
    expect(result.episodePath).toBeNull();
    expect(result.count).toBe(2);
  });

  it('treats an empty weave list as count 0 rather than an error', async () => {
    const fetchImpl = createInquiryFetch({ provider: 'jsonl', count: 0, weaves: [] });

    const result = await getEpisodeInquiry(EP_PATH, { fetchImpl });

    expect(result).toEqual({ episodePath: EP_PATH, count: 0, inquiries: [] });
  });

  it('accepts a flat inquiries array as a fallback shape', async () => {
    const fetchImpl = createInquiryFetch({
      inquiries: [{ artefact: 'ep-flat', last_sync: { state: 'episode-copy-diverged' } }],
    });

    const result = await getEpisodeInquiry(EP_PATH, { fetchImpl });

    expect(result.count).toBe(1);
    expect(result.inquiries[0].syncState).toBe('episode-copy-diverged');
  });

  it('fails closed on malformed relations and invalid identity fields', async () => {
    const fetchImpl = createInquiryFetch({
      weaves: [
        {
          episode: { path: EP_PATH },
          inquiries: [
            {}, // no artefact → dropped
            { artefact: 'ep-a', issue: 'not-a-ref', issue_url: 'https://example.test/1' },
            { artefact: 'ep-b', issue: 'owner/repo#5', issue_url: 'ftp://bad-scheme' },
            { artefact: 'ep-c' },
            { artefact: 'ep-d', last_sync: { state: 'weird-unknown' } },
          ],
        },
      ],
    });

    const result = await getEpisodeInquiry(EP_PATH, { fetchImpl });

    expect(result.inquiries.map((relation) => relation.artefact)).toEqual([
      'ep-a',
      'ep-b',
      'ep-c',
      'ep-d',
    ]);
    // invalid issue ref dropped, valid url kept
    expect(result.inquiries[0]).toMatchObject({ artefact: 'ep-a', issueUrl: 'https://example.test/1' });
    expect(result.inquiries[0].issueRef).toBeUndefined();
    // valid ref kept, non-http url dropped
    expect(result.inquiries[1]).toMatchObject({ artefact: 'ep-b', issueRef: 'owner/repo#5' });
    expect(result.inquiries[1].issueUrl).toBeUndefined();
    // absent or unknown last_sync defaults to never-synced
    expect(result.inquiries[2].syncState).toBe('never-synced');
    expect(result.inquiries[3].syncState).toBe('never-synced');
  });

  it('propagates upstream HTTP failures (distinct from count 0)', async () => {
    const fetchImpl = createInquiryFetch({ error: 'boom' }, 503);

    await expect(getEpisodeInquiry(EP_PATH, { fetchImpl })).rejects.toThrow('returned HTTP 503');
  });
});
