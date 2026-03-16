// ─── Beat Storage ────────────────────────────────────────────────────────────
// JSONL persistence in .coaia/ directory for narrative beats and arcs.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NarrativeBeat, NarrativeArc } from '../types/narrative';
import { NarrativeBeatSchema } from '../types/narrative';

// ─── Paths ───────────────────────────────────────────────────────────────────

const COAIA_DIR = '.coaia';
const BEATS_DIR = 'beats';
const ARCS_DIR = 'arcs';

function beatsDir(basePath?: string): string {
  return path.join(basePath ?? process.cwd(), COAIA_DIR, BEATS_DIR);
}

function arcsDir(basePath?: string): string {
  return path.join(basePath ?? process.cwd(), COAIA_DIR, ARCS_DIR);
}

function beatsFilePath(sessionId: string, basePath?: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(beatsDir(basePath), `${safe}.jsonl`);
}

function arcFilePath(sessionId: string, format: 'json' | 'md', basePath?: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = arcsDir(basePath);
  return path.join(dir, `${safe}.${format}`);
}

// ─── Ensure Directories ──────────────────────────────────────────────────────

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

// ─── Store a Beat (append to JSONL) ──────────────────────────────────────────

export async function storeBeat(
  beat: NarrativeBeat,
  sessionId: string,
  basePath?: string,
): Promise<string> {
  const dir = beatsDir(basePath);
  await ensureDir(dir);

  const filePath = beatsFilePath(sessionId, basePath);
  const line = JSON.stringify(beat) + '\n';
  await fs.appendFile(filePath, line, 'utf-8');

  return filePath;
}

// ─── Store Multiple Beats ────────────────────────────────────────────────────

export async function storeBeats(
  beats: NarrativeBeat[],
  sessionId: string,
  basePath?: string,
): Promise<string> {
  const dir = beatsDir(basePath);
  await ensureDir(dir);

  const filePath = beatsFilePath(sessionId, basePath);
  const lines = beats.map(b => JSON.stringify(b)).join('\n') + '\n';
  await fs.appendFile(filePath, lines, 'utf-8');

  return filePath;
}

// ─── Load Beats for a Session ────────────────────────────────────────────────

export async function loadBeats(
  sessionId: string,
  basePath?: string,
): Promise<NarrativeBeat[]> {
  const filePath = beatsFilePath(sessionId, basePath);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const beats: NarrativeBeat[] = [];
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const validated = NarrativeBeatSchema.parse(parsed);
      beats.push(validated);
    } catch {
      // Skip malformed lines — defensive for append-only JSONL
      continue;
    }
  }

  return beats;
}

// ─── Export Arc ───────────────────────────────────────────────────────────────

export async function exportArc(
  arc: NarrativeArc,
  sessionId: string,
  format: 'json' | 'md',
  markdownContent?: string,
  basePath?: string,
): Promise<string> {
  const dir = arcsDir(basePath);
  await ensureDir(dir);

  const filePath = arcFilePath(sessionId, format, basePath);

  if (format === 'json') {
    await fs.writeFile(filePath, JSON.stringify(arc, null, 2), 'utf-8');
  } else {
    // For markdown, use provided content or generate a basic summary
    const content = markdownContent ?? generateBasicMarkdown(arc, sessionId);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  return filePath;
}

// ─── Basic Markdown Fallback ─────────────────────────────────────────────────

function generateBasicMarkdown(arc: NarrativeArc, sessionId: string): string {
  const lines: string[] = [];
  lines.push(`# Arc: ${sessionId}`);
  lines.push(`**Beats**: ${arc.beats.length}`);
  lines.push(`**Complete**: ${arc.isComplete ? 'Yes' : 'No'}`);
  lines.push(`**Directions visited**: ${arc.directionsVisited.join(', ')}`);

  if (arc.wilsonAlignment != null) {
    lines.push(`**Wilson alignment**: ${(arc.wilsonAlignment * 100).toFixed(1)}%`);
  }

  lines.push('');
  for (const beat of arc.beats) {
    lines.push(`## ${beat.title ?? beat.id}`);
    lines.push(beat.prose ?? beat.content);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── List Sessions with Stored Beats ─────────────────────────────────────────

export async function listSessions(basePath?: string): Promise<string[]> {
  const dir = beatsDir(basePath);

  try {
    const files = await fs.readdir(dir);
    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''));
  } catch {
    return [];
  }
}
