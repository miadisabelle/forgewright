/**
 * Single Session API — get, update, delete a Forgewright session.
 *
 * GET    /api/sessions/[id]   — get session by id
 * PATCH  /api/sessions/[id]   — update session (pause, resume, change direction)
 * DELETE /api/sessions/[id]   — close/delete session
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@forgewright/lib/session/manager.js';
import type { DirectionName } from '@forgewright/lib/types/directions.js';

type RouteContext = { params: Promise<{ id: string }> };

function getManager() {
  return new SessionManager();
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const manager = getManager();
    const session = await manager.getSession(id);

    return NextResponse.json({ data: session });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') || message.includes('ENOENT') ? 404 : 500;
    return NextResponse.json(
      { data: null, error: message },
      { status },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action, direction } = body as {
      action?: 'pause' | 'resume' | 'change_direction' | 'complete_cycle';
      direction?: DirectionName;
    };

    if (!action) {
      return NextResponse.json(
        { data: null, error: 'Missing required field: action ("pause" | "resume" | "change_direction" | "complete_cycle")' },
        { status: 400 },
      );
    }

    const manager = getManager();
    let result;

    switch (action) {
      case 'pause':
        result = await manager.pauseSession(id);
        break;
      case 'resume':
        result = await manager.resumeSession(id);
        break;
      case 'change_direction':
        if (!direction) {
          return NextResponse.json(
            { data: null, error: 'Missing required field: direction (for change_direction action)' },
            { status: 400 },
          );
        }
        result = await manager.changeDirection(id, direction);
        break;
      case 'complete_cycle':
        result = await manager.completeCycle(id);
        break;
      default:
        return NextResponse.json(
          { data: null, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') || message.includes('ENOENT') ? 404 : 500;
    return NextResponse.json(
      { data: null, error: message },
      { status },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const manager = getManager();

    // Close first (finalizes lifecycle), then delete
    try {
      await manager.closeSession(id);
    } catch {
      // Session may already be closed — continue to delete
    }
    await manager.deleteSession(id);

    return NextResponse.json({ data: { deleted: true, id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') || message.includes('ENOENT') ? 404 : 500;
    return NextResponse.json(
      { data: null, error: message },
      { status },
    );
  }
}
