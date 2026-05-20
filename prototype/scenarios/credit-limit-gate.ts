// scenarios/credit-limit-gate.ts
//
// Wire-test for `checkHeadroom` calling pattern from the pre-trade conduct
// gate. Each case drives the live `kai:credit-capital-funding-check` handler
// against a counterparty whose credit-limit lifecycle is seeded via the
// canonical CreditLimit* event family, then asserts the typed `blockReason`
// surfaced on `GatewayCheckCompleted`.
//
// Four cases (per PROC-MK-PCG-01 Check 1(c)):
//
//   1. CounterpartyNotApproved   — no CreditLimitLoaded event for the CP
//   2. CreditLimitExhausted      — loaded limit, but pro-forma exposure > limit
//   3. (admit)                   — same CP after the exposure shrinks below limit
//   4. AnnualReviewStale         — loaded limit, but approved > 13 months ago
//                                   and no annual-review event since.
//
// Authority:
//   - D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 (CEO-approved 2026-05-20).
//   - PROC-MK-PCG-01 Check 1(c) — pre-trade conduct gate credit-limit check.
//   - Credit Risk Policy §1.3 (annual review obligation) + §1.4 (traffic).
//   - Banks Act 94/1990 Reg 23 (annual review obligation).
//   - RAS-B3 (counterparty credit risk appetite).
//
// Author: Saskia (Derivatives trading desk, engineering).

import { unlinkSync } from "node:fs";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  makeCcrReplacementCostComputed,
  makeCreditLimitApplicationSubmitted,
  makeCreditLimitApproved,
  makeCreditLimitLoaded,
  makeGatewayCheckRequested,
  makeOrderProposed,
} from "../platform/event-store/event-types";
import type { Event } from "../platform/event-store/types";
import kaiCreditCapitalFundingCheck from "../runtime/agents/kai-credit-capital-funding-check";
import type { AgentRunContext } from "../runtime/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "credit-limit-gate";
export const ENTITY = BANK_ZA_001;

const TEST_ACTOR = { type: "service" as const, id: "test:credit-limit-gate" };
const AGGREGATOR_ACTOR = { type: "service" as const, id: "agent:kai:pre-trade-gateway-aggregator" };

const CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD", "RAS-B3", "ORG-PR-01"];
const FANOUT_CITATIONS = [
  "ORG-CD-01",
  "ORG-FC-08",
  "ORG-FC-13",
  "JSE-RULES-EQUITIES",
  "FMA-S5",
  "GOV-FRAMEWORK-CEO-RESERVED",
];
const ORDER_CITATIONS = ["JSE-RULES-EQUITIES", "FMA-S5"];

// Test counterparties (must be ^[A-Z0-9]{20}$ per ISO 17442 LEI).
const CP_UNAPPROVED = "LEICPUNAPPROVED12345";
const CP_LOADED = "LEICPLOADED012345678";
const CP_STALE_REVIEW = "LEICPSTALEREVIEW0000";

// Scenario clock — ts0 seeds limits, ts1 fires intents.
const TS0 = "2026-05-20T08:00:00.000Z";
const TS1 = "2026-05-20T08:00:30.000Z";
const TS2 = "2026-05-20T08:00:31.000Z";

// Counterparty CP_STALE_REVIEW was approved 14 months ago — stale.
const TS_STALE_APPROVAL = "2025-03-15T08:00:00.000Z";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedLoadedLimit(args: {
  counterpartyId: string;
  limitMinor: number;
  approvedAt?: string;
  expiryDate?: string;
}): void {
  const applicationId = `CL-APP-${SCENARIO_ID}-${args.counterpartyId}`;
  const approvedAt = args.approvedAt ?? TS0;
  eventStore.append(
    makeCreditLimitApplicationSubmitted({
      asOf: approvedAt,
      entity: ENTITY,
      actor: TEST_ACTOR,
      citations: CITATIONS,
      payload: {
        applicationId,
        counterpartyId: args.counterpartyId,
        requestedLimit: args.limitMinor,
        currency: "ZAR",
        tenor: "364D",
        productTypes: ["fx-spot"],
        tradingDesk: "FX-Sales",
        commercialRationale: `Scenario ${SCENARIO_ID} — seeded counterparty.`,
        submittedBy: TEST_ACTOR.id,
        submittedAt: approvedAt,
      },
    }),
  );
  eventStore.append(
    makeCreditLimitApproved({
      asOf: approvedAt,
      entity: ENTITY,
      actor: TEST_ACTOR,
      citations: CITATIONS,
      payload: {
        applicationId,
        counterpartyId: args.counterpartyId,
        limit: args.limitMinor,
        currency: "ZAR",
        tenor: "364D",
        approvedBy: "test:helena",
        approvalAuthority: "CRC",
        approvedAt,
        conditions: [],
        expiryDate: args.expiryDate ?? "2099-12-31",
      },
    }),
  );
  eventStore.append(
    makeCreditLimitLoaded({
      asOf: approvedAt,
      entity: ENTITY,
      actor: TEST_ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: args.counterpartyId,
        limit: args.limitMinor,
        currency: "ZAR",
        loadedAt: approvedAt,
        effectiveFrom: approvedAt,
        loadedBy: TEST_ACTOR.id,
      },
    }),
  );
}

