// scenarios/fx-spot-internal-pre-licence-test.ts
//
// FX-SPOT INTERNAL PRE-LICENCE TEST — end-to-end lifecycle harness.
//
// Marc (CEO) framed the MVP as an internal pre-licence test: book synthetic
// FX-spot trades against the controlled-launch counterparty whitelist, run
// every downstream substrate component (IFRS postings, EOD revaluation,
// SA-CCR computation, credit-limit utilisation, settlement subscriber,
// failure-path posting rules, recon pipelines, daily P&L) and assert the
// chain produces a coherent FX-spot trade lifecycle.
//
// This is the deliverable that PROC-MK-PLG-01 (Saskia, Head of Global
// Markets, governance — Procedures/markets/pre-licence-go-live-gate.md)
// NPA-product-readiness condition (e) "front-to-back system capability
// confirmed" rests on. Saskia + Helena (Chief Risk Officer, governance) +
// Devon (Chief Operating Officer, governance) + Rashida (Chief Information
// Security Officer, governance) read this scenario's output to attest
// their respective dimensions.
//
// ─── UPSTREAM SUBSTRATE PRS IN SCOPE ──────────────────────────────────────
//
// Eight substrate PRs landed on main between commits f26a505 and d3967e4
// (2026-05-20). This scenario exercises every one of them:
//
//   #633 — Atlas (Core banking platform architect, engineering):
//          G-3 no-prop attribution schema on FxTradeExecuted
//          (clientFlowRef XOR hedgeProgrammeRef invariant).
//   #634 — Helena: controlled-launch MR-1-FX limit framework
//          (ZAR 350k VaR; USD 1m EOD / USD 1.5m intraday; USD 500k
//          per-counterparty cap; USD/ZAR only).
//   #635 — Rohan (Quantitative risk engineer, engineering): SA-CCR T+2
//          maturity-factor regression test (engine validated).
//   #636 — Devon: PROC-OPS-SFBCP-01 v0.2 FX settlement failure procedure.
//   #637 — Imani (Chief Legal Counsel, governance): G-9 ISDA 2002 + SA
//          Schedule decision (Bowmans 2024-04-15 SA netting opinion).
//   #638 — Atlas: schema completeness pack — FxSettlementFailed,
//          MissedExpectedReceipt, SettlementFailureClassified,
//          JurisdictionalOpinionRefreshed, fx-bilateral enum.
//   #639 — Saskia: Standard Bank ZA + Investec ZA in Party register.
//   #640 — Tomas (Correspondent banking & payments, engineering): FX
//          settlement subscriber (simulated-feed variant).
//   #641 — Bea (Accounting & financial reporting engineer, engineering):
//          PR-FX-005 IFRS-9 default-recognition posting rule.
//   #642 — Yael (Treasurer & Tax, engineering+governance): credit limits +
//          netting-set enrolment (ISDACSAAssessmentCompleted) for both
//          counterparties.
//   #643 — Atlas: SARB fixing ingester (OfficialMarkAdopted source for
//          FX-spot IPV).
//   #644 — Rashida: FinSurv ExCon ruling — build-phase activity outside
//          Reg 2(1)/3(1) scope (scenario is in scope of the ruling).
//
// ─── PHASES ────────────────────────────────────────────────────────────────
//
//   Phase 1 — Bootstrap: SARB fixings + credit limits + Party register +
//             credit-limit gate green.
//   Phase 2 — Happy path: BUY USD 500k vs ZAR with Standard Bank ZA;
//             trade → IFRS postings → settlement instructed → EOD reval →
//             SA-CCR → credit-limit utilisation → confirmation → close.
//   Phase 3 — Herstatt-active failure: Investec ZA; one-leg-delivered →
//             MissedExpectedReceipt → FxSettlementFailed → classified →
//             PR-FX-005 Stage-3 ECL postings.
//   Phase 4 — Mutual fail: neither-delivered → no GL movement (FVTPL out
//             of ECL scope; Bea SicrTriggered follow-on).
//   Phase 5 — Operational delay: settlement late but not failed →
//             no GL movement, no default event.
//   Phase 6 — Output summary with pass/fail per phase, gap surfaces,
//             READY-FOR-CONTROLLED-LAUNCH | BLOCKED status.
//
// ─── CITATIONS ────────────────────────────────────────────────────────────
//
//   - PROC-MK-PLG-01 (Procedures/markets/pre-licence-go-live-gate.md):
//     NPA-product-readiness condition (e) "front-to-back system capability".
//   - PROC-NPA-GATE-01 (Procedures/markets/new-product-approval.md):
//     pre-go-live NPA gate.
//   - Helena PR #634 (controlled-launch MR-1-FX limit framework).
//   - Imani PR #637 (G-9 ISDA decision; Bowmans 2024 opinion).
//   - Rashida PR #644 (FinSurv ExCon ruling — build-phase out of scope).
//   - Marc (CEO)'s 2026-05-20 MVP framing — internal pre-licence test.
//   - D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//   - D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
//   - D-MARKETS-SCHEMA-FOUNDATION; D-FX-CLS-MEMBERSHIP; D-FX-AD-STATUS;
//     D-FX-BOOK-BOUNDARY.
//   - Policies/credit-risk-policy-v1.md §1.4 + §7; §3 line 132.
//   - Policies/trading-mandate-v1.md §5 (no-prop invariant); §6 (FX
//     settlement risk; Herstatt; whitelist).
//   - Policies/valuation-policy-v1.md §3.1 (FX spot rate hierarchy —
//     SARB fixing primary).
//   - Procedures/by-policy/credit-risk-limit-management.md PROC-RISK-CLM-01.
//   - Procedures/operations/settlement-failure-bcp.md PROC-OPS-SFBCP-01 v0.2.
//   - WS-MARKET-RISK-PROCEDURES workstream.
//   - Principle 1 (events are truth); Principle 2 (single graph).
//
// Run: `bun run scenario:fx-spot-internal-pre-licence-test` (from `prototype/`).
//
// Author: Kai (Markets engineering lead, engineering).

// Required env (set by the `scenario:fx-spot-internal-pre-licence-test`
// script in package.json — must precede any import of platform/composition,
// which reads BANK_EVENT_DB at module-load time):
//
//   BANK_EVENT_DB=.local/scenario-fx-spot-internal-pre-licence-test.db
//   BANK_MARKET_DATA_DB=.local/scenario-fx-spot-internal-pre-licence-test-market-data.db
//   BANK_PERMISSION_GATE_DISABLED=true
//
// The bootstrapping shell command also unlinks the DB files before bun
// starts, so each run starts with empty stores.

import { unlinkSync } from "node:fs";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import type {
  CreditLimitLoadedPayload,
  ISDACSAAssessmentCompletedPayload,
} from "../platform/event-store/event-types/credit-limit";
import { makePolicyVersionActivated } from "../platform/event-store/event-types/policy-activation";
import type { Event } from "../platform/event-store/types";
import { makeFxSettlementInstructed, makeFxTradeExecuted } from "../platform/markets/cdm/fx";
import { runEodFxRevaluation } from "../platform/markets/eod/fx-revaluation";
import {
  type CorrespondentMessage,
  makeStaticCorrespondentFeed,
  runFxSettlementSubscriber,
} from "../platform/markets/settlement/fx-settlement-subscriber";
import { setDefaultProvenanceModeOverride } from "../platform/projections";
import { computeAndEmitFor } from "../platform/risk/sa-ccr";

