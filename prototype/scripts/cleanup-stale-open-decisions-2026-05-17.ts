// scripts/cleanup-stale-open-decisions-2026-05-17.ts
//
// One-shot cleanup: close the 14 stale open decisions identified in the
// Scrooge session of 2026-05-17. Each falls into one of three buckets:
//
//   approved  — already resolved in the old workflow; Decision(approved) event
//               was never emitted under the new framework.
//   withdrawn — ghost IDs: referenced in markdown body text but no owning
//               decision pack was ever filed; work either resolved via another
//               decision or deferred until Azure spend / licence-gate.
//   session   — D-RMS-SLICE-5-OBLIGATION-CADENCE, CEO-approved in-session
//               2026-05-17 via Scrooge session-delegation.
//
// Idempotent: each decisionId is skipped if the projection already shows a
// terminal phase for it.
//
// Authority: CEO in-session approval, 2026-05-17 (Scrooge session-delegation).
// Author: Scrooge (Chief of Staff / Orchestrator).

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

// ---------------------------------------------------------------------------
// Already-resolved decisions — emit Decision(approved) backfill
// ---------------------------------------------------------------------------

interface ApprovedBackfill {
  decisionId: string;
  title: string;
  category: "engineering" | "governance" | "risk" | "compliance" | "product";
  resolvedAt: string;
  recommendation: string;
  rationale: string;
}