function seedExistingExposure(args: {
  counterpartyId: string;
  rcMinor: number;
  asOf?: string;
}): void {
  eventStore.append(
    makeCcrReplacementCostComputed({
      asOf: args.asOf ?? TS0,
      entity: ENTITY,
      actor: TEST_ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: args.counterpartyId,
        nettingSetId: `NS-${args.counterpartyId}-ZAR`,
        rc: args.rcMinor,
        currency: "ZAR",
        computationDate: (args.asOf ?? TS0).slice(0, 10),
        methodology: "sa-ccr",
        vMtm: args.rcMinor,
        collateralHeld: 0,
      },
    }),
  );
}

function makeIntent(args: {
  orderId: string;
  counterpartyLei: string;
  notionalMinor: number; // ZAR minor units
}): { order: Event; checkReq: Event } {
  // Encode notionalMinor as a price * quantity that the handler can recover.
  // Quantity 1 unit, price = notionalMinor / 100 (ZAR major), priceCurrency ZAR.
  const order = makeOrderProposed({
    asOf: TS1,
    entity: ENTITY,
    actor: { type: "service" as const, id: "agent:saskia:auto-quote" },
    citations: ORDER_CITATIONS,
    payload: {
      orderId: args.orderId,
      counterpartyLei: args.counterpartyLei,
      instrument: "JSE:NPN",
      side: "buy",
      quantity: 1,
      price: args.notionalMinor / 100,
      priceCurrency: "ZAR",
      bookingEntity: ENTITY,
      requestedActor: "agent:saskia:auto-quote",
    },
  });
  eventStore.append(order);

  const checkReq = makeGatewayCheckRequested({
    asOf: TS1,
    entity: ENTITY,
    actor: AGGREGATOR_ACTOR,
    citations: FANOUT_CITATIONS,
    payload: {
      orderId: args.orderId,
      checkKind: "credit-limit",
      sourceOrderEventId: order.event_id,
      requestedAt: TS1,
    },
  });
  eventStore.append(checkReq);

  return { order, checkReq };
}

function makeKaiCtx(triggering: readonly Event[], repoRoot: string): AgentRunContext {
  return {
    agent: "Kai",
    trigger: {
      kind: "event-driven",
      id: "credit-capital-funding-check",
      triggeringEvents: triggering,
    },
    asOf: TS2,
    repoRoot,
    ownerInboxDir: join(repoRoot, "Owner Inbox"),
    dryRun: false,
  };
}

