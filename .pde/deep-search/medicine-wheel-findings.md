# 🔥 SOUTH Direction Deep Search: Medicine Wheel Package Suite

> **Source:** `/workspace/repos/jgwill/medicine-wheel/`
> **Scanned:** All 15 packages in `src/`, 93 TypeScript source files
> **Purpose:** Forgewright platform type parity — exact type definitions for import

---

## Package Inventory

| # | Package (npm name) | Version | Dependencies | Files |
|---|---|---|---|---|
| 1 | `medicine-wheel-ontology-core` | 0.1.4 | `zod` | types, constants, schemas, vocabulary, queries |
| 2 | `medicine-wheel-ceremony-protocol` | 0.1.3 | `ontology-core` | index (single file) |
| 3 | `medicine-wheel-narrative-engine` | 0.1.3 | `ontology-core` | types, arc, sequencer, timeline, cadence, cycle, rsis-narrative |
| 4 | `medicine-wheel-relational-query` | 0.1.3 | `ontology-core` | types, cypher, query, traversal, audit |
| 5 | `medicine-wheel-graph-viz` | 0.1.3 | `ontology-core`, peer: `react`, `react-dom` | types, layout, converters, MedicineWheelGraph.tsx, rsis-viz |
| 6 | `medicine-wheel-prompt-decomposition` | 0.1.3 | `ontology-core` | types, decomposer, relational_enricher, storage, index.browser |
| 7 | `medicine-wheel-ui-components` | 0.1.2 | `ontology-core`, peer: `react` | DirectionCard, BeatTimeline, NodeInspector, OcapBadge, WilsonMeter |
| 8 | `medicine-wheel-data-store` | 0.1.3 | `ontology-core`, `redis` | connection, store, session-link, helpers |
| 9 | `medicine-wheel-session-reader` | 0.1.3 | _(none)_ | types, sessions |
| 10 | `medicine-wheel-fire-keeper` | 0.1.0 | `ontology-core`, `ceremony-protocol` | types, keeper, gating, decisions, check-back, ceremony-state, trajectory, messages |
| 11 | `medicine-wheel-importance-unit` | 0.1.0 | `ontology-core`, `zod` | types, schemas, unit, epistemic-weight, accountability, circle-tracking |
| 12 | `medicine-wheel-relational-index` | 0.1.0 | `ontology-core` | types, dimensions, index-manager, query, metrics, spiral-depth, cross-dimensional |
| 13 | `medicine-wheel-transformation-tracker` | 0.1.0 | `ontology-core`, `ceremony-protocol`, `zod` | types, schemas, researcher, relational-shift, reciprocity-ledger, seven-generations, community, validity, prompts |
| 14 | `medicine-wheel-community-review` | 0.1.0 | `ontology-core`, `ceremony-protocol`, `zod` | types, schemas, circle, elder, consensus, accountability, outcomes |
| 15 | `medicine-wheel-consent-lifecycle` | 0.1.0 | `ontology-core`, `ceremony-protocol`, `zod` | types, schemas, lifecycle, cascade, alerts, ceremony, community, scope |

---

## ontology-core — `medicine-wheel-ontology-core@0.1.4`

### Package Exports (package.json)
```json
{
  ".": "./dist/index.js",
  "./types": "./dist/types.js",
  "./schemas": "./dist/schemas.js",
  "./vocabulary": "./dist/vocabulary.js",
  "./constants": "./dist/constants.js",
  "./queries": "./dist/queries.js"
}
```

### Direction Types (CRITICAL — Ojibwe Names)

```typescript
export type DirectionName = 'east' | 'south' | 'west' | 'north';

export interface Direction {
  name: DirectionName;
  ojibwe: string;    // Ojibwe name
  season: string;    // Spring, Summer, Fall, Winter
  color: string;     // hex color
  lifeStage: string; // Good Life, Fast Life, Truth & Planning, Elder
  ages: string;
  medicine: string[];
  teachings: string[];
  practices: string[];
}
```

### Direction Constants (EXACT Ojibwe Names)

```typescript
export const OJIBWE_NAMES: Record<DirectionName, string> = {
  east: 'Waabinong',
  south: 'Zhaawanong',
  west: 'Epangishmok',
  north: 'Kiiwedinong',
};

export const DIRECTION_COLORS: Record<DirectionName, string> = {
  east: '#FFD700',
  south: '#DC143C',
  west: '#1a1a2e',
  north: '#E8E8E8',
};

export const DIRECTION_SEASONS: Record<DirectionName, string> = {
  east: 'Spring', south: 'Summer', west: 'Fall', north: 'Winter',
};

export const DIRECTION_ACTS: Record<DirectionName, number> = {
  east: 1, south: 2, west: 3, north: 4,
};

export const ACT_DIRECTIONS: Record<number, DirectionName> = {
  1: 'east', 2: 'south', 3: 'west', 4: 'north',
};

export const DIRECTION_INFO: Record<DirectionName, DirectionInfo> = {
  east:  { name: 'east',  emoji: '🌸', focus: 'Vision, intention, emergence',
           guidance: 'What wants to emerge? What seeds are being planted?' },
  south: { name: 'south', emoji: '🧠', focus: 'Architecture, structure, planning',
           guidance: 'What structures support the vision? What patterns serve advancement?' },
  west:  { name: 'west',  emoji: '⚡', focus: 'Implementation, creation, manifestation',
           guidance: 'What is being built? How does creation serve the inquiries?' },
  north: { name: 'north', emoji: '🕸️', focus: 'Reflection, integration, wisdom',
           guidance: 'What has been learned? What reciprocity needs tending?' },
};
```

### Full DIRECTIONS Array

```typescript
export const DIRECTIONS: Direction[] = [
  {
    name: 'east', ojibwe: 'Waabinong', season: 'Spring', color: '#FFD700',
    lifeStage: 'Good Life', ages: 'Birth - 7 years',
    medicine: ['Tobacco (Asemaa)'],
    teachings: ['New beginnings', 'Vision', 'Illumination', 'Spiritual connection'],
    practices: ['Morning prayers', 'Setting intentions', 'Vision quests', 'Opening ceremonies'],
  },
  {
    name: 'south', ojibwe: 'Zhaawanong', season: 'Summer', color: '#DC143C',
    lifeStage: 'Fast Life', ages: '7 - 14 years',
    medicine: ['Cedar (Giizhik)'],
    teachings: ['Growth', 'Youth energy', 'Trust', 'Physical strength'],
    practices: ['Land-based learning', 'Youth mentorship', 'Physical engagement', 'Cedar ceremonies'],
  },
  {
    name: 'west', ojibwe: 'Epangishmok', season: 'Fall', color: '#1a1a2e',
    lifeStage: 'Truth & Planning', ages: '35 - 49 years',
    medicine: ['Sage (Mashkodewashk)', "Strawberry (Ode'imin)"],
    teachings: ['Reflection', 'Truth', 'Introspection', 'Emotional processing'],
    practices: ['Talking circles', 'Emotional processing', 'Forgiveness ceremonies', 'Sunset prayers'],
  },
  {
    name: 'north', ojibwe: 'Kiiwedinong', season: 'Winter', color: '#E8E8E8',
    lifeStage: 'Elder', ages: '49+ years',
    medicine: ['Cedar', 'Stories'],
    teachings: ['Wisdom', 'Completion', 'Ancestral knowledge', 'Generosity'],
    practices: ['Story archiving', 'Spirit feeding', 'Elder council', 'Knowledge sharing'],
  },
];
```