const APPROVED_BACKFILL: readonly ApprovedBackfill[] = [
  {
    decisionId: "D-FSP-LICENCE-NECESSITY",
    title: "FSP-licence necessity under FAIS — steady-state posture",
    category: "compliance",
    resolvedAt: "2026-05-09T08:00:00.000Z",
    recommendation:
      "Approve Posture A (confirm-A-no-research): the bank pursues an FSP licence under FAIS; Posture A is the steady-state. Saskia is the steady-state FAIS Key Individual. No PAX research dispatch required.",
    rationale:
      "CEO decision recorded 2026-05-09 via scrooge:ceo-decision-record (archive/owner-inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md). The asymmetry between wrong-A (over-investment) and wrong-B (FAIS s.7 contravention, criminal under s.36) warrants the conservative Posture A as steady-state. Decision(approved) event was not emitted under the new decisions framework; this backfill corrects that gap.",
  },
  {
    decisionId: "D-MARKETS-CAPITAL-TIME-SHAPE",
    title: "Markets franchise capital time-shape — approved split",
    category: "governance",
    resolvedAt: "2026-05-12T00:00:00.000Z",
    recommendation:
      "Approve: Build CapEx R5m (AI-driven posture, no dealing-room buildout); trading-book capital R150m (SA Standardised Approach); ILAAP liquidity buffer ~R125m. These are standing working assumptions for Saskia franchise design, Rohan RWA sizing, and Eitan ILAAP build.",
    rationale:
      "CEO approved 2026-05-12 per Saskia's markets-franchise-design-proposal §8 (archive/owner-inbox/2026-05-07_saskia_markets-franchise-design-proposal.md §6.1 revised 2026-05-12). Proposal was re-opened (corrective event 2026-05-11) to supersede a smoke-test mis-attribution. The underlying capital split was genuinely approved; Decision(approved) was never emitted under the new framework.",
  },
  {
    decisionId: "D-BANK-ACCOUNT-SUBSTRATE",
    title: "Bank-account event family + master/balance projections",
    category: "engineering",
    resolvedAt: "2026-05-11T00:00:00.000Z",
    recommendation:
      "Approve: BankAccountOpened + BankAccountConfigured + BankAccountClosed event types; accounts.master and accounts.balance projections under prototype/platform/projections/accounts/. Delivered under D-FIRST-DRY-RUN-SCENARIO standing authority.",
    rationale:
      "Delivered 2026-05-10/11 under standing CEO approval of D-FIRST-DRY-RUN-SCENARIO (2026-05-10), which adopted D-BANK-ACCOUNT-SUBSTRATE as sub-decision #A1 (archive/owner-inbox/2026-05-10_tomas-atlas-bea_d-bank-account-substrate.md). Owen's governance-cycle-prep 2026-05-14 shows approved action. Decision(approved) event was not emitted under the new framework; this backfill corrects that gap.",
  },
  {
    decisionId: "D-SCENARIO-CLOCK",
    title: "Scenario clock substrate — controlled time for simulated scenarios",
    category: "engineering",
    resolvedAt: "2026-05-10T00:00:00.000Z",
    recommendation:
      "Approve: WallClock + SimulatedClock composition substrate under prototype/platform/scenario-clock/. Default production behaviour unchanged; scenarios opt in via env-var. No new CEO decision required — delivered under D-FIRST-DRY-RUN-SCENARIO standing authority.",
    rationale:
      "Delivered 2026-05-10 under standing CEO approval of D-FIRST-DRY-RUN-SCENARIO (2026-05-10), dispatch #A2 (archive/owner-inbox/2026-05-10_atlas_d-scenario-clock.md). Atlas noted explicitly: 'No new CEO decision required.' Decision(approved) event was not emitted under the new framework; this backfill corrects that gap.",
  },
  {
    decisionId: "D-PARTY-REGISTER",
    title: "Party register — unified identity axis for all actor kinds",
    category: "governance",
    resolvedAt: "2026-05-11T00:00:00.000Z",
    recommendation:
      "Approve: Party register at Regulations/_party-register.md as the eighth standing register; unified identity axis across natural-person, legal-entity, counterparty, and agent actor kinds. Founding CEO seat (Marc) registered as first natural-person Party.",
    rationale:
      "CEO-approved 2026-05-11 per D-PARTY-REGISTER (referenced in CLAUDE.md as 'CEO-approved 2026-05-11'). Party substrate (PRs 1-3 of 5) landed during the 2026-05-11 session. Decision(approved) event was not emitted under the new framework; this backfill corrects that gap.",
  },
  {
    decisionId: "D-RMS-PHASE-4-ARCHIVE-SCOPE",
    title: "RMS Phase 4 archive scope — full move of all four inbox directories",
    category: "governance",
    resolvedAt: "2026-05-17T00:00:00.000Z",
    recommendation:
      "Approve: full move of Owner Inbox/, Owner Inbox/actioned/, Team Inbox/, Team Inbox/actioned/ to archive/ at Phase 4 cutover; dashboard legacy parser removed; RMS registers become sole canonical source.",
    rationale:
      "CEO-approved 2026-05-17 per D-RMS-PHASE-4-ARCHIVE-SCOPE (referenced in CLAUDE.md as 'D-RMS-PHASE-4-ARCHIVE-SCOPE CEO-approved 2026-05-17 — full move, all four directories'). Decision(approved) event was not emitted under the new framework; this backfill corrects that gap.",
  },
  {
    decisionId: "D-T-01-PERMISSION-GATE-SECURE-DEFAULT",
    title: "T-01 permission-gate secure-default — authority corrected to CISO",
    category: "engineering",
    resolvedAt: "2026-05-17T19:00:00.000Z",
    recommendation:
      "Withdraw from CEO queue — permission-gate secure-default is a security-architecture standard that falls within CISO (Rashida) authority, not CEO authority. Rashida to issue Decision(approved) under CISO authority surface once operationalised.",
    rationale:
      "Owen's authority-gap brief (Owner Inbox/2026-05-17_owen_authority-gap-five-seats.md) identifies D-T-01-PERMISSION-GATE-SECURE-DEFAULT as a CEO-over-attribution: 'Permission-gate secure-default — a security-architecture standard that falls within Rashida's threat-model-gate authority surface.' Withdrawing from CEO queue; routing to CISO authority surface per D-DECISIONS-FRAMEWORK-REDESIGN.",
  },
];

