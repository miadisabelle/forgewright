'use client';

// ─── Board memory ────────────────────────────────────────────────────────────
// Where a reader dragged the boxes, and how the view was pointed, kept in this
// browser and keyed by the diagram's chronicle path.
//
// An episode diagram on disk carries the machine, never the arrangement: the
// SMDF has no coordinates in it, and forgewright reads those files read-only.
// So `autoLayout` derives a board every time, and anything a reader moves by
// hand would be thrown away on the next visit — which is exactly what makes a
// designer feel disposable.
//
// Only *deviations* are written: each position is compared against what
// `autoLayout` derives for the same definition, and identical entries are
// dropped. Three things follow from that one rule —
//
//   · a state nobody ever dragged keeps following the layout algorithm, so an
//     improvement upstream still reaches a returning reader;
//   · ⤢ Arrange writes nothing, because a derived board re-derives exactly;
//   · a state that vanishes from the diagram simply stops appearing in the
//     derivation and is pruned on the next write — a stale name can never
//     raise an error, because nothing ever looks it up.

import { normalizeViewport, type LayoutBox, type Viewport } from '@miadi/stateloom-canvas';

const KEY_PREFIX = 'forgewright.machine-layout.v1:';

export interface BoardMemory {
  positions: Record<string, LayoutBox>;
  viewport: Viewport;
}

export function memoryKey(diagramPath: string): string {
  return `${KEY_PREFIX}${diagramPath}`;
}

function sameBox(a: LayoutBox, b: LayoutBox): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function isBox(value: unknown): value is LayoutBox {
  if (!value || typeof value !== 'object') return false;
  const box = value as Record<string, unknown>;
  return (
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height)
  );
}

/** The subset worth remembering: what differs from what the algorithm derives. */
export function pruneToDeviations(
  positions: Record<string, LayoutBox>,
  derived: Record<string, LayoutBox>,
): Record<string, LayoutBox> {
  const out: Record<string, LayoutBox> = {};
  for (const [name, box] of Object.entries(positions)) {
    const auto = derived[name];
    if (!auto) continue;
    if (!sameBox(box, auto)) out[name] = box;
  }
  return out;
}

/** Read this browser's memory for a diagram. Malformed data reads as nothing. */
export function readBoardMemory(diagramPath: string): BoardMemory | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(memoryKey(diagramPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoardMemory> | null;
    const positions: Record<string, LayoutBox> = {};
    for (const [name, box] of Object.entries(parsed?.positions ?? {})) {
      if (isBox(box)) positions[name] = box;
    }
    return { positions, viewport: normalizeViewport(parsed?.viewport) };
  } catch {
    return null;
  }
}

/** Write this browser's memory. A full disk quota is not fatal to the board. */
export function writeBoardMemory(
  diagramPath: string,
  positions: Record<string, LayoutBox>,
  viewport: Viewport,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      memoryKey(diagramPath),
      JSON.stringify({ positions, viewport, savedAt: Date.now() }),
    );
  } catch {
    // Private mode, quota, storage disabled — the board keeps working without
    // memory rather than failing the render.
  }
}

/** Forget one diagram's arrangement — what ⟲ Reset hands back to the algorithm. */
export function forgetBoardMemory(diagramPath: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(memoryKey(diagramPath));
  } catch {
    // Nothing to forget is the same outcome as forgetting.
  }
}
