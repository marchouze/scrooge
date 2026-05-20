---
record-id: record:documents:atlas:event-view-boundary-and-mark-period-events:2026-05-20
register-key: documents
classification: governance-seat
title: Event-vs-view boundary + `OfficialMarkAdopted` / `PeriodClosed` schemas
author: Atlas (Core banking platform architect, engineering)
brief-id: brief:atlas:event-vs-view-boundary-note-officialmarkadopted-:2026-05-20
workstream: WS-PRINCIPLE-1-EVENT-VIEW-BOUNDARY
citations:
  - D-RMS-PHASE-3
  - D-MARKETS-SCHEMA-FOUNDATION
  - D-FX-SALES-TRADING-FRONTEND
  - Principles/1-events-are-truth.md
date: 2026-05-20
status: filed
decision-required: false
---

# Event-vs-view boundary + `OfficialMarkAdopted` / `PeriodClosed` schemas

> **Author.** Atlas (Core banking platform architect, engineering).
> **Standing authority.** Principle 1 — events are the only source of truth (`Principles/1-events-are-truth.md`); `D-RMS-PHASE-3` (Documents register active); `D-MARKETS-SCHEMA-FOUNDATION` (markets event-type substrate).
> **Trigger.** CEO (Marc) structural question on which artefacts are real events vs. derived views; specific concern about month-end/year-end replay determinism for CFO-attested numbers.
> **Identity discipline.** CLAUDE.md "Dispatch discipline" — every agent reference pairs name + position on first mention; subsequent same-artefact references may use the bare name.

---

## 1. Event-vs-view boundary — the principle, stated tightly

Principle 1 says the event log is the only durable source of truth. Everything else — balances, positions, P&L, BA-return cells, dashboards, the CFO's signed financial statements — is a **query** over the log. To decide whether a candidate artefact belongs in the log or in a projection, apply this single test:

> **If I delete it from the store, can I re-derive its exact bytes from the events that remain? If yes, it is a view. If no, it is an event.**

The distinction tracks the underlying ontology:

- An **event** is the record of something that *occurred* — a real-world fact (a market price quote arrived; a counterparty confirmed a trade; a clock tick crossed midnight) or a **deliberate act by the bank** (the valuation engine elected this price as the official mark; the CFO attested that the books are closed for May 2026). Once it has occurred, no later computation can change what it was. Events are append-only; corrections are new events (`...Corrected`, `...Reversed`) that *cite* the prior event, never overwrite it.
- A **view** is anything computable from the event log under a stated policy version and code version. Views are throwaway by design — the projection that produces them can be deleted, the projection rebuilt from the log, and the output reproduced byte-for-byte (modulo non-determinism the schema should not allow). They have no truth content of their own; they have *fidelity* to the log they were derived from.

Two corollaries follow:

1. **Numbers are never events.** A mark-to-market value, an unrealised P&L, a CET1 ratio, a BA-700 line — these are projections of the log. Storing them in the event store as "the truth" inverts Principle 1: the log becomes a journal of someone-else's computations instead of the bank's own ledger of facts and acts.
2. **The acts that drive numbers are always events.** The numbers themselves are views, but the bank's *commitments* about which inputs to use, which policy version is in force, and which cutoff is attested are first-class facts. These are exactly the events the substrate is missing.

### 1.1 Canonical examples

