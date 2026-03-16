/**
 * Stage 1: EAST — Classification (Decompose)
 *
 * Keyword-based directional scoring, intent extraction, hedging detection.
 * Works WITHOUT an LLM. Also exports buildSystemPrompt() for LLM-enhanced mode.
 */

import { randomUUID } from 'node:crypto';
import {
  DIRECTIONS,
  DIRECTION_NAMES,
  type DirectionName,
} from '../types/directions';
import type {
  OntologicalDecomposition,
  OntologicalDirection,
  DirectionalInsight,
  PrimaryIntent,
  PdeActionItem,
  AmbiguityFlag,
  ContextRequirements,
  ExpectedOutputs,
} from '../types/pde';
import type { RelationalIntent } from '../types/pde';

// ─── Keyword dictionaries ────────────────────────────────────────────────────

const DIRECTION_KEYWORDS: Record<DirectionName, string[]> = {
  east: [
    'understand', 'clarify', 'envision', 'require', 'need', 'want',
    'desire', 'define', 'scope', 'identify', 'vision', 'imagine',
    'dream', 'conceive', 'discover', 'question', 'wonder', 'see',
    'what', 'why', 'purpose', 'intention', 'goal', 'outcome',
  ],
  south: [
    'research', 'learn', 'investigate', 'analyze', 'study', 'explore',
    'grow', 'examine', 'compare', 'gather', 'read', 'map',
    'diagram', 'assess', 'survey', 'measure', 'data', 'find',
    'search', 'pattern', 'understand', 'architecture', 'design',
  ],
  west: [
    'test', 'validate', 'reflect', 'review', 'verify', 'check',
    'ensure', 'audit', 'evaluate', 'confirm', 'inspect', 'critique',
    'quality', 'accountability', 'balance', 'ceremony', 'ritual',
    'honor', 'respect', 'consider', 'weigh', 'judge', 'feedback',
  ],
  north: [
    'implement', 'build', 'create', 'execute', 'deploy', 'deliver',
    'write', 'code', 'fix', 'refactor', 'commit', 'ship', 'produce',
    'generate', 'construct', 'forge', 'make', 'install', 'configure',
    'run', 'launch', 'publish', 'release', 'action', 'do',
  ],
};

const ACTION_VERBS = [
  'create', 'build', 'implement', 'write', 'design', 'develop',
  'analyze', 'integrate', 'test', 'fix', 'refactor', 'deploy',
  'configure', 'update', 'add', 'remove', 'delete', 'move',
  'install', 'set up', 'validate', 'review', 'document', 'research',
  'explore', 'investigate', 'ensure', 'generate', 'forge', 'plan',
];

const HEDGING_MARKERS: Array<{ pattern: RegExp; isAmbiguity: boolean }> = [
  { pattern: /\bprobably\b/gi, isAmbiguity: true },
  { pattern: /\bsomehow\b/gi, isAmbiguity: true },
  { pattern: /\bmaybe\b/gi, isAmbiguity: true },
  { pattern: /\bmight\b/gi, isAmbiguity: false },
  { pattern: /\bperhaps\b/gi, isAmbiguity: true },
  { pattern: /\bcould be\b/gi, isAmbiguity: true },
  { pattern: /\bi assume\b/gi, isAmbiguity: false },
  { pattern: /\bwhich i assume\b/gi, isAmbiguity: false },
  { pattern: /\byou will need\b/gi, isAmbiguity: false },
  { pattern: /\bi expect\b/gi, isAmbiguity: false },
  { pattern: /\bshould\b/gi, isAmbiguity: false },
  { pattern: /\bi think\b/gi, isAmbiguity: false },
  { pattern: /\bi guess\b/gi, isAmbiguity: true },
];

const URGENCY_MARKERS: Record<string, 'immediate' | 'session' | 'persistent'> = {
  'now': 'immediate', 'immediately': 'immediate', 'urgent': 'immediate',
  'asap': 'immediate', 'right away': 'immediate', 'critical': 'immediate',
  'today': 'immediate', 'session': 'session', 'eventually': 'persistent',
  'someday': 'persistent', 'long-term': 'persistent', 'ongoing': 'persistent',
  'persistent': 'persistent', 'later': 'persistent',
};

// ─── Decomposition options ───────────────────────────────────────────────────

export interface DecomposeOptions {
  extractImplicit?: boolean;
  mapDependencies?: boolean;
}

// ─── Core decompose function ─────────────────────────────────────────────────