function findCompletion(orderId: string): {
  outcome: string;
  blockReason: string | undefined;
} | null {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as {
      orderId?: unknown;
      checkKind?: unknown;
      outcome?: unknown;
      blockReason?: unknown;
    };
    if (p.orderId === orderId && p.checkKind === "credit-limit") {
      return {
        outcome: typeof p.outcome === "string" ? p.outcome : "",
        blockReason: typeof p.blockReason === "string" ? p.blockReason : undefined,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

export interface CreditLimitGateScenarioResult {
  readonly ok: boolean;
  readonly caseNotApproved: { outcome: string; blockReason: string | undefined };
  readonly caseExhausted: { outcome: string; blockReason: string | undefined };
  readonly caseAdmitted: { outcome: string; blockReason: string | undefined };
  readonly caseStaleReview: { outcome: string; blockReason: string | undefined };
}

export async function runCreditLimitGateScenario(opts: {
  dbPath: string;
  cleanup: boolean;
  repoRoot: string;
}): Promise<CreditLimitGateScenarioResult> {
  try {
    unlinkSync(opts.dbPath);
  } catch {
    /* first run */
  }

  // The scenario reuses the process-singleton event store; tests should also
  // be runnable in isolation. The kai handler reads from `eventStore`, not
  // a custom store, so we drive the singleton directly.
  //
  // To avoid cross-test pollution at the singleton level when the runner is
  // executed via `bun run`, we make every event id, counterparty, and order
  // id unique to this scenario.

  // Case 1 — CounterpartyNotApproved.
  // No CreditLimitLoaded event for CP_UNAPPROVED.
  const intent1 = makeIntent({
    orderId: `${SCENARIO_ID}-not-approved-${newEventId()}`,
    counterpartyLei: CP_UNAPPROVED,
    notionalMinor: 1_000_000_00, // ZAR 1m
  });
  await kaiCreditCapitalFundingCheck(makeKaiCtx([intent1.checkReq], opts.repoRoot));
  const caseNotApproved = findCompletion(intent1.order.payload.orderId as string) ?? {
    outcome: "missing",
    blockReason: undefined,
  };

  // Case 2 — CreditLimitExhausted.
  // CP_LOADED has 100m limit; seed existing RC exposure of 80m; new intent 30m
  // pushes pro-forma to 110m > 100m.
  seedLoadedLimit({ counterpartyId: CP_LOADED, limitMinor: 100_000_000_00 });
  seedExistingExposure({ counterpartyId: CP_LOADED, rcMinor: 80_000_000_00 });
  const intent2 = makeIntent({
    orderId: `${SCENARIO_ID}-exhausted-${newEventId()}`,
    counterpartyLei: CP_LOADED,
    notionalMinor: 30_000_000_00, // ZAR 30m
  });
  await kaiCreditCapitalFundingCheck(makeKaiCtx([intent2.checkReq], opts.repoRoot));
  const caseExhausted = findCompletion(intent2.order.payload.orderId as string) ?? {
    outcome: "missing",
    blockReason: undefined,
  };

  // Case 3 — admitted (same CP, smaller intent).
  // 80m existing exposure + 10m new = 90m < 100m limit.
  const intent3 = makeIntent({
    orderId: `${SCENARIO_ID}-admit-${newEventId()}`,
    counterpartyLei: CP_LOADED,
    notionalMinor: 10_000_000_00, // ZAR 10m
  });
  await kaiCreditCapitalFundingCheck(makeKaiCtx([intent3.checkReq], opts.repoRoot));
  const caseAdmitted = findCompletion(intent3.order.payload.orderId as string) ?? {
    outcome: "missing",
    blockReason: undefined,
  };

  // Case 4 — AnnualReviewStale.
  // CP_STALE_REVIEW is loaded but approved 14 months ago → engine flips
  // status to AnnualReviewStale (Credit Risk Policy §1.3, Banks Act Reg 23).
  seedLoadedLimit({
    counterpartyId: CP_STALE_REVIEW,
    limitMinor: 50_000_000_00,
    approvedAt: TS_STALE_APPROVAL,
  });
  const intent4 = makeIntent({
    orderId: `${SCENARIO_ID}-stale-${newEventId()}`,
    counterpartyLei: CP_STALE_REVIEW,
    notionalMinor: 1_000_000_00, // ZAR 1m, trivially under limit
  });
  await kaiCreditCapitalFundingCheck(makeKaiCtx([intent4.checkReq], opts.repoRoot));
  const caseStaleReview = findCompletion(intent4.order.payload.orderId as string) ?? {
    outcome: "missing",
    blockReason: undefined,
  };

  const ok =
    caseNotApproved.outcome === "reject" &&
    caseNotApproved.blockReason === "CounterpartyNotApproved" &&
    caseExhausted.outcome === "reject" &&
    caseExhausted.blockReason === "CreditLimitExhausted" &&
    caseAdmitted.outcome === "approve" &&
    caseStaleReview.outcome === "reject" &&
    caseStaleReview.blockReason === "AnnualReviewStale";

  if (opts.cleanup) {
    try {
      unlinkSync(opts.dbPath);
    } catch {
      /* nothing to clean */
    }
  }

  return {
    ok,
    caseNotApproved,
    caseExhausted,
    caseAdmitted,
    caseStaleReview,
  };
}

// ---------------------------------------------------------------------------
// Standalone runner.
//
// Intentionally omitted: this scenario seeds counterparties with stale annual
// reviews; the singleton event store at `.local/event.db` is shared with
// recon pipelines (`recon:credit-limit-annual-review-staleness`), so a
// standalone `bun run scenarios/credit-limit-gate.ts` invocation would
// pollute that store and produce false-positive findings. Drive the
// scenario through the bun:test path (`bun test scenarios/credit-limit-gate.test.ts`),
// which is preloaded with `tests/_setup.ts` to route every test into an
// ephemeral temp DB.
// ---------------------------------------------------------------------------
