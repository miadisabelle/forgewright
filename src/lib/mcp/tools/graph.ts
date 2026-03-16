/**
 * graph/ MCP Tool Namespace — Graph relational substrate operations.
 *
 * 4 tools: graph/query, graph/ingest, graph/export, graph/wilson
 *
 * Bridges MCP surface to the graph relational substrate:
 *   - queries.ts  → queryCypher(), neighborhood()
 *   - ingest.ts   → ingestPDE(), ingestStateMachine(), ingestCeremony(), etc.
 *   - export.ts   → toMermaid(), toCypher(), summaryStats()
 *   - wilson.ts   → computeWilsonAlignment()
 *
 * Every read tool passes OcapContext through for OCAP enforcement.
 * Each tool follows the MCP handler pattern:
 *   parse input → build OcapContext → execute logic → return { content: [{ type: 'text', text }] }
 */

import { z } from 'zod';
import {
  ForgewrightGraph,
  type OcapContext,
  queryCypher,
  neighborhood,
  ingestPDE,
  ingestStateMachine,
  ingestCeremony,
  ingestNarrativeBeat,
  ingestKinship,
  type KinshipEntry,
  toMermaid,
  toCypher,
  summaryStats,
  computeWilsonAlignment,
  type WilsonScope,
} from '../../graph/index';
import {
  withGuards,
  requireOcap,
  auditLog,
  mcpError,
  mcpSuccess,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
} from '../guards';

// ─── Lazy graph instance ─────────────────────────────────────────────────────
// Singleton: created once on first tool call, reused thereafter.

let _graph: ForgewrightGraph | null = null;

async function getGraph(): Promise<ForgewrightGraph> {
  if (!_graph) {
    _graph = await ForgewrightGraph.create();
  }
  return _graph;
}

/** For testing: inject a graph instance. */
export function setGraph(graph: ForgewrightGraph): void {
  _graph = graph;
}

/** For testing: reset the singleton. */
export function resetGraph(): void {
  _graph = null;
}

// ─── OcapContext builder ─────────────────────────────────────────────────────

function buildOcapContext(ctx?: ToolContext): OcapContext {
  return {
    requester: (ctx?.sessionId as string) ?? 'mcp-anonymous',
    maxAccessLevel: (ctx?.accessLevel as OcapContext['maxAccessLevel']) ?? 'community',
    ceremonyId: ctx?.ceremonyId as string | undefined,
    isCeremonyActive: ctx?.ceremonyPhase !== undefined,
  };
}

// ─── Input Schemas ───────────────────────────────────────────────────────────

const GraphQueryInputSchema = z.object({
  cypher: z.string().optional()
    .describe('Raw Cypher query string. Mutually exclusive with neighborhood.'),
  params: z.record(z.unknown()).optional()
    .describe('Parameterized query values for the Cypher query.'),
  neighborhood: z.object({
    nodeId: z.string().describe('Center node ID for neighborhood traversal.'),
    hops: z.number().int().min(1).max(10).default(1)
      .describe('Traversal depth (default: 1, max: 10).'),
  }).optional()
    .describe('Neighborhood query parameters. Mutually exclusive with cypher.'),
}).refine(
  (data) => (data.cypher !== undefined) !== (data.neighborhood !== undefined),
  { message: 'Provide exactly one of "cypher" or "neighborhood", not both or neither.' },
);

const IngestTypeSchema = z.enum(['pde', 'sm', 'ceremony', 'beat', 'kinship']);

const GraphIngestInputSchema = z.object({
  type: IngestTypeSchema
    .describe('Ingest type: pde, sm, ceremony, beat, or kinship.'),
  data: z.any()
    .describe('Domain data matching the ingest type schema.'),
});

const GraphExportInputSchema = z.object({
  scope: z.string().optional()
    .describe('Optional scope filter (e.g. session ID or node type filter).'),
  format: z.enum(['mermaid', 'cypher', 'stats'])
    .describe('Export format: mermaid diagram, cypher statements, or summary stats.'),
});

const GraphWilsonInputSchema = z.object({
  scope: z.string().optional()
    .describe('Optional scope to limit scoring (e.g. session ID).'),
});

