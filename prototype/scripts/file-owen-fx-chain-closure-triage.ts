// scripts/file-owen-fx-chain-closure-triage.ts
//
// RMS Phase 3 filing for Owen's OTC Vanilla FX (prd:bank:fx:otc-vanilla v1.0.1)
// regulatory-chain-closure triage. Emits a RecordFiled event so the Documents
// register holds the canonical, readable disposition of all 50 FX-scoped
// obligations (41 closed by the policy estate, 9 deferred to licence-day) plus
// the 2 FSCA retail-conduct objective dispositions.
//
// This record is the honest-closure ledger for D-FX-CHAIN-CLOSURE-DISPATCH:
// (a) folded-and-verified CLOSES edges, (b) reasoned licence-day deferrals (no
// fabricated edges), (c) routed authoring gaps. The chain-closure recon
// (recon:npa-coverage) is the live assertion; this record is its rationale.
//
// Authority: D-FX-CHAIN-CLOSURE-DISPATCH (CEO session-delegation, 2026-06-11);
// D-RMS-PHASE-3 (active). Cross-ref: D-FX-FORWARDS-TRADING-FVTPL (AC-03
// disposition); D-FX-OTC-UMBRELLA (prd:bank:fx:otc-vanilla product scope).
// Author: Owen (Company Secretary, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const body = `# OTC Vanilla FX — regulatory chain-closure triage (47-obligation sweep)

