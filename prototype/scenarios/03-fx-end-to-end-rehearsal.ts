// scenarios/03-fx-end-to-end-rehearsal.ts
//
// Phase A + Phase B — first dry-run scenario per
// `Owner Inbox/actioned/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`
// §2.1 (T0–T7), §2.2 (T8–T14) and §6 dispatch #A4. Standing authority:
// `D-FIRST-DRY-RUN-SCENARIO` (CEO-approved 2026-05-10).
//
// CHOREOGRAPHY (Phase A — open accounts + execute one trade):
//
//   T0  AccountOpened   — ZAR nostro at SimulatedBank Co.        (Tomas)
//   T1  AccountOpened   — USD nostro at SimulatedBank Co.        (Tomas)
//   T2  AccountOpened   — ZAR capital account                    (Tomas)
//   T3  CapitalContributionRecorded — ZAR 300m                   (Bea)
//   T4  Counterparty replay (CP-SYN-DRYRUN-001)                  (Niko)
//   T5  RfqRequested    — USD/ZAR spot, USD 5m                   (Saskia)
//   T6  PricingModelEvaluated — synthetic mid 18.5000            (Rohan)
//   T7  FxTradeExecuted — USD 5,000,000 vs ZAR 92,500,000 T+2    (Saskia)
//
// CHOREOGRAPHY (Phase B — settlement + sub-ledger + period close):
//
//   T7a SubLedgerPostingEmitted — trade-date booking               (Bea)
//   T8  FxSettlementInstructed  — USD leg (pacs.009 stub)          (Tomas)
//   T9  FxSettlementInstructed  — ZAR leg (pacs.009 stub)          (Tomas)
//   T10 SubLedgerPostingEmitted — USD leg settlement true-up       (Bea)
//        + AccountPostingRecorded   — USD nostro +5m               (Bea/Tomas)
//   T11 SubLedgerPostingEmitted — ZAR leg settlement true-up       (Bea)
//        + AccountPostingRecorded   — ZAR nostro -92.5m            (Bea/Tomas)
//   T12 AccountingPeriodOpened   — LE-ZA-HOZ-BANK · 2026-Q1-M01    (Bea)
//   T13 SubLedgerPostingEmitted  — synthetic FX revaluation row    (Bea)
//        (RevaluationApplied family does not yet exist — sub-ledger
//        posting is the closest existing event family; substrate gap
//        surfaced in the decision record)
//   T14 TrialBalanceSnapshotted + AccountingPeriodClosed           (Bea)
//        — emitted by `closePeriod` orchestrator under
//        D-REPORTING-CAPABILITY-M2-M3 Slice 2 (PR #170).
//
// PROVENANCE: every event carries
//   { kind: 'simulated',
//     scenario: 'first-dry-run-2026-Q1',
//     sourceLineage: 'scenario-runner:03-fx-end-to-end-rehearsal' }
// per `D-DATA-PROVENANCE-SUBSTRATE` Slice 1 (merged).
//
// SCENARIO CLOCK: per pack §3 #2, a `D-SCENARIO-CLOCK` substrate is
// in-flight under Atlas (#A2). When the merged substrate exists, this
// script switches to its injection point. Until then we use a local
// `SimulatedClock` shim — same shape, replaced inline at substrate-merge
// time. See TODO(#A2) markers below.
//
// BANK ACCOUNTS: per pack §3 #1, `D-BANK-ACCOUNT-SUBSTRATE` is in-flight
// under Tomas (#A1). When the typed event family + AccountMaster /
// AccountBalance projections land, this script swaps the local
// `accountOpened()` / `capitalContribution()` placeholders for the
// canonical factories. See TODO(#A1) markers.
//
// FX RFQ → EMIT: per pack §3 #8, `D-FX-SALES-TRADING-FRONTEND` Slice 2
// (#A3) provides the RFQ form + emit path. The CDM `FxTradeExecuted`
// (M4 foundation slice, merged) is the canonical trade event regardless.
// When Slice 2 lands, the RFQ + pricing emissions route through its
// pricer; until then we emit them as scenario-direct. See TODO(#A3).
//
// Authors:
//   - Saskia (Head of Global Markets, governance — owns trade-execution leg)
//   - Kai (Trading systems engineer, engineering — owns FX CDM wiring)
//   - Bea (Accounting & financial reporting engineer, engineering — owns
//     capital / sub-ledger leg + Phase-B period close)
//   - Tomas (Operations & payments engineer, engineering — reports to Devon
//     COO; Phase-B settlement + payments leg)
//
// Run: `bun run scenario:dry-run-fx`  (runs Phase A + B end-to-end)

import { unlinkSync } from "node:fs";

import {
  counterpartyId,
  kycCompleted,
  mandateAssigned,
  prospectRegistered,
  soundingOpened,
} from "@domains/customer";
import type { PartyId } from "@domains/party";
import { closePeriod, openPeriod } from "@platform/accounting/period-close";
import { type Actor, BANK_ZA_001, newEventId } from "@platform/core/types";
import { type ProvenanceTag, simulatedTag } from "@platform/event-store/provenance";
import { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import { makeFxSettlementInstructed, makeFxTradeExecuted } from "@platform/markets/cdm/fx";
import { logger } from "@platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants — scenario id, lineage, entity, counterparty.
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "first-dry-run-2026-Q1";
export const SOURCE_LINEAGE = "scenario-runner:03-fx-end-to-end-rehearsal";
export const ENTITY = BANK_ZA_001; // LE-ZA-HOZ-BANK alias in build phase
export const COUNTERPARTY_ID = counterpartyId("CP-SYN-DRYRUN-001");
export const COUNTERPARTY_NAME = "SimulatedBank Co.";

// ---------------------------------------------------------------------------
// Provenance tag — every event in this scenario carries this exact tag.
// ---------------------------------------------------------------------------

export const SCENARIO_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
});

// ---------------------------------------------------------------------------
// Simulated clock — local shim until D-SCENARIO-CLOCK merges (#A2).
//
// Once #A2 lands the substrate at `@platform/scenario/clock` (or wherever
// Atlas anchors it), this class is deleted and its constructor + `tick()`
// are replaced with the substrate's injection point. The interface is
// kept deliberately small — `asOf()` returning ISO UTC + a `tick()` that
// advances by some duration — so the swap is mechanical.
// ---------------------------------------------------------------------------

// TODO(#A2 D-SCENARIO-CLOCK): replace with substrate-provided clock once
// Atlas's slice merges. Until then, the local shim below is deterministic
// (no `Date.now()` reads); seed it with the scenario baseline.
class SimulatedClock {
  private current: Date;

  constructor(baselineIso: string) {
    this.current = new Date(baselineIso);
  }

  asOf(): string {
    return this.current.toISOString();
  }

  /** Advance the clock by some number of minutes / hours / days. */
  tick({
    minutes = 0,
    hours = 0,
    days = 0,
  }: { minutes?: number; hours?: number; days?: number }): void {
    this.current = new Date(
      this.current.getTime() + minutes * 60_000 + hours * 60 * 60_000 + days * 24 * 60 * 60_000,
    );
  }

  /** Advance by an arbitrary duration in milliseconds (Phase B helpers). */
  advance(durationMs: number): void {
    this.current = new Date(this.current.getTime() + durationMs);
  }

  /** Jump to a specific ISO timestamp (Phase B settlement-date / month-end). */
  setTo(isoTimestamp: string): void {
    this.current = new Date(isoTimestamp);
  }
}

