# Procedure — FX-vanilla IFRS accounting review (review-methodology)

**Procedure ID:** PROC-FIN-12
**Owner:** Camille (Chief Financial Officer, governance) · Bea (Accounting & financial reporting engineer, engineering)
**Approval:** CFO sign-off; CEO escalation per the decision-authority-routing table (category `accounting`)
**Cadence:** On-trigger (whenever the FX-vanilla accounting is to be reviewed — a new-product/NPA step, a posting-rule change, a regulator/auditor query, or Marc's direct "review the FX-vanilla accounting")
**Version:** v1.0 — 2026-06-26
**Status:** In force

## 1. Source policy

- `Policies/accounting-policies-ifrs-v1.md` (FIN-ACCT-01 — IFRS accounting policies) — the bank's IFRS policy chain Camille owns.
- D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5 — the 14-dimension NPA dossier; **dimension 6, "accounting"**, is the completeness backbone this procedure asserts.
- D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26) — the IFRS domain-truth foundation (oracle + golden cases + gates) this procedure runs against.

## 2. Source regulation(s)

The IFRS oracle ingested under D-REGULATORY-LIBRARY-V1 / D-FX-IFRS-REVIEW-FOUNDATION:

- `urn:reg:ifrs:ifrs-9` — IFRS 9 *Financial Instruments* §4.1.4 (FVTPL classification), §5.1.1/B3.1.2 (initial recognition at fair value), §5.7.1 (FVTPL movement to P&L), §5.7.5 (FVOCI election). Oracle: `Regulations/INTL/IASB/source-docs/ifrs-9-structured.json`.
- `urn:reg:ifrs:ias-21` — IAS 21 *The Effects of Changes in Foreign Exchange Rates* §8 (monetary-item definition), §21 (spot-rate initial recording), §23 (closing-rate retranslation), §28 (exchange differences to P&L). Oracle: `Regulations/INTL/IASB/source-docs/ias-21-structured.json`.
- `urn:reg:ifrs:ifrs-13` — IFRS 13 *Fair Value Measurement* (at-market FV≈0 at inception). Oracle: `Regulations/INTL/IASB/source-docs/ifrs-13-structured.json`.

## 3. Purpose

Make the FX-vanilla accounting review **repeatable and checklist-grade, not prose**. When the FX-vanilla accounting must be reviewed, this procedure runs a deterministic harness that asserts every FX lifecycle posting against its governing IFRS paragraph (from the ingested oracle) AND its golden worked example, checks completeness against the NPA dossier's accounting dimension, surfaces any tracked posting gaps, and emits a single typed **review verdict** the CFO signs (or against which the CFO raises findings). It exists because the bank's FX accounting errors were domain-MODEL failures that passed every balancing test: a procedure that asserts only internal consistency cannot catch a consistent-but-wrong posting. This procedure validates against the **domain-truth oracle** (PROC-GOV-ADC-01 §4).

## 4. Trigger

Any of:

- Marc (CEO) instructs Scrooge "review the FX-vanilla accounting" (the canonical trigger this PROC answers).
- A new-product / NPA cycle reaches dimension 6 (accounting) for an FX-vanilla product.
- A change to any FX posting rule (`v2-core/posting-rules/fx.ts`, `fx-settlement.ts`) or the FX golden cases.
- An external-auditor or PA query on the bank's FX accounting treatment.

## 5. Steps

The procedure is **two coupled runs** bracketed by the reviewer→decider sync primitive (`prototype/platform/dispatch/`): a **reviewer** run executes the harness and records the verdict; a **CFO (decider)** run signs it off. The decider's `dispatch:close-run` refuses to emit a delivered close until the reviewer's delivered close exists (D-DISPATCH-SYNC-PRIMITIVE).

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Run the FX-vanilla IFRS review harness against the canonical store | `service` (reviewer run, e.g. Bea) | `@platform/accounting/fx-vanilla-ifrs-review-harness.ts` (`runFxVanillaIfrsReview`) | Composes the five premise checks below into one typed verdict. Re-runnable; read-only. |
| 2 | Premise 1 — FVTPL classification + at-market trade-date OBS (FV≈0) | `service` | `recon:fx-trade-date-obs-memorandum` + golden CASE 1 | IFRS 9 §4.1.4 / §5.1.1 / B3.1.2; IAS 21 §21. At-market forward → four OBS legs, NIL on-BS gross-up. |
| 3 | Premise 2 — closing-rate retranslation of the monetary position | `service` | `recon:fx-monetary-closing-rate-integrity` + golden CASES 2–3 | IAS 21 §8 / §23 / §28. Exchange difference recognised in the functional currency. |
| 4 | Premise 3 — FVTPL movement + realised/unrealised FX P&L → P&L only | `service` | `recon:fx-pnl-account-category-integrity` + `recon:fx-pnl-fcy-exposure-integrity` + `recon:fx-settlement-fvtpl-integrity` + golden CASES 4–5 | IAS 21 §28; IFRS 9 §5.7.1 / §5.7.5. Realised difference never on a balance-sheet account; settlement P&L-neutral; realisation only on FCY→ZAR conversion. |
| 5 | Premise 4 — lifecycle posting completeness | `service` | `POSTING_RULE_REGISTRY` (`v2-core/posting-rules/registry.ts`) | Every on-BS/P&L FX rule resolves in the canonical registry with an IFRS citation (NPA dossier dimension 6). |
| 6 | Premise 5 — surface tracked posting gaps (never hide one) | `service` | `activeFxSettlementDeferredGaps()` (live query) | Engineering Charter cmd 5. Open deferrals are surfaced for CFO weighing, sourced live — not a hardcoded list. |
| 7 | Record the review verdict as a typed event | `service` (reviewer run) | `dispatch:close-run` (`AgentRunCompleted`, reviewer) | The verdict (pass / findings) is the reviewer's delivered close. |
| 8 | CFO reviews the verdict; signs off **or** raises findings | `service` (Camille, decider run) | `runtime/decisions/record.ts` (`recordDecision`, category `accounting`) | On any failing premise the CFO does **not** sign; the finding supersedes (PROC-GOV-ADC-01 §20). Decider close blocked until step 7 lands (sync primitive). |

