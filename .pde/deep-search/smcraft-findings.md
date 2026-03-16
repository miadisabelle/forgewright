# SMCraft Deep Search Findings — Forgewright Integration

> **Search Date**: 2026-03-15
> **Source**: `/workspace/repos/jgwill/smcraft/`
> **Specs**: 70 (SMDF), 71 (Runtime), 72 (Codegen), 73 (MCP), 74 (Web Designer), 75 (Agent Bridge)

---

## SMDF Type Definitions (exact TypeScript)

**File**: `ts/src/model.ts`
**Import**: `import { ... } from "smcraft"` or `from "smcraft/parser"` etc.

```typescript
// --- Settings ---

export interface ObjectRef {
  instance: string;
  class: string;
  namespace?: string;
}

export interface ContextConfig {
  class?: string;
  instance?: string;
}

export interface SettingsModel {
  namespace: string;
  name?: string;
  asynchronous: boolean;
  objects?: ObjectRef[];
  context?: ContextConfig;
  using?: string[];
}

// --- Events ---

export interface ParameterDef {
  name: string;
  type: string;
}

export interface EventDef {
  id: string;
  name?: string;
  description?: string;
  parameters?: ParameterDef[];
  preAction?: string;
  postAction?: string;
}

export interface TimerDef {
  id: string;
  name: string;
  description?: string;
}

export interface EventSourceDef {
  name: string;
  file?: string;
  feeder?: string;
  description?: string;
  events?: EventDef[];
  timers?: TimerDef[];
}

// --- Actions ---

export interface TimerStartAction {
  timer: string;
  duration: string;
}

export interface ActionDef {
  code?: string;
  timerStart?: TimerStartAction;
  timerStop?: string;
}

// --- Transitions ---

export interface TransitionDef {
  event: string;
  nextState?: string;
  condition?: string;
  description?: string;
  actions?: ActionDef[];
}

// --- States ---

export type StateKindType = "normal" | "final" | "history";

export interface ParallelDef {
  nextState: string;
  states: StateDef[];
}

export interface StateDef {
  name: string;
  kind?: StateKindType;
  description?: string;
  onEntry?: { actions: ActionDef[] };
  onExit?: { actions: ActionDef[] };
  transitions?: TransitionDef[];
  states?: StateDef[];       // child states (composite if non-empty)
  parallel?: ParallelDef;    // orthogonal regions
}

// --- Root Definition ---

export interface StateMachineDefinition {
  settings: SettingsModel;
  events: EventSourceDef[];
  state: StateDef;
}
```

### Web Designer Extended Types

**File**: `web/src/types/definition.ts` — mirrors model.ts with these additions:

```typescript
// Web designer SettingsModel has extra fields:
export interface SettingsModel {
  // ...same as ts/src/model.ts plus:
  description?: string;
  objects?: { name: string; type: string }[];  // NOTE: different shape from ts (instance/class → name/type)
  context?: { className?: string; baseClass?: string };  // NOTE: different shape from ts
  imports?: string[];
  targetLanguage?: string;
}

// Web designer ActionDef has discriminated union shape:
export interface ActionDef {
  action: "code" | "timerStart" | "timerStop";  // discriminator field NOT in ts core
  code?: string;
  name?: string;
  timerStart?: TimerStartAction;
  timerStop?: string;
}

// Visual layout data (NOT in .smdf.json — stored in separate .smdp.json)
export interface StatePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignerLayout {
  positions: Record<string, StatePosition>;
}

export interface ValidationError {
  ruleId: string;
  message: string;
  element?: string;
  severity?: "error" | "warning";
}
```

### ⚠️ TYPE DIVERGENCE WARNING
The web designer's `SettingsModel`, `ActionDef`, and `ObjectRef` shapes differ from `ts/src/model.ts`. Forgewright must decide which to canonicalize or bridge.

---

## Runtime API

**File**: `ts/src/runtime.ts`
**Import**: `from "smcraft/runtime"`

### StateKind Enum
```typescript
export enum StateKind {
  LEAF = "leaf",
  COMPOSITE = "composite",
  ROOT = "root",
  FINAL = "final",
  PARALLEL = "parallel",
  HISTORY = "history",
}
```

