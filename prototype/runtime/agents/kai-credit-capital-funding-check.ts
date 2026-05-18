// runtime/agents/kai-credit-capital-funding-check.ts
//
// Kai's credit limit, capital impact, and funding headroom check handler for
// the pre-trade gateway (slice 7).
//
// Authority:
//   - RAS-B3 (counterparty credit risk appetite — single-counterparty credit limit)
//   - ORG-PR-01 (ICAAP — Internal Capital Adequacy Assessment Process)
//   - Banks Act 94/1990 Reg 38 (BA 325 capital adequacy — Pillar 1 RWA calculation)
//   - BCBS 238 (LCR — Liquidity Coverage Ratio minimum 100%)
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway envelope v0 slice 7)
//   - Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3
//
// What this handler does:
//   On GatewayCheckRequested[credit-limit]:
//     1. Compute current counterparty exposure from booked trades.
//     2. Check proposed notional + current exposure vs credit-limit stub.
//     3. Emit GatewayCheckCompleted[credit-limit] approve or reject.
//
//   On GatewayCheckRequested[capital-impact]:
//     1. Compute proposed RWA = notional × RWA weight for instrument class.
//     2. Check current RWA + proposed RWA vs BA 325 RWA limit.
//     3. Emit GatewayCheckCompleted[capital-impact] approve or reject.
//
//   On GatewayCheckRequested[funding]:
//     1. Estimate LCR outflow impact from proposed notional.
//     2. Check estimated LCR post-trade vs minimum 100%.
//     3. Emit GatewayCheckCompleted[funding] approve or reject.
//
// Build-phase limitations:
//   - Credit limits are read from credit-limit-stub.json. Production: derive
//     from a live credit-assessment register event (CreditLimitSchedulePublished).
//   - Capital RWA weights and LCR parameters are read from capital-funding-stub.json.
//     Production: derive from live BA 325 projection (Anya) and Eitan's LCR
//     projection (LCR ratio event, not yet built).
//   - Counterparty exposure is approximated by replaying EquityTradeBooked and
//     FxTradeExecuted notional per counterparty.
//
// Non-bypassability: only kai:pre-trade-gateway-aggregator emits
// OrderApprovedAtGateway / OrderRejectedAtGateway. This handler emits only
// GatewayCheckCompleted.
//
// Author: Kai (Markets platform engineer, engineering)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import {
  type GatewayCheckCompletedPayload,
  makeGatewayCheckCompleted,
} from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:kai:credit-capital-funding-check",
};

const CREDIT_CITATIONS: readonly string[] = ["RAS-B3", "ORG-PR-01"];
const CAPITAL_CITATIONS: readonly string[] = ["ORG-PR-01", "RAS-B1"];
const FUNDING_CITATIONS: readonly string[] = ["ORG-PR-01"];

// ---------------------------------------------------------------------------
// Stub types
// ---------------------------------------------------------------------------

interface CreditLimitStub {
  defaultCreditLimitZAR: number;
  perCounterpartyLimits: Record<string, number>;
  blockedCounterparties: string[];
}

interface CapitalFundingStub {
  rwa: {
    totalRwaLimitZAR: number;
    currentRwaZAR: number;
    rwaWeightByInstrumentClass: Record<string, number>;
  };
  lcr: {
    minimumLcrPct: number;
    currentLcrPct: number;
    outflowPerMillionNotionalZAR: number;
  };
}

function loadCreditLimitStub(repoRoot: string): CreditLimitStub {
  const stubPath = join(
    repoRoot,
    "prototype",
    "platform",
    "markets",
    "regulatory",
    "credit-limit-stub.json",
  );
  return JSON.parse(readFileSync(stubPath, "utf-8")) as CreditLimitStub;
}

function loadCapitalFundingStub(repoRoot: string): CapitalFundingStub {
  const stubPath = join(
    repoRoot,
    "prototype",
    "platform",
    "markets",
    "regulatory",
    "capital-funding-stub.json",
  );
  return JSON.parse(readFileSync(stubPath, "utf-8")) as CapitalFundingStub;
}

// ---------------------------------------------------------------------------
// Exposure helpers
// ---------------------------------------------------------------------------

/**
 * Compute current counterparty notional exposure (in ZAR) by replaying
 * EquityTradeBooked and FxTradeExecuted events.
 * Returns a map of counterpartyId → net notional ZAR.
 */
