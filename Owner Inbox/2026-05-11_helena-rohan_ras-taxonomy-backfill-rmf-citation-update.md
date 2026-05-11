---
title: RAS taxonomy backfill + RMF citation update (Principle 2)
authors:
  - Helena (Chief Risk Officer, governance) — lead
  - Rohan (Risk engineer) — co-author
date: 2026-05-11
decision-required: false
summary: Backfills `riskTaxonomy` codes on every RAS line in the Risk Appetite Statement and Framework, and replaces the inline risk-category list in Core Risk Policies §1 (Risk Management Framework) with a citation to the canonical register at `Regulations/_risk-taxonomy.md`. Atomic single-graph-discipline update (Principle 2). Closes the next-tick items #3 and #5 in `2026-05-11_helena-rohan_risk-taxonomy-v1.md`.
---

# RAS taxonomy backfill + RMF citation update (Principle 2)

**Authors:** Helena (Chief Risk Officer, governance) — lead · Rohan (Risk engineer) — co-author
**Date:** 2026-05-11
**For:** Marc (CEO) — record-only, no decision required.

## 1. Scope

This deliverable discharges two next-tick items from the v1 risk-taxonomy register (`Regulations/_risk-taxonomy.md`, published 2026-05-11) and its companion brief (`Owner Inbox/2026-05-11_helena-rohan_risk-taxonomy-v1.md`):

- **Next-tick #3** — backfill `riskTaxonomy` field on every RAS line in `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`.
- **Next-tick #5** — replace the inline risk-category prose in `Owner Inbox/2026-05-06_core-policies-risk.md` §1 (Risk Management Framework) with a citation to the canonical register.

No RAS calibration values were changed. No policy regulatory citations were changed. No taxonomy nodes were added, retired, or renamed. The taxonomy register itself is unchanged.

## 2. Task 1 — RAS riskTaxonomy backfill

Tagging applied at **level 2** (per register §8: "RAS lines tag each line at level 2"). Where two terminal nodes appear to apply, the dominant binding constraint is selected and the secondary noted; this preserves single-graph integrity (register §6 mapping rules: "one risk = one terminal node — decompose rather than dual-tag").

### 2.1 Appendix decision-log lines (§Appendix, items 1–11)

| Line | RAS reference | Description | Code | Rationale |
|---|---|---|---|---|
| 1 | §B5 | Continuous-KYC two-tier default (medium-confidence restrict-on-review / high-confidence restrict-immediately) | `RT-FC.ML` | Money-laundering is the dominant binding constraint of the KYC trigger. Secondary `RT-FC.SA` applies for sanctions-triggered restrictions; resolved via mapping-rule decomposition at incident-tag time (each KYC trigger event tags at its specific level-3 vector). |
| 2 | §B3 | LCR buffer floor (PA min + 20pp / +10pp trigger / +5pp escalate) | `RT-LQ.FN` | LCR is the canonical funding-liquidity ratio. Register §8 explicit example: "RT-LQ.FN for LCR/NSFR floors". |
| 3 | §B3 | NSFR buffer floor (PA min + 15pp / +8pp / +3pp) | `RT-LQ.FN` | Per register §8 explicit example. |
| 4 | §B3 | CET1 management buffer (+1.5pp above PA minima + Pillar 2A + capital conservation buffer) | `RT-CR.OB` | Capital adequacy under Pillar 1 is dominated by credit-risk RWA (Banks Act §72 + Reg 23 anchor at `RT-CR`); CET1 absorbs unexpected obligor-default loss. Register places prudential capital-adequacy under credit-risk loss-absorption framing (taxonomy §3 `RT-CR` anchor: "Banks Act + Reg 23 + BCBS CRE + IFRS 9"). Secondary `RT-MK` / `RT-OP` shadows captured through Pillar-2 add-ons (per ICAAP). |
| 5 | §B5 | Sanctions zero-appetite; production override = signed Zara event + register-linked exception | `RT-FC.SA` | Direct match — sanctions are level-2 under financial-crime risk. |
| 6 | §B7 | Model-risk three-tier classification (Tier 1 = independent validation pre-deployment + annual revalidation) | `RT-OP.MD` | Direct match — model risk is level-2 under operational risk; level-3 `RT-OP.MD.T1/T2/T3` apply per-model. The policy line itself anchors at level-2 (the *policy that governs* tiering); individual models tag at level-3. |
| 7 | §B6 | Cyber severity tiering (four tiers; Regulator-notification thresholds at T3/T4) | `RT-OP.CY` | Direct match — cyber is level-2 under operational risk. Level-3 `RT-OP.CY.CF/IN/AV/RS` applies per-incident. |
| 8 | §B2 | Sector concentration ≤25% without BRC approval | `RT-CR.CC` | Direct match — register §8 explicit example: "RT-CR.CC for the sector concentration cap". |
| 9 | §A2 Market | Trading mandate — client-driven / franchise market-making; no prop risk outside franchise hedges | `RT-MK` | Market risk at level-1; the mandate spans multiple level-2 nodes (IR, FX, EQ, CS) so the level-1 anchor is the stable classification. Per-desk VaR limits (RAS B5 placeholder per `2026-05-11_kai-helena-devon_trading-mandate-v1.md`) tag at appropriate level-2 when calibrated. |
| 10 | §A2 Climate | Climate initial appetite — assess / disclose / avoid clearly inconsistent exposures | `RT-CL` | Climate at level-1 (transverse risk per register §3 footnote). Manifests across `RT-CR`, `RT-MK`, `RT-OP`, `RT-LQ`, `RT-ST`, `RT-RP` via the second-order shadow; per-exposure tagging at level-2 (`RT-CL.PH` / `RT-CL.TR`) attaches at incident or exposure event time. |
| 11 | §B8a | B-cluster FX-settlement concentration (L-B8a-1..5) | `RT-OP.PA` | Dominant binding constraint is operational-settlement-rail concentration — the named-pair correspondent posture is an *operational* dependency on payment-rail counterparties. Register §6 worked example: "correspondent-bank failure that prevents the bank settling USD-clearing for a day → primary `RT-OP.TP.MS` (third-party-market-services)". The B8a lines combine that with `RT-OP.PA` (payments-and-settlement processing — register §4.5: "loss from failed or mis-routed payments and settlements in the operational pipeline, distinct from `RT-CR.SL` Herstatt settlement-credit risk"). Secondary `RT-OP.TP.MS` shadow at level-3 for the third-party dimension; secondary `RT-CR.SL.FX` shadow for the Herstatt-credit dimension once settlement actually fails. The line itself anchors at `RT-OP.PA` because it governs the *processing* rail; §B8 (counterparty credit concentration) is separately tagged `RT-CR.CP` / `RT-CR.CC`. Reconciliation with §B8 already discussed in the RAS body. |