// ---------------------------------------------------------------------------
// Local placeholder factories — bank-account events.
//
// TODO(#A1 D-BANK-ACCOUNT-SUBSTRATE): once Tomas + Atlas land the typed
// `AccountOpened` / `CapitalContributionRecorded` factories, swap these
// placeholders for the canonical ones. The types are speculative until
// then — kept narrow enough to reflect the pack §2.1 shape so the
// transition is mechanical.
// ---------------------------------------------------------------------------

interface AccountOpenedPayload {
  readonly accountId: string;
  readonly accountKind: "nostro" | "vostro" | "capital" | "sundry";
  readonly currency: "ZAR" | "USD";
  readonly correspondent?: string;
  readonly chartOfAccountsLeaf: string;
}

function makeAccountOpenedPlaceholder(args: {
  asOf: string;
  actor: Actor;
  citations: string[];
  payload: AccountOpenedPayload;
}): Event {
  // TODO(#A1): replace with `accountOpened(payload, opts)` from
  // `@domains/accounts` once the substrate merges.
  return {
    event_id: newEventId(),
    type: "AccountOpened",
    as_of: args.asOf,
    entity: ENTITY,
    actor: args.actor,
    citations: args.citations,
    payload: { ...args.payload },
    provenance: SCENARIO_PROVENANCE,
  };
}

interface CapitalContributionPayload {
  readonly accountId: string;
  readonly currency: "ZAR" | "USD";
  readonly amountMinor: number;
  readonly basis: string;
}

function makeCapitalContributionPlaceholder(args: {
  asOf: string;
  actor: Actor;
  citations: string[];
  payload: CapitalContributionPayload;
}): Event {
  // TODO(#A1 / Bea posting-rules): replace once D-BANK-ACCOUNT-SUBSTRATE
  // and D-REPORTING-CAPABILITY-M2-M3 Slice 2.5 (posting-rules) land.
  return {
    event_id: newEventId(),
    type: "CapitalContributionRecorded",
    as_of: args.asOf,
    entity: ENTITY,
    actor: args.actor,
    citations: args.citations,
    payload: { ...args.payload },
    provenance: SCENARIO_PROVENANCE,
  };
}

// ---------------------------------------------------------------------------
// Local placeholder factories — RFQ + pricing.
//
// TODO(#A3 D-FX-SALES-TRADING-FRONTEND Slice 2): once Kai's RFQ form +
// emit path lands, route T5/T6 through the desk pricer and remove these
// scenario-direct emissions.
// ---------------------------------------------------------------------------

function makeRfqRequested(args: {
  asOf: string;
  actor: Actor;
  rfqId: string;
}): Event {
  // Updated to the typed RfqRequestedPayload schema (Slice 3 — Kai, 2026-05-18).
  // Previously used an untyped object payload; now uses the canonical string
  // fields required by the rfqRequestedPayloadSchema Zod validator.
  return {
    event_id: newEventId(),
    type: "RfqRequested",
    as_of: args.asOf,
    entity: ENTITY,
    actor: args.actor,
    citations: [
      "D-MARKETS-SCHEMA-FOUNDATION",
      "INTERNAL-NPA-FX-SPOT",
      "D-FX-SALES-TRADING-FRONTEND",
    ],
    payload: {
      rfqId: args.rfqId,
      counterpartyId: String(COUNTERPARTY_ID),
      currencyPair: "USD/ZAR",
      side: "buy",
      notional: 5_000_000, // USD 5m in major units
      valueDate: "2026-01-07", // T+2 from 2026-01-05
      requestedAt: args.asOf,
    },
    provenance: SCENARIO_PROVENANCE,
  };
}

function makePricingModelEvaluated(args: {
  asOf: string;
  actor: Actor;
  rfqId: string;
}): Event {
  return {
    event_id: newEventId(),
    type: "PricingModelEvaluated",
    as_of: args.asOf,
    entity: ENTITY,
    actor: args.actor,
    citations: ["D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    payload: {
      rfqId: args.rfqId,
      currencyPair: { base: "USD", quote: "ZAR" },
      midRate: 18.5,
      bidRate: 18.4995,
      offerRate: 18.5005,
      modelId: "fx-spot-mid-stub-v0",
    },
    provenance: SCENARIO_PROVENANCE,
  };
}

// ---------------------------------------------------------------------------
// Counterparty replay — minimal Tier-1 onboard tagged with scenario id.
// Pattern from prototype/scenarios/02-onboard-counterparty.ts. We re-emit
// the smallest set of events that activates a CP for the dry-run; full
// onboarding lives in 02 and is not duplicated here.
// ---------------------------------------------------------------------------