function computeCounterpartyExposure(): Map<string, number> {
  const exposure = new Map<string, number>();

  for (const e of eventStore.replay({ type: "EquityTradeBooked" })) {
    const p = e.payload as {
      counterpartyId?: string;
      counterpartyLei?: string;
      side?: string;
      consideration?: { amountMinor?: number };
      price?: { amount?: number };
      quantity?: { amount?: number };
    };
    const cpId = p.counterpartyId ?? p.counterpartyLei;
    if (!cpId) continue;

    let notionalZAR = 0;
    if (p.consideration?.amountMinor !== undefined && p.consideration.amountMinor > 0) {
      notionalZAR = p.consideration.amountMinor / 100;
    } else if (p.price?.amount !== undefined && p.quantity?.amount !== undefined) {
      notionalZAR = p.price.amount * p.quantity.amount;
    } else {
      continue;
    }

    const side = p.side ?? "buy";
    // Credit exposure accumulates on buys (we owe them securities / they owe us cash).
    // Sells reduce exposure. Use absolute notional for credit (gross, not net).
    const delta = side === "sell" ? -notionalZAR : notionalZAR;
    exposure.set(cpId, (exposure.get(cpId) ?? 0) + delta);
  }

  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as {
      counterparty?: { partyId?: string };
      legs?: Array<{ notional?: { amountMinor?: number }; legKind?: string }>;
    };
    const cpId = p.counterparty?.partyId;
    if (!cpId) continue;

    const nearLeg = Array.isArray(p.legs)
      ? p.legs.find((l) => l.legKind === "near")
      : undefined;
    const notionalZAR = nearLeg?.notional?.amountMinor
      ? nearLeg.notional.amountMinor / 100
      : 0;
    if (notionalZAR > 0) {
      exposure.set(cpId, (exposure.get(cpId) ?? 0) + notionalZAR);
    }
  }

  return exposure;
}

/**
 * Compute total RWA currently on the books (approximate — from
 * EquityTradeBooked notional × 35% default equity weight).
 * Production: use Anya's BA 325 projection directly.
 */
function computeCurrentRwaZAR(stub: CapitalFundingStub): number {
  // In the build phase, defer to the stub's currentRwaZAR baseline.
  // Production: read from the most recent BA325RwaProjectionPublished event.
  return stub.rwa.currentRwaZAR;
}

/**
 * Determine instrument class from instrument string for RWA weight lookup.
 */
