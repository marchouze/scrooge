---
title: Obligations register — riskTaxonomy backfill (259 rows)
author: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator)
date: 2026-05-11
decision-required: false
summary: Backfilled `riskTaxonomy` field (10th column) on every row of `Regulations/_obligations-register.md` per the v1 taxonomy register §9 gap-log item. Every row now carries a single terminal-or-near-terminal code from the canonical taxonomy (typed enum at `prototype/platform/risk/taxonomy.ts`). `bun run ci` green (1362 tests pass, 0 fail); `bun run citation-gate` zero violations.
---

# Obligations register — `riskTaxonomy` backfill completion brief

> Author: Mira (Compliance / RegTech engineer, engineering — reports to
> Zara CCO; obligations-register curator). Closes the v1 taxonomy
> register's gap-log item *"Backfill of `riskTaxonomy` field on the
> 259-row obligations register (next-tick work by Mira)"*
> ([`Regulations/_risk-taxonomy.md`](../Regulations/_risk-taxonomy.md) §9).

## 1. Scope

Adds a 10th `Risk taxonomy` column to every obligations table row in
`Regulations/_obligations-register.md` (259 rows across 23 ID prefixes).
Each row's cell carries exactly one terminal-or-near-terminal code
matching `/^RT-[A-Z]+(\.[A-Z0-9]+){0,2}$/`, sourced from the canonical
taxonomy register at `Regulations/_risk-taxonomy.md` and validated against
the typed enum at `prototype/platform/risk/taxonomy.ts` (the typed mirror).

Schema is now ten columns:

```
ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Entity scope | Applies-at | Risk taxonomy
```

21 header rows + 21 separator rows updated to match. The obligations-view
projection at `prototype/dashboard/obligations-view.ts` is extended:

- imports `RiskTaxonomyCode` (type-only) from `@platform/risk/taxonomy`
  via a relative path,
- adds `riskTaxonomy: RiskTaxonomyCode | ""` to the `ObligationDetail`
  type,
- reads the 10th cell, validates surface shape, and emits `""` for missing
  or malformed cells (graceful pre-existing-shape tolerance — the recon
  gate is Vera's Wave-5 job).

No row's content (citation, requirement, fulfilment, owner, status,
entity scope, applies-at) was modified; this is pure additive
classification (Principle 1 — events-first; the markdown render is the
projection, the column is an attribute, not authored content).

## 2. Counts by level-1

| Level-1 | Count | % | Note |
|---|---|---|---|
| `RT-LR` (Legal & regulatory) | 92 | 35.5% | Dominated by POPIA (Domain D, 17 rows under `RT-LR.DP`), IFRS / accounting compliance (Domain G), tax compliance (Domain H), regulatory reporting (Domain FX FinSurv, BA-returns, Pillar 3), and contract-enforceability (Domain K ECTA + ISDA/GMRA). |
| `RT-OP` (Operational) | 39 | 15.1% | Cyber & operational resilience (Domain E), HR / people-risk (Domain I), CS 3/2018 OTC operational discipline. Cyber-resilience dominates (`RT-OP.CY` 12 rows). |
| `RT-ST` (Strategic & business) | 34 | 13.1% | Governance discipline (Domain F + Domain O thin-human-layer rows + FAIS-KI) — `RT-ST.GV` is the dominant child. Strategic-execution shows up only for recovery-and-resolution-planning rows. |
| `RT-FC` (Financial crime) | 31 | 12.0% | Domain B FIC Act rows + FATCA/CRS facilitation rows (`RT-FC.TE`) + bribery (`RT-FC.BC`) + sanctions (`RT-FC.SA*`) + proliferation-financing post-greylisting (`RT-FC.PF`). |
| `RT-CR` (Credit) | 23 | 8.9% | Capital adequacy rows (Domain A `ORG-PR-01..05`), large exposures + concentration (`RT-CR.CC`), counterparty credit (JS 2/2020 margin rows under `RT-CR.CP`), ICAAP. |
| `RT-CD` (Conduct) | 22 | 8.5% | Domain C FAIS conduct + FSCA conduct-of-business (FAIS Posture A rows + Domain P) + market-abuse (Domain J `ORG-MK-01..05`). |
| `RT-LQ` (Liquidity & funding) | 9 | 3.5% | LCR / NSFR rows + ILAAP + Contingency Funding Plan + externally-facilitated stress simulation. |
| `RT-MK` (Market) | 5 | 1.9% | FRTB-side rows (`ORG-PR-19`, `ORG-PR-33`, `ORG-MK-04`), ZARONIA `RT-MK.IR`, FX-settlement `RT-CR.SL.FX`. |
| `RT-IRRBB` (IRRBB) | 2 | 0.8% | `ORG-PR-11` (BCBS D368) + `ORG-PR-34` (`RT-IRRBB.CSRBB` PC 15/2024). |
| `RT-CL` (Climate & ESG) | 2 | 0.8% | `ORG-PR-22` (PA GN 1/2024 prudential framework) + `ORG-PR-32` (G3/2025 transition-side disclosures under `RT-CL.TR`). |
| **Total** | **259** | **100%** | |