### State Class
```typescript
export class State {
  name: string;
  kind: StateKind;
  parent: State | null;

  constructor(name: string, kind: StateKind = StateKind.LEAF, parent: State | null = null);
  onEntry(_context: ContextBase): void {}   // override in generated code
  onExit(_context: ContextBase): void {}    // override in generated code
}
```

### Observer Protocol
```typescript
export interface IObserver {
  onEntry(contextName: string, stateName: string): void;
  onExit(contextName: string, stateName: string): void;
  onTransitionBegin(contextName: string, statePrev: string, stateNext: string, transitionName: string): void;
  onTransitionEnd(contextName: string, statePrev: string, stateNext: string, transitionName: string): void;
  onTimerStart(contextName: string, timerName: string, duration: number): void;
  onTimerStop(contextName: string, timerName: string): void;
}
```

**Built-in observers**:
- `ObserverNull` — singleton, no-op (default)
- `ObserverConsole` — singleton, logs to console

### TransitionHelper (Static)
```typescript
export class TransitionHelper {
  static findCommonAncestor(stateA: State, stateB: State): State | null;
  static processTransitionBegin(context: ContextBase, statePrev: State, stateNext: State, transitionName: string): void;
  static processTransitionEnd(context: ContextBase, statePrev: State, stateNext: State): void;
}
```

**Algorithm**: LCA (Lowest Common Ancestor) based.
1. Find LCA of source and target
2. Exit chain: current → LCA (child→parent order), fire onExit at each
3. Fire observer.onTransitionBegin
4. Enter chain: LCA → target (parent→child order), fire onEntry at each
5. Fire observer.onTransitionEnd
6. If target is FINAL → fire context.onEnd()

### ContextBase (Abstract)
```typescript
export type EndHandler = (context: ContextBase) => void;

export abstract class ContextBase {
  name: string;
  transitionName: string;
  observer: IObserver;

  constructor(name?: string);
  setObserver(observer: IObserver): void;
  registerEndHandler(handler: EndHandler): void;
  onEnd(): void;
  addChild(child: ContextBase): void;
  startTimer(timerName: string, durationMs: number, callback: () => void): void;
  stopTimer(timerName: string): void;
  stopAllTimers(): void;
  abstract enterInitialState(): void;
  serialize(): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): void;
  setState(_stateName: string): void;
}
```

### Context (Synchronous)
```typescript
export class Context extends ContextBase {
  stateCurrent: State | null;
  statePrevious: State | null;
  stateNext: State | null;
  stateHistory: State | null;

  enterInitialState(): void;
  leaveCurrentState(): void;  // exits all states up to root
  saveState(): void;          // saves current to stateHistory
}
```

### ContextAsync (Async Event Queue)
```typescript
export class ContextAsync extends Context {
  maxEvents: number;  // default 1024

  constructor(name?: string, maxEvents?: number);
  scheduleEvent(handler: (...args: unknown[]) => void, ...args: unknown[]): void;
}
```
- Uses `queueMicrotask` for scheduling (not setTimeout)
- Sequential processing — no concurrent event handling
- Max event limit prevents infinite loops

### How to Create & Run a State Machine (Runtime)
```typescript
import { Context, State, StateKind, TransitionHelper, ObserverConsole } from "smcraft/runtime";

// 1. Create state hierarchy
const root = new State("Root", StateKind.ROOT);
const idle = new State("Idle", StateKind.LEAF, root);
const active = new State("Active", StateKind.LEAF, root);

// 2. Create context
const ctx = new Context("MyContext");
ctx.stateCurrent = idle;
ctx.setObserver(ObserverConsole.instance());

// 3. Fire transition
TransitionHelper.processTransitionBegin(ctx, idle, active, "EvActivate");
ctx.stateCurrent = active;
TransitionHelper.processTransitionEnd(ctx, idle, active);

// 4. Serialize/deserialize state
const snapshot = ctx.serialize();  // { state: "Active" }
ctx.deserialize(snapshot);

// 5. End handler
ctx.registerEndHandler((c) => console.log("Machine ended:", c.name));
```

---

## Parser API

**File**: `ts/src/parser.ts`
**Import**: `from "smcraft/parser"` or `from "smcraft"`

