# 09 — Inquiry Weave Visibility

> An episode is not only a plan and its state machine. It is also the inquiries that gave rise to it — an artefact, an issue, and the episodic memory they were synced into. Forgewright must let those three identities be *seen* together, sourced from the same relational substrate that already serves episodes and plans.

**Version**: 0.1.0
**Framework**: RISE v1.2
**Date**: 2026-07-15
**Branch**: `4-plan-episode-visibility`
**Kin**: `08-medicine-wheel-integration.spec.md`

---

## Reverse Engineering

*How Forgewright renders episode/plan data today, on this branch.*

Forgewright reads Chronicle data **read-only over HTTP** from a single Medicine Wheel origin. There is no local store; the episode/plan surface is a projection of Medicine Wheel nodes.

**Read path as it exists today** (`src/lib/chronicle/client.ts` → `getChronicleSnapshot()`):

1. Resolves an origin from `MW_API_URL` (default `http://127.0.0.1:3940`). The origin must be a bare `http(s)` origin — no credentials, path, query, or fragment.
2. Concurrently fetches `/api/health` (must report `status: 'healthy'`, `provider: 'jsonl'`) and `/api/nodes`.
3. Filters `/api/nodes` down to nodes that satisfy the **artifact-reference contract**:
   - `type === 'knowledge'`
   - `metadata.contract === 'miadi.artifact-ref.v1'`
   - `metadata.root === 'MIADI_CHRONICLE_ROOT'`
   - `metadata.kind ∈ { chronicle_root, chronicle_episode, structured_plan, state_machine }`
   - `metadata.relative_path` is a safe relative path (no `..`, no absolute, no drive prefix, no backslash)
4. Normalizes each surviving node into a `ChronicleArtifactReference` carrying: `id`, `name`, `description?`, `kind`, `relativePath`, `parentId?`, `goalId?`, `goalSummary?`, `schemaVersion?`, `status?`, `direction?` (`east|south|west|north`), `createdAt?`, `updatedAt?`.
5. Buckets references into `root`, `episodes`, `structuredPlans`, `stateMachines`, sorted newest-then-name, and counts everything else as `ignoredNodeCount`.

**Render path as it exists today** (`src/app/api/chronicle/route.ts` → `src/components/chronicle/ChronicleView.tsx`, mounted as the `chronicle` tab via `ViewRouter`):

- Three metric tiles: **Episodes**, **Structured plans**, **State machines** (the last marked deferred / next-slice).
- A Chronicle-root card, then a **Registered episodes** list and a **Registered structured plans** list, each item a `ReferenceCard` showing direction emoji + Ojibwe/season, name, status, description, goal summary, relative path, timestamps.
- The **plan → episode relation** landed in #4: for a `structured_plan`, `findParentEpisode()` matches `plan.parentId` to a `chronicle_episode.id` and the card renders `Contained in {episode.name}` (or `Episode association unavailable`).
- Health capabilities on this branch report `chronicle: 'read-only'`, `structuredPlans: 'read-only'`, `stateMachines: 'deferred'`, `mcpHttp: 'deferred'`.

**Current Reality (the tension to hold):** the episode surface knows *episodes* and *plans* and the single directional edge between them. It has **no representation of Inquiry Weaves** — the three identities named in Episode 130's `AGENTS.md` (inquiry **artefact** under `MIADI_INQUIRY_ROOT`, GitHub **issue** in `miadisabelle/Etuaptmumk-RSM`, and the Chronicle **episode** they sync into) and their **sync freshness** are absent from every kind, every metric, and every card. The relation exists on disk as `<episode>/inquiry/weave.yaml` and `<artefact>/.weave.yaml` (the `@miadi/inquiry-weave` contract), and Medicine Wheel does not yet serve it — so Forgewright cannot render what it cannot read.

## Intent

*The desired state this spec advances toward.*

**Desired State:** the episode visibility views render, for each episode, the **Inquiry Weaves** related to it — surfacing all three identities together with their sync state — sourced from Medicine Wheel through the same read-only discipline that already serves episodes and plans.

Concretely, when an episode is shown, the reader can see:

- **Artefact identity** — the inquiry vessel name (`ep<NNN>-<slug>-<YYMMDD>-<uuid>`) and its relative path under the inquiry root (system-of-record: IAIP / `miadisabelle/Etuaptmumk-RSM`).
- **Issue identity** — the GitHub issue as `owner/repo#N` with its `issue_url` (e.g. `miadisabelle/Etuaptmumk-RSM#245`).
- **Episode identity** — resolved against the episode already rendered (parent linkage), so the weave hangs beneath its episode exactly as a structured plan does today.
- **Sync state** — one of `in-sync | stale | never-synced | episode-copy-diverged`, plus the `last_sync` fingerprint (`at`, `tree_sha256`, `file_count`, `bytes_total`) when present.

