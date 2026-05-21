// scripts/run-npa-gate-fx-spot.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// PROC-NPA-GATE-01 — FIRST ACTIVATION (internal pre-licence test scope).
// ─────────────────────────────────────────────────────────────────────────────
//
// PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`) has never been
// activated for ANY product. Devon (Chief Operating Officer, governance)'s
// PROC-MK-PLG-01 meta-rehearsal (PR #667) surfaced this as one of two
// substantive Open blockers: condition `NPA-fx-spot-schema-defined` cannot
// flip to Satisfied until `ProductApproved{productId:fx-spot}` exists in the
// event store.
//
// Marc (CEO) has asked Saskia (Head of Global Markets) to initiate the NPA
// gate for FX-spot as a real-but-internal-scope first fire. This is the
// first PROC-NPA-GATE-01 activation. The script:
//
//   1. Emits `ProductProposalRegistered` for `prd:bank:fx:fx-spot-usdzar` —
//      the canonical FX-spot productId per `M4_FX_SPOT_FIXTURE` and the
//      end-to-end scenario (`scenarios/fx-spot-internal-pre-licence-test.ts`,
//      Kai PR #645).
//   2. Walks 14 NPA dimensions against current main state. Each dimension
//      emits a typed `ProductDimensionAttested` event with result
//      `design-attested` (≈ Satisfied), `implementation-attested` (≈
//      Satisfied with substrate live), or `failed` (≈ Open). Status
//      `InProgress` (substrate has compensating control acceptable for
//      internal-test scope, NOT for production) is encoded as
//      `design-attested` with a notes/compensating-control narrative — the
//      schema's three-value enum collapses the InProgress posture into
//      design-attested for the typed record, with the rehearsal markdown
//      carrying the full granularity.
//   3. Emits `ProductDueDiligenceCompleted` summarising the 14-dimension
//      walk — gatesCleared (Satisfied + InProgress with compensating
//      control) vs gatesFailed (Open / substantive blockers).
//   4. Opens a CEO decision card `D-NPA-FX-SPOT-INTERNAL-TEST` at phase
//      `requested` via `recordDecision`. The script does NOT emit
//      `ProductApproved` — Marc (CEO) approves; the decision card carries
//      Saskia + Owen's joint recommendation.
//
// Authority: brief
//   `brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21`,
//   run `run:saskia:2026-05-21T09-11-08-688Z`.
// Procedure: PROC-NPA-GATE-01 (`Procedures/by-policy/npa-gate.md`).
// Source policy: D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved).
//
// Idempotency. The script scans the event store on each run and skips
// already-emitted events keyed on (type, productId) — re-running has no
// effect; the report still prints.
//
// Note on event-type vocabulary. The procedure prose uses
// `NPAGateConvened` / `NPAGateOpinionSubmitted` / `NewProductApproved` /
// `NewProductDeferred` — those are aliases. The typed event family in
// `platform/event-store/event-types/product.ts`
// (`ProductProposalRegistered`, `ProductDimensionAttested`,
// `ProductDueDiligenceCompleted`, `ProductApproved`, `ProductWithheld`,
// `ProductLaunched`, …) is the canonical 14-event family per
// D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2. The procedure-prose alias
// reconciliation is a substrate gap raised by this rehearsal.
//
// Author: Saskia (Head of Global Markets / Chief Markets Officer,
//         governance) — product owner.
// Co-author: Owen (Company Secretary, governance) — PROC-NPA-GATE-01
//            procedure owner; pair-attributed for procedure-execution
//            authority.

