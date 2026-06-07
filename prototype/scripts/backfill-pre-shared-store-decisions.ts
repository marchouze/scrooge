// scripts/backfill-pre-shared-store-decisions.ts
//
// Backfill Decision events for 26 decision IDs that have work merged to main
// but no event in the canonical shared store.
//
// Two root causes:
//   Group A — events were emitted to a worktree-local store before
//             D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21); those stores
//             are gone, the event IDs are recorded in commit messages but
//             unreachable.
//   Group B — PRs merged with "approved" in the title but the Decision event
//             ceremony was never performed (pre-shared-store era or simple gap).
//
// CEO session-delegation approval: Marc (marc@tgv.co.za), 2026-05-26.
// CRO decisions (D-MR-PROC-S8-2-*): Helena acting as CRO; CEO noted.
//
// Idempotent: skips any decision that already has a terminal-phase event.
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/backfill-pre-shared-store-decisions.ts

import { eventStore } from "../platform/composition";
import { DECISION_TERMINAL_PHASES } from "../platform/event-store/event-types/decision";
import type {
  DecisionAuthority,
  DecisionCategory,
} from "../platform/event-store/event-types/decision";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const TERMINAL = new Set(DECISION_TERMINAL_PHASES);

interface Closure {
  decisionId: string;
  phase: "approved" | "rejected" | "withdrawn";
  authority: DecisionAuthority;
  authorityRef: string;
  category: DecisionCategory;
  title: string;
  recommendation: string;
  rationale: string;
  asOf: string;
  recordedVia: "backfill:pre-shared-store" | "backfill:pre-event-ceremony";
}

