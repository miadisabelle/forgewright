# CLAUDE.md — Forgewright

> The forge that builds the forge.

## What This Repo Is

**Forgewright** is a graph-based agentic development platform — the unified runtime that wires together smcraft (state machines), medicine-wheel (7 packages), mcp-pde (decomposition), coaia-narrative (STC management), and mia-openclaw (agent runtime) into a single deployable platform.

## Rispecs

9 RISE specifications in `./rispecs/`:

| # | Spec | One-line |
|---|------|---------|
| 00 | platform-architecture | Master architecture: 5 layers, data flow, deployment topology |
| 01 | pde-to-plan-pipeline | Prompt → Four Directions → structured plan → SMDF seed |
| 02 | state-machine-creative-engine | STC = state machine, creative process as SMDF runtime |
| 03 | graph-relational-substrate | KuzuDB graph, OCAP enforcement, Wilson scoring |
| 04 | mcp-tool-surface | Unified MCP server: sm/ + pde/ + graph/ + ceremony/ + stc/ + session/ |
| 05 | visual-designer | SVG canvas: state machines + relational graphs, MCP↔designer sync |
| 06 | ceremonial-technology-runtime | Five phases as code, OCAP middleware, ceremony-or-no-access |
| 07 | agentic-autonomous-development | Spiral autonomy, directional permissions, checkpoint policy |
| 08 | medicine-wheel-integration | 7 npm packages wired as platform infrastructure |

## For Cloud Agents

This repo is designed as a **payload** for cloud agents to build from. The rispecs contain:
- Desired outcomes (what to build)
- Structural tension (current reality vs desired state)
- Component APIs and type definitions
- Integration points between specs
- Technology choices
- Ancestry and references to source specifications

Start at `rispecs/README.md` → read `rispecs/KINSHIP.md` → then specs 00–08 in order.

## Key Principles

- **Four Directions rendered FIRST** — relational knowing before reductive extraction
- **STC = State Machine** — not metaphor, structural equivalence
- **Ceremony is governance** — enforced by middleware, not by suggestion
- **Human sovereignty** — max 3 autonomous cycles, mandatory checkpoints, Opening always guided
- **OCAP everywhere** — sacred knowledge NEVER extracted outside ceremony context
