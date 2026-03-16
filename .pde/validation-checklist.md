# 🌊 WEST — Forgewright Validation Checklist

> Generated from 9 RISE specifications + KINSHIP.md
> Purpose: Consumed by 5 validation agents during parallel build execution
> Direction: WEST (Ningaabi) — Implementation & Validation
> Date: 2026-03-16

---

## Integration Point Matrix

> Which spec connects to which, and via what interface.

| From Spec | To Spec | Interface / Data Flow | Direction |
|-----------|---------|----------------------|-----------|
| 01 (PDE) | 02 (State Machine) | `SMDFSeed` — PDE Stage 4 `action stack → SMDF state definitions` | EAST→SOUTH |
| 01 (PDE) | 03 (Graph) | `GraphNodes` — PDE Stage 4 `intents → RelationalNode[]` | EAST→EAST |
| 01 (PDE) | 06 (Ceremony) | `CeremonyGuidance` — PDE Stage 3 `balance < 0.3 → ceremony recommended` | EAST→WEST |
| 01 (PDE) | 04 (MCP) | `pde/decompose` + `pde/parse_response` tools exposed via MCP | EAST→ALL |
| 02 (State Machine) | 03 (Graph) | `StateMachine`, `State`, `Event` nodes + `TRANSITIONS_TO`, `CONTAINS` edges written to KuzuDB | SOUTH→EAST |
| 02 (State Machine) | 05 (Designer) | `SMDF definition` → canvas rendering; `GraphDelta` via WebSocket bidirectional sync | SOUTH→NORTH |
| 02 (State Machine) | 04 (MCP) | `sm/*` namespace tools (create, add_state, fire_event, etc.) | SOUTH→ALL |
| 03 (Graph) | 05 (Designer) | KuzuDB query results → relational graph circular layout rendering | EAST→NORTH |
| 03 (Graph) | 06 (Ceremony) | OCAP metadata on nodes/edges → ceremony-bounded query filtering | EAST→WEST |
| 03 (Graph) | 04 (MCP) | `graph/*` namespace tools (query, neighborhood, path, wilson_score) | EAST→ALL |
| 04 (MCP) | 05 (Designer) | WebSocket `GraphDelta` push/pull between MCP state and designer canvas | ALL→NORTH |
| 04 (MCP) | 06 (Ceremony) | Ceremony middleware intercepts ALL tool calls → phase/OCAP check | ALL→WEST |
| 04 (MCP) | 07 (Agentic) | Agent tool calls routed through MCP → ceremony + spiral governance | ALL→ALL |
| 05 (Designer) | 02 (State Machine) | Canvas edits → Zustand store → WebSocket → MCP SMDF update | NORTH→SOUTH |
| 06 (Ceremony) | 07 (Agentic) | Phase-based autonomy levels: Opening=Guided, Active=Assisted/Autonomous, Integration=Autopilot | WEST→ALL |
| 06 (Ceremony) | 03 (Graph) | `ceremony_id` filter injected into all graph queries during active ceremony | WEST→EAST |
| 07 (Agentic) | 02 (State Machine) | `SpiralTracker` fires events to `WorkspaceStateMachine` on direction advance | ALL→SOUTH |
| 07 (Agentic) | 01 (PDE) | Each new spiral cycle begins with PDE decomposition (updated current reality) | ALL→EAST |
| 08 (MW Integration) | ALL | `ontology-core` types consumed by every spec; 7 packages wired as platform infrastructure | FOUNDATION |
| 00 (Architecture) | ALL | Defines 5-layer architecture, deployment topology, technology stack | CONTAINER |

---

## Testable Assertions (Per Spec)

### Spec 00 — Platform Architecture

- [ ] **A00-01**: The platform has exactly 5 layers: Product Shell, Visual Designer, MCP Tool Surface, Domain Engines, Data Substrate
- [ ] **A00-02**: Frontend uses Next.js 15 + React 19 + Zustand (verify `package.json` dependencies)
- [ ] **A00-03**: Backend runtime is Node.js + Bun (verify runtime configuration)
- [ ] **A00-04**: KuzuDB is used as graph database (verify import/initialization)
- [ ] **A00-05**: Redis is used for session cache + pub/sub (verify connection config)
- [ ] **A00-06**: SQLite FTS5 + sqlite-vec used for QMD search (verify schema)
- [ ] **A00-07**: Langfuse is wired for session observability (verify tracing calls)
- [ ] **A00-08**: The web shell has three panes: Chat, Editor (code-server iframe), Preview
- [ ] **A00-09**: MCP server supports both stdio AND HTTP transport
- [ ] **A00-10**: Data substrate stores to: `.pde/`, `.smdf.json`, `.coaia/`, `.ceremony/`

