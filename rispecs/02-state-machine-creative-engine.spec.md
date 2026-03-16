# 02 — State Machine Creative Engine

> The creative process IS a state machine. Structural tension IS disequilibrium energy. Action step completion IS a state transition event.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

Every workspace session runs on a live hierarchical state machine where:
- The three creative phases (Germination → Assimilation → Completion) are composite states
- Each action step from PDE is a sub-state with transitions
- Action step completion fires events that advance the machine toward desired state
- Oscillating patterns (cycles without net progress) are detected and flagged
- Guard conditions evaluate structural tension before allowing transitions
- The state machine is designable via visual editor AND MCP tools
- Code generation produces executable Python/TypeScript from any SMDF definition

## Structural Tension

**Current Reality**: smcraft exists with SMDF format, runtime, codegen, MCP server, and web designer — all functional. STC charts exist in coaia-narrative. The conceptual equivalence (STC = state machine) is documented. But no runtime bridges them — STC charts don't instantiate state machines, action step completions don't fire machine events.

**Desired State**: When a user creates an STC chart or PDE generates an action stack, a state machine instantiates. When action steps complete, state transitions fire. The visual designer shows the live machine state.

---

## Core Equivalence (Not Metaphor)

| Fritz Concept | State Machine Concept | Event |
|--------------|----------------------|-------|
| Current Reality | Current State | — |
| Desired Outcome | Desired State (final) | — |
| Structural Tension | Disequilibrium energy | `tension_established` |
| Action Step Completed | State transition | `action_step_completed` |
| Telescoped Action Step | Composite state (sub-machine) | internal events |
| Phase (Germ/Assim/Comp) | Top-level composite state | `phase_advance` |
| Creator Moment of Truth | Guard condition evaluation | `moment_of_truth` |
| Advancing Pattern | Forward transition chain | successive events |
| Oscillating Pattern | Cycle detection | `tension_oscillate` |

## Creative Process as SMDF

```
Root (Creative Process)
├── Germination (composite)
│   ├── TaskDefinition          ← PDE decomposition happens here
│   ├── SpecGeneration          ← RISE specification authoring
│   └── PDEDecomposition        ← structured plan emerges
├── Assimilation (composite)
│   ├── PlanGeneration          ← action stack → implementation plan
│   ├── CodeImplementation      ← agent execution cycles
│   └── IterativeRefinement     ← spiral advancement
└── Completion (composite)
    ├── Validation              ← tests, ceremony accountability check
    ├── Review                  ← human-in-the-loop checkpoint
    └── Integration             ← archive, narrative chronicle, wisdom
```

## Event Model

| Event ID | Trigger | Effect |
|----------|---------|--------|
| `tension_established` | STC chart created | Machine energized — initial state entered |
| `action_step_completed` | User/agent marks step done | Transition to next state in current phase |
| `reality_updated` | Current reality reassessed | Guard conditions re-evaluated |
| `phase_advance` | All sub-states in phase resolved | Exit composite → enter next phase |
| `phase_retreat` | User returns to earlier phase | Re-enter previous composite (history state) |
| `ai_generate` | AI produces content | Transition within current sub-state |
| `user_edit` | Human edits artifact | May trigger guard re-evaluation |
| `tension_resolve` | Desired outcome achieved | Final state reached |
| `tension_oscillate` | Cycle detected | Flag oscillating pattern |
| `workspace_fork` | Branch from current state | Parallel state machine spawned |
| `moment_of_truth` | Review checkpoint | Guard → advance, retreat, or adjust |

## Components

### STCStateAdapter

Bridges STC charts to smcraft state machine instances:
- STC created → SMDF instantiated
- Action step added → state definition created
- Action step completed → transition event fired
- Current reality updated → guard conditions refreshed
- Editing either (STC or SMDF) synchronizes both

### WorkspaceStateMachine

Runtime instance per workspace:

```typescript
interface WorkspaceStateMachine {
  workspaceId: string;
  definition: StateMachineDefinition;
  currentState: string;
  stcChartId: string;
  tensionLevel: number;        // distance to final state
  eventHistory: StateMachineEvent[];
  oscillationDetector: OscillationDetector;
}
```

### OscillationDetector

Watches event history for cycles:
- Same state visited 3+ times without advancing → flag
- Phase retreat followed by same phase advance → warn
- Net progress = 0 over N events → structural adjustment needed

## Code Generation

smcraft codegen (SMCG) produces executable machines:

```
.smdf.json → smcg → Python class or TypeScript class
  - Full hierarchy (composite states, parallel regions)
  - Entry/exit actions
  - Guard conditions
  - Timer support
  - Event dispatch
```

MCP tool `generate_code(language)` invokes real codegen, not inline templates.

## References

- `smcraft/rispecs/70-smdf-format-spec.md` — SMDF schema
- `smcraft/rispecs/71-runtime-engine-spec.md` — Execution runtime
- `smcraft/rispecs/72-code-generator-spec.md` — SMCG codegen
- `mia-code-server/rispecs/smcraft-integration/00-shared-vocabulary.md` — Concept mapping
- `mia-code-server/rispecs/smcraft-integration/01-state-machine-creative-process.spec.md` — STC = state machine
- `narintel/llms/llms-stc-state-machine.md` — LLM comprehension layer
