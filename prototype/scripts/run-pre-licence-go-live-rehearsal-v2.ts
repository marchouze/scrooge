// scripts/run-pre-licence-go-live-rehearsal-v2.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// REHEARSAL v2 (re-rehearsal) — NOT A PRODUCTION GATE FIRE.
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the rehearsal-of-the-rehearsal under brief
//   `brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21`,
// run `run:devon:2026-05-21T10-14-44-468Z`.
//
// Context: the first rehearsal (PR #667, gateId
// `pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test`) returned
// **BLOCKED-BY-NPA-fx-spot-schema-defined, NPA-fx-spot-risk-limits-set**.
// Today (2026-05-21) both substantive blockers have been cleared at the
// canonical-event level:
//
//   1. PR #674 — `D-NPA-FX-SPOT-INTERNAL-TEST` approved by Marc (CEO);
//      `ProductApproved{productId:"prd:bank:fx:fx-spot-usdzar",
//      version:"0.1.0-internal-pre-licence-test"}` emitted.
//   2. PR #680 — `D-BRC-INTERIM-MR-1-FX` approved by Marc (CEO) under
//      interim authority (Option A); Helena (Chief Risk Officer, governance)'s
//      MR-1-FX framework (VaR ZAR 350k; EOD USD 1m; intraday USD 1.5m;
//      per-cpty USD 500k/day) is the build-phase substitute for BRC tabling.
//
// This script walks the same 11 conditions against the same substrate but
// with the two previously-Open conditions now in `Satisfied` posture per the
// new approval events on main. The reading is identical to v1 for the other
// 9 conditions — none of them have moved since 2026-05-21T08:30Z.
//
// Distinct rehearsal gateId:
//   `pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test-v2`
//
// What this script emits:
//   1. `GoLiveGateActivated` — distinct v2 gateId
//   2. `GoLiveConditionUpdated` (×11) — one per condition with refreshed
//      status, evidence, and notes
//
// What it does NOT emit:
//   - `GoLiveReadinessAssessed` (requires both co-chair quorum sign-offs
//     AND CEO confirmation as Marc + Devon + Zara in real co-chair sign-off;
//     that is a Phase 4 / production-fire activity)
//   - `GoLiveReadinessConfirmed` (requires CEO authority + real SARB banking
//     licence; neither pre-condition holds today)
//   - `RegulatoryApprovalReceived` (regulatory approvals are external;
//     no authority on this machine to fabricate them)
//
// Optional: `GoLiveInternalTestReady` is not a registered event type in
// `platform/event-store/event-types/` or `platform/event-store/registry.ts`
// today. Inventing it as a raw envelope would create a new untyped event
// kind; the cleaner posture is to surface it as a substrate gap rather than
// invent it. See report Part 3.
//
// Idempotency. Like v1, scans the event store on each run and skips both
// `GoLiveGateActivated` and `GoLiveConditionUpdated` rows tagged with the
// v2 rehearsal gateId.
//
// Authority: dispatched by Scrooge (Chief of Staff) under brief
//   `brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21`,
//   run `run:devon:2026-05-21T10-14-44-468Z`.
// Procedure: PROC-MK-PLG-01.
// Banks Act 94 of 1990 s.11 + s.13 — the regulatory backstop.
//
// Author: Devon (Chief Operating Officer, governance) · co-author Zara
//         (Chief Compliance Officer, governance) for compliance-dimension
//         condition assessment.

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { simulatedTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { logger } from "../platform/observability/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Rehearsal v2 constants — DISTINCT from v1
// ─────────────────────────────────────────────────────────────────────────────

const REHEARSAL_GATE_ID =
  "pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test-v2";
const PRODUCT_SCOPE: readonly string[] = ["fx-spot"];
const ENTITY = "BANK-ZA-001";
const AS_OF = "2026-05-21T10:30:00.000Z";

const ACTOR_DEVON = {
  type: "service" as const,
  id: "agent:devon:coo",
};

const ACTOR_ZARA = {
  type: "service" as const,
  id: "agent:zara:cco",
};

const CITATIONS: readonly string[] = [
  "PROC-MK-PLG-01",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-NPA-FX-SPOT-INTERNAL-TEST",
  "D-BRC-INTERIM-MR-1-FX",
  "Banks-Act-94-of-1990-s11",
  "Banks-Act-94-of-1990-s13",
  "PR #667",
  "PR #674",
  "PR #680",
  "brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21",
];

const REHEARSAL_PROVENANCE = simulatedTag({
  scenario: "proc-mk-plg-01-rerehearsal-fx-spot-internal-2026-05-21",
  sourceLineage: "script:run-pre-licence-go-live-rehearsal-v2",
  variant: "fx-spot-internal-test-v2",
  tags: ["devon", "zara", "go-live-gate", "rehearsal", "fx-spot", "v2"],
});

// ─────────────────────────────────────────────────────────────────────────────
// Condition definitions — v2 walk. Only the two NPA conditions previously
// Open have moved; all other rows are identical to v1.
// ─────────────────────────────────────────────────────────────────────────────

interface ConditionAssessment {
  readonly conditionId: string;
  readonly dimension: "NPA" | "OPS";
  readonly title: string;
  readonly status: "Open" | "InProgress" | "Satisfied";
  readonly evidence: string;
  readonly notes: string;
  readonly signOff: "Devon" | "Zara" | "Devon+Zara";
}

const CONDITIONS: readonly ConditionAssessment[] = [
  // ─── NPA product-readiness for FX-spot (5 conditions) ──────────────────
  {
    conditionId: "NPA-fx-spot-schema-defined",
    dimension: "NPA",
    title: "FX-spot product schema defined and NPA-approved",
    // v1: Open. v2: Satisfied — ProductApproved event now in event store.
    status: "Satisfied",
    evidence:
      "PR #674 — D-NPA-FX-SPOT-INTERNAL-TEST CEO-approved 2026-05-21T09:28Z; " +
      "`ProductApproved{productId:'prd:bank:fx:fx-spot-usdzar', " +
      "version:'0.1.0-internal-pre-licence-test'}` on main; PR #673 — Saskia " +
      "(Head of Global Markets) PROC-NPA-GATE-01 walk closing 13/14 dimensions",
    notes:
      "Status flipped Open → Satisfied since v1 rehearsal (PR #667). The NPA " +
      "procedure (PROC-NPA-GATE-01) has now fired for FX-spot: Saskia's walk " +
      "(PR #673) closed 13 of 14 dimensions with compensating controls " +
      "documented for the open dimensions (regulatory-legal cleared by " +
      "Rashida (Chief Information Security Officer, governance) ExCon ruling " +
      "PR #644; market-risk by MR-1-FX framework now CEO-approved per PR #680; " +
      "capital-impact by SA-CCR validation PR #635; liquidity-impact by Kai " +
      "(Markets engineering lead) BA-325 wiring; model-risk deferred for " +
      "reference-rate driven FX-spot; board-notification structurally absent " +
      "in build phase with CEO acknowledgment as substitute). " +
      "`ProductApproved` event scopes the approval to internal-pre-licence-test " +
      "with the seven compensating-control conditions enumerated in payload. " +
      "Satisfied for internal-test fire-readiness; production fire requires " +
      "open compensating controls to be retired pre-licence-day per the " +
      "approval-conditions register.",
    signOff: "Zara",
  },
  {
    conditionId: "NPA-fx-spot-pricing-model-validated",
    dimension: "NPA",
    title: "FX-spot pricing model validated and independently signed-off",
    status: "InProgress",
    evidence:
      "PR #643 — SARB fixing ingester (Atlas, Core banking platform architect, " +
      "engineering) emits `OfficialMarkAdopted{source:'SARB', " +
      "policyVersionRef:'VALUATION-POLICY-V1:v1.0'}`; Helena (Chief Risk " +
      "Officer, governance) G-1 compensating-control attestation §2.1 in PR #631",
    notes:
      "Unchanged from v1. The operative production-grade FX-spot rate source " +
      "during the build phase is the SARB daily fixing (PR #643). Helena's " +
      "daily IPV sign-off (manual) is the G-1 compensating control until a " +
      "real-time FX feed (Bloomberg BFIX) lands. FRTB-SA engine for FX-spot " +
      "is unvalidated by Nadia (Independent-validation engineer, engineering) " +
      "— Helena's G-2 compensating control is a conservative-RWA proxy via " +
      "dual-track manual SA-SBM-delta cross-check (engine vs manual " +
      "divergence > 5% triggers investigation; > 15% triggers MRC escalation). " +
      "InProgress: compensating control acceptable for INTERNAL test perimeter " +
      "(synthetic activity, no real ZAR movement); NOT acceptable for " +
      "production fire — G-1 and G-2 must be retired (real Bloomberg feed + " +
      "Nadia validation) before `GoLiveReadinessConfirmed` could be emitted.",
    signOff: "Zara",
  },
  {
    conditionId: "NPA-fx-spot-risk-limits-set",
    dimension: "NPA",
    title: "FX-spot risk limits set and BRC-tabled",
    // v1: Open. v2: Satisfied — D-BRC-INTERIM-MR-1-FX CEO-approved Option A.
    status: "Satisfied",
    evidence:
      "PR #680 — D-BRC-INTERIM-MR-1-FX CEO-approved Option A 2026-05-21T09:50Z; " +
      "PR #678 — Owen (Chief Company Secretary, governance) decision card; " +
      "PR #634 — Helena (Chief Risk Officer, governance) MR-1-FX limit " +
      "framework (VaR ZAR 350k; EOD USD 1m; intraday USD 1.5m; per-cpty USD " +
      "500k/day; USD/ZAR only); PR #642 — Yael (Treasurer & Tax, " +
      "engineering+governance) CreditLimitLoaded for Standard Bank ZA + " +
      "Investec Treasury",
    notes:
      "Status flipped Open → Satisfied since v1 rehearsal (PR #667). " +
      "Credit-limit substrate remains LIVE — Yael has both counterparties " +
      "enrolled with limits per `Policies/credit-risk-policy-v1.md`. " +
      "Market-risk limit MR-1-FX, previously PROPOSED-but-not-BRC-tabled, is " +
      "now CEO-approved under interim authority per Owen's PR #678 decision " +
      "card and Marc's session-delegated approval (PR #680). " +
      "Build-phase governance posture per `Policies/market-risk-policy-v1.md` " +
      "§3 / §3.1 / §6 (CEO interim) provisions: CEO interim approval is the " +
      "explicit substitute for absent Board Risk Committee tabling. " +
      "Successor card D-BRC-INTERIM-MR-1-FX-RETABLE opens for mandatory " +
      "re-tabling at Board constitution (pinned to PROC-MK-PLG-01 production " +
      "fire). Satisfied for internal-test fire-readiness; the successor card " +
      "must close before any production go-live.",
    signOff: "Devon+Zara",
  },
  {
    conditionId: "NPA-fx-spot-conduct-obligations-mapped",
    dimension: "NPA",
    title: "FX-spot conduct obligations mapped to PROC-MK-PCG-01",
    status: "Satisfied",
    evidence:
      "`Procedures/markets/pre-trade-conduct-gate.md` (PROC-MK-PCG-01) — " +
      "five-check blocking gate (counterparty mandate + credit-limit headroom " +
      "+ ISDA; dealer mandate; sanctions screen ≤24h; counterparty capacity; " +
      "best-execution); PR #633 no-prop attribution XOR on FxTradeExecuted; " +
      "`Policies/insider-trading-policy-v1.md`",
    notes:
      "Unchanged from v1. Conduct obligations for FX-spot are fully mapped. " +
      "The MAPPING is Satisfied — the procedure exists, the policy exists, " +
      "the XOR invariant is encoded. Note: the conduct-gate ENVELOPE wrapping " +
      "the five checks is PLANNED (NOT-WIRED per Saskia + Kai walkthrough §6); " +
      "only Check 1 (`checkHeadroom`) is LIVE; the runtime currently emits " +
      "`GatewayCheckCompleted` instead of `ConductGatePassed`. That is an " +
      "OPS-readiness item (OPS-conduct-gate-tested below), not an NPA-mapping " +
      "item. Zara concurs: conduct OBLIGATIONS are mapped; conduct GATE " +
      "end-to-end is a separate condition.",
    signOff: "Zara",
  },
  {
    conditionId: "NPA-fx-spot-front-to-back-confirmed",
    dimension: "NPA",
    title: "FX-spot front-to-back system capability confirmed",
    status: "Satisfied",
    evidence:
      "PR #645 — scenario `prototype/scenarios/fx-spot-internal-pre-licence-test.ts` " +
      "returns READY-FOR-CONTROLLED-LAUNCH; PR #647 — Saskia (Head of Global " +
      "Markets) + Kai (Markets engineering lead) CEO end-to-end FX-trade " +
      "walkthrough at `2026-05-21_saskia-kai_fx-trade-end-to-end-walkthrough.md`",
    notes:
      "Unchanged from v1. Front-to-back lifecycle exercised end-to-end: " +
      "BUY USD 500k vs ZAR with Standard Bank ZA, full settlement path; " +
      "Herstatt-active failure path against Investec ZA; mutual-fail path; " +
      "IFRS-9 posting rules; SA-CCR T+2 maturity factor; credit-limit " +
      "utilisation; EOD revaluation. Substrate gaps catalogued in scenario " +
      "`substrateGaps` summary (SicrTriggered flow, subscriber-to-engine " +
      "path, GL trial balance assembly) are downstream slices — none block " +
      "the front-to-back demonstration. Satisfied for INTERNAL TEST scope.",
    signOff: "Devon",
  },

  // ─── OPS-readiness (6 conditions) ────────────────────────────────────────
  {
    conditionId: "OPS-trading-system-operational",
    dimension: "OPS",
    title: "Trading system operational and tested",
    status: "Satisfied",
    evidence:
      "Manual booking flow at `dashboard/public/trade-book.html` (live); " +
      "scenario PR #645 exercises the booking path for both happy-path and " +
      "failure-path trades",
    notes:
      "Unchanged from v1. The trading system is the manual booking UI plus " +
      "the FxTradeExecuted/FxTradeBooked event-chain. Both paths exercised in " +
      "PR #645. No order-management system, no FIX gateway, no electronic- " +
      "execution venue — those are post-licence-day items. For INTERNAL TEST " +
      "scope the manual booking + scenario harness is sufficient.",
    signOff: "Devon",
  },
  {
    conditionId: "OPS-settlement-connectivity",
    dimension: "OPS",
    title: "Settlement connectivity with correspondent bank confirmed",
    status: "InProgress",
    evidence:
      "PR #640 — Tomas (Correspondent banking & payments, engineering) FX " +
      "settlement subscriber (LIVE-INTERNAL-VARIANT; simulated correspondent " +
      "feed)",
    notes:
      "Unchanged from v1. Settlement subscriber is wired with the " +
      "simulated-feed variant — events flow, posting rules fire, failure-path " +
      "classification works. The bank operates as an INDIRECT participant per " +
      "`project_payments_correspondent_model` and `project_indirect_participant_posture` " +
      "— no direct SAMOS/BankservAfrica integration, no real correspondent " +
      "bank account, no SWIFT MT300 leaving the bank. " +
      "InProgress: acceptable for internal test; real correspondent-bank " +
      "engagement (Standard Bank ZA as USD correspondent for our ZAR-base " +
      "operations) is a wall-clock licence-day item — the correspondent will " +
      "not open a nostro account for an unlicensed entity.",
    signOff: "Devon",
  },
  {
    conditionId: "OPS-regulatory-reporting-pipelines",
    dimension: "OPS",
    title: "Regulatory reporting pipelines (FinSurv, SARB returns) live and tested",
    status: "InProgress",
    evidence:
      "PR #644 — Rashida (Chief Information Security Officer, governance) " +
      "FinSurv ExCon assessment: build-phase activity is OUTSIDE Reg 2(1)/3(1) " +
      "scope (no production wiring required); BA-325 LCR subscriber driven by " +
      "scenario PR #645 (Kai); BA-700/600/350 reporting capability landed in " +
      "PRs #436–#444 (M3 reporting)",
    notes:
      "Unchanged from v1. FinSurv ExCon: Rashida's PR #644 rules the " +
      "build-phase scenario activity outside Regulations 2(1)/3(1) scope — " +
      "FinSurv pipeline production wiring is deferred until commencement-of- " +
      "trading. BA-325 (LCR) is wired and tested via the Kai scenario. " +
      "BA-700/600/350 capability exists but is not exercised by the FX-spot " +
      "scenario (those are credit/IRRBB returns; FX-spot drives BA-325 + " +
      "BA-330). InProgress: the pipelines that fire for FX-spot (BA-325) are " +
      "live and tested; the pipelines that don't fire for FX-spot (FinSurv " +
      "production wiring) are correctly deferred per Rashida's CISO " +
      "assessment. Acceptable for INTERNAL TEST scope; production fire would " +
      "require FinSurv production wiring + Vera audit + real SARB filing " +
      "rehearsals — all wall-clock items.",
    signOff: "Devon",
  },
  {
    conditionId: "OPS-mandate-counterparty-registries",
    dimension: "OPS",
    title: "Mandate and counterparty registries populated and validated",
    status: "Satisfied",
    evidence:
      "PR #639 — Saskia (Head of Global Markets) Party register entries for " +
      "Standard Bank ZA + Investec Treasury; PR #642 — Yael (Treasurer & Tax, " +
      "engineering+governance) credit limits + netting-set enrolment " +
      "(ISDACSAAssessmentCompleted); PR #637 — Imani (Chief Legal Counsel, " +
      "governance) G-9 ISDA 2002 + SA Schedule decision",
    notes:
      "Unchanged from v1. Counterparty registry: both internal-test " +
      "counterparties on the Party register with LEIs. ISDA documentation: " +
      "Imani's G-9 close confirms ISDA 2002 + SA Schedule is the default; " +
      "Bowmans 2024-04-15 SA netting opinion held on file; netting-set " +
      "enrolment with `nettingEnforceable: true`. Dealer-mandate registry " +
      "exists (`MandateIssued` event-type chain); the actor in the scenario " +
      "(`agent:kai:markets-engineering-lead`) is registered. Satisfied for " +
      "INTERNAL TEST scope. Note: the `jurisdictionOpinionRef` field carries " +
      "a string identifier rather than a content-addressed RMS reference per " +
      "Imani G-9 §5 gap 3 — that is a separate substrate gap, not a blocker " +
      "on this condition.",
    signOff: "Zara",
  },
  {
    conditionId: "OPS-conduct-gate-tested",
    dimension: "OPS",
    title: "Conduct gate (PROC-MK-PCG-01) tested end-to-end",
    status: "InProgress",
    evidence:
      "PROC-MK-PCG-01 Check 1 (`checkHeadroom`) is LIVE per credit-limit " +
      "engine PR #614 + PR #618 wire; remaining checks (dealer mandate, " +
      "sanctions screen, counterparty capacity, best-execution) are PLANNED " +
      "per Saskia + Kai walkthrough §6 substrate-state",
    notes:
      "Unchanged from v1. End-to-end test of PROC-MK-PCG-01 has NOT been " +
      "performed. Only Check 1 (credit-limit headroom) is wired into the " +
      "runtime; the conduct-gate ENVELOPE (`ConductGatePassed` / " +
      "`ConductGateBlocked`) is PLANNED. The runtime emits " +
      "`GatewayCheckCompleted` for the headroom check only — sanctions " +
      "screening, dealer-mandate validation, counterparty-capacity " +
      "confirmation, and best-execution pre-check are not enforced at " +
      "trade-initiation time. InProgress (with reservation): the SCAFFOLDING " +
      "is in place; the SUBSTRATE is partial. For production fire, all five " +
      "checks must be wired + tested + a Vera recon pipeline added. For " +
      "INTERNAL TEST scope where the scenario operates against a curated " +
      "counterparty whitelist, the partial coverage is acceptable IF the gap " +
      "is on the blocker register — which it is via the v1 rehearsal.",
    signOff: "Devon+Zara",
  },
  {
    conditionId: "OPS-bcp-tested",
    dimension: "OPS",
    title: "BCP and settlement-failure procedure (PROC-OPS-SFBCP-01) tested",
    status: "InProgress",
    evidence:
      "PR #636 — Devon (Chief Operating Officer, governance) authored " +
      "PROC-OPS-SFBCP-01 v0.3 FX settlement failure procedure scaffold; " +
      "PR #640 — Tomas (Correspondent banking & payments, engineering) " +
      "settlement subscriber wired the failure-path events " +
      "(`MissedExpectedReceipt`, `FxSettlementFailed`, " +
      "`SettlementFailureClassified`); scenario PR #645 Phase 3 exercises the " +
      "Herstatt-active failure path end-to-end",
    notes:
      "Unchanged from v1. PROC-OPS-SFBCP-01 v0.3 covers the FX settlement- " +
      "failure path; the four failure-path events are wired (Atlas, Core " +
      "banking platform architect, engineering, schema completeness pack " +
      "PR #638); the scenario harness exercises one-leg-delivered, mutual- " +
      "fail, and counterparty-fail paths. Broader BCP (system outage, " +
      "regional failover, ransomware drill, key-person loss) has NOT been " +
      "tested — the bank's BCP substrate is the settlement-failure slice only. " +
      "InProgress: settlement-failure BCP is exercised; broader BCP testing " +
      "is a wall-clock pre-licence item per Saskia (Head of Global Markets)'s " +
      "substrate (co-owned with Rashida (Chief Information Security Officer, " +
      "governance) and Devon). For INTERNAL TEST scope (no live customers, " +
      "no real settlement) the settlement-failure path coverage is sufficient.",
    signOff: "Devon",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Regulatory approvals — unchanged from v1. None can be self-certified;
// all are wall-clock items.
// ─────────────────────────────────────────────────────────────────────────────

interface RegulatoryApproval {
  readonly approvalId: string;
  readonly authority: string;
  readonly approvalType: string;
  readonly status: "NotHeld" | "Pending" | "Received";
  readonly notes: string;
}

const REGULATORY_APPROVALS: readonly RegulatoryApproval[] = [
  {
    approvalId: "REG-SARB-BANK-LICENCE",
    authority: "SARB Prudential Authority",
    approvalType: "Banks Act s.13 banking licence",
    status: "NotHeld",
    notes:
      "Wall-clock. No application submitted yet. Banks Act s.11 prohibits " +
      "conducting banking business without this licence; commencement-of- " +
      "trading is blocked until granted. Licence application is a Saskia + " +
      "Devon + Owen co-tracked workstream; preparation requires the full " +
      "substrate this rehearsal is mapping.",
  },
  {
    approvalId: "REG-FSCA-FSP-LICENCE",
    authority: "FSCA",
    approvalType: "FAIS Act s.7 FSP licence",
    status: "NotHeld",
    notes:
      "Wall-clock. FSP licence required to provide financial services; must " +
      "be in place before any FX-spot transaction with or for clients. " +
      "Application typically follows SARB banking-licence grant for an " +
      "institutional-only model.",
  },
  {
    approvalId: "REG-POPIA-IO",
    authority: "Information Regulator",
    approvalType: "POPIA Information Officer registration",
    status: "NotHeld",
    notes:
      "Wall-clock. Information Officer must be registered with the " +
      "Information Regulator before personal-information processing commences " +
      "(s.55 POPIA, registration regulations). No IO appointed yet — " +
      "appointment is a licence-day statutory-minimum hire per " +
      "`project_ai_driven_bank`. Rashida (Chief Information Security Officer, " +
      "governance) holds the architectural responsibility; a natural-person " +
      "IO is the regulatory requirement.",
  },
  {
    approvalId: "REG-AUDITOR-ENGAGEMENT",
    authority: "External auditor (TBD)",
    approvalType: "Engagement letter signed",
    status: "NotHeld",
    notes:
      "Wall-clock. Auditor appointment is a Banks Act s.61 requirement; " +
      "engagement letter must be in place before licence-day. Per " +
      "`project_ai_driven_bank` this is a real-counsel-and-auditor licence- " +
      "application-moment item. Audit Committee constitution is upstream — " +
      "currently substituted by Owen (Chief Company Secretary, governance)'s " +
      "Interim Audit Forum.",
  },
  {
    approvalId: "REG-KEY-INDIVIDUALS",
    authority: "FSCA + PA",
    approvalType: "Key Individuals (FAIS) + fit-and-proper directors appointed",
    status: "NotHeld",
    notes:
      "Wall-clock. FAIS Act s.8 fit-and-proper Key Individuals (typically " +
      "MLRO/FIC Compliance Officer; FAIS KI for each FSP category) require " +
      "FSCA approval before commencement. PA fit-and-proper for directors " +
      "required pre-licence-grant. Per `project_ai_driven_bank` minimum- " +
      "statutory humans (5–10) are appointed at licence-day; no KI " +
      "nominations submitted yet.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency: scan existing event store for prior v2 rehearsal events
// ─────────────────────────────────────────────────────────────────────────────

function gateAlreadyActivated(): boolean {
  for (const ev of eventStore.replay({ type: "GoLiveGateActivated" })) {
    const p = ev.payload as { gateId?: string };
    if (p.gateId === REHEARSAL_GATE_ID) return true;
  }
  return false;
}

function conditionAlreadyEmitted(conditionId: string): boolean {
  for (const ev of eventStore.replay({ type: "GoLiveConditionUpdated" })) {
    const p = ev.payload as { gateId?: string; conditionId?: string };
    if (p.gateId === REHEARSAL_GATE_ID && p.conditionId === conditionId) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw envelope helpers — the four GoLive types are still not in the registry
// (build-phase fail-open per `registry.ts` header). Codifying the types is
// queued as a substrate gap from v1; this v2 run does not introduce new types.
// ─────────────────────────────────────────────────────────────────────────────

function makeRawEvent(
  type: string,
  actor: { type: "service" | "human" | "system"; id: string },
  payload: Record<string, unknown>,
): Event {
  return {
    event_id: newEventId(),
    type,
    as_of: AS_OF,
    entity: ENTITY,
    actor,
    citations: [...CITATIONS],
    payload,
    provenance: REHEARSAL_PROVENANCE,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): number {
  let appended = 0;
  let skipped = 0;

  // 1. Gate activation envelope.
  if (!gateAlreadyActivated()) {
    const gateEvent = makeRawEvent("GoLiveGateActivated", ACTOR_DEVON, {
      gateId: REHEARSAL_GATE_ID,
      products: PRODUCT_SCOPE,
      activatedBy: "agent:devon:coo",
      activatedAt: AS_OF,
      rehearsal: true,
      rehearsalScope:
        "fx-spot internal pre-licence test — re-rehearsal (v2) confirming v1 Open conditions cleared",
      coChairs: ["agent:devon:coo", "agent:zara:cco"],
      proceduresRef: "PROC-MK-PLG-01",
      priorRehearsalGateId:
        "pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test",
      note:
        "REHEARSAL v2 — re-rehearsal under brief " +
        "`brief:devon:re-run-proc-mk-plg-01-rehearsal-confirm-both-ope:2026-05-21` " +
        "after CEO approval of D-NPA-FX-SPOT-INTERNAL-TEST (PR #674) and " +
        "D-BRC-INTERIM-MR-1-FX (PR #680). Distinct gateId reserved for this " +
        "v2 run; the production gate-id remains unfired. No " +
        "GoLiveReadinessAssessed or GoLiveReadinessConfirmed events will be " +
        "emitted.",
    });
    eventStore.append(gateEvent);
    appended += 1;
    logger.info(
      { gateId: REHEARSAL_GATE_ID, eventId: gateEvent.event_id },
      "GoLiveGateActivated (REHEARSAL v2) emitted",
    );
  } else {
    skipped += 1;
    logger.info(
      { gateId: REHEARSAL_GATE_ID },
      "GoLiveGateActivated v2 already in store — skipped (idempotent)",
    );
  }

  // 2. Condition envelopes.
  for (const c of CONDITIONS) {
    if (conditionAlreadyEmitted(c.conditionId)) {
      skipped += 1;
      continue;
    }
    const actor = c.signOff === "Zara" ? ACTOR_ZARA : ACTOR_DEVON;
    const conditionEvent = makeRawEvent("GoLiveConditionUpdated", actor, {
      gateId: REHEARSAL_GATE_ID,
      conditionId: c.conditionId,
      dimension: c.dimension,
      title: c.title,
      status: c.status,
      evidence: c.evidence,
      notes: c.notes,
      signOff: c.signOff,
      updatedAt: AS_OF,
      rehearsal: true,
    });
    eventStore.append(conditionEvent);
    appended += 1;
  }

  // 3. Print final report to stdout.
  printReport();

  logger.info({ appended, skipped }, "rehearsal v2 run complete");
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report rendering
// ─────────────────────────────────────────────────────────────────────────────

function countBy(
  cs: readonly ConditionAssessment[],
  status: ConditionAssessment["status"],
): number {
  return cs.filter((c) => c.status === status).length;
}

function printReport(): void {
  const npa = CONDITIONS.filter((c) => c.dimension === "NPA");
  const ops = CONDITIONS.filter((c) => c.dimension === "OPS");
  const satisfied = countBy(CONDITIONS, "Satisfied");
  const inProgress = countBy(CONDITIONS, "InProgress");
  const open = countBy(CONDITIONS, "Open");

  const openIds = CONDITIONS.filter((c) => c.status === "Open")
    .map((c) => c.conditionId)
    .join(", ");
  const inProgressIds = CONDITIONS.filter((c) => c.status === "InProgress")
    .map((c) => c.conditionId)
    .join(", ");

  const lines: string[] = [];
  lines.push("");
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("PROC-MK-PLG-01 — Pre-licence go-live readiness gate REHEARSAL v2");
  lines.push("Scope: fx-spot (internal pre-licence test) — re-rehearsal");
  lines.push(`Gate ID: ${REHEARSAL_GATE_ID}`);
  lines.push(
    "Prior gate ID: pre-licence-go-live-rehearsal-2026-05-21-fx-spot-internal-test (v1; PR #667)",
  );
  lines.push(`Run date: ${AS_OF.slice(0, 10)}`);
  lines.push("Activated by: Devon (Chief Operating Officer, governance)");
  lines.push("Compliance co-chair: Zara (Chief Compliance Officer, governance)");
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`NPA product-readiness (${npa.length} conditions):`);
  for (const c of npa) {
    lines.push(`  - ${c.conditionId}: ${c.status}  (${shortNote(c)})`);
  }
  lines.push("");
  lines.push(`OPS-readiness (${ops.length} conditions):`);
  for (const c of ops) {
    lines.push(`  - ${c.conditionId}: ${c.status}  (${shortNote(c)})`);
  }
  lines.push("");
  lines.push(
    `Regulatory approvals required (${REGULATORY_APPROVALS.length} items — NOT in 11 conditions):`,
  );
  for (const r of REGULATORY_APPROVALS) {
    lines.push(`  - ${r.approvalId}: ${r.status}  (wall-clock — ${r.authority})`);
  }
  lines.push("");
  lines.push("REHEARSAL v2 RESULT:");
  lines.push(`  - Conditions Satisfied: ${satisfied}/${CONDITIONS.length}`);
  lines.push(
    `  - Conditions InProgress (compensating control acceptable for internal test): ${inProgress}/${CONDITIONS.length}`,
  );
  lines.push(`  - Conditions Open (substantive gap): ${open}/${CONDITIONS.length}`);
  lines.push(`  - Regulatory approvals received: 0/${REGULATORY_APPROVALS.length} (wall-clock)`);
  lines.push("");
  lines.push(
    `PRODUCTION FIRE-READINESS (would need to fire actual gate): BLOCKED-BY-${open} substantive ` +
      `+ ${inProgress} compensating-control-only + ${REGULATORY_APPROVALS.length} wall-clock`,
  );
  if (openIds) lines.push(`  Open conditions: ${openIds}`);
  if (inProgressIds) lines.push(`  InProgress conditions: ${inProgressIds}`);
  lines.push("");
  const internalTestReady = open === 0;
  if (internalTestReady) {
    lines.push("INTERNAL-TEST FIRE-READINESS: READY-FOR-INTERNAL-TEST");
  } else {
    lines.push(`INTERNAL-TEST FIRE-READINESS: BLOCKED-BY-${openIds}`);
  }
  lines.push("");
  lines.push(
    "Note: this rehearsal does NOT emit GoLiveReadinessAssessed or GoLiveReadinessConfirmed.",
  );
  lines.push(
    "Those events require both co-chair quorum sign-offs AND CEO authority AND a real SARB",
  );
  lines.push("banking licence. None of those pre-conditions hold today.");
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("");

  console.log(lines.join("\n"));
}

function shortNote(c: ConditionAssessment): string {
  const firstSentence = c.notes.split(/[.!?]\s/)[0];
  if (firstSentence.length <= 120) return firstSentence;
  return `${firstSentence.slice(0, 117)}...`;
}

process.exit(main());
