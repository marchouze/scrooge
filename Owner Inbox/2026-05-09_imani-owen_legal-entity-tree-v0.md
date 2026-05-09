---
title: Legal-entity tree v0 — Hoz Group + Hoz Bank + Hoz Securities
author: Imani (Legal-as-code engineer) + Owen (Company Secretary, governance)
date: 2026-05-09
summary: Canonical v0 legal-entity hierarchy for the Hoz group — group holdco, SARB-licensed bank, FSCA / JSE-licensed securities entity. Discharges D-GROUP-STRUCTURE (multi-entity confirmation, PR #78); operationalises Principle 5 (multi-entity from day one); defines named entities, registered forms, regulatory licence paths, inter-company arrangement stubs, board-composition implications under the thin-human-layer minimum, and consolidated-reporting treatment.
decision-required: true
decision-id: D-LEGAL-ENTITY-TREE-V0
decision-recommendation: |
  Approve a v0 group of three SA-incorporated legal entities — Hoz Group Limited (public Ltd, Johannesburg, parent-of-bank under Banks Act consolidated supervision), Hoz Bank Limited (public Ltd, Johannesburg, 100% subsidiary, SARB Banks Act 94 of 1990 banking licence path), and Hoz Securities Limited (public Ltd, Johannesburg, 100% subsidiary, FSCA Authorised Dealer + Category III FSP + JSE Equities & Bonds member); operate under a shared-board v0 model with the same 6 humans + Marc + audit firm serving across all three entities (subject to entity-specific fit-and-proper); brand "Hoz" as the group brand with `Hoz Bank` and `Hoz Securities` sub-brands; defer asset-management / insurance-distribution / foreign-jurisdiction entities to a future capital-event decision. Five open questions surfaced for explicit CEO call before counsel is engaged for CIPC reservations.
maps-to-decision-id: D-GROUP-STRUCTURE
---

# Legal-entity tree v0 — Hoz Group + Hoz Bank + Hoz Securities

> **Authors.** Imani (Legal-as-code engineer; reports to Devon, Chief Operating Officer, governance) + Owen (Company Secretary, governance; reports to CEO).
> **Maps to.** D-GROUP-STRUCTURE (PR #78); D-BANK-NAME-SELECTION (PR #57); CIPC-reservation scoping (PR #76).
> **Principles touched.** Principle 2 (citation discipline), Principle 5 (multi-entity from day one), Principle 6 (single-graph discipline — this is a *standard*-layer artefact deriving downward from regulation + strategic-foundation memory, referenced by every system capability and procedure), Principle 7 (autonomous-by-default — entity tree is the substrate against which agent mandates are scoped per-entity).
> **Status.** Decision-required. CEO call needed on entity-name finals, registered office, board structure, brand boundary, and v0 entity count before counsel engages CIPC.

---

## Section 1 — The group structure (proposed v0)

The Hoz group at v0 comprises **three South African legal entities** in a vertical structure: a holdco that is the parent of two operating subsidiaries (the bank and the securities firm). 100 % ownership at v0; partial-shareholding / external capital is deferred to a future capital-event decision.

```
                  Hoz Group Limited
                  (holdco; parent-of-bank)
                          |
              -----------------------------
              |                           |
       Hoz Bank Limited           Hoz Securities Limited
       (SARB Banks Act licence)   (FSCA + JSE licence)
       100% owned                 100% owned
```

### 1.1 Hoz Group Limited (holdco)

| Attribute | v0 value |
|---|---|
| **Legal name** | `Hoz Group Limited` (recommended over `Hoz Holdings Limited`; "Group" reads as the operating-group brand and avoids the passive-investment connotation of "Holdings", consistent with Linnea's brand voice) |
| **Companies Act registered form** | Public company limited by shares (`Ltd`); not a Ring-Fenced (`RF`) variant at v0 because the standard MOI suffices and `RF` adds amendment-restriction overhead the group does not yet need [citation: TBC — Companies Act 71 of 2008 § 8(2)(b) public-company classification; § 15(2)(b) ring-fenced election] |
| **Registered office** | Johannesburg (default; CEO call). Recommended: a serviced-office address in Sandton CBD pending the bank's permanent registered office. Specific street: placeholder until secured |
| **Directors composition** | At v0, the same shared-board roster as the subsidiaries (see Section 4); group-level mandate covers consolidated-supervision oversight and capital-allocation decisions |
| **Regulatory licence path** | Companies Act registration via CIPC (registration-number reservation in Imani's CIPC scoping, PR #76). Designation as **parent-of-bank** under SARB Banks Act consolidated supervision — Banks Act § 60 + Regulations Relating to Banks Reg 36 [citation: TBC — Banks Act 94 of 1990 § 60 consolidated supervision; Reg 36 controlling-company designation]. PA notification at incorporation. Subject to Joint Standard 1 of 2024 (Cybersecurity & Cyber Resilience) at group level |
| **MOI principal-business clause (one sentence)** | "The principal business of the Company is to act as the holding company of a regulated banking group, owning, capitalising, and overseeing one or more subsidiary entities engaged in licensed banking, securities, and ancillary financial-services activities in the Republic of South Africa and elsewhere." |

### 1.2 Hoz Bank Limited (SARB-licensed bank)

| Attribute | v0 value |
|---|---|
| **Legal name** | `Hoz Bank Limited` (per D-BANK-NAME-SELECTION, PR #57) |
| **Companies Act registered form** | Public company limited by shares (`Ltd`); Banks Act § 11 requires a bank to be a public company [citation: TBC — Banks Act 94 of 1990 § 11 bank-as-public-company requirement] |
| **Registered office** | Johannesburg (proximity to SARB / FSCA / JSE; default). Specific street: placeholder |
| **Directors composition** | Shared board v0 (same roster as group + securities, with entity-specific fit-and-proper clearance — Banks Act § 60 fit-and-proper applies specifically to bank-entity directors and senior officers) [citation: TBC — Banks Act § 60 director fit-and-proper; PA Directive on fit-and-proper] |
| **Regulatory licence path** | SARB Banks Act 94 of 1990 banking licence — Section 7 application; pre-licence engagement with the Prudential Authority. The bank's licence is the foundation for the entire BA-return suite, ICAAP / ILAAP / Recovery Plan, FIC Act § 43A accountable-institution registration, FAIS Act FSP licence (where the bank distributes financial products), POPIA s.55 information-officer designation, Joint Standard 1 of 2024 cyber-resilience programme. The whole substrate Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance) + Helena (Chief Risk Officer, governance) + Bea (Accounting & financial reporting engineer; reports to Camille, Chief Financial Officer, governance) build hangs off this entity [citation: TBC — Banks Act § 7 banking-licence application; FIC Act 38 of 2001 § 43A accountable-institution duties; FAIS Act 37 of 2002 § 7 FSP licence] |
| **MOI principal-business clause** | "The principal business of the Company is the conduct of the business of a bank as defined in section 1 of the Banks Act 94 of 1990, including the acceptance of deposits from the general public and the granting of advances, and to engage in such other financial and ancillary activities as the South African Reserve Bank may authorise." |

### 1.3 Hoz Securities Limited (FSCA + JSE securities entity)

| Attribute | v0 value |
|---|---|
| **Legal name** | `Hoz Securities Limited` (recommended over `(Pty) Ltd`; the strategic foundation includes JSE-listed-bond and JSE-equities trading, where market-counterparty due-diligence and capital-disclosure transparency strongly favour public-company form. JSE membership rules and FSCA fit-and-proper expectations are also more naturally satisfied by `Ltd` than by a private company. If the securities entity is later listed, the Ltd form is already in place) |
| **Companies Act registered form** | Public company limited by shares (`Ltd`) |
| **Registered office** | Johannesburg (co-located with the bank for shared-services efficiency). Specific street: placeholder |
| **Directors composition** | Shared board v0 with entity-specific FSCA fit-and-proper clearance [citation: TBC — FAIS Act § 8 FSP fit-and-proper; FSCA Determination of Fit and Proper Requirements] |
| **Regulatory licence path** | FSCA **Authorised Dealer** designation (where the entity deals as principal in JSE-listed securities and OTC IRDs) + **Category III FSP licence** under the FAIS Act for discretionary investment management on behalf of clients (where in scope) + **JSE membership** in the Equities and Bonds segments per the strategic-foundation product set + **STRATE settlement participation**. Conduct-of-business regime is FAIS General Code of Conduct + JSE Listings Requirements + JSE Equities Rules + JSE Bond Market Rules + JSE Interest Rate and Currency Derivatives Rules. FIC Act § 43A accountable-institution registration also applies. POPIA s.55 information-officer designation [citation: TBC — FAIS Act § 7 + § 8; FSCA Determination of Securities Services; JSE Equities Rules; JSE Debt Listings Requirements] |
| **MOI principal-business clause** | "The principal business of the Company is to act as a member of the JSE Limited and as an Authorised Financial Services Provider, conducting the business of a stock-broker and securities dealer in JSE-listed and over-the-counter securities and derivatives, on its own account and on behalf of institutional clients, in accordance with the Financial Advisory and Intermediary Services Act 37 of 2002 and the rules of the JSE Limited." |

### 1.4 Optional v0 entities — recommend NOT adding

The strategic-foundation memory names the bank's product set as JSE bonds + JSE equities + OTC interest-rate derivatives, with institutional-only client base, SA single-branch, and ~R300m capital. The bank + securities pair is the **v0 minimum** to discharge that strategic foundation. The following are flagged for the CEO's awareness but **recommended NOT to be added at v0**:

- **Asset-management / collective-investment-scheme entity** (FSCA Category I / Category II FSP). Not in the strategic foundation. Add when (and if) the bank enters a third-party-asset-management business line.
- **Insurance-distribution entity** (FAIS Cat I FSP for short-term / long-term insurance). Not in scope.
- **Foreign-jurisdiction holding-company** (e.g. Mauritius / UK / Cayman holdco above the SA group). Adds tax / treasury / regulatory complexity disproportionate to the v0 scope; the SA holdco satisfies SARB consolidated supervision today.
- **Dedicated treasury / FX entity**. Treasury sits inside `Hoz Bank Limited` at v0 (per Eitan, Treasurer, governance).

If the CEO chooses to add any of these at v0, the entity-name proposals + licence-paths need a second pass before CIPC reservation.

---

## Section 2 — Inter-company arrangements (v0 stubs)

Companies Act 71 of 2008 + IFRS 10 (consolidation) + IAS 24 (related-party disclosures) + Banks Act consolidated-supervision provisions require every inter-company arrangement to be **documented, arm's-length-priced, and disclosed**. The v0 stubs below are placeholders for substantive contracts that land closer to licence-day (Imani's drafting backlog).

| # | Arrangement | Direction | v0 stub | Citation |
|---|---|---|---|---|
| 1 | **Group services agreement** | Group → Bank; Group → Securities | Group provides shared IT, HR, finance, compliance, internal audit, security services; arm's-length pricing per IAS 24; allocation methodology disclosed in consolidated AFS | [citation: TBC — Companies Act § 75 director-conflict of interest; IAS 24 related-party disclosures; OECD TP Guidelines Chapter VII intra-group services] |
| 2 | **IP licensing agreement** | Group → Bank; Group → Securities | "Hoz" trademark + brand assets (Linnea's PR #72 v3 supplement artefacts) owned by Hoz Group Limited; royalty-free or arm's-length royalty licence to subsidiaries; terminable on subsidiary-divestiture | [citation: TBC — Trade Marks Act 194 of 1993; OECD TP Guidelines Chapter VI intangibles] |
| 3 | **Capital arrangements** | Group → Bank; Group → Securities | Group injects ~R300m target capital into the bank at licence-day per strategic foundation; group funds securities entity at FSCA-required minimum capital + working-capital headroom; capital-instrument form (ordinary shares vs preference vs subordinated debt) is a downstream decision | [citation: TBC — Banks Act § 70 minimum capital; Regulations Relating to Banks capital-adequacy schedule; FSCA Determination of Fit and Proper minimum-capital rules for FSPs] |
| 4 | **Intra-group exposures** | Bank ↔ Securities | The bank may face the securities entity as a counterparty (e.g. securities entity executes JSE trades booked at the bank; bank provides FX / settlement services to securities entity). Banks Act intra-group large-exposure limits apply; intra-group exposures consolidated out at group level for IFRS but capital-charged at bank level | [citation: TBC — Banks Act § 73 large-exposure limits; Regulations Relating to Banks Reg 23 large-exposures; BCBS large-exposure framework SCO40] |
| 5 | **Tax arrangements** | Group ↔ Bank ↔ Securities | SARS group-tax election where eligible (each entity remains a separate corporate-tax filer; consolidated-tax substrate is not a SA feature); transfer-pricing policy for arm's-length intra-group services pricing (Yael, Tax engineer's mandate); STT / VAT FS apportionment per entity | [citation: TBC — Income Tax Act 58 of 1962 § 31 transfer pricing; § 41 group-restructuring relief; VAT Act 89 of 1991 financial-services apportionment] |

Each arrangement is a **v0 stub**; substantive contracts (Imani draft → Owen review → board approval at each entity) land closer to licence-day. The arrangements are listed here so the legal-entity-tree artefact is structurally complete; populating them is a downstream procedure.

---

## Section 3 — Regulatory licence paths per entity

### 3.1 Hoz Group Limited

- **CIPC registration** — public-company incorporation; CoR forms; MOI lodgement [citation: TBC — Companies Act § 13 incorporation; § 15 MOI].
- **Parent-of-bank designation** — at the point the bank's Section 7 application is lodged, the group is named as the bank's controlling company; PA approval of the controlling-company structure is a Banks Act gate [citation: TBC — Banks Act § 60 controlling-company; Reg 36].
- **Consolidated supervision** — once designated, the group is subject to **consolidated supervision** under Banks Act § 60+: consolidated capital adequacy, consolidated large-exposure limits, consolidated risk reporting, group-level ICAAP / ILAAP, group-level Recovery Plan, group-level Joint Standard 1 of 2024 cyber-resilience testing [citation: TBC — Reg 36; BCBS Core Principles for Effective Banking Supervision, principles 12–13 consolidated supervision].
- **POPIA** — group-level Information Officer designation at incorporation (or shared with bank entity, per Iris, Information Officer, governance's scoping) [citation: TBC — POPIA Act 4 of 2013 § 55 IO designation].

### 3.2 Hoz Bank Limited

- **SARB Banks Act 94 of 1990 banking licence** — Section 7 application; pre-licence engagement with the Prudential Authority; "section 13" letter of authorisation precedes full s.16 registration [citation: TBC — Banks Act § 7, § 13, § 16].
- **BA-return suite** — full set of prudential returns once licensed (BA100 series capital, BA200 liquidity, BA300 credit, BA400 market-risk, BA500 operational-risk, BA600 ICAAP, BA700 returns, BA900 statistical) [citation: TBC — Regulations Relating to Banks Reg 39 reporting; PA Directives on prudential returns].
- **ICAAP / ILAAP / Recovery Plan** — annually, once licensed [citation: TBC — Reg 39; BCBS Pillar 2; BCBS Recovery Planning].
- **FIC Act § 43A accountable-institution registration** — automatic upon banking licence; Risk Management and Compliance Programme (RMCP) under Mira's substrate [citation: TBC — FIC Act § 42 RMCP; § 43A accountable institution].
- **FAIS Act FSP licence** — where the bank distributes financial products to clients, a Category I FSP licence (or relevant Cat) is required [citation: TBC — FAIS Act § 7].
- **POPIA Information Officer designation** at entity level [citation: TBC — POPIA § 55].
- **Joint Standard 1 of 2024 (Cybersecurity and Cyber Resilience)** programme [citation: TBC — Joint Standard 1 of 2024 PA + FSCA].
- **Twin Peaks dual oversight** — PA prudential + FSCA market-conduct (FAIS / TCF) [citation: TBC — Financial Sector Regulation Act 9 of 2017 Twin Peaks].

### 3.3 Hoz Securities Limited

- **FSCA Authorised Dealer** designation (where the entity deals as principal in JSE-listed and OTC securities) [citation: TBC — FSCA Determination of Securities Services].
- **FAIS Act Category III FSP licence** for discretionary management on behalf of institutional clients [citation: TBC — FAIS Act § 7; FSCA General Code of Conduct].
- **JSE membership** in Equities and Bonds segments (matching the strategic-foundation product set) [citation: TBC — JSE Equities Rules; JSE Debt Listings Requirements; JSE membership-application procedures].
- **STRATE settlement participation** [citation: TBC — STRATE participation rules].
- **FIC Act § 43A accountable-institution registration** [citation: TBC — FIC Act § 43A].
- **POPIA Information Officer designation** at entity level [citation: TBC — POPIA § 55].
- **Joint Standard 1 of 2024** programme (FSCA-supervised entities are in scope) [citation: TBC — Joint Standard 1 of 2024].
- **JSE Listings Requirements** apply if the securities entity is itself listed (deferred decision).

### 3.4 Cross-cutting

- **Sanctions screening**: group-level policy ownership (Zara, Chief Compliance Officer, governance); per-entity execution against per-entity client books.
- **Indirect-participant posture** (`project_indirect_participant_posture.md`): the bank does NOT directly join CLS or SAMOS at v0; access via correspondent / sponsor banks. The securities entity accesses STRATE directly (settlement of JSE trades) but does not join CLS.

---

## Section 4 — Thin-human-layer composition implications

D-THIN-HUMAN-LAYER-MINIMUM (PR #24, updated PR #65) named **6 humans + Marc + audit firm** as the licence-day human roster *for the bank*. This section addresses how that roster spans the group + 2 entities.

### 4.1 Recommendation — shared-board v0

**Same 6 humans + Marc + audit firm serve as directors / officers across all three entities.** Companies Act 71 of 2008 permits multi-board directorship; Banks Act § 60 fit-and-proper applies to bank-entity directors; FSCA fit-and-proper applies to securities-entity directors. The 6-human roster is small enough that separate boards would over-engineer a v0 group of three SA entities.

### 4.2 Per-entity director / officer mapping (recommendation)

| Role | Hoz Group Limited | Hoz Bank Limited | Hoz Securities Limited | Notes |
|---|---|---|---|---|
| **Chair / NED** | Human #1 (group Chair) | Same person; entity-specific fit-and-proper | Same person; entity-specific fit-and-proper | One Chair across all three at v0 |
| **NED** | Humans #2–#3 | Same | Same | Two NEDs share across all boards |
| **CEO** | Marc | Marc | Marc | Marc is CEO of all three at v0 (interim); future split is a downstream decision |
| **CFO** | Human #4 | Same | Same | Owns IFRS 10 consolidation at group level (per Bea + Camille) |
| **CRO** | Human #5 | Same | Same | Owns group-level RAS + ICAAP / ILAAP at consolidated level (per Helena) |
| **CCO** | Human #6 | Same | Same | Owns group-level RMCP + entity-specific FAIS / FIC compliance officer roles (per Zara) |
| **CoSec** | Owen-shared-human (or distinct) | Same | Same | Companies-Act required at each entity; one human can serve all three |
| **Public Officer** | One designated human per entity | One designated human per entity | One designated human per entity | SARS-required; can be the same human across all three |
| **Auditor** | Audit firm (group + entities) | Same firm | Same firm | Single audit firm across the group; consolidated audit + per-entity audits |

### 4.3 Fit-and-proper — entity-specific, not transitive

A director who clears bank fit-and-proper does NOT automatically clear securities fit-and-proper — each entity-specific regime requires its own assessment. Sade (HR systems engineer; reports to Devon, COO, governance) at v0 owns the fit-and-proper substrate; Owen + Zara verify per-entity submissions.

### 4.4 Open question for the CEO

If the CEO prefers **separate boards** (e.g. distinct group Chair + entity Chairs; distinct group NEDs + entity NEDs), the human roster expands beyond 6 — see Section 7 #4. Recommended: shared-board v0 to preserve thin-human-layer minimum.

---

## Section 5 — Consolidated reporting + IFRS treatment

| Standard | v0 application |
|---|---|
| **IFRS 10 — Consolidated financial statements** | Group prepares consolidated AFS; intra-group transactions eliminate; minority-interest treatment is zero at v0 (100 % ownership). [citation: TBC — IFRS 10 § 19 elimination; § 22 NCI] |
| **IFRS 12 — Disclosure of interests in other entities** | Disclose entity tree, control assessment, restrictions on intra-group asset access (e.g. SARB consent for capital extraction from the bank). [citation: TBC — IFRS 12 § 10–17] |
| **IAS 24 — Related-party disclosures** | Every inter-company arrangement disclosed; key-management compensation aggregated at group level. [citation: TBC — IAS 24] |
| **IAS 21 — FX translation** | Intra-group balances in different currencies translated per IAS 21; closing-rate for B/S, average-rate for P&L (per Principle 5 — multi-currency from day one). [citation: TBC — IAS 21] |
| **IAS 27 — Separate financial statements** | Each entity prepares separate AFS in addition to consolidated AFS; investments-in-subsidiaries carried at cost or fair-value at parent level. [citation: TBC — IAS 27] |

**Ownership.** Bea (Accounting & financial reporting engineer) builds the consolidation substrate; Camille (Chief Financial Officer, governance) signs financial statements at the group level and at each entity. External auditor opines on consolidated + per-entity AFS.

---

## Section 6 — Typed-event substrate gap

The legal-entity tree must be representable in the event log (Principle 1). Atlas (Core banking platform architect; reports to Devon, COO, governance) v1 substrate task: define and ship the `LegalEntityRegistered` event family.

### 6.1 `LegalEntityRegistered` event payload sketch

```typescript
{
  entityId: string,                    // urn:legal-entity:bank:hoz-group:v1
  legalName: string,                   // "Hoz Group Limited"
  registeredForm: "Ltd" | "RF" | "Pty",
  jurisdiction: string,                // "ZA"
  registeredOffice: {
    street: string,
    city: string,
    country: string,
  },
  parentEntityId: string | null,       // null for the group
  regulatoryLicences: Array<{
    regulator: string,                 // "SARB" | "FSCA" | "JSE" | "CIPC" | ...
    licenceType: string,               // "BANKING_LICENCE_S7" | "FSP_CAT_III" | ...
    status: "PENDING" | "GRANTED" | "SUSPENDED" | "WITHDRAWN",
    asOfDate: string,                  // ISO date
  }>,
  directors: Array<{
    name: string,
    fitAndProperFile: string,          // urn ref to F&P assessment
    appointmentDate: string,
  }>,
  registrationDate: string,
  citations: string[],                 // e.g. ["companies-act-71-of-2008-s-13", ...]
}
```

### 6.2 Sibling event families

- **`LegalEntityChanged`** — for renames, parent-changes, director changes, registered-office changes, MOI amendments. Emits a delta + the post-change snapshot.
- **`IntraGroupArrangementSigned`** — for service / IP / capital / intra-group-exposure agreements. Payload includes counterparty entity ids, arrangement type, effective date, arm's-length-pricing methodology, citation chain.
- **`RegulatoryLicenceStatusChanged`** — for licence-grant, licence-suspension, licence-withdrawal events.

### 6.3 Downstream consumers

- **Mira's obligations register** — per-entity scoping queries (which obligations apply to which entity).
- **Anya's per-entity dashboard view** — entity-tree visualisation; per-entity capital, exposure, return-status drilldowns.
- **Bea's consolidation substrate** — IFRS 10 consolidation queries hang off the entity tree.
- **Yael's transfer-pricing substrate** — per-entity service / IP / capital / exposure flows.
- **Helena's group-level RAS** — consolidated capital + liquidity + large-exposure limits.

The typed export `prototype/platform/legal/entity-tree.ts` is a follow-on task (Imani + Atlas joint). Not built in this PR.

---

## Section 7 — Open questions for Marc

These five questions need explicit CEO call before counsel engages CIPC for reservation execution. Each carries my joint recommendation.

### Q1 — Final entity names

| Option | Recommendation |
|---|---|
| `Hoz Group Limited` vs `Hoz Holdings Limited` | **Recommend Group**. Reads as the operating-group brand; avoids passive-investment connotation; consistent with Linnea's PR #72 v3 brand voice. |
| `Hoz Securities Limited` vs `Hoz Securities (Pty) Ltd` | **Recommend Limited**. Public-company form better fits institutional-counterparty due-diligence + capital-disclosure transparency + future-listing optionality + JSE / FSCA fit-and-proper expectations. |

### Q2 — Registered office city

| Option | Recommendation |
|---|---|
| Johannesburg | **Recommended**. Proximity to SARB, FSCA, JSE, STRATE, the major correspondent banks, and the major counterparty institutions. Matches SA banking-sector concentration. |
| Cape Town | Viable but distant from regulators and JSE; better fit for fintech / consumer-bank focus. |
| Pretoria | Closer to SARB but inferior to JHB on JSE / counterparty proximity. |

### Q3 — v0 entity count

| Option | Recommendation |
|---|---|
| Bank + Securities pair (3 entities total) | **Recommended**. Discharges the strategic foundation (institutional global-markets trading bank with JSE bonds + JSE equities + OTC IRD product set). Minimum group structure that operationalises Principle 5. |
| Add asset-management / insurance / foreign holdco at v0 | **Not recommended**. Out of strategic foundation; adds licensing + tax + treasury complexity disproportionate to v0. Defer to a future capital-event decision. |

### Q4 — Board structure

| Option | Recommendation |
|---|---|
| Shared board (same 6 humans + Marc across group + bank + securities, with entity-specific fit-and-proper) | **Recommended**. Preserves thin-human-layer minimum. Companies Act + Banks Act + FSCA all permit multi-board directorship subject to fit-and-proper. |
| Separate boards (distinct directors per entity) | Expands human roster materially beyond 6; over-engineering at v0. |

### Q5 — Brand boundary

| Option | Recommendation |
|---|---|
| "Hoz" as group brand with `Hoz Bank` and `Hoz Securities` as sub-brands | **Recommended**. Consistent with Linnea's PR #72 v3 voice and tone supplement. Maximises brand-equity transfer across entities. |
| "Hoz" as bank brand only; separate group / securities brands | Not recommended; fragments brand equity and confuses counterparties. |

---

## Section 8 — Substrate gaps surfaced (not built in this PR)

Surfaced per Principle 7 (substrate-gap inventory transparency). These are roadmap items for downstream agent runs, not work for this PR.

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | `LegalEntityRegistered` + sibling event families (Section 6) | Atlas (Core banking platform architect) | Post-CEO approval of v0 names |
| 2 | Per-entity obligations-register scoping (which obligations apply to which entity) | Mira (Compliance / RegTech engineer) | Post-event-family ship |
| 3 | Intra-group transfer-pricing substrate (arm's-length pricing methodology + IAS 24 disclosure generators) | Yael (Tax engineer) | Pre-licence-day |
| 4 | Consolidated-supervision substrate (group-level RAS, group-level ICAAP / ILAAP, group-level Joint Standard 1 of 2024 testing, group-level Recovery Plan) | Helena (CRO) + Mira + Owen joint substrate task | Pre-licence application |
| 5 | CIPC reservation execution (group + bank + securities + defensive set) | Imani + counsel | Post-CEO approval of v0 names |
| 6 | Per-entity persona / mandate visibility — `/Team/` files are bank-centric today; entity-scope clarification (which agents serve which entity) owed | Scrooge (Chief of Staff) curating; Owen reviewing | Post-CEO approval; touch-time on persona files |
| 7 | Typed export `prototype/platform/legal/entity-tree.ts` | Imani + Atlas joint follow-on | Post-event-family ship |
| 8 | Inter-company-arrangement substantive contracts (services / IP / capital / intra-group-exposure / tax) — Section 2 v0 stubs to substantive drafts | Imani drafting + Owen review + entity-board approval | Pre-licence-day |
| 9 | Per-entity Information Officer designations (POPIA s.55) — group + bank + securities | Iris (Information Officer, governance) | Pre-licence-day |
| 10 | Per-entity FIC Act § 43A registration + RMCP (bank + securities) | Mira + Zara | Post-licence application |

---

## Citation chain

- **Principle 5** (`CLAUDE.md`) — multi-entity from day one; legal-entity tree is the substrate.
- **D-GROUP-STRUCTURE** (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-group-structure.md`, PR #78) — multi-entity confirmation; this artefact discharges that decision.
- **D-BANK-NAME-SELECTION** (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md`, PR #57) — `Hoz Bank` named.
- **CIPC-reservation scoping** (`Owner Inbox/2026-05-09_imani_hoz-cipc-reservation-scoping.md`, PR #76) — superseded for single-entity default; this artefact extends to the group.
- **Strategic foundation** (`project_strategic_foundation.md`) — institutional global-markets trading bank product set drives the bank + securities entity choice.
- **Indirect-participant posture** (`project_indirect_participant_posture.md`) — informs licence-path scoping.
- **Thin-human-layer minimum** (D-THIN-HUMAN-LAYER-MINIMUM, PR #24 + PR #65) — drives shared-board recommendation.
- Statutory anchors (per-clause, all `[citation: TBC]` until counsel verifies): Companies Act 71 of 2008, Banks Act 94 of 1990, Regulations Relating to Banks (in particular Reg 36 controlling-company, Reg 39 reporting), FAIS Act 37 of 2002, FIC Act 38 of 2001, POPIA Act 4 of 2013, Financial Sector Regulation Act 9 of 2017 (Twin Peaks), Joint Standard 1 of 2024, Income Tax Act 58 of 1962, VAT Act 89 of 1991, JSE Equities Rules, JSE Debt Listings Requirements, FSCA Determination of Fit and Proper, IFRS 10 / 12, IAS 21 / 24 / 27, BCBS Core Principles, BCBS large-exposure framework, OECD Transfer Pricing Guidelines.

---

*End of legal-entity tree v0. Awaiting CEO approval on Section 7 questions before CIPC reservation execution.*