import { run as runCounterpartyExposureRecon } from "../platform/recon/counterparty-exposure-coverage";
// Recon pipelines — imported by named exports only. Some recon modules
// (notably counterparty-exposure-coverage.ts) do not guard their CLI block
// with `import.meta.main`, so they `run()` at module-load time. That call
// is harmless on a fresh store (returns ok=true with an info-severity
// advisory) but does emit console output. We accept the noise rather than
// touch the recon files (out of scope for this brief).
import { run as runCreditLimitNoTradeRecon } from "../platform/recon/credit-limit-no-trade-without-loaded";
import { run as runLexCapRecon } from "../platform/recon/lex-cap-utilisation";
import { run as runMarketDataProvenanceRecon } from "../platform/recon/market-data-provenance-gate";
import { run as runPositionRevaluedRecon } from "../platform/recon/position-revalued-cites-mark";
import type { ReconResult } from "../platform/recon/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Identity of this scenario — used in console output and matches the
 *  package.json `scenario:fx-spot-internal-pre-licence-test` entry. */
export const SCENARIO_ID = "fx-spot-internal-pre-licence-test";
/** Source-lineage tag for provenance envelopes emitted by this scenario. */
export const SCENARIO_SOURCE_LINEAGE = "scenario-runner:fx-spot-internal-pre-licence-test";

const ENTITY = "BANK-ZA-001";

// Counterparty URNs (Saskia PR #639 — Party register entries).
const STANDARD_BANK_ZA = "urn:party:legal-entity:standard-bank-za";
const INVESTEC_BANK_ZA = "urn:party:legal-entity:investec-bank-za";

// Counterparty display names (Saskia PR #639).
const STANDARD_BANK_NAME = "The Standard Bank of South Africa Limited";
const INVESTEC_BANK_NAME = "Investec Bank Limited";

// Helena PR #634 — per-counterparty USD 500k daily cap (in cents).
const USD_500K_MINOR = 500_000_00;

// Spot-rate seed (matches seeds/sarb-fixing-rates.json — most-recent fixing
// 2026-05-20 = 18.5240). The scenario operates 2026-05-21 trade-date / T+2.
const SPOT_RATE_USD_ZAR = 18.524;

// Trade and settlement dates.
const TRADE_DATE_ISO = "2026-05-21";
const SETTLEMENT_DATE_ISO = "2026-05-25"; // T+2 (skipping weekend).
const TRADE_TIMESTAMP = "2026-05-21T09:00:00.000Z";
const SETTLEMENT_TIMESTAMP = "2026-05-25T14:00:00.000Z";

const TRADER_ACTOR = {
  type: "service" as const,
  id: "agent:kai:markets-engineering-lead",
} as const;
const SETTLEMENT_ACTOR = {
  type: "service" as const,
  id: "agent:tomas:fx-settlement-subscriber",
} as const;

const TRADE_CITATIONS = [
  "PROC-MK-PLG-01",
  "PROC-NPA-GATE-01",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FX-CLS-MEMBERSHIP",
  "D-FX-AD-STATUS",
  "D-FX-BOOK-BOUNDARY",
  "D-CREDIT-LIMIT-ENGINE-BUILD",
  "Policies/trading-mandate-v1.md#5",
  "Policies/trading-mandate-v1.md#6",
  "Policies/credit-risk-policy-v1.md#1.4",
  "Policies/valuation-policy-v1.md#3.1",
  "WS-MARKET-RISK-PROCEDURES",
  "pr:#633",
  "pr:#634",
  "pr:#637",
  "pr:#639",
  "pr:#642",
  "pr:#644",
] as const;

const SETTLEMENT_INSTRUCTION_CITATIONS = [
  "D-FX-CLS-MEMBERSHIP",
  "D-FX-AD-STATUS",
  "Policies/trading-mandate-v1.md#6",
  "PROC-MK-PLG-01",
  "WS-MARKET-RISK-PROCEDURES",
] as const;

const SUBSCRIBER_CITATIONS = [
  "pr:#636",
  "pr:#638",
  "Policies/trading-mandate-v1.md#6",
  "memory:project_indirect_participant_posture",
  "bcbs:d226",
  "banks-act:reg-39",
  "PROC-MK-PLG-01",
  "WS-MARKET-RISK-PROCEDURES",
] as const;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface PhaseResult {
  readonly phase: string;
  readonly ok: boolean;
  readonly notes: string[];
  readonly failures: string[];
}

interface AssertionLog {
  readonly description: string;
  readonly ok: boolean;
  readonly detail?: string;
}

class PhaseRecorder {
  private readonly assertions: AssertionLog[] = [];
  private readonly notesList: string[] = [];

  constructor(public readonly phase: string) {}

  assert(description: string, ok: boolean, detail?: string): void {
    this.assertions.push(detail !== undefined ? { description, ok, detail } : { description, ok });
  }

  note(line: string): void {
    this.notesList.push(line);
  }