### Spec 01 — PDE-to-Plan Pipeline

- [ ] **A01-01**: PDE output renders `## Four Directions` section BEFORE `## Primary Intent` — ordering violation = non-compliant
- [ ] **A01-02**: Pipeline has exactly 4 stages: Decompose (EAST) → Enrich (SOUTH) → Assess (WEST) → Plan (NORTH)
- [ ] **A01-03**: Stage 3 computes directional balance score (0–1); balance < 0.3 triggers ceremony recommendation
- [ ] **A01-04**: Stage 4 outputs: `StructuredPlan` containing `smdfSeed`, `graphNodes`, `narrativeBeats`, `ceremonyGuidance`
- [ ] **A01-05**: PDE stores to `.pde/{id}.json`, `.pde/{id}.md`, AND `.pde/{id}.seed.smdf.json` (NEW seed file)
- [ ] **A01-06**: Hedging language ("probably", "somehow") detected and converted to explicit tasks with confidence scores
- [ ] **A01-07**: Action stack is dependency-sorted following direction flow: East → South → West → North
- [ ] **A01-08**: Wilson alignment is scored per intent (each intent gets `wilsonScore`)
- [ ] **A01-09**: `StructuredPlan` interface includes `pipelineVersion: string` field
- [ ] **A01-10**: Narrative beats generated per action step with directional act assignment

### Spec 02 — State Machine Creative Engine

- [ ] **A02-01**: Three creative phases exist as composite states: Germination → Assimilation → Completion
- [ ] **A02-02**: Germination contains: TaskDefinition, SpecGeneration, PDEDecomposition
- [ ] **A02-03**: Assimilation contains: PlanGeneration, CodeImplementation, IterativeRefinement
- [ ] **A02-04**: Completion contains: Validation, Review, Integration
- [ ] **A02-05**: `WorkspaceStateMachine` interface has fields: `workspaceId`, `definition`, `currentState`, `stcChartId`, `tensionLevel`, `eventHistory`, `oscillationDetector`
- [ ] **A02-06**: 11 event types defined: `tension_established`, `action_step_completed`, `reality_updated`, `phase_advance`, `phase_retreat`, `ai_generate`, `user_edit`, `tension_resolve`, `tension_oscillate`, `workspace_fork`, `moment_of_truth`
- [ ] **A02-07**: `OscillationDetector` flags when same state visited 3+ times without advancing
- [ ] **A02-08**: `STCStateAdapter` bridges STC charts to smcraft state machine instances bidirectionally
- [ ] **A02-09**: Code generation uses real smcg codegen (not inline templates) — invoked via `generate_code(language)`
- [ ] **A02-10**: SMDF format supports: composite states, parallel regions, entry/exit actions, guard conditions, timer support, event dispatch

### Spec 03 — Graph Relational Substrate

- [ ] **A03-01**: KuzuDB stores exactly 10 node types: `Spec`, `Companion`, `Ceremony`, `Session`, `ActionStep`, `NarrativeBeat`, `Intent`, `StateMachine`, `State`, `Event`
- [ ] **A03-02**: KuzuDB stores exactly 11 edge types: `DEPENDS_ON`, `BELONGS_TO`, `SERVES_DIRECTION`, `AUTHORED_BY`, `GOVERNED_BY`, `TRANSITIONS_TO`, `CONTAINS`, `GENERATED_FROM`, `NARRATES`, `ACCOUNTABLE_TO`, `KIN_OF`
- [ ] **A03-03**: Every node and edge carries `OcapMetadata`: `ownership`, `control`, `access` (public|community|ceremony|sacred), `possession`
- [ ] **A03-04**: Sacred-level nodes are NEVER returned outside ceremony context (query-time filter)
- [ ] **A03-05**: KuzuDB database path is `~/.forgewright/graph.kuzu`
- [ ] **A03-06**: Indexes exist for: `session_id`, `direction`, `ceremony_phase`, `ocap_access`
- [ ] **A03-07**: Five ingest triggers: PDE pipeline Stage 4, smcraft creation/modification, ceremony-protocol open/advance/close, narrative-engine beat generation, KINSHIP.md parser
- [ ] **A03-08**: Export formats supported: Mermaid (with Four Directions positioning), Cypher, JSON-LD
- [ ] **A03-09**: Wilson alignment computable from graph edge density + OCAP compliance
- [ ] **A03-10**: Oscillation detection via cycle analysis in `ActionStep → DEPENDS_ON → ActionStep` paths

### Spec 04 — MCP Tool Surface