export function decompose(
  prompt: string,
  options: DecomposeOptions = {},
): OntologicalDecomposition {
  const { extractImplicit = true, mapDependencies = true } = options;
  const id = randomUUID();
  const now = new Date().toISOString();
  const lower = prompt.toLowerCase();
  const sentences = splitSentences(prompt);

  // 1. Directional scoring
  const scores = scoreDirections(lower);

  // 2. Extract primary intent
  const primary = extractPrimaryIntent(prompt, lower);

  // 3. Extract secondary intents (one per sentence beyond primary)
  const secondaryRaw = extractSecondaryIntents(sentences, primary.action, extractImplicit);

  // 4. Hedging → implicit intents + ambiguities
  const { implicitIntents, ambiguities } = detectHedging(prompt, extractImplicit);

  // Merge implicit intents into secondary
  const allSecondary = [...secondaryRaw, ...implicitIntents];

  // 5. Assign direction per secondary intent
  const secondary: RelationalIntent[] = allSecondary.map((s, i) => ({
    ...s,
    id: `intent-${i}`,
    direction: classifyDirection(s.action + ' ' + s.target),
    obligations: [],
    wilsonAlignment: 0,
  }));

  // 6. Build direction map with insights
  const directions = buildDirectionMap(sentences, scores, extractImplicit);

  // 7. Build action stack
  const actionStack = buildActionStack(primary, secondary, mapDependencies);

  // 8. Context extraction
  const context = extractContext(prompt);
  const outputs = extractOutputs(prompt);

  // 9. Compute initial balance
  const directionCounts = DIRECTION_NAMES.map(
    d => directions[d].insights.length,
  );
  const totalInsights = directionCounts.reduce((a, b) => a + b, 0) || 1;
  const balance = 1 - standardDeviation(directionCounts.map(c => c / totalInsights));

  const leadDirection = DIRECTION_NAMES[directionCounts.indexOf(Math.max(...directionCounts))];
  const neglectedDirections = DIRECTION_NAMES.filter(
    (_, i) => directionCounts[i] === 0,
  );

  return {
    id,
    timestamp: now,
    prompt,
    primary,
    secondary,
    context,
    outputs,
    directions,
    actionStack,
    ambiguities,
    balance,
    leadDirection,
    neglectedDirections,
    ceremonyGuidance: null,
    ceremonyRequired: balance < 0.3,
    wilsonAlignment: 0,
    narrativeBeats: [],
  };
}

// ─── LLM-enhanced mode: build system prompt ──────────────────────────────────

const JSON_SCHEMA_EXAMPLE = `{
  "primary": {
    "action": "main action verb",
    "target": "what the action applies to",
    "urgency": "immediate|session|persistent",
    "confidence": 0.0-1.0
  },
  "secondary": [
    {
      "action": "action verb",
      "target": "target",
      "implicit": true/false,
      "dependency": "what this depends on or null",
      "confidence": 0.0-1.0
    }
  ],
  "context": {
    "files_needed": ["list of files"],
    "tools_required": ["list of tools"],
    "assumptions": ["list of assumptions found in prompt"]
  },
  "outputs": {
    "artifacts": ["new files to create"],
    "updates": ["existing files to update"],
    "communications": ["PRs, issues, docs to create"]
  },
  "directions": {
    "east": [{"text": "vision items", "confidence": 0.0-1.0, "implicit": false}],
    "south": [{"text": "analysis items", "confidence": 0.0-1.0, "implicit": false}],
    "west": [{"text": "validation items", "confidence": 0.0-1.0, "implicit": false}],
    "north": [{"text": "action items", "confidence": 0.0-1.0, "implicit": false}]
  },
  "actionStack": [
    {"text": "task description", "direction": "east|south|west|north", "dependency": "or null", "completed": false}
  ],
  "ambiguities": [
    {"text": "ambiguous part", "suggestion": "how to clarify"}
  ]
}`;

const DIRECTIONS_LEGEND = `Directions mapping (Medicine Wheel / Four Directions):
- EAST (🌅 Vision): Understanding what is being asked, clarifying requirements, envisioning desired outcomes
- SOUTH (🔥 Analysis): Research, learning, investigation, growth tasks
- WEST (🌊 Validation): Testing, reflection, review, accountability tasks
- NORTH (❄️ Action): Implementation, execution, delivery, wisdom tasks`;

