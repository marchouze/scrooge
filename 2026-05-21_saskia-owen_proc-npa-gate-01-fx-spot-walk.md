---
title: PROC-NPA-GATE-01 first activation — FX-spot internal pre-licence test
author: Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)
date: 2026-05-21
workstream: WS-MARKET-RISK-PROCEDURES
classification: ceo-only
register-key: documents
product-id: prd:bank:fx:fx-spot-usdzar
procedure-cited: PROC-NPA-GATE-01
brief: brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21
run: run:saskia:2026-05-21T09-11-08-688Z
decision-opened: D-NPA-FX-SPOT-INTERNAL-TEST
citations:
  - PROC-NPA-GATE-01
  - D-NEW-PRODUCT-APPROVAL-POLICY
  - D-PRODUCT-CONSTRUCTION-SUBSTRATE
  - PR-631
  - PR-633
  - PR-634
  - PR-635
  - PR-636
  - PR-637
  - PR-638
  - PR-639
  - PR-640
  - PR-641
  - PR-642
  - PR-643
  - PR-644
  - PR-645
  - PR-647
  - PR-648
  - PR-652
  - PR-663
  - PR-666
  - PR-667
---

# PROC-NPA-GATE-01 — FIRST ACTIVATION for FX-spot (internal pre-licence test)