// ---------------------------------------------------------------------------
// Ghost IDs — referenced in body text, no owning record; withdraw
// ---------------------------------------------------------------------------

interface GhostWithdrawal {
  decisionId: string;
  title: string;
  rationale: string;
}

const GHOST_WITHDRAWALS: readonly GhostWithdrawal[] = [
  {
    decisionId: "D-OWNER-INBOX-AUTO-ARCHIVE",
    title: "Owner Inbox auto-archive — ghost reference ID",
    rationale:
      "Referenced in body text during RMS Phase 2/3 authoring; no formal decision pack was ever filed. The underlying capability (auto-archive on CeoDecision event via scrooge-owner-inbox-archiver.ts) was delivered as part of RMS Phase 1 Slice 5 and Phase 3. Withdrawing ghost ID; the delivered work stands under D-RMS-PHASE-1 / D-RMS-PHASE-3 authority.",
  },
  {
    decisionId: "D-REGULATORY-PERIMETER",
    title: "Regulatory perimeter definition — ghost reference ID",
    rationale:
      "Referenced in body text as a placeholder for a future regulatory-perimeter decision pack; no pack was ever authored. Regulatory perimeter is implicit in the licence-type, group-structure, and obligations-register work. Withdrawing ghost ID; will be addressed at the licence-application gate if counsel requires a formal resolution.",
  },
  {
    decisionId: "D-GROUP-STRUCTURE",
    title: "Group structure — ghost reference ID",
    rationale:
      "Referenced in body text; no formal decision pack filed. Build-phase group structure is single-entity (Hoz Bank, LE-ZA-HOZ-BANK). Multi-entity / group consolidation is sequenced in D-DRY-RUN-SCENARIO-V2 (deferred). Withdrawing ghost ID; group-structure design will land as a named decision when Hoz Securities is introduced post-licence.",
  },
  {
    decisionId: "D-LICENCE-TYPE",
    title: "Licence type — ghost reference ID",
    rationale:
      "Referenced in body text as a placeholder for the SARB licence-type determination. The bank operates under the Banks Act 94 of 1990; licence-type specifics are addressed at the pre-application gate (Saskia + Imani + counsel). No standalone decision pack required in the build phase. Withdrawing ghost ID; the licence-type determination is a licence-application-gate deliverable.",
  },
  {
    decisionId: "D-FX-CLS-MEMBERSHIP",
    title: "FX CLS membership — ghost reference ID",
    rationale:
      "Referenced in body text as a consideration for FX settlement. Resolved implicitly by the indirect-participant operating posture (D-INDIRECT-PARTICIPANT confirmed 2026-05-07): the bank does not directly join CLS; FX settlement routes via correspondent bank. No standalone CEO decision required. Withdrawing ghost ID.",
  },
  {
    decisionId: "D-AZURE-COST-BUDGET",
    title: "Azure cost budget — ghost reference ID",
    rationale:
      "Referenced in body text as a future cost-envelope decision. No Azure spend has commenced in the build phase (cloud target is local-dev with Azure lift planned post-licence). No CEO budget decision is required until Azure spend is real. Withdrawing ghost ID; will be revived as a live decision when Azure migration begins.",
  },
];

// ---------------------------------------------------------------------------
// Session-delegation approval: D-RMS-SLICE-5-OBLIGATION-CADENCE
// ---------------------------------------------------------------------------