### Node Types

```typescript
export type NodeType = 'human' | 'land' | 'spirit' | 'ancestor' | 'future' | 'knowledge';

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  human: '#e8913a', land: '#4a9e5c', spirit: '#9a5cc6',
  ancestor: '#c9a23a', future: '#5a9ec6', knowledge: '#d4b844',
};
```

### OCAP Types (Ownership, Control, Access, Possession)

```typescript
export interface OcapFlags {
  ownership: string;
  control: string;
  access: 'community' | 'researchers' | 'public' | 'restricted';
  possession: 'on-premise' | 'community-server' | 'cloud-sovereign' | 'cloud-shared';
  compliant: boolean;
  steward?: string;
  consent_given?: boolean;
  consent_scope?: string;
  consent_state?: 'active' | 'withdrawn' | 'expired' | 'pending';
  consent_last_affirmed?: string;
}
```

### Wilson Accountability Tracking

```typescript
export interface AccountabilityTracking {
  respect: number;        // 0–1
  reciprocity: number;    // 0–1
  responsibility: number; // 0–1
  wilson_alignment: number; // computed (0–1)
  relations_honored: string[];
  last_ceremony_id?: string;
  notes?: string;
}
```

### Relational Node & Edge

```typescript
export interface RelationalNode {
  id: string;
  name: string;
  type: NodeType;
  direction?: DirectionName;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RelationalEdge {
  id: string;
  from_id: string;
  to_id: string;
  relationship_type: string;
  strength: number;          // 0–1
  ceremony_honored: boolean;
  obligations: string[];
  created_at: string;
}
```

### First-Class Relation (core entity)

```typescript
export interface Relation {
  id: string;
  from_id: string;
  to_id: string;
  relationship_type: string;
  strength: number;           // 0–1
  direction?: DirectionName;
  ceremony_context?: {
    ceremony_id?: string;
    ceremony_type?: CeremonyType;
    ceremony_honored: boolean;
  };
  obligations: RelationalObligation[];
  ocap: OcapFlags;
  accountability: AccountabilityTracking;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ObligationCategory = 'human' | 'land' | 'spirit' | 'future';

export interface RelationalObligation {
  category: ObligationCategory;
  obligations: string[];
}
```

### Ceremony Types

```typescript
export type CeremonyType = 'smudging' | 'talking_circle' | 'spirit_feeding' | 'opening' | 'closing';

export const CEREMONY_ICONS: Record<CeremonyType, string> = {
  smudging: '🌿', talking_circle: '🔴', spirit_feeding: '🕯️', opening: '🌅', closing: '🌙',
};

export interface CeremonyGuidance {
  opening_practice: string;
  intention: string;
  protocol: string;
  medicines_used: string[];
  timeline?: string;
}

export interface CeremonyLog {
  id: string;
  type: CeremonyType;
  direction: DirectionName;
  participants: string[];
  medicines_used: string[];
  intentions: string[];
  timestamp: string;
  research_context?: string;
  relations_honored?: string[];
  ocap?: OcapFlags;
}
```

### Narrative Types

```typescript
export interface NarrativeBeat {
  id: string;
  direction: DirectionName;
  title: string;
  description: string;
  prose?: string;
  ceremonies: string[];
  learnings: string[];
  timestamp: string;
  act: number;               // 1–4
  relations_honored: string[];
}

export interface MedicineWheelCycle {
  id: string;
  research_question: string;
  start_date: string;
  current_direction: DirectionName;
  beats: string[];
  ceremonies_conducted: number;
  relations_mapped: number;
  wilson_alignment: number;
  ocap_compliant: boolean;
}
```

### Structural Tension

```typescript
export type TensionPhase = 'germination' | 'assimilation' | 'completion';

export interface StructuralTensionChart {
  id: string;
  desired_outcome: string;
  current_reality: string;
  action_steps: ActionStep[];
  phase: TensionPhase;
  direction?: DirectionName;
  created_at: string;
  updated_at: string;
}

export interface ActionStep {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  direction?: DirectionName;
  due_date?: string;
}
```

### Epistemic & Axiological

```typescript
export type EpistemicSource = 'land' | 'dream' | 'code' | 'vision';
export type AxiologicalPillar = 'ontology' | 'epistemology' | 'methodology' | 'axiology';
```

### RSIS Types

```typescript
export type SunName = 'NovelEmergence' | 'CreativeActualization' | 'WovenMeaning'
  | 'FirstCause' | 'EmbodiedPractice' | 'SustainedPresence';

export type CeremonyPhase = 'opening' | 'council' | 'integration' | 'closure';
export type GovernanceAccess = 'open' | 'ceremony_required' | 'restricted' | 'sacred';
export type PersonRole = 'steward' | 'contributor' | 'elder' | 'firekeeper';
export type RSISRelationType = 'STEWARDS' | 'BORN_FROM' | 'SERVES' | 'GIVES_BACK_TO' | 'ALIGNED_WITH' | 'KINSHIP_OF';

export interface GovernanceProtectedPath {
  path: string;
  authority: string[];
  access: GovernanceAccess;
  description?: string;
}

export interface GovernanceConfig {
  protected_paths?: GovernanceProtectedPath[];
  ceremony_required_changes?: string[];
  index_exclusions?: string[];
}

export interface RSISConfig {
  enabled: boolean;
  charts?: string[];
  kinship_paths?: string[];
  ceremony?: { current_cycle?: string; host_sun?: SunName; phase?: CeremonyPhase; };
  directions?: { auto_classify_commits?: boolean; heuristics?: 'default' | string; };
  governance?: GovernanceConfig;
}

export interface KinshipHubInfo {
  path: string; identity: string; lineage: string;
  humanAccountabilities: string[]; moreThanHumanAccountabilities: string[]; boundaries: string[];
}
export interface KinshipRelation { from: string; to: string; type: string; }
export interface ReciprocityFlow { from: string; to: string; type: string; count: number; }
export interface ReciprocityBalance { entity: string; giving: number; receiving: number; }
export interface CeremonyLineageEntry {
  ceremonyId: string; ceremonyName: string; sun: string; cycle: string;
  phase: CeremonyPhase; stewards: string[];
}
export interface DirectionInfo { name: DirectionName; emoji: string; focus: string; guidance: string; }
export interface DirectionDistribution { east: number; south: number; west: number; north: number; }
export interface DirectionDetail { name: string; direction: DirectionName; reason: string; }
export interface MedicineWheelView {
  suns: Array<{ name: SunName; inquiryCount: number }>;
  directions: Record<DirectionName, { count: number; recent: string[] }>;
  reciprocity: { flows: ReciprocityFlow[]; balance: ReciprocityBalance[]; };
  kinship: { hubs: KinshipHubInfo[]; relations: KinshipRelation[]; };
}
```

