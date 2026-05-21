---
title: "D-NPA-FX-SPOT-INTERNAL-TEST — Approve FX-spot for internal pre-licence test scope under PROC-NPA-GATE-01?"
agent: Saskia (Head of Global Markets / Chief Markets Officer, governance) · co-author Owen (Company Secretary, governance)
trigger: ceo-decision-proposal
decisionId: D-NPA-FX-SPOT-INTERNAL-TEST
decision-required: true
recommendation: Approve FX-spot (`prd:bank:fx:fx-spot-usdzar`) for INTERNAL PRE-LICENCE TEST scope only, with CEO acknowledgment substituting for Board notification (build-phase only). 13 of 14 NPA dimensions clear; 1 Open (`board-notification`) is structurally unavoidable until Board constitution at licence-day; 5 InProgress have compensating controls acceptable for internal-test scope. Production-scope approval is a separate gate run.
record-kind: ceo-decision-proposal
workstream: WS-MARKET-RISK-PROCEDURES
brief: brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21
runId: run:saskia:2026-05-21T09-11-08-688Z
asOf: 2026-05-21T09:30:00Z
date: 2026-05-21
authority:
  - "PROC-NPA-GATE-01 §5 Step 10 — approval path"
  - "D-NEW-PRODUCT-APPROVAL-POLICY §6 (authority matrix)"
  - "CLAUDE.md — Decision authority routing (Engineering build decisions / NPA = CEO in build phase)"
citations:
  - "Procedures/by-policy/npa-gate.md (PROC-NPA-GATE-01)"
  - "2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md (this run's 14-dimension walk)"
  - "2026-05-21_devon-zara_proc-mk-plg-01-rehearsal-fx-spot-internal.md (Devon + Zara PR #667 — the rehearsal that surfaced this as a blocker)"
  - "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md (typed event family)"
  - "PR #645 (Kai end-to-end FX-spot scenario — READY-FOR-CONTROLLED-LAUNCH)"
  - "PR #647 (Saskia + Kai CEO end-to-end FX-trade walkthrough)"
  - "PR #634 (Helena MR-1-FX limit proposal — relevant to the market-risk dimension)"
  - "Principles/6-autonomous-by-default.md"
  - "project_ai_driven_bank"
  - "project_product_lifecycle_npa_vs_engineering"
classification: ceo-only
register-key: decisions
status: proposed
---

# D-NPA-FX-SPOT-INTERNAL-TEST — Approve FX-spot for internal pre-licence test scope under PROC-NPA-GATE-01?

