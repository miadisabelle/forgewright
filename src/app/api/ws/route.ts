/**
 * Forgewright WebSocket route — see rispecs/05-visual-designer.spec.md
 * Real-time updates: state machine transitions, ceremony events, designer sync.
 *
 * Upgrade handler for WebSocket connections.
 * Clients connect, send GraphDelta messages, receive broadcasts of applied deltas.
 *
 * Note: Next.js App Router does not natively support WebSocket upgrade in route handlers.
 * This endpoint returns connection instructions and serves as the upgrade target
 * for a custom server (see server.ts) or middleware-based WS handler.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/ws — WebSocket upgrade endpoint.
 *
 * In production, the actual WS upgrade is handled by the Node.js HTTP server
 * layer (via a custom server or middleware), not by the Next.js route handler.
 * This route validates the upgrade request and returns protocol info.
 */
export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get('upgrade');

  if (upgradeHeader?.toLowerCase() === 'websocket') {
    // Next.js App Router cannot perform WS upgrade directly.
    // The custom server layer intercepts this before it reaches here.
    // If we get here, it means the custom server isn't wired yet.
    return NextResponse.json(
      {
        error: "websocket_upgrade_requires_custom_server",
        message: "WebSocket upgrade detected but Next.js route handlers cannot perform upgrade. Wire the custom server's httpServer.on('upgrade') to DesignerSync.setupWsBridge().",
        protocol: {
          endpoint: "/api/ws",
          messageTypes: ["delta", "sync_state", "conflict", "ping", "pong"],
          deltaFormat: {
            type: "delta",
            payload: {
              type: "add_node | remove_node | move_node | add_edge | remove_edge | update_node",
              payload: "Record<string, unknown>",
              timestamp: "ISO 8601 string",
            },
          },
        },
      },
      { status: 426, headers: { 'Upgrade': 'websocket' } },
    );
  }

  // Non-upgrade GET — return endpoint info
  return NextResponse.json({
    endpoint: "/api/ws",
    status: "ready",
    transport: "websocket",
    description: "Forgewright designer sync — bidirectional real-time state propagation.",
    usage: {
      connect: "ws://host/api/ws",
      send: '{ "type": "delta", "payload": { "type": "add_node", "payload": { "node": {...} }, "timestamp": "..." } }',
      receive: '{ "type": "delta", "payload": { "source": "mcp", "delta": {...} } }',
      ping: '{ "type": "ping", "payload": null }',
    },
    messageTypes: {
      delta: "GraphDelta applied (from MCP tool or designer interaction)",
      conflict: "Destructive operation flagged for review",
      sync_state: "Full state snapshot (on initial connection)",
      ping: "Keepalive request → responds with pong",
      pong: "Keepalive response",
    },
  });
}

