/**
 * Single Ceremony API — advance or close a ceremony.
 *
 * GET  /api/ceremony/[id]     — get ceremony record + guidance
 * POST /api/ceremony/[id]     — lifecycle action { action: 'advance' | 'retreat' | 'close', force? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCeremonyRegistry } from '../registry';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const ceremonies = getCeremonyRegistry();
    const runtime = ceremonies.get(id);

    if (!runtime) {
      return NextResponse.json(
        { data: null, error: `Ceremony not found: ${id}` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        record: runtime.getRecord(),
        guidance: runtime.getCurrentGuidance(),
        phase: runtime.getCurrentPhase(),
        active: runtime.isActive(),
        events: runtime.getEvents(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action, force } = body as {
      action?: 'advance' | 'retreat' | 'close';
      force?: boolean;
    };

    if (!action) {
      return NextResponse.json(
        { data: null, error: 'Missing required field: action ("advance" | "retreat" | "close")' },
        { status: 400 },
      );
    }

    const ceremonies = getCeremonyRegistry();
    const runtime = ceremonies.get(id);

    if (!runtime) {
      return NextResponse.json(
        { data: null, error: `Ceremony not found: ${id}` },
        { status: 404 },
      );
    }

    let result;

    switch (action) {
      case 'advance':
        result = runtime.advancePhase();
        return NextResponse.json({
          data: {
            transition: result,
            phase: runtime.getCurrentPhase(),
            guidance: runtime.getCurrentGuidance(),
          },
        });

      case 'retreat':
        result = runtime.retreatPhase();
        return NextResponse.json({
          data: {
            transition: result,
            phase: runtime.getCurrentPhase(),
            guidance: runtime.getCurrentGuidance(),
          },
        });

      case 'close': {
        const record = runtime.closeCeremony(force ?? false);
        return NextResponse.json({
          data: {
            record,
            closed: true,
          },
        });
      }

      default:
        return NextResponse.json(
          { data: null, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