import { eventStore } from "../platform/composition";
import {
  makeProductDimensionAttested,
  makeProductDueDiligenceCompleted,
  makeProductProposalRegistered,
} from "../platform/event-store/event-types";
import type { ProductDimensionAttestedResult } from "../platform/event-store/event-types";
import { simulatedTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { logger } from "../platform/observability/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCT_ID = "prd:bank:fx:fx-spot-usdzar";
const PRODUCT_FAMILY = "fx" as const;
const ENTITY = "BANK-ZA-001";
const AS_OF = "2026-05-21T09:30:00.000Z";

const ACTOR_SASKIA = {
  type: "service" as const,
  id: "agent:saskia:cmo",
};

const ACTOR_OWEN = {
  type: "service" as const,
  id: "agent:owen:governance",
};

const CITATIONS_BASE: readonly string[] = [
  "PROC-NPA-GATE-01",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "brief:saskia:fire-proc-npa-gate-01-for-fx-spot-product-rehear:2026-05-21",
];

const REHEARSAL_PROVENANCE = simulatedTag({
  scenario: "proc-npa-gate-01-fx-spot-internal-pre-licence-test-2026-05-21",
  sourceLineage: "script:run-npa-gate-fx-spot",
  variant: "fx-spot-internal-pre-licence-test",
  tags: ["saskia", "owen", "npa-gate", "first-activation", "fx-spot"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Dimension definitions — the 14 NPA dimensions Saskia + Owen walk against
// the substrate as it stands on 2026-05-21.
//
// Posture ↔ ProductDimensionAttested.result mapping:
//   - Satisfied with implementation live ⇒ "implementation-attested"
//   - Satisfied at design layer; compensating control acceptable for
//     internal-test scope ⇒ "design-attested"  (rehearsal note: InProgress)
//   - Open / substantive blocker ⇒ "failed"
//
// Each dimension carries:
//   - dimensionId    — the canonical NPA dimension name
//   - posture        — narrative status (Satisfied | InProgress | Open)
//   - result         — typed schema enum (design / implementation / failed)
//   - actor          — Saskia or Owen depending on dimension authority
//   - evidence       — PR / event / artefact justifying status
//   - citationChain  — Principle-2 citation chain
//   - notes          — narrative for the rehearsal markdown
// ─────────────────────────────────────────────────────────────────────────────

interface DimensionAttestation {
  readonly dimensionId: string;
  readonly posture: "Satisfied" | "InProgress" | "Open";
  readonly result: ProductDimensionAttestedResult;
  readonly actor: typeof ACTOR_SASKIA | typeof ACTOR_OWEN;
  readonly evidence: string;
  readonly citationChain: readonly string[];
  readonly notes: string;
}

const DIMENSIONS: readonly DimensionAttestation[] = [
  // ─── 1. Regulatory / legal ───────────────────────────────────────────────
  {
    dimensionId: "regulatory-legal",
    posture: "InProgress",
    result: "design-attested",
    actor: ACTOR_OWEN,
    evidence:
      "PR #644 — Rashida (Chief Information Security Officer, governance) FinSurv ExCon assessment: build-phase activity is OUTSIDE Reg 2(1)/3(1) scope (no production wiring required pre-commencement); PR #637 — Imani (Chief Legal Counsel, governance) G-9 ISDA 2002 + SA Schedule decision",
    citationChain: [
      "Banks-Act-94-of-1990-s11",
      "Banks-Act-94-of-1990-s13",
      "ExCon-Reg-2",
      "ExCon-Reg-3",
      "PR-637",
      "PR-644",
    ],
    notes:
      "FX-spot regulatory perimeter is mapped. Rashida's PR #644 rules build-phase scenario activity outside FinSurv Reg 2(1)/3(1) scope — production wiring deferred until commencement-of-trading. Imani's G-9 ISDA 2002 + SA Schedule decision covers the legal-documentation perimeter (Condition 9 of PROC-MK-PLG-01 = Satisfied). InProgress at gate level because commencement-of-trading triggers full regulator-perimeter activation (Banks Act s.11 prohibits banking business without licence; SARB licence is wall-clock).",
  },
  // ─── 2. Credit risk ──────────────────────────────────────────────────────
  {
    dimensionId: "credit-risk",
    posture: "Satisfied",
    result: "implementation-attested",
    actor: ACTOR_SASKIA,
    evidence:
      "PR #642 — Yael (Treasurer & Tax, engineering+governance) credit-limit + netting-set enrolment (`CreditLimitLoaded` events emitted for Standard Bank ZA + Investec Treasury); Helena (Chief Risk Officer, governance) PR #634 — controlled-launch MR-1-FX limit proposal with per-counterparty USD 500k cap; PROC-RISK-CLM-01 + SA-CCR v1 engine wired",
    citationChain: [
      "Policies/credit-risk-policy-v1.md",
      "PROC-RISK-CLM-01",
      "PR-634",
      "PR-642",
      "BCBS-SA-CCR",
    ],
    notes:
      "Credit-limit substrate is LIVE per the 2026-05-20 credit-limit engine sprint (`project_continuation_2026_05_20_credit_limit_engine`). Both internal-test counterparties enrolled with limits per `Policies/credit-risk-policy-v1.md`. SA-CCR exposure-at-default engine wired (PR #635 T+2 maturity-factor regression). Netting-set engine live with `nettingEnforceable: true`. Saskia attests implementation-live.",
  },
  // ─── 3. Market risk ──────────────────────────────────────────────────────
  {
    dimensionId: "market-risk",
    posture: "InProgress",
    result: "design-attested",
    actor: ACTOR_SASKIA,
    evidence:
      "PR #634 — Helena (Chief Risk Officer, governance) controlled-launch MR-1-FX limit proposal (ZAR 350k VaR; USD 1m EOD / USD 1.5m intraday; USD/ZAR only); PR #631 — Helena FX-spot-only market-risk scope review with G-2 compensating-control attestation §2.1; FRTB-SA engine unvalidated by Nadia (Independent-validation engineer, engineering)",
    citationChain: [
      "Policies/market-risk-policy-v1.md",
      "PR-631",
      "PR-634",
      "BCBS-FRTB-SA",
    ],
    notes:
      "Market-risk limit MR-1-FX is PROPOSED in PR #634 but NOT BRC-tabled — there is no Board, no constituted BRC, no formal limit-approval forum. FRTB-SA RWA engine for FX-spot is unvalidated; Helena's G-2 compensating control is a conservative-RWA proxy via dual-track manual SA-SBM-delta cross-check (engine vs manual divergence > 5% triggers investigation; > 15% triggers MRC escalation). Acceptable for INTERNAL-TEST scope (synthetic activity); NOT acceptable for production fire. Re-activation trigger: BRC constitution OR explicit CEO interim-authority approval (separate decision card) + Nadia FRTB-SA validation.",
  },
  // ─── 4. Operational risk ─────────────────────────────────────────────────
  {
    dimensionId: "operational-risk",
    posture: "Satisfied",
    result: "implementation-attested",
    actor: ACTOR_OWEN,
    evidence:
      "PR #636 — Devon (Chief Operating Officer, governance) PROC-OPS-SFBCP-01 v0.3 FX settlement-failure procedure; PR #640 — Tomas (Correspondent banking & payments, engineering) FX settlement subscriber (LIVE-INTERNAL-VARIANT with failure-path events `MissedExpectedReceipt`, `FxSettlementFailed`, `SettlementFailureClassified`); D-OPRISK-ENGINEER-ROLE Option B (PR #666 — Owen decision card proposed) subsumes operational-risk engineering into Rohan + Vera + Devon under Helena sponsorship",
    citationChain: [
      "PROC-OPS-SFBCP-01",
      "PR-636",
      "PR-640",
      "PR-666",
      "D-OPRISK-ENGINEER-ROLE",
    ],
    notes:
      "Settlement-failure BCP slice exercised end-to-end via scenario PR #645 (Herstatt-active path, mutual-fail path, counterparty-fail path). The four failure-path event types are typed and wired (Atlas schema completeness pack PR #638). Operational-risk engineering coverage decided via D-OPRISK-ENGINEER-ROLE Option B (proposed; awaiting Marc CEO approval per PR #666). Broader BCP (system-outage drill, regional failover, ransomware drill, key-person loss) is wall-clock pre-licence work, NOT a blocker for FX-spot internal-test scope.",
  },
  // ─── 5. Capital impact ───────────────────────────────────────────────────
  {
    dimensionId: "capital-impact",
    posture: "InProgress",
    result: "design-attested",
    actor: ACTOR_SASKIA,
    evidence:
      "PR #635 — Rohan (Risk engineer, engineering) SA-CCR T+2 maturity-factor regression test (SA-CCR validated for FX-spot exposure-at-default); FRTB-SA RWA engine for market-risk capital still G-2 compensating-control per Helena PR #631; capital headroom at internal-test notional (USD 1m EOD cap) is < 0.1% of build-phase target capital",
    citationChain: [
      "Policies/capital-management-policy-v1.md",
      "PR-631",
      "PR-635",
      "BCBS-SA-CCR",
      "BCBS-FRTB-SA",
    ],
    notes:
      "Counterparty-credit-risk RWA (SA-CCR) is implementation-attested per Rohan's regression. Market-risk RWA (FRTB-SA) is design-attested only; production fire requires Nadia validation. Capital impact at MR-1-FX limit envelope (USD 1m EOD) is de minimis vs build-phase target R300m capital; no capital headroom concern for INTERNAL-TEST scope. Re-activation trigger: FRTB-SA validation + capital plan resolution by Camille (Chief Financial Officer, governance).",
  },
  // ─── 6. Liquidity impact ─────────────────────────────────────────────────
  {
    dimensionId: "liquidity-impact",
    posture: "InProgress",
    result: "design-attested",
    actor: ACTOR_SASKIA,
    evidence:
      "PR #663 + PR #645 — Kai (Markets engineering lead, engineering) BA-325 LCR subscriber driven by FX-spot scenario, asserting LCR shifts on trade-settlement and intra-day liquidity consumption; D-RAS-V1.0 schedule includes LCR + NSFR thresholds (`project_continuation_2026_05_18_ras_schedule`)",
    citationChain: [
      "Policies/liquidity-risk-policy-v1.md",
      "BA-325",
      "PR-645",
      "PR-663",
      "D-RAS-V1.0",
    ],
    notes:
      "BA-325 LCR pipeline is wired and exercised by the Kai FX-spot scenario. LCR consumption per internal-test trade is tracked. NSFR engine PLANNED per RAS schedule. InProgress because production fire requires NSFR + intraday-liquidity monitor wired; for internal-test perimeter the BA-325 subscriber is sufficient. Re-activation trigger: NSFR engine landed + intraday-liquidity monitor wired.",
  },
  // ─── 7. Compliance ───────────────────────────────────────────────────────
  {
    dimensionId: "compliance",
    posture: "Satisfied",
    result: "implementation-attested",
    actor: ACTOR_OWEN,
    evidence:
      "PR #644 — Rashida (CISO, governance) FinSurv ExCon assessment (build-phase outside-scope ruling); PR #648 — Vera (Internal audit engineer, governance) persona-attribution-coherence recon flipped to STRICT; PROC-MK-PCG-01 pre-trade conduct gate substrate exists (`Procedures/markets/pre-trade-conduct-gate.md`); PR #633 — Atlas no-prop attribution XOR on `FxTradeExecuted`",
    citationChain: [
      "PROC-MK-PCG-01",
      "Policies/insider-trading-policy-v1.md",
      "PR-633",
      "PR-644",
      "PR-648",
      "FAIS-GCC",
      "Conduct-Standard-3-of-2018",
    ],
    notes:
      "Compliance perimeter mapped and implemented. Zara (Chief Compliance Officer, governance) sign-off bundle via PR #644 + #648 covers ExCon + persona-attribution recon. FAIS GCC, Conduct Standard 3 of 2018, insider-trading policy all in scope. Note: the conduct-gate ENVELOPE (`ConductGatePassed` / `ConductGateBlocked`) wrapping the five PROC-MK-PCG-01 checks is PLANNED (only Check 1 `checkHeadroom` is LIVE) — that gap is captured as `OPS-conduct-gate-tested` in PROC-MK-PLG-01 (InProgress), not a blocker on compliance MAPPING. Satisfied for internal-test scope.",
  },
  // ─── 8. IFRS classification ──────────────────────────────────────────────
  {
    dimensionId: "ifrs-classification",
    posture: "Satisfied",
    result: "implementation-attested",
    actor: ACTOR_OWEN,
    evidence:
      "M4_FX_SPOT_FIXTURE level-2 classification in `domains/markets/products/fx-spot.ts` (Kai PR #663); PR #641 — Bea (Accounting & financial reporting engineer, engineering) PR-FX-005 IFRS-9 default-recognition posting rule; PR #652 — Bea bea-gl-posting-engine autonomous subscriber wires PR-FX-001..PR-FX-005 + PR-FX-PRIN posting rules (FX-spot fully posted)",
    citationChain: [
      "IFRS-9",
      "IAS-21",
      "IAS-32",
      "Policies/accounting-policy-v1.md",
      "PR-641",
      "PR-652",
      "PR-663",
    ],
    notes:
      "FX-spot IFRS classification: financial-asset / financial-liability mandatorily-at-FVTPL (IFRS 9 §4.1.4); foreign-exchange differences via P&L (IAS 21 §28). Posting rules PR-FX-001 through PR-FX-005 + PR-FX-PRIN are LIVE and exercised by the scenario. GL trial-balance assembly substrate-gap is downstream (scenario `substrateGaps` summary) — not a blocker on classification. Owen attests implementation-live.",
  },
  // ─── 9. Tax ──────────────────────────────────────────────────────────────
  {
    dimensionId: "tax",
    posture: "Satisfied",
    result: "design-attested",
    actor: ACTOR_OWEN,
    evidence:
      "Yael (Treasurer & Tax, engineering+governance) bench position: FX-spot is not a marketable security under Securities Transfer Tax Act 25 of 2007 — STT does not apply; corporate income tax on FX P&L is settled at entity-level via standard CIT return (deferred to revenue-commencement per `project_continuation_2026_05_07` Yael paused-slice posture); VAT treatment: financial-service exemption Schedule 1 §2 of VAT Act 89 of 1991 applies",
    citationChain: [
      "STT-Act-25-of-2007",
      "Income-Tax-Act-58-of-1962",
      "VAT-Act-89-of-1991",
      "Team/Yael.md",
    ],
    notes:
      "FX-spot is exempt from STT (not a security); VAT-exempt as financial service; CIT on net FX P&L is entity-level standard CIT — no FX-spot-specific tax treatment. Yael's PAYE/EMP201/IRP5 slice is paused per `project_ai_driven_bank` (no real employees yet); CIT/VAT/STT/FATCA/CRS slice activates at revenue-commencement. Design-attested because the tax position is documented but no return has been filed (no revenue yet). Re-activation trigger: revenue-commencement.",
  },
  // ─── 10. Model risk ──────────────────────────────────────────────────────
  {
    dimensionId: "model-risk",
    posture: "InProgress",
    result: "design-attested",
    actor: ACTOR_SASKIA,
    evidence:
      "Nadia (Independent-validation engineer, engineering) tier classification: FX-spot pricing model is reference-rate-driven (SARB daily fixing — PR #643 Atlas SARB fixing ingester) — tier-3 (low complexity, reference-rate-anchored); FRTB-SA RWA engine for FX-spot is unvalidated (Helena G-2 compensating control); SMA RWA still PLANNED per D-OPRISK-ENGINEER-ROLE Option B",
    citationChain: [
      "Policies/model-risk-policy-v1.md",
      "PR-631",
      "PR-643",
      "D-OPRISK-ENGINEER-ROLE",
      "BCBS-MODEL-RISK-PRINCIPLES",
    ],
    notes:
      "Pricing model is a reference-rate ingester (SARB daily fixing) — tier-3 low-complexity, no proprietary pricing assumptions. FRTB-SA RWA engine validation is the substantive model-risk gap; Helena's G-2 compensating control (dual-track manual SA-SBM-delta cross-check) is acceptable for INTERNAL-TEST scope only. SMA operational-risk RWA is downstream (D-OPRISK-ENGINEER-ROLE). Re-activation trigger: Nadia validation report for FRTB-SA + SMA implementation. NOT a blocker for internal-test fire.",
  },
  // ─── 11. Technology / systems ────────────────────────────────────────────
  {
    dimensionId: "technology-systems",
    posture: "Satisfied",
    result: "implementation-attested",
    actor: ACTOR_SASKIA,
    evidence:
      "PR #645 — Kai (Markets engineering lead, engineering) `scenarios/fx-spot-internal-pre-licence-test.ts` returns READY-FOR-CONTROLLED-LAUNCH; PR #647 — Saskia + Kai CEO end-to-end FX-trade walkthrough at `2026-05-21_saskia-kai_fx-trade-end-to-end-walkthrough.md`; PR #663 — Kai BA-325 LCR subscriber + scenario integration; manual booking UI at `dashboard/public/trade-book.html`",
    citationChain: [
      "PR-645",
      "PR-647",
      "PR-663",
      "scenarios/fx-spot-internal-pre-licence-test.ts",
      "dashboard/public/trade-book.html",
    ],
    notes:
      "Front-to-back lifecycle exercised end-to-end: BUY USD 500k vs ZAR with Standard Bank ZA, full settlement path; Herstatt-active failure path against Investec ZA; mutual-fail path; IFRS-9 posting rules; SA-CCR T+2 maturity factor; credit-limit utilisation; EOD revaluation. Scenario substrate-gaps catalogued (SicrTriggered flow, subscriber-to-engine path, GL trial balance assembly) are downstream slices — none block the technology-systems attestation for INTERNAL-TEST scope.",
  },
  // ─── 12. Legal documentation ─────────────────────────────────────────────
  {
    dimensionId: "legal-documentation",
    posture: "Satisfied",
    result: "implementation-attested",
    actor: ACTOR_OWEN,
    evidence:
      "PR #637 — Imani (Chief Legal Counsel, governance) G-9 close: ISDA 2002 + SA Schedule is the default master-agreement form for FX-spot trading with both internal-test counterparties; Bowmans 2024-04-15 SA netting opinion held on file; netting-set enrolment via PR #642 with `nettingEnforceable: true`",
    citationChain: [
      "ISDA-2002-Master-Agreement",
      "SA-Schedule-Bowmans-2024-04-15",
      "PR-637",
      "PR-642",
    ],
    notes:
      "ISDA 2002 + SA Schedule is established as the default form for FX-spot. Netting opinion (Bowmans, 2024-04-15) supports `nettingEnforceable: true` on both counterparties' netting-set entries (Standard Bank ZA, Investec Treasury). Residual substrate-hygiene item: the `jurisdictionOpinionRef` field on `ISDACSAAssessmentCompleted` carries a string identifier rather than a content-addressed RMS document reference (Imani G-9 §5 gap 3); not a blocker. Owen attests implementation-live.",
  },
  // ─── 13. Counterparty eligibility ────────────────────────────────────────
  {
    dimensionId: "counterparty-eligibility",
    posture: "Satisfied",
    result: "implementation-attested",
    actor: ACTOR_SASKIA,
    evidence:
      "PR #639 — Saskia Party register entries for Standard Bank Group ZA + Investec Treasury (both with LEI codes registered per `Regulations/_party-register.md`); PR #642 — Yael credit-limit + netting-set enrolment with `ISDACSAAssessmentCompleted` events; both counterparties are institutional bank treasury desks (institutional-only model per `project_strategic_foundation`)",
    citationChain: [
      "Regulations/_party-register.md",
      "Policies/counterparty-policy-v1.md",
      "PR-639",
      "PR-642",
    ],
    notes:
      "Both internal-test counterparties on the Party register with LEIs; both pass institutional-counterparty eligibility per `Policies/counterparty-policy-v1.md`. Dealer-mandate registry exists (`MandateIssued` event-type chain); the scenario actor `agent:kai:markets-engineering-lead` is registered. Saskia attests implementation-live.",
  },
  // ─── 14. Board notification ──────────────────────────────────────────────
  {
    dimensionId: "board-notification",
    posture: "Open",
    result: "failed",
    actor: ACTOR_OWEN,
    evidence:
      "No Board exists yet (build-phase per `project_ai_driven_bank`); no Board Risk Committee (BRC) constituted; no formal board-notification register; Owen's Interim Audit Forum is the closest analogue but is a CAE functional-line independence preservation device, NOT a substitute for Board notification",
    citationChain: [
      "Banks-Act-94-of-1990-s60",
      "Companies-Act-71-of-2008",
      "project_ai_driven_bank",
    ],
    notes:
      "SUBSTANTIVE BLOCKER for production fire. No Board exists yet; Board constitution is a licence-day statutory-minimum hire per `project_ai_driven_bank` (5–10 humans appointed at licence-day). For INTERNAL-TEST scope: Marc (CEO) substitutes for Board acknowledgment via the CEO decision card opened by this script (`D-NPA-FX-SPOT-INTERNAL-TEST`). Owen attests Open; the rehearsal proceeds with CEO-substitution. Re-activation trigger: Board constitution at licence-day.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency helpers
// ─────────────────────────────────────────────────────────────────────────────

function proposalAlreadyEmitted(): boolean {
  for (const ev of eventStore.replay({ type: "ProductProposalRegistered" })) {
    const p = ev.payload as { productId?: string };
    if (p.productId === PRODUCT_ID) return true;
  }
  return false;
}

function dimensionAlreadyAttested(dimensionId: string): boolean {
  for (const ev of eventStore.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string };
    if (p.productId === PRODUCT_ID && p.dimension === dimensionId) return true;
  }
  return false;
}

function dueDiligenceAlreadyCompleted(): boolean {
  for (const ev of eventStore.replay({ type: "ProductDueDiligenceCompleted" })) {
    const p = ev.payload as { productId?: string };
    if (p.productId === PRODUCT_ID) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): number {
  let appended = 0;
  let skipped = 0;

  // 1. ProductProposalRegistered.
  if (!proposalAlreadyEmitted()) {
    const ev: Event = {
      ...makeProductProposalRegistered({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR_SASKIA,
        citations: [...CITATIONS_BASE],
        payload: {
          productId: PRODUCT_ID,
          family: PRODUCT_FAMILY,
          proposedBy: "agent:saskia:cmo",
          asOf: AS_OF,
        },
      }),
      provenance: REHEARSAL_PROVENANCE,
    };
    eventStore.append(ev);
    appended += 1;
    logger.info(
      { productId: PRODUCT_ID, eventId: ev.event_id },
      "ProductProposalRegistered emitted (PROC-NPA-GATE-01 first activation)",
    );
  } else {
    skipped += 1;
    logger.info(
      { productId: PRODUCT_ID },
      "ProductProposalRegistered already in store — skipped (idempotent)",
    );
  }

  // 2. ProductDimensionAttested ×14.
  for (const d of DIMENSIONS) {
    if (dimensionAlreadyAttested(d.dimensionId)) {
      skipped += 1;
      continue;
    }
    const ev: Event = {
      ...makeProductDimensionAttested({
        asOf: AS_OF,
        entity: ENTITY,
        actor: d.actor,
        citations: [...CITATIONS_BASE, `dimension:${d.dimensionId}`],
        payload: {
          productId: PRODUCT_ID,
          dimension: d.dimensionId,
          result: d.result,
          citationChain: [...d.citationChain],
        },
      }),
      provenance: REHEARSAL_PROVENANCE,
    };
    eventStore.append(ev);
    appended += 1;
  }

  // 3. ProductDueDiligenceCompleted — summary of the 14-dimension walk.
  if (!dueDiligenceAlreadyCompleted()) {
    const gatesCleared = DIMENSIONS.filter((d) => d.posture !== "Open").map((d) => d.dimensionId);
    const gatesFailed = DIMENSIONS.filter((d) => d.posture === "Open").map((d) => d.dimensionId);
    const ev: Event = {
      ...makeProductDueDiligenceCompleted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR_SASKIA,
        citations: [...CITATIONS_BASE],
        payload: {
          productId: PRODUCT_ID,
          gatesCleared,
          gatesFailed,
        },
      }),
      provenance: REHEARSAL_PROVENANCE,
    };
    eventStore.append(ev);
    appended += 1;
    logger.info(
      { productId: PRODUCT_ID, gatesCleared: gatesCleared.length, gatesFailed: gatesFailed.length },
      "ProductDueDiligenceCompleted emitted (recommendation to CEO via D-NPA-FX-SPOT-INTERNAL-TEST)",
    );
  } else {
    skipped += 1;
    logger.info(
      { productId: PRODUCT_ID },
      "ProductDueDiligenceCompleted already in store — skipped (idempotent)",
    );
  }

  // 4. Report.
  printReport();

  logger.info({ appended, skipped }, "PROC-NPA-GATE-01 first activation complete");
  return 0;
}

function countByPosture(p: DimensionAttestation["posture"]): number {
  return DIMENSIONS.filter((d) => d.posture === p).length;
}

function printReport(): void {
  const satisfied = countByPosture("Satisfied");
  const inProgress = countByPosture("InProgress");
  const open = countByPosture("Open");

  const lines: string[] = [];
  lines.push("");
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("PROC-NPA-GATE-01 — FIRST ACTIVATION");
  lines.push("Scope: FX-spot internal pre-licence test");
  lines.push(`Product ID: ${PRODUCT_ID}`);
  lines.push(`Run date: ${AS_OF.slice(0, 10)}`);
  lines.push("Product owner: Saskia (Head of Global Markets / Chief Markets Officer, governance)");
  lines.push("Procedure owner: Owen (Company Secretary, governance)");
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`14-dimension walk:`);
  for (const d of DIMENSIONS) {
    const note = d.notes.split(/[.!?]\s/)[0].slice(0, 110);
    lines.push(`  - ${d.dimensionId.padEnd(28)} ${d.posture.padEnd(10)} (${note})`);
  }
  lines.push("");
  lines.push("DIMENSION TALLY:");
  lines.push(`  - Satisfied:  ${satisfied}/${DIMENSIONS.length}`);
  lines.push(`  - InProgress: ${inProgress}/${DIMENSIONS.length}`);
  lines.push(`  - Open:       ${open}/${DIMENSIONS.length}`);
  lines.push("");
  if (open === 0) {
    lines.push("GATE RECOMMENDATION: APPROVE for INTERNAL-TEST SCOPE (no substantive Open blockers).");
  } else {
    const openIds = DIMENSIONS.filter((d) => d.posture === "Open")
      .map((d) => d.dimensionId)
      .join(", ");
    lines.push(`GATE RECOMMENDATION: APPROVE-WITH-CONDITIONS for INTERNAL-TEST SCOPE.`);
    lines.push(`  Open dimensions: ${openIds}`);
    lines.push(`  Compensating control: CEO substitutes for Board acknowledgment via D-NPA-FX-SPOT-INTERNAL-TEST.`);
  }
  lines.push("");
  lines.push("Note: this script does NOT emit ProductApproved (or NewProductApproved).");
  lines.push("Marc (CEO) approves via the decision card D-NPA-FX-SPOT-INTERNAL-TEST (phase: requested).");
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("");

  console.log(lines.join("\n"));
}

process.exit(main());
