# 03 — Graph Relational Substrate

> Everything is a node. Everything is in relationship. The graph IS the platform's memory, accountability, and navigation.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

A graph database (KuzuDB) serves as the platform's relational substrate where:
- Every entity (spec, companion, ceremony, action step, session, narrative beat) is a node
- Every relationship (kinship, dependency, accountability, authorship) is an edge
- Traversal respects OCAP (Ownership, Control, Access, Possession) at query time
- Ceremony-bounded queries prevent unauthorized knowledge traversal
- The graph feeds the visual designer (spec 05) for relational web visualization
- Wilson alignment is computable from graph structure (relational health scoring)

## Structural Tension

**Current Reality**: Relational data is scattered across filesystems (.pde/, .coaia/, .smdf.json, KINSHIP.md). The `medicine-wheel-relational-query` package defines traversal APIs and Cypher generation. KuzuDB is specified but not deployed as a unified store.

**Desired State**: One KuzuDB instance holds the relational graph for a workspace. All domain engines (PDE, smcraft, ceremony-protocol, narrative-engine) read and write to it. The graph is the single source of relational truth.

---

## Node Types

| Node Label | Source | Properties |
|-----------|--------|------------|
| `Spec` | rispecs/ files | id, title, version, direction, module |
| `Companion` | CLAUDE.md companion definitions | name, glyph, home, capabilities |
| `Ceremony` | ceremony-protocol logs | id, type, phase, participants, timestamp |
| `Session` | workspace sessions | id, spiralPosition, stcChartId, machineState |
| `ActionStep` | PDE action stack + STC | id, description, direction, status, confidence |
| `NarrativeBeat` | narrative-engine | id, act, direction, content, timestamp |
| `Intent` | PDE decomposition | id, action, target, implicit, direction, wilsonScore |
| `StateMachine` | smcraft SMDF | id, namespace, name, currentState |
| `State` | SMDF states | name, kind, phase, parentState |
| `Event` | SMDF events + STC events | id, source, parameters |

## Edge Types

| Edge Label | From → To | Semantics |
|-----------|-----------|-----------|
| `DEPENDS_ON` | ActionStep → ActionStep | Execution dependency |
| `BELONGS_TO` | ActionStep → Session | Session membership |
| `SERVES_DIRECTION` | ActionStep → Direction | Which direction this step serves |
| `AUTHORED_BY` | Spec → Companion | Who created/owns the spec |
| `GOVERNED_BY` | Session → Ceremony | Which ceremony governs this session |
| `TRANSITIONS_TO` | State → State | State machine transition (via event) |
| `CONTAINS` | State → State | Composite state hierarchy |
| `GENERATED_FROM` | StateMachine → Intent | Machine instantiated from PDE intent |
| `NARRATES` | NarrativeBeat → ActionStep | Beat tells the story of this step |
| `ACCOUNTABLE_TO` | any → Companion/Community | Relational accountability edge |
| `KIN_OF` | Spec → Spec | KINSHIP.md relational links |

## OCAP Enforcement

Every edge and node carries OCAP metadata:

```typescript
interface OcapMetadata {
  ownership: string;        // who owns this knowledge
  control: string;          // who controls access
  access: AccessLevel;      // public | community | ceremony | sacred
  possession: string;       // where this knowledge resides
}
```

Query-time filtering:

```cypher
MATCH (n:ActionStep)-[r:ACCOUNTABLE_TO]->(c:Companion)
WHERE r.access IN $allowedLevels
  AND n.session = $sessionId
RETURN n, r, c
```

Sacred-level nodes are NEVER returned outside ceremony context. The system explicitly marks spaces where extraction is refused.

## Graph Operations

### Ingest (write path)

| Source | Trigger | Graph Effect |
|--------|---------|-------------|
| PDE pipeline | Stage 4 output | Insert Intent nodes + DEPENDS_ON edges + SERVES_DIRECTION edges |
| smcraft | State machine created/modified | Insert/update StateMachine, State, Event nodes + TRANSITIONS_TO, CONTAINS edges |
| ceremony-protocol | Ceremony opened/advanced/closed | Insert Ceremony node + GOVERNED_BY edges |
| narrative-engine | Beat generated | Insert NarrativeBeat + NARRATES edges |
| KINSHIP.md parser | Spec file indexed | Insert Spec nodes + KIN_OF edges |

### Query (read path)

| Query Pattern | Use Case |
|--------------|----------|
| Neighborhood (1-hop) | "What relates to this action step?" |
| Path (shortest) | "How does this spec connect to that ceremony?" |
| Subgraph (bounded) | "Show me everything in this session's relational web" |
| Accountability audit | "Who is accountable for this knowledge traversal?" |
| Wilson alignment | Compute relational health from edge density + OCAP compliance |
| Oscillation detection | Find cycles in ActionStep → DEPENDS_ON → ActionStep |

### Export

- **Mermaid**: graph-viz generates Mermaid diagrams with Four Directions node positioning
- **Cypher**: relational-query generates KuzuDB-compatible Cypher
- **JSON-LD**: ontology-core exports RDF vocabulary for interoperability

## KuzuDB Configuration

```
Database: ~/.forgewright/graph.kuzu
  ├── Node tables: Spec, Companion, Ceremony, Session, ActionStep,
  │                NarrativeBeat, Intent, StateMachine, State, Event
  ├── Rel tables:  DEPENDS_ON, BELONGS_TO, SERVES_DIRECTION, AUTHORED_BY,
  │                GOVERNED_BY, TRANSITIONS_TO, CONTAINS, GENERATED_FROM,
  │                NARRATES, ACCOUNTABLE_TO, KIN_OF
  └── Indexes:     session_id, direction, ceremony_phase, ocap_access
```

## References

- `medicine-wheel/rispecs/relational-query-spec.md` — Query builder, OCAP filtering, Cypher generation
- `medicine-wheel/rispecs/graph-viz-spec.md` — Circular layout, Four Directions positioning
- `medicine-wheel/rispecs/ontology-core-spec.md` — Types, schemas, RDF vocabulary
- `Etuaptmumk-RSM/rispecs/ceremonial-technology-kin.md` — OCAP as relational commitment