### 2.2 §A2 Per-category appetite-statement anchors (§A2 sub-headings)

The §A2 appetite-by-risk-category statements are inherently level-1 — each sub-heading already names a level-1 risk in plain language. Each sub-heading gains a `riskTaxonomy` annotation at level-1 to make the mapping explicit and machine-readable:

| §A2 sub-heading | Code |
|---|---|
| Credit risk | `RT-CR` |
| Market risk | `RT-MK` |
| Liquidity and funding risk | `RT-LQ` |
| IRRBB | `RT-IRRBB` |
| Operational and cyber risk | `RT-OP` (with `RT-OP.CY` for the cyber clauses) |
| Conduct risk | `RT-CD` |
| Financial-crime / AML / sanctions risk | `RT-FC` |
| Legal and regulatory risk | `RT-LR` |
| Strategic and reputational risk | `RT-ST` + `RT-RP` (dual sub-heading; decomposed inline) |
| Model risk | `RT-OP.MD` |
| Climate risk | `RT-CL` |

### 2.3 §B8a per-line table (L-B8a-1 .. L-B8a-5)

Each line in the §B8a table gains a `riskTaxonomy` field. All anchor at `RT-OP.PA` per row 11 above; L-B8a-4 (backup-readiness) carries a secondary `RT-OP.RE` (operational-resilience) shadow since a stale backup is a resilience-readiness failure as well as a payments-processing concentration.

| Line | Primary code | Secondary (noted in row) |
|---|---|---|
| L-B8a-1 | `RT-OP.PA` | `RT-OP.TP.MS` shadow (third-party-market-services concentration) |
| L-B8a-2 | `RT-OP.PA` | `RT-OP.TP.MS` shadow |
| L-B8a-3 | `RT-OP.PA` | n/a (procedural override) |
| L-B8a-4 | `RT-OP.PA` | `RT-OP.RE` shadow (operational-resilience readiness of backup rail) |
| L-B8a-5 | `RT-OP.PA` | `RT-OP.TP.MS` shadow (reserve-correspondent contract status) |

## 3. Ambiguous / decomposed cases

Two cases required explicit decomposition rather than dual-tagging:

