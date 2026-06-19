# Decision record — D-RRB-OBLIGATIONS-REVIEW-MERGE

> ⚠️ **Events-first gap:** this is the markdown leg only. The canonical `Decision` event
> could **not** be emitted from this Cowork session because `bun` and the event store are
> not present in the sandbox (`recordDecision`, `dispatch:open-brief`, `backfill:obligations`
> require them). Promote this to a typed `Decision` event via `recordDecision(...)` on the
> engineering substrate before relying on it. Tracked as a substrate gap (see report).

- **decisionId:** D-RRB-OBLIGATIONS-REVIEW-MERGE
- **phase:** approved
- **authority:** CEO
- **authorityRef:** marc@tgv.co.za
- **recordedVia:** scrooge:session-delegation
- **date:** 2026-06-19
- **category:** Engineering build decision (regulatory library / obligations)

## Recommendation (approved)

Open a review-and-merge workstream for the 46 RRB obligations proposed by Mira
(`Regulations/SARB-PA/_obligations.rrb-proposed.json`). An **independent reviewer** (not the
authoring seat) triages all 46 rows against the verbatim source, produces a renumbered,
`_provenance`-stripped, merge-ready set (continuing from `ORG-PR-67`), and surfaces every
ambiguity needing a CEO call **before** any `ObligationAdopted` event is emitted. Adoption
proper — merge into `_obligations.seed.json`, `bun run citation-gate`, `bun run
backfill:obligations`, `bun run graph:seed`, full `bun run ci` — runs on the engineering
substrate, gated on resolution of the flagged ambiguities.

## Rationale

Obligations are load-bearing (Principle 1 — they fold into `ObligationAdopted` events). The
proposal is LLM-authored and `proposed-llm-unreviewed`; a second, independent pass is required
before adoption. Marc approved the review-and-merge routing in-session on 2026-06-19.

## Scope held back for CEO decision (reviewer to surface)

- The two `[TBD]` deferrals: FX net-open-position limit (Reg 29(3)); Pillar 2 / systemic
  add-on percentages (Reg 38(8)(a)).
- The three conditional rows: reg31 (banking-book equity), reg35 (securitisation), reg36
  (consolidated supervision) — adopt-now-as-conditional vs hold.
- Owner-seat confirmations where capital/returns could sit with `cfo` vs `treasurer`.

---

# Decision record — D-RRB-OBLIGATIONS-ADOPT (adoption parameters)

> ⚠️ Same events-first gap: markdown leg only; promote to a typed `Decision` event on the
> engineering substrate (`recordDecision`) before relying on it.

- **decisionId:** D-RRB-OBLIGATIONS-ADOPT
- **phase:** approved · **authority:** CEO · **authorityRef:** marc@tgv.co.za
- **recordedVia:** scrooge:session-delegation · **date:** 2026-06-19

## CEO answers (Marc, 2026-06-19)

1. **Owner slug** — `company-secretary` confirmed canonical (not `cosec`). ✅
2. **FX net-open-position limit (reg29, ORG-PR-086)** — adopt with value deferred to the
   Authority; **keep a record of values (TBD + populated)** → `_obligations.rrb-deferred-values-register.md`. ✅
3. **Pillar 2 / systemic add-on (reg38(8)(a), ORG-PR-097)** — adopt with % deferred; tracked in
   the same register. ✅
4. **reg31 banking-book equity (BA 340)** — **HELD this phase: equities not in scope.** Row
   removed from the merge-ready set (was ORG-PR-089); revisit when equity activity comes into scope.
5. **reg35 securitisation (BA 500, ORG-PR-085)** — adopt as **conditional**. ✅
6. **reg36 consolidated supervision (BA 600, ORG-PR-088)** — adopt as **conditional**. ✅

## Resulting merge-ready set

- `_obligations.rrb-reviewed.json`: **45 rows, `ORG-PR-067…111`** (reg31 row dropped; remainder
  renumbered contiguously). `company-secretary` owner slug; seed-aligned taxonomy; no `_provenance`.
- Two source-override corrections (reg24 5% trigger; reg38 2.5% buffer) applied per the review memo.

## Remaining gate (engineering substrate, not this session)

Merge accepted rows into `Regulations/_obligations.seed.json` → `bun run citation-gate` →
`bun run backfill:obligations` (emits `ObligationAdopted`) → `bun run graph:seed` → full
`bun run ci`. Blocked here only by the absence of `bun`/event store in the Cowork sandbox.
