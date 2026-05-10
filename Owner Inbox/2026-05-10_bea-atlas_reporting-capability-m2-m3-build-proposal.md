---
title: Reporting Capability M2-M3 — build proposal & slice plan
author: Bea (Accounting & financial reporting engineer) · Atlas (Core banking platform architect)
date: 2026-05-10
summary: Concrete slice plan for the reporting engine + projection layer authorised on 2026-05-06 (M2 prudential returns, M3 IFRS AFS skeleton). Eight slices; Slices 1-3 sized for the Targeted budget so they dispatch immediately on approval.
decision-required: true
decision-id: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
decision-category: medium-term
decision-owner: Bea (Accounting & financial reporting engineer) · Atlas (Core banking platform architect)
decision-for-ceo: Approve the M2-M3 reporting-capability slice plan + Slices 1-3 pre-M2 build authorisation
decision-recommendation: Approve as drafted — Slices 1-3 (semantic-layer registry, period-close events, single-return generator harness) are pre-M2 substrate that lifts every downstream return; defaults answer the five open questions in line with the strategic foundation.
---

# Reporting Capability M2-M3 — build proposal & slice plan

**Authors:** Bea (Accounting & financial reporting engineer, engineering — reports to Camille, Chief Financial Officer) · Atlas (Core banking platform architect, engineering — reports to Devon, Chief Operating Officer)
**For:** Marc (CEO)
**Date:** 2026-05-10
**Standing authority:** CEO-approved 2026-05-06 reporting-capability build authorisation — `Owner Inbox/2026-05-06_ceo-decision_reporting-capability-build-authorisation.md`.
**Source spec (envelope):** `Owner Inbox/2026-05-06_reporting-capability-spec.md` (Anya — lead, with Bea / Camille / Mira / Helena / Eitan / Owen / Vera / Atlas).
**Workstream:** `WS-REPORTING-M2-M3` (in-flight register; build not yet started).
**Decision needed:** the 2026-05-06 authorisation set the *envelope* (build authorised; M2/M3 sequenced; build under foundation infra). It did not approve the slice decomposition or the pre-M2 substrate work. This pack lands that decision.

---

## 1. Purpose & non-goals

### 1.1 Purpose

Specify the **engine + projection layer** that produces, from the event log, every regulator-bound and IFRS-bound report the bank will need from M2 (semantic layer + first BA return) through M3 (prudential return suite + AFS skeleton). The capability turns reporting into a *projection over events* — every BA cell, every AFS line, every disclosure note is computed by replay; nothing is hand-curated.

### 1.2 Non-goals (explicitly out of scope of this proposal)

- **Individual return templates / line definitions.** Mapping `BA-325 line 42` to specific event flows is a downstream tranche per return — gated on Mira's instrument analyses (`WS-INSTRUMENT-ANALYSES`) for citation sources. This proposal lands the engine; the line-by-line definitions back-fill.
- **Live regulator submissions.** Per D1 (CEO-approved 2026-05-06), reporting builds against synthetic event flows clearly labelled `SIMULATED`; mock regulator endpoints in `prototype/simulators/`. Switch-to-live is a configuration event at licence-day, not a build event.
- **Tax-suite (M5).** Yael (Tax engineer) owns. Build-phase: PAYE / EMP201 / IRP5 paused (`buildPhaseStatus` per `Team/_team-roster.json`). CIT / VAT / STT / FATCA / CRS slice activates when revenue starts. M2-M3 cites Yael's slice gates but does not build them.
- **Compliance suite (M4).** STR / CTR / RMCP / FATCA / CRS XML generators. Owned by Mira (Compliance / RegTech engineer). M2-M3 ships the engine that M4 runs on.
- **Cloud lift (M8).** Substrate replacement only; per Atlas's `D-EVENT-STORE-SCALING` Slice 7-8.
- **Policies.** This is engineering scope. Accounting policies (IFRS adoption choices, FAIR-value-hierarchy levelling) sit with Camille (Chief Financial Officer) and are cited, not authored, here.
- **New event types this proposal.** No additions to `event-types.ts` / `registry.ts` in this PR; new types proposed in §5 land *via slice dispatches* after approval, with the usual A0 schema-freeze gate (per `Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md`).

### 1.3 Posture (rehearsal-grade, production-shape)

