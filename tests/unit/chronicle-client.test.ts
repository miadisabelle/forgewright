import { describe, expect, it, vi } from 'vitest';
import {
  findParentEpisode,
  getChronicleSnapshot,
} from '../../src/lib/chronicle/client';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createFetch(nodes: unknown[], health: unknown = { status: 'healthy', provider: 'jsonl' }) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/api/health')) return jsonResponse(health);
    if (url.endsWith('/api/nodes')) return jsonResponse({ nodes, provider: 'jsonl', count: nodes.length });
    return jsonResponse({ error: 'not found' }, 404);
  }) as unknown as typeof fetch;
}

const rootNode = {
  id: 'chronicle:miadi-chronicle',
  type: 'knowledge',
  name: 'Miadi Chronicle',
  direction: 'north',
  metadata: {
    contract: 'miadi.artifact-ref.v1',
    kind: 'chronicle_root',
    root: 'MIADI_CHRONICLE_ROOT',
    relative_path: '.',
  },
  created_at: '2026-07-10T10:00:00.000Z',
  updated_at: '2026-07-10T10:00:00.000Z',
};

const episodeNode = {
  id: 'chronicle:episode-122',
  type: 'knowledge',
  name: 'Chronicle Runtime and Forgewright Interface',
  description: 'Episode 122 interface branch',
  direction: 'north',
  metadata: {
    contract: 'miadi.artifact-ref.v1',
    kind: 'chronicle_episode',
    root: 'MIADI_CHRONICLE_ROOT',
    relative_path: '2026-07-10-episode-122/episode.yaml',
    parent_id: 'chronicle:miadi-chronicle',
    schema_version: 'chronicle.episode-yaml.v1',
    status: 'composing',
  },
  created_at: '2026-07-10T11:00:00.000Z',
  updated_at: '2026-07-10T12:00:00.000Z',
};

describe('getChronicleSnapshot', () => {
  it('normalizes the read-only artifact-reference contract', async () => {
    const planNode = {
      ...episodeNode,
      id: 'plan:one',
      name: 'First plan',
      metadata: {
        ...episodeNode.metadata,
        kind: 'structured_plan',
        relative_path: '2026-07-10-episode-122/forgewright/plans/one.json',
        parent_id: episodeNode.id,
        goal_id: 'goal:plan-insight',
        goal_summary: 'Mia overview + Miette perspective + source trace',
      },
    };
    const machineNode = {
      ...episodeNode,
      id: 'machine:one',
      name: 'First machine',
      metadata: {
        ...episodeNode.metadata,
        kind: 'state_machine',
        relative_path: '2026-07-10-episode-122/forgewright/machines/one.json',
      },
    };
    const fetchImpl = createFetch([rootNode, episodeNode, planNode, machineNode]);

    const snapshot = await getChronicleSnapshot({
      baseUrl: 'http://127.0.0.1:3940/',
      fetchImpl,
    });

    expect(snapshot.readonly).toBe(true);
    expect(snapshot.source).toEqual({
      service: 'medicine-wheel',
      baseUrl: 'http://127.0.0.1:3940',
      status: 'healthy',
      provider: 'jsonl',
    });
    expect(snapshot.root?.id).toBe(rootNode.id);
    expect(snapshot.episodes).toHaveLength(1);
    expect(snapshot.episodes[0]).toMatchObject({
      id: episodeNode.id,
      kind: 'chronicle_episode',
      parentId: rootNode.id,
      schemaVersion: 'chronicle.episode-yaml.v1',
      status: 'composing',
    });
    expect(snapshot.structuredPlans).toEqual([
      expect.objectContaining({
        id: 'plan:one',
        goalId: 'goal:plan-insight',
        goalSummary: 'Mia overview + Miette perspective + source trace',
      }),
    ]);
    expect(findParentEpisode(snapshot.structuredPlans[0], snapshot.episodes)?.id).toBe(
      episodeNode.id,
    );
    expect(snapshot.stateMachines.map(({ id }) => id)).toEqual(['machine:one']);
    expect(snapshot.ignoredNodeCount).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns no episode association for a missing parent', () => {
    expect(
      findParentEpisode(
        {
          id: 'plan:orphan',
          name: 'Orphan plan',
          kind: 'structured_plan',
          relativePath: 'plans/orphan.json',
          parentId: 'chronicle:missing',
        },
        [],
      ),
    ).toBeNull();
  });

  it('ignores unrelated, incompatible, and unsafe references', async () => {
    const fetchImpl = createFetch([
      rootNode,
      { ...episodeNode, type: 'human' },
      { ...episodeNode, metadata: { ...episodeNode.metadata, contract: 'other.v1' } },
      {
        ...episodeNode,
        id: 'chronicle:unsafe',
        metadata: { ...episodeNode.metadata, relative_path: '../outside/episode.yaml' },
      },
    ]);

    const snapshot = await getChronicleSnapshot({ fetchImpl });

    expect(snapshot.root?.id).toBe(rootNode.id);
    expect(snapshot.episodes).toEqual([]);
    expect(snapshot.ignoredNodeCount).toBe(3);
  });

  it('fails closed when Medicine Wheel is not healthy JSONL', async () => {
    const fetchImpl = createFetch([rootNode], { status: 'unhealthy', provider: 'jsonl' });

    await expect(getChronicleSnapshot({ fetchImpl })).rejects.toThrow(
      'Medicine Wheel health contract is not healthy JSONL',
    );
  });

  it('fails closed on malformed node responses', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return url.endsWith('/api/health')
        ? jsonResponse({ status: 'healthy', provider: 'jsonl' })
        : jsonResponse({ nodes: 'not-an-array' });
    }) as unknown as typeof fetch;

    await expect(getChronicleSnapshot({ fetchImpl })).rejects.toThrow(
      'Medicine Wheel nodes response is malformed',
    );
  });
});
