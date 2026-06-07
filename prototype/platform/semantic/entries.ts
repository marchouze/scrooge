// platform/semantic/entries.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 1 — three worked semantic-
// layer entries. Per pack §6 Slice 1 exit criterion: `Balance`,
// `Exposure`, and `CashAndBalancesAtSARB` must register, resolve, and
// pass citation coverage; together they exercise the registry's three
// dimensional patterns:
//
//   Balance                 — multi-account, multi-currency, multi-entity;
//                             classification-aware. The base quantity that
//                             every BA-return cell and every AFS line
//                             ultimately decomposes into.
//
//   Exposure                — multi-counterparty, multi-kind. Drives the
//                             counterparty-credit-risk + concentration
//                             returns (BA 410, BA 600).
//
//   CashAndBalancesAtSARB   — single worked example pinned to the
//                             populated chart-of-accounts row
//                             (`ACC-1100-001`). Demonstrates the full
//                             upward chain: account → IFRS 9 amortised-
//                             cost classification → IAS 1 SoFP line → BA
//                             325 HQLA Level-1 cell → ORG-PR-06 + ORG-AC-
//                             01 obligations-register anchors.
//
// All three entries scope to the three legal entities (`urn:legal-
// entity:hoz:hoz-{group|bank|securities}:v1`) where applicable; per pack
// §2.1, returns are produced per-entity then rolled up to consolidated
// via the consolidation projection (Slice 6/7 substrate, not built here).
//
// Author: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)
// Reviewer: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO)

import type { SemanticEntry } from "./types";

const HOZ_GROUP = "urn:legal-entity:hoz:hoz-group:v1";
const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";
const HOZ_SECURITIES = "urn:legal-entity:hoz:hoz-securities:v1";
const ALL_ENTITIES = [HOZ_GROUP, HOZ_BANK, HOZ_SECURITIES] as const;

const FIRST_AUTHORED = "2026-05-10T00:00:00.000Z";

/**
 * `Balance` — the base monetary balance of a GL account, sliced by the
 * account's chart-of-accounts mapping, currency, IFRS classification,
 * and entity. The quantity every other money-units entry decomposes
 * into.
 *
 * Computation source: M1 sub-ledger projection
 * (`prototype/platform/projections/markets/sub-ledger.ts`) materialises
 * typed posting candidates per equity event; the M2 GL projection (Slice
 * 4 of `D-EVENT-STORE-SCALING` consumer adoption / pack §3.1) consumes
 * those postings and folds them into per-account balances. `Balance`
 * resolves against the GL projection state.
 */
export const balance: SemanticEntry = {
  id: "Balance",
  version: "v0.1",
  description:
    "Money-units balance of a GL account, sliced by entity, currency, IFRS classification, and as-of date. Base quantity every BA-return cell and AFS line decomposes into.",
  units: "money-minor",
  dimensions: ["currency", "account", "ifrsClassification"],
  projection: "gl-projection",
  formula:
    "sum(SubLedgerPostingEmitted.cashAmountMinor where {entity, account, currency, ifrsClassification, asOf <= asOfQuery})",
  ifrsLines: [
    {
      statement: "SoFP",
      line: "(line per chart-of-accounts.baReturnLines / categorisation)",
      side: "positive",
      note: "Sign per natural-balance side of the underlying account.",
    },
  ],
  citations: [
    { type: "ifrs", ifrsRef: "IAS 1 §54", note: "SoFP line composition." },
    {
      type: "ifrs",
      ifrsRef: "IFRS 9 §4.1",
      note: "Classification (amortised-cost / FVOCI / FVTPL) drives the dimension.",
    },
    {
      type: "regulation",
      regulationId: "ORG-AC-01",
      note: "IFRS 9 classification at recognition.",
    },
    {
      type: "regulation",
      regulationId: "ORG-AC-08",
      note: "IAS 1 financial-statements presentation.",
    },
    {
      type: "policy",
      policyRef: "Accounting Policies (IFRS) v0.1 (STUB)",
      section: "§1 Recognition + §2 Classification",
      note: "Stub at Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md.",
    },
  ],
  signers: ["Bea", "Camille"],
  entityScope: [...ALL_ENTITIES],
  ifrsClassifications: [
    "amortised-cost",
    "fvoci-debt",
    "fvoci-equity",
    "fvtpl",
    "non-financial",
    "equity",
  ],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Balance is dimensionally the most general entry; downstream entries (CashAndBalancesAtSARB, RWA components, capital-stack tiers) compose Balance with additional dimensional filters. The GL projection that backs it is built by the Slice 2 (period-close) + Slice 4 (M2) consumer-adoption work.",
};

/**
 * `Exposure` — counterparty-level exposure measure sliced by exposure
 * kind (loan, deposit, derivative, repo). Drives BA 600 (counterparty
 * credit risk + CVA), BA 410 (credit-risk concentration), and the
 * large-exposures regime (Reg 24(6)–(8) + Directive 3 of 2022), which is
 * reported within the BA 200-series credit-risk return family — NOT BA 330
 * (BA 330 is the IRRBB repricing-gap return). See
 * Regulations/SARB-PA/large-exposures.md; D-BA-330-REATTRIBUTION-IRRBB.
 *
 * Computation source: M2 GL projection joined to counterparty master
 * data via the `counterparty` dimension; for derivatives, the projection
 * uses the post-CSA (variation-margin-net) exposure. The semantic-layer
 * entry stores the *definition*; the projection that backs it lands in
 * pack Slice 4-6.
 */
