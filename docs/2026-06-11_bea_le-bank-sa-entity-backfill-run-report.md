# LE-BANK-SA → LE-ZA-HOZ-BANK entity-id backfill — run report

- **Author:** Bea (Accounting & financial reporting engineer, engineering)
- **Date executed:** 2026-06-11
- **Authority:** D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN (CEO-approved 2026-06-11)
- **Precedent:** D-G2-ENTITY-ID-BACKFILL (CEO-approved 2026-05-22) — the BANK-ZA-001 backfill that established the mechanism (`scripts/backfill-entity-id-g2.ts`, PR #735)
- **Brief:** `brief:bea:le-bank-sa-le-za-hoz-bank-entity-reconciliation:2026-06-03`
- **Target store:** canonical home event store (`$HOME/.local/share/bank/event.db`), 98,196 events pre-run
- **Run ref:** `backfill:entity-id-le-bank-sa:2026-06-11T06:21:18.883Z`

## 1. Scope

13 events in the canonical event store carried the legacy `entity = "LE-BANK-SA"`
identifier. Unlike `BANK-ZA-001` (registered as `status: "retired"` in
`LEGAL_ENTITY_SHORT_ID_REGISTRY`), `LE-BANK-SA` was **never registered** — every
one of these rows was an *unregistered/rogue* hard-fail in
`recon:entity-identity-coherence` at any timestamp.

| Event type | Count | Provenance | as_of |
|---|---|---|---|
| BalanceSheetProjected | 1 | build-phase-fixture | 2026-05-27 |
| CapitalEvent | 1 | simulated | 2026-06-01 |
| DepositTaken | 1 | build-phase-fixture | 2026-06-01 |
| FundingLineDrawn | 1 | build-phase-fixture | 2026-06-01 |
| InterbankLoanPlaced | 2 | build-phase-fixture | 2026-06-01 |
| RepoTradeOpened | 1 | build-phase-fixture | 2026-06-01 |
| SeedDescoped | 1 | simulated | 2026-06-01 |
| SubLedgerPostingEmitted | 5 | simulated | 2026-06-01 |
| **Total** | **13** | | |

## 2. Mechanism (Principle 1 compliant)

Identical to the proven G2 mechanism, now extracted into a shared core
(`scripts/backfill-entity-id-core.ts`) parameterised by legacy-id + authorising
decision, and reused by both scripts:

1. Replay the store; identification rule is simple equality
   `event.entity === "LE-BANK-SA"`.
2. Per identified row: `eventStore.reclassifyEntity(eventId, "LE-ZA-HOZ-BANK")`
   — envelope-axis UPDATE only; payload, as_of, actor, citations, sequence and
   provenance are untouched.
3. Per reclassified row: one typed `EntityReclassified` audit event
   (entity `LE-ZA-HOZ-BANK`, provenance `production`, actor
   `{type:"system", id:"bea@bank"}`) recording prior/new entity, the
   authorising decision (`D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN`),
   and a `runRef` clustering the run.
4. Idempotent: `reclassifyEntity` returns `already-at-target` on re-runs;
   `--dry-run` supported.

The G2 script (`scripts/backfill-entity-id-g2.ts`) keeps its CLI behaviour and
exports unchanged as a thin wrapper over the shared core. Tests:
`tests/backfill-entity-id-le-bank-sa.test.ts` (mirrors the G2 suite + a seeded
end-to-end case asserting the audit-event axes and decision citation).

## 3. Dry-run output (captured 2026-06-11T06:21:09Z)

```
mode=dry-run totalEvents=98196 — backfill-entity-id-le-bank-sa — pre-counts
mode=dry-run scanned=98196 candidates=13 reclassified=0 skippedAlreadyAtTarget=0
  auditEventsEmitted=0 totalEventsAfter=98196 — dry-run summary (no events mutated)
by event type: SubLedgerPostingEmitted=5, InterbankLoanPlaced=2, RepoTradeOpened=1,
  DepositTaken=1, FundingLineDrawn=1, BalanceSheetProjected=1, SeedDescoped=1, CapitalEvent=1
```

## 4. Live run (2026-06-11T06:21:18Z)

```
mode=apply scanned=98196 candidates=13 reclassified=13 skippedAlreadyAtTarget=0
  auditEventsEmitted=13 totalEventsAfter=98209 — apply summary
```

Post-run verification (SQL against the home store):

| Check | Result |
|---|---|
| `COUNT(*) WHERE entity='LE-BANK-SA'` | **0** |
| `COUNT(*) WHERE type='EntityReclassified'` (hot table) | **13** |
| …of which `payload.decisionRef = D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN` | **13** |
| Audit-event provenance kind | `production` × 13 |
| Second live run (idempotency) | `candidates=0 reclassified=0 auditEventsEmitted=0` |

Note: the hot-table `EntityReclassified` count is 13 (not 13 + the ~11.7k G2
audit events) because the G2-era audit events were moved to cold archive
partitions (`$HOME/.local/share/bank/archives/event-2026-05-26*…05-27*.db`,
11,696 rows across four partitions). The hot-table count of exactly 13 is the
expected post-run state.

## 5. Before/after projection figure deltas

Captured with a fixed `asOf = 2026-06-11T23:59:59.999Z` immediately before and
after the live run (same capture script, same store). Liquidity figures use the
dashboard's canonical call (`getALMPositionSnapshot(store, asOf, 30, "LE-ZA-HOZ-BANK")`
+ `computeLCR`/`computeNSFR`), capital uses `computeCapitalMetrics`, GL uses
`buildGlView` trial-balance totals.