- [ ] **A04-01**: Single unified server named `forgewright-mcp` (not multiple separate servers)
- [ ] **A04-02**: 7 tool namespaces exist: `pde/`, `sm/`, `graph/`, `ceremony/`, `stc/`, `session/`, `pipeline/`
- [ ] **A04-03**: `pde/` namespace has 4 tools: `decompose`, `parse_response`, `to_plan`, `list`
- [ ] **A04-04**: `sm/` namespace has 12 tools: `create`, `from_plan`, `add_state`, `add_event`, `add_transition`, `remove_state`, `validate`, `generate_code`, `get_definition`, `load_definition`, `list_states`, `fire_event`, `current_state`
- [ ] **A04-05**: `graph/` namespace has 8 tools: `query`, `neighborhood`, `path`, `insert_node`, `insert_edge`, `wilson_score`, `accountability_audit`, `export_mermaid`
- [ ] **A04-06**: `ceremony/` namespace has 6 tools: `open`, `advance`, `close`, `current_phase`, `log_event`, `check_permission`
- [ ] **A04-07**: `stc/` namespace has 6 tools: `create`, `add_action_step`, `mark_complete`, `update_reality`, `telescope`, `list_active`
- [ ] **A04-08**: `session/` namespace has 5 tools: `create`, `resume`, `spiral_position`, `checkpoint`, `chronicle`
- [ ] **A04-09**: 3 compound pipelines exist: `pipeline/prompt_to_machine`, `pipeline/step_complete`, `pipeline/session_open`
- [ ] **A04-10**: Transport supports: stdio (local), HTTP POST `/mcp`, GET `/mcp/tools`, WebSocket `/mcp/events`
- [ ] **A04-11**: `sm/validate` returns validation errors V001–V014 (smcraft error range)
- [ ] **A04-12**: `graph/query` accepts raw Cypher string and returns OCAP-filtered results

### Spec 05 — Visual Designer

- [ ] **A05-01**: Two views share one canvas engine: State Machine View + Relational Graph View
- [ ] **A05-02**: `CanvasEngine` interface includes: `nodes`, `edges`, `viewport`, `mode` ('select'|'transition'|'pan'), `selection`
- [ ] **A05-03**: Composite drill-down works via `navigationPath: string[]` (breadcrumb) in Zustand store
- [ ] **A05-04**: `navigateInto(stateName)` triggered on double-click; `navigateUp()` on breadcrumb click
- [ ] **A05-05**: Canvas renders only `currentParent.states` (NOT `collectAllStates()`) — critical rendering constraint
- [ ] **A05-06**: Parallel regions rendered as side-by-side lanes within a state
- [ ] **A05-07**: Relational graph uses circular layout with nodes positioned by `direction` property (Four Directions)
- [ ] **A05-08**: Edges colored by type: kinship=blue, dependency=gray, accountability=gold
- [ ] **A05-09**: Live state indicator: current state = pulsing green border, completed = dimmed, next transitions = highlighted
- [ ] **A05-10**: Zustand store has undo/redo (50-deep history stack)
- [ ] **A05-11**: Layout algorithms: `hierarchical` (dagre) for state machines, `circular` for relational graphs, `force` available
- [ ] **A05-12**: MCP→Designer sync via WebSocket `GraphDelta` push; Designer→MCP sync via WebSocket `GraphDelta` emit
- [ ] **A05-13**: Generate button invokes real smcg codegen via API (not JSON export)
- [ ] **A05-14**: Code preview uses Monaco editor with syntax highlighting

### Spec 06 — Ceremonial Technology Runtime

- [ ] **A06-01**: Five ceremony phases enforced as runtime states: Preparation → Opening → Active → Integration → Closing
- [ ] **A06-02**: Phase 1 (Preparation): ONLY allows PDE decomposition, context loading, companion selection, intention declaration
- [ ] **A06-03**: Phase 2 (Opening): Agent permission level forced to Default Approvals (human approves each step)
- [ ] **A06-04**: Phase 3 (Active): Graph queries inject `ceremony_id` filter; exports check OCAP level
- [ ] **A06-05**: Phase 4 (Integration): No new ceremony can be opened (must close current first)
- [ ] **A06-06**: Phase 5 (Closing): Only acknowledgment logging + ceremony close allowed; no new action steps or code modification
- [ ] **A06-07**: `OcapGuard` interface has 3 methods: `filterQuery`, `checkFileAccess`, `checkToolPermission`
- [ ] **A06-08**: `AccessDecision` always logs `auditEntry` even for allowed access
- [ ] **A06-09**: 4 OCAP access levels: public, community, ceremony, sacred
- [ ] **A06-10**: Sacred-level access ALWAYS refused outside ceremony — system explicitly refuses extraction (ceremony-or-no-access)
- [ ] **A06-11**: Wilson alignment score < 0.3 triggers `ceremony_recommended` response
- [ ] **A06-12**: MCP middleware checks 4 conditions: active ceremony phase, tool allowed in phase, OCAP-restricted data, registered participant
- [ ] **A06-13**: Failed ceremony check returns `CeremonyViolation` with reason + guidance (not silent failure)
- [ ] **A06-14**: `computeWilsonAlignment` has 4 components: `relationalDensity`, `ocapCompliance`, `accountabilityChains`, `ceremonyParticipation`