// Marc approved this in-session 2026-05-17 via Scrooge session-delegation.

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function main() {
  const source = decisionsSourceFromStore(eventStore);
  const { byId } = buildDecisionsRegister(source);

  let approved = 0;
  let withdrawn = 0;
  let skipped = 0;

  // 1. Session-delegation approval: D-RMS-SLICE-5-OBLIGATION-CADENCE
  const cadenceId = "D-RMS-SLICE-5-OBLIGATION-CADENCE";
  const cadenceHistory = byId.get(cadenceId);
  if (cadenceHistory && cadenceHistory.head.phase !== "requested") {
    console.log(`[SKIP] ${cadenceId} already at phase: ${cadenceHistory.head.phase}`);
    skipped++;
  } else {
    recordDecision(
      {
        decisionId: cadenceId,
        phase: "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: "RMS Phase 1 Slice 5 — obligation cadence: monthly register snapshots",
        category: "governance",
        recommendation:
          "Approve monthly cadence for RMS register snapshots filed as Records-of-agent-runs, aligned to the lowest-frequency regulatory reporting cycle consuming register data. Obligation-cadence events do NOT gate Slice 5 completion — the round-trip substrate chain is already complete; cadence is operational configuration, not a substrate prerequisite.",
        rationale:
          "CEO approved 2026-05-17 via Scrooge in-session session-delegation. Monthly aligns with FIC s.42 update pattern (e2e roundtrip fixture recommendation). Not gating Slice 5 keeps the completion criterion clean: the substrate works when the event chain round-trips correctly; frequency is an operator dial, not a gate.",
        recordedVia: "scrooge:session-delegation",
        actor: { type: "human", id: "marc@tgv.co.za" },
      },
      "2026-05-17T19:30:00.000Z",
    );
    console.log(`[APPROVED] ${cadenceId} — monthly cadence, session-delegation`);
    approved++;
  }

  // 2. Approved backfill
  for (const d of APPROVED_BACKFILL) {
    const history = byId.get(d.decisionId);
    const headPhase = history?.head.phase;

    // D-T-01 is a withdrawal despite being in the "approved" list
    if (d.decisionId === "D-T-01-PERMISSION-GATE-SECURE-DEFAULT") {
      if (headPhase && headPhase !== "requested") {
        console.log(`[SKIP] ${d.decisionId} already at phase: ${headPhase}`);
        skipped++;
        continue;
      }
      recordDecision(
        {
          decisionId: d.decisionId,
          phase: "withdrawn",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: d.title,
          category: d.category,
          recommendation: d.recommendation,
          rationale: d.rationale,
          recordedVia: "backfill:stale-open-decisions-2026-05-17",
          actor: { type: "service", id: "agent:scrooge" },
        },
        "2026-05-17T19:30:01.000Z",
      );
      console.log(`[WITHDRAWN] ${d.decisionId} — authority corrected to CISO`);
      withdrawn++;
      continue;
    }

    if (headPhase && headPhase !== "requested") {
      console.log(`[SKIP] ${d.decisionId} already at phase: ${headPhase}`);
      skipped++;
      continue;
    }

    recordDecision(
      {
        decisionId: d.decisionId,
        phase: "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: d.title,
        category: d.category,
        recommendation: d.recommendation,
        rationale: d.rationale,
        recordedVia: "backfill:stale-open-decisions-2026-05-17",
        actor: { type: "human", id: "marc@tgv.co.za" },
      },
      d.resolvedAt,
    );
    console.log(`[APPROVED] ${d.decisionId}`);
    approved++;
  }

  // 3. Ghost ID withdrawals
  for (const g of GHOST_WITHDRAWALS) {
    const history = byId.get(g.decisionId);
    const headPhase = history?.head.phase;

    if (headPhase && headPhase !== "requested") {
      console.log(`[SKIP] ${g.decisionId} already at phase: ${headPhase}`);
      skipped++;
      continue;
    }

    recordDecision(
      {
        decisionId: g.decisionId,
        phase: "withdrawn",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: g.title,
        category: "governance",
        recommendation: `Withdraw ghost reference ID — ${g.title}`,
        rationale: g.rationale,
        recordedVia: "backfill:stale-open-decisions-2026-05-17",
        actor: { type: "service", id: "agent:scrooge" },
      },
      "2026-05-17T19:30:02.000Z",
    );
    console.log(`[WITHDRAWN] ${g.decisionId}`);
    withdrawn++;
  }

  console.log(`\nDone: ${approved} approved, ${withdrawn} withdrawn, ${skipped} skipped.`);
}

main();
