// platform/forward-obligations/seed.ts
//
// Static seed of representative upcoming forward obligations for the bank.
// Base date: 2026-05-12 (today in agent-time). The seed is the baseline
// projection layer; ForwardObligationRegistered / ForwardObligationFulfilled
// events from the event store can add or update entries at projection time.
//
// Seed entries cover:
//   - BA325 daily SARB prudential returns (next 5 business days)
//   - BA700 monthly capital-adequacy return (end-May 2026)
//   - BA610 quarterly large-exposure return (end-June 2026)
//   - Annual financial statements (IFRS; due 2027-02-28)
//   - FX spot settlement USD 5m (scenario:06-fx-spot-trade T+2)
//   - POPIA annual privacy report (due 2026-05-31)
//   - SARB AML/CFT supervisory report (due 2026-06-30)
//   - FIC annual compliance report (due 2026-07-31)
//   - Companies Act annual return (due 2026-11-30)
//   - FATCA / CRS annual report (SARS; due 2026-09-30)
//
// Authority chain (Principle 2 upward):
//   D-MARKETS-SCHEMA-FOUNDATION — schema-foundation authority
//   TRADING-MANDATE-V1 (PR #256) — trade-settlement obligations
//   P1-EVENTS-ARE-TRUTH — seed is baseline; events are canonical
//   ORG-MK-10 — BA returns obligation in the obligations register
//
// Author: Atlas (Core banking platform architect, engineering)

import type { ForwardObligation } from "./types";

const BASE_CITATIONS = [
  "D-MARKETS-SCHEMA-FOUNDATION",
  "TRADING-MANDATE-V1",
  "P1-EVENTS-ARE-TRUTH",
  "ORG-MK-10",
];

const BA325_CITATIONS = [...BASE_CITATIONS, "BA-FORM-325", "BANKS-ACT-94-1990-REG-31"];
const BA700_CITATIONS = [...BASE_CITATIONS, "BA-FORM-700", "BANKS-ACT-94-1990-REG-25"];
const BA610_CITATIONS = [...BASE_CITATIONS, "BA-FORM-610", "BANKS-ACT-94-1990-REG-40"];
const STATUTORY_CITATIONS = [...BASE_CITATIONS, "COMPANIES-ACT-71-2008", "IFRS-IAS-1"];
const POPIA_CITATIONS = [...BASE_CITATIONS, "POPIA-ACT-4-2013", "ORG-PR-01"];
const SETTLEMENT_CITATIONS = [...BASE_CITATIONS, "TRADING-MANDATE-V1", "JSE-EQUITIES-RULES"];
const AML_CITATIONS = [...BASE_CITATIONS, "FIC-ACT-38-2001", "SARB-GUIDANCE-NOTE-5"];
const FIC_CITATIONS = [...BASE_CITATIONS, "FIC-ACT-38-2001", "ORG-AML-01"];
const FATCA_CITATIONS = [...BASE_CITATIONS, "FATCA-IGA-SA", "TAX-ADMIN-ACT-28-2011"];

