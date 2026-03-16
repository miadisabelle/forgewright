/**
 * Forgewright MCP API route — see rispecs/00-platform-architecture.spec.md
 * Layer 3: MCP Tool Surface (unified server, HTTP transport)
 *
 * Handles MCP JSON-RPC requests over HTTP POST.
 * Creates a server instance per-request (stateless HTTP).
 * For stateful sessions, use the stdio transport via `mcp:start`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createForgewrightServer } from '@forgewright/lib/mcp/server';

// Cached server instance (created once, reused across requests)
let _serverPromise: ReturnType<typeof createForgewrightServer> | null = null;

function getServer() {
  if (!_serverPromise) {
    _serverPromise = createForgewrightServer();
  }
  return _serverPromise;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate JSON-RPC structure
    if (!body || typeof body !== 'object' || !body.method) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid JSON-RPC request: missing "method"' },
          id: body?.id ?? null,
        },
        { status: 400 },
      );
    }

    // Server is created but HTTP transport dispatch is not yet wired.
    // The MCP SDK's StreamableHTTPServerTransport requires its own
    // request lifecycle. For now, return a structured pending response.
    const _server = await getServer();

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'HTTP transport dispatch not yet wired. Use stdio transport via `npm run mcp:start` for full functionality.',
          data: {
            hint: 'StreamableHTTPServerTransport integration is the next step.',
            method: body.method,
            serverReady: true,
            namespaces: ['pde/', 'sm/', 'graph/', 'ceremony/', 'stc/', 'session/'],
          },
        },
        id: body.id ?? null,
      },
      { status: 501 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: err instanceof Error ? err.message : String(err),
        },
        id: null,
      },
      { status: 400 },
    );
  }
}