| Artefact | Event or view | Why |
|---|---|---|
| `EquityTradeBooked(R10m AGL @ 18500c, T+3)` | **Event** | Real-world fact: counterparty agreed at this price/time. No later computation can change what was booked. |
| `FxTradeCancelled(trade-id-X, reason)` | **Event** | Deliberate act: the bank rescinded a prior commitment. Reverses but does not overwrite. |
| JSE closing print for AGL on 2026-05-20 | **Event-like (reference data)** | A real-world fact, but stored outside the event store: see `platform/market-data/store.ts` — market ticks are reference time-series, not business events. |
| `OfficialMarkAdopted(AGL.JSE, 18500c, asOf=2026-05-20T17:00Z, source=jse-closing-print, policyVersion=v1.0)` | **Event (proposed; missing today)** | Deliberate act of the valuation engine: it *elected* this tick as the official mark for the day under the policy then in force. Distinct from the raw tick, which may have many candidate sources. |
| `EquityPositionRevalued(unrealisedPnlZarMinor = +R472,318)` | **View serialised as an event (today) — should be projection only** | The number is fully derived from `OfficialMarkAdopted` (mark) + open position (events) + valuation function (code SHA). Storing it in the log is a smell; see §4. |
| Trial balance for 2026-05 | **View** | Fully derivable from posted accounting events up to `cutoffTs`. |
| `AccountingPeriodClosed(periodId=2026-05, uptoSequence=N, trialBalanceSnapshotEventId=...)` | **Event (exists today, but incomplete)** | The act of closing the period. Today's schema lacks the policy-version-set and statement-hashes needed to prove replay determinism — see §3 and §4. |
| `PeriodClosed(... cutoffTs, policyVersionRefs[], codeSha, derivedStatementHashes{...}, attestingAuthority=CFO)` | **Event (proposed; supersedes/extends `AccountingPeriodClosed`)** | The CFO's attestation — a deliberate act, not a computation. Pins the inputs to replay. |
| Income statement for 2026-Q2 | **View** | Computable from events ≤ cutoffTs under (policyVersionRefs, codeSha). The CFO's *attestation* is the event; the statement PDF is the projection. |
| BA-700 capital-adequacy return for 2026-05 | **View** | Same — computable from posted events; the *submission* event (`BAReturnSubmitted`) is the act, the return-cells are the view. |
| `ValuationPolicyVersionActivated(policyId=VALUATION-POLICY-V1, version=1.0, effectiveFrom=...)` | **Event (proposed; missing today)** | The act of placing a policy version in force. Without it, "replay under the policy in force on day D" has no machine-readable answer. |

The test holds in both directions. Trade-booked: delete it from the store, you cannot re-derive it from the remaining events — it is an event. Equity-position-revalued: delete it, you can re-derive it from the mark and the open position — it should not be an event. The current `EquityPositionRevalued` (and `FxPositionRevalued`, `IrsPositionRevalued`) types fail this test; see §4.

---

## 2. `OfficialMarkAdopted` — proposed schema

### 2.1 What it represents

The act by which the valuation engine commits to a price (or curve point, or volatility surface point) as **official** for an instrument at a timestamp. This is distinct from a raw market-data tick:

- **Market-data ticks** (e.g. JSE closing prints, Reuters FX quotes, SENS announcements) are reference data. They live in `platform/market-data/store.ts` — a SQLite time-series store deliberately separated from the event store (authority: `D-MARKETS-SCHEMA-FOUNDATION`). The same tick is observed; nothing the bank does changes its truth value. Many candidate ticks per instrument per day.
- **`OfficialMarkAdopted`** is the bank's elected position: out of all candidate ticks for instrument X at time T, *this* one is the mark we will value against, under the named valuation policy version. Exactly one per (instrument, asOf, policyVersion).

The hypothetical `MarketDataReceived` event the brief asks about does **not** exist in the substrate today and on reflection should **not** be added. The provenance gate (`platform/recon/market-data-provenance-gate.ts`) and the `MarketDataStore` already cover ingestion; pushing every tick into the event log would inflate the log with reference data and confuse the boundary set in §1. The only event-worthy thing on the price-ingestion path is *adoption*.

### 2.2 Zod schema (markdown form — to be codified in `platform/event-store/event-types/valuation.ts`)