function counterpartyReplayEvents(opts: {
  asOf: string;
  niko: Actor;
  mira: Actor;
  saskia: Actor;
}): Event[] {
  const tag = SCENARIO_PROVENANCE;
  const stamp = (e: Event): Event => ({ ...e, provenance: tag, as_of: opts.asOf });
  return [
    stamp(
      soundingOpened(
        {
          counterpartyId: COUNTERPARTY_ID,
          channel: "introduction",
          introSource: "scenario-fixture",
        },
        { actor: opts.niko, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
      ),
    ),
    stamp(
      prospectRegistered(
        {
          counterpartyId: COUNTERPARTY_ID,
          legalName: COUNTERPARTY_NAME,
          jurisdiction: "ZA",
          sector: "non-bank-financial-institution",
        },
        { actor: opts.niko, citations: ["INTERNAL-COUNTERPARTY-ONBOARDING-POLICY"] },
      ),
    ),
    stamp(
      kycCompleted(
        {
          counterpartyId: COUNTERPARTY_ID,
          tier: "Tier-1",
          pep: false,
          sanctionsClear: true,
          jurisdictionalRiskScore: "low",
          reviewerId: "urn:party:natural-person:mira-compliance" as PartyId, // Synthetic fixture URN — D-PARTY-REGISTER PR 4 tightening.
        },
        { actor: opts.mira, citations: ["FIC-S21", "FIC-GN7-RBA"] },
      ),
    ),
    stamp(
      mandateAssigned(
        {
          counterpartyId: COUNTERPARTY_ID,
          products: ["FX-spot"],
          limits: { ccr_eepe_zar: 50_000_000_00 }, // R50m EEPE in cents
          rasReference: "RAS-2026-CCR-INSTITUTIONAL",
        },
        {
          actor: opts.saskia,
          citations: ["RAS-2026", "INTERNAL-COUNTERPARTY-CREDIT-POLICY"],
        },
      ),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Phase-A choreography builder — pure: no I/O, returns the event list
// in T0–T7 order. Used by the runner below and by the test.
// ---------------------------------------------------------------------------

export interface PhaseAEvents {
  readonly all: ReadonlyArray<Event>;
  readonly accountsOpened: ReadonlyArray<Event>;
  readonly capitalContribution: Event;
  readonly counterpartyReplay: ReadonlyArray<Event>;
  readonly rfq: Event;
  readonly pricing: Event;
  readonly trade: Event;
}

export function buildPhaseAEvents(): PhaseAEvents {
  // Scenario baseline: 2026-Q1 starts 2026-01-05 09:00 SAST = 07:00 UTC.
  const clock = new SimulatedClock("2026-01-05T07:00:00.000Z");

  const tomas: Actor = { type: "human", id: "tomas@bank.local" };
  const bea: Actor = { type: "human", id: "bea@bank.local" };
  const niko: Actor = { type: "human", id: "niko@bank.local" };
  const mira: Actor = { type: "human", id: "mira@bank.local" };
  const saskia: Actor = { type: "human", id: "saskia@bank.local" };
  const rohanModel: Actor = { type: "service", id: "fx-pricing-model" };

  // T0 — ZAR nostro
  const accountZarNostro = makeAccountOpenedPlaceholder({
    asOf: clock.asOf(),
    actor: tomas,
    citations: ["ORG-BANKS-ACT-94-1990", "INTERNAL-FINANCE-CHART-OF-ACCOUNTS"],
    payload: {
      accountId: "ACC-ZAR-NOSTRO-001",
      accountKind: "nostro",
      currency: "ZAR",
      correspondent: COUNTERPARTY_NAME,
      chartOfAccountsLeaf: "assets.cash-and-equivalents.nostro.zar",
    },
  });
  clock.tick({ minutes: 1 });

  // T1 — USD nostro
  const accountUsdNostro = makeAccountOpenedPlaceholder({
    asOf: clock.asOf(),
    actor: tomas,
    citations: ["ORG-BANKS-ACT-94-1990", "INTERNAL-FINANCE-CHART-OF-ACCOUNTS"],
    payload: {
      accountId: "ACC-USD-NOSTRO-001",
      accountKind: "nostro",
      currency: "USD",
      correspondent: COUNTERPARTY_NAME,
      chartOfAccountsLeaf: "assets.cash-and-equivalents.nostro.usd",
    },
  });
  clock.tick({ minutes: 1 });

  // T2 — ZAR capital account
  const accountCapital = makeAccountOpenedPlaceholder({
    asOf: clock.asOf(),
    actor: tomas,
    citations: ["ORG-BANKS-ACT-94-1990", "INTERNAL-FINANCE-CAPITAL-PLAN-V1"],
    payload: {
      accountId: "ACC-ZAR-CAPITAL-001",
      accountKind: "capital",
      currency: "ZAR",
      chartOfAccountsLeaf: "equity.capital.ordinary.zar",
    },
  });
  clock.tick({ minutes: 1 });

  // T3 — Capital contribution: R300m
  const capitalContribution = makeCapitalContributionPlaceholder({
    asOf: clock.asOf(),
    actor: bea,
    citations: ["INTERNAL-FINANCE-CAPITAL-PLAN-V1"],
    payload: {
      accountId: "ACC-ZAR-CAPITAL-001",
      currency: "ZAR",
      amountMinor: 300_000_000_00, // R300m in cents
      basis: "founder-capital-contribution-v1",
    },
  });
  clock.tick({ hours: 1 });

  // T4 — Counterparty replay
  const counterpartyReplay = counterpartyReplayEvents({
    asOf: clock.asOf(),
    niko,
    mira,
    saskia,
  });
  clock.tick({ hours: 1 });

  // T5 — RFQ
  const rfqId = "RFQ-DRYRUN-001";
  const rfq = makeRfqRequested({ asOf: clock.asOf(), actor: saskia, rfqId });
  clock.tick({ minutes: 1 });

  // T6 — Pricing
  const pricing = makePricingModelEvaluated({
    asOf: clock.asOf(),
    actor: rohanModel,
    rfqId,
  });
  clock.tick({ minutes: 1 });

  // T7 — FxTradeExecuted (canonical M4 CDM event)
  const tradeBase = makeFxTradeExecuted({
    asOf: clock.asOf(),
    entity: ENTITY,
    actor: saskia,
    citations: [
      "ORG-MK-08-EXCON-AD-RULES",
      "D-FX-BOOK-BOUNDARY",
      "ISDA-MASTER-2002",
      "INTERNAL-COUNTERPARTY-CREDIT-POLICY",
    ],
    payload: {
      tradeId: { scheme: "INTERNAL", value: "TRD-DRYRUN-001" },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      legs: [
        {
          legKind: "near",
          payCurrency: "ZAR",
          receiveCurrency: "USD",
          // Bank pays ZAR 92,500,000 (= USD 5m × 18.5)
          notional: { currency: "ZAR", amountMinor: 9_250_000_000_00 },
          counterNotional: { currency: "USD", amountMinor: 5_000_000_00 },
          rate: { currency: "ZAR", amount: 18.5 },
          settlementDate: { iso: "2026-01-07", calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: "2026-01-05", calendar: "JIHCAL" },
      counterparty: {
        partyId: String(COUNTERPARTY_ID),
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: "OTC",
      trader: "saskia@bank.local",
      bookId: "BOOK-FX-MARKETS-LP",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      // No-prop attribution (G-3) — client-flow rehearsal.
      clientFlowRef: "client-trade:scenario-03-dryrun-001",
    },
  });
  // Stamp the canonical CDM event with scenario provenance — the factory
  // does not yet take a provenance arg (M4 predates Slice 1 wiring).
  const trade: Event = { ...tradeBase, provenance: SCENARIO_PROVENANCE };

  const accountsOpened = [accountZarNostro, accountUsdNostro, accountCapital];
  const all: Event[] = [
    ...accountsOpened,
    capitalContribution,
    ...counterpartyReplay,
    rfq,
    pricing,
    trade,
  ];

  return {
    all,
    accountsOpened,
    capitalContribution,
    counterpartyReplay,
    rfq,
    pricing,
    trade,
  };
}

// ---------------------------------------------------------------------------
// Counts helper — used in the runner output and asserted in the test.
// ---------------------------------------------------------------------------

export function countByType(events: ReadonlyArray<Event>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) out[e.type] = (out[e.type] ?? 0) + 1;
  return out;
}

// ---------------------------------------------------------------------------
// Runner — entry point invoked by `bun run scenario:dry-run-fx`.
// ---------------------------------------------------------------------------

export function runPhaseA(opts: { dbPath: string; cleanup: boolean }): {
  ok: boolean;
  emitted: number;
  countsByType: Record<string, number>;
} {
  const phaseA = buildPhaseAEvents();

  // Wipe and recreate per-run so the script is deterministic on repeat.
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run */
  }

  const store = new EventStore(opts.dbPath);
  store.appendAll([...phaseA.all]);

  const total = store.count();
  const countsByType = countByType(phaseA.all);

  // Provenance recon (assertion #6 from pack §2.6) — every event carries
  // the scenario tag.
  let provenanceOk = true;
  for (const e of store.replay({ entity: ENTITY })) {
    if (
      e.provenance?.kind !== "simulated" ||
      e.provenance.scenario !== SCENARIO_ID ||
      e.provenance.sourceLineage !== SOURCE_LINEAGE
    ) {
      provenanceOk = false;
      break;
    }
  }

  store.close();
  if (opts.cleanup) {
    try {
      unlinkSync(opts.dbPath);
    } catch {
      /* nothing to clean */
    }
  }

  return { ok: provenanceOk && total === phaseA.all.length, emitted: total, countsByType };
}

// ===========================================================================
// PHASE B — settlement + sub-ledger + period close
// ===========================================================================
//
// Per pack §2.2 (T8–T14) and §5 Phase B. Phase B extends the Phase-A event
// stream with:
//
//   - sub-ledger trade-date posting (T7a — derived from T7 trade);
//   - FxSettlementInstructed for the USD and ZAR legs (T8/T9 — Tomas);
//   - sub-ledger settlement-date true-up postings + balance projection
//     posting events for the USD nostro (+5m) and ZAR nostro (-92.5m)
//     (T10/T11);
//   - AccountingPeriodOpened for 2026-Q1-M01 (T12);
//   - sub-ledger revaluation row (T13 — synthetic; the M2-territory
//     `RevaluationApplied` event family is not yet built. We post a
//     SubLedgerPostingEmitted with `postingType: "revaluation"` so the
//     trial-balance fold sees the FX revaluation P&L line. Substrate gap
//     surfaced in the decision record.);
//   - TrialBalanceSnapshotted + AccountingPeriodClosed via the
//     `closePeriod` orchestrator (T14 — the canonical Slice-2 close
//     transaction emits two events).
//
// Substrate gaps surfaced (and named in the decision record):
//
//   1. **No FxSettlementSettled event family.** The CDM has
//      `FxSettlementInstructed` but no settlement-confirmation event.
//      Phase B's "ack received" semantics (pack §2.2 T10/T11) are
//      represented today by appending the `SubLedgerPostingEmitted` true-up
//      + a posting-convention-shaped `AccountPostingRecorded` event that
//      the bank-account balance projection folds. When the
//      settlement-confirmation event family lands (Tomas roadmap), the
//      true-up + balance posting flow through that handler instead of
//      direct-emission.
//
//   2. **No RevaluationApplied event family.** IAS-21 / IFRS-9 month-end
//      FX revaluation is named in the pack as a future-M2 event type. The
//      revaluation row is emitted today as a SubLedgerPostingEmitted with
//      `postingType: "revaluation"`; the trial-balance fold treats it
//      uniformly. Substrate gap routes to D-REPORTING-CAPABILITY-M2-M3
//      Slice 6+ (revaluation engine) per pack §3.
//
//   3. **Posting-rules engine is implicit.** Trade-date and settlement-
//      date postings are emitted scenario-direct (using the same
//      double-entry shape as Bea's M1 IFRS handler emits for equity
//      trades). Slice 2.5 (posting-rules engine) is the formal home;
//      until it lands, the scenario hand-rolls the postings to the same
//      schema. Per pack §3 gap #3.
// ---------------------------------------------------------------------------

// Phase-B chart-of-accounts leaves. M1 stub IDs (per Bea's M1 handler) until
// the chart-of-accounts populates with FX-trading-book leaves (Bea Substrate
// Gap §3, target M2). Convention: `ACC-<purpose>-stub` for stubs;
// `ACC-NNNN-NNN` once the canonical chart populates.
const ACC_USD_NOSTRO_STUB = "ACC-usd-nostro-stub";
const ACC_ZAR_NOSTRO_STUB = "ACC-zar-nostro-stub";
const ACC_FX_PENDING_STUB = "ACC-fx-pending-settlement-stub";
const ACC_FX_REVALUATION_STUB = "ACC-fx-revaluation-pl-stub";
const ACC_FX_POSITION_STUB = "ACC-fx-position-stub";

// Settlement amounts derived from the Phase-A trade payload. Kept as
// constants so the Phase-B test can independently assert the same numbers.
export const TRADE_USD_NOTIONAL_MINOR = 5_000_000_00; // USD 5,000,000.00 in cents
export const TRADE_ZAR_NOTIONAL_MINOR = 9_250_000_000_00; // ZAR 92,500,000.00 in cents

// Month-end revaluation: spot moves USD/ZAR 18.5000 → 18.4500. The bank is
// long USD 5m, so a 0.05 ZAR/USD downward move = -ZAR 250,000 P&L (in cents:
// 25_000_000). Direction: USD position revalues down vs ZAR functional ccy.
export const MONTH_END_USDZAR_RATE = 18.45;
export const REVALUATION_PNL_ZAR_MINOR = Math.round(
  TRADE_USD_NOTIONAL_MINOR * (MONTH_END_USDZAR_RATE - 18.5),
); // = -25_000_000 (R-250k)

// ---------------------------------------------------------------------------
// Phase-B factories — settlement instruction, sub-ledger posting, balance
// posting (convention-shape).
// ---------------------------------------------------------------------------

interface SubLedgerLeg {
  readonly debit: string;
  readonly credit: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly memo: string;
}

function makeSubLedgerPosting(args: {
  asOf: string;
  actor: Actor;
  citations: string[];
  tradeId: string;
  postingType: "trade-date-booking" | "settlement-confirmation" | "revaluation";
  legs: readonly SubLedgerLeg[];
  asOfDate: string;
  sourceEventId: string;
}): Event {
  return {
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: ENTITY,
    actor: args.actor,
    citations: args.citations,
    payload: {
      tradeId: args.tradeId,
      postingType: args.postingType,
      legs: [...args.legs],
      asOfDate: args.asOfDate,
      citations: args.citations,
      sourceEventId: args.sourceEventId,
    },
    provenance: SCENARIO_PROVENANCE,
  };
}

/**
 * Account-posting convention event — the `accountBalanceProjection` folds
 * any event whose payload carries `{accountId, cashAmountMinor, currency}`.
 * Until the FxSettlementSettled event family lands (substrate gap #1
 * above), Phase B emits these directly so the account-balance projection
 * sees the post-settlement balances.
 */
function makeAccountPostingRecorded(args: {
  asOf: string;
  actor: Actor;
  accountId: string;
  cashAmountMinor: number;
  currency: string;
  basis: string;
  citations: string[];
}): Event {
  return {
    event_id: newEventId(),
    type: "AccountPostingRecorded",
    as_of: args.asOf,
    entity: ENTITY,
    actor: args.actor,
    citations: args.citations,
    payload: {
      accountId: args.accountId,
      cashAmountMinor: args.cashAmountMinor,
      currency: args.currency,
      basis: args.basis,
    },
    provenance: SCENARIO_PROVENANCE,
  };
}

// ---------------------------------------------------------------------------
// Phase-B builder — pure, returns event lists (T7a, T8–T13). T14 is emitted
// by the `closePeriod` orchestrator at runtime in `runPhaseB` — it requires
// a live event store to compute the trial balance.
// ---------------------------------------------------------------------------

export interface PhaseBPreCloseEvents {
  readonly tradeDatePosting: Event;
  readonly settlementInstructed: ReadonlyArray<Event>;
  readonly settlementPostings: ReadonlyArray<Event>;
  readonly accountBalanceUpdates: ReadonlyArray<Event>;
  readonly accountingPeriodOpened: Event;
  readonly revaluationPosting: Event;
  /** All Phase-B events appended *before* the closePeriod orchestrator runs. */
  readonly all: ReadonlyArray<Event>;
}

export function buildPhaseBPreCloseEvents(opts: {
  /** The Phase-A trade event — required so Phase-B can reference its event_id. */
  readonly trade: Event;
  /** The Phase-A USD nostro accountId (for balance-posting target). */
  readonly usdNostroAccountId: string;
  /** The Phase-A ZAR nostro accountId. */
  readonly zarNostroAccountId: string;
}): PhaseBPreCloseEvents {
  // Phase B starts at the same trade-date as Phase A's trade
  // (2026-01-05); first event is the trade-date booking posting,
  // immediately after T7. Then the clock advances to settlement-date
  // (T+2 = 2026-01-07) for the settlement instructions and acks. Then
  // it jumps to month-end (2026-01-31 17:00 SAST = 15:00 UTC) for the
  // open-period / revaluation events. Period-close is emitted at
  // 2026-01-31 17:02.
  const clock = new SimulatedClock("2026-01-05T08:30:00.000Z");

  const tomas: Actor = { type: "human", id: "tomas@bank.local" };
  const bea: Actor = { type: "human", id: "bea@bank.local" };
  const rohanModel: Actor = { type: "service", id: "fx-revaluation-model" };

  // T7a — Trade-date booking posting. Two legs: long USD (debit FX position),
  // short ZAR (credit FX position-ZAR). Sign convention matches Bea's M1
  // handler: debit + amount, credit + amount; the sub-ledger fold treats
  // debit positively.
  const tradeId = "TRD-DRYRUN-001";
  const tradeDatePosting = makeSubLedgerPosting({
    asOf: clock.asOf(),
    actor: bea,
    citations: ["IFRS-9-§4.1.1", "IAS-1", "ORG-AC-01", "D-REPORTING-CAPABILITY-SLICE-2"],
    tradeId,
    postingType: "trade-date-booking",
    legs: [
      // Bank receives USD 5m (long position) — debit USD position
      {
        debit: ACC_FX_POSITION_STUB,
        credit: ACC_FX_PENDING_STUB,
        currency: "USD",
        amountMinor: TRADE_USD_NOTIONAL_MINOR,
        memo: `Trade-date FX-spot buy USD/ZAR ${tradeId}`,
      },
      // Bank pays ZAR 92.5m (short position) — credit ZAR pending
      {
        debit: ACC_FX_PENDING_STUB,
        credit: ACC_FX_POSITION_STUB,
        currency: "ZAR",
        amountMinor: TRADE_ZAR_NOTIONAL_MINOR,
        memo: `Trade-date FX-spot sell ZAR ${tradeId}`,
      },
    ],
    asOfDate: "2026-01-05",
    sourceEventId: opts.trade.event_id,
  });

  // Advance to T+2 = settlement date (2026-01-07 10:00 SAST = 08:00 UTC).
  clock.setTo("2026-01-07T08:00:00.000Z");

  // T8 — FxSettlementInstructed (USD leg).
  const settlementUsdInstructed = makeFxSettlementInstructed({
    asOf: clock.asOf(),
    entity: ENTITY,
    actor: tomas,
    citations: ["D-FX-CLS-MEMBERSHIP", "ORG-MK-08-EXCON-AD-RULES", "ISDA-MASTER-2002"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: tradeId },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: `STL-${tradeId}-USD` },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: String(COUNTERPARTY_ID),
        name: COUNTERPARTY_NAME,
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: {
        partyId: String(COUNTERPARTY_ID),
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      // Bank receives USD (positive net cash from bank's perspective).
      netCash: { currency: "USD", amountMinor: TRADE_USD_NOTIONAL_MINOR },
      settlementDate: { iso: "2026-01-07", calendar: "JIHCAL" },
      messageStandard: "ISO-20022-pacs.009",
    },
  });
  // The CDM factory does not yet take a provenance arg; stamp it.
  const settlementUsd: Event = { ...settlementUsdInstructed, provenance: SCENARIO_PROVENANCE };
  clock.advance(60_000); // +1 minute

  // T9 — FxSettlementInstructed (ZAR leg).
  const settlementZarInstructed = makeFxSettlementInstructed({
    asOf: clock.asOf(),
    entity: ENTITY,
    actor: tomas,
    citations: ["D-FX-CLS-MEMBERSHIP", "ORG-MK-08-EXCON-AD-RULES", "ISDA-MASTER-2002"],
    payload: {
      tradeId: { scheme: "INTERNAL", value: tradeId },
      legKind: "near",
      settlementId: { scheme: "INTERNAL", value: `STL-${tradeId}-ZAR` },
      settlementPath: "correspondent",
      settlementForm: "physical",
      correspondent: {
        partyId: String(COUNTERPARTY_ID),
        name: COUNTERPARTY_NAME,
        role: "settlement-agent",
        jurisdiction: "ZA",
      },
      counterparty: {
        partyId: String(COUNTERPARTY_ID),
        name: COUNTERPARTY_NAME,
        role: "counterparty",
        jurisdiction: "ZA",
      },
      // Bank pays ZAR (negative net cash from bank's perspective).
      netCash: { currency: "ZAR", amountMinor: -TRADE_ZAR_NOTIONAL_MINOR },
      settlementDate: { iso: "2026-01-07", calendar: "JIHCAL" },
      messageStandard: "ISO-20022-pacs.009",
    },
  });
  const settlementZar: Event = { ...settlementZarInstructed, provenance: SCENARIO_PROVENANCE };

  // Advance to settlement-ack window (D+2 14:00 SAST = 12:00 UTC).
  clock.setTo("2026-01-07T12:00:00.000Z");

  // T10 — USD leg settlement true-up. Sub-ledger: debit USD nostro, credit
  // FX-pending. AccountPostingRecorded: USD nostro +5m.
  const settlementUsdPosting = makeSubLedgerPosting({
    asOf: clock.asOf(),
    actor: bea,
    citations: ["IFRS-9-§4.1.1", "IAS-1", "ORG-AC-08", "D-REPORTING-CAPABILITY-SLICE-2"],
    tradeId,
    postingType: "settlement-confirmation",
    legs: [
      {
        debit: ACC_USD_NOSTRO_STUB,
        credit: ACC_FX_PENDING_STUB,
        currency: "USD",
        amountMinor: TRADE_USD_NOTIONAL_MINOR,
        memo: `USD leg settlement ack — ${tradeId}`,
      },
    ],
    asOfDate: "2026-01-07",
    sourceEventId: settlementUsd.event_id,
  });
  const usdBalancePosting = makeAccountPostingRecorded({
    asOf: clock.asOf(),
    actor: tomas,
    accountId: opts.usdNostroAccountId,
    cashAmountMinor: TRADE_USD_NOTIONAL_MINOR,
    currency: "USD",
    basis: `fx-settlement-credit:${tradeId}:USD`,
    citations: ["D-FX-CLS-MEMBERSHIP", "D-BANK-ACCOUNT-SUBSTRATE"],
  });
  clock.advance(60_000); // +1 minute

  // T11 — ZAR leg settlement true-up. Sub-ledger: debit FX-pending, credit
  // ZAR nostro. AccountPostingRecorded: ZAR nostro -92.5m.
  const settlementZarPosting = makeSubLedgerPosting({
    asOf: clock.asOf(),
    actor: bea,
    citations: ["IFRS-9-§4.1.1", "IAS-1", "ORG-AC-08", "D-REPORTING-CAPABILITY-SLICE-2"],
    tradeId,
    postingType: "settlement-confirmation",
    legs: [
      {
        debit: ACC_FX_PENDING_STUB,
        credit: ACC_ZAR_NOSTRO_STUB,
        currency: "ZAR",
        amountMinor: TRADE_ZAR_NOTIONAL_MINOR,
        memo: `ZAR leg settlement ack — ${tradeId}`,
      },
    ],
    asOfDate: "2026-01-07",
    sourceEventId: settlementZar.event_id,
  });
  const zarBalancePosting = makeAccountPostingRecorded({
    asOf: clock.asOf(),
    actor: tomas,
    accountId: opts.zarNostroAccountId,
    cashAmountMinor: -TRADE_ZAR_NOTIONAL_MINOR,
    currency: "ZAR",
    basis: `fx-settlement-debit:${tradeId}:ZAR`,
    citations: ["D-FX-CLS-MEMBERSHIP", "D-BANK-ACCOUNT-SUBSTRATE"],
  });

  // Advance to month-end close window (2026-01-31 17:00 SAST = 15:00 UTC).
  clock.setTo("2026-01-31T15:00:00.000Z");

  // T12 — AccountingPeriodOpened — emitted by the `closePeriod` orchestrator
  // at runtime (it cannot be pure-built; openPeriod appends to the store).
  // The builder constructs the canonical event shape so the test can assert
  // the payload independently.
  const accountingPeriodOpened: Event = {
    event_id: newEventId(),
    type: "AccountingPeriodOpened",
    as_of: clock.asOf(),
    entity: ENTITY,
    actor: bea,
    citations: ["IAS-1", "COMPANIES-ACT-71-2008-S24", "D-REPORTING-CAPABILITY-SLICE-2"],
    payload: {
      periodId: "2026-Q1-M01",
      periodKind: "month",
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-01-31T23:59:59.999Z",
      openedAt: clock.asOf(),
      functionalCurrency: "ZAR",
    },
    provenance: SCENARIO_PROVENANCE,
  };
  clock.advance(60_000); // +1 minute

  // T13 — Month-end FX revaluation. Spot 18.5000 → 18.4500 → ZAR 250k loss
  // on the long USD position. Posted as SubLedgerPostingEmitted with
  // `postingType: "revaluation"`. Sub-ledger leg in ZAR (functional ccy):
  // debit revaluation-P&L (loss), credit FX-position-ZAR. Magnitude is the
  // absolute value; the trial-balance fold reads sign from debit/credit.
  const revaluationAmount = Math.abs(REVALUATION_PNL_ZAR_MINOR);
  const revaluationPosting = makeSubLedgerPosting({
    asOf: clock.asOf(),
    actor: rohanModel,
    citations: ["IFRS-9-FVTPL", "IAS-21-§23", "D-REPORTING-CAPABILITY-SLICE-2"],
    tradeId,
    postingType: "revaluation",
    legs: [
      {
        debit: ACC_FX_REVALUATION_STUB,
        credit: ACC_FX_POSITION_STUB,
        currency: "ZAR",
        amountMinor: revaluationAmount,
        memo: `Month-end FX revaluation USD/ZAR 18.5000→${MONTH_END_USDZAR_RATE} on ${tradeId}`,
      },
    ],
    asOfDate: "2026-01-31",
    sourceEventId: opts.trade.event_id,
  });

  const settlementInstructed = [settlementUsd, settlementZar];
  const settlementPostings = [settlementUsdPosting, settlementZarPosting];
  const accountBalanceUpdates = [usdBalancePosting, zarBalancePosting];

  const all: Event[] = [
    tradeDatePosting,
    settlementUsd,
    settlementZar,
    settlementUsdPosting,
    usdBalancePosting,
    settlementZarPosting,
    zarBalancePosting,
    accountingPeriodOpened,
    revaluationPosting,
  ];

  return {
    tradeDatePosting,
    settlementInstructed,
    settlementPostings,
    accountBalanceUpdates,
    accountingPeriodOpened,
    revaluationPosting,
    all,
  };
}

// ---------------------------------------------------------------------------
// Phase-B runner — appends Phase-A + Phase-B pre-close events to a fresh
// event store, then invokes `closePeriod` (the canonical Slice-2
// orchestrator) which emits `TrialBalanceSnapshotted` + `AccountingPeriodClosed`.
// ---------------------------------------------------------------------------

export interface PhaseBResult {
  readonly ok: boolean;
  /** Total events in the store after Phase A + Phase B (both pre-close + close). */
  readonly emitted: number;
  /** Phase B count only — the events appended after Phase A. */
  readonly phaseBEmitted: number;
  readonly countsByType: Record<string, number>;
  /** Trial-balance snapshot hash (BLAKE3) when document store is supplied. */
  readonly trialBalanceDocumentHash?: string;
  /** Trial-balance row count post-close. */
  readonly trialBalanceRowCount: number;
}

export function runPhaseAandB(opts: { dbPath: string; cleanup: boolean }): PhaseBResult {
  const phaseA = buildPhaseAEvents();

  // Wipe and recreate per-run so the script is deterministic on repeat.
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run */
  }

  const store = new EventStore(opts.dbPath);
  store.appendAll([...phaseA.all]);

  // Extract account ids from Phase-A so Phase-B references match.
  // Order in Phase A: [ZAR nostro, USD nostro, ZAR capital].
  const zarAccountEvent = phaseA.accountsOpened[0];
  const usdAccountEvent = phaseA.accountsOpened[1];
  if (!zarAccountEvent || !usdAccountEvent) {
    throw new Error("runPhaseAandB: Phase-A accountsOpened must include ZAR + USD nostros");
  }
  const usdAccountPayload = usdAccountEvent.payload as { accountId: string };
  const zarAccountPayload = zarAccountEvent.payload as { accountId: string };

  // Pre-close Phase-B events — built pure, then appended.
  const phaseBPre = buildPhaseBPreCloseEvents({
    trade: phaseA.trade,
    usdNostroAccountId: usdAccountPayload.accountId,
    zarNostroAccountId: zarAccountPayload.accountId,
  });

  // Open the period through the orchestrator (idempotent; emits
  // AccountingPeriodOpened). The pre-built `accountingPeriodOpened` event
  // is the same payload — we use the orchestrator at runtime so the close
  // matches the open by event_id discipline.
  const openedPayload = phaseBPre.accountingPeriodOpened.payload as Parameters<
    typeof openPeriod
  >[0]["payload"];

  // Append the trade-date posting (T7a) before opening the period: it
  // sits inside the Q1-M01 window by `as_of` so the trial-balance fold
  // includes it.
  store.append(phaseBPre.tradeDatePosting);

  // Append the settlement instructions + true-ups + balance postings
  // (T8–T11) in choreography order: USD instr, ZAR instr, USD ack +
  // balance, ZAR ack + balance.
  for (const e of phaseBPre.settlementInstructed) store.append(e);
  for (let i = 0; i < phaseBPre.settlementPostings.length; i++) {
    const posting = phaseBPre.settlementPostings[i];
    const balance = phaseBPre.accountBalanceUpdates[i];
    if (!posting || !balance) {
      throw new Error("runPhaseAandB: settlement postings + balance updates must pair 1:1");
    }
    store.append(posting);
    store.append(balance);
  }

  // T12 — open the period via the orchestrator.
  const openResult = openPeriod({
    eventStore: store,
    entity: ENTITY,
    actor: { type: "human", id: "bea@bank.local" },
    citations: ["IAS-1", "COMPANIES-ACT-71-2008-S24", "D-REPORTING-CAPABILITY-SLICE-2"],
    payload: openedPayload,
    provenance: SCENARIO_PROVENANCE,
  });

  // T13 — append the revaluation posting *after* the period is open so
  // the trial-balance fold sees it.
  store.append(phaseBPre.revaluationPosting);

  // T14 — close the period. The orchestrator emits
  // TrialBalanceSnapshotted + AccountingPeriodClosed.
  const closeResult = closePeriod({
    eventStore: store,
    entity: ENTITY,
    periodId: "2026-Q1-M01",
    closedAt: "2026-01-31T15:02:00.000Z",
    actor: { type: "human", id: "bea@bank.local" },
    citations: ["IAS-1", "COMPANIES-ACT-71-2008-S24", "D-REPORTING-CAPABILITY-SLICE-2"],
    provenance: SCENARIO_PROVENANCE,
    // documentStore omitted: the EvSS Slice-2 snapshot caches the trial
    // balance regardless. The Phase-D BA-325 generator will read from the
    // RMS document store when wired; for Phase B the snapshot is enough.
  });

  const total = store.count();
  const allEvents: Event[] = [];
  for (const e of store.replay({ entity: ENTITY })) allEvents.push(e);

  // Provenance recon (assertion #6 from pack §2.6) — every event carries
  // the scenario tag (this includes the orchestrator-emitted close events,
  // which inherit our supplied provenance arg).
  let provenanceOk = true;
  for (const e of allEvents) {
    if (
      e.provenance?.kind !== "simulated" ||
      e.provenance.scenario !== SCENARIO_ID ||
      e.provenance.sourceLineage !== SOURCE_LINEAGE
    ) {
      provenanceOk = false;
      break;
    }
  }

  // The orchestrator may have emitted a no-op open (appended === false) if
  // the period was already open from prior. In Phase-B we always open fresh
  // so appended should be true.
  const openAppendedOk = openResult.appended;

  // Phase-B count = total - Phase-A count.
  const phaseBEmitted = total - phaseA.all.length;

  // Counts by type across the full store (Phase A + B).
  const countsByType: Record<string, number> = {};
  for (const e of allEvents) countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;

  store.close();
  if (opts.cleanup) {
    try {
      unlinkSync(opts.dbPath);
    } catch {
      /* nothing to clean */
    }
  }

  return {
    ok: provenanceOk && openAppendedOk && total > phaseA.all.length,
    emitted: total,
    phaseBEmitted,
    countsByType,
    ...(closeResult.documentHash !== undefined
      ? { trialBalanceDocumentHash: closeResult.documentHash }
      : {}),
    trialBalanceRowCount: closeResult.trialBalance.rows.length,
  };
}

// ===========================================================================
// PHASE D — BA returns at period close
// ===========================================================================
//
// Per pack §5 Phase D + dispatch (Bea+Tomas, 2026-05-10). Phase D extends
// the post-close state from Phase B with four SARB BA returns, each:
//
//   - generated against the post-close trial balance (Phase B output);
//   - rendered as canonical (deterministic) JSON (XML for BA 350 / BA 600
//     via Reporting Slice 5's xml-render adapter);
//   - tagged with the Phase-D source lineage
//     `scenario:03-fx-end-to-end-rehearsal:phase-d` (overrides the
//     scenario-runner default for Phase-D-emitted RecordFiled events);
//   - written to `.local/dry-run-outputs/<periodId>/<form>.json` (gitignored
//     runtime path — never committed);
//   - stored in a per-run BLAKE3 document store (RMS Slice 1);
//   - linked to the scenario via a typed `RecordFiled` event whose
//     `documentHash` matches the rendered bytes' BLAKE3 hash.
//
// The Phase-D logic lives in `_phase-d-helpers.ts` to keep this file
// readable; here we wire the closed period from Phase B into the Phase-D
// generators and emit the writes.
//
// Substrate gaps surfaced in the decision record:
//   1. **Real classifications** — BA 325 / BA 350 / BA 600 generators take
//      caller-supplied classification + position inputs. Until Mira's
//      WS-INSTRUMENT-ANALYSES + Reporting Slice 6 expand the semantic-layer
//      registry, Phase D uses rehearsal-grade fixtures derived from Phase
//      A+B's footprint.
//   2. **Real RWA inputs** — W2 Slice 3 RWA engine (PR #177) is merged but
//      takes its own typed inputs; Phase D passes a fixture
//      `RwaDecomposition` for now.
//   3. **No `ReportGenerated` event family yet** — Phase D uses RMS
//      Slice 1's `RecordFiled` event as the equivalent content-addressed
//      link. When `ReportGenerated` lands, the helpers swap to it
//      (mechanical; document-store hash is the same).
// ---------------------------------------------------------------------------

import {
  PHASE_D_FORMS,
  PHASE_D_SOURCE_LINEAGE,
  type PhaseDForm,
  type PhaseDInputs,
  type PhaseDWriteResult,
  makePhaseDDocumentStore,
  runPhaseD,
} from "./_phase-d-helpers";

/**
 * Phase-D-specific provenance tag — the scenario base tag carries
 * `sourceLineage: "scenario-runner:03-fx-end-to-end-rehearsal"`; Phase D's
 * outputs are produced *by Phase D code*, not the scenario runner, so the
 * lineage is overridden to make the originating step explicit.
 */
export const PHASE_D_PROVENANCE = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: PHASE_D_SOURCE_LINEAGE,
});

export interface PhaseDResult {
  readonly ok: boolean;
  /** Total events in the store after Phase A + B + D (includes RecordFiled events). */
  readonly emitted: number;
  /** Phase-D event count — one RecordFiled per BA form. */
  readonly phaseDEmitted: number;
  /** One write-result per form, in `PHASE_D_FORMS` order. */
  readonly writeResults: readonly PhaseDWriteResult[];
  /** Counts-by-type across the full store post-Phase-D. */
  readonly countsByType: Record<string, number>;
  /** Per-form key sample metrics — surfaced in the runner log + decision record. */
  readonly summary: PhaseDSummary;
}

export interface PhaseDSummary {
  readonly ba325: { readonly lcrPercent: string; readonly compliant: boolean };
  readonly ba700: {
    readonly cet1Ratio: string;
    readonly tier1Ratio: string;
    readonly totalRatio: string;
    readonly compliant: boolean;
  };
  readonly ba350: { readonly capitalMinor: number; readonly rwaMinor: number };
  readonly ba600: { readonly capitalMinor: number; readonly rwaMinor: number };
}

export function runPhaseAandBandD(opts: {
  readonly dbPath: string;
  readonly outputDir: string;
  readonly docStoreRoot: string;
  readonly cleanup: boolean;
}): PhaseDResult {
  // 1) Run Phase A + B against a fresh store (without cleanup so we can
  //    keep the store and append Phase-D RecordFiled events).
  const phaseA = buildPhaseAEvents();
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run */
  }
  const store = new EventStore(opts.dbPath);
  store.appendAll([...phaseA.all]);

  const zarAccountEvent = phaseA.accountsOpened[0];
  const usdAccountEvent = phaseA.accountsOpened[1];
  if (!zarAccountEvent || !usdAccountEvent) {
    throw new Error("runPhaseAandBandD: Phase-A accountsOpened must include ZAR + USD nostros");
  }
  const usdAccountPayload = usdAccountEvent.payload as { accountId: string };
  const zarAccountPayload = zarAccountEvent.payload as { accountId: string };

  const phaseBPre = buildPhaseBPreCloseEvents({
    trade: phaseA.trade,
    usdNostroAccountId: usdAccountPayload.accountId,
    zarNostroAccountId: zarAccountPayload.accountId,
  });

  const openedPayload = phaseBPre.accountingPeriodOpened.payload as Parameters<
    typeof openPeriod
  >[0]["payload"];

  store.append(phaseBPre.tradeDatePosting);
  for (const e of phaseBPre.settlementInstructed) store.append(e);
  for (let i = 0; i < phaseBPre.settlementPostings.length; i++) {
    const posting = phaseBPre.settlementPostings[i];
    const balance = phaseBPre.accountBalanceUpdates[i];
    if (!posting || !balance) {
      throw new Error("runPhaseAandBandD: settlement postings + balance updates must pair 1:1");
    }
    store.append(posting);
    store.append(balance);
  }

  openPeriod({
    eventStore: store,
    entity: ENTITY,
    actor: { type: "human", id: "bea@bank.local" },
    citations: ["IAS-1", "COMPANIES-ACT-71-2008-S24", "D-REPORTING-CAPABILITY-SLICE-2"],
    payload: openedPayload,
    provenance: SCENARIO_PROVENANCE,
  });

  store.append(phaseBPre.revaluationPosting);

  const closeResult = closePeriod({
    eventStore: store,
    entity: ENTITY,
    periodId: "2026-Q1-M01",
    closedAt: "2026-01-31T15:02:00.000Z",
    actor: { type: "human", id: "bea@bank.local" },
    citations: ["IAS-1", "COMPANIES-ACT-71-2008-S24", "D-REPORTING-CAPABILITY-SLICE-2"],
    provenance: SCENARIO_PROVENANCE,
  });

  // 2) Phase D — generate + render + write the four BA returns.
  const periodId = openedPayload.periodId;
  const docStore = makePhaseDDocumentStore(opts.docStoreRoot);

  // Phase-D BA generators (BA 325 / 350 / 600 / 700) bank-licence-gate on
  // the canonical SARB legal-entity short-id `LE-ZA-HOZ-BANK`. The event
  // store uses the brand-typed alias `LE-ZA-HOZ-BANK` (per `BANK_ZA_001` in
  // `@platform/core/types`). Phase D emits its `RecordFiled` events under
  // the event-store entity (LE-ZA-HOZ-BANK) and feeds the canonical entity
  // short-id to the BA generators. The two are the same legal entity per
  // `Regulations/_legal-entity-tree.md`; alignment lands when the legal-
  // entity-tree register publishes the canonical short-id (substrate gap).
  const PHASE_D_GENERATOR_ENTITY = "LE-ZA-HOZ-BANK";
  const phaseDInputs: PhaseDInputs = {
    entity: PHASE_D_GENERATOR_ENTITY,
    asOf: closeResult.accountingPeriodClosedEvent.as_of,
    periodId,
    functionalCurrency: openedPayload.functionalCurrency,
    trialBalance: closeResult.trialBalance.rows,
    trialBalanceSnapshotEventId: closeResult.trialBalanceSnapshotEvent.event_id,
    // P1-compliant (C-1/C-2/C-3): event store + period window so BA 325 folds
    // FxSettlement events, BA 350 folds FxTradeExecuted, BA 700 folds
    // SubLedgerPostingEmitted + CapitalContributionRecorded events directly.
    // Authority: Principles/1-events-are-truth.md.
    eventStore: store,
    periodStart: openedPayload.periodStart,
    periodEnd: openedPayload.periodEnd,
  };

  const phaseDOut = runPhaseD({
    inputs: phaseDInputs,
    options: {
      entity: ENTITY,
      periodId,
      outputDir: opts.outputDir,
      documentStore: docStore,
      eventStore: store,
      provenance: PHASE_D_PROVENANCE,
      actor: { type: "human", id: "bea@bank.local" },
      asOf: "2026-01-31T15:05:00.000Z",
      citations: [
        "D-FIRST-DRY-RUN-SCENARIO",
        "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
        "D-RMS-PHASE-1",
        "COMPANIES-ACT-71-2008-S24",
      ],
    },
  });

  // 3) Tally + provenance recon (Phase-D events carry the Phase-D lineage;
  //    Phase A+B events carry the scenario-runner lineage; both are valid
  //    `simulated` provenance under the same scenario id).
  const allEvents: Event[] = [];
  for (const e of store.replay({ entity: ENTITY })) allEvents.push(e);

  let provenanceOk = true;
  for (const e of allEvents) {
    if (e.provenance?.kind !== "simulated" || e.provenance.scenario !== SCENARIO_ID) {
      provenanceOk = false;
      break;
    }
  }

  const total = store.count();
  const phaseBaseCount = phaseA.all.length + phaseBPre.all.length + 2; // +2 for TB + Closed
  const phaseDEmitted = total - phaseBaseCount;

  const countsByType: Record<string, number> = {};
  for (const e of allEvents) countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;

  // 4) Sample metrics — read from the typed generator outputs (not the
  //    rendered bytes) so the runner / decision-record / test all see the
  //    same numbers without re-parsing.
  const summary: PhaseDSummary = {
    ba325: {
      lcrPercent: Number.isFinite(phaseDOut.generated.ba325.lcrRatio)
        ? `${(phaseDOut.generated.ba325.lcrRatio * 100).toFixed(2)}%`
        : "infinity",
      compliant: phaseDOut.generated.ba325.lcrCompliant,
    },
    ba700: {
      cet1Ratio: `${(phaseDOut.generated.ba700.ratios.cet1Ratio * 100).toFixed(2)}%`,
      tier1Ratio: `${(phaseDOut.generated.ba700.ratios.tier1Ratio * 100).toFixed(2)}%`,
      totalRatio: `${(phaseDOut.generated.ba700.ratios.totalRatio * 100).toFixed(2)}%`,
      compliant:
        phaseDOut.generated.ba700.ratios.cet1Compliant &&
        phaseDOut.generated.ba700.ratios.tier1Compliant &&
        phaseDOut.generated.ba700.ratios.totalCompliant,
    },
    ba350: {
      capitalMinor: phaseDOut.generated.ba350.totalMarketRiskCapitalMinor,
      rwaMinor: phaseDOut.generated.ba350.totalMarketRiskRwaMinor,
    },
    ba600: {
      capitalMinor: phaseDOut.generated.ba600.opRiskCapitalMinor,
      rwaMinor: phaseDOut.generated.ba600.opRiskRwaMinor,
    },
  };

  store.close();
  if (opts.cleanup) {
    try {
      unlinkSync(opts.dbPath);
    } catch {
      /* nothing to clean */
    }
  }

  return {
    ok: provenanceOk && phaseDEmitted === PHASE_D_FORMS.length,
    emitted: total,
    phaseDEmitted,
    writeResults: phaseDOut.writeResults,
    countsByType,
    summary,
  };
}