### Specialized Relation Subtypes

```typescript
export interface LandRelation extends Relation {
  relationship_type: 'land-kinship' | 'land-teaching' | 'land-stewardship';
  place?: string; season?: string;
}
export interface AncestorRelation extends Relation {
  relationship_type: 'ancestor-teaching' | 'ancestor-obligation' | 'ancestor-lineage';
  ancestor?: string; lineage?: string;
}
export interface FutureRelation extends Relation {
  relationship_type: 'future-obligation' | 'future-gift' | 'future-teaching';
  generationsForward?: number;
}
export interface CosmicRelation extends Relation {
  relationship_type: 'cosmic-kinship' | 'spirit-teaching' | 'cosmic-reciprocity';
  entity?: string;
}
```

### RDF Vocabulary (vocabulary.ts)

```typescript
export const MW_NS = 'https://ontology.medicine-wheel.dev/mw#';
export const IDS_NS = 'https://ontology.medicine-wheel.dev/ids#';
export const OCAP_NS = 'https://ontology.medicine-wheel.dev/ocap#';
export const REL_NS = 'https://ontology.medicine-wheel.dev/rel#';
export const CER_NS = 'https://ontology.medicine-wheel.dev/cer#';
export const BEAT_NS = 'https://ontology.medicine-wheel.dev/beat#';

// Standard interop
export const RDF_NS, RDFS_NS, OWL_NS, SKOS_NS, PROV_NS, SHACL_NS;

// Predicate objects: MW, CER, OCAP, REL, IDS, BEAT
// Utility: prefixed(), expandIRI(), compactIRI()
```

### Zod Schemas (schemas.ts)

All core types have Zod schemas:
- `DirectionNameSchema`, `NodeTypeSchema`, `CeremonyTypeSchema`, `ObligationCategorySchema`
- `TensionPhaseSchema`, `EpistemicSourceSchema`, `AxiologicalPillarSchema`
- `ConsentStateSchema`, `AccessLevelSchema`, `PossessionLocationSchema`
- `DirectionSchema`, `RelationalNodeSchema`, `RelationalEdgeSchema`
- `RelationalObligationSchema`, `OcapFlagsSchema`, `AccountabilityTrackingSchema`
- `CeremonyContextSchema`, `RelationSchema`
- `CeremonyGuidanceSchema`, `CeremonyLogSchema`
- `NarrativeBeatSchema`, `MedicineWheelCycleSchema`
- `ActionStepSchema`, `StructuralTensionChartSchema`, `DirectionResponseSchema`

Validated types derived: `ValidatedDirection`, `ValidatedRelationalNode`, `ValidatedRelationalEdge`, `ValidatedRelation`, `ValidatedOcapFlags`, `ValidatedAccountabilityTracking`, `ValidatedCeremonyLog`, `ValidatedNarrativeBeat`, `ValidatedMedicineWheelCycle`, `ValidatedStructuralTensionChart`

### Query Functions (queries.ts)

```typescript
// Node queries
nodesByDirection(nodes, direction): RelationalNode[]
nodesByType(nodes, type): RelationalNode[]
nodeById(nodes, id): RelationalNode | undefined

// Relational traversal
relationsForNode(relations, nodeId): Relation[]
relationsByType(relations, type): Relation[]
neighborIds(relations, nodeId): string[]
traverseRelationalWeb(nodes, relations, startNodeId, maxDepth?): { visited: Set<string>; paths: string[][] }

// Wilson alignment
computeWilsonAlignment(accountability): number  // average of respect, reciprocity, responsibility
aggregateWilsonAlignment(relations): number
cycleWilsonAlignment(cycle, relations): number
findAccountabilityGaps(relations, threshold?): Relation[]

// OCAP compliance
checkOcapCompliance(ocap): { compliant: boolean; issues: string[] }
auditOcapCompliance(relations): { overall_compliant, compliant_count, non_compliant_count, issues[] }

// Narrative
beatsByDirection(beats, direction): NarrativeBeat[]
beatsByAct(beats, act): NarrativeBeat[]
allDirectionsVisited(beats): boolean
ceremoniesByDirection(ceremonies, direction): CeremonyLog[]
ceremonyCounts(ceremonies): Record<DirectionName, number>
relationalCompleteness(nodeId, relations): { total_relations, obligation_categories_covered, missing_categories, ceremony_coverage }
```

---

## ceremony-protocol — `medicine-wheel-ceremony-protocol@0.1.3`

### Exports

```typescript
// Ceremony State
interface CeremonyState { currentCycle: string; hostSun: SunName; phase: CeremonyPhase; startDate?: string; endDate?: string; }
function loadCeremonyState(config: RSISConfig): CeremonyState | null

// Phase Transitions
const PHASE_ORDER: CeremonyPhase[] = ['opening', 'council', 'integration', 'closure'];
function nextPhase(current: CeremonyPhase): CeremonyPhase | null
function getPhaseFraming(phase?: CeremonyPhase): string

// Governance Enforcement
function checkGovernance(filePath, config): GovernanceProtectedPath | null
function isIndexExcluded(filePath, config): boolean
function checkCeremonyRequired(filePath, config): boolean
function getAccessLevel(filePath, config): GovernanceAccess
function formatGovernanceWarning(rule): string

// Extended Phase Support
type CeremonyPhaseExtended = 'gathering' | 'kindling' | 'tending' | 'harvesting' | 'resting';
function nextPhaseExtended(current): CeremonyPhaseExtended | null
function getPhaseFramingExtended(phase?): string

// Ceremony Gate Enforcement
interface CeremonyGateError { blocked: true; reason: string; rule: GovernanceProtectedPath | null; requiredAuthority: string[]; }
interface CeremonyGatePass { blocked: false; }
type CeremonyGateResult = CeremonyGateError | CeremonyGatePass;
function enforceCeremonyGate(filePath, config): CeremonyGateResult
```

### Phase Transition Rules
- `opening` → `council` → `integration` → `closure` (standard)
- `gathering` → `kindling` → `tending` → `harvesting` → `resting` (extended/fire-keeper)

---

## narrative-engine — `medicine-wheel-narrative-engine@0.1.3`

### Types