Each step asserts against the **oracle**, not internal consistency: step 2–4's gates resolve IFRS paragraphs and COA categories from canonical sources; the golden cases assert the production posting functions reproduce the IASB worked examples byte-for-byte.

## 6. Reconciliation

- **Events produced:** the reviewer's `AgentRunCompleted` carrying the verdict; the CFO's `Decision` (category `accounting`, sign-off or findings).
- **Reconciliation check:** the harness `runFxVanillaIfrsReview()` returns `pass === true` (every premise check passes) before a sign-off `Decision` may be recorded. The harness is exercised by `fx-vanilla-ifrs-review-harness.test.ts`; the constituent gates run every CI run (`ci:recon:domain`).
- **Failure mode:** any premise check returns a `fail`-severity finding → verdict `pass === false` → the CFO does NOT sign; the finding is recorded and routed to the owning seat (Bea for a posting defect; the settlement-materialisation owner for an FCY cost-basis gap). A sign-off recorded over a failing verdict is itself an Engineering-Charter cmd-3 violation (no green by concealment).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Review harness | `prototype/platform/accounting/fx-vanilla-ifrs-review-harness.ts` | Permanent (code) | Internal |
| Harness test | `prototype/platform/accounting/fx-vanilla-ifrs-review-harness.test.ts` | Permanent (code) | Internal |
| Golden worked cases | `prototype/v2-core/posting-rules/fx-ifrs-golden-cases.test.ts` | Permanent (code) | Internal |
| IFRS oracle | `Regulations/INTL/IASB/source-docs/{ifrs-9,ias-21,ifrs-13}-structured.json` | Permanent (© IFRS Foundation — licence-day procurement SubstrateGap) | Internal |
| Review verdict + CFO sign-off | Event log (`AgentRunCompleted`; `Decision`) | Permanent (Principle 1) | Regulatory |

## 8. Manual steps

None in the harness run (steps 1–7 are fully automated). Step 8 — the CFO's sign-off **judgement** — is a typed human-discretion event (`Decision`), justified because final accountability for the AFS/BA-return numbers is the signer's residual (Principle 6: humans oversee the residual). The judgement is captured as an event, not left implicit.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| A posting rule violates its IFRS premise | The relevant gate fails → verdict `pass=false` | Finding to Bea (posting-rule owner); CFO withholds sign-off |
| FX lifecycle event unmapped / uncited in the registry | Premise-4 completeness finding | Finding to Bea; blocks dimension-6 NPA approval |
| Live store carries an FX instance the FCY-exposure gate flags (e.g. settled cash with no ZAR cost basis) | `recon:fx-pnl-fcy-exposure-integrity` fail | Finding to the settlement-materialisation owner; CFO weighs whether it bears on the period under review |
| Open posting deferral material to the review | Premise-5 surfaces it from the live query | CFO weighs and records; not a silent pass |
| CFO signs over a failing verdict | `recon:fx-pnl-account-category-integrity` + the sync primitive + Vera review | Engineering-Charter cmd-3 violation → Vera finding |

## 10. Related procedures

- `Procedures/finance/fx-period-close-runbook.md` — FX period close (consumes the same fold).
- `Procedures/finance/fx-settlement-reconciliation.md` — FX settlement reconciliation.
- `Procedures/by-policy/ba-return-generation.md` — the BA-return assembly the FX postings feed.
- `Procedures/by-policy/agent-domain-competence-framework.md` — PROC-GOV-ADC-01, the premise-challenge discipline this review embodies.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-06-26 | Camille (Chief Financial Officer, governance, via Scrooge) | Initial — review-methodology PROC + runnable harness (`fx-vanilla-ifrs-review-harness.ts`) composing the five IFRS premise checks (oracle + golden cases + 5 FX gates + registry completeness + live tracked-gap surfacing) into a typed review verdict bound to the reviewer→CFO sign-off sync primitive. Authority: D-FX-IFRS-REVIEW-FOUNDATION. |

## 12. Audit / assurance

Vera (Internal audit / continuous-assurance engineer) independently tests this procedure: that the harness composes the real production gates (no forked logic), that the five constituent gates are registered in `ci:recon:domain`, and that no `Decision` sign-off exists over a failing verdict. The harness run is itself an event Vera consumes. The `recon:agent-spec-domain-competence` gate asserts Camille §18–§20 (the domain-authority basis for this sign-off) are present and substantive.