export function buildSystemPrompt(options: DecomposeOptions = {}): string {
  const { extractImplicit = true, mapDependencies = true } = options;

  const implicitRule = extractImplicit
    ? 'Extract implicit intents from phrases like "which I assume", "you will need", "somehow", "I expect", "probably", "should". Mark them with "implicit": true.'
    : 'Only extract explicit intents. Set implicit to false for all.';

  const dependencyRule = mapDependencies
    ? 'Map dependencies between actions - which tasks must complete before others can start. Use the dependency field in secondary intents and actionStack.'
    : 'Do not map dependencies. Set all dependency fields to null.';

  return `You are a Prompt Decomposition Engine (PDE).

CRITICAL: Your response must be ONLY a valid JSON object. Do not include:
- Markdown code fences (no \`\`\`json)
- Explanatory text before or after the JSON
- Any commentary or notes

Just output the raw JSON object starting with { and ending with }.

Analyze the user's prompt and output with this exact structure:

${JSON_SCHEMA_EXAMPLE}

${DIRECTIONS_LEGEND}

${implicitRule}
${dependencyRule}

Rules:
- Assign confidence scores (0.0-1.0) based on how clearly the intent is stated.
- Flag ambiguities where the prompt is vague, uses "somehow", "probably", "maybe", or leaves storage/method unspecified.
- Generate actionStack as an ordered list respecting dependencies, with each item mapped to a direction.
- For secondary intents, distinguish explicit (stated directly) from implicit (inferred from context, hedging language, assumptions).
- The primary intent is the single most important action. Everything else goes in secondary.
- context.assumptions should capture statements the user makes that are assumed true but not verified.

REMEMBER: Output ONLY the JSON object, nothing else.`;
}

export function formatUserMessage(prompt: string): string {
  return `Prompt to decompose:\n"${prompt}"`;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function scoreDirections(lower: string): Record<DirectionName, number> {
  const scores = { east: 0, south: 0, west: 0, north: 0 } as Record<DirectionName, number>;
  for (const dir of DIRECTION_NAMES) {
    for (const kw of DIRECTION_KEYWORDS[dir]) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) scores[dir] += matches.length;
    }
  }
  return scores;
}

function classifyDirection(text: string): DirectionName {
  const lower = text.toLowerCase();
  const scores = scoreDirections(lower);
  let best: DirectionName = 'north';
  let max = 0;
  for (const dir of DIRECTION_NAMES) {
    if (scores[dir] > max) {
      max = scores[dir];
      best = dir;
    }
  }
  return best;
}

function extractPrimaryIntent(prompt: string, lower: string): PrimaryIntent {
  let action = 'process';
  let target = prompt.split(/[.!?\n]/)[0]?.trim() || prompt;

  for (const verb of ACTION_VERBS) {
    const idx = lower.indexOf(verb);
    if (idx !== -1) {
      action = verb;
      const afterVerb = prompt.substring(idx + verb.length).trim();
      const endOfPhrase = afterVerb.search(/[.!?,;\n]/);
      target = endOfPhrase > 0
        ? afterVerb.substring(0, endOfPhrase).trim()
        : afterVerb.substring(0, 80).trim();
      break;
    }
  }

  // Detect urgency
  let urgency: 'immediate' | 'session' | 'persistent' = 'session';
  for (const [marker, urg] of Object.entries(URGENCY_MARKERS)) {
    if (lower.includes(marker)) {
      urgency = urg;
      break;
    }
  }

  return { action, target, urgency, confidence: 0.8 };
}

function extractSecondaryIntents(
  sentences: string[],
  primaryAction: string,
  extractImplicit: boolean,
): Array<{ action: string; target: string; implicit: boolean; dependency: string | null; confidence: number }> {
  const intents: Array<{ action: string; target: string; implicit: boolean; dependency: string | null; confidence: number }> = [];

  for (const sentence of sentences.slice(1)) {
    const lower = sentence.toLowerCase();
    let found = false;

    for (const verb of ACTION_VERBS) {
      const idx = lower.indexOf(verb);
      if (idx !== -1 && verb !== primaryAction) {
        const afterVerb = sentence.substring(idx + verb.length).trim();
        const endOfPhrase = afterVerb.search(/[.!?,;\n]/);
        const target = endOfPhrase > 0
          ? afterVerb.substring(0, endOfPhrase).trim()
          : afterVerb.substring(0, 80).trim();

        intents.push({
          action: verb,
          target,
          implicit: false,
          dependency: null,
          confidence: 0.8,
        });
        found = true;
        break;
      }
    }

    if (!found && sentence.length > 10) {
      intents.push({
        action: 'address',
        target: sentence.substring(0, 80),
        implicit: true,
        dependency: null,
        confidence: 0.5,
      });
    }
  }

  return extractImplicit ? intents : intents.filter(i => !i.implicit);
}

