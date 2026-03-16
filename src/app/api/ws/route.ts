// Forgewright WebSocket route — see rispecs/00-platform-architecture.spec.md
// Real-time updates: state machine transitions, ceremony events, designer sync

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // WebSocket upgrade endpoint — implementation pending
  return NextResponse.json(
    { error: "WebSocket endpoint not yet implemented" },
    { status: 501 }
  );
}