const CLOSURES: Closure[] = [
  // -------------------------------------------------------------------------
  // Group A — events emitted to wrong/lost store (pre-D-CROSS-WORKTREE-EVENT-STORE-SYNC)
  // Commit messages record specific event UUIDs that are no longer reachable.
  // -------------------------------------------------------------------------
  {
    decisionId: "D-KG-GRAPHITI-SPIKE-FX-SPOT",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Spike Graphiti as unified knowledge-graph substrate on FX-Spot slice",
    recommendation:
      "Authorize Atlas to spike Graphiti (Zep AI) as unified knowledge-graph substrate on FX-Spot product slice.",
    rationale:
      "Marc approved in-session 2026-05-21 via Scrooge session delegation. Original event 1baf1c2a emitted to worktree-local store (pre-D-CROSS-WORKTREE-EVENT-STORE-SYNC). Backfilled 2026-05-26.",
    asOf: "2026-05-21T17:06:09.000Z",
    recordedVia: "backfill:pre-shared-store",
  },
  {
    decisionId: "D-KG-GRAPHITI-ADOPT",
    phase: "rejected",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Reject Graphiti adoption — existing TS/SQLite substrate remains canonical",
    recommendation:
      "Close Atlas PR #706 without merge; existing TypeScript/SQLite knowledge-graph substrate at prototype/platform/regulatory/graph/ remains canonical.",
    rationale:
      "Marc rejected in-session 2026-05-21: spike LLM tier returned 401 (never executed), JSONL store is overwrite-on-ingest (bitemporal drift unvalidated), existing substrate more salvageable than assumed. Original event 41704564 emitted to worktree-local store (pre-D-CROSS-WORKTREE-EVENT-STORE-SYNC). Backfilled 2026-05-26.",
    asOf: "2026-05-21T17:34:11.000Z",
    recordedVia: "backfill:pre-shared-store",
  },
  {
    decisionId: "D-ONTOLOGY-REG-EXTRACTION-PHASE-1",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title:
      "Ontology Phase 1 — regulations extraction (Mira) + URN normalisation (Owen) + obligation substrate (Atlas)",
    recommendation:
      "Authorize Mira's Phase 1 regulations-only extraction, Owen's canonical URN vocabulary, and Atlas's obligation-review substrate as sequenced dispatch.",
    rationale:
      "Marc approved in-session 2026-05-21 via Scrooge session delegation. Original event 1b2dc554 emitted to worktree-local store (pre-D-CROSS-WORKTREE-EVENT-STORE-SYNC). Backfilled 2026-05-26.",
    asOf: "2026-05-22T07:29:12.000Z",
    recordedVia: "backfill:pre-shared-store",
  },
  {
    decisionId: "D-URN-CANONICAL-VOCABULARY",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Canonical URN vocabulary for obligations register",
    recommendation:
      "Authorize Owen to build canonical URN vocabulary and obligations register as precondition for ontology extraction.",
    rationale:
      "Marc approved in-session 2026-05-21 via Scrooge session delegation. Original event 3a3deae9 emitted to worktree-local store (pre-D-CROSS-WORKTREE-EVENT-STORE-SYNC). Backfilled 2026-05-26.",
    asOf: "2026-05-22T07:29:12.000Z",
    recordedVia: "backfill:pre-shared-store",
  },
  {
    decisionId: "D-OBLIGATION-REVIEW-SUBSTRATE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Obligation-review event substrate and advisory recon",
    recommendation:
      "Authorize Atlas to build obligation-review event substrate with advisory recon as precondition for extraction work.",
    rationale:
      "Marc approved in-session 2026-05-21 via Scrooge session delegation. Original event b913e7c0 emitted to worktree-local store (pre-D-CROSS-WORKTREE-EVENT-STORE-SYNC). Backfilled 2026-05-26.",
    asOf: "2026-05-22T07:29:12.000Z",
    recordedVia: "backfill:pre-shared-store",
  },

  // -------------------------------------------------------------------------
  // Group B — work merged, no Decision event ever emitted to any store
  // -------------------------------------------------------------------------
  {
    decisionId: "D-GROUP-STRUCTURE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "Legal-entity tree v0 — Hoz Group + Hoz Bank + Hoz Securities",
    recommendation:
      "Register three v0 entities: Hoz Group Ltd (holdco), Hoz Bank Ltd (SARB banking-licence subsidiary), Hoz Securities Ltd (FSCA FSP/DAI subsidiary).",
    rationale:
      "PR #80 merged 2026-05-09. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-09T07:26:21.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-FSP-LICENCE-NECESSITY",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "compliance",
    title: "Counterparty institutional-eligibility screening v0",
    recommendation:
      "Ship CounterpartyEligibilityScreened/Revalidated/Breached event family, PROC-CRM-CIE-01 stub, and 11 test cases.",
    rationale:
      "PR #77 merged 2026-05-09. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-09T07:26:15.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-REGULATORY-PERIMETER",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "Regulatory-perimeter framework — shared-board posture + per-entity statutory officers",
    recommendation:
      "Extend governance framework §3F with shared-board posture across three Hoz entities and per-entity statutory officers table.",
    rationale:
      "PR #93 merged 2026-05-09. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-09T08:29:43.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-OWNER-INBOX-AUTO-ARCHIVE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Auto-archive Owner Inbox decision cards on CeoDecision",
    recommendation:
      "Implement scrooge:owner-inbox-archiver handler that subscribes to CeoDecision, atomically moves source card to actioned/, and emits RecordFiled.",
    rationale:
      "PR #155 merged 2026-05-10. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-10T08:09:40.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-SCENARIO-CLOCK",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Controlled-time substrate for simulated scenarios (WallClock + SimulatedClock)",
    recommendation:
      "Implement ScenarioClock interface with WallClock (production default) and SimulatedClock (deterministic) resolved from BANK_SCENARIO_CLOCK_MODE.",
    rationale:
      "PR #162 merged 2026-05-10. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-10T09:02:20.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-BANK-ACCOUNT-SUBSTRATE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Bank-account event family and master/balance projections",
    recommendation:
      "Ship BankAccountOpened/Configured/Closed event types with Zod schemas and two projections.",
    rationale:
      "PR #164 merged 2026-05-10. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-10T09:03:32.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W1-SLICE-1",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "W1 Slice 1 — RMCP attestable spec mapped to FIC s.42(2)(a)–(j)",
    recommendation:
      "Mira+Zara to author RMCP document mapped one-for-one to FIC s.42 requirements, citing in-force policy stack by register row ID.",
    rationale:
      "PR #151 merged 2026-05-10 under standing D-REGULATORY-READINESS-GATE-PLAN authority. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-10T08:08:30.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2-SLICE-1",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "W2 Slice 1 — ICAAP/ILAAP/Recovery framework",
    recommendation:
      "Helena+Camille to author ICAAP/ILAAP/Recovery framework spec under standing D-REGULATORY-READINESS-GATE-PLAN authority.",
    rationale:
      "PR #153 merged 2026-05-10. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-10T08:09:05.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2-SLICE-2",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "W2 Slice 2 — RAS B2 CET1 management buffer ratification",
    recommendation:
      "Rohan+Nadia to calibrate RAS B2 CET1 management buffer with RasLineCalibrated event and blocking recon gate.",
    rationale:
      "PR #179 merged 2026-05-10. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-10T10:33:14.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2-SLICE-4",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "W2 Slice 4 — Stress-projection engine + Pillar-2 add-on + ICAAP narrative feed",
    recommendation:
      "Ship 4-scenario stress engine, Pillar-2 add-on (max(stress-deficit, risk-bucket sum)), and ICAAP narrative-data feed.",
    rationale:
      "PR #184 merged 2026-05-10. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-10T11:18:13.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-PARTY-REGISTER",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "governance",
    title: "Party register v0 — unified identity axis across all four actor kinds",
    recommendation:
      "Backfill Marc as founding natural-person Party with CEO-seat purposeRoles and register acts-on-behalf-of and reports-to edges for Hoz entities.",
    rationale:
      "PRs #203–#208 merged 2026-05-11. CLAUDE.md cites 'D-PARTY-REGISTER, CEO-approved 2026-05-11'. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-11T05:27:28.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-MARKETS-CAPITAL-TIME-SHAPE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "risk",
    title: "Capital time-shape framework — ICAAP/ILAAP paper v1",
    recommendation:
      "Approve capital time-shape with Helena's ICAAP/ILAAP paper run v1: Pillar 1 market risk R5.9m, total internal capital R36.7m, LCR 357%.",
    rationale:
      "Commits 2026-05-12 (PR #290, #305). A fix commit explicitly states 'emit approve event for D-MARKETS-CAPITAL-TIME-SHAPE — close ghost-open Vera FAIL' but the event never reached the shared store. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-12T12:52:33.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-DCAM",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Complete DCAM taxonomy mapping (ProductFamily → L1/L2/L3 scope codes)",
    recommendation:
      "Land ProductFamily-to-DCAM bridge, 21 Layer-3 data attribute groups, getProductFamilyDcamRecord(), blocking recon gate, and 27 DCAM Activity nodes in graph seed.",
    rationale:
      "PR #432 merged 2026-05-16. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-16T09:40:56.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-FX-MESSAGE-EVENTS",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Wire FX message generation into event log (MT202, MT103, MT300, pacs.008, pacs.009)",
    recommendation:
      "All five FX message generators now emit typed OutboundMessageDispatched/InboundMessageReceived/MessageCorrelated events with generateAndEmit* wrappers.",
    rationale:
      "PR #566 merged 2026-05-19. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-19T06:29:11.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-DISPATCH-SYNC-PRIMITIVE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Dispatch synchronisation primitive — reviewer+decider run topology",
    recommendation:
      "Authorize Atlas to build dispatch sync primitive preventing the WS-MARKET-RISK-PROCEDURES v1.0 incident from recurring; spec at prototype/platform/dispatch/sync-primitive-spec.md.",
    rationale:
      "PR #621 merged 2026-05-20. CLAUDE.md cites 'D-DISPATCH-SYNC-PRIMITIVE (CEO-approved 2026-05-20)'. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-20T12:16:09.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-MR-PROC-S8-2-APPROVE",
    phase: "approved",
    authority: "CRO",
    authorityRef: "agent:helena",
    category: "risk",
    title: "Four market risk procedures — CRO approval (MRP v1 §8.2)",
    recommendation:
      "Helena (CRO) approves PROC-RISK-FRTB-SA-01, PROC-RISK-BACKTEST-01, PROC-RISK-PLA-01, and PROC-RISK-MRL-01 under Market Risk Policy v1 §8.2.",
    rationale:
      "PR #627 merged 2026-05-20. CRO approval ceremony completed but Decision event never emitted to shared store. CEO noted; CRO authority: Helena. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-20T14:59:01.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-MR-PROC-S8-2-V11-APPROVE",
    phase: "approved",
    authority: "CRO",
    authorityRef: "agent:helena",
    category: "risk",
    title: "Market risk procedure v1.1 amendments — CRO approval",
    recommendation:
      "Helena (CRO) approves v1.1 amendments to PROC-RISK-FRTB-SA-01 and PROC-RISK-MRL-01 following Bea's independent validation verdict.",
    rationale:
      "PR #628 merged 2026-05-20. CRO approval ceremony completed but Decision event never emitted to shared store. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-20T15:02:04.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-EVENT-VIEW-BOUNDARY-WIRE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Event-view boundary wiring — PolicyVersionActivated, OfficialMarkAdopted, PeriodClosed",
    recommendation:
      "Land three event types and wire into MTM run with mark-adoption engine, advisory recon asserting mark–revaluation chain.",
    rationale:
      "PRs #629+#632 merged 2026-05-20. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-20T16:08:34.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-FX-QUOTING-CONVENTION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "FX quoting convention — standardised calculator across all five message generators",
    recommendation:
      "Wire MT202, MT103, MT300, pacs.008, pacs.009 into FX quoting calculator with standardised convention and event emission.",
    rationale:
      "PRs #658, #664, #675–#677 merged 2026-05-21. Proposal card PR #658 was a markdown record, not a Decision event. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-21T07:42:20.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-OPRISK-ENGINEER-ROLE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "people",
    title: "Operational-risk engineer role — Option B: subsume into Rohan's roster",
    recommendation:
      "Operational-risk module (loss-event taxonomy, Risk Return §3, Pillar 3 §3.6, SMA RWA) is active under Rohan; dedicated seat deferred to licence-day with Helena sponsorship.",
    rationale:
      "PRs #671+#672+#710 merged 2026-05-21. PR #671 titled 'approved Option B'. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-21T09:04:58.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-NPA-FX-SPOT-INTERNAL-TEST",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "product",
    title: "NPA: FX-spot product approval for internal pre-licence test scope",
    recommendation:
      "Approve FX-spot product v0.1.0-internal-pre-licence-test for internal pre-licence testing; PROC-MK-PLG-01 Condition 1 → Satisfied.",
    rationale:
      "PR #674 merged 2026-05-21, titled 'D-NPA-FX-SPOT-INTERNAL-TEST approved'. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-21T09:37:19.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-BRC-INTERIM-MR-1-FX",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "risk",
    title: "Interim MR-1-FX risk limits — Option A (CEO acting as interim BRC)",
    recommendation:
      "CEO interim approval of Helena's MR-1-FX framework: 1-day 99% VaR ZAR 350k, EOD cap USD 1m, intraday peak USD 1.5m, per-counterparty USD 500k/day.",
    rationale:
      "PR #680 merged 2026-05-21, titled 'approved Option A'. Decision event never emitted. CEO acting as interim BRC pending Board constitution. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-21T10:05:47.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-DISPATCH-MULTI-HOST-POSTGRES-MIRROR-AUTO-INVOKE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Postgres event-store mirror — best-effort dispatch with no-op fallback",
    recommendation:
      "Scaffold best-effort Postgres event-store mirror: no-op when BANK_POSTGRES_EVENT_MIRROR_URL absent, graceful error-swallowing on failures, wired into dispatch CLI.",
    rationale:
      "PR #712 merged 2026-05-21. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-21T20:19:52.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-HQLA-COA-CLASSIFICATION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "HQLA COA classification fields + dynamic BA 110 HQLA scan",
    recommendation:
      "Add hqlaLevel/hqlaSubCategory/hqlaAssetSpecificFactor to COA schema, tag accounts by Level 1/2a/2b, wire dynamic HQLA scan into BA 110 with 41 test cases.",
    rationale:
      "PR #739 merged 2026-05-22. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-22T09:33:35.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
  {
    decisionId: "D-FINANCIAL-INSTRUMENT-ENTITY",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "Financial Instrument Entity schema and cross-asset integration — Slices 1–12",
    recommendation:
      "Ship 12 slices: FI entity schema (Zod/ISIN/ACTUS discriminator), SecurityMaster, ACTUS mapping, instrumentId on FX/equity/IRS, bond CDM, unified position projection, bond GL posting engine.",
    rationale:
      "PRs #742–#752 merged 2026-05-22; roadmap sync commit notes 'Slices 1–12 to done'. Decision event never emitted. CEO approved via session delegation 2026-05-26 (backfill).",
    asOf: "2026-05-22T15:40:47.000Z",
    recordedVia: "backfill:pre-event-ceremony",
  },
];

function hasTerminal(decisionId: string): boolean {
  for (const e of eventStore.replay({ type: "Decision" })) {
    const p = e.payload as { decisionId?: string; phase?: string };
    if (p.decisionId === decisionId && p.phase && TERMINAL.has(p.phase)) {
      return true;
    }
  }
  return false;
}

function main(): number {
  let emitted = 0;
  let skipped = 0;

  for (const c of CLOSURES) {
    if (hasTerminal(c.decisionId)) {
      logger.info({ decisionId: c.decisionId }, "backfill — already has terminal phase, skipping");
      skipped++;
      continue;
    }

    recordDecision(
      {
        decisionId: c.decisionId,
        phase: c.phase,
        authority: c.authority,
        authorityRef: c.authorityRef,
        title: c.title,
        category: c.category,
        recommendation: c.recommendation,
        rationale: c.rationale,
        sourceDocHashes: [],
        citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
        recordedVia: c.recordedVia,
      },
      c.asOf,
    );

    logger.info(
      { decisionId: c.decisionId, phase: c.phase, authority: c.authority },
      "backfill — terminal event emitted",
    );
    emitted++;
  }

  logger.info({ emitted, skipped }, "backfill-pre-shared-store-decisions — done");
  return 0;
}

process.exit(main());