This resolves the tension by **extending the existing projection, not replacing it**: a new relational kind travels the same `/api/health` + `/api/nodes` read path, is filtered by the same contract discipline, and lands in the same `ChronicleView` as a child rendering under each episode. Forgewright remains a **pure read consumer** — it never writes weave metadata, never creates issues, and never touches inquiry content. The inquiry's substance stays external and human-authored (the *mystery boundary* of `@miadi/inquiry-weave`); only the three **identities** and the **sync state** are ever projected.

**Non-goals (this spec):** no implementation, no UI code, no write path, no MCP client wiring beyond naming the surface, no dependency on the IAIP Vercel API, and no rendering of inquiry content files. Registration of weaves *into* Medicine Wheel and Medicine Wheel's *storage/serving* of them are owned by the two sibling specs below.

## Specifications

*The read path and the UI placement — the acceptance surface for the sibling specs.*

### Read path (Medicine Wheel)

Forgewright consumes weaves through the origin it already uses. Two aligned surfaces exist over the same Medicine Wheel store:

| Surface | Where | Role for this spec |
|---|---|---|
| **HTTP origin** `MW_API_URL` | `http://192.168.2.30:3940` (deployment); `http://127.0.0.1:3940` (client default) | The **active read path**. `getChronicleSnapshot()` fetches `/api/health` + `/api/nodes` here. This is where weave nodes must appear. |
| **MCP server** `medicine-wheel-miadi-chronicle` | `/a/src/Miadi/etc/mcp-config-mw-ilex.json` — `npx -y ${MWCV}`, `MW_API_URL=http://192.168.2.30:3940` | The stdio tool surface over the **same store** (kin to spec 04). Named here as the alternate/agent read path; the chronicle view uses the HTTP origin directly, not MCP. Both must observe identical weave records. |

**Weave read contract.** A weave is a *relation record*, not a filesystem artifact, so it is projected as its own contract rather than overloading `miadi.artifact-ref.v1`. Medicine Wheel MUST serve weave nodes from `/api/nodes` such that Forgewright's client can recognize them:

- `type === 'knowledge'`
- `metadata.contract === 'miadi.inquiry-weave.v1'`
- `metadata.root === 'MIADI_CHRONICLE_ROOT'`
- `metadata.parent_id` === the `id` of the `chronicle_episode` node the weave belongs to (this is the linkage the episode view renders against — same mechanism as `structured_plan.parent_id`)
- `metadata.artefact_relative_path` is a safe relative path (same `isSafeRelativePath` discipline) under the inquiry root

**`WeaveRecord` projection type** (the shape Forgewright reads; the canonical producer is `WeaveRecord` exported from `@miadi/inquiry-weave` `index.ts`, mirroring `<episode>/inquiry/weave.yaml`):

```
WeaveRecord {
  id                     // Medicine Wheel node id
  episodeId              // = metadata.parent_id → chronicle_episode.id
  artefact: {
    name                 // ep<NNN>-<slug>-<YYMMDD>-<uuid>
    relativePath         // under MIADI_INQUIRY_ROOT (system-of-record: IAIP)
  }
  issue?: {
    ref                  // owner/repo#N  (e.g. miadisabelle/Etuaptmumk-RSM#245)
    url                  // https://github.com/.../issues/N
  }
  syncState              // 'in-sync' | 'stale' | 'never-synced' | 'episode-copy-diverged'
  lastSync?: {
    at
    treeSha256
    fileCount
    bytesTotal
  }
  relatedAt
}
```

Any node failing the contract is counted in `ignoredNodeCount` and never rendered — the same fail-closed rule that governs artifact references today. Weaves are **read-only**; there is no create/update/delete surface in Forgewright.

### UI placement (episode visibility views)

Placement lives inside the existing `ChronicleView` (the `chronicle` tab), holding the read-only framing already in the header ("episode files remain canonical"):

