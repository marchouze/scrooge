// scenarios/03-fx-end-to-end-rehearsal.ts
//
// Phase A — first dry-run scenario wedge per
// `Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`
// §2.1 (T0–T7) and §6 dispatch #A4. Standing authority:
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
//     capital / sub-ledger leg)
//
// Run: `bun run scenario:dry-run-fx`

import { unlinkSync } from "node:fs";

import { EventStore } from "@platform/event-store/store";
import { logger } from "@platform/observability/logger";
import {
  type ProvenanceTag,
  simulatedTag,
} from "@platform/event-store/provenance";
import { type Actor, BANK_ZA_001, newEventId } from "@platform/core/types";
import type { Event } from "@platform/event-store/types";
import { makeFxTradeExecuted } from "@platform/markets/cdm/fx";
import {
  counterpartyId,
  kycCompleted,
  mandateAssigned,
  prospectRegistered,
  soundingOpened,
} from "@domains/customer";

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
      this.current.getTime() +
        minutes * 60_000 +
        hours * 60 * 60_000 +
        days * 24 * 60 * 60_000,
    );
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
  return {
    event_id: newEventId(),
    type: "RfqRequested",
    as_of: args.asOf,
    entity: ENTITY,
    actor: args.actor,
    citations: ["D-MARKETS-SCHEMA-FOUNDATION", "INTERNAL-NPA-FX-SPOT"],
    payload: {
      rfqId: args.rfqId,
      counterpartyId: String(COUNTERPARTY_ID),
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "buy",
      notional: { currency: "USD", amountMinor: 5_000_000_00 }, // USD 5m in cents
      valueDate: "2026-01-07", // T+2 from 2026-01-05
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
          reviewerId: "mira@bank.local",
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
    citations: [
      "ORG-BANKS-ACT-94-1990",
      "INTERNAL-FINANCE-CHART-OF-ACCOUNTS",
    ],
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
    citations: [
      "ORG-BANKS-ACT-94-1990",
      "INTERNAL-FINANCE-CHART-OF-ACCOUNTS",
    ],
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
    citations: [
      "ORG-BANKS-ACT-94-1990",
      "INTERNAL-FINANCE-CAPITAL-PLAN-V1",
    ],
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

// Top-level invocation — `bun run scenarios/03-fx-end-to-end-rehearsal.ts`.
// Bun executes the file body; we gate on import.meta.main so the test can
// import the module without firing the runner.
if (import.meta.main) {
  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      phase: "A",
    },
    "scenario 03 — Phase A FX end-to-end rehearsal — starting",
  );

  const result = runPhaseA({
    dbPath: ".local/scenario-03-phase-a.db",
    cleanup: true,
  });

  logger.info(
    {
      emitted: result.emitted,
      countsByType: result.countsByType,
      provenance: {
        kind: SCENARIO_PROVENANCE.kind,
        scenario: SCENARIO_PROVENANCE.scenario,
        sourceLineage: SCENARIO_PROVENANCE.sourceLineage,
      },
      ok: result.ok,
    },
    result.ok ? "Phase A passed" : "Phase A failed",
  );

  process.exit(result.ok ? 0 : 1);
}
