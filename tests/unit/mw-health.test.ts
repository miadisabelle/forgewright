// ─── Medicine Wheel heat vocabulary — pure derivations (mission fw-2607) ──────
// The hook itself needs a DOM to test; the vocabulary that both the Chronicle
// banner and the StatusBar depend on is pure and locked down here.

import { describe, expect, it } from 'vitest';
import {
  MW_HEAT,
  deriveStatus,
  heatForStatus,
  readProbe,
  type MwHeat,
} from '@forgewright/lib/useMwHealth';

describe('deriveStatus', () => {
  it('a successful probe is live regardless of history', () => {
    expect(deriveStatus(true, false)).toBe('live');
    expect(deriveStatus(true, true)).toBe('live');
  });

  it('a failing probe cools iron that was hot', () => {
    expect(deriveStatus(false, true)).toBe('degraded');
  });

  it('iron that never lit stays cold', () => {
    expect(deriveStatus(false, false)).toBe('down');
  });
});

describe('heatForStatus', () => {
  it('maps the three settled states onto the heat vocabulary', () => {
    expect(heatForStatus('live')).toBe('ember');
    expect(heatForStatus('degraded')).toBe('cooling');
    expect(heatForStatus('down')).toBe('cold');
  });

  it('has no heat while the first probe is in flight', () => {
    expect(heatForStatus('checking')).toBeNull();
  });
});

describe('readProbe', () => {
  it('reads a healthy body as ok and keeps the upstream origin', () => {
    const reading = readProbe(true, {
      status: 'healthy',
      dependencies: { medicineWheel: { baseUrl: 'http://127.0.0.1:3940' } },
    });
    expect(reading).toEqual({ ok: true, baseUrl: 'http://127.0.0.1:3940', error: null });
  });

  it('a 503 body reports its own error message', () => {
    const reading = readProbe(false, { status: 'unhealthy', error: 'Medicine Wheel unavailable' });
    expect(reading.ok).toBe(false);
    expect(reading.error).toBe('Medicine Wheel unavailable');
  });

  it('an HTTP-ok body that is not healthy is still a failed probe', () => {
    expect(readProbe(true, { status: 'unhealthy' }).ok).toBe(false);
  });

  it('a malformed or missing body fails with a generic message', () => {
    expect(readProbe(false, null)).toEqual({ ok: false, baseUrl: null, error: 'health check failed' });
  });
});

describe('MW_HEAT presentation', () => {
  it('only ember glows — a dead thing never wears ember', () => {
    const glowing = (Object.keys(MW_HEAT) as MwHeat[]).filter((heat) => MW_HEAT[heat].glows);
    expect(glowing).toEqual(['ember']);
  });

  it('every heat state carries a label, description, and classes', () => {
    for (const presentation of Object.values(MW_HEAT)) {
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.description.length).toBeGreaterThan(0);
      expect(presentation.dotClassName).toContain('bg-');
      expect(presentation.textClassName).toContain('text-');
    }
  });
});