```ts
export const officialMarkAdoptedPayloadSchema = z.object({
  /** Stable instrument key — ISIN where applicable, internal CDM key otherwise. */
  instrumentKey: z.string().min(1),
  /**
   * Mark type — discriminates the rate-shape carried in `mark`. Drives
   * downstream projection logic: a `price` feeds equity/bond revaluation;
   * a `curve-point` feeds IRS NPV; an `fx-rate` feeds FX revaluation; a
   * `vol-point` feeds option pricing (later).
   */
  markType: z.enum(["price", "fx-rate", "curve-point", "vol-point"]),
  /**
   * The official numeric mark, in **minor units** of the quoted currency
   * for `price` (e.g. cents for AGL.JSE), as a fixed-point decimal string
   * elsewhere to avoid IEEE-754 drift on replay.
   */
  mark: z.string().min(1), // decimal string; e.g. "18.5234" for ZAR/USD
  /** ISO 4217 quote currency for `price`; CCY1/CCY2 pair string for `fx-rate`. */
  quoteCurrency: z.string().min(1),
  /** Tenor for `curve-point` (e.g. "3M", "10Y"); undefined for other markTypes. */
  tenor: z.string().optional(),
  /** ISO 8601 — the as-of of the mark itself (e.g. JSE 17:00 close). */
  markAsOf: z.string().min(1),
  /**
   * Reference back to the raw tick in `MarketDataStore` (composite of source +
   * tick UUID). The tick is reference data; this is the audit pointer.
   */
  sourceTickRef: z.object({
    source: z.string().min(1), // "jse-sens" | "fx-sim" | "reuters" | …
    tickId: z.string().min(1),
  }),
  /**
   * URN of the active `ValuationPolicyVersionActivated` event that governs
   * this adoption. Replay determinism requires this: same input ticks under
   * a different policy version yield a different mark.
   */
  policyVersionRef: z.string().min(1), // e.g. "urn:event:ValuationPolicyVersionActivated:abc123"
  /**
   * SHA of the adoption code path (the function that elected this tick).
   * Pins the engine version that produced this adoption decision.
   */
  adoptionCodeSha: z.string().regex(/^[0-9a-f]{7,40}$/),
  /**
   * IFRS-13 fair-value hierarchy level (1/2/3) under which this mark sits.
   * Derived at adoption time per the policy hierarchy rules.
   */
  fairValueLevel: z.enum(["1", "2", "3"]),
  /**
   * Optional fallback chain — when the primary source was unavailable, the
   * ordered list of sources actually attempted (newest-attempt-first). Empty
   * when the primary was used.
   */
  fallbackChain: z.array(z.string()).default([]),
});
```

### 2.3 Worked example

```ts
makeOfficialMarkAdopted({
  asOf: "2026-05-20T17:05:00Z",
  entity: "BANK-ZA-001",
  actor: { type: "service", id: "agent:rohan:valuation-engine" },
  citations: [
    "D-MARKETS-SCHEMA-FOUNDATION",
    "urn:policy:VALUATION-POLICY-V1:v1.0",
    "IFRS-13-§9",
  ],
  payload: {
    instrumentKey: "ZAE000013181", // AGL.JSE
    markType: "price",
    mark: "18500",                  // cents — AGL ZAR 185.00
    quoteCurrency: "ZAR",
    markAsOf: "2026-05-20T15:00:00Z",
    sourceTickRef: {
      source: "jse-closing-print",
      tickId: "tick:jse:AGL:2026-05-20:close",
    },
    policyVersionRef: "urn:event:ValuationPolicyVersionActivated:vpva-2026-05-19-v1",
    adoptionCodeSha: "a2ae42a",
    fairValueLevel: "1",
    fallbackChain: [],
  },
});
```

### 2.4 Projections that consume it

- `platform/markets/eod/equity-revaluation.ts` — replaces today's "most-recent `EquityTradeBooked.price`" stub (`platform/projections/markets/position.ts:12`) with the official mark.
- `platform/markets/eod/fx-forward-revaluation.ts` — replaces today's primary-rate lookup against `MarketDataStore`.
- `platform/markets/eod/irs-revaluation.ts` — consumes `markType=curve-point` adoptions to assemble the daily JIBAR curve (replacing `platform/markets/eod/jibar-curve-seed.ts` static seed).
- `platform/recon/market-data-provenance-gate.ts` — instead of scanning ticks, asserts every position-revalued event cites an `OfficialMarkAdopted` whose `policyVersionRef` is active for `markAsOf`.

### 2.5 Relationship to `ValuationPolicyVersionActivated`

