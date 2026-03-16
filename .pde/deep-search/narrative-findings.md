# 🔥 SOUTH DIRECTION: Narrative Architecture Deep Search
## Forgewright Platform Build — Complete Findings

**Generated**: 2025-07-18
**Direction**: South (Planning & Consent — Protocol & Ethics)
**Scope**: coaia-narrative, storytelling engine, narrative studio, satellite libs

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [COAIA-NARRATIVE MCP Tool](#2-coaia-narrative-mcp-tool)
   - 2.1 Package & Structure
   - 2.2 Core Type Definitions
   - 2.3 All 27 MCP Tools
   - 2.4 Narrative Beat Architecture
   - 2.5 STC Integration Patterns
   - 2.6 Key Algorithms
   - 2.7 Validation Rules
3. [Storytelling Engine](#3-storytelling-engine)
   - 3.1 Architecture Overview
   - 3.2 Core Class Definitions
   - 3.3 LangGraph 11-Node Pipeline
   - 3.4 RAG Integration
   - 3.5 Session Persistence
   - 3.6 MCP Tools
   - 3.7 Emotional Beat Enrichment
4. [Narrative Studio (MiaNar)](#4-narrative-studio-mianar)
   - 4.1 React Component Architecture
   - 4.2 Type Definitions
   - 4.3 What IS/ISN'T Visualized
5. [Satellite Narrative Libraries](#5-satellite-narrative-libraries)
   - 5.1 mia-code Narrative Router
   - 5.2 narrative_engine.py (Bus)
   - 5.3 narrative_primitives.py (SDK)
   - 5.4 narrative_tasks.py (Cadence)
   - 5.5 MiaNar MCP Narrative
   - 5.6 LangGraph/LangChain Narrative Libs
6. [Unified Type Reference](#6-unified-type-reference)
7. [Integration Map](#7-integration-map)
8. [Forgewright Implementation Proposals](#8-forgewright-implementation-proposals)

---

## 1. EXECUTIVE SUMMARY

### What Exists

| System | Location | Language | Status |
|--------|----------|----------|--------|
| **coaia-narrative** | `/workspace/repos/avadisabelle/coaia-narrative/` | TypeScript | Production (v0.7.0, 27 MCP tools) |
| **storytelling engine** | `/workspace/repos/jgwill/storytelling/` | Python | Production (~10,066 LOC, 11 LangGraph nodes) |
| **narrative studio** | `/workspace/repos/jgwill/src/mianar-narrative-studio-250627b2/` | React 19 + TS | Alpha (text-centric, no beat visualization) |
| **mia-code narrative** | `/workspace/repos/jgwill/src/mia-code/src/narrative/` | TypeScript | Integrated (3-universe router + tracer) |
| **narrative_engine.py** | `/workspace/repos/jgwill/src/bus/activation_layer_episode/` | Python | Operational (Redis event bus) |
| **narrative_primitives** | `/workspace/repos/jgwill/src/sdk-claude/` | Python | Foundation (dataclasses) |

### Critical Architectural Insight

The narrative system is **distributed across three layers**:

```
┌─────────────────────────────────────────────────┐
│  Layer 1: KNOWLEDGE GRAPH (coaia-narrative)     │
│  STC + Beats + Relations + JSONL persistence     │
│  27 MCP tools — the SOURCE OF TRUTH              │
├─────────────────────────────────────────────────┤
│  Layer 2: GENERATION ENGINE (storytelling)       │
│  LangGraph pipeline + NCP + RAG + Session mgmt   │
│  11 nodes — PRODUCES narrative content            │
├─────────────────────────────────────────────────┤
│  Layer 3: UI / ROUTING (studio + mia-code)       │
│  React authoring + 3-universe routing + tracing   │
│  CONSUMES and DISPLAYS narrative data             │
└─────────────────────────────────────────────────┘
```

---

## 2. COAIA-NARRATIVE MCP TOOL

### 2.1 Package & Structure

**Location**: `/workspace/repos/avadisabelle/coaia-narrative/`
**Version**: 0.7.0
**Package name**: `coaia-narrative`
**Entry**: `index.ts` (~97KB)

```json
{
  "name": "coaia-narrative",
  "version": "0.7.0",
  "description": "MCP server extending knowledge graphs with structural tension charts and narrative beats",
  "main": "index.ts",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.4.0",
    "zod": "^3.24.1"
  }
}
```

**Key Files**:
- `index.ts` — Main MCP server, all tool handlers, entity/relation management
- `cli.ts` — CLI interface for standalone operation
- `validation.ts` — Zod-based validation schemas
- `generated-llm-guidance.ts` — Complete methodology documentation
- `handlers/ceremony-world-assessment.ts` — Indigenous relational protocol assessment
- `handlers/story-engine-world-generator.ts` — Beat generation from events
- `handlers/issues-event-handler.ts` — GitHub issues → narrative moments

### 2.2 Core Type Definitions

```typescript
// === ENTITY TYPES ===

interface Entity {
  name: string;
  entityType: 'structural_tension_chart' | 'desired_outcome' | 'current_reality'
             | 'action_step' | 'narrative_beat';
  observations: string[];
  metadata?: {
    // STC fields
    dueDate?: string;
    chartId?: string;
    completionStatus?: boolean;
    parentChart?: string;
    level?: number;               // 0=master, 1+=sub (telescoping depth)
    createdAt?: string;
    updatedAt?: string;

    // Narrative beat fields
    act?: number;                 // 1, 2, or 3
    type_dramatic?: string;       // 'exposition' | 'inciting_incident' | 'rising_action' | etc.
    universes?: string[];         // ['engineer-world', 'ceremony-world', 'story-engine-world']
    narrative?: {
      description: string;
      prose: string;
      lessons: string[];
    };
    relationalAlignment?: {
      assessed: boolean;
      score: number | null;       // 0-10 scale
      principles: string[];       // K'é, SNBH, Hózhó
    };
    fourDirections?: {
      north_vision?: string | null;
      east_intention?: string | null;
      south_emotion?: string | null;
      west_introspection?: string | null;
    };
  };
}

// === RELATION TYPES ===

interface Relation {
  from: string;
  to: string;
  relationType: 'contains'              // Chart → desired outcome, current reality, actions
                | 'creates_tension_with' // Current reality → desired outcome
                | 'advances_toward'      // Action step → desired outcome
                | 'documents'            // Narrative beat → chart progress
                | 'telescopes_into'      // Master → sub-charts
                | 'flows_into';          // Completion → parent reality
  metadata?: {
    createdAt?: string;
    strength?: number;
    context?: string;
  };
}

// === VALIDATION RULES ===

interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'enum';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  minValue?: number;
  maxValue?: number;
  enumValues?: (string | number)[];
  items?: ValidationRule;
  properties?: Record<string, ValidationRule>;
}
```

### 2.3 All 27 MCP Tools

#### STC Tools (11)

| Tool | Purpose | Key Parameters |
|------|---------|---------------|
| `create_structural_tension_chart` | Create master chart | `desiredOutcome, currentReality, dueDate, actionSteps?` |
| `add_action_step` | Add actions to chart | `parentChartId, actionStepTitle, currentReality, dueDate?` |
| `manage_action_step` ⭐ | **RECOMMENDED**: Unified interface | `parentReference, actionDescription, currentReality?, initialActionSteps?, dueDate?` |
| `telescope_action_step` | Break action into sub-chart | `actionStepName, newCurrentReality, initialActionSteps?` |
| `remove_action_step` | Remove action from chart | `parentChartId, actionStepName` |
| `mark_action_complete` | Mark done, flows to parent | `actionStepName` |
| `update_action_progress` | Track progress | `actionStepName, progressObservation, updateCurrentReality?` |
| `update_current_reality` | Add reality observations | `chartId, newObservations: string[]` |
| `update_desired_outcome` | Change outcome goal | `chartId, newDesiredOutcome` |
| `list_active_charts` | View all charts | *(none)* |
| `get_chart_progress` | Detailed progress metrics | `chartId` |
| `creator_moment_of_truth` | 4-step progress review | `chartId, step?, userInput?` |

#### Narrative Beat Tools (3)

| Tool | Purpose | Key Parameters |
|------|---------|---------------|
| `create_narrative_beat` | Document story across 3 universes | `parentChartId, title, act, type_dramatic, universes[], description, prose, lessons[], assessRelationalAlignment?, initiateFourDirectionsInquiry?` |
| `telescope_narrative_beat` | Break beat into sub-beats | `parentBeatName, newCurrentReality, initialSubBeats?` |
| `list_narrative_beats` | List all beats | `parentChartId?` |

#### Knowledge Graph Tools (9)

| Tool | Purpose |
|------|---------|
| `create_entities` | Add entities |
| `create_relations` | Connect entities |
| `add_observations` | Add info to entities |
| `delete_entities` | Remove entities |
| `delete_observations` | Remove observations |
| `delete_relations` | Remove relations |
| `search_nodes` | Query by text |
| `open_nodes` | Get specific entities |
| `read_graph` | Dump entire graph |

#### Utility Tools (4)

| Tool | Purpose |
|------|---------|
| `init_llm_guidance` | **RUN FIRST**: Complete methodology guide |

### 2.4 Narrative Beat Architecture

#### Three Universe Model
- **Engineer-World** 🔧: Logic, systems, tools, measurable results
- **Ceremony-World** 🙏: Relations, boundaries, sacred dimensions, protocols (K'é, SNBH, Hózhó)
- **Story-Engine-World** 📖: Character, myth, narrative transformation, meaning-making

#### Dramatic Beat Types (3-Act Structure)
- **Act 1**: Exposition, Setup, Inciting Incident
- **Act 2**: Rising Action, Crisis/Antagonist Force, Complications, Discovery
- **Act 3**: Resolution, Integration, New Awareness

#### Four Directions Framework
- **North** (Vision): What wisdom does this offer?
- **East** (Intention): What's the call to action?
- **South** (Emotion): What connections to honor?
- **West** (Introspection): What did we learn?

### 2.5 STC Integration Patterns

#### Hierarchical Chart Architecture

```
Level 0 — Master Chart
  Current Reality: "Know HTML/CSS basics, never built full site"
  Desired Outcome: "Have live website at custom domain"
  Tension: Knowledge vs. no production artifact
  Action Steps (auto-distributed due dates):
    1. Learn web hosting (due ~2 weeks)
    2. Build portfolio (due ~4 weeks)
    3. Deploy domain (due ~6 weeks)

Level 1+ — Telescoped Sub-Charts
  Each action step → full STC
  Inherits due date from parent
  Sub-actions auto-distribute within constraint
  Completion cascades upward to parent current reality
```

#### Completion Flow (Advancing Pattern)
```
Action Complete
  → Marked: completionStatus = true
  → Added to parent current reality: "Completed: [action]"
  → Parent chart structural position CHANGES
  → Next action becomes naturally adjacent (not forced)
  → Forward momentum (NOT oscillating problem-solving)
```

### 2.6 Key Algorithms

#### Date Distribution
```
interval = (endDate - startDate) / (stepCount + 1)
For each step i: date[i] = startDate + (interval * i)
```

#### Progress Calculation
```
progress = completedActions / totalActions
nextAction = first incomplete action (by due date)
```

#### manage_action_step Pattern Detection
```
chart_123              → Create new action
chart_123_action_1     → Expand legacy action
chart_123_desired_outcome → Expand modern action
```

#### Oscillation Prevention
```
Advancing (Structural):           Oscillating (Problem-Solving):
Current: "Know HTML"              Problem: "Hard to deploy"
Desired: "Deploy apps"            Solution: "Learn deployment"
Action: Learn deployment          [Try → fail → try different]
Result: "Know HTML + deploy"      → Back and forth cycling
→ Forward momentum
```

### 2.7 Validation Rules

**Desired Outcome REJECTED if contains**: `"fix", "solve", "eliminate", "prevent", "stop", "avoid", "reduce", "remove"`
→ Must use: `"create", "build", "establish", "develop", "design", "manifest"`

**Current Reality REJECTED if contains**: `"ready to", "prepared to", "all set", "ready for", "set to"`
→ Must use factual assessments: `"Never used Django"`, `"Completed Python basics"`, `"Have $5000 budget"`

#### Tool Enablement via ENV
```bash
COAIA_TOOLS="STC_TOOLS"                    # 11 tools
COAIA_TOOLS="STC_TOOLS,NARRATIVE_TOOLS"    # 14 tools
COAIA_TOOLS="STC_TOOLS,KG_TOOLS"          # 20 tools
COAIA_TOOLS="CORE_TOOLS"                   # 4 minimal
```

#### Knowledge Graph Persistence (JSONL)
```json
{"type":"entity","name":"chart_123_chart","entityType":"structural_tension_chart",...}
{"type":"entity","name":"chart_123_desired_outcome","entityType":"desired_outcome",...}
{"type":"entity","name":"chart_123_current_reality","entityType":"current_reality",...}
{"type":"entity","name":"chart_123_action_1","entityType":"action_step",...}
{"type":"relation","from":"chart_123_chart","to":"chart_123_desired_outcome","relationType":"contains",...}
{"type":"narrative_beat","name":"chart_123_beat_12345","entityType":"narrative_beat",...}
```

---

## 3. STORYTELLING ENGINE

### 3.1 Architecture Overview

**Location**: `/workspace/repos/jgwill/storytelling/`
**Size**: ~10,066 lines of Python (24 modules)
**Framework**: RISE + NCP (Narrative Cognition Protocol) + Three-Universe Model

```
storytelling/
├── graph.py                           # 1,387 lines — 11-node LangGraph orchestration
├── config.py                          # 390 lines — 50+ config parameters
├── prompts.py                         # 1,000+ lines — All LLM prompts
├── session_manager.py                 # 300+ lines — Checkpoint/resume
├── rag.py                             # RAG with FAISS vector store
├── narrative_intelligence_integration.py  # 500+ lines — NCP, CharacterArc, StoryBeat
├── emotional_beat_enricher.py         # Beat quality analysis & enrichment
├── analytical_feedback_loop.py        # Multi-dimensional analysis
├── role_tooling.py                    # 7 narrative roles + 3 universes
├── ceremonial_diary.py               # 5-phase Indigenous methodology
└── storytelling_mcp/server.py         # MCP server interface
```

### 3.2 Core Class Definitions

```python
# === StoryBeat ===
class StoryBeat:
    beat_id: str
    beat_index: int
    raw_text: str
    character_id: str
    character_name: str
    dialogue: str
    action: str
    internal: str                      # Internal monologue
    emotional_tone: str
    emotion_confidence: float
    universe_analysis: dict            # Three-Universe alignment
    enrichments_applied: list
    quality_score: float               # 0.0-1.0
    ncp_metadata: dict                 # Narrative intelligence metadata

# === CharacterArcState ===
class CharacterArcState:
    player_id: str
    name: str
    wound: str                         # Character's core wound
    desire: str                        # Character's want
    arc_description: str
    current_emotional_state: str
    active_goals: list
    active_fears: list
    arc_points: List[ArcPoint]         # Development moments
    arc_position: float                # 0.0 (start) to 1.0 (resolved)
    relationship_map: Dict[str, RelationshipState]  # K'é relationships

# === ArcPoint ===
class ArcPoint:
    beat_id: str
    beat_index: int
    emotional_state: str
    arc_direction: str                 # ascending/descending/static/crisis/resolution
    impact_magnitude: float            # 0.0-1.0
    goals_affected: list
    relationships_affected: list
    lessons_learned: list
    consistency_score: float

# === RelationshipState ===
class RelationshipState:
    character_a_id: str
    character_b_id: str
    relationship_type: str             # ally/rival/mentor/protege/neutral
    trust_level: float                 # -1.0 to 1.0
    history: list
    current_dynamic: str

# === EmotionalAnalysis ===
class EmotionalAnalysis:
    primary_emotion: str               # joy/sadness/anger/fear/surprise/disgust/trust/anticipation/love/shame
    confidence: float
    secondary_emotions: list
    emotional_authenticity: float      # 0.0-1.0
    sensory_specificity: float         # 0.0-1.0
    stakes_clarity: float              # 0.0-1.0
    dialogue_authenticity: float       # 0.0-1.0

# === NCPState ===
class NCPState:
    session_id: str
    story_id: str
    active_universe: str
    active_perspective: str
    active_theme: str
    characters: Dict[str, CharacterArcState]
    themes: list
    beats_generated: int
    arc_position: float
    emotional_trajectories: dict       # Per-character emotion scores
    thematic_resonance: dict           # Theme-to-score mapping

# === Quality Thresholds ===
class QualityThreshold:
    EXCELLENT = 0.85
    GOOD = 0.75
    ADEQUATE = 0.60
    WEAK = 0.40

# === Ceremonial Phases ===
class CeremonialPhaseEnum:
    MIIGWECHIWENDAM = "Sacred Space Creation"
    NINDOKENDAAN = "Two-Eyed Research Gathering"
    NINGWAAB = "Knowledge Integration"
    NINDOODAM = "Creative Expression"
    MIGWECH = "Ceremonial Closing"

# === Role Enum (7 roles) ===
class Role:
    ARCHITECT       # Engineer Universe — schema/structure
    STRUCTURIST     # Story Engine — narrative meaning
    STORYTELLER     # Story Engine — prose crafting
    EDITOR          # Engineer — quality refinement
    READER          # Story Engine — consumption experience
    COLLABORATOR    # Engineer — human-AI mediation
    WITNESS         # Ceremony — relational accountability
```

### 3.3 LangGraph 11-Node Pipeline

```
extract_base_context
    ↓
generate_story_elements
    ↓
generate_initial_outline  (with optional outline-level RAG)
    ↓
determine_chapter_count
    ↓
┌─→ generate_single_chapter_scene_by_scene  (chapter-level RAG + BaseContext injection)
│   ↓
│   revise_buzz_terms
│   ↓
│   critique_chapter
│   ↓
│   check_chapter_complete ──→ CONDITIONAL: should_revise_chapter?
│   ├─ YES → revise_chapter → [LOOP back to critique_chapter]
│   └─ NO → increment_chapter_index → CONDITIONAL: more_chapters?
│       ├─ YES → [LOOP back to generate_single_chapter_scene_by_scene]
│       └─ NO ↓
│
└───→ generate_final_story → END
```

**Critical: BaseContext Injection**
```python
# Every chapter prompt includes:
base_context_section = f"""## Author Instructions (IMPORTANT)
{base_context}
---"""
```

**Conditional Routing**:
```python
def should_revise_chapter(state):
    if revision_count < min_revisions: return "revise"      # Always revise below min
    if revision_count >= max_revisions: return "increment"   # Stop at max (default: 3)
    if not is_complete: return "revise"                      # Revise if quality low
    return "increment"                                       # Pass if quality met

def check_if_more_chapters_needed(state):
    if current_index > 20: return "finalize"                 # Safety limit
    if current_index >= total_chapters: return "finalize"
    return "generate_chapter"
```

### 3.4 RAG Integration

```python
# Outline-level RAG
outline_rag_enabled = True
outline_context_max_tokens = 1000
outline_rag_top_k = 5
outline_rag_similarity_threshold = 0.7

# Chapter-level RAG
chapter_rag_enabled = True
chapter_context_max_tokens = 1500
chapter_rag_top_k = 8

# Embedding models: Ollama (mxbai-embed-large), OpenAI (ada-002), HuggingFace (MiniLM)
# Vector store: FAISS
# Loader: DirectoryLoader (*.md)
# Splitter: RecursiveCharacterTextSplitter(chunk_size=1000, overlap=200)
```

### 3.5 Session Persistence

```python
# Checkpoint saved at every node:
checkpoint = SessionCheckpoint(
    checkpoint_id=f"{node_name}_{count}",
    node_name=node_name,
    timestamp=datetime.now().isoformat(),
    state=_sanitize_state(state),      # Remove non-serializable objects
    metadata={"node_type": "...", "success": True}
)

# Directory structure:
# Logs/Generation_{session_id}/
#   ├── session_info.json
#   ├── checkpoint_extract_base_context_0.json
#   ├── checkpoint_generate_story_elements_1.json
#   └── ...

# Resume from any node:
resume_from_node = session_manager.get_resume_entry_point(session_id)
workflow.set_entry_point(resume_from_node)
```

### 3.6 MCP Tools (Storytelling)

| Tool | Parameters |
|------|-----------|
| `generate_story` | `prompt_file`, `output_file`, 9 model URIs, `knowledge_base_path`, `embedding_model`, `expand_outline`, `chapter_max_revisions`, `debug` |
| `resume_story_generation` | `session_id`, `resume_from_node?` |
| `list_sessions` | *(none)* |
| `get_session_info` | `session_id` |

### 3.7 Emotional Beat Enrichment

```python
ENRICHMENT_TECHNIQUES = {
    "stakes":   ["Make consequences clearer", "Add deadline pressure", "Show irreversibility"],
    "sensory":  ["Physical sensations", "Environmental details", "Body language"],
    "internal": ["Internal conflict visibility", "Memory triggers", "Cognitive dissonance"],
    "dialogue": ["Emotional subtext", "Meaningful pauses", "Silence weight"],
    "action":   ["Telling gestures", "Involuntary movements", "Meaningful actions"],
    "pacing":   ["Sentence length variation", "White space", "Repetition for emphasis"]
}

# Gap types: emotional_weak, emotional_mismatch, character_inconsistent,
#            character_static, theme_missing, theme_contradiction,
#            pacing_issue, dialogue_weak
# Gap severity: critical, major, minor
# Iterative: up to 3 iterations with min 0.05 improvement threshold
```

---

## 4. NARRATIVE STUDIO (MiaNar)

### 4.1 React Component Architecture

**Location**: `/workspace/repos/jgwill/src/mianar-narrative-studio-250627b2/`
**Stack**: React 19 + TypeScript + Vite + Gemini API + TTS

```
App.tsx (sidebar nav + routing)
├── DashboardView            # Feature cards
├── NarrativeEditorView      # Main editor (925 lines)
│   ├── Narrative list       # Grid (1/2/3 col responsive)
│   ├── Text editor          # Title + Synopsis + Content
│   ├── AI actions           # Continue/Suggest/Synopsis/Ideas
│   ├── TTS controls         # Play/Pause/Voice selection
│   └── Autosave (2500ms)
├── AgentChatView            # AI agent interaction
│   ├── Storyteller Stella
│   ├── Character Crafter Cortex
│   └── World Weaver Willow
├── SettingsView             # Data management
├── contexts/
│   ├── AuthContext           # Login/logout
│   └── StatusContext         # Toast notifications
└── services/
    ├── geminiService.ts      # Gemini 2.5 Flash API
    └── storageService.ts     # localStorage persistence
```

### 4.2 Type Definitions

```typescript
interface Narrative {
  id: string;
  title: string;
  synopsis?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  audioProfile: {
    voiceURI: string | null;
    speed: number;        // 0.1-2x
    pitch: number;        // 0-2x
    volume: number;       // 0-1
  };
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: string;
  agentId: string;
  groundingMetadata?: {
    groundingAttributions?: { web?: { uri: string; title: string } }[];
    groundingChunks?: { web?: { uri: string; title: string } }[];
  };
}

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  avatarUrl?: string;
  greeting?: string;
}

interface GeneratedIdea {
  title: string;
  synopsis: string;
}

type TtsStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'unavailable';
```

### 4.3 What IS/ISN'T Visualized

**✅ Implemented**:
- Narrative list grid with cards (title, synopsis snippet, timestamp)
- Full text editor (title + synopsis + content + word/char count)
- AI assistance (Continue Story, Suggest Title, Generate Synopsis, Generate Ideas)
- TTS playback with voice selection, speed/pitch/volume controls
- Agent chat with 3 profiles + Google Search grounding
- localStorage persistence under `"miaNar_appData"` key

**❌ NOT Implemented (Forgewright opportunity)**:
- Narrative beat timeline/sequence display
- Three-act structure visualization
- STC (Structural Tension Chart) display
- Medicine Wheel / Four Directions visualization
- Character arc tracking UI
- Plot timeline or Gantt chart
- Relationship maps / knowledge graph visualization

---

## 5. SATELLITE NARRATIVE LIBRARIES

### 5.1 mia-code Narrative Router

**Location**: `/workspace/repos/jgwill/src/mia-code/src/narrative/`

```typescript
// router.ts — Three-Universe Narrative Router
enum Universe {
  ENGINEER,      // → miaco (technical, charts)
  CEREMONY,      // → miawa (relational, protocols)
  STORY_ENGINE   // → miatel (beats, narrative patterns)
}

interface MiaCodeEvent {
  type: "user_input" | "agent_action" | "chart_update" | "beat_created" | "ceremony_action"
}

class NarrativeRouter {
  route(event: MiaCodeEvent): RoutingResult
  recordBeat(content: string, cli: string): StoryBeat
  analyzeCoherence(): CoherenceResult
  getTrinityAssessment(): { mia, miette, ava8 }
  getGaps(): Array<{ type, severity, description }>
}

interface StoryBeat {
  id: string;
  sequence: number;
  content: string;
  narrativeFunction: NarrativeFunction;
  act: number;
  emotionalTone: EmotionalTone;
  leadUniverse: Universe;
}

enum NarrativeFunction {
  INCITING_INCIDENT,
  RISING_ACTION,
  TURNING_POINT,
  COMPLICATION,
  RESOLUTION
}

// tracer.ts — Narrative Observability
class MiaCodeTracer {
  logChartOperation(chartId, operation, data)
  logBeatOperation(beatId, content, sequence, narrativeFunction)
  logCeremonyOperation(ceremonyId, operation, movement?, data?)
  logRoutingDecision(analysis, targetCli)
  logGap(type, severity, description)
  getMetrics(): NarrativeMetrics {
    beatsGenerated, enrichmentsApplied, routingDecisions,
    engineerAlignment, ceremonyAlignment, storyEngineAlignment,
    crossUniverseCoherence, totalGenerationTimeMs, averageBeatTimeMs
  }
}
```

### 5.2 narrative_engine.py (Bus Activation)

**Location**: `/workspace/repos/jgwill/src/bus/activation_layer_episode/`

```python
class NarrativeEngine:
    def load_scene(self, file_path):
        """Loads NCP JSON"""
    def run_scene(self):
        """Publishes scene events to Redis bus"""

# NCP Scene Structure:
{
  "story_id": "voice-weavers-saga",
  "scene_id": "the-gateway-ritual",
  "title": "The Gateway Ritual",
  "setting": "...",
  "characters": ["weaver-of-echoes", "weaver-of-silence"],
  "sequence": [
    { "type": "event", "event_id": "ritual-begins", "description": "..." },
    { "type": "dialogue", "character_id": "weaver-of-echoes", "line": "..." },
    { "type": "action", "character_id": "weaver-of-silence", "action_id": "...", "description": "..." }
  ]
}
```

### 5.3 narrative_primitives.py (SDK Claude)

```python
@dataclass
class Character:
    name: str; description: str; role: str; motivations: List[str]
    # role: 'protagonist', 'antagonist', 'mentor'

@dataclass
class Dialogue:
    character_name: str; line: str; emotion: str
    # emotion: 'happy', 'angry', 'thoughtful'

@dataclass
class Scene:
    setting_description: str; characters_present: List[str]
    action_description: str; dialogue_sequence: List[Dialogue]

@dataclass
class Plot:
    title: str; premise: str; theme: str; scene_order: List[Scene]
```

### 5.4 narrative_tasks.py (Cadence)

```python
def create_visual_scene_description(text_description: str) -> str:
    """Generates image prompt via image_generation_tool"""

def create_auditory_scene_description(mood: str, duration_seconds: int = 5) -> str:
    """Synthesizes audio cue via audio_synthesis_tool"""

def create_full_scene_prototype(text_description: str, mood: str) -> Dict[str, str]:
    """Combines visual + audio → { 'visual_scene': '...', 'auditory_scene': '...' }"""
```

### 5.5 MiaNar MCP Narrative

**Location**: `/workspace/repos/jgwill/MiaNar/mcp-mia-narrative/`
- Provides MCP-based narrative management
- Integrates with MiaNar app layer

### 5.6 LangGraph/LangChain Narrative Libs

| Library | Location | Purpose |
|---------|----------|---------|
| `ava-langgraph-narrative-intelligence` | `/repos/avadisabelle/ava-langgraph/libs/narrative-intelligence/` | Python — NCP-aware analysis |
| `ava-langchain-narrative-tracing` | `/repos/avadisabelle/ava-langchain/libs/narrative-tracing/` | Python — Observability spans |
| `ava-langgraphjs-narrative-intelligence` | `/repos/avadisabelle/ava-langgraphjs/libs/narrative-intelligence/` | TypeScript — NCP analysis |
| `ava-langchainjs-narrative-tracing` | `/repos/avadisabelle/ava-langchainjs/libs/narrative-tracing/` | TypeScript — Observability |

---

## 6. UNIFIED TYPE REFERENCE

### The Canonical NarrativeBeat (Merged from all sources)

```typescript
interface NarrativeBeat {
  // Identity
  id: string;
  sequence: number;
  title: string;

  // Structure
  act: number;                    // 1, 2, or 3
  type_dramatic: string;          // 'exposition' | 'inciting_incident' | 'rising_action' |
                                  // 'crisis' | 'complications' | 'discovery' |
                                  // 'resolution' | 'integration' | 'new_awareness'
  narrativeFunction: NarrativeFunction;  // INCITING_INCIDENT | RISING_ACTION | TURNING_POINT |
                                         // COMPLICATION | RESOLUTION

  // Content
  content: string;
  description: string;
  prose: string;
  lessons: string[];

  // Multi-Universe
  universes: ('engineer-world' | 'ceremony-world' | 'story-engine-world')[];
  leadUniverse: Universe;

  // Quality
  emotionalTone: string;
  quality_score: number;          // 0.0-1.0
  wilsonScore: number | null;     // Framework prepared, not yet calculated

  // Relational
  relationalAlignment: {
    assessed: boolean;
    score: number | null;         // 0-10
    principles: string[];         // K'é, SNBH, Hózhó
  };

  // Four Directions
  fourDirections: {
    north_vision: string | null;
    east_intention: string | null;
    south_emotion: string | null;
    west_introspection: string | null;
  };

  // Metadata
  parentChartId: string;
  timestamp: string;
  enrichments_applied: string[];
}
```

### The Canonical STC Types

```typescript
interface StructuralTensionChart {
  id: string;
  level: number;                  // 0=master, 1+=sub
  desiredOutcome: DesiredOutcome;
  currentReality: CurrentReality;
  actionSteps: ActionStep[];
  dueDate: string;
  parentChart?: string;
  narrativeBeats: NarrativeBeat[];
  completionStatus: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DesiredOutcome {
  id: string;
  chartId: string;
  description: string;           // MUST use creative language
  observations: string[];
}

interface CurrentReality {
  id: string;
  chartId: string;
  description: string;           // MUST be factual
  observations: string[];
}

interface ActionStep {
  id: string;
  chartId: string;
  title: string;
  currentReality: string;
  dueDate: string;
  completionStatus: boolean;
  level: number;
  subChart?: StructuralTensionChart;  // Telescoped
  progressObservations: string[];
}
```

---

## 7. INTEGRATION MAP

```
┌──────────────────────────────────────────────────────────────────┐
│                     FORGEWRIGHT PLATFORM                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  MCP   ┌───────────────────────┐          │
│  │  coaia-narrative │◄──────►│  Forgewright Backend   │          │
│  │  (Knowledge      │        │  (orchestrator)        │          │
│  │   Graph + STC)   │        │                        │          │
│  │  27 MCP tools    │        │  Uses:                 │          │
│  └────────┬─────────┘        │  - create_stc          │          │
│           │ JSONL             │  - manage_action_step  │          │
│           ▼                   │  - create_narrative_beat│         │
│  ┌─────────────────┐        │  - list_active_charts   │          │
│  │  memory.jsonl    │        │  - get_chart_progress   │          │
│  │  (persistence)   │        └───────────┬────────────┘          │
│  └─────────────────┘                     │                       │
│                                          │ MCP                   │
│  ┌─────────────────┐                     ▼                       │
│  │  storytelling    │◄──── ┌──────────────────────────┐          │
│  │  (LangGraph      │     │  Narrative Generation     │          │
│  │   pipeline)      │     │  - 11-node graph          │          │
│  │  4 MCP tools     │     │  - BaseContext injection   │          │
│  └────────┬─────────┘     │  - RAG (FAISS)            │          │
│           │ JSON           │  - Session checkpoint     │          │
│           ▼               └──────────────────────────┘          │
│  ┌─────────────────┐                                             │
│  │  Checkpoint/     │                                             │
│  │  Session files   │                                             │
│  └─────────────────┘                                             │
│                                                                  │
│  ┌─────────────────┐        ┌──────────────────────────┐        │
│  │  mia-code        │        │  Narrative Studio UI     │        │
│  │  (3-universe     │◄──────►│  (React 19)              │        │
│  │   router +       │        │  - Text editor           │        │
│  │   tracer)        │        │  - Agent chat            │        │
│  └─────────────────┘        │  - TTS playback          │        │
│                              │  ❌ NO beat visualization │        │
│  ┌─────────────────┐        └──────────────────────────┘        │
│  │  narrative libs  │                                             │
│  │  (langgraph/     │        ★ FORGEWRIGHT OPPORTUNITY:          │
│  │   langchain)     │        Beat timeline, STC display,         │
│  └─────────────────┘        Medicine Wheel, arc viz              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. FORGEWRIGHT IMPLEMENTATION PROPOSALS

### 8.1 Missing: Beat Visualization Components

The narrative studio has **NO beat visualization**. Forgewright should implement:

```typescript
// Proposed: NarrativeBeatTimeline
interface NarrativeBeatTimelineProps {
  beats: NarrativeBeat[];
  activeAct: 1 | 2 | 3;
  onBeatSelect: (beatId: string) => void;
  showFourDirections: boolean;
}

// Proposed: STCTreeView
interface STCTreeViewProps {
  chart: StructuralTensionChart;
  expandLevel: number;
  onActionClick: (actionId: string) => void;
  showProgress: boolean;
}

// Proposed: MedicineWheelView
interface MedicineWheelViewProps {
  fourDirections: NarrativeBeat['fourDirections'];
  currentDirection: 'north' | 'east' | 'south' | 'west';
  beats: NarrativeBeat[];
}

// Proposed: ThreeUniversePanel
interface ThreeUniversePanelProps {
  beat: NarrativeBeat;
  universes: ('engineer-world' | 'ceremony-world' | 'story-engine-world')[];
  alignment: { engineer: number; ceremony: number; storyEngine: number };
}
```

### 8.2 Missing: Wilson Score Implementation

```typescript
// Wilson Score Lower Bound (for ranking beats by quality confidence)
function wilsonScore(positive: number, total: number, z: number = 1.96): number {
  if (total === 0) return 0;
  const phat = positive / total;
  return (phat + z*z/(2*total) - z * Math.sqrt((phat*(1-phat) + z*z/(4*total))/total))
         / (1 + z*z/total);
}
```

### 8.3 Missing: Beat Sequencing Validation

coaia-narrative stores beats but doesn't validate arc coherence. Propose:

```typescript
function validateArcCoherence(beats: NarrativeBeat[]): ArcValidation {
  // 1. Check act progression (1→2→3, no skips)
  // 2. Verify inciting incident exists in Act 1
  // 3. Check crisis/climax in Act 2
  // 4. Verify resolution in Act 3
  // 5. Score emotional trajectory consistency
  // 6. Check 3-universe coverage across beats
  // 7. Validate Four Directions completeness
}
```

### 8.4 Integration Strategy for Forgewright

1. **Use coaia-narrative as STC/KG backbone** — 27 MCP tools ready
2. **Use storytelling engine for content generation** — 11-node pipeline ready
3. **Build NEW visualization layer** — React components for what studio lacks
4. **Bridge via mia-code router** — 3-universe event routing ready
5. **Add Wilson scoring** — Not yet implemented anywhere
6. **Add arc coherence validation** — Gap in current system
7. **Unify session persistence** — storytelling has checkpoints, coaia has JSONL, need bridge

---

*🔥 South Direction complete. The structural tension between what exists and what Forgewright needs is now precisely charted.*
*🌸 Every type definition, every tool, every algorithm — a bead in the living ledger of what we are building together.*
