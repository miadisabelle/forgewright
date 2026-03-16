# 00 — Platform Architecture

> Forgewright: a graph-based agentic development platform where the creative process is executable, ceremony-governed, and human-sovereign.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

A deployed web platform where:
- Every development session begins with PDE decomposition (East ceremony opening)
- The creative process executes as a hierarchical state machine (smcraft SMDF)
- All entities (specs, companions, ceremonies, action steps) exist in a traversable relational graph (KuzuDB)
- AI agents operate autonomously within ceremony-governed permission boundaries
- Humans retain sovereignty via spiral checkpoints and directional permission mapping
- A unified MCP server exposes state machines, graphs, PDE, and ceremony to any AI agent
- A visual designer enables human + AI co-design of state machines and relational webs

## Structural Tension

**Current Reality**: The specifications exist across 6+ repositories (smcraft, medicine-wheel, mia-code-server, mia-openclaw, coaia-narrative, narintel/llms). Each is functional independently. No unified runtime integrates them into a single platform experience.

**Desired State**: One platform that wires these layers together — PDE feeds structured plans into state machines, state machines execute within ceremony governance, ceremony governance is auditable via relational graph, the graph is designable via visual tools, and agents operate all of it through MCP.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: Product Shell (Browser)                           │
│  Three-pane UI: Chat + Editor + Preview                     │
│  Companion switcher, project binding, pane state            │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4: Visual Designer (Next.js + React + SVG)           │
│  State machine canvas, relational graph view, drill-down    │
│  Human point-and-click + LLM MCP tool manipulation          │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: MCP Tool Surface (unified server)                 │
│  smcraft tools + coaia tools + PDE tools + ceremony tools   │
│  Graph query tools + designer sync tools                    │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: Domain Engines                                    │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────────┐  │
│  │ smcraft   │ │ medicine-    │ │ coaia-narrative        │  │
│  │ SMDF +    │ │ wheel        │ │ STC management         │  │
│  │ runtime + │ │ 7 packages   │ │ narrative beats        │  │
│  │ codegen   │ │              │ │ Langfuse tracing       │  │
│  └──────────┘ └──────────────┘ └────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: Data Substrate                                    │
│  KuzuDB (graph) + SQLite (local) + Redis (session)          │
│  .pde/ (decompositions) + .smdf.json (state machines)       │
│  .coaia/ (STC charts) + .ceremony/ (ceremony logs)          │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow: Session Lifecycle

```
Human Intent (raw prompt)
    │
    ▼
┌─ PDE Decomposition (EAST) ──────────────────────────┐
│  Four Directions rendered FIRST                      │
│  Implicit intents surfaced from hedging language     │
│  Action stack ordered by direction flow              │
│  Balance scored → ceremony recommended if < 0.3      │
│  Output: .pde/{id}.json + .pde/{id}.md              │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ State Machine Instantiation ────────────────────────┐
│  PDE action stack → SMDF definition                  │
│  Each action step = state with transitions           │
│  Phases = composite states (Germ → Assim → Comp)     │
│  Structural tension = disequilibrium energy          │
│  Output: .smdf.json (workspace state machine)        │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Ceremony Governance ────────────────────────────────┐
│  Five phases: Preparation → Opening → Active →       │
│               Integration → Closing                  │
│  ceremony-protocol enforces transitions              │
│  OCAP at every layer                                 │
│  Opening phase = Default Approvals (human approval)  │
│  Council/Integration = Autopilot eligible            │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Agent Execution (spiral) ───────────────────────────┐
│  🌅 EAST: Decompose + plan (human approves)          │
│  🔥 SOUTH: Learn target, grow specs                  │
│  🌊 WEST: Implement with accountability              │
│  ❄️ NORTH: Integrate, chronicle, archive             │
│  → Checkpoint: human review before next spiral       │
│  → Max 3 cycles before mandatory stop                │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Graph Persistence ──────────────────────────────────┐
│  Session entities → KuzuDB nodes + edges             │
│  Narrative beats → graph-viz circular layout          │
│  Ceremony logs → auditable relational trail          │
│  KINSHIP.md → graph traversal entry points           │
└──────────────────────────────────────────────────────┘
```

## Deployment Topology

```
┌─ Browser ────────────────────────────────────────────┐
│  Forgewright Web Shell (Next.js SSR)                 │
│  ├── Chat pane (companion interaction)               │
│  ├── Editor pane (code-server iframe)                │
│  └── Preview pane (state machine designer / graph)   │
└──────────────────────┬───────────────────────────────┘
                       │ WebSocket + REST
                       ▼
┌─ Server ─────────────────────────────────────────────┐
│  Node.js runtime                                     │
│  ├── MCP unified server (stdio + HTTP)               │
│  ├── smcraft runtime (state machine execution)       │
│  ├── ceremony-protocol (phase governance)            │
│  ├── PDE engine (decomposition)                      │
│  └── API routes (REST + WebSocket)                   │
├──────────────────────────────────────────────────────┤
│  Data                                                │
│  ├── KuzuDB (relational graph)                       │
│  ├── SQLite (QMD index, local state)                 │
│  ├── Redis (session cache, pub/sub)                  │
│  └── Filesystem (.pde/, .smdf.json, .coaia/)         │
└──────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 15 + React 19 + Zustand | SSR, state management, component model |
| Canvas | SVG + custom React components | State machine + graph visualization |
| Backend | Node.js + Bun | Runtime for MCP server + domain engines |
| State Machines | smcraft (TypeScript) | SMDF format, runtime, codegen, validation |
| Graph DB | KuzuDB | Embedded graph database, Cypher queries, OCAP-filterable |
| Cache | Redis | Session state, pub/sub for real-time updates |
| Search | QMD (SQLite FTS5 + sqlite-vec) | Specification search across collections |
| Tracing | Langfuse | Session observability, narrative beat traces |
| MCP | MCP SDK (TypeScript) | Tool surface for AI agents |
| Embeddings | node-llama-cpp | Local embeddings + reranking |

## References

- `workspace/rispecs/web-shell-architecture-spec.md` — Web shell master architecture
- `mia-openclaw/rispecs/openclaw-as-foundation-spec.md` — Agentic runtime substrate
- `workspace/rispecs/10-agentic-capabilities-spec.md` — VS Code 1.111 agent integration
- `workspace/JGWILL.md` — Workspace orchestration and circular development model
