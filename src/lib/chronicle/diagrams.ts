// ─── Chronicle Episode Diagrams ──────────────────────────────────────────────
// Filesystem discovery + SMDF→WorkspaceStateMachine mapping for episode-hosted
// state machines. Convention (episode 103 diagrams/README.md, 2026-07-26):
//
//   ${MIADI_CHRONICLE_ROOT}/<date>-episode-NNN-<slug>/diagrams/<name>.smdf.json
//
// The chronicle root env law is shared with the Miadi app: MIADI_CHRONICLE_ROOT,
// defaulting to /srv/miadi/episodes/miadi-chronicle. Unlike client.ts (which
// proxies the Medicine Wheel), this module reads the disk the episodes live on.
// A diagram that fails to map raises a NAMED error — never an anonymous crash.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  StateMachineDefinitionSchema,
  WorkspaceStateMachineSchema,
  type StateMachineDefinition,
  type WorkspaceStateMachine,
} from '@forgewright/lib/types';

export const DEFAULT_CHRONICLE_ROOT = '/srv/miadi/episodes/miadi-chronicle';
const DIAGRAMS_DIR = 'diagrams';
const SMDF_SUFFIX = '.smdf.json';

// ─── Named errors ────────────────────────────────────────────────────────────

/** The chronicle root itself cannot be read — env misconfigured or disk gone. */
export class ChronicleRootUnavailableError extends Error {
  readonly name = 'ChronicleRootUnavailableError';
}

/** The requested relative path is unsafe or not a diagram path at all. */
export class InvalidDiagramPathError extends Error {
  readonly name = 'InvalidDiagramPathError';
}

/** The path is well-formed but no diagram file lives there. */
export class DiagramNotFoundError extends Error {
  readonly name = 'DiagramNotFoundError';
}

/** The file exists but its content could not map to a WorkspaceStateMachine. */
export class DiagramMappingError extends Error {
  readonly name = 'DiagramMappingError';
}

// ─── Root resolution ─────────────────────────────────────────────────────────

export function resolveChronicleRoot(): string {
  const configured = process.env.MIADI_CHRONICLE_ROOT;
  return configured && configured.length > 0 ? configured : DEFAULT_CHRONICLE_ROOT;
}

// ─── Listing ─────────────────────────────────────────────────────────────────

export interface EpisodeDiagramRef {
  /** Episode folder name, e.g. `2026-06-28-episode-103-film-preprod-report-phase-2`. */
  episode: string;
  /** Diagram name without the `.smdf.json` suffix, e.g. `film-preprod`. */
  name: string;
  /** Path relative to the chronicle root — the `path` param the API accepts. */
  relativePath: string;
}

/**
 * Scan `<root>/<episode>/diagrams/*.smdf.json`. Episodes sort newest-first
 * (date-prefixed folder names), diagram names ascending inside an episode.
 * A missing or unreadable ROOT throws ChronicleRootUnavailableError; an episode
 * without a diagrams/ dir simply contributes nothing.
 */