```typescript
interface BeatPosition { beat: NarrativeBeat; index: number; direction: DirectionName; act: number; }
interface BeatInsertResult { success: boolean; positions: BeatPosition[]; warnings: string[]; }
interface SequencerOptions { enforceDirectionOrder?: boolean; allowMultiplePerAct?: boolean; maxBeatsPerDirection?: number; }
type CadencePhase = 'opening' | 'deepening' | 'integrating' | 'closing';
interface CadencePattern { name: string; description: string; phases: CadencePhaseRule[]; }
interface CadencePhaseRule { phase: CadencePhase; direction: DirectionName; requiresCeremony: boolean; minBeats: number; maxBeats: number; }
interface CadenceValidation { valid: boolean; currentPhase: CadencePhase; phasesCompleted: CadencePhase[]; phasesRemaining: CadencePhase[]; violations: CadenceViolation[]; }
interface CadenceViolation { phase: CadencePhase; rule: string; message: string; }
interface ArcCompleteness { complete: boolean; directionsVisited: DirectionName[]; directionsMissing: DirectionName[]; ceremoniesPerDirection: Record<DirectionName, number>; beatsPerDirection: Record<DirectionName, number>; wilsonAlignment: number; ocapCompliant: boolean; completenessScore: number; }
interface ArcViolation { type: 'missing_direction' | 'no_ceremony' | 'low_wilson' | 'ocap_gap' | 'unbalanced'; direction?: DirectionName; message: string; severity: 'error' | 'warning' | 'info'; }
interface ArcValidationResult { valid: boolean; completeness: ArcCompleteness; violations: ArcViolation[]; recommendations: string[]; }
type TimelineAxis = 'chronological' | 'directional' | 'ceremonial';
interface TimelineEntry { beat: NarrativeBeat; position: number; direction: DirectionName; act: number; hasCeremony: boolean; group: string; }
interface TimelineData { axis: TimelineAxis; entries: TimelineEntry[]; groups: TimelineGroup[]; span: { start: string; end: string }; }
interface TimelineGroup { key: string; label: string; color: string; entries: TimelineEntry[]; }
interface TimelineOptions { axis?: TimelineAxis; filterDirection?: DirectionName; filterAct?: number; sortBy?: 'timestamp' | 'act' | 'direction'; }
interface CycleTransition { from: DirectionName; to: DirectionName; timestamp: string; ceremonyConducted: boolean; beat?: NarrativeBeat; }
interface CycleProgress { cycle: MedicineWheelCycle; transitions: CycleTransition[]; currentPhase: CadencePhase; completeness: ArcCompleteness; nextDirection: DirectionName | null; suggestedAction: string; }
interface EpistemicDepth { circleCount: number; deepeningIndicators: string[]; stagnationRisk: boolean; }
interface NarrativeTransformation { beatId: string; beforeUnderstanding: string; afterUnderstanding: string; catalyst: string; }
```

### Functions

```typescript
// Sequencer
sequenceBeats(beats): BeatPosition[]
insertBeat(beats, newBeat, opts?): BeatInsertResult
beatsByDirection(beats): Record<DirectionName, NarrativeBeat[]>
nextDirection(beats): DirectionName | null
currentAct(beats): number
suggestNextBeat(beats): { direction: DirectionName; act: number }
spiralOrder(beats): NarrativeBeat[]
detectEpistemicDeepening(beats): { circleCount, deepeningIndicators, stagnationRisk }
findTransformationPoints(beats): NarrativeTransformation[]

// Cadence
STANDARD_CADENCE: CadencePattern   // 4 phases, ceremony required at each
LIGHT_CADENCE: CadencePattern      // ceremony at opening/closing only
currentPhase(beats): CadencePhase
directionToPhase(direction): CadencePhase
phaseToDirection(phase): DirectionName
validateCadence(beats, ceremonies, pattern?): CadenceValidation
detectTransitions(beats): Array<{ from, to, beatIndex }>

// Arc validation
computeCompleteness(beats, ceremonies, relations): ArcCompleteness
validateArc(beats, ceremonies, relations): ArcValidationResult
isArcComplete(beats): boolean

// Timeline
buildTimeline(beats, options?): TimelineData
actStrip(beats): Array<{ act, direction, beats, hasCeremony }>

// Cycle manager
extractTransitions(beats, ceremonies): CycleTransition[]
computeProgress(cycle, beats, ceremonies, relations): CycleProgress
createCycle(id, researchQuestion): MedicineWheelCycle
updateCycleMetadata(cycle, beats, ceremonies, relations): MedicineWheelCycle

// RSIS narrative
generateProvenanceNarrative(symbolName, lineage, inquiries, stewards): string
generateReciprocityObservation(stewardCount, flowCount): string
generateDirectionObservation(distribution, total): string
getCeremonyPhaseFraming(phase?): string
describeSun(sun): string
```

### Arc Completeness Score Formula
```
completenessScore = (directionScore * 0.3) + (ceremonyScore * 0.25) + (wilsonAlignment * 0.25) + (balanceScore * 0.2)
```

---

## relational-query — `medicine-wheel-relational-query@0.1.3`

### Types

```typescript
interface NodeFilter { type?: NodeType | NodeType[]; direction?: DirectionName | DirectionName[]; nameContains?: string; hasRelationsTo?: string; minRelations?: number; createdAfter?: string; createdBefore?: string; }
interface EdgeFilter { relationshipType?: string | string[]; minStrength?: number; ceremonyHonored?: boolean; fromNode?: string; toNode?: string; }
interface RelationFilter { direction?: DirectionName; ceremonied?: boolean; ocapCompliant?: boolean; minWilsonAlignment?: number; hasObligations?: boolean; }
type SortField = 'name' | 'created_at' | 'updated_at' | 'type' | 'direction';
type SortOrder = 'asc' | 'desc';
interface QuerySort { field: SortField; order: SortOrder; }
interface QueryPagination { offset: number; limit: number; }
interface QueryOptions { filter?: NodeFilter; sort?: QuerySort; pagination?: QueryPagination; includeEdges?: boolean; includeRelations?: boolean; }
interface QueryResult<T> { items: T[]; total: number; offset: number; limit: number; hasMore: boolean; }
type TraversalDirection = 'outgoing' | 'incoming' | 'both';
interface TraversalOptions { maxDepth: number; direction: TraversalDirection; edgeFilter?: EdgeFilter; nodeFilter?: NodeFilter; respectCeremonyBoundaries?: boolean; ocapOnly?: boolean; }
interface TraversalPath { nodes: RelationalNode[]; edges: RelationalEdge[]; depth: number; }
interface TraversalResult { root: RelationalNode; paths: TraversalPath[]; visitedNodes: Set<string>; maxDepthReached: boolean; }
interface AccountabilityReport { totalRelations: number; ocapCompliant: number; ocapNonCompliant: number; averageWilsonAlignment: number; directionCoverage: Record<DirectionName, number>; ceremoniedRelations: number; unceremoniedRelations: number; obligationsOutstanding: number; recommendations: string[]; }
```

### Functions

```typescript
// Query builder
filterNodes(nodes, filter): RelationalNode[]
filterEdges(edges, filter): RelationalEdge[]
filterRelations(relations, filter): Relation[]
sortNodes(nodes, sort): RelationalNode[]
paginate<T>(items, pagination): QueryResult<T>
filterByRelation(nodes, edges, targetNodeId): RelationalNode[]
relationCounts(nodes, edges): Map<string, number>
filterByMinRelations(nodes, edges, minRelations): RelationalNode[]

// Traversal
traverse(rootId, nodes, edges, relations, opts?): TraversalResult
shortestPath(fromId, toId, nodes, edges): TraversalPath | null
neighborhood(nodeId, nodes, edges, maxDepth?): RelationalNode[]

// Audit
auditAccountability(nodes, edges, relations): AccountabilityReport
isOcapCompliant(relation): boolean
relationsNeedingAttention(relations, wilsonThreshold?): Relation[]

// Cypher (KuzuDB)
queryStewards(symbolId): string
queryCeremonyProvenance(symbolId): string
queryInquiries(symbolId): string
queryKinshipHubs(): string
queryKinshipRelations(): string
queryDirectionAlignment(symbolId): string
queryReciprocityFlows(): string
queryInquiriesBySun(sun): string
queryCeremonies(): string
queryAllInquiries(): string
formatReciprocityObservation(flows): string
formatDirectionObservation(distribution): string
```

