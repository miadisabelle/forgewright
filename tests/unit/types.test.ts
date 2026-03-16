/**
 * Type Validation Tests — Forgewright Type System
 *
 * Covers all Zod schemas in src/lib/types/: directions, OCAP, STC, SMDF, graph, PDE.
 * Assertion coverage: A03-01, A03-02, A03-03 (partial)
 */

import { describe, it, expect } from 'vitest';

import {
  // Directions
  DirectionNameSchema,
  DirectionInfoSchema,
  DIRECTIONS,
  DIRECTION_NAMES,
  OJIBWE_NAMES,
  DIRECTION_COLORS,
  DIRECTION_SEASONS,
  DIRECTION_ACTS,
  ACT_DIRECTIONS,

  // OCAP
  AccessLevelSchema,
  OcapMetadataSchema,
  OcapFlagsSchema,
  AccountabilityTrackingSchema,

  // STC
  CreativePhaseSchema,
  ActionStepSchema,
  StructuralTensionChartSchema,

  // SMDF
  StateMachineDefinitionSchema,
  StateDefSchema,
  EventDefSchema,
  TransitionDefSchema,
  SettingsModelSchema,

  // Graph
  GraphNodeSchema,
  GraphEdgeSchema,
  EdgeTypeSchema,
  NodeTypeSchema,
  NODE_TYPES,
  EDGE_TYPES,
  SpecNodeSchema,
  CompanionNodeSchema,
  CeremonyNodeSchema,
  SessionNodeSchema,
  ActionStepNodeSchema,
  NarrativeBeatNodeSchema,
  IntentNodeSchema,
  StateMachineNodeSchema,
  StateNodeSchema,
  EventNodeSchema,

  // PDE
  PrimaryIntentSchema,
  SecondaryIntentSchema,
  DecompositionResultSchema,
  PipelineStageSchema,
  UrgencySchema,
  PdeActionItemSchema,

  // Narrative
  NarrativeBeatSchema,
  WilsonScoreSchema,
  NarrativeArcSchema,

  // Ceremony
  CeremonyPhaseSchema,
  CeremonyTypeSchema,
  CeremonyRecordSchema,

  // Session
  ForgewrightSessionSchema,
  SpiralPositionSchema,
} from '@forgewright/lib/types/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const validOcap = {
  ownership: 'community',
  control: 'creator',
  access: 'public' as const,
  possession: 'local',
};

const now = new Date().toISOString();

// ─── Directions ──────────────────────────────────────────────────────────────

describe('DirectionNameSchema', () => {
  it('accepts all four direction names', () => {
    for (const dir of ['east', 'south', 'west', 'north']) {
      expect(DirectionNameSchema.parse(dir)).toBe(dir);
    }
  });

  it('rejects invalid direction name', () => {
    expect(() => DirectionNameSchema.parse('up')).toThrow();
    expect(() => DirectionNameSchema.parse('')).toThrow();
    expect(() => DirectionNameSchema.parse('East')).toThrow();
  });
});

describe('DIRECTIONS constant', () => {
  it('has exactly 4 entries', () => {
    expect(Object.keys(DIRECTIONS)).toHaveLength(4);
  });

  it('has all four direction keys', () => {
    expect(Object.keys(DIRECTIONS)).toEqual(
      expect.arrayContaining(['east', 'south', 'west', 'north']),
    );
  });

  it('each entry has correct Ojibwe name', () => {
    expect(DIRECTIONS.east.ojibwe).toBe('Waabinong');
    expect(DIRECTIONS.south.ojibwe).toBe('Zhaawanong');
    expect(DIRECTIONS.west.ojibwe).toBe('Epangishmok');
    expect(DIRECTIONS.north.ojibwe).toBe('Kiiwedinong');
  });

  it('each entry has correct act number (1-4)', () => {
    expect(DIRECTIONS.east.act).toBe(1);
    expect(DIRECTIONS.south.act).toBe(2);
    expect(DIRECTIONS.west.act).toBe(3);
    expect(DIRECTIONS.north.act).toBe(4);
  });

  it('each entry has correct season', () => {
    expect(DIRECTIONS.east.season).toBe('Spring');
    expect(DIRECTIONS.south.season).toBe('Summer');
    expect(DIRECTIONS.west.season).toBe('Autumn');
    expect(DIRECTIONS.north.season).toBe('Winter');
  });

  it('each entry has an emoji', () => {
    for (const dir of DIRECTION_NAMES) {
      expect(DIRECTIONS[dir].emoji).toBeDefined();
      expect(typeof DIRECTIONS[dir].emoji).toBe('string');
    }
  });

  it('each entry validates against DirectionInfoSchema', () => {
    for (const dir of DIRECTION_NAMES) {
      expect(() => DirectionInfoSchema.parse(DIRECTIONS[dir])).not.toThrow();
    }
  });
});