### Spec 07 — Agentic Autonomous Development

- [ ] **A07-01**: 4 autonomy levels mapped to directions: Guided (EAST), Assisted (SOUTH), Autonomous (WEST), Autopilot (NORTH)
- [ ] **A07-02**: Opening phase ALWAYS requires human approval — no agent can bypass
- [ ] **A07-03**: Maximum 3 autonomous cycles before mandatory human checkpoint (`maxAutonomousCycles: 3`)
- [ ] **A07-04**: `SpiralTracker` interface has: `sessionId`, `currentDirection`, `cycleCount`, `maxCycles`, `checkpointPolicy`, `stateHistory`
- [ ] **A07-05**: `CheckpointPolicy` default: `mandatoryAt: ['north']`, `maxAutonomousCycles: 3`
- [ ] **A07-06**: 4 companions defined: Mia 🧠 (SOUTH+WEST), Miette 🌸 (NORTH), Ava 💕 (EAST+transitions), Tushell 🌊 (NORTH)
- [ ] **A07-07**: Oscillation detection: same state 3+ times → flag; phase retreat+advance → warn; net progress=0 over 10+ events → mandatory checkpoint
- [ ] **A07-08**: Multi-agent coordination via: shared state machine, shared KuzuDB graph, event pub/sub, ceremony protocol
- [ ] **A07-09**: Sacred knowledge NEVER extracted even in autopilot mode (OCAP-sacred refused regardless of autonomy level)
- [ ] **A07-10**: `SpiralTracker.detectOscillation()` returns `OscillationReport | null`

### Spec 08 — Medicine Wheel Integration

- [ ] **A08-01**: All 7 npm packages are dependencies: `medicine-wheel-{ontology-core, ceremony-protocol, narrative-engine, relational-query, graph-viz, prompt-decomposition, ui-components}` at `^0.1.0`
- [ ] **A08-02**: Direction constants EXACTLY match: East/Waaban/🌅, South/Zhaawan/🔥, West/Ningaabi/🌊, North/Giiwedin/❄️
- [ ] **A08-03**: Emoji–Ojibwe–Season pairing MUST NOT change: 🌅=Spring, 🔥=Summer, 🌊=Autumn, ❄️=Winter
- [ ] **A08-04**: `ontology-core` is consumed by ALL other specs as foundation types
- [ ] **A08-05**: UI components placed: `DirectionCard` in Chat pane, `BeatTimeline` in Preview, `NodeInspector` in Designer, `OcapBadge` everywhere, `WilsonMeter` in status bar, `SpiralIndicator` in status bar
- [ ] **A08-06**: Every user action passes through at least two medicine-wheel packages
- [ ] **A08-07**: Package→Direction mapping: ceremony-protocol=WEST, narrative-engine=SOUTH, relational-query=EAST, graph-viz=NORTH, prompt-decomposition=EAST, ui-components=BRIDGE
- [ ] **A08-08**: Act numbering fixed: East=1, South=2, West=3, North=4

---

## Cross-Reference Checks

> Specific references from KINSHIP.md and specs that must exist and remain consistent.

### Source Repository References