---

## graph-viz — `medicine-wheel-graph-viz@0.1.3`

### Types

```typescript
interface MWGraphNode {
  id: string; label: string; type: NodeType; direction?: DirectionName;
  x?: number; y?: number; size?: number; color?: string; opacity?: number;
  selected?: boolean; highlighted?: boolean; ocapCompliant?: boolean;
  wilsonAlignment?: number; data?: RelationalNode; metadata?: Record<string, unknown>;
}
type LinkStyle = 'solid' | 'dashed' | 'dotted' | 'ceremony';
interface MWGraphLink {
  source: string; target: string; label?: string; style?: LinkStyle;
  strength?: number; ceremonyHonored?: boolean; ceremonyType?: CeremonyType;
  color?: string; width?: number; curvature?: number; metadata?: Record<string, unknown>;
}
interface MWGraphData { nodes: MWGraphNode[]; links: MWGraphLink[]; focusedNodeId?: string; }
type LayoutMode = 'wheel' | 'force' | 'radial';
interface WheelLayoutConfig {
  mode: LayoutMode; centerX: number; centerY: number; radius: number;
  innerRadius?: number; quadrantPadding?: number; startAngle?: number;
  jitter?: boolean; jitterAmount?: number;
}
interface MedicineWheelGraphProps {
  data: MWGraphData; width?: number; height?: number; layout?: Partial<WheelLayoutConfig>;
  showDirectionLabels?: boolean; showQuadrants?: boolean; showCenter?: boolean;
  showLinkLabels?: boolean; showNodeLabels?: boolean; showOcapIndicators?: boolean;
  showWilsonHalos?: boolean; darkMode?: boolean; className?: string;
  onNodeClick?: (node: MWGraphNode) => void; onNodeHover?: (node: MWGraphNode | null) => void;
  onLinkClick?: (link: MWGraphLink) => void; onBackgroundClick?: () => void;
}
interface QuadrantGeometry { direction: DirectionName; startAngle: number; endAngle: number; centerAngle: number; color: string; label: string; ojibwe: string; }
```

### RSIS Viz Types

```typescript
interface KinshipGraphNode { id: string; label: string; identity: string; group: string; }
interface KinshipGraphEdge { source: string; target: string; label: string; }
interface FlowDiagramNode { id: string; label: string; value: number; }
interface FlowDiagramLink { source: string; target: string; value: number; }
interface DirectionWheelSegment { direction: DirectionName; emoji: string; value: number; label: string; }
interface TimelineEntry { id: string; name: string; sun: string; cycle: string; phase: string; startDate?: string; endDate?: string; }
```

### Functions

```typescript
// Layout
applyWheelLayout(data, config?): MWGraphData
DEFAULT_LAYOUT: WheelLayoutConfig  // centerX:300, centerY:300, radius:250, innerRadius:60
getQuadrantGeometries(config?): QuadrantGeometry[]
quadrantArcPath(cx, cy, outerR, innerR, startAngle, endAngle): string
curvedLinkPath(x1, y1, x2, y2, curvature?): string
directionLabelPosition(cx, cy, radius, direction): { x, y, anchor }

// Converters
nodesToGraphNodes(nodes): MWGraphNode[]
edgesToGraphLinks(edges): MWGraphLink[]
relationsToGraphLinks(relations): MWGraphLink[]
buildGraphData(nodes, edges): MWGraphData

// RSIS visualization
toKinshipGraphLayout(hubs, relations): { nodes, edges }
toReciprocityFlowDiagram(flows): { nodes, links }
toDirectionWheelData(distribution): DirectionWheelSegment[]
toCeremonyTimelineData(ceremonies): TimelineEntry[]
toMermaidDiagram(hubs, relations): string

// React component
MedicineWheelGraph: React.FC<MedicineWheelGraphProps>  // pure SVG, no D3
```

### Direction → Angle Mapping
```
East:  315°–45°  (right)
South: 45°–135°  (bottom)
West:  135°–225° (left)
North: 225°–315° (top)
```

---

## prompt-decomposition — `medicine-wheel-prompt-decomposition@0.1.3`

### Package Exports
```json
{
  ".": { "browser": "./dist/index.browser.js", "import": "./dist/index.js" },
  "./browser": { "import": "./dist/index.browser.js" },
  "./types": { "import": "./dist/types.js" }
}
```

### Types

```typescript
type Urgency = 'immediate' | 'session' | 'sprint' | 'ongoing';
type EpistemicSourceHint = 'land' | 'dream' | 'code' | 'vision' | 'unknown';

interface PrimaryIntent { action: string; target: string; urgency: Urgency; confidence: number; }
interface SecondaryIntent { id: string; action: string; target: string; implicit: boolean; dependency: string | null; confidence: number; }
interface ExtractionContext { filesNeeded: string[]; toolsRequired: string[]; assumptions: string[]; }
interface AmbiguityFlag { text: string; suggestion: string; }
interface ExpectedOutputs { artifacts: string[]; updates: string[]; communications: string[]; }
interface DirectionalInsight { text: string; confidence: number; implicit: boolean; }

interface OntologicalDirection {
  name: DirectionName; ojibwe: string; season: string; act: number;
  insights: DirectionalInsight[]; obligations: RelationalObligation[];
  ceremonyRecommended: boolean;
}

interface RelationalIntent extends SecondaryIntent {
  direction: DirectionName; obligations: RelationalObligation[]; wilsonAlignment: number;
}

interface OntologicalDependency { fromId: string; toId: string; type: 'depends_on' | 'validates' | 'informs' | 'ceremonies'; direction: DirectionName; confidence: number; }

interface OntologicalDecomposition {
  id: string; timestamp: string; prompt: string;
  primary: PrimaryIntent; secondary: RelationalIntent[];
  context: ExtractionContext; outputs: ExpectedOutputs;
  directions: Record<DirectionName, OntologicalDirection>;
  actionStack: ActionItem[]; ambiguities: AmbiguityFlag[];
  balance: number; leadDirection: DirectionName;
  neglectedDirections: DirectionName[];
  ceremonyGuidance: CeremonyGuidance | null;
  ceremonyRequired: boolean; wilsonAlignment: number;
  narrativeBeats: NarrativeBeat[];
}

interface ActionItem {
  id: string; text: string; direction: DirectionName; dependency: string | null;
  completed: boolean; confidence: number; implicit: boolean;
  epistemicSource?: EpistemicSourceHint; epistemicWeight?: number;
}

interface StoredDecomposition { id: string; timestamp: string; prompt: string; result: OntologicalDecomposition; markdownPath?: string; }
interface DecomposerOptions { extractImplicit?: boolean; mapDependencies?: boolean; ceremonyThreshold?: number; workdir?: string; }
```