// ─── Tool Definition Type ────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const graphQueryDef: ToolDefinition = {
  name: 'graph/query',
  description: [
    'Query the Forgewright relational graph.',
    'Accepts either a raw Cypher query string (with optional params)',
    'or a neighborhood traversal request (nodeId + hops).',
    'All results are OCAP-filtered before return.',
  ].join(' '),
  inputSchema: GraphQueryInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

const graphIngestDef: ToolDefinition = {
  name: 'graph/ingest',
  description: [
    'Ingest domain data into the relational graph.',
    'Supported types: pde (PDE decomposition), sm (state machine SMDF),',
    'ceremony (ceremony record), beat (narrative beat), kinship (spec relations).',
    'Returns created node IDs.',
  ].join(' '),
  inputSchema: GraphIngestInputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
};

const graphExportDef: ToolDefinition = {
  name: 'graph/export',
  description: [
    'Export graph data as visualization or data dump.',
    'Formats: mermaid (Four Directions flowchart), cypher (CREATE statements),',
    'stats (summary statistics with node/edge/OCAP counts).',
    'All exports are OCAP-filtered.',
  ].join(' '),
  inputSchema: GraphExportInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

const graphWilsonDef: ToolDefinition = {
  name: 'graph/wilson',
  description: [
    'Compute Wilson alignment score from graph relational structure.',
    'Measures: relational density, OCAP compliance, accountability chains,',
    'ceremony participation. Returns score (0–1) with recommendation:',
    'aligned, relational_attention_needed, or ceremony_recommended.',
  ].join(' '),
  inputSchema: GraphWilsonInputSchema,
  annotations: { readOnlyHint: true, idempotentHint: true },
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * graph/query handler — Cypher query or neighborhood traversal.
 */
const handleGraphQuery: ToolHandler = async (args, ctx) => {
  const parsed = GraphQueryInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for graph/query',
      issues: parsed.error.issues,
    });
  }

  const graph = await getGraph();
  const ocap = buildOcapContext(ctx);

  if (parsed.data.cypher) {
    const results = await queryCypher(graph, parsed.data.cypher, ocap, parsed.data.params);
    return mcpSuccess({
      queryType: 'cypher',
      resultCount: results.length,
      results,
    });
  }

  // Neighborhood query
  const { nodeId, hops } = parsed.data.neighborhood!;
  const subgraph = await neighborhood(graph, nodeId, ocap, hops);
  return mcpSuccess({
    queryType: 'neighborhood',
    centerNode: nodeId,
    hops,
    nodeCount: subgraph.nodes.length,
    edgeCount: subgraph.edges.length,
    nodes: subgraph.nodes,
    edges: subgraph.edges,
  });
};

/**
 * graph/ingest handler — route to appropriate ingest function.
 */
const handleGraphIngest: ToolHandler = async (args, ctx) => {
  const parsed = GraphIngestInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for graph/ingest',
      issues: parsed.error.issues,
    });
  }

  const graph = await getGraph();
  const { type, data } = parsed.data;

  try {
    switch (type) {
      case 'pde': {
        const result = await ingestPDE(graph, data);
        return mcpSuccess({
          ingestType: 'pde',
          createdNodes: [...result.intentIds, ...result.actionStepIds],
          intentCount: result.intentIds.length,
          actionStepCount: result.actionStepIds.length,
        });
      }

      case 'sm': {
        const result = await ingestStateMachine(graph, data);
        return mcpSuccess({
          ingestType: 'sm',
          createdNodes: [result.machineId, ...result.stateIds, ...result.eventIds],
          machineId: result.machineId,
          stateCount: result.stateIds.length,
          eventCount: result.eventIds.length,
        });
      }

      case 'ceremony': {
        const result = await ingestCeremony(graph, data);
        return mcpSuccess({
          ingestType: 'ceremony',
          createdNodes: [result.ceremonyId],
          ceremonyId: result.ceremonyId,
        });
      }

      case 'beat': {
        const actionStepIds = data.actionStepIds ?? [];
        const result = await ingestNarrativeBeat(graph, data, actionStepIds);
        return mcpSuccess({
          ingestType: 'beat',
          createdNodes: [result.beatId],
          beatId: result.beatId,
        });
      }

      case 'kinship': {
        const specId: string = data.specId;
        const kinMap: KinshipEntry[] = data.kinMap;
        if (!specId || !kinMap) {
          return mcpError('invalid_kinship_data', {
            message: 'Kinship ingest requires { specId: string, kinMap: KinshipEntry[] }',
          });
        }
        const result = await ingestKinship(graph, specId, kinMap);
        return mcpSuccess({
          ingestType: 'kinship',
          createdNodes: [],
          edgeCount: result.edgeCount,
        });
      }

      default:
        return mcpError('unknown_ingest_type', {
          message: `Unknown ingest type: ${type}`,
          supportedTypes: ['pde', 'sm', 'ceremony', 'beat', 'kinship'],
        });
    }
  } catch (err) {
    return mcpError('ingest_failed', {
      message: err instanceof Error ? err.message : String(err),
      ingestType: type,
    });
  }
};

