---
title: Policies/ frontmatter convention extension — mandatory `next-review` field + recon:policy-next-review CI gate
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-21
decision: D-POLICY-NEXT-REVIEW-CONVENTION
authority: CoSec — Owen (Company Secretary, governance)
recorded-via: scrooge:session-delegation
brief: brief:atlas:policy-frontmatter-next-review-field-recon-gate:2026-05-21
summary: Extends Policies/README.md to require a `next-review: YYYY-MM-DD` frontmatter field on every policy file, backfills all 51 existing policies, and wires recon:policy-next-review as an enforcing CI gate.
---

# Policies/ frontmatter convention extension — mandatory `next-review` field

> **Authority.** `D-POLICY-NEXT-REVIEW-CONVENTION` — CoSec (Owen (Company Secretary, governance)) per the CLAUDE.md decision-authority routing table ("Governance / procedure register" → CoSec). Recorded via CEO session-delegation: Marc approved the "both" routing (substrate gap + convention land in same PR) in-session with Scrooge on 2026-05-21.
> **Engineering substrate.** Atlas (Core banking platform architect, engineering) — recon pipeline + backfill script.
> **Brief.** `brief:atlas:policy-frontmatter-next-review-field-recon-gate:2026-05-21`.
> **Workstream.** `WS-POLICY-COMPLETION`.

## Why

Until today, the Policies/ frontmatter convention (`Policies/README.md`) named five mandatory fields (`policy-id`, `title`, `version`, `status`, `owner`, `effective-from`, `citations`). It did **not** require an explicit `next-review` date. The downstream consequence: 0 of 51 policy files carried a `next-review` field, and there was no machine-readable handle for "when is this policy due for review?"

Review cadence is a typed property of the policy itself — not a sidecar tracker in a spreadsheet or a calendar entry. Encoding the next-review date in frontmatter is consistent with single-graph discipline (Principle 2): every policy node carries the citations and lifecycle metadata needed for recon to reason about it without parsing prose.

## What changed

### 1. Convention extension (Policies/README.md)

Added `next-review: "YYYY-MM-DD"` as a mandatory frontmatter field, with default cadences:

- **`status: IN FORCE`** → `next-review = effective-from + 12 months`.
- **`status: DRAFT`** or **`status: ACTIVE`** (pre-IN FORCE working state) → `next-review = date + 6 months` (tighter cadence while the policy beds in).
- **`status: SUPERSEDED`** → `next-review` is retained as the historical scheduled date; superseded policies are exempt from past-due enforcement.

Status taxonomy widened to acknowledge `ACTIVE` as an explicit pre-IN FORCE working state (three policies already use it: `ifrs9-ecl-provisioning-policy-v1.md`, `three-lines-of-defence-policy-v1.md`, `valuation-policy-v1.md`).

### 2. Backfill (51 of 51)

`prototype/scripts/backfill-policy-next-review.ts` adds the field to every policy file. Frontmatter-only edit; no body content touched. Idempotent — skips files that already carry the field. Insertion point is directly after `effective-from:` (or `date:`, or the opening `---` if neither is present), keeping the field adjacent to its anchor for human readability.

Cadence breakdown across 51 files:

- 39 IN FORCE policies → 12-month cadence anchored on `effective-from`.
- 10 DRAFT / ACTIVE policies → 6-month cadence anchored on `date`.
- 0 SUPERSEDED policies (none exist in the current register).
- 2 files without `effective-from` (`paia-manual-v1.md`, `rmcp-v1.md`) fall back to `date` for the 6-month cadence — both are `draft`.

### 3. Recon gate (`recon:policy-next-review`)

`prototype/platform/recon/policy-next-review.ts` asserts on every `Policies/*.md` file:

- (a) the file has a YAML frontmatter block;
- (b) the frontmatter contains a `next-review:` field;
- (c) the value parses as a strict ISO calendar date (`YYYY-MM-DD`, with calendar-validity check — `2026-02-30` is rejected);
- (d) IN FORCE policies whose `next-review` is in the past relative to `clock.now()` raise a `fail`-severity Vera finding;
- (e) DRAFT / ACTIVE policies past due raise `warn` (working state is still settling);
- (f) SUPERSEDED policies are exempt;
- (g) unknown lifecycle values raise `warn` when past-due (defensive — surfaces typos like "Active " or status drift before they silently bypass enforcement).

Mode: **enforcing** at landing. The backfill made all 51 files pass on the first wired run, so flipping straight to enforcing is safe.

Wired into `bun run ci` as the final recon step (after `recon:position-revalued-cites-mark`).

## Files touched

- `Policies/README.md` — convention extension.
- `Policies/*.md` (51 files) — frontmatter-only `next-review` insertion.
- `prototype/platform/recon/policy-next-review.ts` — new recon pipeline.
- `prototype/platform/recon/policy-next-review.test.ts` — 11 unit tests covering missing-field, unparseable-date, calendar-validity, past-due IN FORCE (fail), past-due DRAFT/ACTIVE (warn), SUPERSEDED exemption, future-dated pass, no-frontmatter, unknown-status warn, and README skip.
- `prototype/scripts/backfill-policy-next-review.ts` — one-shot idempotent backfill.
- `prototype/scripts/record-d-policy-next-review-convention.ts` — one-shot Decision-event emit.
- `prototype/package.json` — `recon:policy-next-review` script + CI wire-up.

## Citations

- `D-POLICY-DOCUMENT-HOME` (CEO-approved 2026-05-12) — Policies/ canonical home + frontmatter convention.
- `D-RMS-PHASE-1` (CEO-approved 2026-05-09) — RMS event-store substrate.
- `D-RMS-PHASE-3` (CEO-approved 2026-05-17) — RecordFiled as deliverable-of-record.
- CLAUDE.md "Decision authority routing" — CoSec owns convention/procedure register changes.
- CLAUDE.md "Session delegation" — Marc's in-session "y" constitutes CEO authorisation; Scrooge records the Decision with `authorityRef: marc@tgv.co.za` and `recordedVia: scrooge:session-delegation`.

## Reviewer note for Owen

The convention text in `Policies/README.md` and the cadence rules are open to refinement at Owen's discretion — the file is in the governance register. The recon pipeline reads the rules from convention (`status` classification + cadence assumptions); if Owen later wants to change the cadence (e.g. tighter for HIGH-risk policies), the pipeline can be extended without touching the policy bodies.
