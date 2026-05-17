---
title: Standardised Risk Taxonomy v1 — canonical register + typed enum
author: Helena (Chief Risk Officer, governance) + Rohan (Risk engineer, engineering)
date: 2026-05-11
summary: First version of Hoz Bank's hierarchical risk taxonomy. Eleven level-1 categories + 56 level-2 subcategories + 27 level-3 nodes. Canonical register at Regulations/_risk-taxonomy.md; typed mirror at prototype/platform/risk/taxonomy.ts. Every policy, obligation, RAS line, control, incident, and finding maps to exactly one terminal node (Principle 2 — single-graph discipline).
decision-required: false
---

# Standardised Risk Taxonomy v1

Helena (Chief Risk Officer, governance) and Rohan (Risk engineer,
engineering — reports to Helena) deliver the canonical Risk Taxonomy
that every risk-bearing artefact in the bank now classifies against.

## What landed

- **Canonical register** — [`Regulations/_risk-taxonomy.md`](../Regulations/_risk-taxonomy.md).
  Eleven level-1 risk types (Credit, Market, Liquidity & Funding, IRRBB,
  Operational, Conduct, Financial Crime, Legal & Regulatory, Strategic
  & Business, Reputational, Climate & ESG). 56 level-2 subcategories.
  27 level-3 nodes where regulatory granularity demands (cyber CIA +
  resilience; third-party sub-classes; model tiers; ML/TF vectors;
  sanctions regimes; settlement type).
- **Typed enum mirror** — [`prototype/platform/risk/taxonomy.ts`](../prototype/platform/risk/taxonomy.ts).
  `RiskTaxonomyCode` string-literal union, `RISK_TAXONOMY` flat array,
  `isTerminal(code)` helper, `getRiskTaxonomyNode(code)` lookup.
  Exported through `prototype/platform/risk/index.ts`.
- **Tests** — [`prototype/platform/risk/taxonomy.test.ts`](../prototype/platform/risk/taxonomy.test.ts).
  Pattern-match `/^RT-[A-Z]+(\.[A-Z0-9]+){0,2}$/`, parent existence,
  parent-level == child-level - 1, hierarchical code prefix,
  level-1 owner non-empty, code uniqueness, terminal-per-branch.

## Why this is foundational substrate

Per Principle 2 (single-graph discipline), every artefact in the bank
sits in one citable bidirectional graph. The Risk Taxonomy supplies the
**risk-axis** of that graph — without it, "credit risk" in one policy
and "credit risk" in another are prose-equivalent strings, not
code-bound references. With it, every artefact carries a typed
`riskTaxonomy: RT-<code>` field; Vera's recon harness can assert
coverage and drift.

The register cites Basel III/IV (CRE, MAR, OPE, LCR, NSFR, IRRBB),
BCBS *Principles for the Sound Management of Operational Risk* (rev.
2021), BCBS *Principles for Operational Resilience* (2021), PA
Directives 8/2023, 9/2021, 4/2023, 1/2023, 4/2021, PA Joint Standards
1/2023 + 2/2024, FIC Act + FATF, FAIS Act + FSCA Conduct Standards,
Companies Act + FSR Act + POPIA, King IV, PA Guidance Note 1/2024 +
G3/2025, TCFD + ISSB.

## Follow-on work (not in scope here)

Each item is a separate next-tick deliverable.

1. **Vera Wave-5 `taxonomy-coverage` recon pipeline** — assert (a)
   typed enum derives byte-for-byte from the register, (b) every
   obligation row, RAS line, policy frontmatter, and emitted
   incident / breach event carries a valid `riskTaxonomy` code,
   (c) no orphan codes in the enum. **Owner:** Vera (Internal-audit
   engineer, engineering — functionally to Thandiwe CAE;
   administratively to CEO). Substrate gap; named in register §9.
2. **Backfill `riskTaxonomy` on the 259-row obligations register** —
   [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md).
   **Owner:** Mira (Compliance / RegTech engineer, engineering —
   reports to Zara CCO; obligations-register curator).
3. **Backfill `riskTaxonomy` on every RAS line** —
   [`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`](2026-05-06_risk-appetite-statement-and-framework.md).
   Level-2 tagging per register §8. **Owner:** Helena + Rohan.
4. **Policy-frontmatter `riskTaxonomy` annotation** across the eight
   risk-policy bundle ([`Owner Inbox/2026-05-06_core-policies-risk.md`](2026-05-06_core-policies-risk.md))
   + sister bundles (Finance, Compliance/Privacy, InfoSec/Ops,
   Conduct/HR). **Owner:** Owen (Company Secretary, governance) with
   the policy authors.
5. **RMF citation update** — `Owner Inbox/2026-05-06_core-policies-risk.md`
   §1 currently inlines the taxonomy list in prose. Replace with a
   citation to `Regulations/_risk-taxonomy.md` (per
   `feedback_canonical_source_registry.md` — single canonical
   authoring location). Atomic update; out of scope for this PR.
   **Owner:** Helena.
6. **Controls catalogue** — when the controls catalogue lands, each
   control tags at the taxonomy level it mitigates. **Owner:** Devon
   (Chief Operating Officer, governance) + Helena.

## Substrate gaps (carried forward)

- BCBS MAR D457 final reference confirmation (register §7 `RT-MK`
  row, marked `[citation: TBC]`).
- v1 of the register is **Board-approval pending** — the build-phase
  routing is via CEO (interim Board) per
  `feedback_ceo_vs_board_approval.md`; the formal Board ratification
  fires when the Board is constituted at licence-day.
- Amendment process (§9) requires a `CeoDecision` event of kind
  `D-RT-<slug>`. No new amendments queued at v1 landing.

## How to read the deliverable

For a quick orientation, start at register §3 (level-1 table — eleven
rows) and §6 (mapping rules — worked examples). The typed enum's flat
array is the same shape as the register, in the same order, for
side-by-side diffing.