| Figure | Before | After | Δ |
|---|---|---|---|
| Total events in store | 98,196 | 98,209 | **+13** (the audit events) |
| Capital — available capital (ZAR) | 300,000,000 | 300,000,000 | 0 |
| Capital — TICR (ZAR) | 36,675,000 | 36,675,000 | 0 |
| Capital — headroom (ZAR) | 263,325,000 | 263,325,000 | 0 |
| Capital — total RWA (ZAR) | 261,974,849.30 | 261,974,849.30 | 0 |
| Capital — CET1 ratio | 114.51% (green) | 114.51% (green) | 0 |
| GL trial balance — ledger entries | 2,152 | 2,152 | 0 |
| GL trial balance — total debits (minor) | 161,986,651,406 | 161,986,651,406 | 0 (balanced before + after) |
| LCR (LE-ZA-HOZ-BANK scope) | 22,475.60% | 22,475.60% | 0 |
| LCR — HQLA (ZAR) | 2,247,559,845.18 | 2,247,559,845.18 | 0 |
| LCR — net 30d outflows (ZAR) | 10,000,000 | 10,000,000 | 0 |
| NSFR (LE-ZA-HOZ-BANK scope) | 260.47% | 260.47% | 0 |
| NSFR — ASF (ZAR) | 300,000,000 | 300,000,000 | 0 |
| NSFR — RSF (ZAR) | 115,177,992.26 | 115,177,992.26 | 0 |
| LCR/NSFR (store-wide, unscoped) | identical to scoped | identical to scoped | 0 |

**Why every figure delta is zero (verified, not assumed):** the full JSON
capture diff shows `totalEvents` as the *only* changed line.

- The 6 funding-type events (DepositTaken, FundingLineDrawn,
  InterbankLoanPlaced ×2, RepoTradeOpened, BalanceSheetProjected) all carry
  `build-phase-fixture` provenance, so the LCR/NSFR folds already excluded
  them via the operating-book filter
  (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE) *before* the entity predicate is
  ever evaluated. Moving their entity axis cannot re-admit them.
- The `CapitalEvent` feeds `computeCapitalMetrics` and the ASF fold, both of
  which replay **store-wide** (deliberately unscoped — see the entity-scoping
  comment block in `platform/projections/alm-positions.ts`, which named this
  exact `LE-BANK-SA` CapitalEvent as the reason blanket scoping was deferred).
  It counted before and counts after; only its envelope entity is now correct.
- The 5 `SubLedgerPostingEmitted` feed `buildGlView`, which folds postings by
  account with no entity predicate — entity-invariant by construction.
- `SeedDescoped` is seed-lifecycle metadata; no financial projection reads it.

The re-attribution is therefore pure identity/recon hygiene with zero P&L,
capital, GL or liquidity impact — and it **unblocks** future per-entity
scoping of the capital/ASF reads: the documented blocker ("the founding
CapitalEvent sits on the legacy LE-BANK-SA identifier, so blanket-scoping
would zero Tier-1 ASF") no longer holds.

## 6. recon:entity-identity-coherence baseline (home store)

| | Before | After | Δ |
|---|---|---|---|
| Events asserted | 98,196 | 98,209 | +13 |
| fail-class violations | 2,870 | 2,857 | **−13** |
| warn-class violations | 0 | 0 | 0 |
| LE-BANK-SA violations | 13 | **0** | −13 |

The recon is **not clean** on the home store after this backfill, and that is
not papered over: the residual 2,857 fails are pre-existing test/fixture
pollution in the canonical store, unrelated to LE-BANK-SA:

| Residual entity value family | Rows |
|---|---|
| `BANK-FIXTURE-*` (OK/RED/AMBER/STAGING/NON-ECL + -NAIVE/-SNAP/-PERSIST/-FLAGOFF variants, 15 distinct values) | 2,738 |
| `TEST-ENTITY-ANYA-M1-*` (2 distinct values) | 112 |
| `bank` (bare lowercase) | 7 |
| **Total residual** | **2,857** |

These look like scenario/test fixtures appended to the shared home store
(likely via test runs that resolved the home default instead of a
`BANK_EVENT_DB` tmpdir). They are a separate data-quality finding — candidate
remediations are (a) a provenance-aware carve-out or quarantine
reclassification under a new decision, or (b) root-cause patching of whichever
test path leaks into the home store. Out of scope for this brief; surfaced for
triage.

After this backfill, `LE-ZA-HOZ-BANK` is the only *registered* entity value in
the store; zero `LE-BANK-SA` and zero `BANK-ZA-001` rows remain (warn count 0
confirms no retired-id rows survive anywhere in the hot table).

## 7. Artefacts

- `prototype/scripts/backfill-entity-id-core.ts` — shared mechanism core (new)
- `prototype/scripts/backfill-entity-id-le-bank-sa.ts` — this backfill (new)
- `prototype/scripts/backfill-entity-id-g2.ts` — refactored to thin wrapper, CLI behaviour + exports preserved
- `prototype/tests/backfill-entity-id-le-bank-sa.test.ts` — new test suite (10 assertions pass alongside the untouched G2 suite)
- 13 × `EntityReclassified` events in the canonical store, runRef `backfill:entity-id-le-bank-sa:2026-06-11T06:21:18.883Z`