| Spec | Referenced Path | Must Contain |
|------|----------------|-------------|
| 00 | `workspace/rispecs/web-shell-architecture-spec.md` | Web shell master architecture |
| 00 | `mia-openclaw/rispecs/openclaw-as-foundation-spec.md` | Agentic runtime substrate |
| 00 | `workspace/rispecs/10-agentic-capabilities-spec.md` | VS Code 1.111 agent integration |
| 01 | `medicine-wheel/rispecs/prompt-decomposition-spec.md` | MedicineWheelDecomposer API |
| 01 | `rispecs/pde-four-directions-canonical-spec.md` | Canonical section ordering |
| 02 | `smcraft/rispecs/70-smdf-format-spec.md` | SMDF schema definition |
| 02 | `smcraft/rispecs/71-runtime-engine-spec.md` | Execution runtime |
| 02 | `smcraft/rispecs/72-code-generator-spec.md` | SMCG codegen |
| 03 | `medicine-wheel/rispecs/relational-query-spec.md` | Query builder, OCAP filtering, Cypher gen |
| 03 | `medicine-wheel/rispecs/graph-viz-spec.md` | Circular layout, Four Directions positioning |
| 03 | `medicine-wheel/rispecs/ontology-core-spec.md` | Types, schemas, RDF vocabulary |
| 04 | `smcraft/rispecs/73-mcp-server-spec.md` | smcraft MCP tools |
| 04 | `coaia-narrative/rispecs/mcp-tool-interface-spec.md` | coaia MCP tools |
| 05 | `smcraft/rispecs/74-web-designer-spec.md` | Web designer architecture |
| 06 | `medicine-wheel/rispecs/ceremony-protocol-spec.md` | Phase transitions, governance |
| 06 | `Etuaptmumk-RSM/rispecs/ceremonial-technology-kin.md` | Kinship web: why phases matter |
| 06 | `Etuaptmumk-RSM/rispecs/ceremonial-technology.spec.md` | v2.0 decolonized spec |
| 07 | `mia-openclaw/rispecs/human-consultation-in-autonomous-development.spec.md` | Pause patterns |
| 08 | `medicine-wheel/rispecs/medicine-wheel-spec.md` | System spec (all 7 packages) |

### Internal Cross-Spec Consistency

| Check ID | What Must Be Consistent | Specs Involved |
|----------|------------------------|----------------|
| XR-01 | `StructuredPlan.smdfSeed` type in spec 01 MUST match `StateMachineDefinition` type consumed by spec 02 | 01 ↔ 02 |
| XR-02 | `RelationalNode[]` output from PDE (spec 01) MUST match node schema in KuzuDB (spec 03) | 01 ↔ 03 |
| XR-03 | `CeremonyGuidance` from PDE stage 3 (spec 01) MUST match what ceremony runtime consumes (spec 06) | 01 ↔ 06 |
| XR-04 | `sm/*` tool parameters in spec 04 MUST match smcraft API in spec 02 | 02 ↔ 04 |
| XR-05 | `graph/*` tool parameters in spec 04 MUST match KuzuDB schema in spec 03 | 03 ↔ 04 |
| XR-06 | `ceremony/*` tool parameters in spec 04 MUST match ceremony-protocol API in spec 06 | 04 ↔ 06 |
| XR-07 | `GraphDelta` type used in MCP↔Designer sync (spec 05) MUST match delta format in MCP server (spec 04) | 04 ↔ 05 |
| XR-08 | Five ceremony phases in spec 06 MUST match phase names in `ceremony/advance` tool (spec 04) | 04 ↔ 06 |
| XR-09 | Autonomy levels in spec 07 MUST map to ceremony phases in spec 06 (Guided→Opening, Assisted→Active, etc.) | 06 ↔ 07 |
| XR-10 | Direction constants in spec 08 `DIRECTIONS` MUST be the sole source; all other specs reference, never redefine | 08 → ALL |
| XR-11 | OCAP access levels in spec 03 (`OcapMetadata.access`) MUST match levels in spec 06 (`AccessDecision.ocapLevel`) | 03 ↔ 06 |
| XR-12 | `OscillationDetector` in spec 02 and oscillation detection in spec 07 MUST use same threshold (3+ visits) | 02 ↔ 07 |
| XR-13 | `pipeline/session_open` (spec 04) MUST chain: `session/create` → `ceremony/open` → `pde/decompose` → `sm/from_plan` | 04 chains 01+02+06 |
| XR-14 | Node type `StateMachine` in spec 03 MUST have property `currentState` matching `WorkspaceStateMachine.currentState` in spec 02 | 02 ↔ 03 |

---

## API Contract Compliance

### TypeScript Interfaces That Must Match Across Specs

#### `StructuredPlan` (spec 01 defines, specs 02/03/04 consume)
```typescript
interface StructuredPlan {
  decomposition: OntologicalDecomposition;
  smdfSeed: StateMachineDefinition;      // → spec 02
  graphNodes: RelationalNode[];           // → spec 03
  narrativeBeats: NarrativeBeat[];        // → narrative-engine
  ceremonyGuidance: CeremonyGuidance | null;  // → spec 06
  pipelineVersion: string;
}
```

#### `WorkspaceStateMachine` (spec 02 defines, specs 04/05/07 consume)
```typescript
interface WorkspaceStateMachine {
  workspaceId: string;
  definition: StateMachineDefinition;
  currentState: string;
  stcChartId: string;
  tensionLevel: number;
  eventHistory: StateMachineEvent[];
  oscillationDetector: OscillationDetector;
}
```

#### `OcapMetadata` (spec 03 defines, specs 06/04 consume)
```typescript
interface OcapMetadata {
  ownership: string;
  control: string;
  access: 'public' | 'community' | 'ceremony' | 'sacred';
  possession: string;
}
```

