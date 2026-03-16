/**
 * Forgewright Graph Relational Substrate — Layer 1
 *
 * KuzuDB embedded graph database (Cypher queries, OCAP-filterable).
 * Falls back to in-memory Map-based store when kuzu is unavailable.
 *
 * Package: kuzu ^0.11.2 (archived upstream; monitor Vela/Bighorn forks)
 * See: rispecs/03-graph-relational-substrate.spec.md
 */

// Core database
export {
  ForgewrightGraph,
  type IGraphStore,
  type OcapContext,
  type SubgraphResult,
} from './database';

// Query operations
export {
  neighborhood,
  shortestPath,
  subgraph,
  accountabilityAudit,
  oscillationDetection,
  queryCypher,
  type AccountabilityChain,
  type OscillationResult,
} from './queries';

// OCAP enforcement
export {
  checkAccess,
  filterNodes,
  filterEdges,
  filterSubgraph,
  filterQuery,
  getAuditLog,
  clearAuditLog,
  type AuditEntry,
} from './ocap-filter';

// Ingest (write path)
export {
  ingestPDE,
  ingestStateMachine,
  ingestCeremony,
  ingestNarrativeBeat,
  ingestKinship,
  type KinshipEntry,
} from './ingest';

// Wilson alignment scoring
export {
  computeWilsonAlignment,
  type WilsonAlignmentScore,
  type WilsonScope,
} from './wilson';

// Export functions
export {
  toMermaid,
  toCypher,
  summaryStats,
  type ExportScope,
  type MermaidOptions,
  type GraphStats,
} from './export';
