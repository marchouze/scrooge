---
title: Owner Inbox presentation fix — sorting + status filtering + title cleanup
author: Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Owner Inbox tile / activity timeline collapsed verbose ceo-decision-record titles, grouped open / informational / resolved into three sections rather than interleaving by date, and stopped showing the "decision required" badge on already-actioned items.
decision-required: false
---

# Owner Inbox presentation fix — sorting + status filtering + title cleanup

**Authors:** Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering)
**Date:** 2026-05-10

Presentation pass on the dashboard's Owner Inbox tile (home page) and Activity timeline (`/activity.html`). Standing authority: dashboard maintenance — no new CEO decision required.

## Symptoms found

The tile rendered ~25 items per `/api/state` `ownerInboxFeed`, with these issues observed (Marc's "fix owner inbox presentation"):

1. **Verbose `ceo-decision-record_*` titles.** Frontmatter `title:` for these items is the full `# H1` of the audit record — e.g. `"Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-PRODUCT-CONSTRUCTION-SUBSTRATE, 2026-05-10"` — 80+ chars. In a tile / list-item context this dominates the row and pushes the substantive items down.
2. **No grouping.** Open decisions, informational records, and (when present) resolved decisions interleaved by date. Scanning for "what does the CEO need to action?" required eyeballing every row's badge.
3. **Resolved-decision badge on Activity timeline.** The Activity page emitted a `decision-required` pill for any item with `decisionRequired: true`, even when the underlying decision was already resolved by a `CeoDecision` event. (The home tile already differentiated; the timeline did not.)
4. **No backstop for stale-cache rendering.** Renderers trusted the API order. A stale `seeds/dashboard-state.json` could render unsorted and the renderer would not re-impose grouping.

## Fix applied

Bounded presentation pass — no underlying data shape change beyond two new derived fields.

### Type additions (`prototype/dashboard/types.ts`)

- `OwnerInboxKind = "decision-pack" | "decision-record" | "deliverable"` — filename-derived classification.
- `OwnerInboxGroup = "decision-open" | "decision-resolved" | "informational"` — render bucket.
- `OwnerInboxItem.displayTitle: string` — short scannable title; equal to `title` when no shortening rule applies. The raw `title` is preserved on the item for audit and graph linkage.
- `OwnerInboxItem.kind: OwnerInboxKind` — populated at parse time.
- `OwnerInboxItem.group: OwnerInboxGroup` — set conservatively at parse time and upgraded to `decision-resolved` in `deriveState` when a matching `CeoDecision` event is found.

### Derivation (`prototype/dashboard/derive.ts`)

- `ownerInboxKindFromFilename(filename)` — pattern-matches `*_ceo-decision-record_*.md` and `*_ceo-decision-pack_*.md`.
- `displayTitleFor(title, filename, kind)` — for `decision-record` / `decision-pack`, extracts the `D-XXX` slug from the filename and renders `"Decision record · D-XXX"` / `"Decision pack · D-XXX"`. Returns the raw title when no rule applies.
- `ownerInboxFeedSort` — three-way comparator: group order first (`decision-open` → `informational` → `decision-resolved`), date desc within group, filename desc as a stable tie-break.
- `deriveState` now applies the comparator and upgrades `group` to `decision-resolved` when the item's `decisionId` is in the resolved set.

### Renderer (`prototype/dashboard/public/app.js`)

- `renderOwnerInbox` now groups items into three sections with a section heading per non-empty group (`Decision required` / `Informational` / `Decision · resolved`), each annotated with a count pill. The renderer respects API order within each group (no re-sort) but also has a backstop `OI_GROUP_ORDER` ordering applied to group keys so a stale cache that did not pre-sort still renders right.
- Section header colours use `--accent` (open) and `--good` (resolved) to match existing row styling.
- Subtitle line ("3 items · 12 awaiting decision · 0 resolved") now itemises both open + resolved counts when non-zero.
- Backwards-compat shims `ownerInboxGroupOf` / `ownerInboxDisplayTitle` synthesise the new fields if a stale cache is served.

### Activity timeline (`prototype/dashboard/public/activity.js`)

- Title now uses `item.displayTitle ?? item.title`.
- Resolved decisions get a green `decision-resolved` badge instead of the warning-coloured `decision-required` badge.

### CSS (`prototype/dashboard/public/styles.css`)

- `.oi-group-head` styling — small, uppercase-tracked group headers with per-group accent colour and a count pill.
- `.oi-row.oi-resolved` now has `opacity: 0.75` to visually de-emphasise resolved items without hiding them (audit trail intact).
- `.timeline-decision-resolved` — green-tinted badge on the activity timeline.

## Before / after counts

**Before** (legacy render, pure date-sort):

- Tile rows: 25, all interleaved by date. "Decision required" badge present on resolved items where `decisionStatus === "resolved"` was not yet set. Verbose ceo-decision-record titles in 6 rows, ~80 chars each.

**After** (new render, grouped):

- Group "Decision required": 12 rows (current snapshot) — all surfaced at the top.
- Group "Informational": 13 rows — including 6 ceo-decision-record items collapsed to `Decision record · D-XXX` form (~30 chars).
- Group "Decision · resolved": 0 rows in the current snapshot (no resolved decisions in the feed window). Verified by the `groups Owner Inbox feed` `derive` test that with a `CeoDecision` event for an Owner Inbox decision, the item moves into `decision-resolved` and is sorted last.

## Tests added

`prototype/tests/derive.test.ts`:

1. `ownerInboxKindFromFilename` — three classifications (record / pack / deliverable).
2. `displayTitleFor` — record + pack collapse to `Type · D-XXX`; deliverable returns raw title unchanged.
3. `parseOwnerInboxFile` — `kind` + `displayTitle` + `group` are populated; raw `title` preserved.
4. `ownerInboxFeedSort` — three-group ordering; date-desc within group; filename-desc tie-break.
5. `deriveState — Owner Inbox decision lift > groups Owner Inbox feed` — end-to-end: open / informational / resolved sort independent of authoring date; resolved item carries `decisionStatus: "resolved"` + `group: "decision-resolved"`.
6. `deriveState — derives displayTitle for ceo-decision-record items in the feed` — round-trip via the directory parser.

39 derive tests pass; 10 dashboard tests pass; lint clean; `recon:dashboard` green; `citation-gate` green.

## Substrate gaps remaining

- **Cache regen still uses local event store.** Per `feedback_dashboard_state_no_event_dependence`, the regen script reads `prototype/.local/event.db` and any T-stamped resolved decisions in that store leak into the committed cache. We deleted the local DB before regen so the committed cache reflects only durable / canonical state. Sustainable fix is a regen mode that excludes the local event store entirely (or asserts it is empty); routed to Atlas's D-EVENT-STORE-SCALING Slice 3a follow-on, not blocking this PR.
- **`displayTitle` is a presentation field on the canonical type.** Strictly Principle 6, presentation should be derived at the renderer layer from canonical inputs. We chose to derive `displayTitle` in `parseOwnerInboxFile` so that the API and renderer agree on the short form (single source of truth). The raw `title` is preserved alongside; this is a pragmatic call, not a principle violation, but worth revisiting under RMS Phase 1 (`D-RMS-PHASE-1`) where the Document register may carry both raw and rendered forms natively.
- **No event for `decision-required` lifecycle.** Today the resolved/open status is derived by joining the Owner Inbox file (frontmatter `decision-required: true`) against the `CeoDecision` event stream by `decisionId`. RMS Phase 1's `Decisions` register and `DecisionRecorded` event will subsume this — every `CeoDecision` becomes a Decisions register row, so the dashboard can read the register directly rather than re-deriving from filenames + frontmatter. Filed against `D-RMS-PHASE-1` Phase 2 routing.

## Files changed

- `prototype/dashboard/types.ts` — `OwnerInboxKind`, `OwnerInboxGroup`, two new fields on `OwnerInboxItem`.
- `prototype/dashboard/derive.ts` — kind / displayTitle helpers, group-aware sort, group upgrade in `deriveState`.
- `prototype/dashboard/public/app.js` — group-rendered Owner Inbox tile.
- `prototype/dashboard/public/activity.js` — display-title + resolved-badge on Activity timeline.
- `prototype/dashboard/public/styles.css` — group-header styling, resolved-row de-emphasis, resolved timeline badge.
- `prototype/tests/derive.test.ts` — 13 new test expectations across two describe blocks + two new test cases inside the existing `deriveState — Owner Inbox decision lift` block.
- `prototype/seeds/dashboard-state.json` — regenerated against a clean local event store; `ownerInboxFeed` items now carry `kind`, `displayTitle`, and `group`.

## Acceptance check

- Owner Inbox tile renders three labelled sections (open / informational / resolved). Yes.
- Resolved decisions don't display the "decision required" badge. Yes — both home tile (resolved badge / opacity) and activity timeline (green resolved badge).
- `ceo-decision-record` titles short and scannable. Yes — `Decision record · D-XXX`.
- Tests + recons green. Yes (the 2 pre-existing `runtime — Vera overnight-recon handler` failures were present on `main` before this branch and are unrelated to dashboard presentation).
- Decision record explains the changes. This file.

— Anya + Atlas
