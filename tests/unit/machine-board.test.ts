// ─── The state-machine board ─────────────────────────────────────────────────
// Two things the designer tab now rests on, neither of which needs a DOM.
//
//   1. The arrangement. Episode diagrams carry no coordinates, so every box a
//      reader sees is derived. Before the stateloom canvas landed, that
//      derivation was a single row — states ran off the right edge and their
//      event labels printed through each other. These tests assert the property
//      that fixed it: boxes that do not overlap, laid out in layers.
//   2. The memory. What a reader drags is kept in this browser and nothing else
//      is, so an improvement to the derivation still reaches them.
//
// Render behaviour stays with the canvas package's own suite; this file locks
// what forgewright is responsible for. (Module-graph smoke for the lazy chunk
// lives alongside, mirroring tests/unit/chronicle-view-smoke.test.ts.)

import { describe, expect, it } from 'vitest';
import { autoLayout, type LayoutBox } from '@miadi/stateloom-canvas';
import {
  memoryKey,
  pruneToDeviations,
} from '@forgewright/lib/designer/layout-memory';
import type { StateMachineDefinition } from '@forgewright/lib/types';

// A fan-out with a loop back — the shape that used to draw as one rope.
const DEFINITION: StateMachineDefinition = {
  settings: { namespace: 'Test', name: 'Board', asynchronous: false },
  events: [
    {
      name: 'Internal',
      events: [{ id: 'ADVANCE' }, { id: 'REVIEW' }, { id: 'REJECT' }],
    },
  ],
  state: {
    name: 'Root',
    states: [
      { name: 'Draft', transitions: [{ event: 'ADVANCE', nextState: 'Assembly' }] },
      { name: 'Assembly', transitions: [{ event: 'REVIEW', nextState: 'Review' }] },
      {
        name: 'Review',
        transitions: [
          { event: 'REJECT', nextState: 'Assembly' },
          { event: 'ADVANCE', nextState: 'Locked' },
        ],
      },
      { name: 'Locked', kind: 'final' },
    ],
  },
};

function overlaps(a: LayoutBox, b: LayoutBox): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

describe('derived board', () => {
  const positions = autoLayout(DEFINITION);

  it('gives every state a box', () => {
    for (const name of ['Draft', 'Assembly', 'Review', 'Locked']) {
      expect(positions[name]).toBeDefined();
      expect(positions[name].width).toBeGreaterThan(0);
      expect(positions[name].height).toBeGreaterThan(0);
    }
  });

  it('never lets two boxes overlap', () => {
    const boxes = ['Draft', 'Assembly', 'Review', 'Locked'].map((n) => positions[n]);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  it('lays the flow out in layers, not in one row', () => {
    // Draft → Assembly → Review → Locked is a chain, so each sits strictly
    // below the last. A single row — the old behaviour — would tie every y.
    expect(positions.Assembly.y).toBeGreaterThan(positions.Draft.y);
    expect(positions.Review.y).toBeGreaterThan(positions.Assembly.y);
    expect(positions.Locked.y).toBeGreaterThan(positions.Review.y);
  });

  it('is a pure function of the definition — the same diagram derives the same board', () => {
    expect(autoLayout(DEFINITION)).toEqual(positions);
  });

  it('a back edge does not drag its target down a layer', () => {
    // Review → Assembly is a loop. If it were layered as a forward edge,
    // Assembly would be pushed below Review and the chain would invert.
    expect(positions.Assembly.y).toBeLessThan(positions.Review.y);
  });
});

describe('board memory', () => {
  const derived = autoLayout(DEFINITION);

  it('keys memory by the diagram path so two episodes never collide', () => {
    expect(memoryKey('ep-103/diagrams/a.smdf.json')).not.toEqual(
      memoryKey('ep-311/diagrams/a.smdf.json'),
    );
  });

  it('remembers a dragged box and forgets a derived one', () => {
    const dragged = { ...derived.Draft, x: derived.Draft.x + 240 };
    const kept = pruneToDeviations({ ...derived, Draft: dragged }, derived);

    expect(Object.keys(kept)).toEqual(['Draft']);
    expect(kept.Draft).toEqual(dragged);
  });

  it('writes nothing at all for a board nobody touched', () => {
    // ⚡ Arrange re-derives, so what it leaves behind reproduces exactly.
    expect(pruneToDeviations(derived, derived)).toEqual({});
  });

  it('drops a name the derivation no longer knows', () => {
    // A state renamed out of the diagram: nothing ever looks the old one up
    // again, so a stale entry can never raise an error — it is simply pruned.
    const stale = { ...derived, Removed: { x: 0, y: 0, width: 10, height: 10 } };
    expect(pruneToDeviations(stale, derived).Removed).toBeUndefined();
  });
});

describe('state machine view module graph', () => {
  it('the lazy designer chunk imports and exports its components', async () => {
    const view = await import('@forgewright/components/designer/state-machine/StateMachineView');
    const statePanel = await import('@forgewright/components/designer/state-machine/StatePanel');
    const transitionPanel = await import(
      '@forgewright/components/designer/state-machine/TransitionPanel'
    );

    expect(typeof view.default).toBe('function');
    expect(typeof statePanel.default).toBe('function');
    expect(typeof transitionPanel.default).toBe('function');
  });
});
