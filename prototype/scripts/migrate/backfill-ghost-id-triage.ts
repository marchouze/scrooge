// scripts/migrate/backfill-ghost-id-triage.ts
//
// Closes the 17 ghost decision IDs that were created by the body-text
// scanner in backfill-all-decisions.ts. Each was emitted as a
// Decision(requested) placeholder. This script emits the correct terminal
// (or updated-requested) event for each, based on manual source triage.
//
// Idempotent: each entry is skipped if the projection already shows a
// terminal phase for that decisionId.
//
// Categories:
//   approved   — decision was actually made; work delivered or posture adopted
//   superseded — umbrella shorthand ID; the canonical governing decision has
//                a different ID
//   withdrawn  — never intended as a formal decision (hypothetical, informational)
//   deferred   — explicitly scoped as future sequenced work
//   open       — genuinely pending; emit updated requested event with proper content
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
// Author: Scrooge (session-delegation, 2026-05-16)

import { eventStore } from "../../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
import { recordDecision, requestDecision } from "../../runtime/decisions/record";

interface GhostEntry {
  decisionId: string;
  title: string;
  category: "engineering" | "governance" | "risk" | "compliance" | "product" | "other";
  phase: "approved" | "superseded" | "withdrawn" | "deferred" | "open";
  asOf: string;
  recommendation: string;
  rationale: string;
}

