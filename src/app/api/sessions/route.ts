/**
 * Sessions API — list and create Forgewright sessions.
 *
 * GET  /api/sessions         — list all sessions
 * POST /api/sessions         — create new session { intent, config? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@forgewright/lib/session/manager';

function getManager() {
  return new SessionManager();
}

export async function GET(_request: NextRequest) {
  try {
    const manager = getManager();
    const sessions = await manager.listSessions();

    return NextResponse.json({
      data: sessions,
      meta: { count: sessions.length },
    });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, config } = body;

    if (!intent || typeof intent !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Missing required field: intent (string)' },
        { status: 400 },
      );
    }

    const manager = getManager();
    const result = await manager.createSession(intent, config);

    return NextResponse.json(
      { data: result },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