> **Decision asked.** Does Marc (CEO) approve `prd:bank:fx:fx-spot-usdzar` for **internal pre-licence test scope** under PROC-NPA-GATE-01, allowing the controlled-launch envelope (PR #634 MR-1-FX limit proposal: ZAR 350k VaR / USD 1m EOD / USD 1.5m intraday / USD 500k per-counterparty cap; USD/ZAR only) to operate as the internal-test perimeter inside scenario PR #645 + manual booking at `/trade-book.html`?
>
> **Author.** Saskia (Head of Global Markets / Chief Markets Officer, governance) — product owner; co-author Owen (Company Secretary, governance) — PROC-NPA-GATE-01 procedure owner.
>
> **Recommendation.** **Approve** for internal-test scope. 13 of 14 NPA dimensions clear; the 1 Open (`board-notification`) is structurally unavoidable until Board constitution at licence-day, and CEO acknowledgment via this card is the build-phase substitute. Production-scope approval is a separate gate run.

---

## 1. Decision summary

This decision card asks Marc (CEO) to approve FX-spot for **internal pre-licence test scope** under the first activation of PROC-NPA-GATE-01. The decision is gate-Step-10 of `Procedures/by-policy/npa-gate.md`: the 14-dimension walk has been emitted as typed events (`ProductProposalRegistered` + 14× `ProductDimensionAttested` + `ProductDueDiligenceCompleted`), and Marc's `phase: "approved"` action on this card authorises a follow-on `ProductApproved` envelope.

The decision authority is **CEO** in the build phase per CLAUDE.md decision-authority-routing ("Engineering build decisions (substrate, platform, schema) — CEO (build phase) — Build-phase norm until governance-seat authorities active"). PROC-NPA-GATE-01 §5 Step 10 names "EXCO (products within existing RAS); Board (products requiring RAS amendment or new regulatory authorisation)" — in the build phase neither EXCO nor Board exist; CEO substitutes per Principle 6 (autonomous-by-default; humans oversee residual).

**Two options on the table:** (A) approve for internal-test scope under this card; (B) defer pending BRC-equivalent ratification or further substrate work.

## 2. Context — what triggered this card

Devon (Chief Operating Officer, governance)'s PROC-MK-PLG-01 meta-rehearsal (PR #667, merged 2026-05-21) returned `BLOCKED-BY-NPA-fx-spot-schema-defined` as one of two substantive Open conditions: no `ProductApproved{productId:fx-spot}` event exists in the store because PROC-NPA-GATE-01 has never been activated for any product.

Marc dispatched Saskia to fire the NPA gate for FX-spot (brief `brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21`). The runner script `prototype/scripts/run-npa-gate-fx-spot.ts` emits:
- `ProductProposalRegistered{productId:prd:bank:fx:fx-spot-usdzar, family:fx, proposedBy:agent:saskia:cmo}`
- 14× `ProductDimensionAttested` (one per NPA dimension; results: 7 `implementation-attested`, 6 `design-attested`, 1 `failed`)
- `ProductDueDiligenceCompleted{gatesCleared:13, gatesFailed:1}`

The script **does not** emit `ProductApproved`. That is Marc's call via this card.

## 3. The 14-dimension walk (summary)

Full table in `2026-05-21_saskia-owen_proc-npa-gate-01-fx-spot-walk.md` §3. Summary:

| Posture | Count | Dimensions |
|---|---|---|
| **Satisfied** | 8 / 14 | credit-risk, operational-risk, compliance, ifrs-classification, tax, technology-systems, legal-documentation, counterparty-eligibility |
| **InProgress** | 5 / 14 | regulatory-legal, market-risk, capital-impact, liquidity-impact, model-risk |
| **Open** | 1 / 14 | board-notification |

Note: the script's `ProductDueDiligenceCompleted` payload uses `posture !== "Open"` as the gates-cleared rule, yielding `gatesCleared: 13, gatesFailed: 1`.

## 4. The one Open dimension — `board-notification`

**Why Open.** No Board exists yet (build-phase per `project_ai_driven_bank`); no Board Risk Committee constituted; no formal board-notification register. Board constitution is a licence-day statutory-minimum hire (5–10 humans appointed at licence-day, including non-executive directors and BRC chair).

**Why this is acceptable for internal-test scope.**

1. The "Board notification" obligation is BCBS + good-governance principle — it requires a person at the top of the firm to formally acknowledge the new product and its controlled-launch envelope. Marc (CEO, sole executive at build-phase) approving this card serves that function.
2. The internal-test perimeter (synthetic activity inside scenario PR #645, no real ZAR/USD movement, no real correspondent-bank instruction, no real counterparty entering into anything) has materially zero board-notifiable risk envelope.
3. The principle-6 autonomy posture: humans oversee the residual; in build-phase the residual at the top of the firm is Marc.

**Re-activation trigger for production fire.** A fresh PROC-NPA-GATE-01 run for FX-spot production-scope at licence-day fires `board-notification` to Satisfied via formal Board minutes and BRC tabling.

## 5. The 5 InProgress dimensions — compensating controls

Each carries a compensating control acceptable for internal-test scope only:

1. **`regulatory-legal`** — build-phase outside FinSurv Reg 2/3 scope (Rashida PR #644); ISDA documentation Satisfied (Imani G-9). Re-activation: SARB banking-licence grant.
2. **`market-risk`** — Helena G-2 dual-track manual SA-SBM-delta cross-check; MR-1-FX limit (PR #634) stands as CEO interim-authority anchor until BRC tabling. Re-activation: BRC constitution OR explicit CEO MR-1-FX approval + Nadia FRTB-SA validation. *(Note: this is the same gap as PROC-MK-PLG-01 Condition 3 `NPA-fx-spot-risk-limits-set` — a single follow-on CEO decision card on MR-1-FX could close both.)*
3. **`capital-impact`** — FRTB-SA G-2 compensating control (linked to market-risk row); MR-1-FX envelope is < 0.1% of build-phase target capital. Re-activation: Nadia FRTB-SA validation + Camille (CFO) capital plan resolution.
4. **`liquidity-impact`** — BA-325 LCR pipeline wired (PR #663 + #645); NSFR + intraday-liquidity monitor PLANNED. Re-activation: NSFR engine landed + intraday-liquidity monitor wired.
5. **`model-risk`** — Nadia tier-3 classification (reference-rate-driven, low-complexity); FRTB-SA engine validation gap (same as market-risk row). Re-activation: Nadia validation report for FRTB-SA + SMA RWA implementation.

## 6. What "Approve" authorises

If Marc approves `phase: "approved"` on this card:

1. A follow-on script run (separate from the gate-walk run) can emit `ProductApproved{productId:prd:bank:fx:fx-spot-usdzar, version:"1.0.0-internal-test", approvedBy:"human:marc@tgv.co.za", conditions:[...]}`. The `conditions` array carries the controlled-launch envelope from PR #634 (MR-1-FX limits) and the explicit "internal pre-licence test scope only" scope-flag.
2. PROC-MK-PLG-01 Condition 1 (`NPA-fx-spot-schema-defined`) flips from Open to Satisfied on the next rehearsal run — Devon's first Open blocker (PR #667) clears.
3. The internal-test perimeter (PR #645 scenario, manual booking at `/trade-book.html`) is formally cleared to operate as a controlled-launch internal-test under the MR-1-FX envelope.
4. This card moves to `phase: "approved"` in the decisions register; the `Decision` event for `D-NPA-FX-SPOT-INTERNAL-TEST` carries the authorisation chain.

**Out of scope of this approval:**

- Production-scope FX-spot approval (separate gate run with full licence-day controls).
- BRC tabling of MR-1-FX market-risk limit (a separate decision card if Marc wants to grant CEO interim-authority approval ahead of BRC constitution).
- FX-Forward, FX-Swap, or other FX products (separate gate runs per product).
- Real-money trading (Banks Act s.11 blocks until SARB licence in hand).

## 7. What "Defer" or "Reject" would mean

If Marc defers / rejects:

- The card stays at `phase: "requested"` (defer) or moves to `phase: "rejected"`.
- Devon's PROC-MK-PLG-01 Condition 1 stays Open on the next rehearsal.
- The internal-test scenario PR #645 continues to operate (already merged), but without a formal NPA gate-clear behind it — the substrate gap stays surfaced.
- A re-run of PROC-NPA-GATE-01 can fire later with whatever additional substrate Marc wanted to see first.

Common reasons to defer:
- (a) Want BRC-equivalent ratification first via a separate forum (e.g. Owen's Interim Audit Forum acting as ratification surrogate).
- (b) Want NSFR engine landed before approving `liquidity-impact` dimension.
- (c) Want production-scope variant only, not internal-test scope (deferring until licence-day items are ready).

## 8. Out-of-scope follow-on items

- **Procedure-prose alias gap (substrate hygiene).** PROC-NPA-GATE-01 prose uses `NPAGate*` event names but the canonical typed events are `Product*` (D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2). One-slice job for Owen + Atlas: update procedure prose to typed vocabulary, or add a registry alias layer. Not a blocker on this card.
- **MR-1-FX CEO interim-authority decision (parallel card).** Helena (Chief Risk Officer, governance)'s PR #634 limit proposal is not BRC-tabled because BRC does not exist. A separate decision card asking Marc to grant CEO interim-authority approval of MR-1-FX could close `market-risk` dimension's InProgress status and PROC-MK-PLG-01 Condition 3 simultaneously. Saskia + Helena to co-author if Marc wants this.

## 9. Recommendation

**Approve.** For internal pre-licence test scope only. The substrate is two-blocker-distance from a clean production fire (1 Open + 1 InProgress with structural-not-substrate root cause), and both are wall-clock items dependent on Board constitution at licence-day. The internal-test perimeter has materially zero risk; the gate-walk is intellectually clean; the follow-on `ProductApproved` envelope clears Devon's PROC-MK-PLG-01 Condition 1.

— Saskia (Head of Global Markets / Chief Markets Officer, governance)
— concurred Owen (Company Secretary, governance) on procedure-execution authority and `board-notification` Open attestation
