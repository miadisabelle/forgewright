/**
 * Graph Ingest — write path for domain data into the graph substrate.
 *
 * Each ingest function validates data with Zod schemas before graph insertion,
 * creates the appropriate nodes and edges, and stamps OCAP metadata.
 */

import { randomUUID } from 'crypto';
import type {
  GraphNode, GraphEdge, EdgeType,
  OcapMetadata,
  DecompositionResult, PdeActionItem,
  StateMachineDefinition,
  CeremonyRecord,
  NarrativeBeat,
} from '../types/index';
import {
  IntentNodeSchema,
  ActionStepNodeSchema,
  GraphEdgeSchema,
  CeremonyNodeSchema,
  NarrativeBeatNodeSchema,
  StateMachineNodeSchema,
  StateNodeSchema,
  EventNodeSchema,
  SpecNodeSchema,
} from '../types/index';
import { ForgewrightGraph } from './database';

// ─── Default OCAP for ingested data ─────────────────────────────────────────

const defaultOcap: OcapMetadata = {
  ownership: 'system',
  control: 'creator',
  access: 'community',
  possession: 'local',
};

function ts(): string {
  return new Date().toISOString();
}

function uid(prefix?: string): string {
  const id = randomUUID().slice(0, 8);
  return prefix ? `${prefix}-${id}` : id;
}

// ─── PDE Ingest ──────────────────────────────────────────────────────────────

/**
 * Ingest a PDE decomposition result into the graph.
 * Creates Intent nodes from the primary + secondary intents, ActionStep nodes
 * from the action stack, and DEPENDS_ON + SERVES_DIRECTION edges.
 *
 * @param graph - ForgewrightGraph instance
 * @param decomposition - PDE DecompositionResult
 * @param ocap - OCAP metadata override (default: community-level)
 * @returns IDs of created nodes
 */
export async function ingestPDE(
  graph: ForgewrightGraph,
  decomposition: DecompositionResult,
  ocap: OcapMetadata = defaultOcap,
): Promise<{ intentIds: string[]; actionStepIds: string[] }> {
  const intentIds: string[] = [];
  const actionStepIds: string[] = [];
  const now = ts();

  // Primary intent → Intent node
  const primaryId = uid('intent');
  const primaryNode = IntentNodeSchema.parse({
    id: primaryId,
    nodeType: 'Intent',
    description: `${decomposition.primary.action}: ${decomposition.primary.target}`,
    urgency: decomposition.primary.urgency,
    ocap,
    createdAt: now,
  });
  await graph.createNode(primaryNode);
  intentIds.push(primaryId);

  // Secondary intents → Intent nodes
  for (const sec of decomposition.secondary) {
    const secId = uid('intent');
    const secNode = IntentNodeSchema.parse({
      id: secId,
      nodeType: 'Intent',
      description: `${sec.action}: ${sec.target}`,
      ocap,
      createdAt: now,
    });
    await graph.createNode(secNode);
    intentIds.push(secId);

    // Dependency edge to primary
    if (sec.dependency) {
      const depTarget = intentIds.find((_, i) => i === 0) ?? primaryId;
      await graph.createEdge(GraphEdgeSchema.parse({
        id: uid('edge'),
        fromId: secId,
        toId: depTarget,
        edgeType: 'DEPENDS_ON',
        ocap,
        createdAt: now,
      }));
    }
  }

  // Action stack → ActionStep nodes + DEPENDS_ON edges
  const actionIdMap = new Map<string, string>();

  for (let i = 0; i < decomposition.actionStack.length; i++) {
    const action = decomposition.actionStack[i];
    const stepId = action.id ?? uid('step');
    actionIdMap.set(action.text, stepId);

    const stepNode = ActionStepNodeSchema.parse({
      id: stepId,
      nodeType: 'ActionStep',
      description: action.text,
      orderIndex: i,
      status: action.completed ? 'done' : 'pending',
      ocap,
      createdAt: now,
    });
    await graph.createNode(stepNode);
    actionStepIds.push(stepId);

    // Dependency edge
    if (action.dependency) {
      const depId = actionIdMap.get(action.dependency);
      if (depId) {
        await graph.createEdge(GraphEdgeSchema.parse({
          id: uid('edge'),
          fromId: stepId,
          toId: depId,
          edgeType: 'DEPENDS_ON',
          ocap,
          createdAt: now,
        }));
      }
    }
  }

  // SERVES_DIRECTION edges for directional action items
  for (const action of decomposition.actionStack) {
    const stepId = actionIdMap.get(action.text);
    if (!stepId || !action.direction) continue;

    // Attempt to link to an Intent node as a direction marker
    if (intentIds.length > 0) {
      await graph.createEdge(GraphEdgeSchema.parse({
        id: uid('edge'),
        fromId: stepId,
        toId: intentIds[0],
        edgeType: 'SERVES_DIRECTION',
        direction: action.direction,
        ocap,
        createdAt: now,
      }));
    }
  }

  return { intentIds, actionStepIds };
}