- **Metric row** — add an **Inquiry Weaves** tile alongside Episodes / Structured plans / State machines (count of recognized weave records).
- **Under each episode** — in the **Registered episodes** list, each episode `ReferenceCard` gains a child region listing the weaves whose `episodeId` matches that episode's `id`. Each weave row surfaces its three identities and sync state:
  - artefact name + relative path (mono, truncatable — same treatment as `relativePath` today),
  - issue as `owner/repo#N` linking to `issue_url` when present (labeled "no issue" when absent — `inquire --no-issue` is valid),
  - a **sync-state badge** using the platform's status-color language (kin to `OcapBadge`): 🟢 `in-sync`, 🟡 `stale`, ⚪ `never-synced`, 🔴 `episode-copy-diverged`, with `last_sync` timestamp/`file_count` as secondary text.
- **Empty state** — an episode with zero weaves renders no weave region (silence, not a placeholder), matching how the view already omits absent fields.
- **Freshness** — weaves reload on the same `Refresh` action and the same `no-store` fetch as the rest of the snapshot; no new polling.

Rendering is additive: episodes and plans continue to render exactly as on this branch. No UI code is prescribed here — only placement and the fields each surface must present.

## Exportation

*What travels to other repos, and what never does.*

**Travels outward (shared surfaces):**

- **The read contract `miadi.inquiry-weave.v1` and the `WeaveRecord` projection** are the shared boundary between three repos. This spec fixes what Forgewright *reads*; the two siblings own what is *produced* and *served*:
  - `@miadi/inquiry-weave` (Miadi repo) — `packages/inquiry-weave/rispecs/medicine-wheel-registration.spec.md`: exports `WeaveRecord` from `index.ts` in v0 as the registration seam and specifies a future `inquiry-weave register` that projects it to Medicine Wheel.
  - Medicine Wheel — `jgwill/medicine-wheel` `rispecs/inquiry-weave-registration.spec.md`: stores and serves weave records over `MW_API_URL` / `/api/nodes` under the contract above; its acceptance is *this* read path.
- **The sync-state vocabulary** (`in-sync | stale | never-synced | episode-copy-diverged`) travels as a shared taxonomy across all three repos so a badge in Forgewright means exactly what `inquiry-weave status` computed.
- **The three-identity framing** (artefact + issue + episode) travels as the relational vocabulary these repos agree on, kin to the artifact-reference contract already shared with spec 08.

**Never travels (boundaries preserved):**

- **Inquiry content.** Only the three identities and sync metadata cross into Forgewright. The inquiry's substance is external and human-authored (the mystery boundary); Forgewright neither reads nor renders content files.
- **No write path back to source.** Forgewright is a pure read consumer — it does not register, sync, or mutate weaves, issues, artefacts, or `episode.yaml`. Registration and sync stay with `@miadi/inquiry-weave`; storage stays with Medicine Wheel.
- **IAIP internals.** IAIP / `miadisabelle/Etuaptmumk-RSM` remains the external system-of-record for artefacts; Forgewright shows identity and relative path only, never a live IAIP API dependency.

**Inherited open decisions (named, not resolved here):**

- **The fate of `.hch`** (formalize / map-into-`.weave.yaml` / retire) — owned by `@miadi/inquiry-weave`; it never reaches Forgewright's read path and does not affect this spec.
- **Absorbing IAIP into Miadi packages** — a deferred decision upstream; this spec assumes IAIP stays external.

---

## References

- `08-medicine-wheel-integration.spec.md` — sibling: how Forgewright wires Medicine Wheel packages as platform infrastructure (this spec extends the same read substrate).
- `KINSHIP.md` — Forgewright's relational map; `jgwill/medicine-wheel` is a platform sibling.
- `04-mcp-tool-surface.spec.md` — the unified MCP surface; `medicine-wheel-miadi-chronicle` is the stdio tool surface over the same store read here.
- `packages/inquiry-weave/rispecs/medicine-wheel-registration.spec.md` (Miadi repo) — sibling spec: `WeaveRecord` seam + future `inquiry-weave register`.
- `rispecs/inquiry-weave-registration.spec.md` (`jgwill/medicine-wheel`) — sibling spec: store/serve weave records; acceptance = this read path.
- `@miadi/inquiry-weave` plan — three identities, `.weave.yaml` contract, mystery boundary, ep126/#245 worked example.
- `src/lib/chronicle/client.ts`, `src/app/api/chronicle/route.ts`, `src/components/chronicle/ChronicleView.tsx` — the current-reality read + render path this spec extends.

---

🌸: The episode already holds its plan by the hand; this spec teaches it to also hold the *inquiries* that started it — the artefact, the issue, and the little sync-light that says whether the memory is still fresh. Three lanterns hung across three repos, all pointed at the same window, so that when the loom finally weaves, Forgewright will already know how to see it glow.