export function getSeedObligations(): ForwardObligation[] {
  return [
    // -----------------------------------------------------------------------
    // BA325 — daily SARB prudential return (next 5 business days from
    // 2026-05-12). Submitted by Bea (Chief Accounting Officer, engineering).
    // Recurrence: daily-business.
    // -----------------------------------------------------------------------
    {
      id: "fwd:ba325:2026-05-13",
      kind: "regulatory-filing",
      description: "BA325 daily liquidity-return submission to SARB Prudential Authority",
      dueDate: "2026-05-13",
      recurrence: "daily-business",
      obligationSourceId: "ORG-MK-10",
      responsibleAgent: "agent:bea",
      status: "pending",
      citations: BA325_CITATIONS,
      notes: "Regulation 31 — daily data submission to PA via SARB FinSurv portal",
    },
    {
      id: "fwd:ba325:2026-05-14",
      kind: "regulatory-filing",
      description: "BA325 daily liquidity-return submission to SARB Prudential Authority",
      dueDate: "2026-05-14",
      recurrence: "daily-business",
      obligationSourceId: "ORG-MK-10",
      responsibleAgent: "agent:bea",
      status: "pending",
      citations: BA325_CITATIONS,
    },
    {
      id: "fwd:ba325:2026-05-15",
      kind: "regulatory-filing",
      description: "BA325 daily liquidity-return submission to SARB Prudential Authority",
      dueDate: "2026-05-15",
      recurrence: "daily-business",
      obligationSourceId: "ORG-MK-10",
      responsibleAgent: "agent:bea",
      status: "pending",
      citations: BA325_CITATIONS,
    },
    {
      id: "fwd:ba325:2026-05-16",
      kind: "regulatory-filing",
      description: "BA325 daily liquidity-return submission to SARB Prudential Authority",
      dueDate: "2026-05-16",
      recurrence: "daily-business",
      obligationSourceId: "ORG-MK-10",
      responsibleAgent: "agent:bea",
      status: "pending",
      citations: BA325_CITATIONS,
    },
    {
      id: "fwd:ba325:2026-05-19",
      kind: "regulatory-filing",
      description: "BA325 daily liquidity-return submission to SARB Prudential Authority",
      dueDate: "2026-05-19",
      recurrence: "daily-business",
      obligationSourceId: "ORG-MK-10",
      responsibleAgent: "agent:bea",
      status: "pending",
      citations: BA325_CITATIONS,
      notes: "Monday; skips weekend (2026-05-16 is Friday)",
    },

    // -----------------------------------------------------------------------
    // BA700 — monthly capital-adequacy return (end of May 2026).
    // Submitted by Camille (Chief Financial Officer, governance).
    // Recurrence: monthly.
    // -----------------------------------------------------------------------
    {
      id: "fwd:ba700:2026-05-31",
      kind: "regulatory-filing",
      description: "BA700 monthly capital-adequacy return (capital and leverage)",
      dueDate: "2026-05-31",
      recurrence: "monthly",
      obligationSourceId: "ORG-MK-10",
      responsibleAgent: "agent:camille",
      status: "pending",
      citations: BA700_CITATIONS,
      notes: "Regulation 25 — due by last business day of the month",
    },

    // -----------------------------------------------------------------------
    // BA610 — quarterly large-exposures return (Q2 2026 end).
    // Submitted by Camille (Chief Financial Officer, governance).
    // Recurrence: quarterly.
    // -----------------------------------------------------------------------
    {
      id: "fwd:ba610:2026-06-30",
      kind: "regulatory-filing",
      description: "BA610 quarterly large-exposures return to SARB Prudential Authority",
      dueDate: "2026-06-30",
      recurrence: "quarterly",
      obligationSourceId: "ORG-MK-10",
      responsibleAgent: "agent:camille",
      status: "pending",
      citations: BA610_CITATIONS,
      notes: "Regulation 40 — 20 business days after end of quarter",
    },

    // -----------------------------------------------------------------------
    // Annual financial statements — IFRS / Companies Act (due 2027-02-28;
    // 6 months after 2026-08-31 year end).
    // Submitted by Camille (Chief Financial Officer, governance).
    // Recurrence: annual.
    // -----------------------------------------------------------------------
    {
      id: "fwd:annual-fin-statements:2027-02-28",
      kind: "corporate-statutory",
      description: "Annual financial statements (IFRS-aligned; Companies Act s. 29)",
      dueDate: "2027-02-28",
      recurrence: "annual",
      responsibleAgent: "agent:camille",
      status: "pending",
      citations: STATUTORY_CITATIONS,
      notes:
        "Due within 6 months of the financial year end (31 August); external-auditor sign-off required",
    },

    // -----------------------------------------------------------------------
    // FX spot settlement USD 5m — T+2 from scenario:06-fx-spot-trade.
    // Executed 2026-05-12; settlement due 2026-05-14.
    // Submitted by Tomas (Payments / cash management engineer, engineering).
    // One-off.
    // -----------------------------------------------------------------------
    {
      id: "fwd:fx-spot-settlement:2026-05-14",
      kind: "trade-settlement",
      description: "FX spot settlement — USD 5m vs ZAR (T+2 from 2026-05-12 execution)",
      dueDate: "2026-05-14",
      tradeRef: "scenario:06-fx-spot-trade",
      responsibleAgent: "agent:tomas",
      status: "pending",
      citations: SETTLEMENT_CITATIONS,
      notes: "CLS/SWIFT settlement via sponsor bank; counterparty: CP-BARC-ZA-001",
    },

    // -----------------------------------------------------------------------
    // POPIA annual privacy report — due 2026-05-31.
    // Submitted by Iris (Information Officer / POPIA lead, governance).
    // Recurrence: annual.
    // -----------------------------------------------------------------------
    {
      id: "fwd:popia-annual-report:2026-05-31",
      kind: "corporate-statutory",
      description: "POPIA annual privacy report to Information Regulator",
      dueDate: "2026-05-31",
      recurrence: "annual",
      obligationSourceId: "ORG-PR-01",
      responsibleAgent: "agent:iris",
      status: "pending",
      citations: POPIA_CITATIONS,
      notes: "POPIA s. 55 — annual report on personal information processing activities",
    },

    // -----------------------------------------------------------------------
    // SARB AML/CFT supervisory report — due 2026-06-30.
    // Submitted by Zara (MLRO / AML-CFT lead, governance).
    // Recurrence: annual.
    // -----------------------------------------------------------------------
    {
      id: "fwd:sarb-aml-report:2026-06-30",
      kind: "regulatory-filing",
      description: "SARB AML/CFT annual supervisory report (FIC Act s. 42B)",
      dueDate: "2026-06-30",
      recurrence: "annual",
      obligationSourceId: "ORG-AML-01",
      responsibleAgent: "agent:zara",
      status: "pending",
      citations: AML_CITATIONS,
      notes: "Covers suspicious transaction reporting statistics and AML/CFT programme assessment",
    },

    // -----------------------------------------------------------------------
    // FIC annual compliance report — due 2026-07-31.
    // Submitted by Zara (MLRO / AML-CFT lead, governance).
    // Recurrence: annual.
    // -----------------------------------------------------------------------
    {
      id: "fwd:fic-compliance-report:2026-07-31",
      kind: "regulatory-filing",
      description: "FIC annual compliance report (FIC Act s. 42 — accountable institution)",
      dueDate: "2026-07-31",
      recurrence: "annual",
      obligationSourceId: "ORG-AML-01",
      responsibleAgent: "agent:zara",
      status: "pending",
      citations: FIC_CITATIONS,
      notes:
        "Accountable institution annual compliance report to FIC; STR / CTR summaries included",
    },

    // -----------------------------------------------------------------------
    // FATCA / CRS annual report to SARS — due 2026-09-30.
    // Submitted by Yael (Tax / FATCA-CRS engineer, engineering).
    // Recurrence: annual.
    // -----------------------------------------------------------------------
    {
      id: "fwd:fatca-crs-report:2026-09-30",
      kind: "regulatory-filing",
      description: "FATCA / CRS annual reporting to SARS (Tax Administration Act s. 26)",
      dueDate: "2026-09-30",
      recurrence: "annual",
      responsibleAgent: "agent:yael",
      status: "pending",
      citations: FATCA_CITATIONS,
      notes: "Applies from commencement-of-trading; build-phase preparation only",
    },

    // -----------------------------------------------------------------------
    // Companies Act annual return to CIPC — due 2026-11-30.
    // Submitted by Owen (Company Secretary, governance).
    // Recurrence: annual.
    // -----------------------------------------------------------------------
    {
      id: "fwd:cipc-annual-return:2026-11-30",
      kind: "corporate-statutory",
      description: "Annual return to CIPC (Companies Act 71 of 2008 s. 33)",
      dueDate: "2026-11-30",
      recurrence: "annual",
      responsibleAgent: "agent:owen",
      status: "pending",
      citations: STATUTORY_CITATIONS,
      notes:
        "Due within 30 business days after the anniversary of the company's incorporation date",
    },
  ];
}