> **Posture.** This is the **first activation of PROC-NPA-GATE-01** for any product. Devon (Chief Operating Officer, governance)'s PROC-MK-PLG-01 meta-rehearsal (PR #667, merged) returned `BLOCKED-BY-NPA-fx-spot-schema-defined` as one of two substantive Open conditions: no `ProductApproved{productId:fx-spot}` event exists in the store. Marc (CEO) has asked Saskia (Head of Global Markets / Chief Markets Officer, governance) to initiate the NPA gate for FX-spot — this run fires the gate **for internal pre-licence test scope only**.
>
> **The script emits.** `ProductProposalRegistered`, 14× `ProductDimensionAttested`, and `ProductDueDiligenceCompleted`. The gate decision (`ProductApproved` vs `ProductWithheld`) is **Marc's call** via the CEO decision card `D-NPA-FX-SPOT-INTERNAL-TEST` opened at `phase: "requested"`. Saskia + Owen do NOT emit `ProductApproved` unilaterally.
>
> **Scope clarity.** The FX-spot product approved by this run would be approved for **internal pre-licence test scope** only — synthetic activity inside the existing scenario harness (PR #645), no real ZAR/USD movement, no real correspondent-bank instruction, no real counterparty entering into anything. The eventual licence-day approval for production trading is a separate gate run under PROC-NPA-GATE-01 (re-trigger via fresh `ProductProposalRegistered` against a production-scope variant).

## 1. Run metadata

| Field | Value |
|---|---|
| Run date | 2026-05-21 |
| Product owner (initiator) | Saskia (Head of Global Markets / Chief Markets Officer, governance) |
| Procedure owner (co-author) | Owen (Company Secretary, governance) |
| Workstream | WS-MARKET-RISK-PROCEDURES |
| Product ID | `prd:bank:fx:fx-spot-usdzar` |
| Product family | `fx` |
| Procedure | PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`) |
| Source policy | D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved) |
| Source brief | `brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21` (issued by Scrooge, Chief of Staff, recording for CEO) |
| Run ID | `run:saskia:2026-05-21T09-11-08-688Z` |
| Runner script | `prototype/scripts/run-npa-gate-fx-spot.ts` (run via `bun run npa-gate:fx-spot`) |
| Decision card opened | `D-NPA-FX-SPOT-INTERNAL-TEST` (phase: `requested`) |

## 2. Vocabulary note — procedure-prose aliases vs typed events

PROC-NPA-GATE-01 prose uses the names `NPAGateConvened`, `NPAGateOpinionSubmitted`, `NewProductApproved`, `NewProductDeferred`. The canonical typed event family in `platform/event-store/event-types/product.ts` (D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2, CEO-approved 2026-05-10) uses `ProductProposalRegistered`, `ProductDimensionAttested`, `ProductDueDiligenceCompleted`, `ProductApproved`, `ProductWithheld`, `ProductLaunched`, etc.

| Procedure prose | Typed event family | Notes |
|---|---|---|
| `NPAGateConvened` | `ProductProposalRegistered` (initiation) | The procedure folds gate-convene into proposal registration; per-participant opinions become `ProductDimensionAttested` |
| `NPAGateOpinionSubmitted` | `ProductDimensionAttested` ×N | One per dimension; actor envelope captures which agent attested |
| `NewProductApproved` | `ProductApproved` | Not emitted by this script — Marc's call via D-NPA-FX-SPOT-INTERNAL-TEST |
| `NewProductDeferred` | `ProductWithheld` | Not emitted by this script |
| (summary close) | `ProductDueDiligenceCompleted` | Aggregates 14-dimension walk into gatesCleared / gatesFailed |

**Substrate gap.** The procedure-prose alias reconciliation is captured as a follow-on item (§5 below). Either the procedure prose updates to the typed vocabulary, or an alias layer is added at the registry level. Owen + Atlas + Saskia co-track.

## 3. The 14 dimensions — assessment table

Posture mapping to `ProductDimensionAttested.result` enum:
- **Satisfied** with implementation live ⇒ `implementation-attested`
- **InProgress** (compensating control acceptable for internal-test scope, NOT for production) ⇒ `design-attested`
- **Open** (substantive blocker) ⇒ `failed`

| # | Dimension | Posture | Result enum | Attesting actor | Evidence | Citations |
|---|---|---|---|---|---|---|
| 1 | `regulatory-legal` | **InProgress** | `design-attested` | Owen | PR #644 (Rashida (CISO, governance) FinSurv ExCon: build-phase outside Reg 2/3 scope); PR #637 (Imani (Chief Legal Counsel, governance) G-9 ISDA 2002 + SA Schedule) | Banks Act s.11/s.13; ExCon Reg 2/3; PR #637 + #644 |
| 2 | `credit-risk` | **Satisfied** | `implementation-attested` | Saskia | PR #642 (Yael (Treasurer & Tax, engineering+governance) `CreditLimitLoaded` events for Standard Bank ZA + Investec Treasury); PROC-RISK-CLM-01 + SA-CCR v1 engine wired | `Policies/credit-risk-policy-v1.md`; PROC-RISK-CLM-01; BCBS SA-CCR; PR #634 + #642 |
| 3 | `market-risk` | **InProgress** | `design-attested` | Saskia | PR #634 (Helena (Chief Risk Officer, governance) MR-1-FX limit proposal ZAR 350k VaR / USD 1m EOD); PR #631 (Helena FX-spot-only scope review + G-2 compensating-control attestation) | `Policies/market-risk-policy-v1.md`; BCBS FRTB-SA; PR #631 + #634 |
| 4 | `operational-risk` | **Satisfied** | `implementation-attested` | Owen | PR #636 (Devon (Chief Operating Officer, governance) PROC-OPS-SFBCP-01 v0.3); PR #640 (Tomas (Correspondent banking & payments, engineering) FX settlement subscriber LIVE-INTERNAL-VARIANT); D-OPRISK-ENGINEER-ROLE Option B (PR #666) | PROC-OPS-SFBCP-01; PR #636 + #640 + #666 |
| 5 | `capital-impact` | **InProgress** | `design-attested` | Saskia | PR #635 (Rohan (Risk engineer, engineering) SA-CCR T+2 maturity-factor regression); FRTB-SA RWA still G-2 compensating-control | `Policies/capital-management-policy-v1.md`; BCBS SA-CCR/FRTB-SA; PR #631 + #635 |
| 6 | `liquidity-impact` | **InProgress** | `design-attested` | Saskia | PR #663 + #645 (Kai (Markets engineering lead, engineering) BA-325 LCR subscriber + scenario integration); D-RAS-V1.0 schedule includes LCR/NSFR thresholds | `Policies/liquidity-risk-policy-v1.md`; BA-325; D-RAS-V1.0; PR #645 + #663 |
| 7 | `compliance` | **Satisfied** | `implementation-attested` | Owen | PR #644 (Rashida (CISO, governance) FinSurv ExCon); PR #648 (Vera (Internal audit engineer, governance) `recon:persona-attribution-coherence` STRICT); PR #633 (Atlas no-prop attribution XOR); PROC-MK-PCG-01 substrate | PROC-MK-PCG-01; FAIS GCC; Conduct Standard 3 of 2018; PR #633 + #644 + #648 |
| 8 | `ifrs-classification` | **Satisfied** | `implementation-attested` | Owen | M4_FX_SPOT_FIXTURE level-2 classification (Kai PR #663); PR #641 (Bea (Accounting & financial reporting engineer, engineering) PR-FX-005 IFRS-9 default-recognition); PR #652 (Bea bea-gl-posting-engine autonomous subscriber wires PR-FX-001..005 + PR-FX-PRIN) | IFRS 9; IAS 21; IAS 32; `Policies/accounting-policy-v1.md`; PR #641 + #652 + #663 |
| 9 | `tax` | **Satisfied** | `design-attested` | Owen | Yael bench position: FX-spot not a marketable security under STT Act 25/2007 (STT inapplicable); CIT entity-level (deferred to revenue-commencement per Yael paused-slice posture); VAT-exempt financial service per VAT Act 89/1991 Schedule 1 §2 | STT Act 25/2007; Income Tax Act 58/1962; VAT Act 89/1991; `Team/Yael.md` |
| 10 | `model-risk` | **InProgress** | `design-attested` | Saskia | Nadia (Independent-validation engineer, engineering) tier-3 classification (FX-spot pricing model is reference-rate-driven via SARB daily fixing — PR #643 Atlas SARB fixing ingester); FRTB-SA engine unvalidated (Helena G-2 compensating control) | `Policies/model-risk-policy-v1.md`; BCBS Model Risk Principles; PR #631 + #643; D-OPRISK-ENGINEER-ROLE |
| 11 | `technology-systems` | **Satisfied** | `implementation-attested` | Saskia | PR #645 (Kai scenario `scenarios/fx-spot-internal-pre-licence-test.ts` returns READY-FOR-CONTROLLED-LAUNCH); PR #647 (Saskia + Kai CEO end-to-end FX-trade walkthrough); PR #663 (BA-325 LCR subscriber + scenario integration); manual booking UI at `dashboard/public/trade-book.html` | PR #645 + #647 + #663 |
| 12 | `legal-documentation` | **Satisfied** | `implementation-attested` | Owen | PR #637 (Imani G-9 close: ISDA 2002 + SA Schedule default; Bowmans 2024-04-15 SA netting opinion); PR #642 (netting-set enrolment with `nettingEnforceable: true`) | ISDA 2002 Master Agreement; SA Schedule (Bowmans 2024-04-15); PR #637 + #642 |
| 13 | `counterparty-eligibility` | **Satisfied** | `implementation-attested` | Saskia | PR #639 (Saskia Party register entries for Standard Bank Group ZA + Investec Treasury with LEIs); PR #642 (`ISDACSAAssessmentCompleted` events); institutional-only model per `project_strategic_foundation` | `Regulations/_party-register.md`; `Policies/counterparty-policy-v1.md`; PR #639 + #642 |
| 14 | `board-notification` | **Open** | `failed` | Owen | No Board exists yet (build-phase); no BRC constituted; no formal board-notification register | Banks Act s.60; Companies Act 71/2008; `project_ai_driven_bank` |

### 3.1 Tally

| Posture | Count | Dimensions |
|---|---|---|
| **Satisfied** | 7 / 14 | credit-risk, operational-risk, compliance, ifrs-classification, tax, technology-systems, legal-documentation, counterparty-eligibility *(8 — see note)* |
| **InProgress** | 6 / 14 | regulatory-legal, market-risk, capital-impact, liquidity-impact, model-risk *(5 — see note)* |
| **Open** | 1 / 14 | board-notification |

> Note: row 9 (`tax`) is posture-Satisfied but `result: "design-attested"` because no tax return has been filed yet (no revenue). Treating "Satisfied" by posture: **8** Satisfied (rows 2, 4, 7, 8, 9, 11, 12, 13); **5** InProgress (rows 1, 3, 5, 6, 10); **1** Open (row 14). The script's gate decision logic uses the `posture !== "Open"` rule: 13 cleared, 1 failed.

## 4. Open blocker — `board-notification`

**Substantive blocker for production fire.** No Board exists yet; Board constitution is a licence-day statutory-minimum hire per `project_ai_driven_bank` (5–10 humans appointed at licence-day, including non-executive directors and BRC chair).

**For INTERNAL-TEST scope.** Marc (CEO) substitutes for Board acknowledgment via the CEO decision card `D-NPA-FX-SPOT-INTERNAL-TEST` opened by this run. Owen attests this is acceptable for build-phase internal-test perimeter because:

1. The "Board notification" obligation is BCBS principle + good governance; build-phase has no Board to notify.
2. The risk substance of board-notification — that a person at the top of the firm formally acknowledges the new product and its controlled-launch envelope — is preserved when Marc (CEO, sole executive at build-phase) approves D-NPA-FX-SPOT-INTERNAL-TEST.
3. The internal-test perimeter (synthetic activity inside scenario PR #645, no real ZAR/USD movement, no real counterparty interaction) has materially zero board-notifiable risk envelope.

**Re-activation trigger.** Board constitution at licence-day. A fresh PROC-NPA-GATE-01 run for FX-spot production-scope at that point fires `board-notification` to Satisfied via formal Board minutes and BRC tabling.

## 5. Compensating controls active for internal-test scope

The 5 InProgress dimensions carry compensating controls acceptable for internal-test scope only:

| # | Dimension | Compensating control | Production-fire re-activation trigger |
|---|---|---|---|
| 1 | regulatory-legal | Build-phase outside FinSurv Reg 2/3 scope (Rashida PR #644 ruling); ISDA documentation perimeter Satisfied (Imani G-9) | SARB banking-licence grant + FinSurv production wiring |
| 3 | market-risk | Helena G-2 dual-track manual SA-SBM-delta cross-check (>5% triggers investigation; >15% triggers MRC escalation); MR-1-FX limit proposal stands as CEO interim-authority anchor until BRC tabling | BRC constitution OR explicit CEO interim-authority approval for MR-1-FX (separate decision card) + Nadia FRTB-SA validation |
| 5 | capital-impact | FRTB-SA G-2 compensating control (per market-risk row); MR-1-FX limit envelope (USD 1m EOD) is < 0.1% of build-phase target capital | Nadia FRTB-SA validation + Camille (CFO, governance) capital plan resolution |
| 6 | liquidity-impact | BA-325 LCR pipeline wired and exercised; NSFR + intraday-liquidity monitor PLANNED | NSFR engine landed + intraday-liquidity monitor wired |
| 10 | model-risk | Nadia tier-3 classification (reference-rate-driven, low-complexity); SARB daily fixing as production-grade FX-spot rate source | Nadia validation report for FRTB-SA + SMA operational-risk RWA implementation |

## 6. Recommendation to CEO

Marc, my read as product owner is:

**Approve FX-spot for internal pre-licence test scope** under D-NPA-FX-SPOT-INTERNAL-TEST.

The substrate is two-blocker-distance from a clean production fire:
1. **`board-notification`** (Open) — wall-clock; resolved at Board constitution at licence-day. CEO acknowledgment via this decision card is the build-phase substitute.
2. **`market-risk`** (InProgress) — needs BRC tabling of MR-1-FX limit OR explicit CEO interim-authority approval. (Note: this is the same gap as PROC-MK-PLG-01 Condition 3 `NPA-fx-spot-risk-limits-set`. A single CEO decision card on MR-1-FX could close both.)

For **internal-test scope** (synthetic activity, no real ZAR/USD movement, scenario harness PR #645 confirmed READY-FOR-CONTROLLED-LAUNCH), 13 of 14 dimensions clear, the 1 Open is structurally unavoidable at build-phase, and the 5 InProgress dimensions all have compensating controls acceptable for the scope.

**If you approve D-NPA-FX-SPOT-INTERNAL-TEST:**
- The script (in a follow-on run, not this one) can emit `ProductApproved{productId:fx-spot,approvedBy:human:marc@tgv.co.za}` referencing the decision-event ID.
- PROC-MK-PLG-01 Condition 1 (`NPA-fx-spot-schema-defined`) flips from Open to Satisfied on the next rehearsal run — Devon's first Open blocker clears.
- The internal-test perimeter (PR #645 scenario, manual booking at `/trade-book.html`) is formally cleared to operate as a controlled-launch internal-test under the MR-1-FX envelope.

**If you defer:**
- Common reasons: (a) you want BRC-equivalent ratification first via a separate forum; (b) you want NSFR landed before approving liquidity-impact dimension; (c) you want production-scope variant only, not internal-test scope.
- The decision card remains at `phase: "requested"` until resolved.

**Substrate gap I would highlight.** The procedure-prose alias gap (§2 above) — PROC-NPA-GATE-01's prose uses `NPAGate*` event names but the canonical typed events are `Product*`. A one-slice job for Owen + Atlas to either update the procedure prose or add a registry alias layer. Not a blocker on this approval, but a finding the rehearsal surfaced.

— Saskia (Head of Global Markets / Chief Markets Officer, governance)
— concurred Owen (Company Secretary, governance) on procedure-execution authority and `board-notification` Open attestation

## 7. Citations

- Procedure: PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`)
- Source policy: D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved)
- D-PRODUCT-CONSTRUCTION-SUBSTRATE (Slice 2, CEO-approved 2026-05-10) — typed event family in `platform/event-store/event-types/product.ts`
- Statutes: Banks Act 94 of 1990 s.11, s.13, s.60; Companies Act 71 of 2008; FAIS Act 37 of 2002; STT Act 25 of 2007; VAT Act 89 of 1991; Income Tax Act 58 of 1962
- Industry standards: ISDA 2002 Master Agreement; BCBS SA-CCR; BCBS FRTB-SA; BCBS Model Risk Principles; Conduct Standard 3 of 2018; FAIS GCC
- PRs queried for substrate state:
  - PR #631 — Helena (Chief Risk Officer, governance) FX-spot-only market-risk scope review (G-1 + G-2 compensating-control attestations)
  - PR #633 — Atlas (Core banking platform architect, engineering) no-prop attribution XOR on `FxTradeExecuted`
  - PR #634 — Helena controlled-launch MR-1-FX limit proposal
  - PR #635 — Rohan (Risk engineer, engineering) SA-CCR T+2 maturity-factor regression test
  - PR #636 — Devon (Chief Operating Officer, governance) PROC-OPS-SFBCP-01 v0.3 FX settlement-failure procedure
  - PR #637 — Imani (Chief Legal Counsel, governance) G-9 ISDA 2002 + SA Schedule decision
  - PR #638 — Atlas schema completeness pack (failure-path events)
  - PR #639 — Saskia (Head of Global Markets / Chief Markets Officer, governance) Party register entries
  - PR #640 — Tomas (Correspondent banking & payments, engineering) FX settlement subscriber (simulated-feed variant)
  - PR #641 — Bea (Accounting & financial reporting engineer, engineering) PR-FX-005 IFRS-9 default-recognition posting rule
  - PR #642 — Yael (Treasurer & Tax, engineering+governance) credit limits + netting-set enrolment
  - PR #643 — Atlas SARB fixing ingester (G-1 compensating control — daily FX-spot rate)
  - PR #644 — Rashida (Chief Information Security Officer, governance) FinSurv ExCon assessment
  - PR #645 — Kai (Markets engineering lead, engineering) end-to-end FX-spot scenario (READY-FOR-CONTROLLED-LAUNCH)
  - PR #647 — Saskia + Kai CEO end-to-end FX-trade walkthrough
  - PR #648 — Vera (Internal audit engineer, governance) `recon:persona-attribution-coherence` flipped STRICT
  - PR #652 — Bea bea-gl-posting-engine autonomous subscriber (wires PR-FX-001..005 + PR-FX-PRIN)
  - PR #663 — Kai BA-325 LCR subscriber + scenario integration
  - PR #666 — Owen D-OPRISK-ENGINEER-ROLE CEO decision card (proposed)
  - PR #667 — Devon + Zara (Chief Compliance Officer, governance) PROC-MK-PLG-01 meta-rehearsal (the rehearsal that surfaced `NPA-fx-spot-schema-defined` as the Open blocker triggering this run)
- Memory: `project_ai_driven_bank`, `project_strategic_foundation`, `project_product_lifecycle_npa_vs_engineering`, `project_continuation_2026_05_18_ras_schedule`, `project_continuation_2026_05_20_credit_limit_engine`
- Brief: `brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21`