export { PHASE_D_FORMS, PHASE_D_SOURCE_LINEAGE };
export type { PhaseDForm, PhaseDInputs, PhaseDWriteResult };

// Top-level invocation — `bun run scenarios/03-fx-end-to-end-rehearsal.ts`.
// Bun executes the file body; we gate on import.meta.main so the test can
// import the module without firing the runner. Default invocation now runs
// Phase A + Phase B + Phase D end-to-end (per dispatch §3 deliverable 3).
//
// BANK_SCENARIO_SHARED=1 opt-in (D-PROVENANCE-FILTER-ENFORCEMENT):
// When this env var is set, the scenario runner switches the default
// provenance mode to "combined" so the BA generators (BA 700, BA 350,
// BA 325) can fold the scenario's simulated events. Without this flag
// the default is production-only and generators return zero capital.
// This flag is for scenario dry-run invocations only — CI tests set
// the override via beforeEach() and do not need this flag.
if (import.meta.main) {
  if (process.env.BANK_SCENARIO_SHARED === "1") {
    const { setDefaultProvenanceModeOverride } = await import("../platform/projections");
    setDefaultProvenanceModeOverride("combined");
    logger.info(
      { BANK_SCENARIO_SHARED: "1", provenanceMode: "combined" },
      "scenario 03 — BANK_SCENARIO_SHARED=1 → provenance mode set to combined",
    );
  }

  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      phase: "A+B+D",
    },
    "scenario 03 — FX end-to-end rehearsal — Phase A + Phase B + Phase D starting",
  );

  const result = runPhaseAandBandD({
    dbPath: ".local/scenario-03-phase-abd.db",
    outputDir: ".local/dry-run-outputs/2026-Q1-M01",
    docStoreRoot: ".local/dry-run-outputs/2026-Q1-M01/_doc-store",
    cleanup: true,
  });

  logger.info(
    {
      emitted: result.emitted,
      phaseDEmitted: result.phaseDEmitted,
      countsByType: result.countsByType,
      summary: result.summary,
      writes: result.writeResults.map((w) => ({
        form: w.form,
        path: w.outputPath,
        documentHash: w.documentHash,
      })),
      provenance: {
        kind: SCENARIO_PROVENANCE.kind,
        scenario: SCENARIO_PROVENANCE.scenario,
        sourceLineage: SCENARIO_PROVENANCE.sourceLineage,
      },
      ok: result.ok,
    },
    result.ok ? "Phase A + B + D passed" : "Phase A + B + D failed",
  );

  process.exit(result.ok ? 0 : 1);
}