```typescript
export interface ValidationError {
  ruleId: string;
  message: string;
  element?: string;
}

export interface EnrichedModel {
  definition: StateMachineDefinition;
  stateMap: Map<string, StateDef>;
  eventMap: Map<string, EventDef>;
  timerMap: Map<string, TimerDef>;
  feedersMap: Map<string, EventDef[]>;
  parentMap: Map<string, string | null>;
  allStates: StateDef[];
  leafStates: StateDef[];
  compositeStates: StateDef[];
}

export function parseJson(content: string): StateMachineDefinition;
export function parseFile(filePath: string): StateMachineDefinition;   // Node.js only (uses require("fs"))
export function enrich(definition: StateMachineDefinition): EnrichedModel;
export function validate(model: EnrichedModel): ValidationError[];
```

### Pipeline
```typescript
import { parseJson, enrich, validate } from "smcraft";

const def = parseJson(jsonString);
const model = enrich(def);
const errors = validate(model);
if (errors.length === 0) {
  // model.stateMap, model.eventMap, model.leafStates etc. ready
}
```

---

## Codegen API

**File**: `ts/src/codegen.ts`
**Import**: `from "smcraft/codegen"`

```typescript
export class TypeScriptCodeGenerator {
  constructor(model: EnrichedModel);
  generate(): string;  // returns full TypeScript source as string
}
```

### Generated Output Structure
1. **Header** — machine name, namespace comment
2. **Imports** — `import { Context, ContextAsync, ContextBase, ObserverNull, State, StateKind, TransitionHelper } from "./runtime.js"`
3. **State Enum** — `export enum {Name}StateEnum { ROOT = 0, IDLE = 1, ... }`
4. **Base State Class** — `export class State{Name} extends State { on{Event}(context, ...params): void {} }`
5. **Leaf State Classes** — One per leaf state with concrete event handlers, onEntry/onExit, transition logic
6. **Context Class** — `export class {Name}Context extends Context|ContextAsync { ... }`
   - State field declarations (`stateIdle!: StateIdle`)
   - Constructor: instantiates all states with parent references
   - `enterInitialState()`: sets initial state, fires entry chain
   - `setState(stateName)`: runtime state restoration
   - Event handler methods: delegates to `(this.stateCurrent as any).on{Event}(this, ...args)`
7. **Feeder Classes** — One per feeder: `export class {FeederName} { on{Event}(...) { this.context.on{Event}(...) } }`

### Naming Conventions in Generated Code
- State fields: `toCamelCase("state_" + toSnakeCase(stateName))` → e.g. `stateActiveWaitingBreakout`
- Event methods: `"on" + toPascalCase(toSnakeCase(eventId))` → e.g. `onPriceBreakout`
- Enum values: `toSnakeCase(stateName).toUpperCase()` → e.g. `ACTIVE_WAITING_BREAKOUT`
- Action emission: `(context as any).{code}` — raw code injection

### MCP Server Codegen (Fallback)
The MCP server (`mcp/src/server.ts`) has its own inline fallback generators:
- `generatePythonFallback(def)` — minimal Python with `smcraft.runtime` imports
- `generateTypeScriptFallback(def)` — minimal TypeScript with `smcraft/runtime` imports
- Primary path: attempts `execSync('smcg "${inputFile}" -l ${language} -o "${outputDir}"')` (calls Python CLI)

### CLI Interface
```bash
smcg <input.smdf.json> -o <output_dir> -l python|typescript -v --validate-only
# Output: {output_dir}/{snake_name}_fsm.{py|ts}
```

---

## MCP Server Tools

**File**: `mcp/src/server.ts`
**Package**: `smcraft-mcp` (v0.1.0)
**Transport**: stdio (StdioServerTransport)
**Dependencies**: `@modelcontextprotocol/sdk@^1.12.1`, `zod@^4.3.6`

### Tools (11 total)

| # | Tool Name | Parameters | Return |
|---|-----------|------------|--------|
| 1 | `create_state_machine` | `{ namespace: string, name: string, asynchronous?: boolean }` | Confirmation text |
| 2 | `add_state` | `{ name: string, parent?: string, kind?: "normal"\|"final"\|"history", description?: string }` | Confirmation text |
| 3 | `add_event` | `{ id: string, description?: string }` | Confirmation text |
| 4 | `add_transition` | `{ state: string, event: string, nextState?: string, condition?: string, description?: string }` | Confirmation text |
| 5 | `remove_state` | `{ name: string }` | Confirmation text |
| 6 | `validate_definition` | `{}` | "✓ Definition is valid" or error list |
| 7 | `generate_code` | `{ language: "python"\|"typescript" }` | Generated code string (validates first) |
| 8 | `get_definition` | `{}` | Full definition JSON wrapped as `{ stateMachine: ... }` |
| 9 | `load_definition` | `{ json: string }` | Confirmation with state/event counts |
| 10 | `list_states` | `{}` | Indented tree with transition count per state |
| 11 | `list_events` | `{}` | Flat list of event IDs with descriptions |

