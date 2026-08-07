/**
 * Forgewright Runtime Bridge (WS8) — presentational live-state bridge.
 *
 * Wraps the shared `@smcraft/bridge-react` `createBridgeSession` core (the
 * framework-agnostic, React-free session) with `role: 'runtime'`, so a running
 * `Machine` can light up its current state on any design-time canvas — web
 * designers, or other forgewright tabs — in real time.
 *
 * ADDITIVE and presentational only: nothing here mutates the SMDF. `emitFull`
 * seeds viewers with the graph once on connect; `enter` / `exit` drive only the
 * subscribers' `activeStates`. The whole capability is gated on
 * `NEXT_PUBLIC_SMCRAFT_BRIDGE_URL` — when it is unset, `createRuntimeBridge`
 * returns a no-op immediately, so the interpreter, the Next build, and the
 * vitest suite are untouched.
 *
 * The shared session is loaded via dynamic `import()` (mirroring how
 * `runtime-bridge.ts` lazily reaches for `smcraft`), so `react` /
 * `socket.io-client` never enter the module graph unless the bridge is enabled.
 */

import type { StateMachineDefinition } from '../types/smdf';
// The shared protocol owns its own copy of the SMDF types; forgewright's SMDF
// (settings/actions differ in presentational fields) is structurally the same
// on the wire, so it is cast at the emit boundary.
import type { StateMachineDefinition as ProtocolDefinition } from '@smcraft/bridge-protocol';
import type { BridgeSession } from '@smcraft/bridge-react';

// ─── Enablement ──────────────────────────────────────────────────────────────

/** The bridge server URL, or undefined when the capability is off. */
export function getBridgeUrl(): string | undefined {
  // Static access so Next inlines the value for client bundles; on the server
  // (MCP runtime path) it reads the real environment.
  const url = process.env.NEXT_PUBLIC_SMCRAFT_BRIDGE_URL;
  return url && url.trim().length > 0 ? url : undefined;
}

/** True when a runtime bridge should actually connect. */
export function isBridgeEnabled(): boolean {
  return getBridgeUrl() !== undefined;
}

// ─── Public shape ────────────────────────────────────────────────────────────

export interface RuntimeBridge {
  /** False for the no-op returned when the bridge URL is unset. */
  readonly enabled: boolean;
  /** Presentational `runtime.enter` — lights `state` for every viewer. */
  enter(state: string, from?: string, eventId?: string): void;
  /** Presentational `runtime.exit` — clears `state` for every viewer. */
  exit(state: string): void;
  /** Re-seed the whole graph for viewers (never mutates the SMDF). */
  emitFull(def: StateMachineDefinition): void;
  /** Tear down the underlying socket session. */
  disconnect(): void;
}

export interface CreateRuntimeBridgeOptions {
  /** Stable doc identity shared with viewers (SMDF path or namespace.name). */
  docId: string;
  /** Bridge server URL; defaults to `NEXT_PUBLIC_SMCRAFT_BRIDGE_URL`. */
  url?: string;
  /** Presence label shown to other participants. */
  name?: string;
  /** Seed viewers with this definition once connected. */
  definition?: StateMachineDefinition;
  /** Light this leaf as soon as the graph is seeded (the machine's start). */
  initialState?: string;
}

// A shared, allocation-free no-op used whenever the bridge is disabled.
const NOOP_BRIDGE: RuntimeBridge = {
  enabled: false,
  enter() {},
  exit() {},
  emitFull() {},
  disconnect() {},
};

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a live runtime bridge. Resolves to a disabled no-op immediately when
 * the bridge URL is unset. When enabled it connects in the background and, on
 * the first `connected` status, seeds the graph via `emitFull(definition)` and
 * lights `initialState`. Every method is best-effort — a bridge failure never
 * propagates into the interpreter.
 */
export async function createRuntimeBridge(
  opts: CreateRuntimeBridgeOptions,
): Promise<RuntimeBridge> {
  const url = opts.url ?? getBridgeUrl();
  if (!url) return NOOP_BRIDGE;

  let session: BridgeSession;
  try {
    // Mirror runtime-bridge.ts's lazy `smcraft` import: an indirected specifier
    // plus `webpackIgnore` keeps the shared React-hook barrel out of webpack's
    // graph — Next rejects `useSyncExternalStore` (in the re-exported
    // `useSmcraftBridge`) anywhere in a Server Component / route chain. At
    // runtime this resolves in Node, where the hook module loads harmlessly and
    // we only ever touch the React-free `createBridgeSession`.
    const specifier = '@smcraft/bridge-react';
    const mod = (await import(/* webpackIgnore: true */ specifier)) as typeof import('@smcraft/bridge-react');
    session = mod.createBridgeSession({
      url,
      role: 'runtime',
      docId: opts.docId,
      name: opts.name ?? 'forgewright-runtime',
    });

    // Seed exactly once, on the first `connected` snapshot, so `def:full`
    // reaches viewers before any `runtime.enter`. socket.io preserves emit
    // order thereafter, so subsequent transitions stay consistent.
    const def = opts.definition;
    const initialState = opts.initialState;
    if (def || initialState) {
      let seeded = false;
      const unsub = session.subscribe(() => {
        if (seeded) return;
        if (session.getSnapshot().status !== 'connected') return;
        seeded = true;
        try {
          if (def) session.emitFull(def as unknown as ProtocolDefinition);
          if (initialState) session.enter(initialState);
        } catch {
          /* best-effort seed */
        }
        unsub();
      });
    }

    session.connect();
  } catch {
    // Import or construction failed — stay silent and disabled.
    return NOOP_BRIDGE;
  }

  return {
    enabled: true,
    enter(state, from, eventId) {
      try {
        session.enter(state, from, eventId);
      } catch {
        /* best-effort */
      }
    },
    exit(state) {
      try {
        session.exit(state);
      } catch {
        /* best-effort */
      }
    },
    emitFull(nextDef) {
      try {
        session.emitFull(nextDef as unknown as ProtocolDefinition);
      } catch {
        /* best-effort */
      }
    },
    disconnect() {
      try {
        session.disconnect();
      } catch {
        /* best-effort */
      }
    },
  };
}
