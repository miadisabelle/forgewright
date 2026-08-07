import { NextResponse, type NextRequest } from 'next/server';
import {
  ChronicleRootUnavailableError,
  DiagramMappingError,
  DiagramNotFoundError,
  InvalidDiagramPathError,
  listEpisodeDiagrams,
  loadWorkspaceStateMachine,
  resolveChronicleRoot,
} from '@forgewright/lib/chronicle/diagrams';

export const dynamic = 'force-dynamic';

// Episode-hosted state machines, read from MIADI_CHRONICLE_ROOT on disk.
// Without `path` this lists every discovered diagram; with `path` it serves ONE
// diagram mapped SMDF→WorkspaceStateMachine, ready for the machine store.
// A diagram that fails to map answers with its named error — never a bare 500.
export async function GET(request: NextRequest) {
  const diagramPath = request.nextUrl.searchParams.get('path');
  const source = { root: resolveChronicleRoot() };

  try {
    if (diagramPath) {
      const machine = await loadWorkspaceStateMachine(diagramPath);
      return NextResponse.json({
        data: machine,
        meta: { readonly: true, path: diagramPath, source },
      });
    }

    const diagrams = await listEpisodeDiagrams();
    return NextResponse.json({
      data: { count: diagrams.length, diagrams },
      meta: { readonly: true, source },
    });
  } catch (error) {
    const status =
      error instanceof InvalidDiagramPathError ? 400
      : error instanceof DiagramNotFoundError ? 404
      : error instanceof DiagramMappingError ? 422
      : error instanceof ChronicleRootUnavailableError ? 503
      : 500;

    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : 'Episode diagrams unavailable',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        source,
      },
      { status },
    );
  }
}