### Resources (1)
- **URI**: `smcraft://definition` — returns current definition as JSON

### Prompts (1)
- **Name**: `design-state-machine`
- **Parameters**: `{ domain?: string, name?: string }`
- **Purpose**: Guided 6-step state machine design conversation

### MCP Server Internal State
```typescript
// One in-memory definition per server process
let currentDefinition: Definition | null = null;

interface Definition {
  settings: { namespace: string; name: string; asynchronous: boolean };
  events: { name: string; events: EventDef[] }[];
  state: StateDef;
}
```
**⚠️ No persistence** — definition lost on server restart.

### MCP Server Validation Rules (inline, subset)
- V001: No events defined
- V002: Duplicate state name
- V003: Transition references unknown event
- V004: Transition targets unknown state
- V005: Root must have ≥1 child state

### Code Generation Pipeline (MCP)
1. Writes temp `.smdf.json` file
2. Attempts `smcg` CLI subprocess (`execSync`)
3. On failure: falls back to inline lightweight generators
4. Returns generated code as text content

---

## Web Designer Patterns

**Stack**: Next.js 16.1.6 + React 19 + Zustand 5 + Tailwind 4 + SVG canvas
**File structure**:
```
web/src/
├── app/
│   ├── page.tsx              # Main layout: Toolbar + Canvas + Sidebar + ContextMenu
│   ├── layout.tsx            # Root layout (dark theme)
│   └── api/generate/route.ts # POST endpoint → smcg CLI
├── components/
│   ├── Canvas.tsx            # SVG state nodes + Bézier transition arrows
│   ├── Toolbar.tsx           # File ops, undo/redo, draw mode, validate, generate
│   ├── PropertiesPanel.tsx   # Selected state/transition editor
│   ├── EventsPanel.tsx       # Event source & parameter management
│   ├── SettingsPanel.tsx     # Machine settings (namespace, name, async, context)
│   ├── ValidationPanel.tsx   # Error list with clickable state navigation
│   └── CodePreview.tsx       # Modal for generated code display
├── store/
│   └── useDesignerStore.ts   # Zustand store (entire app state)
└── types/
    ├── definition.ts         # SMDF type mirrors + layout types
    └── index.ts              # barrel export
```

### Zustand Store Shape (exact)
```typescript
interface DesignerState {
  // Core data
  definition: StateMachineDefinition;
  layout: DesignerLayout;
  fileName: string | null;
  dirty: boolean;

  // Selection
  selection: { kind: "state" | "transition" | "event" | null; id: string | null };

  // Draw mode
  drawMode: "select" | "transition";
  drawSource: string | null;

  // Context menu
  contextMenu: { visible: boolean; x: number; y: number; target: { kind: "state" | "canvas"; id?: string } | null };

  // History (max 50 entries)
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // UI state
  activeTab: "properties" | "events" | "settings";
  errors: ValidationError[];
  showCodePreview: boolean;
  generatedCode: string | null;

  // Composite drill-down navigation
  navigationPath: string[];   // e.g. ["Root", "Active"]
  currentParent: string;      // which state's children are displayed
}
```

### Zustand Store Methods (complete)

**Definition mutations**:
- `setDefinition(def)` — replace full definition, auto-layout, auto-validate
- `updateSettings(patch)` — partial settings update

**State operations**:
- `addState(parentPath, state)` — add child state (null = root)
- `updateState(name, patch)` — partial state update
- `removeState(name)` — remove + cleanup layout
- `nestState(childName, newParentName)` — move state to new parent

**Event source operations**:
- `addEventSource(source)`, `updateEventSource(index, patch)`, `removeEventSource(index)`

**Event operations**:
- `addEvent(evt, sourceIndex?)` — add to source (default 0)
- `updateEvent(id, patch)`, `removeEvent(id)`

**Parameter operations**:
- `addParameter(eventId, param)`, `removeParameter(eventId, paramIndex)`, `updateParameter(eventId, paramIndex, patch)`

