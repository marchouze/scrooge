# Brief — Risk Appetite Statement and Framework

**Author:** Scrooge (relaying CEO directive)
**Date:** 2026-05-06
**For:** Helena (lead — CRO, governance owner)
**CC:** Rohan (risk engineer — supplies measurement and modelling inputs), Mira (compliance / financial-crime appetite), Ravi (treasury / liquidity / IRRBB appetite), Senna (cyber and operational-resilience appetite), Bea (capital and earnings appetite), Vera (assurance over the framework), Imani (legal-entity-level appetite distribution)

## Background

The CEO has confirmed that risk-appetite-dependent design defaults are to be deferred to the **CRO** and to the **Risk Appetite Statement and Framework (RAS / RAF)**. The CEO has further confirmed (2026-05-06) that the CRO is a **governance seat distinct from engineering**: Helena is the CRO; Rohan remains the risk engineer and reports up into Helena on risk matters. The first place this RAS dependency surfaced concretely was the continuous-KYC restrict-immediately-vs-restrict-on-review default (see `Team Inbox/2026-05-06_brief_client-master-and-continuous-kyc.md`), but it will recur across the platform: limits, escalation triggers, customer-acceptance thresholds, model-risk tolerance, cyber-incident severity thresholds, and many others.

Until the RAS / RAF exists, those design defaults sit in limbo. This brief commissions the RAS / RAF as a first-class deliverable.

## What is required

A Risk Appetite Statement and Framework that:

1. **Defines the bank's appetite** across the standard risk taxonomy: credit, market (incl. IRRBB), liquidity and funding, operational (incl. cyber and third-party), conduct, financial crime / AML / sanctions, legal, regulatory / compliance, strategic, reputational, model, climate / ESG (in line with PA Guidance Note 1 of 2024 on climate-related risks).
2. **Expresses appetite quantitatively where possible** — limits, thresholds, KRI bands, capital and liquidity floors above regulatory minima, loss-tolerance — and qualitatively where appropriate (e.g., conduct, reputation).
3. **Cascades** from a board-level RAS into operational limits and KRIs that the platform enforces in real time. The RAS is not a document; the operational limits derived from it are *event-driven controls*, and breaches are events.
4. **Cites** every appetite line back to the obligations register (P2) — Banks Act regulation, BCBS principle, FIC Act provision, Joint Standard 1 of 2024 line, internal policy version.
5. **Is multi-everything** (P5) — appetite is expressed per legal entity, per jurisdiction where material, and per significant currency where the risk is currency-sensitive (e.g., LCR by significant currency).
6. **Is replayable** (P1) — the RAS in force at any past as-of date is reproducible from the event log, including breach evaluation against the appetite-as-it-then-stood.

## Scope of work

1. Draft RAS — board-level statement with the principal appetite lines per risk category.
2. Draft RAF — the governance machinery: ownership, monitoring, escalation, breach response, review cycle, reporting cadence to ALCO / Risk Committee / Board.
3. Translate RAS into **operational limits and KRIs** suitable for real-time enforcement on the event-sourced platform. Where a limit cannot be enforced as code, document why and register it as an exception.
4. Define the **breach event taxonomy** — what is a breach, how is it detected, what is the prescribed response, who is the typed actor for each step.
5. Set **risk-category-specific defaults** that other domains have been waiting on, including:
   - Continuous-KYC restriction default (immediate vs on-review) — the surfaced trigger for this brief.
   - Sanctions-screening match-handling defaults.
   - Liquidity buffer above LCR regulatory minimum.
   - Capital buffer above PA-set minima.
   - Model-risk tier thresholds.
   - Cyber-incident severity tiers (interlocks with Senna's IR runbook).
   - Concentration limits (single-name, sector, country, currency).
6. Provide the **review and update cadence** — who can change the RAS, with what governance, and how the change becomes a register-linked event.

## Inputs Rohan should consume

- **Mira** — financial-crime appetite signals; FIC RBA risk-band thresholds; sanctions match-handling.
- **Ravi** — liquidity / funding / IRRBB / FX appetite proposals from a treasury seat.
- **Senna** — cyber and operational-resilience severity thresholds; Joint Standard 1 of 2024 alignment.
- **Bea** — earnings-volatility tolerance; capital-buffer proposals; IFRS 9 ECL stage-migration tolerance.
- **Imani** — entity-level appetite distribution as the legal-entity tree extends.
- **Vera** — assurance hooks; what evidence the framework must produce continuously.

## Deliverable

A single Owner Inbox document, target turnaround within two weeks:

- `Owner Inbox/YYYY-MM-DD_risk-appetite-statement-and-framework.md`

Structured as:

1. RAS (board-level statement).
2. RAF (governance machinery).
3. Operational limits and KRIs derived from the RAS.
4. Breach event taxonomy.
5. Specific defaults set (continuous-KYC restriction default; the others listed above).
6. Obligations-register entries created (cross-referenced from the document).
7. Review cycle and change governance.

## Principle alignment

**P1.** Appetite-in-force at any as-of date is a query. Limits are projections; breaches are events.

**P2.** Every appetite line cites the regulator / standard / policy that justifies it. The RAS itself is a register entry.

**P3.** No spreadsheets, no offline limit registers. Limits are coded; breaches are events; reporting packs are queries.

**P4.** Cyber and operational-resilience appetite is expressed quantitatively where possible (RTO/RPO, incident-severity tiers) and binds Senna's IR design.

**P5.** Per-entity, per-jurisdiction, per-significant-currency where material. The framework must accept new entities and jurisdictions as register changes, not project work.

## Note on the CRO seat

CEO confirmed (2026-05-06) that the CRO is a separate governance seat. Helena has been hired into that seat. Rohan continues as risk engineer (measurement, modelling, quantitative outputs) and reports to Helena on risk matters.