1. **CET1 management buffer (line 4 / B2).** Capital adequacy frames Pillar 1 credit-RWA-driven absorption (`RT-CR.OB`) but the buffer also absorbs market-risk RWA, operational-risk RWA, and Pillar-2 add-ons. Per register §6, the dominant binding constraint for a *capital floor* — which is what B2 calibrates against — is the credit-risk obligor-default absorption framing under Banks Act §72 + Reg 23. Secondary capital-absorption uses (`RT-MK`, `RT-OP`) are not separately tagged on the RAS line; they are captured downstream at the per-component RWA event (per Bea's RWA engine spec, PR #180 / `Owner Inbox/2026-05-10_bea-camille_w2-slice-3-rwa-engine.md`). Helena + Camille (CFO) confirm the framing in §3.1.3 of the ICAAP/ILAAP framework.

2. **B-cluster FX-settlement (line 11 / B8a).** Spans `RT-OP.PA` (payments-processing pipeline), `RT-OP.TP.MS` (third-party market-services concentration), and `RT-CR.SL.FX` (Herstatt-credit if settlement fails). Per register §6, decomposed at the *line* into the operational-rail dominant tag `RT-OP.PA`, with the third-party and Herstatt dimensions captured as separate event-level tags at incident time. §B8a body text already reconciles with §B8 (counterparty credit concentration) — that reconciliation is preserved.

3. **Strategic & reputational risk (§A2 dual sub-heading).** The single §A2 heading covers two distinct level-1 nodes. Decomposed in the annotation: the strategic statement ("risk-taking aligned to strategy; no off-strategy adventures") tags `RT-ST`; the reputational statement ("reputation is treated as a leading indicator of all other risks") tags `RT-RP`. Both annotations sit in the §A2 sub-section.

No taxonomy amendments were needed — every line maps to an existing code.

## 4. Task 2 — RMF citation update

`Owner Inbox/2026-05-06_core-policies-risk.md` §1 (Risk Management Framework) **Principles** bullet two previously inlined the risk-category list. Per Principle 2 (single-graph discipline) and the canonical-source registry feedback (`feedback_canonical_source_registry.md`), the inline list is replaced with a citation to the canonical register.

**Before.** "The risk taxonomy is canonical: credit, market, liquidity & funding, IRRBB, operational (incl. cyber, third-party, model), conduct, financial crime, legal, regulatory, strategic, reputational, climate."

**After.** "The risk taxonomy is canonical at [`Regulations/_risk-taxonomy.md`](../Regulations/_risk-taxonomy.md) — eleven level-1 categories covering credit, market, liquidity & funding, IRRBB, operational, conduct, financial crime, legal & regulatory, strategic, reputational, and climate. Each policy in this bundle and each RAS line tags at the narrowest stable node per register §6 mapping rules."

A one-line change-log entry was appended to the bottom of `2026-05-06_core-policies-risk.md`:

> `2026-05-11 — Helena: replaced inline risk-category list with citation to canonical register (Principle 2 single-graph discipline).`

The post-update wording (a) preserves the policy's principle that the taxonomy *is* canonical (an architectural commitment of the RMF), (b) defers the *content* of the taxonomy to the canonical register, and (c) preserves the surrounding RMF Principles bullet structure intact.

## 5. Constraints honoured

- **No calibration changes.** RAS appetite values (97% / 100% / 120% / 1.5pp / 25% etc.) untouched.
- **No regulatory-citation changes.** Banks Act / BCBS / FIC / FAIS / King IV references in both files untouched.
- **No taxonomy register changes.** `Regulations/_risk-taxonomy.md` not modified.
- **No invented codes.** Every code applied is present in the canonical register (verified by direct match against §§3–5).
- **Single-graph discipline preserved.** RAS lines now have a single typed `riskTaxonomy` field; decomposition for spanning cases handled in narrative rather than dual-tag.

## 6. Verification

Run before close:

```bash
cd prototype/
bun run typecheck        # full-project tsc
bun run lint
bun run citation-gate    # zero violations required
bun run ci               # full gate
```

Vera (Internal-audit engineer, engineering — functionally to Thandiwe CAE; administratively to CEO) Wave-5 `taxonomy-coverage` recon pipeline will, when shipped, assert that every RAS line carries a valid `riskTaxonomy` code — this backfill closes the data side of that recon (the pipeline build itself remains the Wave-5 substrate gap named in register §9).

## 7. Substrate gaps closed / surfaced

**Closed by this PR.**

- Register §9 gap-log row "Backfill of `riskTaxonomy` on every RAS line" — closed.
- Register §9 gap-log row covering the RMF citation update — closed (was named in the v1 brief as next-tick #5).

**Carried forward (named in register §9, not in scope here).**

- Backfill of `riskTaxonomy` on the 259-row obligations register — Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO).
- Policy-frontmatter `riskTaxonomy` annotation across the eight risk-policy bundle + sister bundles — Owen (Company Secretary, governance) with the policy authors.
- Vera Wave-5 `taxonomy-coverage` recon pipeline — Vera.
- Controls-catalogue authoring (downstream tagging) — Devon (Chief Operating Officer, governance) + Helena.

No new substrate gaps surfaced by this work.

## 8. Files changed

- `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` — added `riskTaxonomy` annotations to §A2 sub-headings, the §B8a table, and the §Appendix decision-log items 1–11.
- `Owner Inbox/2026-05-06_core-policies-risk.md` — replaced the inline risk-category list in §1 RMF Principles with a citation to `Regulations/_risk-taxonomy.md`; appended change-log entry.
- `Owner Inbox/2026-05-11_helena-rohan_ras-taxonomy-backfill-rmf-citation-update.md` — this completion brief.

No code changes; no taxonomy-register changes; no calibration changes; no event-emission changes.