**Action operations** (onEntry/onExit):
- `addAction(stateName, hook, action)`, `removeAction(stateName, hook, actionIndex)`, `updateAction(stateName, hook, actionIndex, action)`

**Transition operations**:
- `addTransition(stateName, trans)`, `updateTransition(stateName, index, patch)`, `removeTransition(stateName, index)`

**Layout**: `setStatePosition(name, pos)`

**Selection**: `select(kind, id)`, `clearSelection()`

**Draw mode**: `setDrawMode(mode)`, `setDrawSource(name)`

**Context menu**: `showContextMenu(x, y, target)`, `hideContextMenu()`

**Undo/Redo**: `undo()`, `redo()`, `canUndo()`, `canRedo()`

**File operations**: `loadFromJson(json, fileName?)`, `exportJson()` → JSON string wrapped as `{ stateMachine: ... }`

**Validation**: `validate()` → runs V001-V008 inline

**Codegen**: `setGeneratedCode(code)`, `setShowCodePreview(show)`

**Navigation**: `navigateInto(stateName)`, `navigateUp(toLevel?)`, `getCurrentChildren()` → child states of currentParent

### SVG Canvas Patterns
- **State nodes**: `<rect>` with dynamic styling per kind:
  - Normal: rounded rect, solid border
  - Final: dashed border (`strokeDasharray="6 3"`)
  - History: rounded corners (`rx=30`)
  - Composite: dashed border (`strokeDasharray="4 2"`), drill-down hint text
- **Transition arrows**: Bézier `<path>` with `<marker>` arrowhead
  - SVG path: `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`
  - Label: `<rect>` + `<text>` at midpoint showing event name + optional condition
- **Event picker**: Popup on transition draw completion — lists all events for selection
- **Breadcrumb**: Appears when navigated into composite state
- **Error highlighting**: Red border + ⚠ icon for states with validation errors
- **Keyboard shortcuts**: Delete (remove state), Ctrl+Z/Y (undo/redo), Escape (cancel draw mode)

### Web API Route (`/api/generate`)
```typescript
// POST /api/generate { definition: string|object, language: "python"|"typescript" }
// 1. Parse definition (unwrap { stateMachine: ... } wrapper)
// 2. Write temp .smdf.json
// 3. execSync(`smcg "${inputFile}" -l ${lang} -o "${outputDir}"`)
// 4. Read output file ({snake_name}_fsm.{py|ts})
// 5. Return { code, language }
// On error: return { error: message } with 500
```

---

## Validation Rules

### Full Rule Set (from Spec 70)

| Rule | Description | Implemented In |
|------|-------------|---------------|
| **V001** | Exactly one root state (parser: "No root state defined") | parser.ts, server.ts (as "No events"), store.ts (as "No events") |
| **V002** | Unique state names across entire tree | parser.ts ✅, server.ts ✅, store.ts ✅ |
| **V003** | Unique event IDs across all sources | parser.ts ✅, store.ts ✅ (also: "references unknown event" in server.ts) |
| **V004** | Timer IDs unique, no collision with event IDs | spec only |
| **V005** | Transition events reference defined event IDs | parser.ts ✅ (as V005), server.ts (as V003), store.ts (as V003) |
| **V006** | Transition nextState references defined state names | parser.ts ✅ (as V006), server.ts (as V004), store.ts (as V004) |
| **V007** | Final states have no outgoing transitions | parser.ts ✅, store.ts ✅ |
| **V008** | Final states have no children | store.ts ✅ |
| **V009** | Composite states should designate initial child | spec only (convention: first child) |
| **V010** | Parallel states: ≥2 regions, each ≥1 child | spec only |
| **V011** | Parallel region transitions: within region or to parent exit | spec only |
| **V012** | Composite states must have ≥1 child | spec only |
| **V013** | At least one event source defined | parser.ts ✅ |
| **V014** | Timer refs in actions must reference defined timer names | spec only |

### ⚠️ RULE ID DIVERGENCE
The three validators (parser.ts, server.ts, store.ts) use **different rule IDs** for the same semantic check:
- "Unknown event in transition": V005 in parser, V003 in server/store
- "Unknown state in transition": V006 in parser, V004 in server/store
- "Root needs children": — in parser (not checked), V005 in server/store

Forgewright should canonicalize rule IDs.

---

## Key Patterns for Forgewright Integration