const GHOST_ENTRIES: readonly GhostEntry[] = [
  // -----------------------------------------------------------------------
  // APPROVED — decision was made; work delivered or regulatory posture adopted
  // -----------------------------------------------------------------------
  {
    decisionId: "D-FX-AD-STATUS",
    title: "FX Authorised Dealer status — Full AD under Currency and Exchanges Act 9 of 1933",
    category: "governance",
    phase: "approved",
    asOf: "2026-05-07T09:00:00Z",
    recommendation:
      "Approve — establish the bank as a Full Authorised Dealer under the Currency and Exchanges Act 9 of 1933",
    rationale:
      "Full AD status (not partial / restricted) is required for the bank's institutional global-markets franchise. It gives the bank authority to deal in foreign exchange on behalf of clients and on own account, subject to the Currency and Exchanges Manual. Approved as part of the FX sub-decisions pack (2026-05-07) alongside D-FX-BOOK-BOUNDARY. Source: Owner Inbox/2026-05-07_ceo-decisions_fx-sub-decisions.md.",
  },
  {
    decisionId: "D-FX-BOOK-BOUNDARY",
    title: "FX book boundary — explicit-tag-at-execution model",
    category: "engineering",
    phase: "approved",
    asOf: "2026-05-07T09:00:00Z",
    recommendation:
      "Approve — explicit-tag-at-execution model for FX book boundary (trading vs banking book)",
    rationale:
      "FRTB requires unambiguous trading/banking-book classification at the point of execution; retroactive reclassification is prohibited. Explicit-tag-at-execution — every trade event carries a BookBoundary tag set at ticket time — is the simplest correct model given the bank's clean-slate architecture. Approved alongside D-FX-AD-STATUS in the FX sub-decisions pack (2026-05-07). Source: Owner Inbox/2026-05-07_ceo-decisions_fx-sub-decisions.md.",
  },
  {
    decisionId: "D-EVENT-STORE-SCALING-SLICE-3B",
    title:
      "Event Store Scaling Slice 3b — remove dashboard-state.json from commit graph; recon derives from sources directly",
    category: "engineering",
    phase: "approved",
    asOf: "2026-05-10T07:59:48Z",
    recommendation:
      "Approve — remove dashboard-state.json from the commit graph; all dashboard derivation runs from event-store sources directly",
    rationale:
      "Committing derived projection output into git creates N² merge friction and allows stale cached state to mask event-store drift (the cache-in-commit-graph anti-pattern). Slice 3b eliminates the committed cache: the recon harness re-derives on every CI run from the canonical event store, making drift structurally impossible. PR #157 delivered the change (2026-05-10). Source: Owner Inbox/actioned/2026-05-10_atlas_d-event-store-scaling-slice-3b-cache-from-commit-graph.md.",
  },
  {
    decisionId: "D-EXTERNAL-COUNSEL",
    title: "External legal counsel engagement model — defer until SARB pre-application gate",
    category: "governance",
    phase: "approved",
    asOf: "2026-05-09T09:22:51Z",
    recommendation:
      "Approve Option C — defer external legal counsel engagement until a SARB licence-application date is set; scope-bounded project mandate at that point",
    rationale:
      "The build-phase operating model (CLAUDE.md) holds no real professional fees until counsel / auditor is required. Imani's (Legal-as-code engineer) recommendation (Option C) is consistent with that posture: no retainer, no panel arrangement during build; engage a scope-bounded project team at the pre-application gate. Retained counsel adds cost and governance friction before we have transactions to counsel on. Approved via dashboard curated S5 (2026-05-09T09:22:51Z). Source: Owner Inbox/actioned/2026-05-09_imani_external-counsel-licence-application.md.",
  },
  {
    decisionId: "D-API-CLOUD-COST-BUDGET",
    title: "API + cloud cost budget — Balanced envelope (USD 1,500–3,500/month)",
    category: "governance",
    phase: "approved",
    asOf: "2026-05-09T10:00:00Z",
    recommendation:
      "Approve Balanced envelope — Anthropic API budget target USD 1,500–3,500/month; Camille (CFO) weekly snapshot; Azure placeholder deferred to M8",
    rationale:
      "The Lean envelope (USD 500–1,500/mo) caps agent parallelism and slows substrate build velocity. The Accelerated envelope (USD 3,500–7,500+/mo) requires CapEx approval not yet in place. The Balanced envelope sustains current build pace and keeps weekly actuals within Camille's (CFO) direct-report cadence without requiring a board-level CapEx motion. Azure cost projection deferred to M8 phase when the lift plan lands. Source: Owner Inbox/actioned/2026-05-09_camille_api-cloud-cost-budget.md.",
  },

  // -----------------------------------------------------------------------
  // SUPERSEDED — umbrella shorthand IDs; canonical governing decision has
  //              a different ID already resolved in the register
  // -----------------------------------------------------------------------
  {
    decisionId: "D-REPORTING-CAPABILITY-M2-M3",
    title: "M2/M3 Reporting Capability — umbrella reference (superseded by build plan)",
    category: "engineering",
    phase: "superseded",
    asOf: "2026-05-10T07:35:00Z",
    recommendation:
      "Superseded — the canonical governing decision is D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)",
    rationale:
      "This ID was used in deliverable body text as a shorthand for the M2/M3 reporting capability scope. The actual approved decision — the 8-slice build plan including Q1–Q5 defaults, budget authorisation, and agent dispatch — is recorded as D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (approved 2026-05-10). The body-text reference was never a separate formal decision request; closing as superseded by the governing build-plan decision.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2",
    title: "Regulatory Readiness W2 — umbrella wave reference (superseded by gate plan)",
    category: "compliance",
    phase: "superseded",
    asOf: "2026-05-10T08:06:51Z",
    recommendation:
      "Superseded — the canonical governing decision is D-REGULATORY-READINESS-GATE-PLAN (CEO-modified 2026-05-10)",
    rationale:
      "D-REGULATORY-READINESS-W2 was referenced in deliverable body text as a shorthand for the W2 regulatory-readiness wave (ICAAP/ILAAP/Recovery framework). The formal governing decision for the regulatory-readiness programme is D-REGULATORY-READINESS-GATE-PLAN (CEO-modified 2026-05-10, PR #150) which covers the gate structure, W1 and W2 scopes, and the authorisation for Zara (CCO) + Helena (CRO) to proceed. Body-text reference was not a separate formal request.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2-SLICE-1",
    title: "Regulatory Readiness W2 Slice 1 — ICAAP/ILAAP/Recovery framework spec (superseded)",
    category: "compliance",
    phase: "superseded",
    asOf: "2026-05-10T08:06:51Z",
    recommendation:
      "Superseded — the W2 Slice 1 scope is authorised under D-REGULATORY-READINESS-GATE-PLAN (CEO-modified 2026-05-10)",
    rationale:
      "The slice-level execution under W2 is authorised by D-REGULATORY-READINESS-GATE-PLAN via the gate-plan's agent dispatch (no-pause rule). D-REGULATORY-READINESS-W2-SLICE-1 was never a standalone CEO decision — it was extracted from body text in deliverables that cited the slice ID as a scoping reference. The governing authority is the gate plan; this slice ID is closing as superseded.",
  },
  {
    decisionId: "D-M4-FX-SUB-1",
    title: "M4 FX Sub-Decision 1 — correspondent bank pair selection (superseded)",
    category: "product",
    phase: "superseded",
    asOf: "2026-05-09T07:04:57Z",
    recommendation:
      "Superseded — the canonical governing decision is D-M4-FX-SUB-DECISIONS (CEO-approved 2026-05-09)",
    rationale:
      "D-M4-FX-SUB-1 was a body-text reference to Sub-Decision 1 within the M4 FX sub-decisions pack. The pack (D-M4-FX-SUB-DECISIONS) was approved in one go 2026-05-09 covering all three sub-decisions. No separate CEO decision record exists for D-M4-FX-SUB-1; closing as superseded by the pack decision.",
  },
  {
    decisionId: "D-M4-FX-SUB-2",
    title: "M4 FX Sub-Decision 2 — FinSurv URN cluster wave 1 (superseded)",
    category: "compliance",
    phase: "superseded",
    asOf: "2026-05-09T07:04:57Z",
    recommendation:
      "Superseded — the canonical governing decision is D-M4-FX-SUB-DECISIONS (CEO-approved 2026-05-09)",
    rationale:
      "D-M4-FX-SUB-2 was a body-text reference to Sub-Decision 2 within the M4 FX sub-decisions pack. Approved as part of D-M4-FX-SUB-DECISIONS in one go 2026-05-09. No separate CEO decision record; closing as superseded.",
  },
  {
    decisionId: "D-M4-FX-SUB-3",
    title: "M4 FX Sub-Decision 3 — FX spot outsourcing procedure (superseded)",
    category: "governance",
    phase: "superseded",
    asOf: "2026-05-09T07:04:57Z",
    recommendation:
      "Superseded — the canonical governing decision is D-M4-FX-SUB-DECISIONS (CEO-approved 2026-05-09)",
    rationale:
      "D-M4-FX-SUB-3 was a body-text reference to Sub-Decision 3 within the M4 FX sub-decisions pack. Approved as part of D-M4-FX-SUB-DECISIONS in one go 2026-05-09. No separate CEO decision record; closing as superseded.",
  },
  {
    decisionId: "D-S7-TARGETED-3-5",
    title: "S7-Targeted items 3-5 — parent strategy reference (superseded)",
    category: "engineering",
    phase: "superseded",
    asOf: "2026-05-09T07:16:45Z",
    recommendation:
      "Superseded — the canonical governing decision is D-S7-TARGETED-3-5-OPEN-QUESTIONS (CEO-approved 2026-05-08)",
    rationale:
      "D-S7-TARGETED-3-5 was the parent scope ID for the S7-Targeted slice items 3-5. The formal decision resolving the three open questions (A: rehearsal-grade · B: per-entity sub-ledgers · C: close at M2 acceptance) was recorded as D-S7-TARGETED-3-5-OPEN-QUESTIONS (CEO-approved 2026-05-08, PR #50). No standalone D-S7-TARGETED-3-5 CEO decision record exists; closing as superseded by the open-questions decision.",
  },

  // -----------------------------------------------------------------------
  // WITHDRAWN — never intended as formal decisions
  // -----------------------------------------------------------------------
  {
    decisionId: "D-INTERIM-OPERATING-POSTURE",
    title: "Interim operating posture — informational record (withdrawn)",
    category: "governance",
    phase: "withdrawn",
    asOf: "2026-05-06T12:00:00Z",
    recommendation:
      "Withdraw — this was an informational record (decision-required: false), not a formal decision request",
    rationale:
      "Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md has decision-required: false and was filed as a status record, not a decision brief. The operating posture it describes (build-only; no live trading until SARB licence) is established by the strategic foundation and CLAUDE.md operating model, not by a separate standalone decision. The body-text scanner created a spurious Decision(requested) event; withdrawing to clear the register.",
  },
  {
    decisionId: "D-A22-RETIRE-BUS",
    title: "A22 — retire the event bus (withdrawn — explicitly hypothetical)",
    category: "engineering",
    phase: "withdrawn",
    asOf: "2026-05-09T12:00:00Z",
    recommendation:
      "Withdraw — explicitly labelled hypothetical in the A22 dispatcher spec; no retirement of the bus is planned",
    rationale:
      "The A22 dispatcher retirement spec (Owner Inbox/actioned/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md) states verbatim: 'rolling back the bus would require its own decision (D-A22-RETIRE-BUS, hypothetical). The cutover is about which dispatcher is canonical, not whether the bus exists at all.' The ID was a rhetorical placeholder, not a real request. The bus continues as substrate. Withdrawing.",
  },

  // -----------------------------------------------------------------------
  // DEFERRED — explicitly scoped as future sequenced work
  // -----------------------------------------------------------------------
  {
    decisionId: "D-EQ-SALES-TRADING-FRONTEND",
    title: "Equities sales & trading front-end — deferred pending M1 equities backend parity",
    category: "product",
    phase: "deferred",
    asOf: "2026-05-10T10:00:00Z",
    recommendation:
      "Defer — fire as a standalone decision pack (Kai + Saskia as authors) when M1 equities backend reaches parity with the FX stack",
    rationale:
      "The FX sales & trading front-end proposal (Owner Inbox/actioned/2026-05-10_kai-saskia_fx-sales-trading-front-end-proposal.md) explicitly sequences the equities frontend: 'When M1 equities backend reaches parity with FX (CDM + pre-trade-gateway integration + routing), fire as a separate D-EQ-SALES-TRADING-FRONTEND decision pack (Kai+Saskia author).' The trigger is a future substrate milestone, not a current request. Deferring until M1 equities stack is complete.",
  },
  {
    decisionId: "D-DRY-RUN-SCENARIO-V2",
    title: "Dry-run Scenario V2 — multi-entity + group consolidation (deferred)",
    category: "engineering",
    phase: "deferred",
    asOf: "2026-05-10T10:34:20Z",
    recommendation:
      "Defer — V2 scope (multi-entity / group consolidation / Hoz Securities) sequences after first dry-run scenario Phases A–D complete",
    rationale:
      "The first dry-run scenario design (Owner Inbox/actioned/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md) explicitly reserves V2 scope: 'Group consolidation and Hoz Securities folded into D-DRY-RUN-SCENARIO-V2.' and 'One legal entity: Hoz Bank (LE-ZA-HOZ-BANK). Group consolidation and Hoz Securities folded into D-DRY-RUN-SCENARIO-V2.' V2 is a sequenced follow-on, not a current parallel request. Deferring until Phases A–D of the first scenario are complete.",
  },
];

