// Forgewright MCP API route — see rispecs/00-platform-architecture.spec.md
// Layer 3: MCP Tool Surface (unified server, HTTP transport)

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // MCP HTTP transport endpoint — implementation pending
  return NextResponse.json(
    { error: "MCP endpoint not yet implemented" },
    { status: 501 }
  );
}
