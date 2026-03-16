# 01 — PDE-to-Plan Pipeline

> Raw human intent enters as prompt. Structured, relationally accountable work plan exits — mapped to Four Directions, dependency-sorted, ceremony-aware.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

Every session begins with PDE decomposition that produces:
1. **Four Directions section rendered FIRST** — relational knowing before reductive extraction
2. **Implicit intents surfaced** — hedging language ("probably", "somehow") becomes explicit tasks with confidence scores
3. **Action stack ordered by direction flow** — East → South → West → North, dependency-sorted
4. **Directional balance scored** — ceremony recommended when balance < 0.3
5. **Wilson alignment computed** — each intent scores against relational accountability
6. **Narrative beats generated** — action steps become story beats ready for narrative-engine
7. **State machine seed** — action stack maps directly to SMDF state definitions (consumed by spec 02)

## Structural Tension

**Current Reality**: PDE exists as `mcp-pde` (MCP tool) and `medicine-wheel-prompt-decomposition` (npm package). Both produce valid decompositions. But decompositions are stored as static files (.pde/) — they don't feed forward into state machine instantiation or graph persistence.

**Desired State**: PDE output flows into smcraft (action stack → SMDF states), KuzuDB (intents → graph nodes), and ceremony-protocol (balance → ceremony trigger) as a single pipeline.

---

## Pipeline Stages

### Stage 1: Decompose (EAST — Classification)

```
Input:  raw prompt (string)
Output: OntologicalDecomposition
```

- Keyword-based directional scoring
- Intent extraction with action verb matching
- Hedging language detection for implicit intents
- Four Directions classification of each intent

### Stage 2: Enrich (SOUTH — Growth)

```
Input:  OntologicalDecomposition + existing graph context
Output: EnrichedDecomposition
```

- Direction inference refined per intent
- Relational obligation assignment from graph neighbors
- Dependency mapping between directions
- Wilson alignment scoring per intent

### Stage 3: Assess (WEST — Validation)

```
Input:  EnrichedDecomposition
Output: AssessedDecomposition + CeremonyGuidance
```

- Directional balance scoring (0–1)
- Ceremony need detection (balance < 0.3 → ceremony recommended)
- Ambiguity flagging (held, not resolved — delayed resolution principle)
- Neglected direction identification

### Stage 4: Plan (NORTH — Action)

```
Input:  AssessedDecomposition
Output: StructuredPlan (markdown + JSON)
        + SMDFSeed (state machine definition seed)
        + GraphNodes (KuzuDB insert batch)
        + NarrativeBeats (narrative-engine ready)
```

- Topological sort by direction flow + dependency graph
- Action stack generation with direction tags
- SMDF state generation: each action → state, each dependency → transition
- Graph node generation: each intent → RelationalNode
- Narrative beat generation: each action → NarrativeBeat with directional act

## Canonical Output Format

Section ordering is fixed per `pde-four-directions-canonical-spec.md`:

```markdown
# Prompt Decomposition

## Four Directions
### 🌅 EAST — Vision
[What wants to emerge]
### 🔥 SOUTH — Analysis
[What must be understood]
### 🌊 WEST — Validation
[What must be reflected upon]
### ❄️ NORTH — Action
[What must be done]

## Original Prompt
## Primary Intent
## Secondary Intents
## Context Requirements
## Expected Outputs
## Action Stack
## Ambiguity Flags
```

If `## Primary Intent` appears before `## Four Directions`, the implementation is non-compliant.

## Integration Points

| Downstream Consumer | What It Receives | How |
|--------------------|-----------------|-----|
| State Machine Engine (spec 02) | `SMDFSeed` — action stack as state definitions | Pipeline stage 4 output |
| Graph Substrate (spec 03) | `GraphNodes` — intents as RelationalNodes | Pipeline stage 4 output |
| Ceremony Runtime (spec 06) | `CeremonyGuidance` — balance + recommendation | Pipeline stage 3 output |
| Narrative Engine | `NarrativeBeats` — story beats per action | Pipeline stage 4 output |
| MCP Tool Surface (spec 04) | `pde_decompose` + `pde_parse_response` tools | Direct MCP exposure |

## Storage

```
.pde/{id}.json    — full OntologicalDecomposition
.pde/{id}.md      — human-readable canonical markdown
.pde/{id}.seed.smdf.json  — state machine seed (NEW)
```

## Key Types

```typescript
interface StructuredPlan {
  decomposition: OntologicalDecomposition;
  smdfSeed: StateMachineDefinition;      // ready for smcraft
  graphNodes: RelationalNode[];           // ready for KuzuDB
  narrativeBeats: NarrativeBeat[];        // ready for narrative-engine
  ceremonyGuidance: CeremonyGuidance | null;
  pipelineVersion: string;
}
```

## References

- `medicine-wheel/rispecs/prompt-decomposition-spec.md` — MedicineWheelDecomposer API
- `rispecs/pde-four-directions-canonical-spec.md` — Canonical section ordering
- `narintel/llms/docs/prompt-decomposition.md` — PDE as EAST practice
- `narintel/llms/llms-delayed-resolution-principle.md` — Ambiguities held, not resolved
