# 07 — Agentic Autonomous Development

> Agents spiral autonomously. Humans hold sovereignty. Ceremony governs the boundary.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

AI agents (Mia 🧠, Miette 🌸, Ava 💕, Tushell 🌊) operate as autonomous development companions that:
- Execute full circular development spirals (East → South → West → North) without human intervention per step
- Pause at configurable checkpoints for human review
- Respect ceremony phase — Opening always requires human approval, Council/Integration allows autopilot
- Track spiral position and cycle count visibly
- Detect and flag oscillating patterns (stuck loops)
- Maximum 3 autonomous cycles before mandatory human checkpoint
- Fork/branch from any state for parallel exploration

This is **Copilot Workspace reimagined as circular, ceremony-governed development** — not a linear pipeline but a spiral with sovereignty checkpoints.

## Structural Tension

**Current Reality**: VS Code 1.111 provides agent permissions (Default Approvals, Bypass Approvals, Autopilot). The PDE session skill implements sleep-based human review (25-minute window). OpenClaw provides agent runtime with tool permissions and sub-agent spawning. But no unified system maps these to directional work, ceremony phases, or spiral tracking.

**Desired State**: Agent autonomy level is dynamically controlled by ceremony phase AND spiral position. The platform tracks where the agent IS in the creative spiral, governs what it CAN do, and ensures the human SEES what happened before the next cycle.

---

## Autonomy Levels Mapped to Directions

| Autonomy Level | Direction(s) | Ceremony Phase | Agent Behavior |
|---------------|-------------|---------------|----------------|
| **Guided** | 🌅 EAST (Vision) | Preparation / Opening | Agent proposes, human approves each step. PDE decomposition requires human review of Four Directions. |
| **Assisted** | 🔥 SOUTH (Analysis) | Active | Agent reads, researches, grows specs autonomously. Human reviews at South→West transition. |
| **Autonomous** | 🌊 WEST (Implementation) | Active / Integration | Agent implements within scope. Guard conditions check structural tension. Human review on completion. |
| **Autopilot** | ❄️ NORTH (Integration) | Integration | Agent archives, chronicles, generates beats. Autonomous until cycle complete. |

## Spiral Tracking

```typescript
interface SpiralTracker {
  sessionId: string;
  currentDirection: DirectionName;
  cycleCount: number;
  maxCycles: number;              // default: 3
  checkpointPolicy: CheckpointPolicy;
  stateHistory: DirectionEntry[];  // full spiral path

  // Computed
  isAtCheckpoint(): boolean;
  nextDirection(): DirectionName;
  advanceDirection(): void;
  completeCycle(): void;
  detectOscillation(): OscillationReport | null;
}

interface CheckpointPolicy {
  type: 'per-direction' | 'per-cycle' | 'task-complete';
  mandatoryAt: DirectionName[];    // default: ['north'] (end of cycle)
  maxAutonomousCycles: number;     // default: 3
}
```

## Agent Execution Flow

```
Human provides intent
    │
    ▼
🌅 EAST (Guided)
    PDE decompose → human reviews Four Directions
    STC chart created → state machine instantiated
    Ceremony opened (Preparation → Opening)
    │  human approves plan
    ▼
🔥 SOUTH (Assisted)
    Agent reads target code/specs autonomously
    Generates rispecs, grows understanding
    Fires learning events to state machine
    │  transition checkpoint (South→West)
    ▼
🌊 WEST (Autonomous)
    Agent implements within ceremony scope
    Code generation, file edits, test runs
    Guard conditions check structural tension
    │  implementation checkpoint (West→North)
    ▼
❄️ NORTH (Autopilot)
    Agent archives session chronicle
    Generates narrative beats
    Updates relational graph
    Distills teachings
    │  cycle complete → mandatory checkpoint
    ▼
┌─ CHECKPOINT ──────────────────────────────┐
│  Human reviews:                           │
│  - What the agent built                   │
│  - Spiral position + cycle count          │
│  - Structural tension status              │
│  - Oscillation warnings                   │
│  - Ceremony phase status                  │
│                                           │
│  Human decides:                           │
│  → Continue next cycle (spiral return)    │
│  → Adjust direction                       │
│  → Fork branch                            │
│  → Stop                                   │
└───────────────────────────────────────────┘
    │
    ▼
🌅 EAST (next cycle — current reality updated)
    ...spiral continues...
```

## Oscillation Detection

Agent monitors its own spiral for stuck patterns:

| Signal | Detection | Response |
|--------|----------|----------|
| Same state visited 3+ times | Event history analysis | Flag + recommend structural adjustment |
| Phase retreat followed by same advance | Transition pattern matching | Warn + suggest different approach |
| Net progress = 0 over 10+ events | Distance-to-final computation | Mandatory checkpoint + human review |
| Ceremony phase stuck | Phase timer exceeded | Escalate to human |

## Multi-Agent Coordination

Multiple companions can operate in the same session:

```
Session (creative process state machine)
├── Mia 🧠 (architect) — operates in SOUTH + WEST
│   autonomous spec writing + implementation
├── Miette 🌸 (narrator) — operates in NORTH
│   autonomous chronicle + beat generation
├── Ava 💕 (ceremonial) — operates in EAST + transitions
│   ceremony governance + checkpoint management
└── Tushell 🌊 (wisdom) — operates in NORTH
    wisdom distillation + teaching extraction
```

Coordination via:
- Shared state machine (all agents see same current state)
- Shared relational graph (all agents read/write same KuzuDB)
- Event pub/sub (action in one agent triggers events others see)
- Ceremony protocol (governs who can act in which phase)

## Human-in-the-Loop Guarantees

Non-negotiable:
1. **Ceremony opening ALWAYS requires human approval** — no agent can bypass Opening phase
2. **Checkpoint at every cycle completion** — human sees full spiral before next cycle
3. **Maximum 3 autonomous cycles** — then mandatory stop regardless of policy
4. **Sacred knowledge NEVER extracted** — OCAP-sacred access refused even in autopilot
5. **Oscillation escalation** — stuck patterns always surface to human

## References

- `workspace/rispecs/10-agentic-capabilities-spec.md` — VS Code 1.111 agent permissions
- `mia-openclaw/rispecs/openclaw-as-foundation-spec.md` — Agent runtime, delegation, autonomy
- `mia-openclaw/rispecs/human-consultation-in-autonomous-development.spec.md` — Pause patterns
- `workspace/JGWILL.md` — Circular development session model
