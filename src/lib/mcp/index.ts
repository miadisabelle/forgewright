// Forgewright MCP — re-exports for server and guards.
// See rispecs/00-platform-architecture.spec.md, Layer 3: Unified MCP Tool Surface

export {
  createForgewrightServer,
  startServer,
  registerNamespace,
} from './server.js';

export {
  withGuards,
  requirePhase,
  requireOcap,
  auditLog,
  mcpError,
  mcpSuccess,
  getAuditLog,
  clearAuditLog,
  type ToolHandler,
  type ToolResult,
  type ToolContext,
  type Guard,
  type AuditEntry,
} from './guards.js';
