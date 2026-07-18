/**
 * .pde/ persistence — store, load, list decompositions
 *
 * Stores: {id}.json + {id}.md + {id}.seed.smdf.json
 * Markdown follows canonical section ordering: Four Directions FIRST.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DIRECTIONS, DIRECTION_NAMES } from '../types/directions';
import type { OntologicalDecomposition, StructuredPlan } from '../types/pde';

// ─── Store ───────────────────────────────────────────────────────────────────

export async function store(
  id: string,
  plan: StructuredPlan,
  workdir: string = process.cwd(),
): Promise<{ jsonPath: string; mdPath: string; smdfPath: string }> {
  const pdeDir = join(workdir, '.pde');
  await mkdir(pdeDir, { recursive: true });

  const jsonPath = join(pdeDir, `${id}.json`);
  const mdPath = join(pdeDir, `${id}.md`);
  const smdfPath = join(pdeDir, `${id}.seed.smdf.json`);

  // Write full decomposition JSON
  await writeFile(jsonPath, JSON.stringify(plan.decomposition, null, 2), 'utf-8');

  // Write canonical markdown
  const md = renderMarkdown(plan.decomposition);
  await writeFile(mdPath, md, 'utf-8');

  // Write SMDF seed
  if (plan.smdfSeed) {
    await writeFile(smdfPath, JSON.stringify(plan.smdfSeed, null, 2), 'utf-8');
  }

  return { jsonPath, mdPath, smdfPath };
}

// ─── Load ────────────────────────────────────────────────────────────────────

export async function load(
  id: string,
  workdir: string = process.cwd(),
): Promise<OntologicalDecomposition> {
  const jsonPath = join(workdir, '.pde', `${id}.json`);
  const raw = await readFile(jsonPath, 'utf-8');
  return JSON.parse(raw) as OntologicalDecomposition;
}

// ─── List ────────────────────────────────────────────────────────────────────

export async function list(
  workdir: string = process.cwd(),
): Promise<Array<{ id: string; timestamp: string; primary: string }>> {
  const pdeDir = join(workdir, '.pde');
  let files: string[];
  try {
    files = await readdir(pdeDir);
  } catch {
    return [];
  }

  const results: Array<{ id: string; timestamp: string; primary: string }> = [];

  for (const file of files) {
    if (!file.endsWith('.json') || file.endsWith('.seed.smdf.json')) continue;
    const id = file.replace('.json', '');
    try {
      const decomp = await load(id, workdir);
      results.push({
        id,
        timestamp: decomp.timestamp,
        primary: `${decomp.primary.action} ${decomp.primary.target}`,
      });
    } catch {
      // Skip malformed files
    }
  }

  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Markdown Renderer (canonical section ordering) ──────────────────────────

export function renderMarkdown(decomp: OntologicalDecomposition): string {
  const lines: string[] = [];

  // ── Header ──
  lines.push('# Prompt Decomposition');
  lines.push('');

  // ── Four Directions FIRST (canonical requirement) ──
  lines.push('## Four Directions');
  lines.push('');

  for (const dir of DIRECTION_NAMES) {
    const info = DIRECTIONS[dir];
    const dirData = decomp.directions[dir];
    const label = dir === 'east' ? 'Vision'
      : dir === 'south' ? 'Analysis'
      : dir === 'west' ? 'Validation'
      : 'Action';

    // Ojibwe name in the heading is canonical (Four-Directions-with-Ojibwe-names
    // principle) — it must render whether or not obligations follow.
    lines.push(`### ${info.emoji} ${info.name.toUpperCase()} (${info.ojibwe}) — ${label}`);
    lines.push('');

    if (dirData.insights.length === 0) {
      lines.push(`*No explicit intents in the ${info.name} direction — hold this absence as meaningful.*`);
      lines.push('');
    } else {
      for (const insight of dirData.insights) {
        const implicit = insight.implicit ? ' *(implicit)*' : '';
        lines.push(`- ${insight.text} (confidence: ${insight.confidence.toFixed(2)})${implicit}`);
      }
      lines.push('');
    }

    if (dirData.obligations.length > 0) {
      lines.push(`**Obligations (${info.ojibwe}):**`);
      for (const ob of dirData.obligations) {
        for (const o of ob.obligations) {
          lines.push(`  - [${ob.category}] ${o}`);
        }
      }
      lines.push('');
    }

    if (dirData.ceremonyRecommended) {
      lines.push(`> 🕯️ Ceremony recommended for ${info.name} direction`);
      lines.push('');
    }
  }

  // ── Original Prompt ──
  lines.push('## Original Prompt');
  lines.push('');
  lines.push(`> ${decomp.prompt.replace(/\n/g, '\n> ')}`);
  lines.push('');

  // ── Primary Intent ──
  lines.push('## Primary Intent');
  lines.push('');
  lines.push(`- **Action:** ${decomp.primary.action}`);
  lines.push(`- **Target:** ${decomp.primary.target}`);
  lines.push(`- **Urgency:** ${decomp.primary.urgency}`);
  lines.push(`- **Confidence:** ${decomp.primary.confidence.toFixed(2)}`);
  lines.push('');

  // ── Secondary Intents ──
  lines.push('## Secondary Intents');
  lines.push('');
  if (decomp.secondary.length === 0) {
    lines.push('*None identified.*');
    lines.push('');
  } else {
    for (let i = 0; i < decomp.secondary.length; i++) {
      const s = decomp.secondary[i];
      const tag = s.implicit ? '*(implicit)*' : '*(explicit)*';
      const dep = s.dependency ? ` → depends on: ${s.dependency}` : '';
      lines.push(`${i + 1}. **${s.action}** ${s.target} ${tag} [${s.direction}] (${s.confidence.toFixed(2)})${dep}`);
    }
    lines.push('');
  }

  // ── Context Requirements ──
  lines.push('## Context Requirements');
  lines.push('');
  if (decomp.context.files_needed.length > 0) {
    lines.push('**Files needed:**');
    for (const f of decomp.context.files_needed) lines.push(`- \`${f}\``);
    lines.push('');
  }
  if (decomp.context.tools_required.length > 0) {
    lines.push('**Tools required:**');
    for (const t of decomp.context.tools_required) lines.push(`- ${t}`);
    lines.push('');
  }
  if (decomp.context.assumptions.length > 0) {
    lines.push('**Assumptions:**');
    for (const a of decomp.context.assumptions) lines.push(`- ${a}`);
    lines.push('');
  }
  if (
    decomp.context.files_needed.length === 0 &&
    decomp.context.tools_required.length === 0 &&
    decomp.context.assumptions.length === 0
  ) {
    lines.push('*No specific context requirements identified.*');
    lines.push('');
  }

  // ── Expected Outputs ──
  lines.push('## Expected Outputs');
  lines.push('');
  if (decomp.outputs.artifacts.length > 0) {
    lines.push('**Artifacts:**');
    for (const a of decomp.outputs.artifacts) lines.push(`- ${a}`);
    lines.push('');
  }
  if (decomp.outputs.updates.length > 0) {
    lines.push('**Updates:**');
    for (const u of decomp.outputs.updates) lines.push(`- ${u}`);
    lines.push('');
  }
  if (decomp.outputs.communications.length > 0) {
    lines.push('**Communications:**');
    for (const c of decomp.outputs.communications) lines.push(`- ${c}`);
    lines.push('');
  }
  if (
    decomp.outputs.artifacts.length === 0 &&
    decomp.outputs.updates.length === 0 &&
    decomp.outputs.communications.length === 0
  ) {
    lines.push('*No specific outputs identified.*');
    lines.push('');
  }

  // ── Action Stack ──
  lines.push('## Action Stack');
  lines.push('');
  if (decomp.actionStack.length === 0) {
    lines.push('*Empty action stack.*');
    lines.push('');
  } else {
    for (const action of decomp.actionStack) {
      const checkbox = action.completed ? '[x]' : '[ ]';
      const dirInfo = DIRECTIONS[action.direction];
      const dep = action.dependency ? ` (depends on: ${action.dependency})` : '';
      const implicit = action.implicit ? ' *(implicit)*' : '';
      lines.push(`- ${checkbox} ${dirInfo.emoji} **[${dirInfo.name}]** ${action.text}${dep}${implicit}`);
    }
    lines.push('');
  }

  // ── Ambiguity Flags ──
  lines.push('## Ambiguity Flags');
  lines.push('');
  if (decomp.ambiguities.length === 0) {
    lines.push('*No ambiguities detected.*');
    lines.push('');
  } else {
    for (const a of decomp.ambiguities) {
      lines.push(`- **${a.text}**`);
      lines.push(`  ${a.suggestion}`);
    }
    lines.push('');
  }

  // ── Metadata footer ──
  lines.push('---');
  lines.push('');
  lines.push(`**ID:** ${decomp.id}`);
  lines.push(`**Timestamp:** ${decomp.timestamp}`);
  lines.push(`**Balance:** ${(decomp.balance * 100).toFixed(0)}%`);
  lines.push(`**Lead Direction:** ${DIRECTIONS[decomp.leadDirection].emoji} ${decomp.leadDirection}`);
  lines.push(`**Wilson Alignment:** ${(decomp.wilsonAlignment * 100).toFixed(0)}%`);
  lines.push(`**Ceremony Required:** ${decomp.ceremonyRequired ? 'Yes' : 'No'}`);
  if (decomp.neglectedDirections.length > 0) {
    lines.push(`**Neglected Directions:** ${decomp.neglectedDirections.map(d => DIRECTIONS[d].emoji + ' ' + d).join(', ')}`);
  }
  lines.push('');

  return lines.join('\n');
}
