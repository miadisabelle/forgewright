/**
 * PDE API — run decompositions and list stored results.
 *
 * GET  /api/pde              — list all decompositions
 * POST /api/pde              — run PDE pipeline { prompt, mode?, workdir? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { runPipeline, list } from '@forgewright/lib/pde/index';
import type { PipelineOptions } from '@forgewright/lib/pde/pipeline';

export async function GET(request: NextRequest) {
  try {
    const workdir = request.nextUrl.searchParams.get('workdir') ?? undefined;
    const decompositions = await list(workdir);

    return NextResponse.json({
      data: decompositions,
      meta: { count: decompositions.length },
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
    const { prompt, mode, workdir, persist } = body as {
      prompt?: string;
      mode?: 'keyword' | 'llm';
      workdir?: string;
      persist?: boolean;
    };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Missing required field: prompt (string)' },
        { status: 400 },
      );
    }

    const options: PipelineOptions = {
      workdir: workdir ?? undefined,
      persist: persist ?? true,
    };

    if (mode === 'llm') {
      options.extractImplicit = true;
      options.mapDependencies = true;
    }

    const plan = await runPipeline(prompt, options);

    return NextResponse.json(
      {
        data: plan,
        meta: {
          id: plan.decomposition.id,
          actionCount: plan.decomposition.actionStack.length,
          balance: plan.decomposition.balance,
          wilsonAlignment: plan.decomposition.wilsonAlignment,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