// ─── State Machine Ingest ────────────────────────────────────────────────────

/**
 * Ingest an SMDF state machine definition into the graph.
 * Creates StateMachine, State, and Event nodes with TRANSITIONS_TO and
 * CONTAINS edges.
 *
 * @param graph - ForgewrightGraph instance
 * @param smdf - SMDF StateMachineDefinition
 * @param ocap - OCAP metadata override
 * @returns IDs of created nodes
 */
export async function ingestStateMachine(
  graph: ForgewrightGraph,
  smdf: StateMachineDefinition,
  ocap: OcapMetadata = defaultOcap,
): Promise<{ machineId: string; stateIds: string[]; eventIds: string[] }> {
  const now = ts();
  const machineId = uid('sm');
  const stateIds: string[] = [];
  const eventIds: string[] = [];

  // StateMachine node
  const machineNode = StateMachineNodeSchema.parse({
    id: machineId,
    nodeType: 'StateMachine',
    name: smdf.settings.name ?? smdf.settings.namespace,
    namespace: smdf.settings.namespace,
    currentState: smdf.state.name,
    ocap,
    createdAt: now,
  });
  await graph.createNode(machineNode);

  // Recursively ingest states
  const stateIdMap = new Map<string, string>();

  async function ingestState(
    stateDef: any,
    parentMachineOrStateId: string,
    isRoot: boolean,
  ): Promise<void> {
    const stateId = uid('state');
    stateIdMap.set(stateDef.name, stateId);

    const stateNode = StateNodeSchema.parse({
      id: stateId,
      nodeType: 'State',
      name: stateDef.name,
      isInitial: isRoot,
      isFinal: stateDef.kind === 'final',
      kind: stateDef.kind,
      ocap,
      createdAt: now,
    });
    await graph.createNode(stateNode);
    stateIds.push(stateId);

    // CONTAINS edge from machine to state
    await graph.createEdge(GraphEdgeSchema.parse({
      id: uid('edge'),
      fromId: machineId,
      toId: stateId,
      edgeType: 'CONTAINS',
      ocap,
      createdAt: now,
    }));

    // Recurse into child states
    if (stateDef.states) {
      for (const child of stateDef.states) {
        await ingestState(child, stateId, false);
      }
    }
  }

  await ingestState(smdf.state, machineId, true);

  // Events → Event nodes
  for (const source of smdf.events) {
    if (!source.events) continue;
    for (const evt of source.events) {
      const eventId = uid('evt');
      const eventNode = EventNodeSchema.parse({
        id: eventId,
        nodeType: 'Event',
        name: evt.name ?? evt.id,
        payload: evt.parameters ? JSON.stringify(evt.parameters) : undefined,
        ocap,
        createdAt: now,
      });
      await graph.createNode(eventNode);
      eventIds.push(eventId);
    }
  }

  // TRANSITIONS_TO edges from state transitions
  async function ingestTransitions(stateDef: any): Promise<void> {
    const fromStateId = stateIdMap.get(stateDef.name);
    if (!fromStateId || !stateDef.transitions) return;

    for (const t of stateDef.transitions) {
      const toStateName = t.nextState ?? stateDef.name; // self-transition if no nextState
      const toStateId = stateIdMap.get(toStateName);
      if (!toStateId) continue;

      await graph.createEdge(GraphEdgeSchema.parse({
        id: uid('edge'),
        fromId: fromStateId,
        toId: toStateId,
        edgeType: 'TRANSITIONS_TO',
        metadata: { event_name: t.event, guard: t.condition },
        ocap,
        createdAt: now,
      }));
    }

    if (stateDef.states) {
      for (const child of stateDef.states) {
        await ingestTransitions(child);
      }
    }
  }

  await ingestTransitions(smdf.state);

  return { machineId, stateIds, eventIds };
}

// ─── Ceremony Ingest ─────────────────────────────────────────────────────────

/**
 * Ingest a ceremony record into the graph.
 * Creates a Ceremony node and GOVERNED_BY edges to participant Companions.
 *
 * @param graph - ForgewrightGraph instance
 * @param ceremony - CeremonyRecord
 * @param ocap - OCAP metadata override (default: ceremony-level access)
 */