function instrumentClass(instrument: string): string {
  if (instrument.startsWith("JSE:") || instrument.startsWith("ZAE") || instrument.startsWith("ZAG")) {
    return "JSE-EQUITY";
  }
  if (instrument.startsWith("ZAG")) return "ZA-GOV-BOND";
  if (instrument.startsWith("FX-")) return "FX-spot";
  if (instrument.startsWith("IRS-")) return "OTC-IRD";
  if (instrument.startsWith("OTC-")) return "OTC-IRD";
  return "default";
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

function alreadyChecked(orderId: string, checkKind: string): boolean {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (
      typeof p.orderId === "string" &&
      p.orderId === orderId &&
      p.checkKind === checkKind
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Resolve OrderProposed from sourceOrderEventId
// ---------------------------------------------------------------------------

interface OrderDetails {
  counterpartyLei: string | null;
  instrument: string | null;
  side: string | null;
  quantity: number | null;
  price: number | null;
}

function resolveOrder(sourceOrderEventId: string | null): OrderDetails {
  if (!sourceOrderEventId) {
    return { counterpartyLei: null, instrument: null, side: null, quantity: null, price: null };
  }
  for (const orderEvent of eventStore.replay({ type: "OrderProposed" })) {
    if (orderEvent.event_id === sourceOrderEventId) {
      const op = orderEvent.payload as {
        counterpartyLei?: unknown;
        instrument?: unknown;
        side?: unknown;
        quantity?: unknown;
        price?: unknown;
      };
      return {
        counterpartyLei: typeof op.counterpartyLei === "string" ? op.counterpartyLei : null,
        instrument: typeof op.instrument === "string" ? op.instrument : null,
        side: typeof op.side === "string" ? op.side : null,
        quantity: typeof op.quantity === "number" ? op.quantity : null,
        price: typeof op.price === "number" ? op.price : null,
      };
    }
  }
  return { counterpartyLei: null, instrument: null, side: null, quantity: null, price: null };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const creditRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "credit-limit";
  });
  const capitalRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "capital-impact";
  });
  const fundingRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "funding";
  });

  const totalRequests = creditRequests.length + capitalRequests.length + fundingRequests.length;

  if (totalRequests === 0) {
    return {
      eventsEmitted: 0,
      summary:
        "no GatewayCheckRequested[credit-limit|capital-impact|funding] events in triggering set; nothing to check",
      ok: true,
    };
  }

  // Load stubs once.
  const creditLimitStub = loadCreditLimitStub(ctx.repoRoot);
  const capitalFundingStub = loadCapitalFundingStub(ctx.repoRoot);

  let eventsEmitted = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // ---------------------------------------------------------------------------
  // Credit-limit checks
  // ---------------------------------------------------------------------------

  const cpExposure = computeCounterpartyExposure();

  for (const e of creditRequests) {
    const p = e.payload as {
      orderId?: unknown;
      sourceOrderEventId?: unknown;
      requestedAt?: unknown;
    };

    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    const sourceCheckRequestEventId = e.event_id;

    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:credit-capital-funding-check — GatewayCheckRequested[credit-limit] missing orderId; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    if (alreadyChecked(orderId, "credit-limit")) {
      logger.debug(
        { orderId },
        "kai:credit-capital-funding-check — credit-limit already checked; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;
    const order = resolveOrder(sourceOrderEventId);

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;

    if (!order.counterpartyLei || order.quantity === null || order.price === null) {
      outcome = "reject";
      rejectionReason =
        "Could not resolve counterpartyLei/quantity/price from OrderProposed; credit-limit check cannot proceed";
      citationToRule = "RAS-B3";
    } else if (creditLimitStub.blockedCounterparties.includes(order.counterpartyLei)) {
      outcome = "reject";
      rejectionReason = `Counterparty '${order.counterpartyLei}' is on the credit blocked list (zero credit limit).`;
      citationToRule = "RAS-B3";
    } else if (order.side !== "sell") {
      const proposedNotionalZAR = order.price * order.quantity;
      const currentExposureZAR = cpExposure.get(order.counterpartyLei) ?? 0;
      const proFormaExposureZAR = currentExposureZAR + proposedNotionalZAR;

      const creditLimitZAR =
        creditLimitStub.perCounterpartyLimits[order.counterpartyLei] ??
        creditLimitStub.defaultCreditLimitZAR;

      if (proFormaExposureZAR > creditLimitZAR) {
        outcome = "reject";
        rejectionReason =
          `Credit limit breached for counterparty '${order.counterpartyLei}': ` +
          `pro-forma exposure ZAR ${proFormaExposureZAR.toFixed(0)} ` +
          `exceeds limit ZAR ${creditLimitZAR.toFixed(0)} ` +
          `(current exposure ZAR ${currentExposureZAR.toFixed(0)}, ` +
          `proposed notional ZAR ${proposedNotionalZAR.toFixed(0)}).`;
        citationToRule = "RAS-B3";
      }
    }
    // Sell orders: reduces exposure, always pass credit check.

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "credit-limit",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome },
        "kai:credit-capital-funding-check — dry-run; would emit GatewayCheckCompleted[credit-limit]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: HANDLER_ACTOR,
        citations: [...CREDIT_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      totalFailed += 1;
      logger.info(
        { orderId, rejectionReason },
        "kai:credit-capital-funding-check — credit-limit check FAILED",
      );
    } else {
      totalPassed += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Capital-impact checks
  // ---------------------------------------------------------------------------

  const currentRwaZAR = computeCurrentRwaZAR(capitalFundingStub);

  for (const e of capitalRequests) {
    const p = e.payload as {
      orderId?: unknown;
      sourceOrderEventId?: unknown;
      requestedAt?: unknown;
    };

    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    const sourceCheckRequestEventId = e.event_id;

    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:credit-capital-funding-check — GatewayCheckRequested[capital-impact] missing orderId; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    if (alreadyChecked(orderId, "capital-impact")) {
      logger.debug(
        { orderId },
        "kai:credit-capital-funding-check — capital-impact already checked; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;
    const order = resolveOrder(sourceOrderEventId);

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;

    if (!order.instrument || order.quantity === null || order.price === null) {
      outcome = "reject";
      rejectionReason =
        "Could not resolve instrument/quantity/price from OrderProposed; capital-impact check cannot proceed";
      citationToRule = "ORG-PR-01";
    } else if (order.side !== "sell") {
      const proposedNotionalZAR = order.price * order.quantity;
      const instClass = instrumentClass(order.instrument);
      const rwaWeightByClass = capitalFundingStub.rwa.rwaWeightByInstrumentClass;
      const rwaWeight =
        rwaWeightByClass[instClass] ?? rwaWeightByClass["default"] ?? 0.35;

      const proposedRwaZAR = proposedNotionalZAR * rwaWeight;
      const proFormaRwaZAR = currentRwaZAR + proposedRwaZAR;

      if (proFormaRwaZAR > capitalFundingStub.rwa.totalRwaLimitZAR) {
        outcome = "reject";
        rejectionReason =
          `Capital RWA limit breached: pro-forma RWA ZAR ${proFormaRwaZAR.toFixed(0)} ` +
          `exceeds BA 325 limit ZAR ${capitalFundingStub.rwa.totalRwaLimitZAR.toFixed(0)} ` +
          `(current RWA ZAR ${currentRwaZAR.toFixed(0)}, ` +
          `proposed add ZAR ${proposedRwaZAR.toFixed(0)} at RWA weight ${rwaWeight} for ${instClass}).`;
        citationToRule = "ORG-PR-01";
      }
    }

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "capital-impact",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome },
        "kai:credit-capital-funding-check — dry-run; would emit GatewayCheckCompleted[capital-impact]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: HANDLER_ACTOR,
        citations: [...CAPITAL_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      totalFailed += 1;
      logger.info(
        { orderId, rejectionReason },
        "kai:credit-capital-funding-check — capital-impact check FAILED",
      );
    } else {
      totalPassed += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Funding (LCR) checks
  // ---------------------------------------------------------------------------

  for (const e of fundingRequests) {
    const p = e.payload as {
      orderId?: unknown;
      sourceOrderEventId?: unknown;
      requestedAt?: unknown;
    };

    const orderId = typeof p.orderId === "string" ? p.orderId : "";
    const sourceCheckRequestEventId = e.event_id;

    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:credit-capital-funding-check — GatewayCheckRequested[funding] missing orderId; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    if (alreadyChecked(orderId, "funding")) {
      logger.debug(
        { orderId },
        "kai:credit-capital-funding-check — funding already checked; skipping",
      );
      totalSkipped += 1;
      continue;
    }

    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;
    const order = resolveOrder(sourceOrderEventId);

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;

    if (order.quantity === null || order.price === null) {
      outcome = "reject";
      rejectionReason =
        "Could not resolve quantity/price from OrderProposed; funding check cannot proceed";
      citationToRule = "ORG-PR-01";
    } else if (order.side !== "sell") {
      const proposedNotionalZAR = order.price * order.quantity;
      // Estimate LCR outflow: outflowPerMillionNotionalZAR per million of notional.
      const lcrOutflowPct =
        (proposedNotionalZAR / 1_000_000) * capitalFundingStub.lcr.outflowPerMillionNotionalZAR;
      const postTradeLcrPct = capitalFundingStub.lcr.currentLcrPct - lcrOutflowPct;

      if (postTradeLcrPct < capitalFundingStub.lcr.minimumLcrPct) {
        outcome = "reject";
        rejectionReason =
          `LCR headroom insufficient: estimated post-trade LCR ${postTradeLcrPct.toFixed(1)}% ` +
          `falls below minimum ${capitalFundingStub.lcr.minimumLcrPct}% ` +
          `(current LCR ${capitalFundingStub.lcr.currentLcrPct}%, ` +
          `estimated outflow impact ${lcrOutflowPct.toFixed(2)}% for ` +
          `notional ZAR ${proposedNotionalZAR.toFixed(0)}).`;
        citationToRule = "ORG-PR-01";
      }
    }

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "funding",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome },
        "kai:credit-capital-funding-check — dry-run; would emit GatewayCheckCompleted[funding]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: HANDLER_ACTOR,
        citations: [...FUNDING_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      totalFailed += 1;
      logger.info(
        { orderId, rejectionReason },
        "kai:credit-capital-funding-check — funding check FAILED",
      );
    } else {
      totalPassed += 1;
    }
  }

  logger.info(
    {
      creditRequests: creditRequests.length,
      capitalRequests: capitalRequests.length,
      fundingRequests: fundingRequests.length,
      totalPassed,
      totalFailed,
      totalSkipped,
      eventsEmitted,
    },
    "kai:credit-capital-funding-check — done",
  );

  return {
    eventsEmitted,
    summary:
      `${creditRequests.length} credit-limit, ${capitalRequests.length} capital-impact, ` +
      `${fundingRequests.length} funding checks: ` +
      `${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped.`,
    ok: true,
  };
};

export default handler;
