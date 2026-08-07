// ─── Episode diagrams: discovery + SMDF→WorkspaceStateMachine mapping ────────
// Inline fixtures mirror the episode-103 shape on disk — a `stateMachine`
// wrapper around { settings, events, state }. The golden suite at the end reads
// the REAL ep103 files under MIADI_CHRONICLE_ROOT and is skipped on machines
// that do not mount the chronicle.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ChronicleRootUnavailableError,
  DEFAULT_CHRONICLE_ROOT,
  DiagramMappingError,
  DiagramNotFoundError,
  InvalidDiagramPathError,
  initialStateOf,
  listEpisodeDiagrams,
  loadWorkspaceStateMachine,
  mapSmdfToWorkspaceStateMachine,
  parseSmdfDefinition,
} from '../../src/lib/chronicle/diagrams';

const EP103 = '2026-06-28-episode-103-film-preprod-report-phase-2';

function smdfFixture(): Record<string, unknown> {
  return {
    stateMachine: {
      settings: { namespace: 'miadi.chronicle.ep103', name: 'FilmPreprod', asynchronous: false },
      events: [
        {
          name: 'Internal',
          events: [{ id: 'GREENLIGHT', description: 'Approved and funded' }],
        },
      ],
      state: {
        name: 'Root',
        states: [
          {
            name: 'Development',
            kind: 'normal',
            transitions: [{ event: 'GREENLIGHT', nextState: 'PreProduction' }],
          },
          { name: 'PreProduction', kind: 'normal' },
          { name: 'Released', kind: 'final' },
        ],
      },
    },
  };
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

describe('parseSmdfDefinition', () => {
  it('unwraps the stateMachine wrapper (episode-103 on-disk shape)', () => {
    const definition = parseSmdfDefinition(smdfFixture());
    expect(definition.settings.namespace).toBe('miadi.chronicle.ep103');
    expect(definition.state.states?.map((state) => state.name)).toEqual([
      'Development',
      'PreProduction',
      'Released',
    ]);
  });

  it('accepts a bare definition and a definition wrapper', () => {
    const bare = smdfFixture().stateMachine;
    expect(parseSmdfDefinition(bare).state.name).toBe('Root');
    expect(parseSmdfDefinition({ definition: bare }).state.name).toBe('Root');
  });

  it('synthesizes missing settings and events for a state-only sketch', () => {
    const definition = parseSmdfDefinition({
      state: { name: 'Root', states: [{ name: 'Only' }] },
    });
    expect(definition.settings.namespace).toBe('miadi.chronicle');
    expect(definition.settings.asynchronous).toBe(false);
    expect(definition.events).toEqual([]);
  });

  it('raises DiagramMappingError when there is no state object', () => {
    expect(() => parseSmdfDefinition({ stateMachine: { settings: {} } }))
      .toThrow(DiagramMappingError);
    expect(() => parseSmdfDefinition('not an object')).toThrow(DiagramMappingError);
    expect(() => parseSmdfDefinition(null)).toThrow(DiagramMappingError);
  });

  it('raises DiagramMappingError with named issues on schema violation', () => {
    expect(() =>
      parseSmdfDefinition({
        stateMachine: {
          settings: { namespace: 'x', asynchronous: false },
          events: [],
          state: { name: 'Root', states: [{ name: 'Bad', kind: 'not-a-kind' }] },
        },
      }),
    ).toThrow(DiagramMappingError);
  });
});

describe('mapSmdfToWorkspaceStateMachine', () => {
  it('synthesizes runtime fields: currentState = first state, tension 0.5, empty history', () => {
    const machine = mapSmdfToWorkspaceStateMachine(smdfFixture(), {
      workspaceId: `${EP103}/diagrams/film-preprod`,
    });
    expect(machine.workspaceId).toBe(`${EP103}/diagrams/film-preprod`);
    expect(machine.currentState).toBe('Development');
    expect(machine.tensionLevel).toBe(0.5);
    expect(machine.eventHistory).toEqual([]);
    expect(machine.createdAt).toBeTruthy();
    expect(machine.updatedAt).toBeTruthy();
  });

  it('falls back to the root state name when the root has no children', () => {
    expect(initialStateOf(parseSmdfDefinition({ state: { name: 'Lonely' } }))).toBe('Lonely');
  });

  it('honours provided provenance timestamps', () => {
    const machine = mapSmdfToWorkspaceStateMachine(smdfFixture(), {
      workspaceId: 'w',
      createdAt: '2026-06-28T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
    });
    expect(machine.createdAt).toBe('2026-06-28T00:00:00.000Z');
    expect(machine.updatedAt).toBe('2026-07-27T00:00:00.000Z');
  });
});

// ─── Discovery over a synthetic chronicle root ───────────────────────────────

describe('listEpisodeDiagrams', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'forgewright-diagrams-'));

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('finds <episode>/diagrams/*.smdf.json newest-episode-first, names ascending', async () => {
    const older = path.join(root, '2026-06-28-episode-103-film', 'diagrams');
    const newer = path.join(root, '2026-07-26-episode-300-later', 'diagrams');
    mkdirSync(older, { recursive: true });
    mkdirSync(newer, { recursive: true });
    mkdirSync(path.join(root, '2026-07-01-episode-200-empty')); // no diagrams/
    writeFileSync(path.join(older, 'film-preprod.smdf.json'), JSON.stringify(smdfFixture()));
    writeFileSync(path.join(older, 'film-postprod.smdf.json'), JSON.stringify(smdfFixture()));
    writeFileSync(path.join(older, 'README.md'), 'not a diagram');
    writeFileSync(path.join(newer, 'loop.smdf.json'), JSON.stringify(smdfFixture()));

    const diagrams = await listEpisodeDiagrams(root);
    expect(diagrams).toEqual([
      {
        episode: '2026-07-26-episode-300-later',
        name: 'loop',
        relativePath: '2026-07-26-episode-300-later/diagrams/loop.smdf.json',
      },
      {
        episode: '2026-06-28-episode-103-film',
        name: 'film-postprod',
        relativePath: '2026-06-28-episode-103-film/diagrams/film-postprod.smdf.json',
      },
      {
        episode: '2026-06-28-episode-103-film',
        name: 'film-preprod',
        relativePath: '2026-06-28-episode-103-film/diagrams/film-preprod.smdf.json',
      },
    ]);
  });

  it('raises ChronicleRootUnavailableError when the root is missing', async () => {
    await expect(listEpisodeDiagrams(path.join(root, 'no-such-root')))
      .rejects.toBeInstanceOf(ChronicleRootUnavailableError);
  });

  it('loads a discovered diagram end-to-end through loadWorkspaceStateMachine', async () => {
    const machine = await loadWorkspaceStateMachine(
      '2026-06-28-episode-103-film/diagrams/film-preprod.smdf.json',
      root,
    );
    expect(machine.currentState).toBe('Development');
    expect(machine.workspaceId).toBe('2026-06-28-episode-103-film/diagrams/film-preprod');
  });

  it('answers named errors for unsafe paths, missing files, and unparseable JSON', async () => {
    await expect(loadWorkspaceStateMachine('../escape/diagrams/x.smdf.json', root))
      .rejects.toBeInstanceOf(InvalidDiagramPathError);
    await expect(loadWorkspaceStateMachine('/abs/diagrams/x.smdf.json', root))
      .rejects.toBeInstanceOf(InvalidDiagramPathError);
    await expect(loadWorkspaceStateMachine('2026-06-28-episode-103-film/diagrams/x.md', root))
      .rejects.toBeInstanceOf(InvalidDiagramPathError);
    await expect(loadWorkspaceStateMachine('2026-06-28-episode-103-film/diagrams/none.smdf.json', root))
      .rejects.toBeInstanceOf(DiagramNotFoundError);

    writeFileSync(
      path.join(root, '2026-06-28-episode-103-film', 'diagrams', 'broken.smdf.json'),
      '{ not json',
    );
    await expect(loadWorkspaceStateMachine('2026-06-28-episode-103-film/diagrams/broken.smdf.json', root))
      .rejects.toBeInstanceOf(DiagramMappingError);
  });
});

