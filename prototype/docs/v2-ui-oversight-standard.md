# V2 UI — Human-Oversight Standard

**Authority:** `D-V2-UI-OVERSIGHT-STANDARD` (CEO, session-delegation 2026-06-17).
**Owner:** Atlas (Platform Engineering Lead).
**Status:** standing — binds every V2 UI surface, current and future.

## Why this exists

The bank is an autonomous AI-run institution; the human (CEO, and future human
overseers) supervises the *residual* — the decisions and actions an agent cannot
make on its own (Principle 6). For that supervision to be real, the human must be
able to **see what the AI is doing across every function**. This standard makes
that a build-time obligation, not an afterthought: every V2 surface we ship is
judged against it.

This is **guidance for the ongoing V2 build**, not a one-off "oversight dashboard".
There is no separate oversight product — *every* page is an oversight surface.

## The obligation

Every V2 surface must give a human direct visibility into the AI function behind
it, through four content types — each with a fixed treatment:

1. **Key metrics.** A headline tile shows the live value **and** drills (click —
   never a modal) to a detail page carrying the **formula** (numerator /
   denominator → result) and the **constituent list** behind the number. A metric
   the human cannot decompose is not oversight.
2. **Tables / registers.** Every register is listable; **every row drills to that
   item's detail page**. Columns are explicit; the empty state is honest ("no data
   yet" — never a blank that reads as zero).
3. **Reports.** Generated regulatory artefacts (BA-700, BA-320, …) are **viewable
   in-UI**, not merely generated inside a period-close subscriber.
4. **Schemas.** The event kinds, payload shapes, issuers, subscribers, retention,
   and V1→V2 status that define *what the AI records* are **browsable** by a human.

## Cross-cutting rules (every page)

- **No agent personal names — Title only.** V2 UI surfaces NEVER render agent
  personal names (Helena, Camille, Bea, …). The bank is autonomous; persona
  names are implementation detail, not something the human overseer reads.
  Refer to seats by their function / role **Title** ("Chief Risk Officer",
  "Risk", "Accounting & financial reporting engineer"). Names are stripped at
  the `/api/v2` boundary via `seatTitle()` / `seatTitles()`
  (`dashboard/agent-title.ts`), so the client never receives a name to render.
  This applies to every name-bearing field — issuers, subscribers, owners,
  attesters, approvers. (Standing instruction from Marc; supersedes the
  internal Identity-discipline convention, which governs briefs/memories, not
  user-facing UI.)
- **Provenance is explicit.** A data page declares
  `data-provenance-source="/api/v2/<endpoint>"` and carries a
  `[data-provenance-badge]` marker; the badge resolves prod vs. simulated from the
  response's `pageProvenance`, kept in sync with the header **Prod / + Sim** toggle.
  A prose page with no data declares `data-provenance-content="none"`. Reuse
  `provenance-badge.js` — do not invent a second badge.
- **Drill-through, not dead-ends.** Tiles → detail pages; rows → item detail pages;
  references are hyperlinks to source (regulation, decision, schema). No modals.
- **No silent gaps.** A missing or failed data source renders an explicit failure
  state (and, once it ships, surfaces in the Errors / Decision-Required surface) —
  never a blank tile that masquerades as "all clear".
- **Clean `/api/v2/*` data layer.** V2 surfaces read a dedicated `/api/v2/*` API
  that reads canonical sources directly (event registry, event store, projections).
  No V1 dashboard chrome. Every endpoint returns its view plus a `pageProvenance`
  field and an `asOf` timestamp, and honours `?provenance=prod|prod+sim`.

## How to build a new V2 data surface (checklist)

1. Add a `/api/v2/<endpoint>` route returning `{ ...view, asOf, pageProvenance }`,
   provenance-filtered by the `?provenance=` param
   (`provenanceFilterFromMode` in `dashboard/v2-views.ts`).
2. Page `<body data-provenance-source="/api/v2/<endpoint>">`; put a
   `<span data-provenance-badge="page-top"></span>` in the header.
3. Load `_v2-shell.js`, `provenance-badge.js`, `_v2-tile.js`, `_v2-data.js`.
4. Fetch via `v2WireLoader(async () => { const d = await v2Fetch(...); /* render */ })`
   so the toggle re-runs the loader and the badge repaints.
5. Metric tiles drill to a detail page with a formula block; list rows carry an
   `href` to their item detail page; references are real links.
6. The page must satisfy `recon:provenance-badge-coverage` (badge CSS + JS + an
   explicit provenance declaration).

## Reference implementation — first slice (Schemas & substrate)

- API: `GET /api/v2/schemas`, `GET /api/v2/schemas/:type`, `GET /api/v2/substrate`
  (`dashboard/server.ts` → `dashboard/v2-views.ts`), reading `EVENT_TYPE_REGISTRY`
  and the event store.
- Pages: `operations/schemas.html` (full event-schema browser, filterable, rows →
  detail), `operations/schema.html` (payload field shape, consumers, retention +
  citations, recent example envelopes), `operations/substrate.html` (event-store
  totals, V1→V2 ratchet **as a formula**, retention-tier distribution, recon-gate
  health).

## Follow-on slices (each its own PR, built to this standard)

- **Financial metrics** — capital / CET-1, LCR, NSFR, ALM, market risk (VaR),
  credit (SA-CCR), each with formula + constituents.
- **Registers** — decisions, briefs, workstreams, obligations (row → item detail).
- **Reports** — in-UI viewer for generated BA-700 / BA-320 returns.
- **Errors / Decision-Required** — the surface that catches every "no silent gap".
