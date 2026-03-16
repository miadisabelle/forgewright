/**
 * Single Decomposition API — retrieve a stored PDE decomposition.
 *
 * GET /api/pde/[id]          — get decomposition by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { load } from '@forgewright/lib/pde/index';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const workdir = request.nextUrl.searchParams.get('workdir') ?? undefined;
    const decomposition = await load(id, workdir);

    return NextResponse.json({
      data: decomposition,
      meta: {
        id: decomposition.id,
        balance: decomposition.balance,
        wilsonAlignment: decomposition.wilsonAlignment,
        ceremonyRequired: decomposition.ceremonyRequired,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('ENOENT') ? 404 : 500;
    return NextResponse.json(
      { data: null, error: message },
      { status },
    );
  }
}
