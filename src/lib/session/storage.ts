/**
 * Session persistence — file-based storage in ~/.forgewright/sessions/.
 *
 * Each session is stored as a JSON file keyed by session ID.
 * Uses atomic write (write to tmp → rename) to prevent corruption.
 */

import { mkdir, readFile, writeFile, readdir, unlink, rename } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { ForgewrightSessionSchema, type ForgewrightSession } from '../types/session.js';

// ─── Storage Path ────────────────────────────────────────────────────────────

function resolveStorageDir(base?: string): string {
  const dir = base ?? join(homedir(), '.forgewright', 'sessions');
  return resolve(dir);
}

function sessionPath(dir: string, id: string): string {
  return join(dir, `${id}.json`);
}

// ─── Ensure Directory ────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

// ─── Save ────────────────────────────────────────────────────────────────────

/**
 * Persist a session to disk. Uses atomic write to prevent corruption.
 */
export async function save(
  session: ForgewrightSession,
  storageDir?: string,
): Promise<void> {
  const dir = resolveStorageDir(storageDir);
  await ensureDir(dir);

  const filePath = sessionPath(dir, session.id);
  const tmpPath = join(dir, `.tmp-${randomUUID()}.json`);
  const data = JSON.stringify(session, null, 2);

  await writeFile(tmpPath, data, 'utf-8');
  await rename(tmpPath, filePath);
}

// ─── Load ────────────────────────────────────────────────────────────────────

/**
 * Load a session by ID. Validates against the Zod schema.
 * Throws if session file does not exist or fails validation.
 */
export async function load(
  id: string,
  storageDir?: string,
): Promise<ForgewrightSession> {
  const dir = resolveStorageDir(storageDir);
  const filePath = sessionPath(dir, id);

  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const validated = ForgewrightSessionSchema.parse(parsed);

  return validated;
}

// ─── List ────────────────────────────────────────────────────────────────────

/**
 * List all stored session IDs (without loading full session data).
 */
export async function list(
  storageDir?: string,
): Promise<string[]> {
  const dir = resolveStorageDir(storageDir);

  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith('.json') && !f.startsWith('.tmp-'))
      .map((f) => f.replace('.json', ''));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Remove a session file from storage.
 */
export async function remove(
  id: string,
  storageDir?: string,
): Promise<void> {
  const dir = resolveStorageDir(storageDir);
  const filePath = sessionPath(dir, id);

  await unlink(filePath);
}