#### `OcapGuard` (spec 06 defines, spec 04 MCP middleware consumes)
```typescript
interface OcapGuard {
  filterQuery(cypher: string, context: CeremonyContext): FilteredQuery;
  checkFileAccess(path: string, context: CeremonyContext): AccessDecision;
  checkToolPermission(tool: string, context: CeremonyContext): PermissionDecision;
}
```

#### `AccessDecision` (spec 06 defines, spec 04 middleware returns)
```typescript
interface AccessDecision {
  allowed: boolean;
  reason: string;
  ocapLevel: 'public' | 'community' | 'ceremony' | 'sacred';
  auditEntry: AuditRecord;
}
```

#### `CanvasEngine` (spec 05 defines, spec 04 sync consumes)
```typescript
interface CanvasEngine {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  mode: 'select' | 'transition' | 'pan';
  selection: string | null;
  render(): SVGElement;
  autoLayout(algorithm: 'hierarchical' | 'circular' | 'force'): void;
  applyDelta(delta: GraphDelta): void;    // FROM MCP
  emitDelta(): GraphDelta;                 // TO MCP
}
```

#### `SpiralTracker` (spec 07 defines, specs 04/02 consume)
```typescript
interface SpiralTracker {
  sessionId: string;
  currentDirection: DirectionName;
  cycleCount: number;
  maxCycles: number;              // default: 3
  checkpointPolicy: CheckpointPolicy;
  stateHistory: DirectionEntry[];
  isAtCheckpoint(): boolean;
  nextDirection(): DirectionName;
  advanceDirection(): void;
  completeCycle(): void;
  detectOscillation(): OscillationReport | null;
}
```

#### `CheckpointPolicy` (spec 07 defines)
```typescript
interface CheckpointPolicy {
  type: 'per-direction' | 'per-cycle' | 'task-complete';
  mandatoryAt: DirectionName[];    // default: ['north']
  maxAutonomousCycles: number;     // default: 3
}
```

#### `DIRECTIONS` constant (spec 08 defines, ALL specs consume)
```typescript
const DIRECTIONS = {
  east:  { name: 'East',  ojibwe: 'Waaban',   season: 'Spring', act: 1, emoji: '🌅' },
  south: { name: 'South', ojibwe: 'Zhaawan',  season: 'Summer', act: 2, emoji: '🔥' },
  west:  { name: 'West',  ojibwe: 'Ningaabi', season: 'Autumn', act: 3, emoji: '🌊' },
  north: { name: 'North', ojibwe: 'Giiwedin', season: 'Winter', act: 4, emoji: '❄️' },
} as const;
```

### MCP Tool Signatures (spec 04 — must match domain engine APIs)

| Tool | Required Parameters | Return Type | Domain Engine |
|------|-------------------|-------------|---------------|
| `pde/decompose` | `prompt: string` | `{ systemPrompt, userMessage }` | mcp-pde |
| `pde/parse_response` | `llm_response: string, original_prompt: string` | `StoredDecomposition` | mcp-pde |
| `pde/to_plan` | `decomposition_id: string` | `StructuredPlan` | NEW pipeline |
| `sm/create` | `namespace: string, name: string` | `StateMachineDefinition` | smcraft |
| `sm/from_plan` | `plan_id: string` | `StateMachineDefinition` | NEW bridge |
| `sm/fire_event` | `event_id: string, data?: any` | `{ currentState: string }` | smcraft runtime |
| `sm/generate_code` | `language: 'python' \| 'typescript'` | `string` (generated code) | smcg codegen |
| `graph/query` | `cypher: string` | OCAP-filtered results | KuzuDB via relational-query |
| `graph/wilson_score` | `scope: 'session' \| 'spec' \| 'companion'` | `WilsonScore` | ontology-core |
| `ceremony/open` | `type: string, participants: string[], intention: string` | `{ ceremonyId, phase: 'preparation' }` | ceremony-protocol |
| `ceremony/check_permission` | `ceremony_id: string, operation: string` | `{ allowed: boolean, reason: string }` | ceremony-protocol |
| `stc/create` | `desired_outcome: string, current_reality: string` | `{ chartId, event: 'tension_established' }` | coaia-narrative |
| `session/create` | `intent: string, companions?: string[]` | `{ sessionId }` + PDE auto-triggered | NEW orchestration |
| `pipeline/session_open` | (compound) | chains: session→ceremony→PDE→SM | NEW pipeline |
| `pipeline/step_complete` | (compound) | chains: STC mark→SM event→beat→graph | NEW pipeline |

---

## Non-Negotiable Constraints

