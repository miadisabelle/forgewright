# RISE Spec 10: Plan Perspective Visibility

Anchor: `jgwill/Miadi#483`.

Companion lanterns:

- `jgwill/Miadi:packages/plan-insight/rispecs/plan-perspective-registration.spec.md`
  - producer contract and registration command
- `jgwill/medicine-wheel:rispecs/plan-insight-perspective-registration.spec.md`
  - storage, query, and MCP projection contract

Kin: `rispecs/09-inquiry-weave-visibility.spec.md`.

Status: **specification only**. This file authorizes no ForgeWright code change
in the `@miadi/plan-insight` implementation session.

## Reverse Engineering

- ForgeWright already reads medicine-wheel through server-side Chronicle
  proxies so `MW_API_URL` remains off the browser.
- Inquiry Weave visibility established the fail-closed read pattern.
- Plan-to-episode navigation already has `findParentEpisode()` from commit
  `28cdbce`.
- No client projection or card section currently understands
  `PerspectiveRecord`.

## Intent

Miette's perspective becomes visible beside the plan it interprets and beside
every episode path carried in its `episodes[]` relation. ForgeWright remains a
pure read consumer: it does not generate, register, edit, or re-publish the
perspective.

## Specifications

### Server-side read proxy

Add `api/chronicle/perspectives` as the only browser-facing read path.

- Query by `episode_path` for episode cards.
- Query by perspective id or plan/session identity for plan cards, following
  the medicine-wheel endpoint contract.
- Return 400 when the required query is absent.
- Return 503 when medicine-wheel is unreachable or rejects the read.
- Never expose `MW_API_URL` to browser code.
- Never turn upstream failure into a success-shaped empty array.

### Client projection

Add a typed, fail-closed client projection for `PerspectiveRecord`.

- Validate the minimum fields needed to render: id, plan identity, title,
  bounded Markdown, episode paths, and source timestamps.
- Reject malformed records from the rendering collection.
- Treat a valid empty collection as ordinary absence.
- Keep registration and mutation methods out of the browser client.

### Plan card rendering

Render a Miette perspective section on the interpreted plan card:

- perspective title
- bounded excerpt
- explicit expand/collapse affordance for the full projected Markdown
- source/update provenance where the card convention supports it

Count zero renders no section and no warning.

### Episode card rendering

For each episode card:

- use the episode path established by `findParentEpisode()` and existing
  plan-to-episode navigation
- request perspectives whose `episodes[].path` matches that exact path
- render each matching perspective with the same title/excerpt/expand pattern

One perspective may appear beside many episode cards without duplicating or
forking its identity.

### Authority and failure boundary

- ForgeWright is read-only for plan perspectives.
- The session file remains authoritative.
- Medicine-wheel owns only the relational projection.
- A failed read leaves existing plan and episode cards usable and displays no
  fabricated perspective content.

## Exportation

- Mirror the route, client, and card-test discipline of Inquiry Weave
  visibility.
- Test 400 missing-query and 503 upstream-error proxy behavior.
- Test zero results, one plan-card result, and one record visible on multiple
  episode cards.
- Test malformed records are excluded without breaking unrelated card content.

No implementation or build is part of the Miadi carrier session.
