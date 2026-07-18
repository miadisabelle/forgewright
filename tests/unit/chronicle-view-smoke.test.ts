// ─── Chronicle view modules — import smoke (mission fw-2607) ─────────────────
// The chronicle chunk is lazy-loaded (ViewRouter dynamic import), so a broken
// import would only surface when a person opens the tab. This locks the module
// graph — component render behavior itself is consciously left to a future
// RTL/jsdom slice (miadisabelle/forgewright#7 item 3).

import { describe, expect, it } from 'vitest';

describe('chronicle view module graph', () => {
  it('ChronicleView, Markdown, and useMwHealth import and export components', async () => {
    const view = await import('@forgewright/components/chronicle/ChronicleView');
    const markdown = await import('@forgewright/components/chronicle/Markdown');
    const health = await import('@forgewright/lib/useMwHealth');

    expect(typeof view.default).toBe('function');
    expect(typeof markdown.default).toBe('function');
    expect(typeof health.useMwHealth).toBe('function');
    expect(typeof health.MwHeatDot).toBe('function');
  });
});
