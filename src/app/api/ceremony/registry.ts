import { CeremonyRuntime } from '@forgewright/lib/ceremony/runtime';

// In-memory ceremony registry (keyed by ID).
// Production would persist to Redis / graph, but for the REST surface
// this singleton map is sufficient for session-scoped ceremonies.
const ceremonies = new Map<string, CeremonyRuntime>();

export function getCeremonyRegistry() {
  return ceremonies;
}
