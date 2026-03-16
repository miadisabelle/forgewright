# 🔥 SOUTH Direction — PDE & STC Deep Search Findings

> **Generated for:** Forgewright Platform Build
> **Sources:** `iaip-mcp-pde` v2.0.1, `coaia-pde` v0.1.1
> **Paths:** `/workspace/repos/jgwill/src/mcp-pde/`, `/workspace/repos/jgwill/src/coaia-pde/`

---

## Table of Contents

1. [mcp-pde: Package Identity](#1-mcp-pde-package-identity)
2. [Complete Type Definitions](#2-complete-type-definitions)
3. [MCP Tool Definitions](#3-mcp-tool-definitions)
4. [The Decomposition Algorithm](#4-the-decomposition-algorithm)
5. [The System Prompt Template (prompts.ts)](#5-the-system-prompt-template-promptsts)
6. [Parser Algorithm (parser.ts)](#6-parser-algorithm-parserts)
7. [Storage Format (.pde/)](#7-storage-format-pde)
8. [Markdown Export Template](#8-markdown-export-template)
9. [coaia-pde: Package Identity](#9-coaia-pde-package-identity)
10. [coaia-pde Type Definitions](#10-coaia-pde-type-definitions)
11. [STC Mapping Algorithm](#11-stc-mapping-algorithm)
12. [The 6 Relation Types](#12-the-6-relation-types)
13. [coaia-pde MCP Tools](#13-coaia-pde-mcp-tools)
14. [Session Manager & JSONL Format](#14-session-manager--jsonl-format)
15. [LLM Guidance Constant](#15-llm-guidance-constant)
16. [Architecture Summary: Data Flow](#16-architecture-summary-data-flow)

---

## 1. mcp-pde: Package Identity

```json
{
  "name": "iaip-mcp-pde",
  "version": "2.0.1",
  "description": "Prompt Decomposition Engine as MCP Server - LLM-driven decomposition into structured JSON with Four Directions mapping, ambiguity detection, and .pde/ storage",
  "bin": { "mcp-pde": "./dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "uuid": "^9.0.0",
    "zod": "^3.22.0"
  }
}
```

**Key design fact:** The LLM call itself is NOT embedded in the engine. The MCP tool builds a system prompt + user message, the calling agent sends them to their own LLM, then feeds the response back for parsing. This is a 3-step protocol.

---

## 2. Complete Type Definitions

### DecompositionResult (canonical schema)

```typescript
// Source: mcp-pde/src/types.ts — lines 25-83

export interface DecompositionOptions {
  extractImplicit: boolean;  // Extract implicit intents from hedging language
  mapDependencies: boolean;  // Map dependencies between actions
}

export const DEFAULT_OPTIONS: DecompositionOptions = {
  extractImplicit: true,
  mapDependencies: true,
};

export interface DecompositionResult {
  primary: PrimaryIntent;
  secondary: SecondaryIntent[];
  context: ContextRequirements;
  outputs: ExpectedOutputs;
  directions: DirectionMap;
  actionStack: ActionItem[];
  ambiguities: AmbiguityFlag[];
}

export interface PrimaryIntent {
  action: string;       // Main action verb
  target: string;       // What the action applies to
  urgency: Urgency;     // "immediate" | "session" | "persistent"
  confidence: number;   // 0.0 - 1.0
}

export type Urgency = "immediate" | "session" | "persistent";

export interface SecondaryIntent {
  action: string;
  target: string;
  implicit: boolean;         // true = inferred from hedging language
  dependency: string | null; // what this depends on
  confidence: number;
}

export interface ContextRequirements {
  files_needed: string[];
  tools_required: string[];
  assumptions: string[];     // Statements user assumes true but are unverified
}

export interface ExpectedOutputs {
  artifacts: string[];       // New files to create
  updates: string[];         // Existing files to update
  communications: string[];  // PRs, issues, docs to create
}

export type Direction = "east" | "south" | "west" | "north";

export interface DirectionItem {
  text: string;
  confidence: number;  // 0.0 - 1.0
  implicit: boolean;
}

export type DirectionMap = Record<Direction, DirectionItem[]>;

export interface ActionItem {
  text: string;
  direction: Direction;
  dependency: string | null;
  completed?: boolean;
}

export interface AmbiguityFlag {
  text: string;        // The ambiguous part
  suggestion: string;  // How to clarify
}
```

### Direction Metadata

```typescript
export interface DirectionMeta {
  name: string;
  desc: string;
  emoji: string;
  color: string;
}

export const DIRECTION_META: Record<Direction, DirectionMeta> = {
  east:  { name: "VISION",     desc: "What is being asked?",       emoji: "🌅", color: "#f59e0b" },
  south: { name: "ANALYSIS",   desc: "What needs to be learned?",  emoji: "🔥", color: "#ef4444" },
  west:  { name: "VALIDATION", desc: "What needs reflection?",     emoji: "🌊", color: "#3b82f6" },
  north: { name: "ACTION",     desc: "What executes the cycle?",   emoji: "❄️", color: "#10b981" },
};

export const DIRECTIONS: Direction[] = ["east", "south", "west", "north"];
```

### Storage Types

```typescript
export interface StoredDecomposition {
  id: string;               // UUID v4
  timestamp: string;        // ISO 8601
  prompt: string;           // Original user prompt
  result: DecompositionResult;
  options: DecompositionOptions;
  markdownPath?: string;    // Path to exported .md file
}
```

### MCP Tool Input Types

```typescript
export interface DecomposeInput {
  prompt: string;
  options?: Partial<DecompositionOptions>;
  workdir?: string;
}

export interface GetDecompositionInput {
  id: string;
  workdir?: string;
}

export interface ListDecompositionsInput {
  workdir?: string;
  limit?: number;
}

export interface ExportMarkdownInput {
  id: string;
  workdir?: string;
}
```

---

## 3. MCP Tool Definitions

### Tool: `pde_decompose`

**Purpose:** Build system prompt + user message for LLM-driven decomposition.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✅ | The complex prompt to decompose |
| `options.extractImplicit` | boolean | ❌ (default: true) | Extract implicit intents from hedging language |
| `options.mapDependencies` | boolean | ❌ (default: true) | Map dependencies between actions |

**Returns:** `{ instructions, systemPrompt, userMessage, original_prompt }`

### Tool: `pde_parse_response`

**Purpose:** Parse LLM response into `DecompositionResult` JSON and auto-store in `.pde/`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `llm_response` | string | ✅ | Raw LLM response text containing the JSON |
| `original_prompt` | string | ✅ | The original user prompt that was decomposed |
| `workdir` | string | ❌ | Working directory for .pde/ storage (default: cwd) |
| `options.extractImplicit` | boolean | ❌ | |
| `options.mapDependencies` | boolean | ❌ | |

**Returns:** Full `StoredDecomposition` JSON (id, timestamp, prompt, result, options)

### Tool: `pde_get`

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | string | ✅ |
| `workdir` | string | ❌ |

**Returns:** `StoredDecomposition` or error

### Tool: `pde_list`

| Parameter | Type | Required |
|-----------|------|----------|
| `workdir` | string | ❌ |
| `limit` | number | ❌ (default: 10) |

**Returns:** Array of `{ id, timestamp, primaryAction, secondaryCount, ambiguityCount, actionStackCount }`

### Tool: `pde_export_markdown`

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | string | ✅ |
| `workdir` | string | ❌ |

**Returns:** Full markdown string with Four Directions headers

### MCP Resources

| URI | Description |
|-----|-------------|
| `pde://schema/decomposition-result` | The canonical JSON schema |
| `pde://directions` | Four Directions metadata |

### MCP Prompts

| Name | Description |
|------|-------------|
| `pde-decompose` | System prompt for LLM-driven decomposition (args: userPrompt, extractImplicit, mapDependencies) |

---

## 4. The Decomposition Algorithm

The PDE engine is **LLM-delegated** — it does NOT parse prompts itself. The algorithm is:

```
1. Agent calls pde_decompose(prompt)
   └─> PdeEngine.buildPrompt(prompt, options)
       └─> buildSystemPrompt(options)  // Constructs instruction prompt
       └─> formatUserMessage(prompt)   // Wraps as: 'Prompt to decompose:\n"<prompt>"'
   └─> Returns { systemPrompt, userMessage }

2. Agent sends systemPrompt + userMessage to their LLM provider
   └─> LLM produces raw JSON text (DecompositionResult)

3. Agent calls pde_parse_response(llm_response, original_prompt)
   └─> PdeEngine.parseAndStore(llmResponse, originalPrompt, options, workdir)
       └─> parseDecompositionResponse(llmResponse)
           └─> extractJsonString(responseText)  // Try: code block → raw JSON → first/last brace
           └─> JSON.parse(jsonString)
           └─> normalizeResult(parsed)          // Enforce schema, defaults
       └─> uuid.v4() → id
       └─> saveDecomposition(workdir, id, prompt, result, options)
           └─> Write .pde/<id>.json
           └─> Write .pde/<id>.md
   └─> Returns StoredDecomposition
```

**Key insight:** The decomposition quality is entirely determined by the system prompt in `prompts.ts`. The engine itself is a thin orchestrator: prompt builder → parser → storage.

---

## 5. The System Prompt Template (prompts.ts)

This is the **critical** component Forgewright must replicate. Exact source:

```typescript
// Source: mcp-pde/src/prompts.ts — complete file

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

export function buildSystemPrompt(options: DecompositionOptions): string {
  const implicitRule = options.extractImplicit
    ? 'Extract implicit intents from phrases like "which I assume", "you will need", "somehow", "I expect", "probably", "should". Mark them with "implicit": true.'
    : "Only extract explicit intents. Set implicit to false for all.";

  const dependencyRule = options.mapDependencies
    ? "Map dependencies between actions - which tasks must complete before others can start. Use the dependency field in secondary intents and actionStack."
    : "Do not map dependencies. Set all dependency fields to null.";

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
```

### Hedging Language Detection

The system prompt instructs the LLM to detect these hedging markers:
- `"which I assume"` → implicit intent
- `"you will need"` → implicit intent
- `"somehow"` → ambiguity flag + implicit intent
- `"I expect"` → implicit intent
- `"probably"` → ambiguity flag + implicit intent
- `"should"` → implicit intent
- `"maybe"` → ambiguity flag

### Direction Assignment Logic

Assigned by the LLM based on the Directions Legend:
- **EAST 🌅 (Vision):** Requirements clarity, desired outcomes, "what is being asked"
- **SOUTH 🔥 (Analysis):** Research, learning, investigation, growth
- **WEST 🌊 (Validation):** Testing, reflection, review, accountability
- **NORTH ❄️ (Action):** Implementation, execution, delivery

---

## 6. Parser Algorithm (parser.ts)

### JSON Extraction Strategy (3-tier fallback)

```typescript
function extractJsonString(responseText: string): string {
  // Tier 1: Extract from markdown code block
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Tier 2: Raw JSON (starts with {)
  const trimmed = responseText.trim();
  if (trimmed.startsWith("{")) return trimmed;

  // Tier 3: Find first { to last }
  const firstBrace = responseText.indexOf("{");
  const lastBrace = responseText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return responseText.substring(firstBrace, lastBrace + 1);
  }

  throw new PDEParseError("No JSON found in LLM response", responseText);
}
```

### Normalization (normalizeResult)

```typescript
function normalizeResult(raw: Record<string, unknown>): DecompositionResult {
  // Validates primary.action and primary.target exist
  // Defaults: confidence → 0.8, urgency → "session"
  // All array fields: ensureArray() — returns [] if missing
  // Applies to: secondary, files_needed, tools_required, assumptions,
  //   artifacts, updates, communications, east/south/west/north, actionStack, ambiguities
}
```

### PDEParseError

```typescript
export class PDEParseError extends Error {
  constructor(
    message: string,
    public rawResponse: string,     // The full LLM response
    public parseAttempt?: string     // The extracted JSON string that failed parsing
  ) {
    super(message);
    this.name = "PDEParseError";
  }
}
```

---

## 7. Storage Format (.pde/)

### Directory Structure

```
.pde/
├── <uuid>.json    # StoredDecomposition (full structured data)
└── <uuid>.md      # Markdown export (human-editable, git-diffable)
```

### JSON Schema (.pde/<id>.json)

```json
{
  "id": "1c3043fe-70f7-4523-9180-6b6936e75f9d",
  "timestamp": "2025-01-15T14:30:00.000Z",
  "prompt": "Original user prompt text...",
  "result": {
    "primary": { "action": "...", "target": "...", "urgency": "session", "confidence": 0.95 },
    "secondary": [...],
    "context": { "files_needed": [...], "tools_required": [...], "assumptions": [...] },
    "outputs": { "artifacts": [...], "updates": [...], "communications": [...] },
    "directions": { "east": [...], "south": [...], "west": [...], "north": [...] },
    "actionStack": [...],
    "ambiguities": [...]
  },
  "options": { "extractImplicit": true, "mapDependencies": true }
}
```

---

## 8. Markdown Export Template

The markdown template follows IAIP canonical order: **Four Directions FIRST** (relational knowing before intent extraction).

Section order:
1. `# Prompt Decomposition`
2. `## Four Directions` — each direction as `### 🌅 EAST — Vision` etc.
3. `## Original Prompt` — blockquoted
4. `## Primary Intent` — action, target, urgency, confidence
5. `## Secondary Intents` — numbered list with implicit/explicit tags
6. `## Context Requirements` — files needed, tools, assumptions
7. `## Expected Outputs` — artifacts, updates, communications
8. `## Action Stack` — checkbox list with dependency annotations
9. `## Ambiguity Flags` — bold text + suggestion

Action stack format:
```markdown
- [ ] task description (depends on: dependency)
- [x] completed task
```

---

## 9. coaia-pde: Package Identity

```json
{
  "name": "coaia-pde",
  "version": "0.1.1",
  "description": "Prompt Decomposition Engine with Structural Tension Charts",
  "type": "module",
  "bin": { "coaia-pde": "./dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.2",
    "minimist": "^1.2.8",
    "uuid": "^11.1.0"
  }
}
```

**Key design fact:** coaia-pde **consumes** mcp-pde's `DecompositionResult` and transforms it into coaia-narrative Entity/Relation JSONL. It does NOT duplicate the decomposition — it maps the PDE output into Structural Tension Chart ontology.

---

## 10. coaia-pde Type Definitions

### Input Types (copied from mcp-pde)

Identical to mcp-pde `DecompositionResult` — see Section 2. Copied to avoid npm dependency.

### Output Types (aligned with coaia-narrative)

```typescript
// Source: coaia-pde/src/types.ts — lines 96-135

export interface Entity {
  name: string;          // e.g. "chart_abc123_desired_outcome"
  entityType: string;    // "structural_tension_chart" | "desired_outcome" | "current_reality" | "action_step"
  observations: string[];
  metadata?: EntityMetadata;
}

export interface EntityMetadata {
  dueDate?: string;
  chartId?: string;
  phase?: 'germination' | 'assimilation' | 'completion';
  completionStatus?: boolean;
  parentChart?: string;
  parentActionStep?: string;
  level?: number;           // 0 = chart, 1 = action steps
  createdAt?: string;
  updatedAt?: string;
  direction?: string;       // Medicine Wheel direction
  confidence?: number;
  implicit?: boolean;
  pdeId?: string;           // Link back to PDE decomposition
  fourDirections?: {
    north_vision: string | null;
    east_intention: string | null;
    south_emotion: string | null;
    west_introspection: string | null;
  };
}

export interface Relation {
  from: string;             // Entity name
  to: string;               // Entity name
  relationType: string;     // One of the 6 relation types
  metadata?: {
    createdAt?: string;
    strength?: number;
    context?: string;
    description?: string;
  };
}
```

### Session Types

```typescript
export interface PdeSession {
  type: 'pde_session';
  sessionId: string;
  originalPrompt: string;
  masterChartId: string;
  pdeDecompositionId?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'abandoned';
  metadata?: {
    direction?: string;
    ceremony?: string;
  };
}
```

### Constants

```typescript
export const URGENCY_DAYS: Record<string, number> = {
  immediate: 1,
  session: 7,
  persistent: 30
};
```

---

## 11. STC Mapping Algorithm

**Source:** `coaia-pde/src/stc-mapper.ts` — `StcMapper.mapDecompositionToChart()`

### Entity Types Produced

| Entity Type | Source | Name Pattern | Observations |
|-------------|--------|-------------|--------------|
| `structural_tension_chart` | PDE primary intent | `{chartId}_chart` | `"Master chart for: {action} {target}"` |
| `desired_outcome` | PDE primary + outputs | `{chartId}_desired_outcome` | Formatted result phrase + artifacts/updates/comms |
| `current_reality` | PDE context + ambiguities | `{chartId}_current_reality` | Files, tools, assumptions, ambiguity warnings |
| `action_step` | PDE secondary[] + actionStack[] | `{chartId}_action_{N}` | Action description text |

### Complete Mapping Flow

```
DecompositionResult
├── primary.action + primary.target → desired_outcome observations[0]
│   └── Uses verb→phrase map: create→"Completed {target}", build→"Functional {target}",
│       implement→"Working {target}", write→"Finished {target}", design→"Complete design for {target}",
│       develop→"Deployed {target}", analyze→"Clear understanding of {target}",
│       integrate→"Fully integrated {target}", test→"Validated {target}",
│       fix→"Resolved {target}", refactor→"Refactored {target}"
│       fallback→"Completed: {action} {target}"
│
├── primary.urgency → chart dueDate (immediate=1d, session=7d, persistent=30d)
│
├── outputs.artifacts → desired_outcome observations (prefixed "Artifact: ")
├── outputs.updates → desired_outcome observations (prefixed "Update: ")
├── outputs.communications → desired_outcome observations (prefixed "Communication: ")
│
├── context.files_needed → current_reality observations ("Files to reference: ...")
├── context.tools_required → current_reality observations ("Tools available: ...")
├── context.assumptions → current_reality observations ("Assumption: ...")
├── ambiguities → current_reality observations ("⚠️ Ambiguity: {text} — Suggestion: {suggestion}")
│   └── Fallback if empty: "Starting point: No prior work on this goal"
│
├── directions → chart.metadata.fourDirections
│   └── Maps: north→north_vision, east→east_intention, south→south_emotion, west→west_introspection
│   └── Each direction's items joined with "; "
│
├── secondary[] → action_step entities (one per secondary intent)
│   └── observations: ["{action} {target}"]
│   └── metadata: { implicit, confidence, level: 1, parentChart }
│
└── actionStack[] → action_step entities (appended after secondary)
    └── observations: [item.text]
    └── metadata: { direction, completionStatus: item.completed, level: 1 }
```

### Due Date Distribution

Action steps receive evenly distributed due dates between `now` and the chart's due date:

```typescript
private distributeActionDates(start: Date, end: Date, count: number): Date[] {
  const totalTime = end.getTime() - start.getTime();
  const interval = totalTime / (count + 1);
  const dates: Date[] = [];
  for (let i = 1; i <= count; i++) {
    dates.push(new Date(start.getTime() + interval * i));
  }
  return dates;
}
```

### Dependency Resolution

```typescript
private addDependencyRelation(entities, relations, fromName, dependency, now): void {
  // Finds existing action_step entity whose observations[0] includes the dependency string
  const depEntity = entities.find(
    e => e.entityType === 'action_step' && e.observations[0]?.includes(dependency)
  );
  if (depEntity) {
    relations.push({
      from: fromName,
      to: depEntity.name,
      relationType: 'depends_on',
      metadata: { createdAt: now, context: dependency }
    });
  }
}
```

---

## 12. The 6 Relation Types

| Relation Type | From Entity | To Entity | Semantic |
|---------------|-------------|-----------|----------|
| `has_desired_outcome` | `structural_tension_chart` | `desired_outcome` | Chart owns the desired outcome |
| `has_current_reality` | `structural_tension_chart` | `current_reality` | Chart owns the current reality |
| `creates_tension_with` | `current_reality` | `desired_outcome` | The structural tension — gap between reality and goal |
| `has_action_step` | `structural_tension_chart` | `action_step` | Chart owns an action step |
| `advances_toward` | `action_step` | `desired_outcome` | Action step advances toward the desired outcome |
| `depends_on` | `action_step` | `action_step` | Action depends on another action completing first |

### Relation Creation Order in mapDecompositionToChart

```
For each secondary intent:
  1. chart → action_step     (has_action_step)
  2. action_step → desired_outcome  (advances_toward)
  3. IF dependency: action_step → dep_action_step (depends_on)

For each actionStack item:
  1. chart → action_step     (has_action_step)
  2. action_step → desired_outcome  (advances_toward)
  3. IF dependency: action_step → dep_action_step (depends_on)

Then structural relations:
  4. chart → desired_outcome  (has_desired_outcome)
  5. chart → current_reality  (has_current_reality)
  6. current_reality → desired_outcome (creates_tension_with)
```

---

## 13. coaia-pde MCP Tools

### Tool: `import_pde_decomposition`
**Purpose:** Load `.pde/<id>.json` and create STC session.

| Parameter | Type | Required |
|-----------|------|----------|
| `pde_id` | string | ✅ |
| `workdir` | string | ❌ |

**Returns:** `{ success, sessionId, chartId, pdeDecompositionId, filePath, chart: { desiredOutcome, currentReality, actionSteps } }`

### Tool: `create_stc_from_pde`
**Purpose:** One-shot — provide DecompositionResult JSON directly.

| Parameter | Type | Required |
|-----------|------|----------|
| `decomposition_result` | DecompositionResult | ✅ |
| `original_prompt` | string | ✅ |

### Tool: `list_pde_decompositions`
List `.pde/*.json` files available for import.

### Tool: `get_session`
Get session state including chart, action steps, progress %.

### Tool: `list_sessions`
List all sessions, optionally filtered by status (active|completed|abandoned|all).

### Tool: `update_action_progress`
Add factual observation to an action step. Optionally propagate to current reality.

| Parameter | Type | Required |
|-----------|------|----------|
| `session_id` | string | ✅ |
| `action_name` | string | ✅ |
| `observation` | string | ✅ |
| `update_current_reality` | boolean | ❌ |

### Tool: `mark_action_complete`
Mark action step complete. Completion auto-flows into current reality observations.

### Tool: `add_action_step`
Add new strategic action step to existing chart.

### Tool: `update_current_reality`
Add observations to the chart's current reality.

### Tool: `complete_session`
Mark session as completed, with optional final note.

### Tool: `init_llm_guidance`
Returns the LLM guidance text for STC methodology.

---

## 14. Session Manager & JSONL Format

### Storage Path
```
.coaia/pde/<UUID>.jsonl
```

### JSONL Line Format

Each line is one of:

```jsonl
{"type":"pde_session","sessionId":"...","originalPrompt":"...","masterChartId":"...","pdeDecompositionId":"...","createdAt":"...","updatedAt":"...","status":"active"}
{"type":"entity","name":"chart_abc123_chart","entityType":"structural_tension_chart","observations":[...],"metadata":{...}}
{"type":"entity","name":"chart_abc123_desired_outcome","entityType":"desired_outcome","observations":[...],"metadata":{...}}
{"type":"entity","name":"chart_abc123_current_reality","entityType":"current_reality","observations":[...],"metadata":{...}}
{"type":"entity","name":"chart_abc123_action_1","entityType":"action_step","observations":[...],"metadata":{...}}
{"type":"relation","from":"chart_abc123_chart","to":"chart_abc123_action_1","relationType":"has_action_step","metadata":{...}}
```

**Convention:** The `type` discriminator (`"entity"`, `"relation"`, `"pde_session"`) is added at serialization time — the Entity/Relation interfaces themselves do NOT have a `type` field.

### Session Update Strategy

Updates rewrite the entire JSONL file (session header + all entities + all relations). This ensures atomic consistency.

### PDE File Access

The session manager also reads `.pde/*.json` files directly to:
1. List available decompositions
2. Load a specific decomposition by ID (tries `{id}.json` first, then scans all .json files for matching id)

---

## 15. LLM Guidance Constant

```typescript
const LLM_GUIDANCE = `
# Structural Tension Charts - LLM Guidance

## CRITICAL: Action Steps Are NOT a To-Do List

Action Steps ARE:
- Strategic secondary choices that SUPPORT the primary goal
- UNDERSTOOD IN THE CONTEXT of structural tension
- Actions designed to ENABLE you to CREATE your goal

Action Steps ARE NOT:
- Items on a checklist to complete
- Independent tasks
- Detailed instructions

## Current Reality Guidelines

NEVER use default current reality that assumes readiness ("Ready to begin").
ALWAYS require explicit current reality assessment.
Current reality must be:
- Objective facts, not needs or desires
- Present state, not process
- No assumptions or exaggeration

## Desired Outcome Guidelines

- Describe RESULTS, not PROCESS
- Avoid comparative terms (better, more, improved)
- Create results, don't solve problems
- Be specific, not vague
`;
```

---

## 16. Architecture Summary: Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         AGENT (Copilot, Gemini, mia-code)        │
│                                                                   │
│  1. User prompt arrives                                           │
│  2. Call pde_decompose(prompt)                                    │
│     └─> Receives { systemPrompt, userMessage }                    │
│  3. Send systemPrompt + userMessage to LLM                       │
│     └─> LLM returns DecompositionResult JSON                      │
│  4. Call pde_parse_response(llm_response, original_prompt)        │
│     └─> Parsed, normalized, stored in .pde/<uuid>.json + .md      │
│     └─> Returns StoredDecomposition                               │
│                                                                   │
│  5. (Optional) Call import_pde_decomposition(pde_id)   [coaia]    │
│     └─> Loads .pde/<id>.json                                      │
│     └─> stcMapper.mapDecompositionToChart()                       │
│     └─> Creates .coaia/pde/<uuid>.jsonl session                   │
│     └─> Returns session with chart, actions, progress             │
│                                                                   │
│  6. (During work) update_action_progress, mark_action_complete    │
│  7. (On completion) complete_session                              │
└──────────────────────────────────────────────────────────────────┘

Storage topology:
  .pde/
  ├── <uuid>.json         ← DecompositionResult (mcp-pde)
  └── <uuid>.md           ← Markdown export (mcp-pde)
  .coaia/pde/
  └── <uuid>.jsonl        ← STC session (coaia-pde)
```

### Public API Exports (mcp-pde index.ts)

```typescript
export { PdeEngine, PDEParseError } from './pde-engine.js';
export { parseDecompositionResponse, actionStackToMarkdown } from './parser.js';
export { buildSystemPrompt, formatUserMessage } from './prompts.js';
export { saveDecomposition, loadDecomposition, listDecompositions, decompositionToMarkdown } from './storage.js';
export type {
  DecompositionResult, DecompositionOptions, PrimaryIntent, SecondaryIntent,
  ContextRequirements, ExpectedOutputs, Direction, DirectionItem, DirectionMap,
  ActionItem, AmbiguityFlag, StoredDecomposition,
} from './types.js';
```

---

*🔥 South direction analysis complete. This document contains the full algorithmic, type, and storage specification needed to replicate PDE + STC within Forgewright.*