export const exposure: SemanticEntry = {
  id: "Exposure",
  version: "v0.1",
  description:
    "Counterparty-level exposure in money units, sliced by counterparty, exposure kind, currency, and as-of date. Base quantity for counterparty-credit-risk, large-exposures, and concentration returns.",
  units: "money-minor",
  dimensions: ["counterparty", "exposureKind", "currency"],
  projection: "exposure-projection",
  formula:
    "sum(SubLedgerPostingEmitted.cashAmountMinor where {entity, counterparty, exposureKind, currency, asOf <= asOfQuery}) + add-on(derivatives, post-CSA-net)",
  regulatoryCells: [
    {
      form: "BA 410",
      line: "Credit-risk concentration — counterparty exposure (memo)",
      side: "memo",
      note: "Drives concentration computation; cell-mapping refined when Mira's BA 410 line definitions land.",
    },
    {
      form: "BA 600",
      line: "Counterparty credit risk — exposure at default (memo)",
      side: "memo",
      note: "Pre-CVA exposure component; CVA-add-on lives in a separate semantic entry (Slice 4).",
    },
    {
      form: "BA 200-series [form TBC — verify]",
      line: "Large exposures — single-name counterparty (memo)",
      side: "memo",
      note: "Large-exposures regime (Reg 24(6)–(8) + D3/2022) reported via the BA 200-series credit-risk return family; the exact form/line is counsel-gated (Imani + external counsel at the licence gate). Corrected from the prior BA 330 attribution — BA 330 is the IRRBB return (D-BA-330-REATTRIBUTION-IRRBB). Consolidated-supervision basis per Banks Act § 60.",
    },
  ],
  citations: [
    {
      type: "regulation",
      regulationId: "ORG-PR-09",
      note: "BCBS Large Exposures framework — single-name large exposure cap (SA: Reg 24(6)–(8) + D3/2022, BA 200-series). NB: not BA 330 (IRRBB) — see D-BA-330-REATTRIBUTION-IRRBB.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's instrument analyses / WS-INSTRUMENT-ANALYSES — exact BA 600 + BA 410 line definitions pending]",
    },
  ],
  signers: ["Helena", "Bea"],
  entityScope: [HOZ_BANK, HOZ_GROUP],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Pack §9 Q1 default applied — entry carries one resolved citation (ORG-PR-09) plus a TBC placeholder pending Mira's instrument analyses. Recon pipeline tracks placeholder density at registry level.",
};

/**
 * `CashAndBalancesAtSARB` — pinned to chart-of-accounts row
 * `ACC-1100-001` (Cash and balances at SARB — operational, ZAR). The
 * single fully-populated worked example demonstrating the full upward
 * chain from event flow → posting → account → IFRS classification →
 * AFS SoFP line → BA-return cells → obligations-register anchors.
 *
 * Hoz Bank is the only entity in scope (the SARB account is a banking-
 * licence artefact); not held by Hoz Securities or Hoz Group.
 */
export const cashAndBalancesAtSARB: SemanticEntry = {
  id: "CashAndBalancesAtSARB",
  version: "v0.1",
  description:
    "Operational cash balance held at the South African Reserve Bank by Hoz Bank Limited. Held-to-collect, SPPI, IFRS-9 amortised-cost. Feeds AFS Statement of Financial Position cash line, BA 610 cash-and-central-bank-balances, and BA 110 HQLA Level-1 (LCR).",
  units: "money-minor",
  dimensions: ["currency", "account"],
  projection: "gl-projection",
  formula:
    "Balance(account=ACC-1100-001, entity=urn:legal-entity:hoz:hoz-bank:v1, currency=ZAR, asOf=asOfQuery)",
  regulatoryCells: [
    {
      form: "BA 610",
      line: "Cash and balances at central bank (Item 1)",
      side: "positive",
      note: "Primary line for SARB operational balance.",
    },
    {
      form: "BA 110",
      line: "HQLA Level 1 — central-bank reserves (LCR)",
      side: "positive",
      note: "LCR HQLA contribution per BCBS D295 / BA 110; canonical first-end-to-end return per pack §6 Slice 3.",
    },
    {
      form: "BA 600",
      line: "Total qualifying capital and reserve funds — supporting cash element (memo)",
      side: "memo",
      note: "Operational cash; not a capital component itself.",
    },
  ],
  ifrsLines: [
    {
      statement: "SoFP",
      line: "Cash and balances at SARB",
      side: "positive",
      note: "IAS 1 §54(i) separately presented cash and equivalents.",
    },
  ],
  citations: [
    {
      type: "ifrs",
      ifrsRef: "IFRS 9 §4.1.2",
      note: "Amortised-cost classification (held-to-collect, SPPI cash flows).",
    },
    {
      type: "ifrs",
      ifrsRef: "IAS 1 §54(i)",
      note: "Separate balance-sheet line for cash and cash equivalents.",
    },
    {
      type: "regulation",
      regulationId: "ORG-AC-01",
      note: "IFRS 9 classification at recognition.",
    },
    { type: "regulation", regulationId: "ORG-AC-13", note: "BA-return submission obligation." },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D295 / BA 110 — LCR HQLA composition (central-bank reserves rank as Level 1).",
    },
    {
      type: "policy",
      policyRef: "Accounting Policies (IFRS) v0.1 (STUB)",
      section: "§2 Cash and equivalents",
      note: "Stub at Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md.",
    },
  ],
  signers: ["Bea", "Camille", "Eitan"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["amortised-cost"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Worked example pinned to the only fully-populated chart-of-accounts row at v0. Demonstrates full upward chain (P6) and full citation discipline (P2) — no TBC placeholders. Hoz Bank only — Hoz Securities + Hoz Group do not hold SARB operational accounts.",
};

/**
 * Slice-1 worked entries, exported as a single array for ease of
 * registry construction in tests and downstream consumers.
 */
export const SLICE_1_ENTRIES: readonly SemanticEntry[] = [
  balance,
  exposure,
  cashAndBalancesAtSARB,
] as const;