### Classes & Functions

```typescript
class MedicineWheelDecomposer {
  decompose(prompt: string, options?: DecomposerOptions): OntologicalDecomposition
}
function detectEpistemicSource(text: string): EpistemicSourceHint

class RelationalEnricher {
  enrich(decomposition, graph): EnrichmentResult
}
interface RelationalGraph { nodes: RelationalNode[]; edges: RelationalEdge[]; relations: Relation[]; }
interface EnrichmentResult { decomposition: OntologicalDecomposition; mappings: IntentNodeMapping[]; accountabilityGaps: AccountabilityGap[]; relationalHealth: number; }
interface IntentNodeMapping { intentId: string; nodeId: string; nodeName: string; nodeType: string; confidence: number; }
interface AccountabilityGap { intentId: string; direction: DirectionName; gap: string; suggestion: string; }

// Storage (Node.js only — NOT in browser entry)
saveDecomposition(workdir, result): StoredDecomposition
loadDecomposition(workdir, id): StoredDecomposition | null
listDecompositions(workdir): StoredDecomposition[]
decompositionToMarkdown(result): string
```

---

## ui-components — `medicine-wheel-ui-components@0.1.2`

### DirectionCard
```typescript
interface DirectionCardProps {
  direction: DirectionName;
  data?: Direction;           // defaults to DIRECTIONS constant
  showOjibwe?: boolean;       // default: true
  onClick?: (direction: DirectionName) => void;
  selected?: boolean;
  className?: string;
}
// Renders: icon, direction name, Ojibwe name, medicine list, season, life stage
```

### BeatTimeline
```typescript
interface BeatTimelineProps {
  beats: NarrativeBeat[];
  selectedId?: string;
  onBeatClick?: (beat: NarrativeBeat) => void;
  height?: number;            // default: 120
  className?: string;
}
// Renders: horizontal timeline with direction-colored circular markers, act labels, ceremony indicators
```

### NodeInspector
```typescript
interface NodeInspectorProps {
  node: RelationalNode;
  edges?: RelationalEdge[];
  allNodes?: RelationalNode[];  // for resolving edge endpoints
  onClose?: () => void;
  onNavigate?: (nodeId: string) => void;
  className?: string;
}
// Renders: node header with type/direction badges, metadata key-value list, relations list with strength/ceremony indicators
```

### OcapBadge
```typescript
interface OcapBadgeProps {
  ocap?: OcapFlags;
  detailed?: boolean;          // default: false
  className?: string;
}
// Compact: "OCAP® ✓" / "OCAP® ✗" badge
// Detailed: Four individual O-C-A-P letter badges with green/red status
```

### WilsonMeter
```typescript
interface WilsonMeterProps {
  alignment: number;           // 0–1
  size?: number;               // default: 48
  showLabel?: boolean;         // default: true
  className?: string;
}
// SVG circular gauge: green ≥0.7, amber ≥0.4, red <0.4
```

### Note: No SpiralIndicator Component
The user mentioned `SpiralIndicator` — this component does NOT exist in the current codebase. Candidates for creation.

---

## Other Packages Found

### data-store — `medicine-wheel-data-store@0.1.3`
Redis CRUD layer. Exports: `getRedis`, `createRedisClient`, `disconnectRedis`, `createNode`, `getNode`, `getNodesByType`, `getNodesByDirection`, `getAllNodes`, `searchNodes`, `createEdge`, `getEdge`, `getRelatedNodes`, `updateEdgeCeremony`, `logCeremony`, `getCeremony`, `getCeremoniesTimeline`, `getCeremoniesByDirection`, `getCeremoniesByType`, `getAllCeremonies`, `getRelationalWeb`, `trackAccountability`, `getAccountability`, `linkSessionToCeremony`, `unlinkSessionFromCeremony`, `getSessionsForCeremony`, `getCeremoniesForSession`, `getLinkMetadata`, plus generic Redis helpers.

### session-reader — `medicine-wheel-session-reader@0.1.3`
Zero-dep JSONL session reader. Types: `SessionEvent`, `SessionAnalytics`, `SessionSummary`, `SessionFilters`. Functions: `listSessions`, `getDistinctModels`, `getSessionSummary`, `getSessionEvents`, `getSessionDetail`, `searchSessions`, `readSessionFile`, `getLatestEvents`.

### fire-keeper — `medicine-wheel-fire-keeper@0.1.0`
Coordination agent. Key types: `CeremonyPhaseExtended`, `QuadrantStatus`, `FireKeeperContext`, `GatingCondition`, `GatingConditionStatus`, `PermissionTier` ('observe'|'analyze'|'propose'|'act'), `DecisionPointType`, `DecisionPoint`, `TrajectoryCheckpoint`, `RelationalMilestone`, `StopWorkOrder`, `CeremonyStateExtended`, `FireKeeperConfig`, `FireKeeperState`. Message types: `ImportanceSubmittedMessage`, `CircleReturnMessage`, `AgentReportMessage`, `HumanResponseMessage`, etc. Key exports: `FireKeeper` class, `evaluateGates()`, `createGate()`, `resolveHold()`, `DEFAULT_GATES`, `humanNeeded()`, `permissionEscalation()`, `circleReview()`, `relationalCheckBack()`, `CeremonyStateManager`, `createCeremonyState()`, `trajectoryConfidence()`, `valueDivergenceDetect()`.

### importance-unit — `medicine-wheel-importance-unit@0.1.0`
Wilson's relational unit of knowledge. Key types: `EpistemicSource` ('land'|'dream'|'code'|'vision'), `AccountabilityLinkType` ('accountable-to'|'deepens'|'tensions-with'|'emerges-from'|'gates'|'circles-back-to'), `AxiologicalPillar`, `AccountabilityLink`, `CircleRefinement`, `GatingConditionStatus`, `CeremonyState`, `ImportanceUnit`. Zod schemas for all types. Functions for unit creation, epistemic weight computation, accountability tracking, circle tracking.

### relational-index — `medicine-wheel-relational-index@0.1.0`
Multi-dimensional relational indexing. Types for dimensions (direction, epistemic source, ceremony phase), index queries, metrics, spiral depth tracking, cross-dimensional analysis.

### transformation-tracker — `medicine-wheel-transformation-tracker@0.1.0`
Tracks researcher transformation. Types for relational shifts, reciprocity ledger, seven-generations impact, community indicators, research validity. Key functions: `wilsonValidityCheck()`.

### community-review — `medicine-wheel-community-review@0.1.0`
Community-based review workflows. Types for review circles, elder review, consensus protocols, accountability, outcomes. Zod schemas for all types.

### consent-lifecycle — `medicine-wheel-consent-lifecycle@0.1.0`
Consent lifecycle management. Types for consent scope, alerts, cascade propagation, ceremony integration. Functions for consent health checks, community consent, ceremony-based consent.

---

## Inter-Package Dependencies