`ValuationPolicyVersionActivated` is the **policy-in-force** event (also missing today; should be authored alongside). Each `OfficialMarkAdopted` carries `policyVersionRef` pointing to the event-ID of the activation that was current at adoption time. The activation event itself carries: `policyId`, `version`, `effectiveFrom`, `documentHash` (the policy markdown's BLAKE3), `supersedes` (prior activation event-id), `activatedBy` (Helena (Chief Risk Officer, governance)). Replay determinism for marks then requires: same input ticks + same policy activation chain + same `adoptionCodeSha` → same `OfficialMarkAdopted` payload.

---

## 3. `PeriodClosed` — proposed schema

### 3.1 What it represents

The CFO's attestation closing a financial period. Today's `AccountingPeriodClosed` (`platform/event-store/event-types/accounting.ts:232`) carries `periodId`, `closedAt`, `trialBalanceSnapshotEventId`, `uptoSequence` — sufficient to gate downstream returns, but **insufficient to prove replay determinism**. To later prove that the published P&L, balance sheet, cash-flow statement, and BA returns were faithful renders of the log as it stood at close, the close event must pin every input variable.

The proposal: introduce `PeriodClosed` as the richer attestation event. It supersedes `AccountingPeriodClosed` for the close-attestation role; `AccountingPeriodClosed` may remain as a lower-level mechanical marker (sequence-pin) or be retired — design choice for the implementation slice (§5).

### 3.2 Replay-determinism contract

A consumer holding `PeriodClosed(periodId=P)` must be able to:

1. Replay the event log up to `uptoSequence` (or equivalently `cutoffTs`).
2. Resolve each `policyVersionRefs[i]` to the policy active in that period (valuation, accounting-IFRS, fx-translation, etc.).
3. Check out `codeSha`.
4. Run each named statement generator (`pnl`, `balanceSheet`, `cashFlow`, plus each `baReturns[code]`).
5. Hash the generator output (canonical JSON or PDF bytes — fixed per statement type).
6. Match every hash against `derivedStatementHashes` byte-for-byte.

If any hash diverges, the event is falsifiable: either the log was rewritten, the policy chain was tampered with, the code was lied about, or the generators are non-deterministic. Each is a P1 violation reportable by Vera (Internal audit engineer, engineering).

### 3.3 Zod schema (markdown form — to be codified in `platform/event-store/event-types/accounting.ts` adjacent to `accountingPeriodClosedPayloadSchema`)

```ts
export const periodClosedPayloadSchema = z.object({
  /** e.g. "period:bank-za-001:month:2026-05" */
  periodId: z.string().min(1),
  /** Period kind for downstream gates. */
  periodKind: z.enum(["month", "quarter", "half-year", "year"]),
  /** ISO 8601 — the cutoff before which all events count; after which none do. */
  cutoffTs: z.string().min(1),
  /**
   * Belt-and-braces sequence pin. `cutoffTs` is the canonical cutoff; this
   * is the event-store sequence number observed at close, included so the
   * close can be replayed without needing the clock+sequence cross-walk.
   */
  uptoSequence: z.number().int().nonnegative(),
  /**
   * The set of policy-activation event-IDs in force at cutoff. Ordered
   * canonically (sorted by URN) so a hash over the array is stable.
   * At minimum: valuation policy, accounting policy, fx-translation
   * policy. Implementation slice expands as new policy domains are added.
   */
  policyVersionRefs: z.array(z.string().min(1)),
  /** Git SHA of the bank's monorepo at the moment of close. */
  codeSha: z.string().regex(/^[0-9a-f]{7,40}$/),
  /**
   * Hashes of each derived statement the CFO attests to. Canonical JSON
   * bytes (or PDF bytes, by statement type) hashed with BLAKE3. Replay
   * must reproduce these bytes exactly.
   */
  derivedStatementHashes: z.object({
    pnl: z.string().min(1),
    balanceSheet: z.string().min(1),
    cashFlow: z.string().min(1),
    /**
     * BA returns keyed by return code. Sub-map so we can add new returns
     * without changing the top-level shape. E.g. { "BA-325": "...", "BA-700": "..." }.
     */
    baReturns: z.record(z.string().regex(/^BA-\d{3}$/), z.string().min(1)),
  }),
  /**
   * Trial balance event-id (back-compat with `AccountingPeriodClosed`).
   * Retained so the existing balance-sheet-substantiation chain keeps
   * working. Optional for periods that close without a discrete TB snapshot
   * (e.g. quarterly attestations atop prior monthly closes).
   */
  trialBalanceSnapshotEventId: z.string().optional(),
  /**
   * Attesting authority. CFO seat for monthly/quarterly; CEO + CFO joint
   * for year-end (driven by Companies Act §29). Codifying as enum so the
   * permission-gate can route attestation rights.
   */
  attestingAuthority: z.enum(["CFO", "CFO+CEO", "CFO+CEO+AC"]),
  /** Actor ID of the human/agent who signed. E.g. "agent:camille:cfo". */
  attestedBy: z.string().min(1),
  /**
   * Prior `PeriodClosed.event_id`, or `null` for the bank's first close.
   * Forms the chain — every period traces back to the founding close.
   */
  priorPeriodRef: z.string().nullable(),
  /**
   * Reopen marker — set when this close itself supersedes a prior close
   * of the same period (e.g. audit reopens 2026-05 in 2026-08). The
   * superseded close stays in the log; the new close cites it here.
   * Matches the `reopenOf` pattern on `AccountingPeriodOpened`.
   */
  supersedesClose: z.string().optional(),
});
```

### 3.4 Worked example

```ts
makePeriodClosed({
  asOf: "2026-06-05T16:42:00Z",
  entity: "BANK-ZA-001",
  actor: { type: "human", id: "agent:camille:cfo" },
  citations: [
    "IFRS-IAS-1-§29",
    "Companies-Act-71-2008-§29",
    "D-MARKETS-SCHEMA-FOUNDATION",
    "urn:policy:VALUATION-POLICY-V1:v1.0",
  ],
  payload: {
    periodId: "period:bank-za-001:month:2026-05",
    periodKind: "month",
    cutoffTs: "2026-06-01T00:00:00Z",
    uptoSequence: 184312,
    policyVersionRefs: [
      "urn:event:ValuationPolicyVersionActivated:vpva-2026-05-19-v1",
      "urn:event:AccountingPolicyVersionActivated:apva-2026-05-01-v1",
      "urn:event:FxTranslationPolicyVersionActivated:ftpva-2026-04-01-v1",
    ],
    codeSha: "a2ae42a",
    derivedStatementHashes: {
      pnl: "blake3:b1d0…f427",
      balanceSheet: "blake3:e3a9…77c1",
      cashFlow: "blake3:9f01…34dd",
      baReturns: {
        "BA-325": "blake3:cc12…0a55",
        "BA-350": "blake3:7e44…b910",
        "BA-700": "blake3:1ad7…2204",
      },
    },
    trialBalanceSnapshotEventId: "evt:trial-balance:2026-05:abc123",
    attestingAuthority: "CFO",
    attestedBy: "agent:camille:cfo",
    priorPeriodRef: "evt:period-closed:2026-04:def456",
  },
});
```

---

## 4. Substrate gap analysis

### 4.1 What exists today

- **`AccountingPeriodOpened` / `AccountingPeriodClosed` / `TrialBalanceSnapshotted`** — exist with mature Zod schemas (`platform/event-store/event-types/accounting.ts:162–340`). Drive the BA-return triggers (`platform/accounting/ba-return-trigger.ts`) and substantiation flow (`platform/event-store/event-types/accounting.ts:343–`). `AccountingPeriodClosed` has `uptoSequence` and `trialBalanceSnapshotEventId` — useful but lacks `cutoffTs`, `policyVersionRefs`, `codeSha`, and statement hashes.
- **Period-close subscribers** — `platform/returns/{ba325,ba350,ba600,ba700,cms,conduct,climate}/period-close-subscriber.ts` all key off `AccountingPeriodClosed`. Adding `PeriodClosed` requires either a new fan-out or migrating subscribers; see §5.
- **MTM events** — `MtmRunCompleted`, `IpvExceptionRaised` (`platform/event-store/event-types/mtm.ts`) describe run-boundaries and IPV failures. They do **not** describe the per-instrument mark adoption.
- **Per-position revaluation events** — `FxPositionRevalued`, `EquityPositionRevalued`, `IrsPositionRevalued` (in `platform/event-store/event-types/markets-trading-extended.ts` and `platform/markets/cdm/{equity,ird}.ts`). These store the computed unrealised P&L in the log. **This is the smell flagged in §1.2 corollary 1.** They are views serialised as events: delete them, you can recompute from the open position + the mark. The current schemas should be triaged in the implementation slice — either reclassify as projection rows (preferred) or rename to make the act-vs-number boundary explicit (e.g. `MarkAppliedToPosition` carrying only the mark ref + position ref, with the resulting P&L derived).
- **`MarketDataIngested`** — listed in `platform/event-store/permission-gate.ts:260` as a permission row but **has no Zod schema, no `make...` constructor, and no registry entry**. It is a ghost type. Saskia (Markets readiness engineer, engineering) snapshot code references it (`runtime/agents/saskia-markets-readiness-snapshot.ts:220`) but `eventStore.replay({ type: "MarketDataIngested" })` returns empty. This is a substrate finding in its own right — either remove the permission row, or codify a schema (the brief recommends *not* codifying it; see §2.1).
- **Valuation policy** — `Policies/valuation-policy-v1.md` is filed and authoritative (Helena, 2026-05-19) but its activation has no event. The recon `platform/recon/market-data-provenance-gate.ts` cites the policy markdown by path, not by activation event-id. There is no machine-readable answer to "which valuation policy version was in force at time T?".
- **RMS Phase 3** is active (`D-RMS-PHASE-3`), so this record itself is filed via `RecordFiled`.

### 4.2 Where MTM/close currently touch the event store

- **MTM engines** (`platform/markets/eod/{equity,fx-forward,irs}-revaluation.ts`) replay position events from the store, read marks from `MarketDataStore` (not the event store), compute per-position revaluations, and emit `*PositionRevalued` events + a closing `MtmRunCompleted`. Mark provenance is implicit (the most-recent tick wins).
- **Close path** (`platform/accounting/period-close.ts`, `period-close-handler.ts`) consumes `AccountingPeriodClosed`, fans out to return-generation subscribers and substantiation. No code-SHA or policy-set pinning today.

### 4.3 Smells flagged

1. **`*PositionRevalued` events store derived numbers.** §1.2 corollary 1 violation. The unrealised P&L is fully re-derivable.
2. **`MarketDataIngested` ghost type.** Listed in permission gate, referenced by Saskia's snapshot, but no schema. Recon will flag it once `recon:event-type-registry-coverage` or `recon:zod-schema-coverage` is widened.
3. **Policy-version-in-force is implicit.** Valuation, accounting-IFRS, and FX-translation policies are markdown-only; no activation event chain. Replay determinism cannot be machine-asserted.
4. **`AccountingPeriodClosed` is mechanical, not attestational.** It tracks where the close-handler reached, not what the CFO attested to. The two roles should be separated; today they are conflated.

---

## 5. Recommendation — no code changes in this PR; downstream slice

This record defines the boundary and the schemas. **No event types, recon pipelines, or projections are modified by this PR.** Wiring is a separate slice — call it `D-EVENT-VIEW-BOUNDARY-WIRE` — sized to land cleanly under the dispatch-discipline gates. Suggested ordering:

1. **Slice A — `ValuationPolicyVersionActivated`.** Add the event type, registry row, recon coverage. Backfill an activation for `VALUATION-POLICY-V1` v1.0 effective 2026-05-19 (Helena's filing date). Cite the activation event from `recon:market-data-provenance-gate`. Smallest, lowest-risk slice; lights up the policy-version axis the next slices depend on.
2. **Slice B — `OfficialMarkAdopted`.** Add event type + registry + Zod + the four-domain make-constructor (`price`, `fx-rate`, `curve-point`, `vol-point`). Land a producer in the FX simulator (`platform/simulation/env-sim/market-data-sim.ts`) so seeded scenarios immediately exercise the path. Add a recon assertion: every `*PositionRevalued` emitted in a given run cites an `OfficialMarkAdopted` whose `policyVersionRef` is the active valuation policy at `markAsOf`.
3. **Slice C — `PeriodClosed`.** Add the new event type alongside `AccountingPeriodClosed` (keep both during migration). Have the close handler emit *both* — `AccountingPeriodClosed` for mechanical compatibility, `PeriodClosed` for attestation. Subscribers gradually migrate. Add a recon pipeline `recon:period-close-replay-determinism` that, for each `PeriodClosed`, checks out `codeSha` and re-runs the statement generators, comparing hashes. Initially advisory; promote to a P1-finding gate once stable.
4. **Slice D — reclassify `*PositionRevalued`.** Either retire them in favour of projection rows keyed by (position, mark-event-id), or rename to `MarkAppliedToPosition` carrying only references (mark + position) with the P&L derived in projection. Larger blast radius — dashboards, BA returns, Bea's posting engine — so this lands last and gets its own decision card.

Each slice ships under the dispatch-discipline gates (worktree isolation, scaffold-commit, full CI, citation-gate, rebase-before-push). Owning agents: Atlas (Core banking platform architect, engineering) for the event-type substrate; Rohan (Market risk engineer, engineering) for the valuation-engine wiring; Bea (Accounting & financial reporting engineer, engineering) for the close-handler change; Vera (Internal audit engineer, engineering) for the recon pipelines.

### 5.1 Substrate gaps surfaced (for Scrooge run-close)

- `MarketDataIngested` is a ghost permission row with no schema / no producer; either codify or retire (recommend retire per §2.1).
- `*PositionRevalued` events store derived numbers (P1 corollary-1 smell); reclassify in Slice D.
- No activation-event for any policy document; replay determinism is not machine-assertable today.
- `AccountingPeriodClosed` conflates the mechanical close with the CFO attestation; split in Slice C.
- `recon:market-data-provenance-gate` cites policy markdown by path, not by activation event-id; tighten in Slice A.

---

*End of record.*