export async function listEpisodeDiagrams(
  root: string = resolveChronicleRoot(),
): Promise<EpisodeDiagramRef[]> {
  let episodes;
  try {
    episodes = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new ChronicleRootUnavailableError(
      `Chronicle root is not readable: ${root} (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const refs: EpisodeDiagramRef[] = [];

  for (const episode of episodes) {
    if (!episode.isDirectory()) continue;
    const diagramsDir = path.join(root, episode.name, DIAGRAMS_DIR);

    let entries;
    try {
      entries = await fs.readdir(diagramsDir, { withFileTypes: true });
    } catch {
      continue; // episode holds no diagrams — not an error
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(SMDF_SUFFIX)) continue;
      refs.push({
        episode: episode.name,
        name: entry.name.slice(0, -SMDF_SUFFIX.length),
        relativePath: `${episode.name}/${DIAGRAMS_DIR}/${entry.name}`,
      });
    }
  }

  return refs.sort(
    (left, right) =>
      right.episode.localeCompare(left.episode) || left.name.localeCompare(right.name),
  );
}

// ─── Path safety ─────────────────────────────────────────────────────────────

function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.includes('\\') || value.includes('\0')) return false;
  if (value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return false;
  return !value.split('/').some((segment) => segment === '..' || segment === '');
}

function assertDiagramPath(relativePath: string): void {
  if (!isSafeRelativePath(relativePath) || !relativePath.endsWith(SMDF_SUFFIX)) {
    throw new InvalidDiagramPathError(
      `Diagram path must be a safe relative path ending in ${SMDF_SUFFIX}: ${relativePath}`,
    );
  }
}

// ─── SMDF → WorkspaceStateMachine mapping ────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * SMDF-on-disk shapes vary: episode 103 wraps the definition as
 * `{ stateMachine: { settings, events, state } }`; a bare definition and a
 * `{ definition: … }` wrapper are also accepted. Absent settings/events are
 * synthesized so a state-only sketch still maps.
 */
function unwrapDefinitionCandidate(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new DiagramMappingError('SMDF content is not a JSON object');
  }
  if (isRecord(raw.stateMachine)) return raw.stateMachine;
  if (isRecord(raw.definition)) return raw.definition;
  return raw;
}

export function parseSmdfDefinition(raw: unknown): StateMachineDefinition {
  const candidate = unwrapDefinitionCandidate(raw);

  if (!isRecord(candidate.state)) {
    throw new DiagramMappingError('SMDF definition has no `state` object');
  }

  const withDefaults = {
    settings: isRecord(candidate.settings)
      ? candidate.settings
      : { namespace: 'miadi.chronicle', asynchronous: false },
    events: Array.isArray(candidate.events) ? candidate.events : [],
    state: candidate.state,
  };

  const parsed = StateMachineDefinitionSchema.safeParse(withDefaults);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new DiagramMappingError(`SMDF definition failed validation — ${issues}`);
  }

  return parsed.data;
}

/** Initial state = first in the root's states array (SMDF convention). */
export function initialStateOf(definition: StateMachineDefinition): string {
  return definition.state.states?.[0]?.name ?? definition.state.name;
}

export interface DiagramProvenance {
  workspaceId: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Map raw SMDF content into the WorkspaceStateMachine the machine store loads.
 * Synthesized runtime fields: currentState = initial state, tensionLevel = 0.5
 * (the store's own resting default), eventHistory = [] — the machine has not
 * run yet; history is earned, not invented.
 */
export function mapSmdfToWorkspaceStateMachine(
  raw: unknown,
  provenance: DiagramProvenance,
): WorkspaceStateMachine {
  const definition = parseSmdfDefinition(raw);
  const now = new Date().toISOString();

  const machine = WorkspaceStateMachineSchema.safeParse({
    workspaceId: provenance.workspaceId,
    definition,
    currentState: initialStateOf(definition),
    tensionLevel: 0.5,
    eventHistory: [],
    createdAt: provenance.createdAt ?? now,
    updatedAt: provenance.updatedAt ?? now,
  });

  if (!machine.success) {
    throw new DiagramMappingError(
      `Mapped machine failed the WorkspaceStateMachine contract — ${machine.error.issues[0]?.message ?? 'unknown issue'}`,
    );
  }

  return machine.data;
}

// ─── Loading ─────────────────────────────────────────────────────────────────

/**
 * Read one diagram under the chronicle root and serve it mapped. The
 * workspaceId is the relative path without its suffix — stable identity a
 * canvas or hub room can key on.
 */
export async function loadWorkspaceStateMachine(
  relativePath: string,
  root: string = resolveChronicleRoot(),
): Promise<WorkspaceStateMachine> {
  assertDiagramPath(relativePath);

  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(path.resolve(root) + path.sep)) {
    throw new InvalidDiagramPathError(`Diagram path escapes the chronicle root: ${relativePath}`);
  }

  let content: string;
  let mtime: string | undefined;
  let birthtime: string | undefined;
  try {
    const [text, stat] = await Promise.all([
      fs.readFile(absolutePath, 'utf8'),
      fs.stat(absolutePath),
    ]);
    content = text;
    mtime = stat.mtime.toISOString();
    birthtime = stat.birthtime.toISOString();
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new DiagramNotFoundError(`No diagram at ${relativePath} under ${root}`);
    }
    throw new ChronicleRootUnavailableError(
      `Diagram is not readable: ${relativePath} (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new DiagramMappingError(`Diagram is not valid JSON: ${relativePath}`);
  }

  return mapSmdfToWorkspaceStateMachine(raw, {
    workspaceId: relativePath.slice(0, -SMDF_SUFFIX.length),
    createdAt: birthtime,
    updatedAt: mtime,
  });
}