// For the one genuinely open ghost that needs an updated requested event
// (D-RMS-SLICE-5-OBLIGATION-CADENCE) — handled via requestDecision below.

async function main(): Promise<void> {
  const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  const terminalIds = new Set(register.resolved.map((r) => r.decisionId));

  let emitted = 0;
  let skipped = 0;

  for (const entry of GHOST_ENTRIES) {
    if (terminalIds.has(entry.decisionId)) {
      console.log(`SKIP  ${entry.decisionId} — already resolved`);
      skipped++;
      continue;
    }

    if (entry.phase === "open") continue; // handled separately

    recordDecision(
      {
        decisionId: entry.decisionId,
        phase: entry.phase,
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: entry.title,
        category: entry.category,
        recommendation: entry.recommendation,
        rationale: entry.rationale,
        sourceDocHashes: [],
        citations: [],
        recordedVia: "backfill:decisions-framework-cutover",
      },
      entry.asOf,
    );

    console.log(`EMIT  ${entry.decisionId} → ${entry.phase} @ ${entry.asOf}`);
    emitted++;
  }

  // Update D-RMS-SLICE-5-OBLIGATION-CADENCE with proper content.
  // The ghost requested event has a placeholder title; emit a new requested
  // event (the projection takes the latest head) with substantive content.
  const rmsSliceId = "D-RMS-SLICE-5-OBLIGATION-CADENCE";
  const rmsSliceHistory = register.byId.get(rmsSliceId);
  const hasGoodContent =
    rmsSliceHistory?.head.title !== `${rmsSliceId} (referenced, no owning record)`;
  if (!terminalIds.has(rmsSliceId) && !hasGoodContent) {
    requestDecision(
      {
        decisionId: rmsSliceId,
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: "RMS Phase 1 Slice 5 — obligation cadence for periodic register snapshots",
        category: "governance",
        recommendation:
          "Decide the cadence at which RMS register snapshots are filed as Records-of-agent-runs, and whether obligation-cadence events gate the Slice 5 completion criteria",
        rationale:
          "The RMS Phase 1 Slice 5 end-to-end round-trip (Owner Inbox/actioned/2026-05-10_anya-owen_rms-phase-1-slice-5-e2e-roundtrip.md) identified obligation-cadence configuration as a follow-on: at what frequency should the projection-runtime snapshot its register state, and what triggers that snapshot? This determines retention policy for Records-of-agent-runs and the lifecycle hooks for the Workstreams register. Requires CEO input on cadence preference before Owen (CoSec) and Anya (Data / analytics engineer) finalise the Slice 5 completion criteria.",
        sourceDocHashes: [],
        citations: [],
        recordedVia: "backfill:decisions-framework-cutover",
      },
      "2026-05-10T12:00:00Z",
    );
    console.log(`EMIT  ${rmsSliceId} → requested (updated with proper content)`);
    emitted++;
  } else {
    console.log(
      `SKIP  ${rmsSliceId} — ${terminalIds.has(rmsSliceId) ? "already resolved" : "content already updated"}`,
    );
    skipped++;
  }

  console.log(`\nDone: ${emitted} emitted, ${skipped} skipped.`);

  // Verify
  const updated = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  const ghostsStillOpen = updated.open.filter(
    (r) =>
      r.title.includes("no owning record") &&
      GHOST_ENTRIES.some((e) => e.decisionId === r.decisionId),
  );
  if (ghostsStillOpen.length > 0) {
    console.error(`\nWARN: ${ghostsStillOpen.length} ghost(s) still open after triage:`);
    for (const r of ghostsStillOpen) console.error(`  ${r.decisionId}`);
  } else {
    console.log("\nVerified: all triaged ghosts are closed or updated.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