### 1. Package Exports (ts/package.json)
```json
{
  "name": "smcraft",
  "version": "0.1.2",
  "type": "module",
  "exports": {
    ".":          { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./runtime":  { "import": "./dist/runtime.js", "types": "./dist/runtime.d.ts" },
    "./parser":   { "import": "./dist/parser.js", "types": "./dist/parser.d.ts" },
    "./codegen":  { "import": "./dist/codegen.js", "types": "./dist/codegen.d.ts" }
  }
}
```

### 2. MCP Server Config
```json
{
  "mcpServers": {
    "smcraft": {
      "command": "node",
      "args": ["/path/to/smcraft/mcp/dist/server.js"]
    }
  }
}
```

### 3. SMDF File Convention
- Extension: `.smdf.json`
- Wrapper: `{ stateMachine: <StateMachineDefinition> }` (for import/export)
- OR: bare `StateMachineDefinition` (parser accepts both)

### 4. Codegen Output Convention
- Filename: `{snake_case_name}_fsm.{py|ts}`
- Generated code imports runtime from: `"./runtime.js"` (relative — Forgewright may need to adjust import paths)

### 5. Architecture Flow
```
SMDF JSON → parseJson() → enrich() → validate()
                                         ↓
                              TypeScriptCodeGenerator.generate()
                                         ↓
                              Generated TS file importing smcraft/runtime
```

### 6. Known Structural Tensions (from rispecs)
1. **Agent ↔ WebUI disconnected** — no Socket.IO bridge yet (Spec 75)
2. **Three independent codegen implementations** — ts/codegen.ts, py/codegen.py, mcp/server.ts inline
3. **MCP server has no persistence** — in-memory only
4. **Parallel region execution missing** — no ContextParallel runtime
5. **History state** — only single-level stateHistory (no per-composite memory)
6. **Timer-async integration** — timers use daemon threads, not cooperative with async queue
7. **WebUI codegen broken** — "Generate" button calls `/api/generate` which calls `smcg` CLI (requires Python package installed)
8. **Type divergence** between `ts/src/model.ts` and `web/src/types/definition.ts`

### 7. Forgewright Integration Points
- **Import `smcraft` as npm dependency** for types and parser
- **Use `smcraft/runtime`** as the execution engine
- **Wrap `smcraft-mcp`** or extend it for Forgewright's agent workflow
- **Reuse web designer components** — Canvas, store patterns, validation
- **Extend SMDF format** if needed (e.g., metadata, visual layout in same file)
- **Bridge validation rule IDs** to a canonical set

### 8. Full Pipeline for Forgewright
```
Agent Intent → PDE Decomposition → SMDF Construction (via MCP tools or direct)
    → parseJson() → enrich() → validate()
    → TypeScriptCodeGenerator.generate() OR smcg CLI
    → Runtime execution via Context + Observer
    → State persistence via serialize()/deserialize()
```

---

## All Files Read (with 1-line summary each)

### ts/src/ (Core TypeScript Library)
| File | Summary |
|------|---------|
| `ts/src/model.ts` | All SMDF TypeScript interfaces: StateMachineDefinition, StateDef, EventDef, TransitionDef, ActionDef, ParallelDef, SettingsModel, ObjectRef |
| `ts/src/index.ts` | Barrel exports for model types, parser functions, runtime classes, and codegen |
| `ts/src/parser.ts` | JSON parser, EnrichedModel builder (state/event/timer maps, parent tracking), and V001-V013 validator |
| `ts/src/runtime.ts` | State, Context, ContextAsync, TransitionHelper (LCA algorithm), Observer protocol, timer management, serialization |
| `ts/src/codegen.ts` | TypeScriptCodeGenerator — transforms EnrichedModel into complete TS file with state enum, classes, context, feeders |
| `ts/src/tests/statemachine.test.ts` | End-to-end tests: parse BDBO example, validate, generate code, test runtime transitions, hierarchy, serialization |
| `ts/package.json` | Package "smcraft" v0.1.2, ESM, exports `.`, `./runtime`, `./parser`, `./codegen`; devDeps: typescript ^5.4, @types/node ^25.3 |
| `ts/tsconfig.json` | ES2022 target, NodeNext modules, strict, declaration, sourceMap |