function detectHedging(prompt: string, extractImplicit: boolean): {
  implicitIntents: Array<{ action: string; target: string; implicit: boolean; dependency: string | null; confidence: number }>;
  ambiguities: AmbiguityFlag[];
} {
  const implicitIntents: Array<{ action: string; target: string; implicit: boolean; dependency: string | null; confidence: number }> = [];
  const ambiguities: AmbiguityFlag[] = [];

  if (!extractImplicit) return { implicitIntents, ambiguities };

  for (const { pattern, isAmbiguity } of HEDGING_MARKERS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(prompt)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(prompt.length, match.index + match[0].length + 40);
      const context = prompt.substring(start, end).trim();

      if (isAmbiguity) {
        ambiguities.push({
          text: context,
          suggestion: `Clarify the "${match[0].trim()}" — what is the concrete expectation?`,
        });
      }

      implicitIntents.push({
        action: 'clarify',
        target: context,
        implicit: true,
        dependency: null,
        confidence: 0.4,
      });
    }
  }

  // Deduplicate by context proximity
  const seen = new Set<string>();
  const deduped = implicitIntents.filter(i => {
    const key = i.target.substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { implicitIntents: deduped, ambiguities };
}

function buildDirectionMap(
  sentences: string[],
  scores: Record<DirectionName, number>,
  extractImplicit: boolean,
): Record<DirectionName, OntologicalDirection> {
  const result = {} as Record<DirectionName, OntologicalDirection>;

  for (const dir of DIRECTION_NAMES) {
    const info = DIRECTIONS[dir];
    const insights: DirectionalInsight[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      let matchCount = 0;
      for (const kw of DIRECTION_KEYWORDS[dir]) {
        if (lower.includes(kw)) matchCount++;
      }
      if (matchCount > 0) {
        insights.push({
          text: sentence,
          confidence: Math.min(1, matchCount * 0.25 + 0.5),
          implicit: false,
        });
      }
    }

    // If no insights found for a direction, it's a gap
    result[dir] = {
      name: dir,
      ojibwe: info.ojibwe,
      season: info.season,
      act: info.act,
      insights,
      obligations: [],
      ceremonyRecommended: insights.length === 0,
    };
  }

  return result;
}

function buildActionStack(
  primary: PrimaryIntent,
  secondary: RelationalIntent[],
  mapDependencies: boolean,
): PdeActionItem[] {
  const stack: PdeActionItem[] = [];

  // Primary always first
  stack.push({
    id: 'action-0',
    text: `${primary.action} ${primary.target}`,
    direction: classifyDirection(`${primary.action} ${primary.target}`),
    dependency: null,
    completed: false,
    confidence: primary.confidence,
    implicit: false,
  });

  for (let i = 0; i < secondary.length; i++) {
    const s = secondary[i];
    stack.push({
      id: `action-${i + 1}`,
      text: `${s.action} ${s.target}`,
      direction: s.direction,
      dependency: mapDependencies && i > 0 ? `action-${i}` : null,
      completed: false,
      confidence: s.confidence,
      implicit: s.implicit,
    });
  }

  return stack;
}

function extractContext(prompt: string): ContextRequirements {
  const files: string[] = [];
  const tools: string[] = [];
  const assumptions: string[] = [];

  // File path patterns
  const fileMatches = prompt.match(/(?:[\w./-]+\.\w{1,10})/g);
  if (fileMatches) {
    for (const f of fileMatches) {
      if (f.includes('/') || f.match(/\.(ts|js|md|json|yaml|yml|py|rs|go|toml)$/)) {
        files.push(f);
      }
    }
  }

  // Tool detection
  const toolPatterns = ['git', 'npm', 'node', 'docker', 'kuzu', 'smcraft', 'mcp', 'zod'];
  const lower = prompt.toLowerCase();
  for (const tool of toolPatterns) {
    if (lower.includes(tool)) tools.push(tool);
  }

  // Assumption detection (phrases starting with "I assume", "assuming", etc.)
  const assumptionRegex = /(?:i assume|assuming|i expect|i think|presume)\s+(.{10,80})/gi;
  let match: RegExpExecArray | null;
  while ((match = assumptionRegex.exec(prompt)) !== null) {
    assumptions.push(match[1].trim().replace(/[.!?]+$/, ''));
  }

  return { files_needed: files, tools_required: tools, assumptions };
}

function extractOutputs(prompt: string): ExpectedOutputs {
  const artifacts: string[] = [];
  const updates: string[] = [];
  const communications: string[] = [];

  const lower = prompt.toLowerCase();

  // Create/new file patterns
  const createMatch = prompt.match(/(?:create|generate|produce|write)\s+(.{5,60})/gi);
  if (createMatch) {
    for (const m of createMatch) artifacts.push(m.trim());
  }

  // Update patterns
  const updateMatch = prompt.match(/(?:update|modify|edit|change)\s+(.{5,60})/gi);
  if (updateMatch) {
    for (const m of updateMatch) updates.push(m.trim());
  }

  // Communication patterns
  if (lower.includes('pr') || lower.includes('pull request')) communications.push('Pull Request');
  if (lower.includes('issue')) communications.push('Issue');
  if (lower.includes('document')) communications.push('Documentation');

  return { artifacts, updates, communications };
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map(v => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}