> These MUST NOT be relaxed, negotiated, or conditionally bypassed.

### From Spec 06 — Ceremonial Technology Runtime

| ID | Constraint | Enforcement Point |
|----|-----------|-------------------|
| **NN-01** | **Ceremony-or-no-access**: Sacred-level nodes NEVER returned outside ceremony context | `OcapGuard.filterQuery()` — query-time, database-level |
| **NN-02** | **OCAP sacred never extracted**: System explicitly REFUSES extraction of ceremony-level knowledge to external systems | `OcapGuard.checkFileAccess()` + export guards |
| **NN-03** | **Audit always logged**: `AccessDecision.auditEntry` logged even for ALLOWED access | Every `OcapGuard` method |
| **NN-04** | **Phase 1 restriction**: Code execution, file modification, autonomous agent action BLOCKED in Preparation phase | MCP middleware tool whitelist |
| **NN-05** | **Phase 2 Default Approvals**: Opening phase forces human approval per step — structurally, not by policy | MCP middleware permission override |
| **NN-06** | **No concurrent ceremonies**: Integration phase blocks new ceremony opening | ceremony-protocol state machine |
| **NN-07** | **CeremonyViolation returned, not silent fail**: Failed checks return structured error with reason + guidance | MCP middleware response |

### From Spec 07 — Agentic Autonomous Development

| ID | Constraint | Enforcement Point |
|----|-----------|-------------------|
| **NN-08** | **Max 3 autonomous cycles**: Then mandatory stop regardless of policy | `SpiralTracker.maxCycles` hard cap |
| **NN-09** | **Opening ALWAYS human-approved**: No agent can bypass Opening ceremony phase | `CheckpointPolicy` + ceremony middleware |
| **NN-10** | **Checkpoint at every cycle completion**: Human sees full spiral before next cycle begins | `SpiralTracker.completeCycle()` → checkpoint |
| **NN-11** | **Oscillation escalation**: Stuck patterns ALWAYS surface to human, never auto-resolved | `OscillationDetector` → mandatory human review |
| **NN-12** | **Sacred knowledge never extracted in autopilot**: OCAP-sacred refused regardless of autonomy level | `OcapGuard` overrides autopilot permission |

### From Spec 08 — Medicine Wheel Integration

| ID | Constraint | Enforcement Point |
|----|-----------|-------------------|
| **NN-13** | **Direction emoji/Ojibwe pairing MUST NOT change**: 🌅=East/Waaban, 🔥=South/Zhaawan, 🌊=West/Ningaabi, ❄️=North/Giiwedin | `DIRECTIONS` constant in `ontology-core` |
| **NN-14** | **Season pairing fixed**: 🌅=Spring, 🔥=Summer, 🌊=Autumn, ❄️=Winter | `DIRECTIONS` constant |
| **NN-15** | **Act numbering fixed**: East=1, South=2, West=3, North=4 | `DIRECTIONS` constant |
| **NN-16** | **Implementations MUST NOT use alternative emojis, reorder directions, or omit Ojibwe names** | Code review + validation agent |

### From Spec 01 — PDE Pipeline

| ID | Constraint | Enforcement Point |
|----|-----------|-------------------|
| **NN-17** | **Four Directions rendered FIRST**: If `## Primary Intent` appears before `## Four Directions`, the implementation is non-compliant | PDE output formatter |

### From Spec 05 — Visual Designer

| ID | Constraint | Enforcement Point |
|----|-----------|-------------------|
| **NN-18** | **Canvas renders only `currentParent.states`**: MUST NOT call `collectAllStates()` for rendering | `CanvasEngine.render()` implementation |

---

## Risk Zones

> What is most likely to go wrong during 30+ agent parallel execution.

### 🔴 CRITICAL RISK — Data Race / Consistency

| Risk ID | Description | Specs Affected | Mitigation |
|---------|-------------|---------------|------------|
| **RZ-01** | **KuzuDB concurrent writes**: 30+ agents writing nodes/edges simultaneously could cause graph corruption or lost writes | 03, 04, 07 | KuzuDB transaction isolation must be verified; consider write serialization or optimistic concurrency |
| **RZ-02** | **State machine race condition**: Multiple agents firing events on same `WorkspaceStateMachine` could cause invalid state transitions | 02, 04, 07 | Event queue serialization per workspace; state machine lock or CAS (compare-and-swap) |
| **RZ-03** | **Ceremony phase drift**: If one agent advances ceremony phase while another is mid-operation in previous phase, the second agent's tool calls could be rejected unexpectedly | 06, 04, 07 | Phase change must broadcast and wait for in-flight operations to complete |
| **RZ-04** | **WebSocket delta conflicts**: Designer and MCP tool calls modifying same SMDF definition simultaneously produce conflicting `GraphDelta` messages | 04, 05 | Operational transform or CRDT for SMDF; or single-writer lock |
| **RZ-05** | **Redis session cache staleness**: Pub/sub message ordering not guaranteed under high agent load; stale session state could cause wrong ceremony context | 00, 06 | Use Redis Streams (ordered) instead of pub/sub for ceremony state; or verify phase before every tool call |