```
ontology-core ─────────────────────────┐ (foundation — everything depends on this)
  ├── ceremony-protocol                 │
  ├── narrative-engine                  │
  ├── relational-query                  │
  ├── graph-viz (+ peer: react)         │
  ├── prompt-decomposition              │
  ├── ui-components (+ peer: react)     │
  ├── data-store (+ redis)              │
  ├── session-reader (zero deps)        │
  ├── importance-unit (+ zod)           │
  ├── relational-index                  │
  │                                     │
  ├── fire-keeper ──┬── ceremony-protocol
  │                 └── ontology-core    │
  ├── transformation-tracker ──┬── ceremony-protocol
  │                            └── ontology-core + zod
  ├── community-review ──┬── ceremony-protocol
  │                      └── ontology-core + zod
  └── consent-lifecycle ──┬── ceremony-protocol
                          └── ontology-core + zod
```

### Dependency Tree (npm names):
- `medicine-wheel-ontology-core` — **root dependency for ALL packages**
- `medicine-wheel-ceremony-protocol` — depends on `ontology-core`
- `medicine-wheel-fire-keeper` — depends on `ontology-core` + `ceremony-protocol`
- `medicine-wheel-transformation-tracker` — depends on `ontology-core` + `ceremony-protocol` + `zod`
- `medicine-wheel-community-review` — depends on `ontology-core` + `ceremony-protocol` + `zod`
- `medicine-wheel-consent-lifecycle` — depends on `ontology-core` + `ceremony-protocol` + `zod`
- All others depend only on `ontology-core`

---

## All Files Read (with 1-line summary each)

### ontology-core (6 files)
1. `ontology-core/package.json` — Package metadata, 6 export paths including types, schemas, vocabulary, constants, queries
2. `ontology-core/src/index.ts` — Master barrel export: 60+ types, 25+ constants, 24+ schemas, 20+ query functions
3. `ontology-core/src/types.ts` — All type definitions: Direction, Node, Edge, Relation, OCAP, Wilson, Ceremony, Narrative, RSIS, Epistemic
4. `ontology-core/src/constants.ts` — DIRECTIONS array with Ojibwe names, color maps, ceremony icons, RSIS suns/phases/roles
5. `ontology-core/src/schemas.ts` — Zod validation schemas for every core type, plus 10 ValidatedX inferred types
6. `ontology-core/src/vocabulary.ts` — 6 custom RDF namespaces (MW, IDS, OCAP, REL, CER, BEAT) + 6 W3C standard, predicate objects, IRI utilities
7. `ontology-core/src/queries.ts` — 20 query/traversal/Wilson/OCAP/narrative helper functions operating on in-memory collections

### ceremony-protocol (1 file)
8. `ceremony-protocol/src/index.ts` — Single file: CeremonyState, phase transitions, governance enforcement, extended phases, ceremony gate enforcement

### narrative-engine (7 files)
9. `narrative-engine/src/index.ts` — Barrel: types, sequencer, cadence, arc, timeline, cycle, rsis-narrative
10. `narrative-engine/src/types.ts` — BeatPosition, CadencePhase/Pattern/Validation, ArcCompleteness, TimelineAxis/Entry/Data, CycleTransition/Progress, EpistemicDepth, NarrativeTransformation
11. `narrative-engine/src/arc.ts` — computeCompleteness (weighted formula), validateArc (5 violation types), isArcComplete
12. `narrative-engine/src/sequencer.ts` — sequenceBeats, insertBeat, nextDirection, suggestNextBeat, spiralOrder, detectEpistemicDeepening, findTransformationPoints
13. `narrative-engine/src/timeline.ts` — buildTimeline (3 axes), actStrip (4-direction strip view)
14. `narrative-engine/src/cadence.ts` — STANDARD_CADENCE, LIGHT_CADENCE, currentPhase, validateCadence, detectTransitions
15. `narrative-engine/src/cycle.ts` — extractTransitions, computeProgress, createCycle, updateCycleMetadata
16. `narrative-engine/src/rsis-narrative.ts` — generateProvenanceNarrative, generateReciprocityObservation, generateDirectionObservation, getCeremonyPhaseFraming, describeSun

### relational-query (5 files)
17. `relational-query/src/index.ts` — Barrel: types, query, traversal, audit, cypher
18. `relational-query/src/types.ts` — NodeFilter, EdgeFilter, RelationFilter, QuerySort/Pagination/Options/Result, TraversalDirection/Options/Path/Result, AccountabilityReport
19. `relational-query/src/cypher.ts` — 12 Cypher query builders for KuzuDB RSIS graph + 2 formatters
20. `relational-query/src/query.ts` — filterNodes, filterEdges, filterRelations, sortNodes, paginate, filterByRelation, relationCounts, filterByMinRelations
21. `relational-query/src/traversal.ts` — traverse (BFS with ceremony/OCAP awareness), shortestPath, neighborhood
22. `relational-query/src/audit.ts` — auditAccountability (full report), isOcapCompliant, relationsNeedingAttention

### graph-viz (5 files)
23. `graph-viz/src/index.ts` — Barrel: component, types, layout, converters, rsis-viz
24. `graph-viz/src/types.ts` — MWGraphNode, MWGraphLink, MWGraphData, WheelLayoutConfig, MedicineWheelGraphProps, QuadrantGeometry
25. `graph-viz/src/layout.ts` — applyWheelLayout (circular positioning), DEFAULT_LAYOUT, getQuadrantGeometries, quadrantArcPath, curvedLinkPath, directionLabelPosition
26. `graph-viz/src/converters.ts` — nodesToGraphNodes, edgesToGraphLinks, relationsToGraphLinks, buildGraphData
27. `graph-viz/src/MedicineWheelGraph.tsx` — Pure SVG React component: quadrant backgrounds, direction labels, curved links, node circles with Wilson halos + OCAP indicators
28. `graph-viz/src/rsis-viz.ts` — toKinshipGraphLayout, toReciprocityFlowDiagram, toDirectionWheelData, toCeremonyTimelineData, toMermaidDiagram

### prompt-decomposition (5 files)
29. `prompt-decomposition/src/index.ts` — Barrel: types, decomposer, enricher, storage
30. `prompt-decomposition/src/index.browser.ts` — Browser-safe re-exports (excludes storage requiring Node.js)
31. `prompt-decomposition/src/types.ts` — PrimaryIntent, SecondaryIntent, OntologicalDirection, RelationalIntent, OntologicalDecomposition, ActionItem, DecomposerOptions
32. `prompt-decomposition/src/decomposer.ts` — MedicineWheelDecomposer class: keyword-based directional classification, intent extraction, dependency mapping, ceremony guidance, detectEpistemicSource()
33. `prompt-decomposition/src/relational_enricher.ts` — RelationalEnricher class: maps intents to graph nodes, scores Wilson alignment, identifies accountability gaps
34. `prompt-decomposition/src/storage.ts` — .pde/ folder persistence: saveDecomposition, loadDecomposition, listDecompositions, decompositionToMarkdown