  result(): PhaseResult {
    const failures = this.assertions
      .filter((a) => !a.ok)
      .map((a) => `${a.description}${a.detail ? ` — ${a.detail}` : ""}`);
    return {
      phase: this.phase,
      ok: failures.length === 0,
      notes: this.notesList,
      failures,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a synthetic FX-spot trade. BUY USD vs ZAR at the supplied rate. */
function buildFxSpotTrade(args: {
  tradeId: string;
  counterpartyId: string;
  counterpartyName: string;
  clientFlowRef: string;
  asOf: string;
}): Event {
  const usdNotionalMinor = USD_500K_MINOR;
  // counterNotional in ZAR = USD 500k × rate. Stored as MINOR (cents).
  // USD 500,000 × 18.524 = ZAR 9,262,000.00 → 926_200_000 cents.
  const zarCounterNotionalMinor = Math.round(usdNotionalMinor * SPOT_RATE_USD_ZAR);

  return makeFxTradeExecuted({
    asOf: args.asOf,
    entity: ENTITY,
    actor: TRADER_ACTOR,
    citations: [...TRADE_CITATIONS],
    payload: {
      tradeId: { scheme: "INTERNAL", value: args.tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          // BUY USD vs ZAR — bank pays ZAR, receives USD.
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          notional: { currency: "ZAR", amountMinor: zarCounterNotionalMinor },
          counterNotional: { currency: "USD", amountMinor: usdNotionalMinor },
          rate: { currency: "ZAR", amount: SPOT_RATE_USD_ZAR },
          settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: TRADE_DATE_ISO, calendar: "JIHCAL" },
      counterparty: {
        partyId: args.counterpartyId,
        name: args.counterpartyName,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: "OTC",
      trader: TRADER_ACTOR.id,
      bookId: "BOOK-FX-MARKETS-LP",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      finsurvCategory: "ODP-001-cross-border-institutional",
      clientFlowRef: args.clientFlowRef,
    },
  });
}

function buildFxSettlementInstructed(args: {
  tradeId: string;
  settlementId: string;
  counterpartyId: string;
  counterpartyName: string;
  legCurrency: "USD" | "ZAR";
  amountMinor: number; // positive = bank receives; negative = bank pays
  asOf: string;
}): Event {
  return makeFxSettlementInstructed({
    asOf: args.asOf,
    entity: ENTITY,
    actor: SETTLEMENT_ACTOR,
    citations: [...SETTLEMENT_INSTRUCTION_CITATIONS],
    payload: {
      tradeId: { scheme: "INTERNAL", value: args.tradeId },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: args.settlementId },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: "urn:party:legal-entity:correspondent-bank-za",
        name: "Simulated Correspondent Bank ZA",
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: {
        partyId: args.counterpartyId,
        name: args.counterpartyName,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      netCash: { currency: args.legCurrency, amountMinor: args.amountMinor },
      settlementDate: { iso: SETTLEMENT_DATE_ISO, calendar: "JIHCAL" },
      messageStandard: "SWIFT-MT202",
    },
    eventId: newEventId(),
  });
}

/** Post-run cleanup of the per-scenario DB files. The wipe before the run
 *  is performed by the `scenario:fx-spot-internal-pre-licence-test` script
 *  in package.json (must precede the `bun run` invocation so composition.ts
 *  opens an empty store). */
function cleanupStores(): void {
  for (const env of [process.env.BANK_EVENT_DB, process.env.BANK_MARKET_DATA_DB]) {
    if (!env) continue;
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        unlinkSync(`${env}${suffix}`);
      } catch {
        // Ignore — file may not exist.
      }
    }
  }
}

function countByType(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of eventStore.replay({})) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  return counts;
}

function countEventsOfType(type: string): number {
  let n = 0;
  for (const _ of eventStore.replay({ type })) n += 1;
  return n;
}

function findEventsByPredicate(
  type: string,
  predicate: (payload: Record<string, unknown>) => boolean,
): Event[] {
  const out: Event[] = [];
  for (const e of eventStore.replay({ type })) {
    if (predicate(e.payload as Record<string, unknown>)) out.push(e);
  }
  return out;
}

function reconResultOk(r: ReconResult): boolean {
  return r.ok;
}

// ---------------------------------------------------------------------------
// Phase 1 — Bootstrap
// ---------------------------------------------------------------------------

async function runPhase1(): Promise<PhaseResult> {
  const r = new PhaseRecorder("Phase 1 — Bootstrap");

  // The seeds use the global `eventStore` from `platform/composition`. We
  // wiped the DB before importing composition; composition opened a fresh
  // empty SQLite. Running the three seed/backfill scripts emits their
  // events into this same store.

  // 1. Policy-activation backfill (required by sarb-fixing-ingester to
  //    resolve `policyVersionRef` on OfficialMarkAdopted).
  //    Inlined here (rather than imported from
  //    `scripts/backfill-policy-version-activated-valuation-v1.ts`) because
  //    that script has a top-level `process.exit(main())` which would
  //    terminate the scenario on import.
  try {
    let alreadyActivated = false;
    for (const e of eventStore.replay({ type: "PolicyVersionActivated" })) {
      const p = e.payload as { policyId?: string; policyDomain?: string };
      if (p.policyId === "VALUATION-POLICY-V1" && p.policyDomain === "valuation") {
        alreadyActivated = true;
        break;
      }
    }
    if (!alreadyActivated) {
      const event = makePolicyVersionActivated({
        asOf: "2026-05-19T08:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "agent:helena:cro" },
        citations: ["D-EVENT-VIEW-BOUNDARY-WIRE", "Policies/valuation-policy-v1.md"],
        payload: {
          policyDomain: "valuation",
          policyId: "VALUATION-POLICY-V1",
          version: "1.0",
          effectiveFrom: "2026-05-19T00:00:00Z",
          documentHash: "blake3:2e3163f0f1c77812d494f646acc3e8bd9da10b8ec63a2339904609018a5300c2",
          supersedes: null,
          activatedBy: "agent:helena:cro",
        },
      });
      eventStore.append(event);
    }
    r.note(
      `backfill:policy-activations — VALUATION-POLICY-V1 v1.0 ${alreadyActivated ? "already activated" : "activated"}`,
    );
  } catch (err) {
    r.assert("policy-activations backfill ran", false, String(err));
  }

  // 2. Party register backfill (Saskia PR #639 — Standard Bank ZA + Investec ZA).
  try {
    const { runPartyBackfill } = await import("../scripts/party-backfill");
    const partyResult = runPartyBackfill(eventStore, {
      asOf: "2026-05-20T18:00:00.000Z",
    });
    r.note(
      `party-backfill: legal-entities=${partyResult.legalEntityPartiesEmitted}, ` +
        `counterparties=${partyResult.counterpartyPartiesEmitted}, ` +
        `agents=${partyResult.agentPartiesEmitted}, ` +
        `naturalPersons=${partyResult.naturalPersonPartiesEmitted}, ` +
        `skipped=${partyResult.skipped}`,
    );

    const standardBankParty = findEventsByPredicate("PartyRegistered", (p) => {
      return p.partyId === STANDARD_BANK_ZA;
    });
    const investecParty = findEventsByPredicate("PartyRegistered", (p) => {
      return p.partyId === INVESTEC_BANK_ZA;
    });
    r.assert(
      "Standard Bank ZA registered in Party register (Saskia PR #639)",
      standardBankParty.length === 1,
      `found ${standardBankParty.length} PartyRegistered events for ${STANDARD_BANK_ZA}`,
    );
    r.assert(
      "Investec Bank ZA registered in Party register (Saskia PR #639)",
      investecParty.length === 1,
      `found ${investecParty.length} PartyRegistered events for ${INVESTEC_BANK_ZA}`,
    );
  } catch (err) {
    r.assert("party-backfill ran", false, String(err));
  }

  // 3. SARB fixings seed (Atlas PR #643) — 29 days of USD/ZAR
  //    OfficialMarkAdopted events.
  try {
    const sarbModule = await import("../platform/market-data/sarb-fixing-ingester");
    const marketDataStoreModule = await import("../platform/market-data/store");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const fixturePath = path.resolve(import.meta.dir, "..", "seeds", "sarb-fixing-rates.json");
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const source = sarbModule.makeFixtureSarbFixingSource(fixture);
    const marketDataStore = new marketDataStoreModule.MarketDataStore(
      process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db",
    );
    const results = sarbModule.runSarbFixingIngestAll({
      source,
      // Cast to the same EventStore class — composition wraps it; for
      // the ingester signature we pass the raw underlying store. The
      // ingester only calls append; the gate is disabled.
      eventStore: eventStore as unknown as InstanceType<
        typeof import("../platform/event-store/store").EventStore
      >,
      marketDataStore,
    });
    let totalEvents = 0;
    let totalTicks = 0;
    for (const res of results) {
      totalEvents += res.eventsEmitted;
      totalTicks += res.ticksAppended;
    }
    marketDataStore.close();
    r.note(
      `seed:sarb-fixings — ${totalEvents} OfficialMarkAdopted events emitted; ` +
        `${totalTicks} ticks appended; ${results.length} dates seeded`,
    );
    r.assert(
      "SARB fixings emitted (Atlas PR #643)",
      totalEvents >= 25,
      `expected ≥25 OfficialMarkAdopted events, got ${totalEvents}`,
    );
  } catch (err) {
    r.assert("seed:sarb-fixings ran", false, String(err));
  }

  // 4. Credit-limit + ISDA/CSA seed (Yael PR #642).
  try {
    const seedModule = await import("../scripts/seed-fx-spot-controlled-launch-limits");
    seedModule.main();
    const limitsLoaded = findEventsByPredicate("CreditLimitLoaded", (p) => {
      return p.counterpartyId === STANDARD_BANK_ZA || p.counterpartyId === INVESTEC_BANK_ZA;
    });
    const isdaAssessed = findEventsByPredicate("ISDACSAAssessmentCompleted", (p) => {
      return p.counterpartyId === STANDARD_BANK_ZA || p.counterpartyId === INVESTEC_BANK_ZA;
    });
    r.assert(
      "Credit limits loaded for both counterparties (Yael PR #642)",
      limitsLoaded.length === 2,
      `expected 2 CreditLimitLoaded events, got ${limitsLoaded.length}`,
    );
    r.assert(
      "ISDA/CSA assessment completed for both counterparties (Yael PR #642)",
      isdaAssessed.length === 2,
      `expected 2 ISDACSAAssessmentCompleted events, got ${isdaAssessed.length}`,
    );
    for (const e of limitsLoaded) {
      const p = e.payload as CreditLimitLoadedPayload;
      r.assert(
        `CreditLimitLoaded[${p.counterpartyId}] is USD 500k (Helena PR #634)`,
        p.limit === USD_500K_MINOR && p.currency === "USD",
        `got limit=${p.limit} currency=${p.currency}`,
      );
    }
    for (const e of isdaAssessed) {
      const p = e.payload as ISDACSAAssessmentCompletedPayload;
      r.assert(
        `ISDACSAAssessment[${p.counterpartyId}] is enforceable (Imani PR #637)`,
        p.nettingEnforceable === true && p.isdaStatus === "executed",
        `got enforceable=${p.nettingEnforceable} status=${p.isdaStatus}`,
      );
    }
  } catch (err) {
    r.assert("fx-spot:seed-controlled-launch ran", false, String(err));
  }

  // 5. Recon — credit-limit-no-trade-without-loaded: must be green (no trades
  //    booked yet; gate is trivially satisfied for both counterparties).
  const gateRecon = runCreditLimitNoTradeRecon();
  r.assert(
    "recon:credit-limit-no-trade-without-loaded passes pre-trade (Vera)",
    reconResultOk(gateRecon),
    `violations=${gateRecon.violations.length}: ${gateRecon.violations
      .slice(0, 2)
      .map((v) => v.message)
      .join("; ")}`,
  );

  r.note(
    `Total events after Phase 1: ${countByType().PartyRegistered ?? 0} parties; ` +
      `${countEventsOfType("OfficialMarkAdopted")} marks; ` +
      `${countEventsOfType("CreditLimitLoaded")} credit limits; ` +
      `${countEventsOfType("ISDACSAAssessmentCompleted")} ISDA assessments.`,
  );

  return r.result();
}

// ---------------------------------------------------------------------------
// Phase 2 — Happy-path trade lifecycle
// ---------------------------------------------------------------------------

async function runPhase2(): Promise<PhaseResult> {
  const r = new PhaseRecorder("Phase 2 — Happy-path trade lifecycle");

  const tradeId = "TRD-FX-SPOT-INTERNAL-TEST-001";
  const clientFlowRef = "test:internal-pre-licence:trade-001";

  // 1. Book the trade — FxTradeExecuted (Atlas PR #633 — clientFlowRef
  //    XOR hedgeProgrammeRef invariant satisfied).
  const tradeEvent = buildFxSpotTrade({
    tradeId,
    counterpartyId: STANDARD_BANK_ZA,
    counterpartyName: STANDARD_BANK_NAME,
    clientFlowRef,
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(tradeEvent);
  r.note(`FxTradeExecuted ${tradeEvent.event_id} for ${STANDARD_BANK_ZA}`);

  // Assert no-prop XOR.
  const tradePayload = tradeEvent.payload as Record<string, unknown>;
  r.assert(
    "FxTradeExecuted carries clientFlowRef (Atlas PR #633 — no-prop XOR satisfied)",
    tradePayload.clientFlowRef === clientFlowRef && tradePayload.hedgeProgrammeRef === undefined,
    `clientFlowRef=${String(tradePayload.clientFlowRef)} hedgeProgrammeRef=${String(tradePayload.hedgeProgrammeRef)}`,
  );

  // 2. Settlement instructions — one per currency leg.
  const usdSettlement = buildFxSettlementInstructed({
    tradeId,
    settlementId: `STL-${tradeId}-USD`,
    counterpartyId: STANDARD_BANK_ZA,
    counterpartyName: STANDARD_BANK_NAME,
    legCurrency: "USD",
    amountMinor: USD_500K_MINOR, // bank receives USD
    asOf: TRADE_TIMESTAMP,
  });
  const zarSettlement = buildFxSettlementInstructed({
    tradeId,
    settlementId: `STL-${tradeId}-ZAR`,
    counterpartyId: STANDARD_BANK_ZA,
    counterpartyName: STANDARD_BANK_NAME,
    legCurrency: "ZAR",
    amountMinor: -Math.round(USD_500K_MINOR * SPOT_RATE_USD_ZAR), // bank pays ZAR
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(usdSettlement);
  eventStore.append(zarSettlement);
  r.note("FxSettlementInstructed × 2 (USD + ZAR)");

  // 3. EOD revaluation tick — emits FxPositionRevalued citing the SARB
  //    mark via in-window match (Slice B.1 advisory recon). The valuation
  //    date must be a date that exists in both seeds/fx-rates.json (the
  //    staticRateSource source-of-truth) AND seeds/sarb-fixing-rates.json
  //    so the position-revalued-cites-mark recon window-matches the mark.
  // We pass valuationDate = "2026-05-20" so the FxPositionRevalued
  // as_of and the SARB OfficialMarkAdopted markAsOf are the same date —
  // window match holds.
  try {
    // Valuation date must match a row in seeds/fx-rates.json (the
    // staticRateSource). 2026-05-19 is the most-recent USD/ZAR fixing in
    // both seeds/fx-rates.json AND seeds/sarb-fixing-rates.json, so the
    // position-revalued-cites-mark recon window-matches the mark.
    const result = runEodFxRevaluation(
      eventStore as unknown as InstanceType<
        typeof import("../platform/event-store/store").EventStore
      >,
      "2026-05-19",
    );
    r.note(`runEodFxRevaluation: revalued=${result.revalued}, skipped=${result.skipped}`);
    r.assert(
      "EOD revaluation emitted ≥1 FxPositionRevalued event",
      result.revalued >= 1,
      `revalued=${result.revalued}`,
    );
  } catch (err) {
    r.assert("EOD revaluation completed", false, String(err));
  }

  // 4. SA-CCR compute-and-emit — uses the netting-set register (Imani PR
  //    #637 + Yael PR #642 wired the ISDACSAAssessmentCompleted; Phase 5
  //    register projection resolves it).
  try {
    const { minor } = await import("../platform/core/money");
    const usdNotional = minor(BigInt(USD_500K_MINOR), "USD" as never);
    const result = computeAndEmitFor({
      counterpartyId: STANDARD_BANK_ZA,
      currency: "USD",
      trades: [
        {
          tradeId,
          counterpartyId: STANDARD_BANK_ZA,
          nettingSetId: `netset:${STANDARD_BANK_ZA}:USD`,
          assetClass: "fx",
          notional: usdNotional,
          direction: "long",
          remainingYears: 4 / 365, // T+2 ≈ 0.011 years (BCBS d317 §164 MF)
          hedgingSetTag: "USD/ZAR",
        },
      ],
      asOf: TRADE_TIMESTAMP,
    });
    r.assert(
      "SA-CCR computeAndEmitFor resolved a netting set and emitted RC + EAD (Rohan PR #635 / Yael PR #642)",
      result !== null,
      result === null
        ? "resolveNettingSet returned null — netting-set register did not resolve the (counterparty, currency) pair"
        : `RC=${result.rc.rc.amount} EAD=${result.ead.ead.amount} ${result.ead.ead.currency}`,
    );
    if (result !== null) {
      r.note(`SA-CCR: RC=${result.rc.rc.amount} EAD=${result.ead.ead.amount} (alpha=1.4)`);
    }
  } catch (err) {
    r.assert("SA-CCR compute-and-emit ran", false, String(err));
  }

  r.assert(
    "CcrReplacementCostComputed emitted",
    countEventsOfType("CcrReplacementCostComputed") >= 1,
    `count=${countEventsOfType("CcrReplacementCostComputed")}`,
  );
  r.assert(
    "CcrEadComputed emitted",
    countEventsOfType("CcrEadComputed") >= 1,
    `count=${countEventsOfType("CcrEadComputed")}`,
  );

  // 5. Settlement happy-path through Tomas's subscriber (PR #640).
  const happyMsg: CorrespondentMessage = {
    tradeRef: tradeId,
    settlementInstructionRef: usdSettlement.event_id,
    valueDate: SETTLEMENT_DATE_ISO,
    cutoffAt: `${SETTLEMENT_DATE_ISO}T16:00:00Z`,
    toleranceMinutes: 30,
    observedAt: SETTLEMENT_TIMESTAMP,
    legStatus: { payLegDelivered: true, receiveLegDelivered: true },
    currencyPair: "USD/ZAR",
    legKind: "near",
    settledBaseCurrencyMinor: USD_500K_MINOR,
    settledQuoteCurrencyMinor: -Math.round(USD_500K_MINOR * SPOT_RATE_USD_ZAR),
    nostroAccountBase: "ACC-1100-002", // USD nostro
    nostroAccountQuote: "ACC-1100-001", // ZAR nostro
    correspondentRef: `CONF-${tradeId}-HAPPY`,
  };
  const feed = makeStaticCorrespondentFeed([happyMsg]);
  let phase2Tick = 0;
  const subResult = runFxSettlementSubscriber(feed, {
    now: () => {
      const base = new Date(SETTLEMENT_TIMESTAMP).getTime();
      const t = new Date(base + phase2Tick * 1000);
      phase2Tick += 1;
      return t.toISOString();
    },
    actor: SETTLEMENT_ACTOR,
    entity: ENTITY,
    citations: [...SUBSCRIBER_CITATIONS],
  });
  for (const e of subResult.events) eventStore.append(e);
  r.assert(
    "FxSettlementSubscriber confirmed happy-path (PR #640)",
    subResult.outcomes.length === 1 && subResult.outcomes[0]?.kind === "confirmed",
    `outcomes=${subResult.outcomes.map((o) => o.kind).join(",")}`,
  );
  r.assert(
    "FxSettlementConfirmed emitted (lifecycle close)",
    countEventsOfType("FxSettlementConfirmed") === 1,
    `count=${countEventsOfType("FxSettlementConfirmed")}`,
  );

  // 6. Recon pipeline assertions.
  const gateRecon = runCreditLimitNoTradeRecon();
  r.assert(
    "recon:credit-limit-no-trade-without-loaded passes after trade",
    reconResultOk(gateRecon),
    `violations=${gateRecon.violations.length}`,
  );

  const exposureRecon = runCounterpartyExposureRecon();
  r.assert(
    "recon:counterparty-exposure-coverage passes",
    reconResultOk(exposureRecon),
    `violations=${exposureRecon.violations.length}`,
  );

  const lexRecon = runLexCapRecon();
  r.assert(
    "recon:lex-cap-utilisation passes (utilisation below Amber)",
    reconResultOk(lexRecon),
    `violations=${lexRecon.violations.length}`,
  );

  const provenanceRecon = runMarketDataProvenanceRecon();
  r.assert(
    "recon:market-data-provenance-gate passes (Atlas PR #643 SARB fixture envelope)",
    reconResultOk(provenanceRecon),
    `violations=${provenanceRecon.violations.length}: ${provenanceRecon.violations
      .slice(0, 2)
      .map((v) => v.message)
      .join("; ")}`,
  );

  // position-revalued-cites-mark is advisory in Slice B.1 — ok always true.
  // We still report violation count as a note.
  const positionRecon = runPositionRevaluedRecon();
  r.note(
    `recon:position-revalued-cites-mark (advisory): asserted=${positionRecon.checkedPositions}, ` +
      `matched=${positionRecon.matchedPositions}, violations=${positionRecon.violations.length}`,
  );
  r.assert(
    "recon:position-revalued-cites-mark advisory ok",
    reconResultOk(positionRecon),
    "advisory recon returned ok=false (Slice B.1 should always return ok=true)",
  );

  return r.result();
}

// ---------------------------------------------------------------------------
// Phase 3 — Herstatt-active failure (Investec ZA)
// ---------------------------------------------------------------------------

async function runPhase3(): Promise<PhaseResult> {
  const r = new PhaseRecorder("Phase 3 — Herstatt-active failure");

  const tradeId = "TRD-FX-SPOT-INTERNAL-TEST-002";
  const clientFlowRef = "test:internal-pre-licence:trade-002";

  const tradeEvent = buildFxSpotTrade({
    tradeId,
    counterpartyId: INVESTEC_BANK_ZA,
    counterpartyName: INVESTEC_BANK_NAME,
    clientFlowRef,
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(tradeEvent);

  const usdSettlement = buildFxSettlementInstructed({
    tradeId,
    settlementId: `STL-${tradeId}-USD`,
    counterpartyId: INVESTEC_BANK_ZA,
    counterpartyName: INVESTEC_BANK_NAME,
    legCurrency: "USD",
    amountMinor: USD_500K_MINOR,
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(usdSettlement);

  // Herstatt-active: bank's pay leg delivered, counterparty's receive leg
  // never arrived (one-leg-delivered).
  const herstattMsg: CorrespondentMessage = {
    tradeRef: tradeId,
    settlementInstructionRef: usdSettlement.event_id,
    valueDate: SETTLEMENT_DATE_ISO,
    cutoffAt: `${SETTLEMENT_DATE_ISO}T16:00:00Z`,
    toleranceMinutes: 30,
    observedAt: SETTLEMENT_TIMESTAMP,
    legStatus: { payLegDelivered: true, receiveLegDelivered: false },
    currencyPair: "USD/ZAR",
    legKind: "near",
    expectedReceiveCurrency: "USD",
    expectedReceiveAmountMinor: String(USD_500K_MINOR),
    failureReason: "Counterparty USD-leg not delivered at cutoff; Herstatt-active",
  };
  const feed = makeStaticCorrespondentFeed([herstattMsg]);
  let tick = 0;
  const subResult = runFxSettlementSubscriber(feed, {
    now: () => {
      const base = new Date(SETTLEMENT_TIMESTAMP).getTime();
      const t = new Date(base + tick * 1000);
      tick += 1;
      return t.toISOString();
    },
    actor: SETTLEMENT_ACTOR,
    entity: ENTITY,
    citations: [...SUBSCRIBER_CITATIONS],
  });
  for (const e of subResult.events) eventStore.append(e);

  r.assert(
    "Outcome kind = one-leg-delivered (PR #636 + PR #640)",
    subResult.outcomes.length === 1 && subResult.outcomes[0]?.kind === "one-leg-delivered",
    `outcomes=${subResult.outcomes.map((o) => o.kind).join(",")}`,
  );

  // Event count assertions: the subscriber emits 3 events per herstatt
  // outcome: MissedExpectedReceipt + FxSettlementFailed + SettlementFailureClassified.
  r.assert(
    "MissedExpectedReceipt emitted (PR #638)",
    countEventsOfType("MissedExpectedReceipt") === 1,
    `count=${countEventsOfType("MissedExpectedReceipt")}`,
  );
  r.assert(
    "FxSettlementFailed emitted (PR #638)",
    countEventsOfType("FxSettlementFailed") === 1,
    `count=${countEventsOfType("FxSettlementFailed")}`,
  );
  r.assert(
    "SettlementFailureClassified emitted (PR #638)",
    countEventsOfType("SettlementFailureClassified") === 1,
    `count=${countEventsOfType("SettlementFailureClassified")}`,
  );

  // Classification deterministic = herstatt-active.
  const classifiedEvents = findEventsByPredicate(
    "SettlementFailureClassified",
    (p) => p.settlementInstructionRef === usdSettlement.event_id,
  );
  r.assert(
    "Classification = herstatt-active (deterministic from one-leg-delivered)",
    classifiedEvents.length === 1 &&
      (classifiedEvents[0]?.payload as Record<string, unknown>).classification ===
        "herstatt-active",
    `classification=${String((classifiedEvents[0]?.payload as Record<string, unknown> | undefined)?.classification)}`,
  );

  // Phase-3 Bea posting-rule check: PR-FX-005 produces Stage-3 ECL postings
  // for the Herstatt-active branch. We invoke the pure function and assert
  // the journal shape — the bea-gl-posting-engine wiring is a separate
  // substrate slice not yet integrated into the scenario harness.
  try {
    const { fxSettlementFailedJournals } = await import(
      "../platform/accounting/posting-rules/fx-spot"
    );
    const failedEvent = findEventsByPredicate(
      "FxSettlementFailed",
      (p) => p.tradeRef === tradeId,
    )[0];
    if (!failedEvent) throw new Error("FxSettlementFailed for trade-002 not found");
    const failedPayload = failedEvent.payload as Record<string, unknown> & {
      failureKind: "one-leg-delivered" | "neither-delivered" | "operational-delay";
      legStatus: { payLegDelivered: boolean; receiveLegDelivered: boolean };
    };
    const usdReceiveLegMinor = USD_500K_MINOR;
    const zarEquivalentMinor = Math.round(USD_500K_MINOR * SPOT_RATE_USD_ZAR);
    const journals = fxSettlementFailedJournals({
      event: failedPayload as unknown as Parameters<typeof fxSettlementFailedJournals>[0]["event"],
      failedReceiveLeg: {
        currency: "USD",
        amountMinor: usdReceiveLegMinor,
        zarEquivalentMinor,
      },
    });

    // PR-FX-005 Herstatt-active produces 4 legs:
    //   Dr Settlement-Failed Receivable [USD]   USD 500k
    //   Cr FX Trading Receivable [USD]          USD 500k
    //   Dr Credit Loss Expense — FX Settlement  ZAR 9.262m
    //   Cr ECL Allowance — Settlement-Failed    ZAR 9.262m
    r.assert(
      "PR-FX-005 (Bea PR #641) produces 4 journal legs on Herstatt-active branch",
      journals.length === 4,
      `journals.length=${journals.length}`,
    );

    const settlementFailedReceivableLeg = journals.find(
      (l) => l.accountId === "ACC-2300-002" && l.debitCredit === "debit",
    );
    const fxTradingReceivableCrLeg = journals.find(
      (l) => l.accountId === "ACC-2100-002" && l.debitCredit === "credit",
    );
    const creditLossExpenseLeg = journals.find(
      (l) => l.accountId === "ACC-2300-004" && l.debitCredit === "debit",
    );
    const eclAllowanceLeg = journals.find(
      (l) => l.accountId === "ACC-2300-003" && l.debitCredit === "credit",
    );

    r.assert(
      "PR-FX-005 — Dr Settlement-Failed Receivable [USD] = USD 500k",
      settlementFailedReceivableLeg !== undefined &&
        settlementFailedReceivableLeg.amountMinor === usdReceiveLegMinor &&
        settlementFailedReceivableLeg.currency === "USD",
      `leg=${JSON.stringify(settlementFailedReceivableLeg)}`,
    );
    r.assert(
      "PR-FX-005 — Cr FX Trading Receivable [USD] = USD 500k (derecognise FVTPL)",
      fxTradingReceivableCrLeg !== undefined &&
        fxTradingReceivableCrLeg.amountMinor === usdReceiveLegMinor,
      `leg=${JSON.stringify(fxTradingReceivableCrLeg)}`,
    );
    r.assert(
      "PR-FX-005 — Dr Credit Loss Expense — FX Settlement (ZAR functional)",
      creditLossExpenseLeg !== undefined &&
        creditLossExpenseLeg.amountMinor === zarEquivalentMinor &&
        creditLossExpenseLeg.currency === "ZAR",
      `leg=${JSON.stringify(creditLossExpenseLeg)}`,
    );
    r.assert(
      "PR-FX-005 — Cr ECL Allowance — Settlement-Failed (100% Stage-3, IFRS 9 §5.5.13)",
      eclAllowanceLeg !== undefined &&
        eclAllowanceLeg.amountMinor === zarEquivalentMinor &&
        eclAllowanceLeg.currency === "ZAR",
      `leg=${JSON.stringify(eclAllowanceLeg)}`,
    );

    // Stage-3 ECL = 100% of expected receive leg.
    const eclAllowance = eclAllowanceLeg?.amountMinor ?? 0;
    r.assert(
      "Stage-3 ECL = 100% of expected receive-leg ZAR equivalent (IFRS 9 §5.5.13)",
      eclAllowance === zarEquivalentMinor,
      `ECL=${eclAllowance} expected=${zarEquivalentMinor}`,
    );
  } catch (err) {
    r.assert("PR-FX-005 (Bea PR #641) pure function evaluated", false, String(err));
  }

  // Trade's clientFlowRef present on the failure-path events? The failure
  // events are keyed by tradeRef; clientFlowRef does NOT propagate directly
  // onto FxSettlementFailed (event-schema choice; the reverse-lookup is via
  // tradeRef → FxTradeExecuted.clientFlowRef). Assert the lookup works.
  const failedEvents = findEventsByPredicate("FxSettlementFailed", (p) => p.tradeRef === tradeId);
  r.assert(
    "FxSettlementFailed.tradeRef back-links to clientFlowRef via FxTradeExecuted",
    failedEvents.length === 1 &&
      findEventsByPredicate("FxTradeExecuted", (p) => {
        const id = p.tradeId as { value?: string } | undefined;
        return id?.value === tradeId && p.clientFlowRef === clientFlowRef;
      }).length === 1,
    `failedEvents=${failedEvents.length}`,
  );

  return r.result();
}

// ---------------------------------------------------------------------------
// Phase 4 — Mutual fail (neither-delivered)
// ---------------------------------------------------------------------------

async function runPhase4(): Promise<PhaseResult> {
  const r = new PhaseRecorder("Phase 4 — Mutual fail (neither-delivered)");

  const tradeId = "TRD-FX-SPOT-INTERNAL-TEST-003";
  const clientFlowRef = "test:internal-pre-licence:trade-003";

  const tradeEvent = buildFxSpotTrade({
    tradeId,
    counterpartyId: STANDARD_BANK_ZA,
    counterpartyName: STANDARD_BANK_NAME,
    clientFlowRef,
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(tradeEvent);

  const usdSettlement = buildFxSettlementInstructed({
    tradeId,
    settlementId: `STL-${tradeId}-USD`,
    counterpartyId: STANDARD_BANK_ZA,
    counterpartyName: STANDARD_BANK_NAME,
    legCurrency: "USD",
    amountMinor: USD_500K_MINOR,
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(usdSettlement);

  const mutualFailMsg: CorrespondentMessage = {
    tradeRef: tradeId,
    settlementInstructionRef: usdSettlement.event_id,
    valueDate: SETTLEMENT_DATE_ISO,
    cutoffAt: `${SETTLEMENT_DATE_ISO}T16:00:00Z`,
    toleranceMinutes: 30,
    observedAt: SETTLEMENT_TIMESTAMP,
    legStatus: { payLegDelivered: false, receiveLegDelivered: false },
    inFlight: false,
    currencyPair: "USD/ZAR",
    legKind: "near",
    failureReason: "Neither leg delivered at cutoff; mutual fail",
  };
  const beforeFailedCount = countEventsOfType("FxSettlementFailed");

  const feed = makeStaticCorrespondentFeed([mutualFailMsg]);
  let tick = 0;
  const subResult = runFxSettlementSubscriber(feed, {
    now: () => {
      const base = new Date(SETTLEMENT_TIMESTAMP).getTime();
      const t = new Date(base + tick * 1000);
      tick += 1;
      return t.toISOString();
    },
    actor: SETTLEMENT_ACTOR,
    entity: ENTITY,
    citations: [...SUBSCRIBER_CITATIONS],
  });
  for (const e of subResult.events) eventStore.append(e);

  r.assert(
    "Outcome kind = neither-delivered",
    subResult.outcomes[0]?.kind === "neither-delivered",
    `outcomes=${subResult.outcomes.map((o) => o.kind).join(",")}`,
  );
  r.assert(
    "FxSettlementFailed{neither-delivered} emitted",
    countEventsOfType("FxSettlementFailed") === beforeFailedCount + 1,
    `delta=${countEventsOfType("FxSettlementFailed") - beforeFailedCount}`,
  );

  // PR-FX-005 — neither-delivered branch — produces NO GL movement.
  try {
    const { fxSettlementFailedJournals } = await import(
      "../platform/accounting/posting-rules/fx-spot"
    );
    const failedEvent = findEventsByPredicate(
      "FxSettlementFailed",
      (p) => p.tradeRef === tradeId,
    )[0];
    if (!failedEvent) throw new Error("FxSettlementFailed for trade-003 not found");
    const failedPayload = failedEvent.payload as Record<string, unknown> & {
      failureKind: "one-leg-delivered" | "neither-delivered" | "operational-delay";
    };
    const journals = fxSettlementFailedJournals({
      event: failedPayload as unknown as Parameters<typeof fxSettlementFailedJournals>[0]["event"],
    });
    r.assert(
      "PR-FX-005 (Bea PR #641) — neither-delivered branch produces zero GL postings (FVTPL out of ECL scope)",
      journals.length === 0,
      `journals.length=${journals.length}`,
    );
  } catch (err) {
    r.assert("PR-FX-005 — neither-delivered branch evaluated", false, String(err));
  }

  // Classification = mutual-fail.
  const classifiedEvents = findEventsByPredicate(
    "SettlementFailureClassified",
    (p) => p.settlementInstructionRef === usdSettlement.event_id,
  );
  r.assert(
    "Classification = mutual-fail",
    classifiedEvents[0] !== undefined &&
      (classifiedEvents[0].payload as Record<string, unknown>).classification === "mutual-fail",
    `classification=${String((classifiedEvents[0]?.payload as Record<string, unknown> | undefined)?.classification)}`,
  );

  return r.result();
}

// ---------------------------------------------------------------------------
// Phase 5 — Operational delay
// ---------------------------------------------------------------------------

async function runPhase5(): Promise<PhaseResult> {
  const r = new PhaseRecorder("Phase 5 — Operational delay");

  const tradeId = "TRD-FX-SPOT-INTERNAL-TEST-004";
  const clientFlowRef = "test:internal-pre-licence:trade-004";

  const tradeEvent = buildFxSpotTrade({
    tradeId,
    counterpartyId: INVESTEC_BANK_ZA,
    counterpartyName: INVESTEC_BANK_NAME,
    clientFlowRef,
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(tradeEvent);

  const usdSettlement = buildFxSettlementInstructed({
    tradeId,
    settlementId: `STL-${tradeId}-USD`,
    counterpartyId: INVESTEC_BANK_ZA,
    counterpartyName: INVESTEC_BANK_NAME,
    legCurrency: "USD",
    amountMinor: USD_500K_MINOR,
    asOf: TRADE_TIMESTAMP,
  });
  eventStore.append(usdSettlement);

  const opDelayMsg: CorrespondentMessage = {
    tradeRef: tradeId,
    settlementInstructionRef: usdSettlement.event_id,
    valueDate: SETTLEMENT_DATE_ISO,
    cutoffAt: `${SETTLEMENT_DATE_ISO}T16:00:00Z`,
    toleranceMinutes: 30,
    observedAt: SETTLEMENT_TIMESTAMP,
    legStatus: { payLegDelivered: false, receiveLegDelivered: false },
    inFlight: true, // discriminator → operational-delay
    currencyPair: "USD/ZAR",
    legKind: "near",
    failureReason: "Correspondent reports in-flight settlement past cutoff window",
  };
  const beforeFailedCount = countEventsOfType("FxSettlementFailed");
  const feed = makeStaticCorrespondentFeed([opDelayMsg]);
  let tick = 0;
  const subResult = runFxSettlementSubscriber(feed, {
    now: () => {
      const base = new Date(SETTLEMENT_TIMESTAMP).getTime();
      const t = new Date(base + tick * 1000);
      tick += 1;
      return t.toISOString();
    },
    actor: SETTLEMENT_ACTOR,
    entity: ENTITY,
    citations: [...SUBSCRIBER_CITATIONS],
  });
  for (const e of subResult.events) eventStore.append(e);

  r.assert(
    "Outcome kind = operational-delay",
    subResult.outcomes[0]?.kind === "operational-delay",
    `outcomes=${subResult.outcomes.map((o) => o.kind).join(",")}`,
  );
  r.assert(
    "FxSettlementFailed{operational-delay} emitted",
    countEventsOfType("FxSettlementFailed") === beforeFailedCount + 1,
    `delta=${countEventsOfType("FxSettlementFailed") - beforeFailedCount}`,
  );

  // PR-FX-005 — operational-delay branch — produces NO GL movement.
  try {
    const { fxSettlementFailedJournals } = await import(
      "../platform/accounting/posting-rules/fx-spot"
    );
    const failedEvent = findEventsByPredicate(
      "FxSettlementFailed",
      (p) => p.tradeRef === tradeId,
    )[0];
    if (!failedEvent) throw new Error("FxSettlementFailed for trade-004 not found");
    const failedPayload = failedEvent.payload as Record<string, unknown> & {
      failureKind: "one-leg-delivered" | "neither-delivered" | "operational-delay";
    };
    const journals = fxSettlementFailedJournals({
      event: failedPayload as unknown as Parameters<typeof fxSettlementFailedJournals>[0]["event"],
    });
    r.assert(
      "PR-FX-005 (Bea PR #641) — operational-delay branch produces zero GL postings (no default event)",
      journals.length === 0,
      `journals.length=${journals.length}`,
    );
  } catch (err) {
    r.assert("PR-FX-005 — operational-delay branch evaluated", false, String(err));
  }

  const classifiedEvents = findEventsByPredicate(
    "SettlementFailureClassified",
    (p) => p.settlementInstructionRef === usdSettlement.event_id,
  );
  r.assert(
    "Classification = operational-delay",
    classifiedEvents[0] !== undefined &&
      (classifiedEvents[0].payload as Record<string, unknown>).classification ===
        "operational-delay",
    `classification=${String((classifiedEvents[0]?.payload as Record<string, unknown> | undefined)?.classification)}`,
  );

  return r.result();
}

// ---------------------------------------------------------------------------
// Phase 6 — Output summary
// ---------------------------------------------------------------------------

interface ScenarioSummary {
  readonly tradesBooked: number;
  readonly eventsEmitted: number;
  readonly reconCounts: { passed: number; total: number };
  readonly runtimeMs: number;
  readonly substrateGaps: readonly string[];
  readonly status: "READY-FOR-CONTROLLED-LAUNCH" | string;
}

function renderSummary(phaseResults: readonly PhaseResult[], summary: ScenarioSummary): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("================================================================");
  lines.push("FX-SPOT INTERNAL PRE-LICENCE TEST — RUN SUMMARY");
  lines.push("================================================================");
  lines.push("");
  for (const p of phaseResults) {
    const status = p.ok ? "PASS" : "FAIL";
    lines.push(`${p.phase.padEnd(50)} ${status}`);
    for (const note of p.notes) lines.push(`    - ${note}`);
    for (const failure of p.failures) lines.push(`    ! ${failure}`);
  }
  lines.push("");
  lines.push(`Trades booked:           ${summary.tradesBooked}`);
  lines.push(`Events emitted:          ${summary.eventsEmitted}`);
  lines.push(`Recon pipelines passed:  ${summary.reconCounts.passed}/${summary.reconCounts.total}`);
  lines.push(`Total runtime:           ${(summary.runtimeMs / 1000).toFixed(2)}s`);
  lines.push("");
  lines.push("Substrate gaps surfaced this run:");
  if (summary.substrateGaps.length === 0) {
    lines.push("  (none — every component this scenario touched was substrate-complete)");
  } else {
    for (const gap of summary.substrateGaps) lines.push(`  - ${gap}`);
  }
  lines.push("");
  lines.push(`Internal pre-licence test status: ${summary.status}`);
  lines.push("================================================================");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

interface RunOptions {
  readonly cleanup: boolean;
}

export async function runFxSpotInternalPreLicenceTest(
  opts: RunOptions = { cleanup: true },
): Promise<{ ok: boolean; phaseResults: PhaseResult[]; summary: ScenarioSummary }> {
  const t0 = Date.now();

  // The pre-run DB wipe is done by the package.json shell command (so that
  // composition.ts opens an empty store on its first import — see header).

  // Run scenario events alongside production events in projections — this
  // lets the recon pipelines fold the scenario stream. Matches scenario 06.
  setDefaultProvenanceModeOverride("combined");

  // Run phases.
  const p1 = await runPhase1();
  const p2 = p1.ok
    ? await runPhase2()
    : {
        phase: "Phase 2 — Happy-path trade lifecycle",
        ok: false,
        notes: [],
        failures: ["skipped (Phase 1 failed)"],
      };
  const p3 = p1.ok
    ? await runPhase3()
    : {
        phase: "Phase 3 — Herstatt-active failure",
        ok: false,
        notes: [],
        failures: ["skipped (Phase 1 failed)"],
      };
  const p4 = p1.ok
    ? await runPhase4()
    : {
        phase: "Phase 4 — Mutual fail",
        ok: false,
        notes: [],
        failures: ["skipped (Phase 1 failed)"],
      };
  const p5 = p1.ok
    ? await runPhase5()
    : {
        phase: "Phase 5 — Operational delay",
        ok: false,
        notes: [],
        failures: ["skipped (Phase 1 failed)"],
      };

  const phaseResults = [p1, p2, p3, p4, p5];

  // Final recon sweep over the live stream.
  const allRecons: Array<{ name: string; ok: boolean }> = [];
  for (const [name, rec] of [
    ["credit-limit-no-trade-without-loaded", runCreditLimitNoTradeRecon()],
    ["counterparty-exposure-coverage", runCounterpartyExposureRecon()],
    ["lex-cap-utilisation", runLexCapRecon()],
    ["market-data-provenance-gate", runMarketDataProvenanceRecon()],
    ["position-revalued-cites-mark", runPositionRevaluedRecon()],
  ] as Array<[string, ReconResult]>) {
    allRecons.push({ name, ok: rec.ok });
  }

  // Total events emitted.
  let totalEvents = 0;
  for (const _ of eventStore.replay({})) totalEvents += 1;

  // Substrate gaps surfaced this run (carry into the summary).
  const substrateGaps: string[] = [
    "Bea SicrTriggered follow-on event flow (Stage-2 SICR signal for FVTPL trades on mutual-fail) — not yet built.",
    "recon:no-prop-attribution gate (clientFlowRef vs hedgeProgrammeRef carrying-field assertion) — out of scope per brief; placeholder for future Vera Wave-4 pipeline.",
    "PR-FX-005 GL-engine wire-up — fxSettlementFailedJournals invoked here as a pure function; integration via bea-gl-posting-engine subscriber to FxSettlementFailed is a separate substrate slice.",
    "BA-325 LCR period-close integration — not invoked here; the BA-325 subscriber requires a PeriodClosed envelope (Slice A.1) which is outside this rehearsal's clock-tick scope. Pre-licence integration test will exercise it on a controlled-launch clock.",
    "Daily P&L (runDailyPnLReport) — not invoked here; the report depends on a GL trial balance assembled by bea-gl-posting-engine, which is a downstream slice. Pre-licence integration test will exercise it on a controlled-launch clock.",
    "FxPositionRevalued.officialMarkRef field (Slice D of D-EVENT-VIEW-BOUNDARY-WIRE) — current recon is advisory (Slice B.1); schema-typed gating is the next slice.",
    "ProvenanceTag.sourceEventId — settlement events carry tradeRef but no typed link to the upstream FxSettlementInstructed event_id in the provenance envelope.",
  ];

  // Aggregate ok.
  const ok = phaseResults.every((p) => p.ok);
  const status: ScenarioSummary["status"] = ok
    ? "READY-FOR-CONTROLLED-LAUNCH"
    : `BLOCKED-BY-${phaseResults.find((p) => !p.ok)?.phase ?? "UNKNOWN"}`;

  const summary: ScenarioSummary = {
    tradesBooked: 4,
    eventsEmitted: totalEvents,
    reconCounts: {
      passed: allRecons.filter((r) => r.ok).length,
      total: allRecons.length,
    },
    runtimeMs: Date.now() - t0,
    substrateGaps,
    status,
  };

  // Print summary.
  console.log(renderSummary(phaseResults, summary));

  // Cleanup (controlled by caller — tests pass cleanup:false to inspect).
  if (opts.cleanup) cleanupStores();

  return { ok, phaseResults, summary };
}

// ---------------------------------------------------------------------------
// Top-level invocation
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = await runFxSpotInternalPreLicenceTest({ cleanup: true });
  process.exit(result.ok ? 0 : 1);
}
