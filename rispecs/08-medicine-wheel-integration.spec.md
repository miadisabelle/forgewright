# 08 — Medicine Wheel Integration

> The Four Directions are not decoration. They are the platform's cognitive architecture — every decomposition, every state machine, every graph query, every ceremony phase moves through East → South → West → North.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

The Medicine Wheel Developer Suite (7 npm packages) is wired into Forgewright as operational infrastructure, not thematic overlay:
- `ontology-core` provides types, schemas, and vocabulary for every domain object
- `ceremony-protocol` governs all session lifecycle transitions
- `narrative-engine` tracks story beats across every spiral cycle
- `relational-query` powers all graph traversal with OCAP awareness
- `graph-viz` renders relational webs in Four Directions circular layout
- `prompt-decomposition` opens every session as EAST ceremony
- `ui-components` provides the React component library for the web shell

## Structural Tension

**Current Reality**: Seven packages published on npm, each functional independently. Integration examples exist in rispecs but no single runtime consumes all seven as a coherent whole.

**Desired State**: Forgewright IS the runtime that proves these seven packages work as a system. Every user action passes through at least two packages. The Medicine Wheel is not referenced — it is executed.

---

## Package Wiring

```
                    ┌───────────────────────────┐
                    │   ontology-core            │
                    │   Types, Zod schemas,      │
                    │   RDF vocab, OCAP,         │
                    │   Wilson alignment,         │
                    │   Direction constants       │
                    └─────────┬─────────────────┘
                              │ consumed by all
        ┌─────────┬───────────┼───────────┬───────────┬────────────┐
        ▼         ▼           ▼           ▼           ▼            ▼
┌────────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ ceremony-  ││narrative- ││relational││ graph-   ││ prompt-  ││ ui-      │
│ protocol   ││ engine   ││ -query   ││ viz      ││ decomp   ││ components│
│            ││          ││          ││          ││          ││          │
│ Phase      ││ Beat     ││ Cypher   ││ Circular ││ Four Dir ││ Direction│
│ transitions││ sequencing││ OCAP    ││ layout   ││ pipeline ││ Card     │
│ Governance ││ Arc valid ││ KuzuDB  ││ Mermaid  ││ Intent   ││ Beat     │
│ Consent    ││ Wilson   ││ Traverse ││ 4-Dir    ││ extract  ││ Timeline │
│ OCAP logs  ││ scoring  ││ Audit   ││ position ││ Action   ││ Wilson   │
│            ││          ││          ││          ││ stack    ││ Meter    │
└────────────┘└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘
     WEST         SOUTH       EAST       NORTH       EAST       BRIDGE
```

## Four Directions as Platform Architecture

| Direction | Platform Role | Packages Active | What Happens |
|-----------|-------------|----------------|--------------|
| 🌅 **EAST** (Waaban) | Vision + Decomposition | prompt-decomposition, relational-query | PDE opens circle. Intents classified. Graph context loaded. Structural tension named. |
| 🔥 **SOUTH** (Zhaawan) | Growth + Specification | narrative-engine, relational-query | Specs grow. Narrative beats track learning. Dependencies mapped in graph. |
| 🌊 **WEST** (Ningaabi) | Implementation + Validation | ceremony-protocol, relational-query | Code written under ceremony governance. OCAP enforced. Accountability audited. |
| ❄️ **NORTH** (Giiwedin) | Integration + Wisdom | narrative-engine, graph-viz, ceremony-protocol | Session chronicled. Graph visualized. Ceremony closed. Wisdom distilled. |

## Direction Constants

From `ontology-core`:

```typescript
const DIRECTIONS = {
  east:  { name: 'East',  ojibwe: 'Waaban',   season: 'Spring', act: 1, emoji: '🌅' },
  south: { name: 'South', ojibwe: 'Zhaawan',  season: 'Summer', act: 2, emoji: '🔥' },
  west:  { name: 'West',  ojibwe: 'Ningaabi', season: 'Autumn', act: 3, emoji: '🌊' },
  north: { name: 'North', ojibwe: 'Giiwedin', season: 'Winter', act: 4, emoji: '❄️' },
} as const;
```

The emoji–subtitle pairing is fixed. Implementations MUST NOT use alternative emojis, reorder directions, or omit Ojibwe names.

## Package ↔ Spec Mapping

| Package | Forgewright Specs Consumed By |
|---------|------------------------------|
| `ontology-core` | ALL specs (foundation types) |
| `ceremony-protocol` | 06 (ceremonial runtime), 07 (agentic development) |
| `narrative-engine` | 01 (PDE beats), 02 (state machine beats), 07 (session chronicles) |
| `relational-query` | 03 (graph substrate), 04 (graph MCP tools) |
| `graph-viz` | 05 (visual designer relational view) |
| `prompt-decomposition` | 01 (PDE pipeline), 04 (PDE MCP tools) |
| `ui-components` | 05 (visual designer), 00 (web shell UI) |

## UI Components in the Web Shell

From `medicine-wheel-ui-components`:

| Component | Where in Forgewright |
|-----------|---------------------|
| `DirectionCard` | Chat pane — shows current direction with Ojibwe name, season, guidance |
| `BeatTimeline` | Preview pane — narrative beat sequence across spiral cycles |
| `NodeInspector` | Designer — node detail panel with OCAP badges, relationships |
| `OcapBadge` | Everywhere — visual indicator of access level (🟢🟡🟠🔴) |
| `WilsonMeter` | Status bar — relational health gauge for current session |
| `SpiralIndicator` | Status bar — current direction + cycle count |

## npm Dependencies

```json
{
  "dependencies": {
    "medicine-wheel-ontology-core": "^0.1.0",
    "medicine-wheel-ceremony-protocol": "^0.1.0",
    "medicine-wheel-narrative-engine": "^0.1.0",
    "medicine-wheel-relational-query": "^0.1.0",
    "medicine-wheel-graph-viz": "^0.1.0",
    "medicine-wheel-prompt-decomposition": "^0.1.0",
    "medicine-wheel-ui-components": "^0.1.0"
  }
}
```

## References

- `medicine-wheel/rispecs/medicine-wheel-spec.md` — System spec (all 7 packages)
- `medicine-wheel/rispecs/ontology-core-spec.md` — Foundation types
- `medicine-wheel/rispecs/ceremony-protocol-spec.md` — Governance
- `medicine-wheel/rispecs/narrative-engine-spec.md` — Beat sequencing
- `medicine-wheel/rispecs/relational-query-spec.md` — Graph traversal
- `medicine-wheel/rispecs/graph-viz-spec.md` — Circular layout
- `medicine-wheel/rispecs/prompt-decomposition-spec.md` — PDE
- `narintel/llms/docs/medicine-wheel-research.md` — Research + package registry