Code-level histogram (top 10):

| Code | Count |
|---|---|
| `RT-LR.RC` | 65 |
| `RT-ST.GV` | 31 |
| `RT-LR.DP` | 19 |
| `RT-FC.ML` | 15 |
| `RT-CD.CC` | 15 |
| `RT-CR` | 13 |
| `RT-OP.CY` | 12 |
| `RT-LR.CT` | 8 |
| `RT-LQ.FN` | 8 |
| `RT-OP` | 7 |

39 distinct codes in use against the 94-code typed enum — i.e. ~55 enum
codes have **no** obligations row pointing at them. Most are level-3 nodes
that wait for the controls catalogue, RAS-line tagging, or future
sanctions-jurisdiction-specific work (e.g. `RT-FC.SA.UN`, `RT-FC.SA.US`,
`RT-FC.SA.EU`, `RT-FC.SA.UK` are reserved for jurisdiction-specific
appetite differentiation per `Regulations/_risk-taxonomy.md` §8 RAS
section; the obligations register stays at level-2 `RT-FC.SA` for the
generic sanctions-regime obligation). This shape will exercise Vera
Wave-5's `taxonomy-coverage` recon pipeline when it lands: orphan-code
detection (enum-but-no-citation) is the third recon assertion in the §9
amendment-process section.

## 3. Ambiguous fits — judgment calls recorded

The following rows sat between two terminal nodes; the chosen code is
named first with a one-line rationale:

- **`ORG-PR-01..05` (capital adequacy umbrella)** → `RT-CR`. Capital
  rules anchor on credit-risk RWA + supplementary buffers; market and
  operational RWA are smaller contributors but covered by their own
  obligation rows (`ORG-PR-19` FRTB; `ORG-PR-17` BCBS Op-Risk; `ORG-PR-25`
  Reg 39 Op-Risk). Tagging the umbrella rows `RT-CR` keeps the
  level-1 risk-bearing dimension explicit; tagging `RT-ST.GV` would
  hide the substance behind the governance discipline.
- **`ORG-PR-12` (integrated stress testing)** → `RT-OP`. Stress-testing
  *spans* RT-CR, RT-MK, RT-LQ, RT-IRRBB, RT-OP; per §6 mapping rule 3
  (one risk = one terminal node), the *risk being managed* by the
  stress-testing capability is the operational-risk of inadequate
  capability discovery — i.e. the discipline itself is operational. The
  underlying credit / market / liquidity risks are captured by their own
  obligation rows.
- **`ORG-PR-13` (ICAAP) and `ORG-BNK-ICAAP-CONS` (consolidated ICAAP)**
  → `RT-CR`. ICAAP is the capital-adequacy assessment process; pricing
  in credit-risk capital dominates the calculation. Tagging `RT-ST.GV`
  would mis-classify the underlying risk-bearing substance.
