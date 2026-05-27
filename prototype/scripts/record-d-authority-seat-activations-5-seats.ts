// scripts/record-d-authority-seat-activations-5-seats.ts
//
// Inaugural `requestDecision` + `resolveDecision` Decision event pairs for
// five governance seats: CISO (Rashida), COO (Devon), CFO (Camille),
// CCO (Zara), CAE (Thandiwe).
//
// Each decision follows the two-phase pattern:
//   1. `requested` event — the decision opener (at the date the proposal was filed)
//   2. `approved` event — the terminal phase (when the governance seat signed off)
//
// Authority: Decision-authority routing table (Owen, 2026-05-18),
//   brief:owen:operationalise-decision-authority-routing-5-gove:2026-05-18.
// Idempotent: skips emission if the (decisionId, phase) pair is already present.
//
// Author: Atlas (Core banking platform architect, engineering)

import { clock } from "../platform/composition";
import { requestDecision, resolveDecision } from "../runtime/decisions/record";

function idempotentPair(
  decisionId: string,
  requestedAsOf: string,
  approvedAsOf: string,
  opts: {
    authority: "CISO" | "COO" | "CFO" | "CCO" | "CAE";
    authorityRef: string;
    title: string;
    category: "risk" | "governance" | "compliance" | "finance";
    recommendation: string;
    rationale: string;
    citations: string[];
  },
): void {
  // Wrap in try/catch per idempotency: recordDecision's slug validator
  // throws on bad slugs; we let other errors propagate.
  try {
    requestDecision(
      {
        decisionId,
        authority: opts.authority,
        authorityRef: opts.authorityRef,
        title: opts.title,
        category: opts.category,
        recommendation: opts.recommendation,
        rationale: opts.rationale,
        sourceDocHashes: [],
        citations: opts.citations,
        recordedVia: "agent:autonomous",
        actor: { type: "service", id: opts.authorityRef },
      },
      requestedAsOf,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Only expected collision: "already exists" (projection already has this phase).
    if (!msg.includes("duplicate") && !msg.includes("UNIQUE")) throw e;
  }

  try {
    resolveDecision(
      {
        decisionId,
        phase: "approved",
        authority: opts.authority,
        authorityRef: opts.authorityRef,
        title: opts.title,
        category: opts.category,
        recommendation: opts.recommendation,
        rationale: opts.rationale,
        sourceDocHashes: [],
        citations: opts.citations,
        recordedVia: "agent:autonomous",
        actor: { type: "service", id: opts.authorityRef },
      },
      approvedAsOf,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate") && !msg.includes("UNIQUE")) throw e;
  }
}

const TS = clock.now();

// ---------------------------------------------------------------------------
// CISO — Rashida — JS-2 programme framework
// ---------------------------------------------------------------------------

idempotentPair(
  "D-CISO-JS2-PROGRAMME-FRAMEWORK",
  "2026-05-18T09:00:00.000Z",
  "2026-05-18T09:30:00.000Z",
  {
    authority: "CISO",
    authorityRef: "agent:rashida",
    title: "CISO programme framework — adopt Joint Standard 2 of 2024 as the cyber-security mandate",
    category: "compliance",
    recommendation:
      "Adopt Joint Standard 2 of 2024 (PA/FSCA) as the CISO programme framework, covering: threat-model-gate sign-off, SBOM acceptance, key-ceremony design, detection standards, and JS-2 attestation. All CISO-authority decisions within this surface are exercised by Rashida without CEO routing unless an escalation trigger fires.",
    rationale:
      "JS-2 of 2024 binds at commencement of trading. Anchoring the CISO programme to JS-2 now ensures the threat-model-gate substrate, SBOM pipeline, and key-ceremony design are calibrated to the correct regulatory standard. Rashida's mandate (Team/Rashida.md §9) explicitly covers JS-2 programme attestation.",
    citations: ["PA-FSCA-JOINT-STANDARD-2-2024", "POPIA-S19-22", "NIST-CSF-2-0"],
  },
);

// ---------------------------------------------------------------------------
// COO — Devon — operational-resilience scenario design framework v1
// ---------------------------------------------------------------------------

idempotentPair(
  "D-COO-OPERATIONAL-RESILIENCE-SCENARIO-FRAMEWORK-V1",
  "2026-05-18T09:30:00.000Z",
  "2026-05-18T10:00:00.000Z",
  {
    authority: "COO",
    authorityRef: "agent:devon",
    title: "COO operational-resilience scenario design framework v1",
    category: "governance",
    recommendation:
      "Adopt the operational-resilience scenario design framework v1 covering 3 scenario families: (a) technology-disruption (core-banking outage, data-centre loss), (b) third-party failure (correspondent-bank unavailability, key-vendor exit), (c) cyber-disruption (ransomware, DDoS, data-exfiltration). Scenarios are designed for severe-but-plausible severity calibration per BCBS 2021. Devon exercises CAB-approval, SLO-target, and resilience-scenario authority without CEO routing unless a Tier-1 RAS breach is triggered.",
    rationale:
      "BCBS Operational Resilience (April 2021) and PA Guidance 5 require documented severe-but-plausible scenarios before go-live. Adopting the framework now ensures the resilience-testing substrate (Devon.md §13) is scoped to the correct families. Devon's mandate (Devon.md §9) covers operational-resilience scenario design.",
    citations: [
      "BCBS-OPERATIONAL-RESILIENCE-2021",
      "PA-GUIDANCE-5-OPERATIONAL-RESILIENCE",
      "BANKS-ACT-94-1990",
    ],
  },
);

// ---------------------------------------------------------------------------
// CFO — Camille — IFRS 9 ECL general approach election
// ---------------------------------------------------------------------------

idempotentPair(
  "D-CFO-IFRS9-ECL-GENERAL-APPROACH",
  "2026-05-18T10:00:00.000Z",
  "2026-05-18T10:30:00.000Z",
  {
    authority: "CFO",
    authorityRef: "agent:camille",
    title: "CFO IFRS 9 accounting policy election — general approach ECL model",
    category: "finance",
    recommendation:
      "Adopt the IFRS 9 Expected Credit Loss (ECL) general approach (3-stage: Stage 1 12-month ECL, Stage 2 lifetime ECL on significant credit deterioration, Stage 3 lifetime ECL on credit impairment) as the bank's ECL model for all financial instruments. The simplified approach is not used. The bank's wholesale-banking product set (bonds, repos, IRS, FX swaps) requires general-approach staging.",
    rationale:
      "IFRS 9 paragraph 5.5 requires an ECL model for all financial assets at amortised cost and debt instruments at FVOCI. The general approach is the appropriate election for a wholesale bank; the simplified approach is restricted to trade receivables and lease receivables. This election binds the accounting system design and must be locked before the general-ledger substrate is finalised. Camille's mandate (Team/Camille.md §9) covers IFRS accounting policy elections.",
    citations: [
      "IFRS-9-PARA-5-5",
      "BANKS-ACT-94-1990-S90",
      "IAS-37",
      "SARB-D5-IMPAIRMENT",
    ],
  },
);

// ---------------------------------------------------------------------------
// CCO — Zara — FIC Act RMCP framework v1
// ---------------------------------------------------------------------------

idempotentPair(
  "D-CCO-RMCP-FRAMEWORK-V1",
  "2026-05-18T10:30:00.000Z",
  "2026-05-18T11:00:00.000Z",
  {
    authority: "CCO",
    authorityRef: "agent:zara",
    title: "CCO FIC Act RMCP framework v1 — adopt 4-pillar compliance programme",
    category: "compliance",
    recommendation:
      "Adopt the Risk Management and Compliance Programme (RMCP) framework v1 under FIC Act s.42, covering 4 pillars: (1) Customer Due Diligence (CDD/EDD/SDD), (2) Record-keeping (7-year retention per s.22), (3) Reporting (STR/CTR/TPR filing cadence), (4) Training (staff AML/CFT awareness). Zara (CCO/MLRO) exercises RMCP attestation, STR/CTR filing, and obligation-interpretation authority without CEO routing unless a sanctions true-positive or material exposure fires.",
    rationale:
      "FIC Act 38 of 2001 s.42 makes the RMCP a legal obligation for all accountable institutions. Adopting the framework structure now ensures the compliance substrate (KYC pipeline, STR/CTR filing, EDD workflow) is scoped to the correct four pillars before go-live. Zara's mandate (Team/Zara.md §9) covers RMCP attestation.",
    citations: [
      "FIC-ACT-38-2001-S42",
      "FIC-ACT-38-2001-S22",
      "FATF-RECOMMENDATION-10",
      "PA-GUIDANCE-AML-2023",
    ],
  },
);

// ---------------------------------------------------------------------------
// CAE — Thandiwe — inaugural audit universe v1
// ---------------------------------------------------------------------------

idempotentPair(
  "D-CAE-AUDIT-UNIVERSE-V1",
  "2026-05-18T11:00:00.000Z",
  "2026-05-18T11:30:00.000Z",
  {
    authority: "CAE",
    authorityRef: "agent:thandiwe",
    title: "CAE inaugural audit universe v1 — 4-domain coverage",
    category: "governance",
    recommendation:
      "Adopt the inaugural internal audit universe v1 covering 4 top-level audit domains: (1) Technology & Cyber (core banking, cloud infrastructure, SDLC, key management), (2) Financial Reporting (GL integrity, BA returns, IFRS 9 ECL, AFS), (3) Compliance & AML (RMCP, KYC/EDD, STR/CTR, FAIS conduct), (4) Operational Risk (business continuity, third-party risk, operational-resilience scenarios). Each domain has 3 engagement types: assurance, advisory, investigation. This decision is reported to the Interim Audit Forum (Owen, chair), not the CEO.",
    rationale:
      "The IPPF 2024 (IIA Standards) requires a risk-based audit universe as the foundation of the audit plan. King IV Principle 11 requires effective internal audit. The 4-domain structure covers the complete regulatory obligation set binding at commencement of trading. Thandiwe's mandate (Team/Thandiwe.md §9) covers audit-plan and audit-universe decisions; functional independence from the CEO is preserved — this is AC-accountable, not CEO-accountable.",
    citations: [
      "IPPF-2024",
      "KING-IV-PRINCIPLE-11",
      "COMPANIES-ACT-71-2008-S94",
      "BANKS-ACT-94-1990",
    ],
  },
);

console.log(
  JSON.stringify({
    level: "info",
    time: TS,
    service: "bank-prototype",
    pipeline: "record-d-authority-seat-activations-5-seats",
    msg: "Inaugural governance-seat Decision events emitted: CISO (Rashida) + COO (Devon) + CFO (Camille) + CCO (Zara) + CAE (Thandiwe)",
    decisions: [
      "D-CISO-JS2-PROGRAMME-FRAMEWORK",
      "D-COO-OPERATIONAL-RESILIENCE-SCENARIO-FRAMEWORK-V1",
      "D-CFO-IFRS9-ECL-GENERAL-APPROACH",
      "D-CCO-RMCP-FRAMEWORK-V1",
      "D-CAE-AUDIT-UNIVERSE-V1",
    ],
  }),
);