describe('Direction lookup maps', () => {
  it('DIRECTION_NAMES is ordered east→south→west→north', () => {
    expect(DIRECTION_NAMES).toEqual(['east', 'south', 'west', 'north']);
  });

  it('OJIBWE_NAMES maps all 4 directions', () => {
    expect(Object.keys(OJIBWE_NAMES)).toHaveLength(4);
    expect(OJIBWE_NAMES.east).toBe('Waabinong');
  });

  it('DIRECTION_ACTS maps directions to 1-4', () => {
    expect(DIRECTION_ACTS.east).toBe(1);
    expect(DIRECTION_ACTS.north).toBe(4);
  });

  it('ACT_DIRECTIONS is the inverse of DIRECTION_ACTS', () => {
    for (const dir of DIRECTION_NAMES) {
      const act = DIRECTION_ACTS[dir];
      expect(ACT_DIRECTIONS[act]).toBe(dir);
    }
  });

  it('DIRECTION_COLORS has 4 hex color strings', () => {
    for (const dir of DIRECTION_NAMES) {
      expect(DIRECTION_COLORS[dir]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('DIRECTION_SEASONS matches DIRECTIONS constant', () => {
    for (const dir of DIRECTION_NAMES) {
      expect(DIRECTION_SEASONS[dir]).toBe(DIRECTIONS[dir].season);
    }
  });
});

// ─── OCAP ────────────────────────────────────────────────────────────────────

describe('OcapMetadataSchema', () => {
  it('accepts valid OCAP metadata', () => {
    const result = OcapMetadataSchema.parse(validOcap);
    expect(result.ownership).toBe('community');
    expect(result.access).toBe('public');
  });

  it('accepts all access levels', () => {
    for (const level of ['public', 'community', 'ceremony', 'sacred']) {
      expect(() =>
        OcapMetadataSchema.parse({ ...validOcap, access: level }),
      ).not.toThrow();
    }
  });

  it('rejects missing ownership', () => {
    const { ownership, ...rest } = validOcap;
    expect(() => OcapMetadataSchema.parse(rest)).toThrow();
  });

  it('rejects invalid access level', () => {
    expect(() =>
      OcapMetadataSchema.parse({ ...validOcap, access: 'top-secret' }),
    ).toThrow();
  });

  it('rejects missing control', () => {
    const { control, ...rest } = validOcap;
    expect(() => OcapMetadataSchema.parse(rest)).toThrow();
  });
});

describe('AccessLevelSchema', () => {
  it('accepts all 4 levels in hierarchy order', () => {
    const levels = ['public', 'community', 'ceremony', 'sacred'];
    for (const l of levels) {
      expect(AccessLevelSchema.parse(l)).toBe(l);
    }
  });

  it('rejects unknown level', () => {
    expect(() => AccessLevelSchema.parse('admin')).toThrow();
  });
});

describe('AccountabilityTrackingSchema', () => {
  it('accepts valid tracking data', () => {
    const data = {
      respect: 0.8,
      reciprocity: 0.7,
      responsibility: 0.9,
      wilson_alignment: 0.8,
      relations_honored: ['mia', 'miette'],
    };
    const result = AccountabilityTrackingSchema.parse(data);
    expect(result.wilson_alignment).toBe(0.8);
    expect(result.relations_honored).toHaveLength(2);
  });

  it('rejects scores outside 0-1 range', () => {
    expect(() =>
      AccountabilityTrackingSchema.parse({
        respect: 1.5,
        reciprocity: 0.7,
        responsibility: 0.9,
        wilson_alignment: 0.8,
        relations_honored: [],
      }),
    ).toThrow();
  });
});

// ─── STC (Structural Tension Chart) ─────────────────────────────────────────

describe('StructuralTensionChartSchema', () => {
  const validSTC = {
    id: 'stc-1',
    desiredOutcome: 'All tests passing with 100% coverage',
    currentReality: 'No tests written yet',
    actionSteps: [],
    createdAt: now,
    updatedAt: now,
  };

  it('accepts valid STC with required fields', () => {
    const result = StructuralTensionChartSchema.parse(validSTC);
    expect(result.desiredOutcome).toBe('All tests passing with 100% coverage');
    expect(result.currentReality).toBe('No tests written yet');
  });

  it('requires desiredOutcome', () => {
    const { desiredOutcome, ...rest } = validSTC;
    expect(() => StructuralTensionChartSchema.parse(rest)).toThrow();
  });

  it('requires currentReality', () => {
    const { currentReality, ...rest } = validSTC;
    expect(() => StructuralTensionChartSchema.parse(rest)).toThrow();
  });

  it('defaults tensionLevel to 0.5', () => {
    const result = StructuralTensionChartSchema.parse(validSTC);
    expect(result.tensionLevel).toBe(0.5);
  });

  it('defaults phase to germination', () => {
    const result = StructuralTensionChartSchema.parse(validSTC);
    expect(result.phase).toBe('germination');
  });

  it('accepts all creative phases', () => {
    for (const phase of ['germination', 'assimilation', 'completion']) {
      expect(() =>
        StructuralTensionChartSchema.parse({ ...validSTC, phase }),
      ).not.toThrow();
    }
  });

  it('rejects invalid phase', () => {
    expect(() =>
      StructuralTensionChartSchema.parse({ ...validSTC, phase: 'unknown' }),
    ).toThrow();
  });

  it('accepts action steps array', () => {
    const withSteps = {
      ...validSTC,
      actionSteps: [
        {
          id: 'step-1',
          description: 'Write types.test.ts',
          status: 'pending',
          confidence: 0.9,
        },
      ],
    };
    const result = StructuralTensionChartSchema.parse(withSteps);
    expect(result.actionSteps).toHaveLength(1);
  });
});

describe('CreativePhaseSchema', () => {
  it('accepts all 3 phases', () => {
    for (const p of ['germination', 'assimilation', 'completion']) {
      expect(CreativePhaseSchema.parse(p)).toBe(p);
    }
  });
});

// ─── SMDF (State Machine Definition) ─────────────────────────────────────────

describe('StateMachineDefinitionSchema', () => {
  const validSMDF = {
    settings: {
      namespace: 'test.machine',
      name: 'TestMachine',
      asynchronous: true,
    },
    events: [
      {
        name: 'test-source',
        events: [{ id: 'evt-start', name: 'start' }],
      },
    ],
    state: {
      name: 'root',
      states: [
        { name: 'idle' },
        { name: 'running', transitions: [{ event: 'stop', nextState: 'idle' }] },
      ],
    },
  };

  it('accepts valid SMDF', () => {
    const result = StateMachineDefinitionSchema.parse(validSMDF);
    expect(result.settings.namespace).toBe('test.machine');
    expect(result.state.name).toBe('root');
  });

  it('requires settings field', () => {
    const { settings, ...rest } = validSMDF;
    expect(() => StateMachineDefinitionSchema.parse(rest)).toThrow();
  });

  it('requires events field', () => {
    const { events, ...rest } = validSMDF;
    expect(() => StateMachineDefinitionSchema.parse(rest)).toThrow();
  });

  it('requires state field', () => {
    const { state, ...rest } = validSMDF;
    expect(() => StateMachineDefinitionSchema.parse(rest)).toThrow();
  });

  it('requires namespace in settings', () => {
    const bad = {
      ...validSMDF,
      settings: { asynchronous: true },
    };
    expect(() => StateMachineDefinitionSchema.parse(bad)).toThrow();
  });

  it('requires asynchronous boolean in settings', () => {
    const bad = {
      ...validSMDF,
      settings: { namespace: 'test' },
    };
    expect(() => StateMachineDefinitionSchema.parse(bad)).toThrow();
  });

  it('accepts nested child states', () => {
    const nested = {
      ...validSMDF,
      state: {
        name: 'root',
        states: [
          {
            name: 'phase1',
            states: [
              { name: 'sub1' },
              { name: 'sub2' },
            ],
          },
        ],
      },
    };
    const result = StateMachineDefinitionSchema.parse(nested);
    expect(result.state.states![0].states).toHaveLength(2);
  });
});

// ─── Graph Node Types (10 types, discriminated union) ────────────────────────

describe('GraphNodeSchema (discriminated union)', () => {
  it('resolves Intent node correctly', () => {
    const intentNode = {
      id: 'intent-1',
      nodeType: 'Intent',
      description: 'Build the test suite',
      urgency: 'session',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(intentNode);
    expect(result.nodeType).toBe('Intent');
  });

  it('resolves Spec node correctly', () => {
    const specNode = {
      id: 'spec-1',
      nodeType: 'Spec',
      name: 'Graph Substrate',
      version: '1.0.0',
      status: 'active',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(specNode);
    expect(result.nodeType).toBe('Spec');
  });

  it('resolves Companion node correctly', () => {
    const node = {
      id: 'comp-1',
      nodeType: 'Companion',
      name: 'Mia',
      role: 'architect',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('Companion');
  });

  it('resolves Ceremony node correctly', () => {
    const node = {
      id: 'cer-1',
      nodeType: 'Ceremony',
      name: 'Opening',
      phase: 'opening',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('Ceremony');
  });

  it('resolves Session node correctly', () => {
    const node = {
      id: 'sess-1',
      nodeType: 'Session',
      startedAt: now,
      status: 'active',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('Session');
  });

  it('resolves ActionStep node correctly', () => {
    const node = {
      id: 'step-1',
      nodeType: 'ActionStep',
      description: 'Write tests',
      status: 'pending',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('ActionStep');
  });

  it('resolves NarrativeBeat node correctly', () => {
    const node = {
      id: 'beat-1',
      nodeType: 'NarrativeBeat',
      content: 'The ceremony began at dawn',
      intensity: 0.7,
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('NarrativeBeat');
  });

  it('resolves StateMachine node correctly', () => {
    const node = {
      id: 'sm-1',
      nodeType: 'StateMachine',
      name: 'WorkflowSM',
      currentState: 'idle',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('StateMachine');
  });

  it('resolves State node correctly', () => {
    const node = {
      id: 'state-1',
      nodeType: 'State',
      name: 'idle',
      isInitial: true,
      isFinal: false,
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('State');
  });

  it('resolves Event node correctly', () => {
    const node = {
      id: 'evt-1',
      nodeType: 'Event',
      name: 'start',
      ocap: validOcap,
      createdAt: now,
    };
    const result = GraphNodeSchema.parse(node);
    expect(result.nodeType).toBe('Event');
  });

  it('rejects unknown nodeType', () => {
    const node = {
      id: 'bad-1',
      nodeType: 'Unknown',
      ocap: validOcap,
      createdAt: now,
    };
    expect(() => GraphNodeSchema.parse(node)).toThrow();
  });

  it('rejects node missing required fields', () => {
    const node = {
      id: 'bad-2',
      nodeType: 'Intent',
      // missing description
      ocap: validOcap,
      createdAt: now,
    };
    expect(() => GraphNodeSchema.parse(node)).toThrow();
  });

  it('rejects node without OCAP metadata', () => {
    const node = {
      id: 'bad-3',
      nodeType: 'Intent',
      description: 'test',
      createdAt: now,
    };
    expect(() => GraphNodeSchema.parse(node)).toThrow();
  });
});

describe('NODE_TYPES constant', () => {
  it('has exactly 10 node types (A03-01)', () => {
    expect(NODE_TYPES).toHaveLength(10);
  });

  it('includes all required types', () => {
    const required = [
      'Spec', 'Companion', 'Ceremony', 'Session', 'ActionStep',
      'NarrativeBeat', 'Intent', 'StateMachine', 'State', 'Event',
    ];
    for (const nt of required) {
      expect(NODE_TYPES).toContain(nt);
    }
  });
});

describe('EDGE_TYPES constant', () => {
  it('has exactly 11 edge types (A03-02)', () => {
    expect(EDGE_TYPES).toHaveLength(11);
  });

  it('includes all required edge types', () => {
    const required = [
      'DEPENDS_ON', 'BELONGS_TO', 'SERVES_DIRECTION', 'AUTHORED_BY',
      'GOVERNED_BY', 'TRANSITIONS_TO', 'CONTAINS', 'GENERATED_FROM',
      'NARRATES', 'ACCOUNTABLE_TO', 'KIN_OF',
    ];
    for (const et of required) {
      expect(EDGE_TYPES).toContain(et);
    }
  });
});

describe('GraphEdgeSchema', () => {
  const validEdge = {
    id: 'edge-1',
    fromId: 'node-a',
    toId: 'node-b',
    edgeType: 'DEPENDS_ON' as const,
    ocap: validOcap,
    createdAt: now,
  };

  it('accepts valid edge', () => {
    const result = GraphEdgeSchema.parse(validEdge);
    expect(result.edgeType).toBe('DEPENDS_ON');
    expect(result.strength).toBe(1.0); // default
  });

  it('accepts all edge types', () => {
    for (const et of EDGE_TYPES) {
      expect(() =>
        GraphEdgeSchema.parse({ ...validEdge, edgeType: et }),
      ).not.toThrow();
    }
  });

  it('rejects invalid edge type', () => {
    expect(() =>
      GraphEdgeSchema.parse({ ...validEdge, edgeType: 'INVALID' }),
    ).toThrow();
  });

  it('requires OCAP metadata on edge (A03-03)', () => {
    const { ocap, ...rest } = validEdge;
    expect(() => GraphEdgeSchema.parse(rest)).toThrow();
  });

  it('accepts optional direction field', () => {
    const result = GraphEdgeSchema.parse({ ...validEdge, direction: 'east' });
    expect(result.direction).toBe('east');
  });

  it('accepts optional metadata record', () => {
    const result = GraphEdgeSchema.parse({
      ...validEdge,
      metadata: { event_name: 'start', guard: 'isReady' },
    });
    expect(result.metadata).toBeDefined();
  });

  it('defaults strength to 1.0', () => {
    const result = GraphEdgeSchema.parse(validEdge);
    expect(result.strength).toBe(1.0);
  });

  it('rejects strength outside 0-1', () => {
    expect(() =>
      GraphEdgeSchema.parse({ ...validEdge, strength: 2.0 }),
    ).toThrow();
    expect(() =>
      GraphEdgeSchema.parse({ ...validEdge, strength: -0.1 }),
    ).toThrow();
  });
});

// ─── PDE Types ───────────────────────────────────────────────────────────────

describe('PrimaryIntentSchema', () => {
  it('accepts valid primary intent', () => {
    const result = PrimaryIntentSchema.parse({
      action: 'build',
      target: 'test suite',
    });
    expect(result.urgency).toBe('session'); // default
    expect(result.confidence).toBe(0.8); // default
  });

  it('requires action and target', () => {
    expect(() => PrimaryIntentSchema.parse({ action: 'build' })).toThrow();
    expect(() => PrimaryIntentSchema.parse({ target: 'tests' })).toThrow();
  });
});

describe('UrgencySchema', () => {
  it('accepts all urgency levels', () => {
    for (const u of ['immediate', 'session', 'persistent']) {
      expect(UrgencySchema.parse(u)).toBe(u);
    }
  });
});

describe('PipelineStageSchema', () => {
  it('accepts all 4 stages (A01-02)', () => {
    for (const s of ['decompose', 'enrich', 'assess', 'plan']) {
      expect(PipelineStageSchema.parse(s)).toBe(s);
    }
  });
});

describe('DecompositionResultSchema', () => {
  it('accepts valid decomposition result', () => {
    const valid = {
      primary: { action: 'build', target: 'tests', urgency: 'session', confidence: 0.9 },
      secondary: [],
      context: { files_needed: [], tools_required: [], assumptions: [] },
      outputs: { artifacts: [], updates: [], communications: [] },
      directions: {},
      actionStack: [],
      ambiguities: [],
    };
    expect(() => DecompositionResultSchema.parse(valid)).not.toThrow();
  });
});

// ─── Narrative Types ─────────────────────────────────────────────────────────

describe('NarrativeBeatSchema', () => {
  it('accepts valid beat', () => {
    const beat = {
      id: 'beat-1',
      act: 3,
      direction: 'west',
      content: 'Tests are forged in the West',
      timestamp: now,
    };
    const result = NarrativeBeatSchema.parse(beat);
    expect(result.act).toBe(3);
    expect(result.direction).toBe('west');
  });

  it('act must be 1-4', () => {
    expect(() =>
      NarrativeBeatSchema.parse({ id: 'b', act: 0, direction: 'east', content: 'x', timestamp: now }),
    ).toThrow();
    expect(() =>
      NarrativeBeatSchema.parse({ id: 'b', act: 5, direction: 'east', content: 'x', timestamp: now }),
    ).toThrow();
  });
});

describe('WilsonScoreSchema', () => {
  it('accepts valid score', () => {
    const score = {
      score: 0.75,
      components: { respect: 0.8, reciprocity: 0.7, responsibility: 0.75 },
    };
    const result = WilsonScoreSchema.parse(score);
    expect(result.score).toBe(0.75);
  });

  it('score must be 0-1', () => {
    expect(() =>
      WilsonScoreSchema.parse({
        score: 1.5,
        components: { respect: 0.8, reciprocity: 0.7, responsibility: 0.75 },
      }),
    ).toThrow();
  });
});

// ─── Ceremony Types ──────────────────────────────────────────────────────────

describe('CeremonyPhaseSchema', () => {
  it('accepts all 5 phases', () => {
    for (const p of ['preparation', 'opening', 'active', 'integration', 'closing']) {
      expect(CeremonyPhaseSchema.parse(p)).toBe(p);
    }
  });
});

describe('CeremonyTypeSchema', () => {
  it('accepts all ceremony types', () => {
    for (const t of ['smudging', 'talking_circle', 'spirit_feeding', 'opening', 'closing']) {
      expect(CeremonyTypeSchema.parse(t)).toBe(t);
    }
  });
});

// ─── Session Types ───────────────────────────────────────────────────────────

describe('SpiralPositionSchema', () => {
  it('accepts valid spiral position', () => {
    const result = SpiralPositionSchema.parse({ direction: 'east' });
    expect(result.cycleCount).toBe(0); // default
    expect(result.maxCycles).toBe(4); // default
    expect(result.isAtCheckpoint).toBe(false); // default
  });
});

describe('ForgewrightSessionSchema', () => {
  it('accepts valid session', () => {
    const session = {
      id: 'sess-1',
      intent: 'Write unit tests',
      spiralPosition: { direction: 'west' },
      createdAt: now,
      updatedAt: now,
    };
    const result = ForgewrightSessionSchema.parse(session);
    expect(result.status).toBe('active'); // default
    expect(result.companions).toEqual([]); // default
  });
});
