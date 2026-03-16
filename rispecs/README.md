# RISE Specifications — Forgewright

> The forge that builds the forge — an agentic development platform where creative process IS state machine execution, governed by ceremonial technology.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## What Forgewright Is

A **graph-based agentic development platform** that transforms how software is created:

1. **Prompt Decomposition** (PDE) opens every session as ceremony — raw intent becomes structured, relationally accountable work plans mapped to Four Directions
2. **State Machine Engine** (smcraft) makes the creative process executable — structural tension IS disequilibrium energy driving state transitions
3. **Graph Substrate** (KuzuDB + relational webs) holds the kinship network — specs, companions, ceremonies, accountability all exist as traversable graph
4. **MCP Tool Surface** exposes everything to AI agents — state machines designed conversationally, graphs traversed with ceremony governance
5. **Visual Designer** enables human + AI co-design — both point-and-click and LLM tool calls operate the same canvas
6. **Ceremonial Technology Runtime** governs all autonomous action — agents cannot bypass ceremony opening, extraction is structurally impossible
7. **Agentic Development** with human-in-the-loop — autonomous spirals (E→S→W→N) with mandatory checkpoints

## Ancestry

Forgewright consumes and integrates specifications from:

| Source | Specs Consumed | What It Provides |
|--------|---------------|-----------------|
| `jgwill/smcraft` | 70–74 (SMDF, runtime, codegen, MCP, designer) | State machine engine |
| `jgwill/medicine-wheel` | 7 packages (ontology, ceremony, narrative, query, viz, PDE, UI) | Ceremonial infrastructure |
| `miadisabelle/mia-code-server` | 71 specs across 9 modules | Technical specification layer |
| `miadisabelle/mia-openclaw` | OpenClaw as foundation spec | Agentic runtime substrate |
| `jgwill/workspace` | Platform rispecs 00–10 | Web shell architecture |
| `narintel/rispecs/llms` | STC-state-machine, creative-orientation, PDE | LLM comprehension layer |

## Spec Index

| # | Spec | Focus |
|---|------|-------|
| 00 | [platform-architecture.spec.md](./00-platform-architecture.spec.md) | Master architecture: layers, data flow, deployment |
| 01 | [pde-to-plan-pipeline.spec.md](./01-pde-to-plan-pipeline.spec.md) | Prompt → Four Directions → structured plan → action stack |
| 02 | [state-machine-creative-engine.spec.md](./02-state-machine-creative-engine.spec.md) | smcraft as creative process runtime, STC = state machine |
| 03 | [graph-relational-substrate.spec.md](./03-graph-relational-substrate.spec.md) | KuzuDB, relational webs, OCAP-filtered traversal |
| 04 | [mcp-tool-surface.spec.md](./04-mcp-tool-surface.spec.md) | Unified MCP server: state machines + graphs + PDE + ceremony |
| 05 | [visual-designer.spec.md](./05-visual-designer.spec.md) | Web-based co-design surface for state machines + relational graphs |
| 06 | [ceremonial-technology-runtime.spec.md](./06-ceremonial-technology-runtime.spec.md) | Five phases, ceremony-protocol governance, OCAP enforcement |
| 07 | [agentic-autonomous-development.spec.md](./07-agentic-autonomous-development.spec.md) | Human-in-the-loop agent autonomy, spiral checkpoints |
| 08 | [medicine-wheel-integration.spec.md](./08-medicine-wheel-integration.spec.md) | Four Directions as platform architecture, package wiring |
| — | [KINSHIP.md](./KINSHIP.md) | Relational map to all consumed specifications |

## Dependency Direction

```
Forgewright (this repo — the platform)
  ├── consumes: smcraft (state machine engine)
  ├── consumes: medicine-wheel (7 npm packages)
  ├── consumes: mcp-pde (prompt decomposition)
  ├── consumes: coaia-narrative (STC management)
  ├── inherits: mia-code-server rispecs (technical layer)
  ├── inherits: mia-openclaw (agentic runtime)
  └── integrates: narintel/llms (comprehension layer)
```

The consumed layers are NOT aware of this consumer.