### ui-components (5 files)
35. `ui-components/src/index.ts` — Barrel: DirectionCard, BeatTimeline, NodeInspector, OcapBadge, WilsonMeter
36. `ui-components/src/DirectionCard.tsx` — Direction display with Ojibwe name, medicine, season, life stage
37. `ui-components/src/BeatTimeline.tsx` — Horizontal timeline with direction-colored circular markers
38. `ui-components/src/NodeInspector.tsx` — Detail panel for RelationalNode with connected edges
39. `ui-components/src/OcapBadge.tsx` — Compact/detailed OCAP® compliance indicator
40. `ui-components/src/WilsonMeter.tsx` — SVG circular gauge for Wilson alignment (green/amber/red)

### data-store (4 files)
41. `data-store/src/index.ts` — Barrel: connection, store, session-link, helpers
42. `data-store/src/connection.ts` — Redis connection management
43. `data-store/src/store.ts` — CRUD for Nodes, Edges, Ceremonies, Accountability
44. `data-store/src/session-link.ts` — Session-ceremony bidirectional linking
45. `data-store/src/helpers.ts` — Generic Redis set/hash/sorted-set operations

### session-reader (2 files)
46. `session-reader/src/index.ts` — Barrel: types, sessions
47. `session-reader/src/types.ts` — SessionEvent, SessionAnalytics, SessionSummary, SessionFilters, EVENT_ICONS
48. `session-reader/src/sessions.ts` — JSONL file reading, session listing, filtering, analytics

### fire-keeper (8 files)
49. `fire-keeper/src/index.ts` — Barrel: types, messages, keeper, gating, decisions, check-back, ceremony-state, trajectory
50. `fire-keeper/src/types.ts` — CeremonyPhaseExtended, QuadrantStatus, FireKeeperContext, GatingCondition, PermissionTier, DecisionPoint, TrajectoryCheckpoint, StopWorkOrder, CeremonyStateExtended, FireKeeperConfig, FireKeeperState
51. `fire-keeper/src/keeper.ts` — FireKeeper class: importance evaluation, relational alignment checking
52. `fire-keeper/src/gating.ts` — evaluateGates, createGate, resolveHold, DEFAULT_GATES (Wilson, OCAP, Ceremony Phase)
53. `fire-keeper/src/decisions.ts` — humanNeeded, permissionEscalation, circleReview
54. `fire-keeper/src/check-back.ts` — relationalCheckBack protocol
55. `fire-keeper/src/ceremony-state.ts` — CeremonyStateManager, createCeremonyState, CompletionReadiness
56. `fire-keeper/src/messages.ts` — Fire Keeper message protocol types
57. `fire-keeper/src/trajectory.ts` — trajectoryConfidence, valueDivergenceDetect

### importance-unit (6 files)
58. `importance-unit/src/index.ts` — Barrel: types, schemas, unit, epistemic-weight, accountability, circle-tracking
59. `importance-unit/src/types.ts` — EpistemicSource, AccountabilityLinkType, AxiologicalPillar, ImportanceUnit, CircleRefinement
60. `importance-unit/src/schemas.ts` — Zod schemas for all importance-unit types
61. `importance-unit/src/unit.ts` — ImportanceUnit CRUD operations
62. `importance-unit/src/epistemic-weight.ts` — Epistemic weight computation
63. `importance-unit/src/accountability.ts` — Accountability gap detection
64. `importance-unit/src/circle-tracking.ts` — Circle refinement tracking

### relational-index (7 files)
65. `relational-index/src/index.ts` — Barrel: types, dimensions, index-manager, query, metrics, spiral-depth, cross-dimensional
66. `relational-index/src/types.ts` — Index dimension types
67. `relational-index/src/dimensions.ts` — Direction, epistemic, ceremony phase dimensions
68. `relational-index/src/index-manager.ts` — Multi-dimensional index manager
69. `relational-index/src/query.ts` — Index-aware query builder
70. `relational-index/src/metrics.ts` — Relational metrics computation
71. `relational-index/src/spiral-depth.ts` — Spiral depth tracking
72. `relational-index/src/cross-dimensional.ts` — Cross-dimensional analysis

### transformation-tracker (9 files)
73. `transformation-tracker/src/index.ts` — Barrel: types, schemas, researcher, relational-shift, reciprocity-ledger, seven-generations, community, validity, prompts
74. `transformation-tracker/src/types.ts` — Researcher transformation types
75. `transformation-tracker/src/schemas.ts` — Zod schemas
76. `transformation-tracker/src/researcher.ts` — Researcher transformation tracking
77. `transformation-tracker/src/relational-shift.ts` — Relational shift detection
78. `transformation-tracker/src/reciprocity-ledger.ts` — Reciprocity ledger management
79. `transformation-tracker/src/seven-generations.ts` — Seven-generations impact tracking
80. `transformation-tracker/src/community.ts` — Community indicators
81. `transformation-tracker/src/validity.ts` — wilsonValidityCheck
82. `transformation-tracker/src/prompts.ts` — RelationalMilestone type

### community-review (7 files)
83. `community-review/src/index.ts` — Barrel: types, schemas, circle, elder, consensus, accountability, outcomes
84. `community-review/src/types.ts` — Review circle types
85. `community-review/src/schemas.ts` — Zod schemas
86. `community-review/src/circle.ts` — Review circle management
87. `community-review/src/elder.ts` — Elder review protocol
88. `community-review/src/consensus.ts` — Consensus protocol
89. `community-review/src/accountability.ts` — Review accountability
90. `community-review/src/outcomes.ts` — Review outcome processing

### consent-lifecycle (8 files)
91. `consent-lifecycle/src/index.ts` — Barrel: types, schemas, lifecycle, cascade, alerts, ceremony, community, scope
92. `consent-lifecycle/src/types.ts` — Consent lifecycle types
93. `consent-lifecycle/src/schemas.ts` — Zod schemas
94. `consent-lifecycle/src/lifecycle.ts` — ConsentHealthResult, lifecycle management
95. `consent-lifecycle/src/cascade.ts` — Consent cascade propagation
96. `consent-lifecycle/src/alerts.ts` — Consent expiry alerts
97. `consent-lifecycle/src/ceremony.ts` — Ceremony-integrated consent
98. `consent-lifecycle/src/community.ts` — Community consent protocols
99. `consent-lifecycle/src/scope.ts` — Consent scope management

---

## Key Patterns for Forgewright Import

### Wilson Alignment Computation (exact algorithm)
```typescript
// From ontology-core/queries.ts
function computeWilsonAlignment(accountability: AccountabilityTracking): number {
  const { respect, reciprocity, responsibility } = accountability;
  return (respect + reciprocity + responsibility) / 3;
}
```

### Direction → Phase Mapping
```
east  → opening     (Act 1)
south → deepening   (Act 2)
west  → integrating (Act 3)
north → closing     (Act 4)
```

### Completeness Score Formula
```
completenessScore = (directionScore * 0.3) + (ceremonyScore * 0.25) + (wilsonAlignment * 0.25) + (balanceScore * 0.2)
```

### Color Thresholds
- Wilson ≥ 0.7 → green (`#22c55e` / `#4a9e5c`)
- Wilson ≥ 0.4 → amber (`#f59e0b` / `#c9a23a`)
- Wilson < 0.4 → red (`#ef4444` / `#dc143c`)
