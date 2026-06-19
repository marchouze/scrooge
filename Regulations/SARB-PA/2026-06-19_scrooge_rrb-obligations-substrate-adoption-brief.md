# Dispatch brief — RRB obligations: substrate adoption

**To:** Mira (Compliance / RegTech engineer, engineering) — or the seat that owns obligation backfill
**From:** Scrooge (Chief of Staff, orchestrator)
**Workstream:** WS-REGULATORY-LIBRARY (RRB)
**Priority:** next-tick
**Date:** 2026-06-19

**Authorities cited:** Operating-procedures **Dispatch discipline** + **Session delegation**
(CLAUDE.md); **Engineering Charter** (`Engineering-Charter.md`, `D-ENGINEERING-INTEGRITY-CHARTER`,
CEO-approved 2026-06-14); `D-RRB-OBLIGATIONS-REVIEW-MERGE`; `D-RRB-OBLIGATIONS-ADOPT` (both
CEO-approved 2026-06-19, currently markdown-leg only — see step 0). Run in an **isolated worktree**;
never `cd` to the main worktree.

---

## Why this brief exists

The RRB obligation set was authored (Mira), independently reviewed, and the CEO approved the
adoption parameters — all in a Cowork session that **lacks `bun` and the event store**, so no typed
events could be emitted. Everything is currently markdown-only. This brief carries the work onto
the engineering substrate to (a) promote the two decisions to typed `Decision` events and (b) adopt
the 45 reviewed obligations as `ObligationAdopted` events. Nothing here re-opens the CEO's choices;
it executes them.

## Inputs (all under `Regulations/SARB-PA/`)

- `_obligations.rrb-reviewed.json` — **the merge-ready set: 45 rows, `ORG-PR-067…111`**, seed
  schema, `_provenance` stripped, `company-secretary` owner slug, seed-aligned taxonomy.
- `_obligations.rrb-review-memo.md` — per-row verdicts + the Scrooge source-override addendum.
- `_obligations.rrb-deferred-values-register.md` — Authority-set values (2 deferred / 8 populated).
- `2026-06-19_scrooge_D-RRB-OBLIGATIONS-REVIEW-MERGE.md` — the two decision records.
- `_obligations.rrb-proposed.json` / `.md` — original 46-row proposal (provenance/audit trail).
- Source of truth: `source-docs/rrb-structured.json`.

## Carried decisions (do not re-litigate; verify they hold)

- Owner slug `company-secretary` (not `cosec`).
- reg31 banking-book equity (BA 340) **HELD** — equities out of scope this phase; **not** in the
  45-row set. Do not re-add.
- reg35 (BA 500) and reg36 (BA 600) adopted as **conditional**.
- Two source-overrides already applied in the reviewed file: reg24 **5%** connected-counterparty
  trigger (ORG-PR-078) and reg38 **2.5%** conservation buffer (ORG-PR-095) — both confirmed verbatim
  against source; keep them.
- Two deferred Authority-set values remain `[TBD]` by design: FX net-open-position limit
  (ORG-PR-086, reg29(3)); Pillar 2/systemic add-on % (ORG-PR-097, reg38(8)(a)). Do not invent values.

## Steps (Definition of Done gates each; full `bun run ci` from `prototype/` at the end)

0. **Promote the decisions to events.** For `D-RRB-OBLIGATIONS-REVIEW-MERGE` and
   `D-RRB-OBLIGATIONS-ADOPT`, call `recordDecision(...)` (`runtime/decisions/record.ts`,
   `authority: "CEO"`, `authorityRef: "marc@tgv.co.za"`, `recordedVia: "scrooge:session-delegation"`,
   category = engineering build decision / regulatory library). Confirm neither remains in
   `decisionsOpen`.
1. **Re-verify the merge-ready file** parses, is seed-schema-exact, ids `ORG-PR-067…111` are free in
   `_obligations.seed.json` (highest simple `ORG-PR-NN` was 66), owners ∈ the seat slug set, no
   `_provenance`, no fabricated values. Spot-check the 5%/2.5% overrides against `source-docs`.
2. **Merge** the 45 rows into `Regulations/_obligations.seed.json` (append; do not disturb existing rows).
3. `bun run citation-gate` — **zero violations** required.
4. `bun run backfill:obligations` — emits the `ObligationAdopted` events (the load-bearing step).
5. `bun run graph:seed` — wire the new obligations into the single citation graph (Principle 2); no orphans.
6. **Decide the deferred-values register's substrate form** — promote it to typed events / a
   projection-derived register rather than leaving standalone markdown (raise as a roadmap item if
   the event kind doesn't yet exist — no silent gap).
7. **Whole-tree integrity:** `git fetch origin main && git rebase origin/main`, then full `bun run ci`
   (full `tsc --noEmit`, lint, test, citation-gate) on a clean store. Scaffold-commit early; rebase
   before push; retry push on non-fast-forward (≤5).

## Definition of Done

A change is done only when: the two decisions exist as typed `Decision` events; all 45 obligations
exist as `ObligationAdopted` events and resolve in the graph with upward citations; `citation-gate`
and full `bun run ci` pass on a clean store; the deferred-values register has a substrate home or a
recorded roadmap item; and `_obligations.seed.json` contains exactly the 45 new rows (reg31 absent).

## Expected deliverable

PR on `main`: updated `_obligations.seed.json` (+45 rows), the emitted events, graph re-seed, and a
short close-out note confirming the Definition of Done — plus any substrate-gap roadmap items
(decision-event promotion path; deferred-values register event kind).