**Product:** \`prd:bank:fx:otc-vanilla\` v1.0.1
**Author:** Owen (Company Secretary, governance)
**Date:** 2026-06-11
**Authority:** D-FX-CHAIN-CLOSURE-DISPATCH (CEO session-delegation, 2026-06-11); D-RMS-PHASE-3
**Run:** run:owen:2026-06-11T09-17-42-991Z (recovery/completion of run:owen:2026-06-11T08-44-03, which died mid-sweep)

## Headline

The FX policy estate now closes **41 of the 50** FX-scoped direct/transposed obligations.
The remaining **9** are licence-day authorisation / capital / fit-and-proper acts that **no
build-phase policy can close** — they are recorded here as reasoned licence-day deferrals,
not fabricated CLOSES edges. The 2 FSCA financial-inclusion / financial-education objectives
are dispositioned as **not-applicable** to an institutional-only FX book (retail-consumer
mandate). No genuine (c) authoring gap remains: every conduct, reporting, accounting,
confirmation, reconciliation and governance obligation in scope folds to an existing,
substantively-on-point policy.

\`recon:npa-coverage\` FX-obligation CLOSES count: **before 3/50 closed → after 41/50 closed**
(47 → 9 open). The 47→9 improvement is the sum of (i) the parser block-scalar fix, which lets
\`summary: >\`/\`summary: |\` declared CLOSES actually fold, and (ii) 33 newly-wired obligation
declarations across 11 policies.

## Substrate fix (load-bearing)

\`prototype/platform/regulatory/graph/policy-parser.ts\` previously captured \`summary: >\`
(folded) and \`summary: |\` (literal) block scalars as the empty string — silently dropping
**every** CLOSES obligation id declared inside a multi-line summary. With the fix, both block
scalars are collected (\`>\` joined with spaces, \`|\` with newlines). On pure main only 3 FX
obligations folded; with the fix + the array-form declarations already on main, 8 folded; with
the 33 new declarations, 41 fold. The fix is necessary, not cosmetic: without it the
block-scalar policies (trade-reporting, conflicts, conduct-of-business, etc.) green nothing.

## Bucket legend

- **(a) closed** — a policy in the estate carries a substantive CLOSES edge that folds in the graph.
- **(b) deferred** — licence-day act; no build-phase policy can discharge it; reasoned deferral + trigger.
- **(c) routed** — genuine authoring gap routed to the owning seat. (None remain for this product.)

## 47-row triage table (50 FX obligations; 41 a / 9 b / 0 c)

| # | Obligation | Bucket | Closing policy / deferral reason + trigger |
|---|---|---|---|
| 1 | ORG-AC-03 — IFRS 9 hedge accounting | a closed | POL-HEDGE-ACCOUNTING-V1. Pre-existing. NB per D-FX-FORWARDS-TRADING-FVTPL the FX fwd/swap book is trading-FVTPL and does **not** designate hedges; the policy addresses the *capability* to apply IFRS 9 Ch.6 where the bank elects to hedge — substantively correct, not forced. |
| 2 | ORG-AC-10 — IAS 21 effects of FX-rate changes | a closed | POL-FIN-ACCT-01 (accounting-policies-ifrs). **[recovered edge]** Directly on-point (FX translation/remeasurement). |
| 3 | ORG-CS1-001 — operational capital sufficiency for ODP | **b deferred** | Licence-application demonstration of capital adequacy for the ODP business. Trigger: FSCA ODP authorisation application (licence-day). No policy can self-attest capital sufficiency. |
| 4 | ORG-CS1-002 — fit-and-proper (senior mgmt, controlling body, KI) | a closed | POL-fit-and-proper-policy. Pre-existing. |
| 5 | ORG-CS1-003 — risk-management framework (board-approved) | a closed | POL-GOV-FRAMEWORK-01 (governance-framework). **[recovered edge]** |
| 6 | ORG-CS1-004 — IT / operational-capacity demonstration | **b deferred** | Licence-application operational-capacity demonstration. Trigger: FSCA ODP authorisation application (licence-day). Build-phase substrate is the evidence, not a policy. |
| 7 | ORG-CS2-001 — 169-element trade-reporting schema (EMIR-aligned) | a closed | POL-trade-reporting-policy. Pre-existing. Schema *build* (data) is a separate substrate item; the obligation to report per the schema is policy-closed. |
| 8 | ORG-CS3-001 — written trading-relationship agreement pre-trade | a closed | POL-COUNTERPARTY-ONBOARDING-V1. Pre-existing. |
| 9 | ORG-CS3-002 — timely confirmation of material terms | a closed | POL-trade-confirmation-affirmation-policy. **[recovered edge]** |
| 10 | ORG-CS3-003 — portfolio reconciliation at intervals | a closed | POL-reconciliation-break-management-policy. **[recovered edge]** |
| 11 | ORG-CS3-004 — dispute-resolution procedures pre-trade | a closed | POL-trade-confirmation-affirmation-policy. **[recovered edge]** |
| 12 | ORG-CS3-005 — client/counterparty categorisation + DD | a closed | POL-COUNTERPARTY-ONBOARDING-V1. **[recovered edge]** |
| 13 | ORG-CS3-006 — daily valuation; agreed methodology | a closed | POL-HEDGE-ACCOUNTING-V1 \\| POL-VALUATION-POLICY-V1 \\| POL-PRICING-POLICY-V1. Pre-existing. |
| 14 | ORG-CS3-007 — conflicts-of-interest mgmt on OTC dealing | a closed | POL-COI-POL-01 (conflicts-of-interest). **[recovered edge]** |
| 15 | ORG-CS3-008 — complaints handling | a closed | POL-complaints-handling-policy. **[recovered edge]** |
| 16 | ORG-CS3-009 — record-keeping ≥5y, tamper-evident | a closed | POL-RMP-001 (records management). **[recovered edge]** |
| 17 | ORG-FMA-001 — obtain FSCA ODP authorisation (FMA s.6A) | **b deferred** | Licence-application act. Trigger: FSCA ODP authorisation application (licence-day). A policy cannot grant itself authorisation. |
| 18 | ORG-FMA-002 — holding-out / unauthorised-ODP is an offence (FMA s.109) | **b deferred** | Statutory prohibition discharged only by *being authorised*; no build-phase policy closes it. Trigger: FSCA ODP authorisation (licence-day). Until then the bank does not transact as an authorised ODP with clients. |
| 19 | ORG-FMA-003 — report OTC-derivative transactions to a TR | a closed | POL-trade-reporting-policy. Pre-existing. |
| 20 | ORG-MK-01 — market-abuse prohibitions (FMA Ch.X) | a closed | POL-trading-mandate \\| POL-insider-trading-pa-dealing-policy. Pre-existing. |
| 21 | ORG-MK-02 — best execution (FMA / CS) | a closed | POL-COND-TCF-01 (conduct-of-business-tcf). **[recovered edge]** |
| 22 | ORG-MK-03 — record voice/electronic comms of trading personnel | a closed | POL-conduct-risk-policy. **[recovered edge]** |
| 23 | ORG-MK-05 — handle inside information per policy | a closed | POL-insider-trading-pa-dealing-policy. Pre-existing. |
| 24 | ORG-MK-14 — FSCA CS 3/2018 §§3-9 conduct dimension | a closed | POL-COND-TCF-01. **[recovered edge]** |
| 25 | ORG-MK-RPT-001 — JN 2/2024 margin-metrics reporting | a closed | POL-trade-reporting-policy. **[recovered edge]** |
| 26 | ORG-MK-RPT-002 — submit return to PA via Umoja | a closed | POL-trade-reporting-policy. **[recovered edge]** |
| 27 | ORG-MK-RPT-003 — populate/transmit reporting metrics | a closed | POL-trade-reporting-policy. **[recovered edge]** |
| 28 | ORG-ODP-AUTH-001 — capital/reserves proportional to ODP risk | **b deferred** | Licence-application capital condition. Trigger: FSCA ODP authorisation (licence-day) + real capital raise. |
| 29 | ORG-ODP-AUTH-002 — controlling-body/senior-mgr honesty & integrity | **b deferred** | Licence-application fit-and-proper attestation over *real* human appointees. Trigger: licence-day human appointments (statutory minimum). |
| 30 | ORG-ODP-AUTH-003 — controlling-body/senior-mgr competency | **b deferred** | Licence-application competency demonstration over real appointees. Trigger: licence-day human appointments. |
| 31 | ORG-ODP-AUTH-004 — operational ability incl. SA business address | **b deferred** | Licence-application operational-ability demonstration (fixed SA address, resources). Trigger: FSCA ODP authorisation (licence-day). |
| 32 | ORG-ODP-AUTH-005 — solvency (not in liquidation/business-rescue) | **b deferred** | Continuous solvency condition assessed at and after authorisation. Trigger: FSCA ODP authorisation (licence-day) + ongoing prudential monitoring. |
| 33 | ORG-ODP-AUTH-006 — organise/control affairs responsibly | a closed | POL-GOV-FRAMEWORK-01. **[recovered edge]** |
| 34 | ORG-ODP-COND-001 — honest, fair, due-skill conduct | a closed | POL-COND-TCF-01. **[recovered edge]** |
| 35 | ORG-ODP-COND-002 — counterparty/client categorisation | a closed | POL-COND-TCF-01 \\| POL-COUNTERPARTY-ONBOARDING-V1. **[recovered edge]** |
| 36 | ORG-ODP-COND-003 — client suitability information | a closed | POL-COND-TCF-01. **[recovered edge]** |
| 37 | ORG-ODP-COND-004 — fair, plain-language client representations | a closed | POL-COND-TCF-01. **[recovered edge]** |
| 38 | ORG-ODP-COND-005 — written/electronic client agreement | a closed | POL-COUNTERPARTY-ONBOARDING-V1. **[recovered edge]** |
| 39 | ORG-ODP-COND-006 — best-efforts confirmation of every trade | a closed | POL-trade-confirmation-affirmation-policy. **[recovered edge]** |
| 40 | ORG-ODP-COND-007 — agree portfolio-reconciliation in writing | a closed | POL-reconciliation-break-management-policy. **[recovered edge]** |
| 41 | ORG-ODP-COND-008 — written dispute id/resolution procedures | a closed | POL-trade-confirmation-affirmation-policy. **[recovered edge]** |
| 42 | ORG-ODP-COND-009 — written portfolio-compression analysis | a closed | POL-reconciliation-break-management-policy. **[recovered edge]** |
| 43 | ORG-ODP-COND-010 — utmost good faith on client collateral | a closed | POL-COND-TCF-01. **[recovered edge]** |
| 44 | ORG-ODP-COND-011 — intermediary FAIS-licensing & disclosure | a closed | POL-COND-TCF-01. **[recovered edge]** |
| 45 | ORG-ODP-COND-012 — client confidentiality | a closed | POL-COND-TCF-01. **[recovered edge]** |
| 46 | ORG-ODP-RPT-001 — report each executed/modified/terminated trade | a closed | POL-trade-reporting-policy. **[recovered edge]** |
| 47 | ORG-ODP-RPT-002 — CCP bears reporting where cleared | a closed | POL-trade-reporting-policy. **[recovered edge]** |
| 48 | ORG-ODP-RPT-003 — report by end of next business day | a closed | POL-trade-reporting-policy. **[recovered edge]** |
| 49 | ORG-ODP-RPT-004 — per-trade TR report fields | a closed | POL-trade-reporting-policy. **[recovered edge]** |
| 50 | ORG-ODP-RPT-005 — additional TR report fields | a closed | POL-trade-reporting-policy. **[recovered edge]** |

(The table is 50 rows — the full FX-scoped obligation set. "47-row sweep" in the dispatch
refers to the 47 obligations open at run-start; 3 were already closed on main.)

### Bucket tally

- **(a) closed:** 41 — all fold and were spot-checked substantively on-point.
- **(b) deferred (licence-day):** 9 — FMA-001, FMA-002, CS1-001, CS1-004, ODP-AUTH-001..005.
- **(c) routed:** 0 — no genuine build-phase authoring gap remains for this product.

### Recovered-edge verification

33 obligation CLOSES declarations were added across 11 policies (the recovered work):
ODP-COND-001..012, ODP-COND (005/006 via onboarding & confirmation), ODP-RPT-001..005,
CS3-002/003/004/005/007/008/009, MK-RPT-001..003, MK-02/03/14, AC-10, CS1-003, ODP-AUTH-006.
**33/33 verified folded** in the home graph.db after \`graph:seed\`; zero needed a fix
(no wrong ORG-* id form, no summary-not-captured, no node-key mismatch). The
\`obligationPolicyEdges.skippedMissingNode\` counter was 0 — confirming every declared id
resolves to a real Obligation node.

## FSCA objective dispositions (2)

| Objective | Disposition | Reasoning |
|---|---|---|
| OBJ-FSCA-FINANCIAL-INCLUSION (FSR Act 9/2017 s.57(a)) — "promote financial inclusion … access to appropriate financial products for financial customers and potential financial customers" | **Not applicable — no ALIGNS_TO forced** | Retail-consumer access mandate. The OTC Vanilla FX book is institutional-only (eligible counterparties / professional clients); the bank holds no retail customers in the build phase and this product never will. Forcing an ALIGNS_TO edge would misrepresent the policy estate's purpose-coverage. |
| OBJ-FSCA-FINANCIAL-EDUCATION (FSR Act 9/2017 s.57(a)) — "financial education programmes … promote financial literacy and the ability to make sound financial decisions" | **Not applicable — no ALIGNS_TO forced** | Consumer financial-literacy mandate. No retail counterparties; institutional counterparties are sophisticated by FMA/FAIS classification. No bank policy genuinely pursues financial-education delivery for this product, and inventing one would be a thin placeholder. |

Both objectives remain visible as advisory \`(a) reg-horizon … purpose-coverage gap\` INFO
lines in \`recon:npa-coverage\` — correct: they are real FSCA objectives, simply outside this
product's applicability. They will gain ALIGNS_TO edges if/when the bank stands up a
retail-facing product line (licence-day+), not before.

## Residual & follow-on

- 9 licence-day (b) deferrals are tracked here; they re-open as live work at the FSCA ODP
  authorisation moment. No CLOSES edge is fabricated to green the recon.
- No (c) authoring follow-on routed: the conduct/reporting/accounting/confirmation/
  reconciliation/governance estate is complete for \`prd:bank:fx:otc-vanilla\`.
- The parser block-scalar fix benefits the whole estate (any policy declaring CLOSES in a
  \`summary:\` block now folds), not just FX — a general substrate improvement.
`;

const result = recordFiled(
  {
    recordId: "record:documents:owen:fx-chain-closure-triage:2026-06-11",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-FX-CHAIN-CLOSURE-DISPATCH", "D-RMS-PHASE-3", "D-FX-FORWARDS-TRADING-FVTPL"],
    actor: {
      type: "service",
      id: "agent:owen:company-secretary",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "OTC Vanilla FX — regulatory chain-closure triage (47-obligation sweep)",
      path: "2026-06-11_owen_fx-chain-closure-triage.md",
      category: "governance-chain-closure",
      author: "Owen (Company Secretary, governance)",
      date: "2026-06-11",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