// ─── Golden fixtures: the REAL episode-103 diagrams ──────────────────────────

const GOLDEN_ROOT = process.env.MIADI_CHRONICLE_ROOT ?? DEFAULT_CHRONICLE_ROOT;
const GOLDEN_EP103 = path.join(GOLDEN_ROOT, EP103, 'diagrams');

describe.skipIf(!existsSync(GOLDEN_EP103))('episode-103 golden diagrams', () => {
  it('lists both film diagrams from the chronicle root', async () => {
    const diagrams = await listEpisodeDiagrams(GOLDEN_ROOT);
    const ep103 = diagrams.filter((diagram) => diagram.episode === EP103);
    expect(ep103.map((diagram) => diagram.name)).toEqual(['film-postprod', 'film-preprod']);
  });

  it('maps film-preprod: FilmPreprod, initial Development, five phases', async () => {
    const machine = await loadWorkspaceStateMachine(
      `${EP103}/diagrams/film-preprod.smdf.json`,
      GOLDEN_ROOT,
    );
    expect(machine.definition.settings.name).toBe('FilmPreprod');
    expect(machine.currentState).toBe('Development');
    expect(machine.tensionLevel).toBe(0.5);
    expect(machine.eventHistory).toEqual([]);
    expect(machine.definition.state.states?.map((state) => state.name)).toEqual([
      'Development',
      'PreProduction',
      'Production',
      'PostProduction',
      'Released',
    ]);
  });

  it('maps film-postprod: initial Ingest, Released is final', async () => {
    const machine = await loadWorkspaceStateMachine(
      `${EP103}/diagrams/film-postprod.smdf.json`,
      GOLDEN_ROOT,
    );
    expect(machine.currentState).toBe('Ingest');
    const released = machine.definition.state.states?.find((state) => state.name === 'Released');
    expect(released?.kind).toBe('final');
  });
});