### 🟡 HIGH RISK — Integration Boundary

| Risk ID | Description | Specs Affected | Mitigation |
|---------|-------------|---------------|------------|
| **RZ-06** | **PDE→SMDF type mismatch**: `SMDFSeed` output from PDE pipeline may not match `StateMachineDefinition` schema expected by smcraft | 01, 02 | Shared Zod schema + runtime validation at boundary |
| **RZ-07** | **Graph node schema drift**: If `RelationalNode[]` from PDE doesn't match KuzuDB node table schema, inserts silently fail or corrupt | 01, 03 | Zod validation before KuzuDB insert; schema migration guard |
| **RZ-08** | **MCP tool namespace collision**: If smcraft MCP and coaia MCP tools share names before unification, agents may call wrong implementation | 04 | Strict namespace prefixing (sm/, stc/, pde/) enforced at registration |
| **RZ-09** | **Compound pipeline partial failure**: `pipeline/session_open` chains 4 operations — if ceremony/open succeeds but sm/from_plan fails, system in inconsistent state | 04 | Saga pattern with compensation: if later step fails, roll back earlier steps |
| **RZ-10** | **Seven medicine-wheel package version skew**: If packages update independently, type incompatibilities emerge at runtime | 08 | Pin all 7 packages to same minor version; integration test across all |

### 🟠 MEDIUM RISK — Governance Bypass

| Risk ID | Description | Specs Affected | Mitigation |
|---------|-------------|---------------|------------|
| **RZ-11** | **Ceremony middleware bypass via direct KuzuDB access**: If an agent queries KuzuDB directly (not through `graph/*` MCP tools), OCAP filtering is skipped | 03, 06 | KuzuDB must be accessed ONLY through MCP graph tools; no raw connection exposed |
| **RZ-12** | **Agent ignoring checkpoint**: If `SpiralTracker` checkpoint is advisory (not enforced), agents may continue past max 3 cycles | 07 | MCP middleware must check `cycleCount >= maxCycles` before allowing any tool call |
| **RZ-13** | **Oscillation false positive**: Under parallel agent execution, event history may show "cycles" that are actually parallel work, not oscillation | 02, 07 | Oscillation detection must be per-agent, not per-shared-state-machine |

### 🔵 LOW RISK — UX / Rendering

| Risk ID | Description | Specs Affected | Mitigation |
|---------|-------------|---------------|------------|
| **RZ-14** | **Direction emoji rendering in terminal**: Some terminals may not render 🌅🔥🌊❄️ correctly, breaking PDE output parsing | 01, 08 | Always include text fallback alongside emoji; parse by text, not emoji |
| **RZ-15** | **Composite drill-down breadcrumb depth**: Deeply nested state machines (5+ levels) may break breadcrumb UI | 05 | Set max drill-down depth; truncate breadcrumb with "..." |
| **RZ-16** | **Monaco editor bundle size**: Including Monaco for code preview adds significant JS weight to web shell | 05, 00 | Lazy-load Monaco only when code preview pane is opened |

---

## Validation Agent Assignment

> Suggested split for 5 parallel validation agents.

| Agent | Scope | Assertions | Risks |
|-------|-------|-----------|-------|
| **V-Agent 1: PDE + Pipeline** | Specs 00, 01 | A00-*, A01-* | RZ-06, RZ-07, RZ-14 |
| **V-Agent 2: State Machine + STC** | Specs 02, 05 | A02-*, A05-* | RZ-02, RZ-04, RZ-15 |
| **V-Agent 3: Graph + OCAP** | Specs 03, 06 | A03-*, A06-* | RZ-01, RZ-03, RZ-11 |
| **V-Agent 4: MCP + Integration** | Specs 04, 08 | A04-*, A08-*, XR-* | RZ-05, RZ-08, RZ-09, RZ-10 |
| **V-Agent 5: Agentic + Governance** | Specs 07, NN-* | A07-*, NN-* | RZ-12, RZ-13 |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total testable assertions | 96 |
| Cross-reference checks | 14 |
| API contract interfaces | 9 |
| MCP tool signatures | 15 |
| Non-negotiable constraints | 18 |
| Risk zones | 16 |
| Integration matrix edges | 20 |
| Validation agents | 5 |