/**
 * graph/export handler — mermaid, cypher, or stats.
 */
const handleGraphExport: ToolHandler = async (args, ctx) => {
  const parsed = GraphExportInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for graph/export',
      issues: parsed.error.issues,
    });
  }

  const graph = await getGraph();
  const ocap = buildOcapContext(ctx);
  const { format, scope } = parsed.data;
  const exportScope = scope ? { sessionId: scope } : undefined;

  try {
    switch (format) {
      case 'mermaid': {
        const diagram = await toMermaid(graph, ocap, exportScope);
        return mcpSuccess({ format: 'mermaid', output: diagram });
      }

      case 'cypher': {
        const statements = await toCypher(graph, ocap, exportScope);
        return mcpSuccess({ format: 'cypher', output: statements });
      }

      case 'stats': {
        const stats = await summaryStats(graph, ocap, exportScope);
        return mcpSuccess({ format: 'stats', ...stats });
      }

      default:
        return mcpError('unknown_export_format', {
          message: `Unknown export format: ${format}`,
          supportedFormats: ['mermaid', 'cypher', 'stats'],
        });
    }
  } catch (err) {
    return mcpError('export_failed', {
      message: err instanceof Error ? err.message : String(err),
      format,
    });
  }
};

/**
 * graph/wilson handler — Wilson alignment score.
 */
const handleGraphWilson: ToolHandler = async (args, ctx) => {
  const parsed = GraphWilsonInputSchema.safeParse(args);
  if (!parsed.success) {
    return mcpError('validation_error', {
      message: 'Invalid input for graph/wilson',
      issues: parsed.error.issues,
    });
  }

  const graph = await getGraph();
  const ocap = buildOcapContext(ctx);

  const wilsonScope: WilsonScope | undefined = parsed.data.scope
    ? { sessionId: parsed.data.scope }
    : undefined;

  try {
    const result = await computeWilsonAlignment(graph, ocap, wilsonScope);
    return mcpSuccess(result);
  } catch (err) {
    return mcpError('wilson_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

// ─── Guarded Handlers ────────────────────────────────────────────────────────

const guardedGraphQuery = withGuards(
  [requireOcap('community'), auditLog('graph/query')],
  handleGraphQuery,
);

const guardedGraphIngest = withGuards(
  [requireOcap('community'), auditLog('graph/ingest')],
  handleGraphIngest,
);

const guardedGraphExport = withGuards(
  [requireOcap('community'), auditLog('graph/export')],
  handleGraphExport,
);

const guardedGraphWilson = withGuards(
  [requireOcap('community'), auditLog('graph/wilson')],
  handleGraphWilson,
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  graphQueryDef,
  graphIngestDef,
  graphExportDef,
  graphWilsonDef,
];

export const handlers: Record<string, ToolHandler> = {
  'graph/query': guardedGraphQuery,
  'graph/ingest': guardedGraphIngest,
  'graph/export': guardedGraphExport,
  'graph/wilson': guardedGraphWilson,
};

/** Register all graph/ tools on an McpServer instance. */
export function registerGraphTools(server: {
  registerTool: (
    name: string,
    config: { description: string; inputSchema: z.ZodType; annotations?: Record<string, boolean> },
    handler: (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
  ) => void;
}): void {
  for (const def of tools) {
    const handler = handlers[def.name];
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      handler as (args: Record<string, unknown>, ctx?: unknown) => Promise<ToolResult>,
    );
  }
}
