---
title: CEO decisions — FX sub-decisions (AD status; CLS membership; book boundary)
author: Marc · Scrooge (record)
date: 2026-05-07
summary: Three sub-decisions surfaced in the FX product-family deliverable, resolved together. Full SARB Authorised-Dealer pursued. FX settlement via correspondent routing (no direct CLS membership). Markets-vs-treasury book boundary set at execution time, no post-hoc reclassification.
decision-required: false
---

# CEO decisions — FX sub-decisions

**Decided by:** Marc (CEO)
**Date:** 2026-05-07
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_fx-product-family.md` § 12
**Events:** Four `CeoDecision` events appended to the event store with citations `GOV-FRAMEWORK-CEO-RESERVED` and `COMPANIES-ACT-71-2008` (per `Procedures/by-policy/ceo-decision-review.md`). The fourth event is a same-day correction to D-FX-CLS-MEMBERSHIP — see § "D-FX-CLS-MEMBERSHIP" below.

> **Correction notice (2026-05-07).** D-FX-CLS-MEMBERSHIP was first recorded as "no CLS, bilateral settlement, accepting Herstatt risk". The CEO clarified shortly thereafter that "No" to CLS membership meant "use a correspondent for FX settlement", not "settle bilaterally". The original event remains in the log for audit; a corrected `CeoDecision` event with the same `decisionId` was appended; the substrate's latest-wins-per-key folding rule (A0 schema-freeze §6) means the dashboard's resolved-decisions list now shows the corrected outcome. The §12 trichotomy in the FX product-family deliverable (Settlement Member / Third-Party-Customer / bilateral) missed the correspondent-routing path; that omission is the source of the misreading. The implications below reflect the **corrected** decision.

---

## D-FX-AD-STATUS — Full SARB Authorised Dealer (approved as recommended)

**Decision.** The bank pursues **full SARB Authorised-Dealer status** for foreign-currency dealing — not ADLA (Authorised Dealer with Limited Authority, restricted to retail forex), not correspondent-routing through a third-party AD.

**Why (as recorded in §12 of the proposal).** Institutional FX coverage requires it; ADLA is restricted in scope and inappropriate for the institutional client segment; correspondent-routing means the bank does not actually own the FX franchise. Full AD is the operating posture consistent with the strategic foundation.

**Implications.**
- The licence application track now includes the Authorised Dealer application as a parallel workstream. Saskia + Mira + Imani co-own; Owen tracks the application's governance milestones.
- The Currency and Exchange Manual for Authorised Dealers becomes a binding obligations source for the bank; Mira adds the manual to the obligations register as a primary instrument with its associated URN cluster.
- The bank's FinSurv reporting obligation is direct — no intermediation.

**Owners going forward.** Saskia (markets franchise) · Mira (compliance — FinSurv reporting + Exchange Control Manual interpretation) · Imani (legal — AD application paperwork).

## D-FX-CLS-MEMBERSHIP — Correspondent routing for FX settlement (approved; corrected from initial bilateral interpretation)

**Decision (corrected).** The bank does **not** join CLS directly — neither as Settlement Member nor as Third-Party-Customer. FX settles via **correspondent routing**: a CLS-member correspondent bank handles the actual settlement; the bank instructs via SWIFT MT202 / pacs.009. The bank's exposure on any given FX settlement reduces from "all my counterparties bilaterally" to "the correspondent intraday".

**Why.** Cost-effective at the bank's scale; standard institutional path; preserves PvP-quality settlement (the correspondent is a CLS member, so the actual currency exchange is PvP within CLS) without the operational and capital overhead of direct CLS membership. A clean separation between regulatory authority (full AD per D-FX-AD-STATUS) and operational settlement path (correspondent).

**Important separation of concerns.** AD status (regulatory authorisation to deal in foreign currency) is independent from settlement path (how cash actually moves). A full Authorised Dealer can use a correspondent for settlement; the §12 trichotomy in the FX product-family deliverable conflated these and missed correspondent-routing as the operational answer. Saskia and Kai will revise the proposal to make the distinction explicit.

**Implications.**

- **Outsourcing & Third-Party Risk Policy now applies in earnest** to the correspondent relationship. Devon owns the third-party-risk surface; pre-engagement due diligence, ongoing monitoring, performance SLAs, exit strategy, concentration risk. The relationship sits within `Procedures/by-policy/outsourcing-due-diligence.md` (planned) and `Procedures/by-policy/directive-3-pa-notification.md` (planned). Material correspondent for cross-border functions is notifiable to the PA under SARB Directive 3 of 2018 — Devon owns the directive-3 procedure.
- **Imani contracts the correspondent agreement** — typically an ISDA-Master-class bilateral agreement plus operational SLAs, indemnities for settlement failures, dispute resolution, exit conditions. Required pre-M4 go-live.
- **Senna conducts cyber + operational due diligence** on the correspondent — connectivity (SWIFT FIN-Y / SCORE), credential isolation, key custody, IR cooperation, supply-chain posture. Joint Standard 1 of 2024 controls extend to material third parties.
- **Mira covers the FIC / sanctions dimension** — the correspondent's own AML/CFT posture and sanctions discipline (the bank inherits reputational exposure to the correspondent's mistakes); SARB-PA expectations on third-party-risk for AML.
- **Concentration risk** — single correspondent is a single point of failure. The default posture is **primary correspondent + named contingent backup** (paired correspondents, with periodic switch-test). Devon + Tomas own the design.
- **Herstatt risk is materially reduced** vs. bilateral settlement — confined to the correspondent's intraday window during a settlement leg failure, not every counterparty. Vera tracks the residual exposure as an informational finding; it is no longer fail-severity once the correspondent is in place.
- **Rohan computes the capital implication** — counterparty-exposure to the correspondent (highly-rated, short-duration intraday) attracts a much smaller capital charge than bilateral-FX-settlement exposure across an open counterparty book. SA-CCR netting against the correspondent's bilateral position applies.
- **Helena adds an appetite line on correspondent concentration** — limit on aggregate intraday exposure to the correspondent; daily / intraday cap. Required input to RAS B-cluster.
- **Camille reports the third-party-risk + concentration treatment** to the BRC quarterly; financial-statement disclosure of the correspondent relationship under IFRS 7.
- **Re-evaluation cadence.** Reopened if (a) the bank scales such that direct CLS Settlement Membership becomes commercially attractive, (b) the chosen correspondent's own credit / operational quality deteriorates, or (c) a regulatory change to the SA settlement landscape (e.g. new domestic CLS-equivalent infrastructure) makes the correspondent path inferior.

**Owners going forward.** Eitan + Tomas (operational implementation — correspondent connectivity, monitoring, primary + backup design) · Devon (third-party-risk governance + Directive 3 of 2018 procedure) · Imani (correspondent agreement contracting) · Senna + Rashida (cyber + operational due diligence) · Mira (FIC / sanctions exposure on correspondent) · Helena (concentration appetite line) · Rohan + Camille (capital + financial-statement reporting impact).

## D-FX-BOOK-BOUNDARY — Explicit-tag-at-execution (approved as recommended)

**Decision.** The markets-vs-treasury FX-book boundary is set **at execution time** by the `bookType` discriminator on the Identification primitive (one of `"trading"` or `"banking-treasury"`). **Reclassification is allowed only via explicit `TradeAmended` event with full audit trail; no post-hoc reclassification by spreadsheet, by month-end accounting election, or by any other unaudited mechanism.**

**Why.** The classical industry pattern of running separate trading and treasury systems with month-end reconciliation is forbidden by Principle 1 (no authoritative aggregates outside the event log). Explicit-at-execution preserves the single-graph discipline (Principle 6) — the IFRS classification, risk treatment, and capital treatment all dispatch on `bookType` from a single typed value, not from a presentation-layer election.

**Implications.**
- The `bookType` discriminator becomes a required field on `TradeExecuted` payloads for FX product types from M4 onwards. Atlas adds it to the `_schemas/markets/TradeExecuted.ts` shape; Kai enforces at execution time.
- Bea's IFRS classification rules dispatch on `bookType`; Rohan's risk-method dispatch reads it; Camille's capital reporting reads it.
- Reclassifications across the boundary are rare-but-real — the runbook for them is `TradeAmended` events with explicit governance approval (Saskia + Eitan + Helena tri-sign for material reclassifications). Owen adds a procedure stub `book-reclassification.md` to the procedures index.
- This discipline extends naturally to other multi-book products in future (e.g. SAGB inventory held for trading vs HQLA — same discriminator, different book values).

**Owners going forward.** Saskia + Eitan (jointly own the boundary in operations) · Helena (framework governance) · Bea (IFRS dispatch) · Atlas + Kai (substrate discriminator implementation) · Owen (`book-reclassification.md` procedure stub).

## Cross-cutting follow-ups

These three decisions taken together produce the following routed open items:

- **To Mira:** add the Currency and Exchange Manual for Authorised Dealers to the obligations register as a primary instrument; populate the URN cluster; coordinate with Imani on the AD-application document set; cover correspondent-bank FIC / sanctions due diligence.
- **To Devon:** own the third-party-risk governance for the FX correspondent (and any other correspondents); ensure `outsourcing-due-diligence.md` and `directive-3-pa-notification.md` procedures are populated ahead of M4; primary + backup correspondent design with Tomas.
- **To Tomas:** correspondent connectivity (SWIFT FIN-Y / SCORE); intraday settlement monitoring; switch-test runbook between primary and backup correspondent. Required at M4.
- **To Imani:** contract the correspondent agreement (ISDA-Master-class bilateral + operational SLAs + indemnities + exit conditions). Required pre-M4.
- **To Senna + Rashida:** cyber + operational due diligence on the correspondent (connectivity, credential isolation, key custody, IR cooperation, supply-chain posture); Joint Standard 1 of 2024 third-party extensions.
- **To Helena:** add the correspondent-concentration appetite line to the RAS B-cluster (joint with Eitan and Saskia); intraday cap.
- **To Vera:** track correspondent-relationship Herstatt residual as an informational finding; open the third-party-risk pipeline if not already in the Wave-4 catalogue.
- **To Atlas + Kai:** add `bookType` to `_schemas/markets/TradeExecuted.ts` per the A0 freeze evolution discipline; add `book-reclassification.md` to the procedures index.
- **To Owen:** sequence the AD-application milestones into the governance calendar; sequence the correspondent-relationship Directive-3 notification; coordinate with Imani on both legal tracks.
- **To Saskia + Imani:** prepare the AD-application document set; identify the timeline relative to the SARB licence application.
- **To Rohan:** scope the counterparty-exposure capital treatment for the correspondent (highly-rated, intraday — much smaller add-on than bilateral); report at M4.
- **To Camille:** financial-statement disclosure of the correspondent relationship (IFRS 7) and concentration risk; BRC reporting at M4 + quarterly thereafter.
- **To Saskia + Kai:** revise the FX product-family deliverable §12 to make the AD-status-vs-settlement-path distinction explicit, and to add correspondent-routing as the recommended option; Vera's prose-duplication pipeline should not be allowed to mask that the spec misled the §12 recommendation.

---

—Recorded by Scrooge per `Procedures/by-policy/ceo-decision-review.md`. Four `CeoDecision` events appended to the event store (the fourth corrects D-FX-CLS-MEMBERSHIP same-day); the dashboard's resolved-decisions list reconciles to the latest event per `decisionId` on the next derive (per the A0 schema-freeze §6 latest-wins-per-key folding rule).