This is **rehearsal substrate** (build phase per `project_ai_driven_bank.md`, supersedes any "simulation" framing). Substrate is production-shaped — same code runs at licence-day with real endpoints — but every output is `SIMULATED` until commencement-of-trading. Recon harnesses gate every projection (matches Vera's continuous-controls posture). Real obligations bind at COMMENCEMENT-BIND status (per `project_rules_bind_at_commencement.md`).

---

## 2. Reporting domain map

Scope spans three families × three legal entities × four bind-status horizons. The engine is the same; the per-return content varies.

### 2.1 Per-entity scoping

Per `D-LEGAL-ENTITY-TREE-V0` (PR #82) + `D-REGULATORY-PERIMETER` (PR #85), the bank's perimeter is three legal entities under PA look-through (Banks Act 94 of 1990, Regulations Relating to Banks reg.36; consolidated supervision under Banks Act § 60 + Domain Q of the obligations register):

| Entity | LEI / ID | Reporting personality |
|---|---|---|
| **Hoz Group** (holding) | `LE-ZA-HOZ-GROUP` | IFRS 10 consolidated AFS; consolidated-supervision returns where PA look-through applies |
| **Hoz Bank** (the bank) | `LE-ZA-HOZ-BANK` | Solo-basis BA returns (Banks Act + Regulations Relating to Banks); IFRS solo AFS |
| **Hoz Securities Limited** | `LE-ZA-HOZ-SEC` | FAIS-related conduct returns (FSCA); IFRS solo AFS; tax (SARS / Yael) |

Engine consequence: every projection state is keyed by `entity` (already true in the M1 sub-ledger projection — see `prototype/platform/projections/markets/sub-ledger.ts`). Returns are produced **per-entity** then **rolled up** to consolidated through a typed consolidation projection.

### 2.2 Per-family scoping (the engine produces all of these)

#### 2.2.1 SARB / PA Banks-Act prudential returns (M2-M3)

Strategic-foundation tilt (`project_strategic_foundation`): institutional global-markets dealer, JSE bonds/equities + OTC IRD, single-branch SA, ~R300m capital target. Return prioritisation (per the 2026-05-06 authorisation):

**M2 priority (high tilt-up):**
- **BA 700 series** — IRRBB and market-risk standardised approach. Highest tilt because trading-book is the dominant exposure type.
- **BA 600** — Counterparty credit risk and CVA. Driven by OTC IRD book.
- **BA 325** — LCR (the canonical "first end-to-end return" per the 2026-05-06 authorisation §M2).

**M3 priority (prudential suite):**
- **BA 100 / 110 / 120** — Capital and reserve funds; capital adequacy (Pillar 1); composition of capital.
- **BA 200 / 210** — Statement of financial position; income statement.
- **BA 300** — Off-balance-sheet activities.
- **BA 326** — NSFR.
- **BA 330** — Large exposures (consolidated-supervision basis).
- **BA 350** — Market risk (further Pillar-1 detail beyond BA 700).
- **BA 410** — Credit-risk concentration.
- **BA 900 series** — Statistical returns (SARB economic stats).

**Tilt-down (deferred to M4+):** BA 400 retail-credit, BA 340 operational-risk (BIA at scale), BA 500 equity-investments, BA 320 daily-liquidity (only when intraday treasury operates). Engine still supports them; just not pre-populated.

#### 2.2.2 IFRS financial reporting (M3)

AFS skeleton per `IAS 1` (presentation), with notes discharging:
- `IFRS 9` (financial instruments + ECL) — primary classification engine already partly in flight via `IfrsClassificationApplied` (see §4).
- `IFRS 7` (disclosures of financial instruments) — risk-disclosure tables; sensitivity analyses.
- `IFRS 13` (fair-value measurement) — fair-value hierarchy levels (Level 1 / 2 / 3); already cited in `IfrsClassificationApplied` payload.
- `IAS 12` (income tax) — current + deferred tax computation; consumed from Yael's tax engine when it lands.
- `IFRS 10 / IFRS 12` (consolidation) — Hoz Group consolidated AFS.
- `IAS 21` (foreign-exchange) — entity-FCY revaluation; cited in `IfrsClassificationApplied`.

AFS skeleton statements (M3): SoFP, P&L + OCI, Statement of Changes in Equity, Statement of Cash Flows (`IAS 7`), notes (lite). Director report / audit wrapper / King IV / Companies Act disclosures: post-licence-day (gated on real audit committee + auditor).

#### 2.2.3 FAIS-related conduct reporting (Hoz Securities — out-of-scope this build; engine-ready)

FSCA conduct standards apply to Hoz Securities Limited as a future FSP licensee. Engine produces `ReportGenerated` events for FSCA returns; specific return content is post-FSP-licence (Zara, Chief Compliance Officer — owns).

#### 2.2.4 Ad-hoc PA / FSCA returns (engine-ready, not pre-populated)

- Joint Standard 1 of 2024 incident reports (T3 / T4 thresholds per RAS B6) — Senna (Security engineer) feeds.
- Climate-risk disclosure (PA forthcoming) — out-of-scope this build per Q4 default.
- Pillar 3 equivalent disclosures (Banks Act / PA) — engine ships post-M3 once AFS skeleton stabilises.

### 2.3 Per-bind-status routing

Per `project_rules_bind_at_commencement` (status taxonomy CORPORATE-BIND / LICENCE-BIND / COMMENCEMENT-BIND / CONDITIONAL-BIND):

| Bind status | Returns | Engine posture |
|---|---|---|
| **CORPORATE-BIND** (already binds) | CIPC annual return; tax (when revenue) | Engine produces; out-of-scope this proposal beyond shape |
| **LICENCE-BIND** (binds at SARB licence) | Banks-Act / Regs Relating to Banks BA-suite; PA Joint Standards | M2-M3 primary scope |
| **COMMENCEMENT-BIND** (binds at commencement-of-trading) | FAIS conduct, FIC AML, FATCA / CRS | Engine-ready; per-return content M4+ |
| **CONDITIONAL-BIND** (bind on trigger) | Joint Standard 1 incident, POPIA s.22 breach, ad-hoc Excon | Engine produces on-trigger via existing event flows |

---

## 3. Architectural sketch

### 3.1 Engine pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│  EVENT LOG  (P1 — single source of truth; @platform/event-store)       │
│   • IfrsClassificationApplied  (Bea, M1, append-only-audit)            │
│   • SubLedgerPostingEmitted    (Bea, M1, append-only-audit)            │
│   • EquityTradeBooked / Settled / CorporateActionApplied (markets)     │
│   • PostingRulePublished       (Bea, latest-wins-per-key)              │
│   • [NEW M2] AccountingPeriodOpened / Closed                           │
│   • [NEW M2] TrialBalanceSnapshotted                                   │
│   • [NEW M2] ReportGenerated / ReportApproved / ReportSubmitted        │
│   • [NEW M3] ConsolidationPosted / IntercompanyEliminated              │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│  PROJECTION RUNTIME  (@platform/projections — pure folds; replayable)  │
│   • Sub-ledger projection      (M1 — exists, equity slice)             │
│   • GL projection              (M2 — new; Anya)                        │
│   • Trial-balance projection   (M2 — new; Bea)                         │
│   • Period-close projection    (M2 — new; Bea)                         │
│   • Capital-stack projection   (M3 — new; Helena + Bea)                │
│   • LCR / NSFR projection      (M3 — new; Eitan + Bea)                 │
│   • RWA projection             (M3 — new; Helena)                      │
│   • Consolidation projection   (M3 — new; Bea)                         │
│   • Snapshot adoption          (Atlas D-EVENT-STORE-SCALING Slice 3)   │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│  SEMANTIC LAYER  (@platform/semantic — typed quantity registry)        │
│   Per-quantity definition with citation:                               │
│     • Balance(account, entity, currency, asOf)                         │
│     • Exposure(counterparty, kind, asOf)                               │
│     • RWA(approach, asOf)                                              │
│     • CET1, AT1, T2, leverage                                          │
│     • LCR, NSFR, HQLA                                                  │
│     • ECL(stage, portfolio, asOf)                                      │
│   Each definition: { id, citation, projection, formula, units }        │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│  REPORT GENERATORS  (@domains/reporting/<type> — pure, deterministic)  │
│   • BA-return generator   (per return: BA325, BA700, …)                │
│   • AFS generator         (IFRS-aware; statements + notes)             │
│   • Pack generator        (board / committee — Owen + Helena)          │
│   • XML schema validator  (regulator XSD; pre-submission gate)         │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│  RENDER + STORE  (RMS document store — content-addressed; BLAKE3)      │
│   • JSON (machine-readable; Q5 default)                                │
│   • XML  (regulator-portal-shaped; XSD-validated)                      │
│   • PDF / HTML  (downstream rendering slice — out of M2-M3)            │
│   Every artefact is hash-stored; ReportGenerated event references hash │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Layered responsibilities

- **Event log** is sole authority (Principle 1). Every report derives by replay; no stored "as-of report state" outside the event log + content-addressed artefact store.
- **Projections are caches.** Per `prototype/platform/projections/README.md`: "By Principle 1, projections are *caches* — never authoritative." Recon harnesses (existing: `@platform/recon`) gate every projection rebuild.
- **Semantic layer is the typed contract.** Every named quantity has exactly one definition, exactly one citation. Same number reaches BA return, AFS note, BRC pack, regulator submission.
- **Report generators are pure functions** of (semantic-layer query, as-of, entity, output-format). Determinism is testable: same inputs → same content hash.
- **Render layer is downstream.** JSON-first (Q5 default); PDF/HTML as a downstream rendering slice.

### 3.3 As-of replay (already supported)

Atlas's `D-EVENT-STORE-SCALING` Slice 2 (PR #143) shipped per-stream snapshots + `replayFromSnapshot` (see `prototype/platform/event-store/store.ts:51-79`). Reporting projections **must** consume snapshots via `Slice 3 — Snapshot adoption (consumers)` in `D-EVENT-STORE-SCALING`. This is already sequenced; no new dependency.

---

## 4. Sub-ledger architecture

### 4.1 What exists today

The M1 sub-ledger projection (`prototype/platform/projections/markets/sub-ledger.ts`) materialises typed accounting entries from equity trade events. Each row is a posting *candidate* keyed by `(sourceEventId, legKind)`; classification (HFT / FVTPL / FVOCI / amortised cost) is Bea's downstream call via `IfrsClassificationApplied`. The chart of accounts skeleton is at `prototype/platform/accounting/_chart-of-accounts.md` + `chart-of-accounts.schema.json`; posting rules at `_posting-rules.md` + `posting-rule.schema.json`.

Existing event family (registered in `prototype/platform/event-store/registry.ts:965-1029`):

- `IfrsClassificationApplied` — IFRS-9 / IFRS-13 / IAS-21 dispatch outcome per trade. `append-only-audit` replay (forensic; correction = new event, never overwrite — matches `IAS 1` / Companies Act 71/2008 s.28-30 audit-trail expectation). 7-year retention floor (Companies Act 71/2008 s.24).
- `SubLedgerPostingEmitted` — trade-date / settlement-date / dividend-accrual posting derived from classification. Same `append-only-audit` + 7-year floor.

### 4.2 What M2 adds

**Per-entity sub-ledgers (Q2 default).** Today the projection state is keyed `(entity, account, currency, asOf)`. M2 promotes entity to a first-class projection partition: one sub-ledger projection instance per `LE-ZA-HOZ-BANK` and `LE-ZA-HOZ-SEC`, with a third **consolidation projection** that performs IFRS 10 elimination and rolls up to `LE-ZA-HOZ-GROUP`. This pattern matches PA look-through reporting (Banks Act § 60).

**GL projection (Anya).** A typed general-ledger projection consuming `SubLedgerPostingEmitted` + posting rules. Output: per-account balance series with full provenance (`sourceEventId` chain back to the trade). Replaces the *concept* of a GL — there is no stored GL; balance is a query.

**Period-close events (Bea, M2).** New event types proposed (subject to A0 schema-freeze process):

- `AccountingPeriodOpened { period, entity, openedAt, citations }`
- `AccountingPeriodClosed { period, entity, closedAt, trialBalanceHash, citations }`
- `TrialBalanceSnapshotted { period, entity, asOf, snapshotHash, citations }`

Period-close is a *derivation* (replay over the log up to the close-date); the events record the close *commitment* and the artefact hash — the trial balance itself sits in the RMS document store. This matches `IAS 1` stewardship.

**M3 close-trial-balance recon.** The trial-balance projection ⇄ GL projection ⇄ sub-ledger projection ⇄ event log — every reconciliation rolls back to zero by construction. Vera's recon harness (`@platform/recon`) gates the close.

### 4.3 Consolidation (M3)

`ConsolidationPosted { period, parentEntity, childEntity, eliminations[], citations }` and `IntercompanyEliminated { sourceEventId, eliminationRule, citations }` capture IFRS 10 consolidation as typed events. Engine produces consolidated trial balance for `LE-ZA-HOZ-GROUP` from the sum of solo-basis trial balances minus eliminated intercompany.

---

## 5. Slice decomposition

Eight slices. Slices 1-3 are pre-M2 substrate (sized for the Targeted budget; dispatch-ready on approval). Slices 4-6 are M2 (semantic layer + first BA return + period close). Slices 7-8 are M3 (prudential suite + AFS skeleton).

Effort sizing convention: **session = one Scrooge-coordinated agent run, ~Targeted budget**. Estimates assume substrate is shaped per existing patterns (M1 IFRS-classification handler; D-EVENT-STORE-SCALING Slice 1-2; RMS Slice 1-2).

---

### Slice 1 — Semantic-layer registry skeleton (pre-M2)

**Scope.** Add `@platform/semantic` package — typed registry of named quantities. Each entry: `{ id, citation, units, projection, formula, signers }`. Skeleton with 3 worked entries: `Balance`, `Exposure`, `CashAndBalancesAtSARB`.
**Owner.** Anya (Data / analytics engineer, engineering — reports to Camille, Chief Financial Officer) — builds. Bea (Accounting & financial reporting engineer) — reviews accounting definitions. Vera (Internal audit / continuous-assurance engineer) — recon-pipeline hook.
**Effort.** 1 session.
**Exit criterion.** New recon test `recon:semantic-layer-citation-coverage` passes — every entry has a non-empty citations array; every cited ID is resolvable in the obligations register or chart of accounts. Three worked entries return values when queried against the existing M1 event stream.
**Dependencies.** Existing: `@platform/event-store`, `@platform/projections`, `@platform/recon`, M1 sub-ledger projection. None new.
**M-phase mapping.** Pre-M2. Lifts every downstream slice — every BA return cell and AFS line cites a semantic-layer entry; the layer must exist before generators land.

---

### Slice 2 — Period-close event family + handler (pre-M2)

**Scope.** Add three event types (`AccountingPeriodOpened`, `AccountingPeriodClosed`, `TrialBalanceSnapshotted`) via the A0 schema-freeze process (`Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md`). Build `bea-period-close` handler that opens/closes a period and snapshots the trial balance to the RMS document store (BLAKE3 content-addressing per RMS Slice 1 / PR #142).
**Owner.** Bea — builds handler + close logic. Atlas — registry entries (registry.ts) + retention floors (Companies Act 71/2008 s.24 → 7y, RETENTION_ACCOUNTING_7Y; matches Slice-1 pattern of `D-EVENT-STORE-SCALING`).  Camille (Chief Financial Officer) — accountable signer.
**Effort.** 1.5 sessions.
**Exit criterion.** A simulated month-end close runs end-to-end: open period → ingest M1 trades for the period → close period → trial-balance hash written to RMS doc store → `ReportGenerated`-style trail in event log. Recon: trial-balance debits = credits per entity per currency.
**Dependencies.**
- `@platform/document-store` (RMS Slice 1, PR #142) — trial-balance hash storage.
- `@platform/event-store` registry + A0 schema-freeze.
- M1 sub-ledger projection (existing).
- `D-EVENT-STORE-SCALING` Slice 1 (retention metadata) — already merged.

**Concurrency note.** Touches `event-types.ts` + `registry.ts` + `handler-callables.ts` + `handlers-metadata.ts`. Per `feedback_handlers_metadata_three_way_clash` — must not run in parallel with another handler-introducing dispatch; `recon:runtime-handler-sync` must pass pre-push.

**M-phase mapping.** Pre-M2. Period-close primitive is the unit of all subsequent prudential / IFRS reports.

---

### Slice 3 — Single-return generator harness (pre-M2)

**Scope.** Build `@domains/reporting` package with one worked generator: **BA 325 (LCR)**. Generator is a pure function `(semanticLayerSnapshot, entity, asOf) → BA325Output`. Output JSON-first; XML schema validation deferred to Slice 5. Generator outputs a `ReportGenerated` event; artefact hash-stored in RMS doc store.
**Owner.** Bea — accounting + return shape. Eitan (Treasurer, governance — reports to Camille) — LCR / liquidity logic. Anya — semantic-layer integration. Atlas — `ReportGenerated` event type + registry.
**Effort.** 2 sessions.
**Exit criterion.** Recon test `recon:ba325-lcr-generation` runs the generator against synthetic event stream and asserts: (a) all input semantic-layer entries cited, (b) output hash matches when re-run (determinism), (c) every line carries either a citation or a `[citation: TBC]` placeholder per Q1 default. Generator runs in <2 seconds against snapshot-based replay.
**Dependencies.** Slices 1 + 2; `D-EVENT-STORE-SCALING` Slice 3 (snapshot adoption — consumes Atlas's PR #143 snapshot APIs).
**M-phase mapping.** Pre-M2 ramp; closes the engine round-trip end-to-end on one return so M2 follow-on returns are pure additions, not platform work.

---

### Slice 4 — Semantic-layer expansion + BA-700-series + BA-600 generators (M2)

**Scope.** Extend semantic layer with market-risk + counterparty-risk + RWA quantities. Add BA 700 (IRRBB) + BA 350 (market-risk, partial) + BA 600 (counterparty credit risk + CVA) generators on the Slice-3 harness. Per the strategic-foundation tilt — these are the highest-priority returns for an institutional dealer.
**Owner.** Bea — accounting/return shape. Helena (Chief Risk Officer, governance — reports to CEO) — market-risk + counterparty-risk methodology + RAS linkage. Anya — semantic entries. Saskia (Head of Global Markets, governance — reports to CEO) — trading-book taxonomy.
**Effort.** 3 sessions.
**Exit criterion.** All three returns generate against synthetic event stream; outputs land in RMS doc store; recon harness asserts: (a) RWA components reconcile to capital-stack projection (forward-link to Slice 7); (b) every line cites a Banks-Act / Regulations-Relating-to-Banks instrument or `[citation: TBC]`; (c) generator output stable across re-runs (determinism).
**Dependencies.** Slices 1-3; existing markets event family (`EquityTradeBooked`, `EquityCorporateActionApplied`, `EquitySettlementInstructed`); product-construction substrate (`prototype/platform/markets/products/composeProduct.ts`); CDM entities (`prototype/platform/markets/cdm/`).
**M-phase mapping.** M2. The 2026-05-06 authorisation §M2 named "BA 325 (LCR) generated end-to-end" as exit; this slice extends to the strategic-foundation-priority returns within the same M2 envelope.

---

### Slice 5 — XML render layer + regulator-portal shape (M2)

**Scope.** XSD-validated XML output for the Slice-3/4 returns. PA publishes XSDs for some returns and prescribed PDF formats for others; engine emits both. `ReportSubmitted` event includes submitter identity + portal-payload hash + (mock) regulator-portal endpoint per D1 (synthetic / `prototype/simulators/`).
**Owner.** Bea — return shape. Atlas — render-layer infrastructure + simulator harness. Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer) — PA / FSCA portal taxonomies (citation: typed, versioned references in obligations register Domain B).
**Effort.** 2 sessions.
**Exit criterion.** XML for BA 325 / BA 700 / BA 600 validates against PA-published XSD (or placeholder XSD per Q1 if PA XSD not yet ingested); `ReportSubmitted` events fire against `prototype/simulators/sarb-prudential.ts`; recon asserts portal-shape integrity.
**Dependencies.** Slice 4; `prototype/simulators/` (extension; mostly pre-existing scaffold).
**M-phase mapping.** M2 closing.

---

### Slice 6 — Capital-stack + LCR / NSFR + RWA projections (M3)

**Scope.** Three new projections on the runtime: `capital-stack` (CET1 / AT1 / T2 / leverage), `liquidity` (LCR / NSFR / HQLA), `rwa` (credit / market / operational / total). Each is a pure fold over events; semantic-layer entries reference the projections. Recon harness gates each projection.
**Owner.** Helena — methodology + RAS linkage. Bea — accounting + return-cell mapping. Eitan — LCR / NSFR. Anya — projection runtime mechanics.
**Effort.** 3 sessions (parallelisable across the three projections; coordinate concurrency on the `@platform/projections` package).
**Exit criterion.** Each projection has a recon test that asserts agreement with the GL / sub-ledger projection; capital-stack output ties to `IfrsClassificationApplied` / `SubLedgerPostingEmitted` event chain; LCR projection drives BA 325 line outputs (forward-link from Slice 3) without re-derivation.
**Dependencies.** Slices 1-5; `D-EVENT-STORE-SCALING` Slice 4 (compaction policy) — needed for projection rebuild SLA.
**M-phase mapping.** M3 opening — the prudential-projection layer for the M3 prudential return suite.

---

### Slice 7 — Prudential return suite (M3)

**Scope.** Generators for BA 100 / 110 / 120 / 200 / 210 / 300 / 326 / 330 / 350 / 410 / 900-series. Each is a thin generator on top of Slice 6 projections. Returns produced **per-entity** (LE-ZA-HOZ-BANK solo) plus consolidated (LE-ZA-HOZ-GROUP look-through, per Banks Act § 60).
**Owner.** Bea — return shape, account mapping. Helena — methodology (Pillar 1 capital adequacy, large-exposures methodology, Pillar 1 market-risk). Anya — semantic-layer entries per return cell. Camille — accountable signer (every return's `ReportApproved` event signed by Camille).
**Effort.** 4 sessions (split BA-100/110/120 capital, BA-200/210 financial, BA-300/326/330 off-balance/liquidity/large-exposures, BA-350/410/900 market/concentration/stats).
**Exit criterion.** All named returns generate against synthetic event stream; `recon:prudential-return-coverage` asserts every return cell traces to a semantic-layer entry; consolidated returns reconcile to sum-of-solo minus eliminations; every return-line citation either resolves in obligations register or carries `[citation: TBC]` per Q1.
**Dependencies.** Slices 1-6; `D-EVENT-STORE-SCALING` Slice 5 (stream partitioning by entity — supports per-entity replay efficiently); consolidation projection (sub-slice within this slice).
**M-phase mapping.** M3 substantive.

---

### Slice 8 — IFRS AFS skeleton generator (M3)

**Scope.** AFS generator emitting Statement of Financial Position, P&L + OCI, Statement of Changes in Equity, Statement of Cash Flows (`IAS 7`), notes-lite (financial-instruments disclosures per `IFRS 7`, fair-value-hierarchy per `IFRS 13`, IFRS 9 ECL skeleton). Per-entity solo + consolidated (IFRS 10).
**Owner.** Bea — IFRS shape, note structure. Camille — accountable signer + accounting-policy adoption choices (cited from `Owner Inbox/2026-05-06_core-policies-finance.md` §1-3, not authored here). Anya — semantic-layer integration. Vera — assurance-pipeline hooks.
**Effort.** 3 sessions.
**Exit criterion.** AFS skeleton generates for each of the three entities; `recon:afs-trial-balance-tie` asserts AFS line-totals reconcile to trial-balance (Slice 2); IFRS 10 consolidation ties (Hoz Group = Hoz Bank + Hoz Securities − eliminations); cash-flow statement ties to GL movements.
**Dependencies.** Slices 1-7; consolidation projection (Slice 7 sub-slice); IFRS 9 ECL — for build-phase, `Stage 1` placeholder only (Helena's Tier-1 ECL model is a downstream tranche).
**M-phase mapping.** M3 closing — the 2026-05-06 authorisation §M3 named "AFS skeleton generates" as gate.

---

### Slice summary — sequencing

```
Slice 1  Semantic-layer registry          ── pre-M2 ── 1.0 sess  ── Anya/Bea
Slice 2  Period-close event family        ── pre-M2 ── 1.5 sess  ── Bea/Atlas
Slice 3  Single-return harness (BA 325)   ── pre-M2 ── 2.0 sess  ── Bea/Eitan/Anya
Slice 4  Sem-layer + BA 700/350/600       ── M2     ── 3.0 sess  ── Bea/Helena/Saskia
Slice 5  XML render + portal shape        ── M2     ── 2.0 sess  ── Bea/Atlas/Mira
Slice 6  Capital/Liquidity/RWA projections── M3     ── 3.0 sess  ── Helena/Bea/Eitan
Slice 7  Prudential return suite          ── M3     ── 4.0 sess  ── Bea/Helena/Anya
Slice 8  AFS skeleton generator           ── M3     ── 3.0 sess  ── Bea/Camille/Vera
                                          ──────────────────────
                                          Total ~19.5 sessions
```

Slices 1-3 dispatch immediately on CEO approval. Slices 4-8 dispatch sequentially with substrate gaps (§7) addressed in parallel.

---

## 6. Substrate dependencies (cite + consume)

| Component | Citation | What we consume |
|---|---|---|
| `@platform/event-store` (registry) | `prototype/platform/event-store/registry.ts:965-1029` | Existing M1 IFRS-classification + sub-ledger event types; A0 schema-freeze process |
| `@platform/event-store` (snapshots) | `prototype/platform/event-store/store.ts:51-79`; `D-EVENT-STORE-SCALING` Slice 2 (PR #143) | `replayFromSnapshot` API for as-of replay efficiency |
| `@platform/projections` runtime | `prototype/platform/projections/runtime.ts`; README at `prototype/platform/projections/README.md` | Pure-fold projection runtime (`Projector` interface) |
| M1 sub-ledger projection | `prototype/platform/projections/markets/sub-ledger.ts` | Typed posting candidates per equity event |
| `@platform/document-store` | `prototype/platform/document-store/`; RMS Slice 1 (PR #142) | BLAKE3 content-addressed storage for trial balances, return artefacts, AFS renders |
| RMS event family | RMS Slice 2 (PR #144); spec `Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md` | Record-helpers pattern; `RecordEvent` shape for `ReportGenerated` family |
| Chart of accounts | `prototype/platform/accounting/_chart-of-accounts.md` + `chart-of-accounts.schema.json` | Account taxonomy; per-account citations |
| Posting rules | `prototype/platform/accounting/_posting-rules.md` + `posting-rule.schema.json` | Event-flow → account dispatch |
| Product-construction | `prototype/platform/markets/products/composeProduct.ts` | Instrument shape (semantic layer references this for instrument-typed quantities) |
| CDM entities | `prototype/platform/markets/cdm/` | Trade representation underpinning sub-ledger postings |
| `@platform/recon` | `prototype/platform/recon/` (10+ pipelines including retention-citation-coverage, runtime-handler-sync) | Recon-pipeline pattern — every projection ships a recon harness; Vera-consumed |
| `@platform/citation` | (referenced in 2026-05-06 authorisation §"foundation infra now in place") | Citation discipline at append-time (P2) |
| Legal-entity tree | `D-LEGAL-ENTITY-TREE-V0` PR #82; `Regulations/_legal-entity-tree.md` | Entity perimeter for per-entity reporting |
| Regulatory perimeter | `D-REGULATORY-PERIMETER` PR #85; obligations register Domain Q | Consolidated-supervision basis (Banks Act § 60); PA look-through |

---

## 7. Substrate gaps surfaced

This build needs three things that don't exist yet. Each is named with a follow-on persona / proposal.

### 7.1 Semantic-layer package (`@platform/semantic`)

Doesn't exist today; M1 has no typed quantity registry. Slice 1 lands the substrate. **Persona:** Anya (Data / analytics engineer) — owns going forward; mandate already covers it per `Owner Inbox/2026-05-06_reporting-capability-spec.md` §3.3.

### 7.2 Reporting domain package (`@domains/reporting`)

Doesn't exist today. Slice 3 lands the package + first generator. **Persona:** Bea — owns going forward. Sub-package per return type (`@domains/reporting/ba`, `@domains/reporting/afs`, `@domains/reporting/fsca`). Engineering pattern: pure functions; deterministic; recon-gated.

### 7.3 Regulator-portal simulator surface

`prototype/simulators/` referenced in the 2026-05-06 authorisation §"Build-only context" but not yet stocked with PA / FSCA / FIC endpoints. Slice 5 lands the first one (`sarb-prudential.ts`). **Persona:** Mira (Compliance / RegTech engineer) — owns going forward. Each simulator is a typed mock with the regulator's documented submission shape; switch-to-live is a configuration event.

### 7.4 (Surface, not build-blocking) Tier-1 model validation pipeline

LCR / NSFR / RWA / IFRS 9 ECL models are Tier 1 per RAS B7 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`). Independent validation is required pre-deployment + annually. M2-M3 ships **rehearsal-grade** models; Tier-1 validation pipeline is a downstream tranche, owned by Helena (Chief Risk Officer) + future model-validation function. Surfaced here so the gap is on the roadmap, not hidden.

---

## 8. Cross-cutting hooks

### 8.1 Helena's RAS lines (Chief Risk Officer)

Capital-adequacy / liquidity / market-risk RAS lines (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` B-series) are queries over the same projections this engine builds. RAS-breach detection becomes a recon harness over the capital-stack / liquidity / RWA projections — no separate substrate. Helena's RAS recalibration (post-2026-05-06 authorisation §"What changes immediately") feeds Slice-6 semantic-layer entries.

### 8.2 Camille's tax engine + Yael's slice gates

Tax provisioning lands in IFRS AFS via `IAS 12` (current + deferred tax). M2-M3 includes a *placeholder* tax line in the AFS skeleton (Slice 8) referencing Yael's tax-engine outputs when they exist. Per Yael's `buildPhaseStatus` (`Team/_team-roster.json`): PAYE / EMP201 / IRP5 paused; CIT / VAT / STT / FATCA / CRS slice activates when revenue starts. Engine doesn't block on this; placeholder + `[citation: TBC]` per Q1.

### 8.3 Owen's governance pack outputs (Company Secretary)

Board / committee packs (Owen — owns; Helena / domain leads contribute) are queries over the same semantic-layer entries. M2-M3 doesn't build pack templates (M6) but every quantity the BRC pack asks for is a semantic-layer query — the M6 pack-generator is a thin layer.

### 8.4 Mira's regulatory citations (Compliance / RegTech engineer)

Every return cell cites a Banks-Act / Regulations-Relating-to-Banks instrument (or `[citation: TBC]` per Q1). Mira owns the obligations-register Domain B (Banks Act / PA) — the typed reference catalogue this build cites against. Citation-gate (`bun run citation-gate` from `prototype/`) runs against every PR per `Citation gate` dispatch discipline.

### 8.5 Vera's continuous-controls assurance (Internal audit / continuous-assurance engineer)

Per the 2026-05-06 authorisation §"What changes immediately" — "Vera + Thandiwe attach continuous-controls assurance to the build as it proceeds — evidence pipelines from day one, not retrofitted." Each slice ships its recon harness; `recon:` pipelines extended:

- `recon:semantic-layer-citation-coverage` (Slice 1)
- `recon:trial-balance-rec` (Slice 2)
- `recon:ba325-lcr-generation` (Slice 3) and per-return analogs (Slices 4 / 7)
- `recon:capital-stack-tie`, `recon:lcr-projection-tie`, `recon:rwa-projection-tie` (Slice 6)
- `recon:prudential-return-coverage` (Slice 7)
- `recon:afs-trial-balance-tie`, `recon:consolidation-elimination-tie` (Slice 8)

### 8.6 Thandiwe's Audit Forum independence (Chief Audit Executive)

Per third-line independence (CLAUDE.md "Top-of-house reporting"): Thandiwe (Chief Audit Executive, governance — functional reporting to Interim Audit Forum chaired by Owen, until a Board AC is constituted; administrative reporting through CEO) consumes the recon harnesses as third-line evidence. Build doesn't change this; recon outputs feed the Audit-Forum quarterly opinion.

---

## 9. Open questions for CEO

Five questions; defaults answer all five so the no-pause rule (`feedback_no_pause_rule`) covers the slice plan in a single approval.

### Q1 — Citation completeness vs build pace

Build the SARB return engine with placeholder line definitions (rehearsal-grade) or wait for real obligations to be analysed (currently `WS-INSTRUMENT-ANALYSES`)?

**Default answer (recommended): rehearsal-grade with placeholders.** Every return line carries either a resolved obligations-register citation or `[citation: TBC]`. Mira's instrument analyses back-fill citations as they land; engine doesn't block on regulatory analysis. Vera recon-pipeline `recon:report-citation-coverage` warns on `TBC` density above a threshold (start at 90% TBC allowed, ratchet down per quarter).

### Q2 — Sub-ledger architecture: single vs per-entity

Single sub-ledger with entity as a column, or per-entity sub-ledgers (one per Hoz Bank / Hoz Securities) plus a consolidated-rollup projection?

**Default answer (recommended): per-entity with consolidated projection.** Matches PA look-through (Banks Act § 60) and IFRS 10 consolidation pattern. Per-entity replay is also more efficient under `D-EVENT-STORE-SCALING` Slice 5 (stream partitioning by entity). Cost: small additional projection definition; benefit: regulator-credible entity perimeter from day one.

### Q3 — First period-end close: when

End of which simulated period — calendar-month-aligned with M2 acceptance, or shorter cycle (synthetic week) for faster iteration?

**Default answer (recommended): aligned with M2 acceptance.** First close is synthetic month-end at M2 acceptance gate. Subsequent closes run weekly thereafter to exercise the close engine continuously (matches `Owner Inbox/2026-05-06_reporting-capability-spec.md` §4.4 cadence — "Half-year and quarterly internal close cycles produce the same artefacts at lower formality"). Calendar-month gives a recognisable rhythm without inventing synthetic time.

### Q4 — Climate-risk disclosure: in scope or future-tranche

PA's forthcoming climate-risk disclosure regime (see obligations register — under PA-published-but-not-yet-binding) — include in M2-M3 or defer to a future tranche?

**Default answer (recommended): future-tranche.** Climate-risk disclosure framing is downstream of Helena's RAS recalibration (which itself is in flight per the 2026-05-06 authorisation). Engine *can* produce climate disclosures once the semantic-layer entries are defined; M2-M3 doesn't pre-populate them. Helena's RAS recalibration is the natural precursor.

### Q5 — Render format: JSON-only vs JSON + PDF/HTML

JSON-first render (machine-readable; fast to iterate) or also human-readable PDF/HTML at this slice (more expensive; needs render infrastructure)?

**Default answer (recommended): JSON-first; PDF/HTML as a downstream rendering slice.** JSON gives full content fidelity for recon-testing + machine submission. Human-readable PDF / HTML uses the same data — adds a presentation layer, not a content layer. Building it now slows the engine slices for no incremental regulator-credibility gain. PDF/HTML lands as a thin slice post-M3 once content is stable.

---

## 10. Recommendation — single decision, default-approve all

**Decision:** Approve the M2-M3 reporting-capability slice plan + Slices 1-3 pre-M2 build authorisation.

**Defaults adopted:** Q1 rehearsal-grade with placeholders · Q2 per-entity sub-ledgers · Q3 close at M2 acceptance · Q4 climate-risk future-tranche · Q5 JSON-first.

**Slice 1 dispatch-ready brief.** On approval, the dispatch brief for Slice 1 (semantic-layer registry skeleton) is:

> Build `@platform/semantic` package per `Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md` §5 Slice 1. Owner: Anya (Data / analytics engineer). Reviewer: Bea (Accounting & financial reporting engineer). Three worked entries: `Balance`, `Exposure`, `CashAndBalancesAtSARB`. New recon test `recon:semantic-layer-citation-coverage`. Effort budget: 1 session (Targeted). Worktree-isolated; scaffold-commit at minute 10; citation-gate before push. Decision authority: `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (this pack).

---

## 11. Authority

Standing authority for the build envelope: CEO-approved 2026-05-06, captured at `Owner Inbox/2026-05-06_ceo-decision_reporting-capability-build-authorisation.md`. This pack adds the slice plan + pre-M2 substrate authorisation; the *envelope* does not change.

Once `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` is recorded as a `CeoDecision` event (per CLAUDE.md "Events-first authoring" + Principle 1), Slice 1 dispatches without further pause (per `feedback_no_pause_rule`).

— Bea & Atlas