- **`ORG-PR-22` (PA GN 1/2024 climate-related prudential framework)** →
  `RT-CL`. The framework spans the risk taxonomy axis (it integrates
  climate into credit / market / op-risk per the GN's drafting); at
  level-1 the primary classification is climate-and-ESG. Per §6
  cross-axis rules, this row carries the climate-risk classification as
  primary (no secondary RT-RP shadow at this maturity).
- **`ORG-AC-02` (IFRS 9 ECL recognition)** → `RT-CR`. IFRS 9 ECL is the
  accounting-side recognition of credit losses; primary risk-bearing
  dimension is credit-risk. Tagging `RT-LR.RC` would treat IFRS 9 as a
  pure compliance row and lose the credit-risk substance.
- **`ORG-AC-15` (BCBS 239 risk-data aggregation and risk-reporting
  principles)** → `RT-OP.MD`. BCBS 239 is a *data-quality / model-risk*
  discipline applied to risk-reporting; the model-risk node is the
  closest fit because BCBS 239's enforcement teeth bite at data-lineage
  / model-integrity violations. Could equally tag `RT-OP.PR` (process);
  RT-OP.MD wins because BCBS 239 is what holds model outputs accountable.
- **`ORG-CS1-001` (CS 1/2018 §3 operational capital sufficiency)** →
  `RT-CR`. The §3 sufficiency test is a *capital-adequacy* test applied
  to the ODP business; the risk being managed is credit-risk-of-the-firm
  failing to bear losses. Could tag `RT-LR.RC` (regulatory-compliance);
  RT-CR wins per §6 mapping rule 1 (primary risk-bearing dimension).
- **`ORG-GV-13` (Protected Disclosures whistleblowing)** → `RT-FC.BC`.
  Whistleblowing protections primarily serve anti-bribery / corruption
  exposure and fraud-related reporting; could tag `RT-ST.GV` (governance
  posture). Chose `RT-FC.BC` because the regulatory weight of PRECCA +
  UK Bribery Act extra-territorial reach (already cited in `ORG-FC-20` /
  `ORG-FC-22`) dominates the conduct-substance of the protection regime.
  This is the single case of prefix-vs-assigned-category cross-listing
  (see §5).
- **`ORG-HR-04..05, ORG-HR-07..08` (EE Act / B-BBEE / SDL)** →
  `RT-LR.RC` (regulatory-compliance) rather than `RT-OP.PE` (people-
  risk). These are *reporting* obligations to statutory bodies (DEL,
  B-BBEE Commission, SETAs); the risk being managed is regulatory-
  compliance breach. The *people-risk* rows are `ORG-HR-01..03, 06, 09`
  (LRA / BCEA / OHS / harassment) where the workforce dimension is the
  primary risk-bearing substance.
- **`ORG-HR-10, 11` (remuneration alignment + fit-and-proper for
  designated officers)** → `RT-ST.GV`. Per BCBS Compensation principles
  the remuneration regime is a governance discipline (risk-aligned pay,
  malus, clawback). Tagging `RT-OP.PE` would lose the strategic-
  governance substance.
- **`ORG-MK-09, 15, 16` (JSE Equities Rules / debt-listings / trade-
  record retention)** → JSE Equities Rules trading-member discipline →
  `RT-CD.MA` (market-abuse / conduct); the retention sub-row + debt-
  listings rows → `RT-LR.RC` (regulatory-compliance reading). Splits the
  obligation by what it primarily polices: the trading discipline
  enforces market-conduct; the record-retention discipline enforces
  regulatory compliance with the JSE rule.

## 4. Cross-category cases (prefix ↔ assigned category mismatch)

Legitimate cases where the document-organisation prefix (per the
register's §"How to read this register" note that prefixes are *not*
risk classifications) doesn't align with the assigned `riskTaxonomy`:

- **`ORG-GV-13` (Protected Disclosures Act)** → `RT-FC.BC`. Governance
  prefix; financial-crime taxonomy. See ambiguity rationale above.
- **`ORG-TX-06, 07` (FATCA / CRS)** → `RT-FC.TE` (tax-evasion-
  facilitation). Tax prefix; financial-crime taxonomy. These rows
  duplicate the FATCA / CRS substrate of `ORG-FC-15, 16` but read under
  the tax-administration discipline — the risk-bearing substance
  remains crime-facilitation (per `Regulations/_risk-taxonomy.md` §4.7
  `RT-FC.TE` definition).
- **`ORG-AC-02` (IFRS 9 ECL)** → `RT-CR`. Accounting prefix; credit-risk
  taxonomy. The ECL model is credit-loss recognition.
- **`ORG-AC-15` (BCBS 239)** → `RT-OP.MD`. Accounting prefix;
  operational-risk-model taxonomy. BCBS 239 is risk-data aggregation —
  belongs to the model-risk discipline.
- **`ORG-CS1-001` (CS 1/2018 §3 operational capital)** → `RT-CR`.
  Conduct-Standard prefix; credit-risk taxonomy. The §3 test is a
  capital-adequacy test, not a conduct test.
- **`ORG-JS2-001..004` (Margin VM / IM / collateral)** → `RT-CR.CP`
  (counterparty-credit). Joint-Standard prefix; credit-risk taxonomy.
  The margining regime is CCR mitigation.
- **`ORG-MK-06, 12, 13` (ISDA / GMRA / CSA)** → `RT-LR.CT` (contract-
  enforceability). Markets prefix; legal-and-regulatory taxonomy. The
  ISDA / GMRA discipline is contract-enforceability discipline (netting
  opinions, close-out enforceability per
  `Regulations/_risk-taxonomy.md` §4.8 `RT-LR.CT` definition).
- **`ORG-MK-07` (ZARONIA conventions / JIBAR fall-back)** → `RT-MK.IR`.
  Markets prefix; market-risk-interest-rate-trading-book taxonomy.
  Clean: trading-book IR transition is `RT-MK.IR` per §4.2.
- **`ORG-BNK-CYBER-CONS` (consolidated cyber-resilience)** →
  `RT-OP.CY`. Bank-entity prefix (Domain Q consolidated); operational-
  cyber taxonomy. Clean: the cyber substance dominates over the
  consolidated-supervision wrapping.

These are not findings — the obligation-IDs are stable handles already
cited from substrate code (per §8.3 of the v1.13 schema-unification
banner), so renaming them to align with risk-taxonomy prefix would be
coordinate-breaking. The two axes are deliberately orthogonal: ID
prefix tracks document-organisation; `riskTaxonomy` tracks risk
classification.

## 5. Proposed taxonomy amendments — **none**

The v1 taxonomy at 94 codes (11 level-1 + 56 level-2 + 27 level-3)
accommodated every one of the 259 obligations cleanly. No row required
a `pendingTaxonomyAmendment` fall-back; no row needed an invented code.

The v1.16 obligations register's coverage of:

- post-greylisting CPF supervisory expectations (`ORG-FC-23`) lands
  cleanly at `RT-FC.PF` per §4.7 definition.
- consolidated-supervision rows (Domain Q `ORG-BNK-*-CONS`) classify
  at the *underlying* risk dimension (capital adequacy → RT-CR;
  liquidity → RT-LQ.FN; recovery → RT-ST.EX; cyber → RT-OP.CY;
  governance → RT-ST.GV). The `consolidated-supervision` entity-scope
  vocabulary is the orthogonal *measurement-perspective* axis, not the
  risk-classification axis.
- FAIS Posture A rows (Domain P `ORG-FAIS-RK-*`) classify at
  `RT-CD.CC` (client-conduct) per §4.6 — the record-keeping discipline
  serves client-conduct outcomes.
- Excon / FinSurv rows (Domain FX `ORG-FX-FIN-*`) classify at
  `RT-LR.RC` per §4.8 — the FinSurv reporting discipline is a
  regulatory-compliance obligation.

If the controls-catalogue authoring pass (downstream per
`Regulations/_risk-taxonomy.md` §9 gap-log) surfaces a control that
genuinely needs a node the v1 enum doesn't carry, that's the trigger
for a `D-RT-<slug>` amendment CeoDecision; v1 isn't that trigger.

## 6. Substrate gaps surfaced

Carrying these forward to existing workstreams:

- **`WS-INSTRUMENT-ANALYSES`** — 57 `[citation: TBC]` markers remain on
  individual obligation rows; the taxonomy backfill *does not* depend
  on citation precision (the level-2 classification is stable against
  the regulatory anchor named in the Citation column even when the
  precise § / clause reference is TBC).
- **Vera Wave-5 `taxonomy-coverage` recon pipeline** — named in
  `Regulations/_risk-taxonomy.md` §9 as a v1 substrate gap; this backfill
  is the first artefact that will exercise the recon when it lands.
  Three assertions the pipeline must enforce:
  1. The typed enum at `prototype/platform/risk/taxonomy.ts` is
     byte-for-byte derivable from the register (existing v1 obligation;
     v1 hand-mirrors but the recon-derived form should land in Wave-5).
  2. Every obligations row carries a valid `riskTaxonomy` code matching
     the pattern and resolving to an enum member (this backfill makes
     all 259 rows pass; ongoing recon is for new rows).
  3. No orphan code in the typed enum — codes present in the enum but
     never cited by an obligation / RAS line / policy / control / event
     are stale. At v1, ~55 enum codes have no obligation row pointing at
     them; most are level-3 nodes reserved for RAS-line / control-
     catalogue use, so the recon should classify orphan-status against
     the *combined* citation surface (register + RAS + policies +
     controls + incident events) rather than the register alone.
- **RAS-line `riskTaxonomy` backfill** — gap-log item in
  `Regulations/_risk-taxonomy.md` §9; Helena + Rohan's next-tick work.
  Not in scope for this PR.
- **Policy-frontmatter `riskTaxonomy` annotation** — gap-log item;
  Owen + policy authors' next-tick work. Not in scope for this PR.

## 7. CI evidence

- `bun run ci` from `prototype/` — **green**: 1362 tests pass, 0 fail;
  full `bunx tsc --noEmit` clean; all recon pipelines passed (citation
  gate, recon harness, dashboard derivation, no-prose-duplication,
  runtime-handler-sync, event-type registry coverage).
- `bun run citation-gate` from `prototype/` — **zero violations**.
- Pre-push rebase against `origin/main` clean (no changes); CI re-run
  not required.

## 8. Change log

| Version | Date | Change |
|---|---|---|
| v1 | 2026-05-11 | Initial backfill: 259 rows, 39 distinct codes, full coverage. Schema migrated from 9 columns to 10 columns. Obligations-view projection extended to surface the new field. |