export async function ingestCeremony(
  graph: ForgewrightGraph,
  ceremony: CeremonyRecord,
  ocap?: OcapMetadata,
): Promise<{ ceremonyId: string }> {
  const now = ts();
  const ceremonyOcap = ocap ?? { ...defaultOcap, access: 'ceremony' as const };

  const ceremonyNode = CeremonyNodeSchema.parse({
    id: ceremony.id,
    nodeType: 'Ceremony',
    name: `${ceremony.type} ceremony`,
    direction: ceremony.direction,
    phase: ceremony.phase,
    ocap: ceremonyOcap,
    createdAt: ceremony.timestamp ?? now,
  });
  await graph.createNode(ceremonyNode);

  // GOVERNED_BY edges to participants (as Companion lookups)
  for (const participantId of ceremony.participants) {
    const companion = await graph.getNode(participantId);
    if (companion && companion.nodeType === 'Companion') {
      await graph.createEdge(GraphEdgeSchema.parse({
        id: uid('edge'),
        fromId: ceremony.id,
        toId: participantId,
        edgeType: 'GOVERNED_BY',
        metadata: { role: 'participant' },
        ocap: ceremonyOcap,
        createdAt: now,
      }));
    }
  }

  return { ceremonyId: ceremony.id };
}

// ─── Narrative Beat Ingest ───────────────────────────────────────────────────

/**
 * Ingest a narrative beat into the graph.
 * Creates a NarrativeBeat node and optionally NARRATES edges to ActionSteps.
 *
 * @param graph - ForgewrightGraph instance
 * @param beat - NarrativeBeat data
 * @param actionStepIds - IDs of ActionSteps this beat narrates
 * @param ocap - OCAP metadata override
 */
export async function ingestNarrativeBeat(
  graph: ForgewrightGraph,
  beat: NarrativeBeat,
  actionStepIds: string[] = [],
  ocap: OcapMetadata = defaultOcap,
): Promise<{ beatId: string }> {
  const now = ts();

  const beatNode = NarrativeBeatNodeSchema.parse({
    id: beat.id,
    nodeType: 'NarrativeBeat',
    content: beat.content,
    emotion: beat.emotion,
    intensity: beat.intensity ?? 0.5,
    ocap,
    createdAt: beat.timestamp ?? now,
  });
  await graph.createNode(beatNode);

  // NARRATES edges
  for (const stepId of actionStepIds) {
    const step = await graph.getNode(stepId);
    if (step && step.nodeType === 'ActionStep') {
      await graph.createEdge(GraphEdgeSchema.parse({
        id: uid('edge'),
        fromId: beat.id,
        toId: stepId,
        edgeType: 'NARRATES',
        ocap,
        createdAt: now,
      }));
    }
  }

  return { beatId: beat.id };
}

// ─── Kinship Ingest ──────────────────────────────────────────────────────────

export interface KinshipEntry {
  targetSpecId: string;
  kinshipType: string;
}

/**
 * Ingest KINSHIP.md-style relational links between specs.
 * Creates Spec nodes (if missing) and KIN_OF edges.
 *
 * @param graph - ForgewrightGraph instance
 * @param specId - Source spec ID
 * @param kinMap - Array of kinship entries
 * @param ocap - OCAP metadata override
 */
export async function ingestKinship(
  graph: ForgewrightGraph,
  specId: string,
  kinMap: KinshipEntry[],
  ocap: OcapMetadata = defaultOcap,
): Promise<{ edgeCount: number }> {
  const now = ts();
  let edgeCount = 0;

  // Ensure source spec exists
  const sourceSpec = await graph.getNode(specId);
  if (!sourceSpec) {
    const placeholder = SpecNodeSchema.parse({
      id: specId,
      nodeType: 'Spec',
      name: specId,
      version: '0.0.0',
      status: 'draft',
      ocap,
      createdAt: now,
    });
    await graph.createNode(placeholder);
  }

  for (const entry of kinMap) {
    // Ensure target spec exists
    const targetSpec = await graph.getNode(entry.targetSpecId);
    if (!targetSpec) {
      const placeholder = SpecNodeSchema.parse({
        id: entry.targetSpecId,
        nodeType: 'Spec',
        name: entry.targetSpecId,
        version: '0.0.0',
        status: 'draft',
        ocap,
        createdAt: now,
      });
      await graph.createNode(placeholder);
    }

    await graph.createEdge(GraphEdgeSchema.parse({
      id: uid('edge'),
      fromId: specId,
      toId: entry.targetSpecId,
      edgeType: 'KIN_OF',
      metadata: { kinship_type: entry.kinshipType },
      ocap,
      createdAt: now,
    }));
    edgeCount++;
  }

  return { edgeCount };
}
