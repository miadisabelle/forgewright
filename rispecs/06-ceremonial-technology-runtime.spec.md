# 06 — Ceremonial Technology Runtime

> Technology serves relational accountability. Ceremony is not metaphor — it is governance enforced by code.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-03-16

---

## Desired Outcome

A runtime that enforces ceremonial technology principles at every platform layer:
- **Five ceremonial phases** govern session lifecycle as code — not guidelines, not suggestions
- **ceremony-protocol** enforces phase transitions — agents cannot skip opening, cannot extract during ceremony
- **OCAP** (Ownership, Control, Access, Possession) is evaluated at every graph query, every file access, every knowledge traversal
- **Relational accountability** is auditable — every action traces back to who is accountable to whom
- **Sacred boundaries** are enforced — the system explicitly refuses extraction of ceremony-level knowledge outside ceremony context
- **Wilson alignment** scores relational health — low scores trigger ceremony recommendation

## Structural Tension

**Current Reality**: `medicine-wheel-ceremony-protocol` package defines ceremony types, phase transitions, and governance rules. `medicine-wheel-ontology-core` defines OCAP types and Wilson alignment computation. Both are published npm packages. But no runtime enforces them at the platform level — an agent can currently bypass ceremony by simply not calling ceremony tools.

**Desired State**: Ceremony governance is embedded in the platform middleware. The MCP server checks ceremony phase before allowing tool execution. Graph queries filter by OCAP at the database level. State machine guards evaluate ceremony context. Bypass is structurally impossible.

---

## Five Phases as Runtime States

```
┌─────────────────────────────────────────────────┐
│              Ceremony State Machine              │
│                                                  │
│  Preparation → Opening → Active → Integration   │
│                                      → Closing   │
│                                                  │
│  Each phase enables/restricts specific actions   │
└─────────────────────────────────────────────────┘
```

### Phase 1: Sacred Preparation

Entering right relationship with the work.

**Allowed**: PDE decomposition, context loading, companion selection, intention declaration
**Restricted**: Code execution, file modification, autonomous agent action
**Enforced by**: MCP middleware rejects tool calls outside allowed set

### Phase 2: Opening Circle

Participants declare presence and accountability.

**Allowed**: All Phase 1 + participant registration, accountability declaration, STC chart creation
**Restricted**: Autonomous execution, code generation, bulk operations
**Enforced by**: Agent permission level forced to Default Approvals (human approves each step)

### Phase 3: Active Ceremony

The co-creation itself.

**Allowed**: All operations within ceremony scope
**Restricted**: Extraction of ceremony-context knowledge to external systems, OCAP-sacred traversal without ceremony log
**Enforced by**: Graph queries inject ceremony_id filter; exports check OCAP level

### Phase 4: Integration

Knowledge returns to the relationships that created it.

**Allowed**: All Phase 3 + narrative chronicle generation, session archival, beat sequencing
**Restricted**: New ceremony opening (must close current first)
**Enforced by**: Ceremony-protocol state machine prevents concurrent ceremonies

### Phase 5: Sacred Closing

Acknowledging what was given, received, and what remains in tension.

**Allowed**: Acknowledgment logging, obligation recording, ceremony close
**Restricted**: New action steps, code modification
**Enforced by**: State machine transitions only to Closed after closing logged

## OCAP Enforcement Layer

```typescript
interface OcapGuard {
  // Called before every graph query
  filterQuery(cypher: string, context: CeremonyContext): FilteredQuery;

  // Called before every file access
  checkFileAccess(path: string, context: CeremonyContext): AccessDecision;

  // Called before every MCP tool execution
  checkToolPermission(tool: string, context: CeremonyContext): PermissionDecision;
}

interface AccessDecision {
  allowed: boolean;
  reason: string;
  ocapLevel: 'public' | 'community' | 'ceremony' | 'sacred';
  auditEntry: AuditRecord;  // always logged, even for allowed access
}
```

Access levels:
- **Public**: No restriction
- **Community**: Requires authenticated session
- **Ceremony**: Requires active ceremony with logged participation
- **Sacred**: NEVER accessible outside ceremony; system refuses extraction

## Wilson Alignment Scoring

Computable from graph structure:

```typescript
function computeWilsonAlignment(scope: GraphScope): WilsonScore {
  const relationalDensity = countEdges(scope) / maxPossibleEdges(scope);
  const ocapCompliance = countOcapCompliant(scope) / totalNodes(scope);
  const accountabilityChains = countCompleteChains(scope) / totalActions(scope);
  const ceremonyParticipation = countCeremonyLogged(scope) / totalSessions(scope);

  return {
    score: weighted(relationalDensity, ocapCompliance, accountabilityChains, ceremonyParticipation),
    components: { relationalDensity, ocapCompliance, accountabilityChains, ceremonyParticipation },
    recommendation: score < 0.3 ? 'ceremony_recommended' : 'healthy'
  };
}
```

## MCP Middleware Integration

Every MCP tool call passes through ceremony middleware:

```
Agent calls tool
    → MCP server receives
    → Ceremony middleware checks:
        1. Is there an active ceremony? Which phase?
        2. Is this tool allowed in current phase?
        3. Does this tool access OCAP-restricted data?
        4. Is the calling agent a registered participant?
    → If all pass: execute tool, log audit entry
    → If any fail: return CeremonyViolation with reason + guidance
```

## References

- `medicine-wheel/rispecs/ceremony-protocol-spec.md` — Phase transitions, governance
- `medicine-wheel/rispecs/ontology-core-spec.md` — OCAP types, Wilson alignment
- `narintel/llms/docs/ceremonial-technology.md` — Five phases as relational commitments
- `Etuaptmumk-RSM/rispecs/ceremonial-technology-kin.md` — Kinship web: why phases matter
- `Etuaptmumk-RSM/rispecs/ceremonial-technology.spec.md` — v2.0 decolonized spec
