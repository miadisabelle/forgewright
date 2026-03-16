# 04 — MCP Tool Surface

> One unified MCP server. State machines + graphs + PDE + ceremony — all manipulable by any AI agent through structured tool calls.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

A single MCP server (`forgewright-mcp`) exposes the full platform capability to AI agents:
- **State machine tools**: create, modify, validate, generate code (from smcraft)
- **PDE tools**: decompose prompts, parse responses, store results
- **Graph tools**: query relational web, insert nodes, traverse with OCAP
- **Ceremony tools**: open/advance/close ceremonies, check phase, log events
- **STC tools**: create charts, manage action steps, mark complete, telescope
- **Designer sync tools**: push/pull state between visual designer and MCP
- **Session tools**: create/resume sessions, track spiral position, checkpoint

Agents connect via stdio (local) or HTTP (remote). The same server serves Claude Code, VS Code extensions, web shell chat, and cloud agents consuming the rispecs payload.

## Structural Tension

**Current Reality**: MCP tools are scattered across separate servers — smcraft MCP (state machines), coaia-narrative MCP (STC/narrative), mcp-pde (decomposition). Each has its own connection, its own in-memory state. No cross-domain operations (e.g., "decompose this prompt AND instantiate a state machine from it").

**Desired State**: Unified server with namespaced tools. Cross-domain pipelines exposed as compound tools. Shared session context across all tool families.

---

## Tool Registry

### PDE Tools (namespace: `pde/`)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `pde/decompose` | prompt: string | systemPrompt + userMessage for LLM processing |
| `pde/parse_response` | llm_response, original_prompt | StoredDecomposition (auto-saves to .pde/) |
| `pde/to_plan` | decomposition_id | StructuredPlan (action stack + SMDF seed + graph nodes) |
| `pde/list` | workdir? | Array of stored decompositions |

### State Machine Tools (namespace: `sm/`)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `sm/create` | namespace, name | Empty SMDF definition with Root state |
| `sm/from_plan` | plan_id | SMDF definition seeded from PDE structured plan |
| `sm/add_state` | name, parentName?, kind? | Updated definition |
| `sm/add_event` | id, sourceName?, parameters? | Updated definition |
| `sm/add_transition` | stateName, event, nextState, condition?, action? | Updated definition |
| `sm/remove_state` | name | Updated definition |
| `sm/validate` | — | Validation errors (V001–V014) |
| `sm/generate_code` | language: python\|typescript | Generated executable code |
| `sm/get_definition` | — | Current SMDF JSON |
| `sm/load_definition` | json | Loaded definition |
| `sm/list_states` | — | Tree view with transitions |
| `sm/fire_event` | event_id, data? | New current state after transition |
| `sm/current_state` | — | Current state path + tension level |

### Graph Tools (namespace: `graph/`)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `graph/query` | cypher: string | Query results (OCAP-filtered) |
| `graph/neighborhood` | node_id, hops? | Neighbor nodes + edges |
| `graph/path` | from_id, to_id | Shortest path with edge labels |
| `graph/insert_node` | label, properties | Created node ID |
| `graph/insert_edge` | from_id, to_id, label, properties | Created edge ID |
| `graph/wilson_score` | scope: session\|spec\|companion | Wilson alignment score (0–1) |
| `graph/accountability_audit` | node_id | Accountability chain |
| `graph/export_mermaid` | scope?, directions? | Mermaid diagram string |

### Ceremony Tools (namespace: `ceremony/`)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `ceremony/open` | type, participants, intention | Ceremony ID + phase: preparation |
| `ceremony/advance` | ceremony_id | Next phase (preparation→opening→active→integration→closing) |
| `ceremony/close` | ceremony_id, acknowledgments | Closed ceremony record |
| `ceremony/current_phase` | ceremony_id | Current phase + allowed operations |
| `ceremony/log_event` | ceremony_id, event_type, content | Logged event |
| `ceremony/check_permission` | ceremony_id, operation | Allowed: boolean + reason |

### STC Tools (namespace: `stc/`)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `stc/create` | desired_outcome, current_reality | Chart ID + tension_established event |
| `stc/add_action_step` | chart_id, description, direction? | Step ID + state added to machine |
| `stc/mark_complete` | chart_id, step_id | action_step_completed event fired |
| `stc/update_reality` | chart_id, new_reality | reality_updated event, guards re-evaluated |
| `stc/telescope` | chart_id, step_id | Sub-chart created (composite state expanded) |
| `stc/list_active` | — | Active charts with current state |

### Session Tools (namespace: `session/`)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `session/create` | intent, companions? | Session ID + PDE auto-triggered |
| `session/resume` | session_id | Restored session context |
| `session/spiral_position` | session_id | Current direction (E/S/W/N) + cycle count |
| `session/checkpoint` | session_id | Human review triggered, agent pauses |
| `session/chronicle` | session_id | Narrative chronicle of session |

## Compound Pipelines

Cross-domain tools that chain operations:

| Pipeline | Steps | One Tool Call |
|----------|-------|--------------|
| `pipeline/prompt_to_machine` | decompose → plan → create state machine | Yes |
| `pipeline/step_complete` | mark STC step → fire SM event → generate beat → update graph | Yes |
| `pipeline/session_open` | create session → open ceremony → decompose intent → instantiate machine | Yes |

## Transport

```
stdio   — local CLI agents (Claude Code, terminal)
HTTP    — remote agents, web shell, cloud build agents
  POST /mcp          — tool call
  GET  /mcp/tools    — tool discovery
  WS   /mcp/events   — real-time state machine events
```

## References

- `smcraft/rispecs/73-mcp-server-spec.md` — smcraft MCP tools
- `coaia-narrative/rispecs/mcp-tool-interface-spec.md` — coaia MCP tools
- `mia-code-server/rispecs/mia-server-core/09-mcp-server-integration.spec.md` — MCP proxy