### mcp/src/ (MCP Server)
| File | Summary |
|------|---------|
| `mcp/src/server.ts` | 11 MCP tools (create/add/remove/validate/generate/get/load/list), 1 resource (definition), 1 prompt (design-state-machine); stdio transport; fallback codegen |
| `mcp/package.json` | Package "smcraft-mcp" v0.1.0, bin "smcraft-mcp", deps: @modelcontextprotocol/sdk ^1.12.1, zod ^4.3.6 |
| `mcp/tsconfig.json` | ES2022 target, NodeNext modules, strict |

### web/src/ (Web Designer)
| File | Summary |
|------|---------|
| `web/src/app/page.tsx` | Main page layout: Toolbar + Canvas (flex-1) + right sidebar (tabs: Properties/Events/Settings/Validation) + CodePreview overlay + context menu |
| `web/src/app/layout.tsx` | Root layout, dark theme, metadata: "SMCraft Designer" |
| `web/src/app/api/generate/route.ts` | POST endpoint: receives definition + language, writes temp file, calls `smcg` CLI, returns generated code |
| `web/src/store/useDesignerStore.ts` | Complete Zustand store: definition CRUD, undo/redo (max 50), selection, draw mode, context menu, validation, navigation, auto-layout |
| `web/src/types/definition.ts` | SMDF type mirrors with web-specific additions (DesignerLayout, StatePosition, extended SettingsModel, discriminated ActionDef) |
| `web/src/types/index.ts` | Barrel re-export of definition.ts |
| `web/src/components/Canvas.tsx` | SVG canvas: state nodes (rect), transition arrows (Bézier + markers), drag-to-move, draw mode, event picker popup, breadcrumb nav, keyboard shortcuts |
| `web/src/components/Toolbar.tsx` | Control bar: file open/save, undo/redo, draw mode toggle, +State, validate, language selector, generate, code preview toggle |
| `web/src/components/PropertiesPanel.tsx` | Edit selected state (name, kind, description, onEntry/onExit actions, transitions) or transition (event, target, condition) |
| `web/src/components/EventsPanel.tsx` | Event source management: add/edit/remove events, manage parameters per event, inline editing, generated method preview |
| `web/src/components/SettingsPanel.tsx` | Machine settings: namespace, name, description, async flag, context class/base, imports, object refs, target language |
| `web/src/components/ValidationPanel.tsx` | Error list with rule ID + message, clickable to select erroring element, severity coloring |
| `web/src/components/CodePreview.tsx` | Modal overlay showing generated code/JSON with copy-to-clipboard |
| `web/package.json` | Next.js 16.1.6, React 19, Zustand 5, Tailwind 4, private package |

### rispecs/ (RISE Specifications)
| File | Summary |
|------|---------|
| `rispecs/70-smdf-format.spec.md` | SMDF format spec: JSON schema, all types, V001-V014 validation rules, file conventions (.smdf.json), creative scenarios |
| `rispecs/71-runtime-engine.spec.md` | Runtime spec: StateKind, State, Context/ContextAsync, TransitionHelper LCA algorithm, timers, Observer protocol, structural tensions |
| `rispecs/72-code-generator.spec.md` | Codegen spec: pipeline (SMDF→parser→enrich→generate), CLI interface (`smcg`), Python/TypeScript targets, naming conventions, structural tensions |
| `rispecs/73-mcp-server.spec.md` | MCP server spec: all 11 tools with params, design session protocol, in-memory state, structural tensions (lightweight vs real codegen) |
| `rispecs/74-web-designer.spec.md` | Web designer spec: component architecture, Zustand store shape, SVG patterns, composite drill-down design, structural tensions |
| `rispecs/75-agent-designer-bridge.spec.md` | Bridge spec: Socket.IO sync, `launch_designer` tool, `generate_to_file` tool, session persistence, scaffold generation |

### examples/
| File | Summary |
|------|---------|
| `examples/bdbo_strategy.smdf.json` | BDBOStrategy: 8 states (Root, Idle, Active→3 children, Completed, Failed), 7 events, timer (Timeout), conditional transitions, entry/exit actions |
| `examples/fdb_breakout_strategy.smdf.json` | FDBBreakoutStrategy: 13 states, 14 events, 1 timer (MaxPuiTimer), 3 objects, conditional transitions, extensive entry actions, 6 final states |

### Root files
| File | Summary |
|------|---------|
| `README.md` | Overview: 4 packages (py/ts/web/mcp), quick start instructions, architecture diagram, SMDF format example |
