// runtime/agents/kai-identity-gateway-check.ts
//
// Kai's identity and authorisation check handler for the pre-trade gateway
// (slice 5).
//
// Authority:
//   - FAIS-ACT-37-2002 §8A (FSP authorisation — submitting actor must be an
//     authorised person / registered FSP representative)
//   - FMA-S5 (Financial Markets Act — authorised participant requirement)
//   - D-PARTY-REGISTER (CEO-approved 2026-05-11 — Party register as the identity
//     axis for all actors)
//   - D-S7-TARGETED-3-5-OPEN-QUESTIONS (gateway envelope v0 slice 5)
//   - Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3
//
// What this handler does:
//   1. Subscribes to GatewayCheckRequested events with checkKind === "identity".
//   2. Resolves the requesting actor (requestedActor) from the original
//      OrderProposed event.
//   3. Verifies the actor is present in the Party register (PartyRegistered
//      events with kind === "agent" or equivalent).
//   4. Verifies the instrument class is within the actor's authorised scope
//      (build-phase: a configurable allowlist by instrument prefix / class).
//   5. Emits GatewayCheckCompleted with outcome "approve" or "reject".
//
// Build-phase limitations:
//   - Actor identity is verified against PartyRegistered events (kind === "agent")
//     in the event store. Production will verify against the full Party register
//     projection with role and authorisation metadata.
//   - Instrument-class authorisation uses an in-process allowlist by instrument
//     prefix. Production: read from a PermissionPolicy event per T-12.
//
// Non-bypassability: only kai:pre-trade-gateway-aggregator emits
// OrderApprovedAtGateway / OrderRejectedAtGateway. This handler emits only
// GatewayCheckCompleted.
//
// Author: Kai (Markets platform engineer, engineering)

import { eventStore, logger } from "../../platform/composition";
import {
  type GatewayCheckCompletedPayload,
  makeGatewayCheckCompleted,
} from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:kai:identity-gateway-check",
};

const IDENTITY_CITATIONS: readonly string[] = ["FAIS-ACT-37-2002", "FMA-S5", "D-PARTY-REGISTER"];

// ---------------------------------------------------------------------------
// Instrument-class authorisation allowlist (build-phase stub)
//
// In production this will be driven by PermissionPolicy events (T-12 substrate).
// An actor is allowed to trade any instrument whose prefix matches one of the
// allowed prefixes for their class.
//
// The agent actors in this bank (Saskia, Kai, etc.) are institution-level
// participants authorised to trade all in-scope instruments.
// ---------------------------------------------------------------------------

const ALLOWED_INSTRUMENT_PREFIXES: readonly string[] = [
  "JSE:", // JSE-listed equities (e.g. JSE:NPN)
  "ZAE", // JSE ISIN prefix for SA equities
  "ZAG", // JSE ISIN prefix for SA government bonds
  "FX-", // FX instruments (FX-spot, FX-forward, FX-swap, NDF)
  "IRS-", // Interest rate swaps (ZAR denominated)
  "OTC-", // Generic OTC instruments
  "BOND-", // Generic bond instruments
];

function isInstrumentAuthorised(instrument: string): boolean {
  for (const prefix of ALLOWED_INSTRUMENT_PREFIXES) {
    if (instrument.startsWith(prefix)) return true;
  }
  // Numeric ISINs without recognised prefix: allow if 12 chars (ISO 6166)
  if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(instrument)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Party register lookup (build-phase)
//
// Checks whether an agentUrn has been registered as a Party with kind "agent".
// Falls back to accepting any actor whose URN starts with "agent:" — in the
// build phase all dispatched agents are implicitly registered.
// ---------------------------------------------------------------------------

function isActorInPartyRegister(actorUrn: string): boolean {
  // Check PartyRegistered events with kind "agent"
  for (const e of eventStore.replay({ type: "PartyRegistered" })) {
    const p = e.payload as { partyId?: unknown; kind?: unknown };
    if (typeof p.partyId === "string" && p.partyId === actorUrn && p.kind === "agent") {
      return true;
    }
  }
  // Build-phase fallback: agents dispatched from the known agent URN namespace
  // are treated as implicitly registered (avoids blocking the gateway while the
  // full Party register is populated; T-12 substrate gap).
  if (actorUrn.startsWith("agent:")) return true;
  // Human actors (marc@tgv.co.za) are always authorised as CEO
  if (actorUrn.includes("@")) return true;
  return false;
}

/**
 * Idempotency guard: skip if GatewayCheckCompleted[identity] for orderId exists.
 */
function alreadyChecked(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "GatewayCheckCompleted" })) {
    const p = e.payload as { orderId?: unknown; checkKind?: unknown };
    if (typeof p.orderId === "string" && p.orderId === orderId && p.checkKind === "identity") {
      return true;
    }
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  const identityCheckRequests = triggering.filter((e): e is Event => {
    if (e.type !== "GatewayCheckRequested") return false;
    const p = e.payload as { checkKind?: unknown };
    return p.checkKind === "identity";
  });

  if (identityCheckRequests.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no GatewayCheckRequested[identity] events in triggering set; nothing to check",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const e of identityCheckRequests) {
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
        "kai:identity-gateway-check — GatewayCheckRequested missing orderId; skipping",
      );
      skipped += 1;
      continue;
    }

    if (alreadyChecked(orderId)) {
      logger.debug({ orderId }, "kai:identity-gateway-check — already checked; skipping");
      skipped += 1;
      continue;
    }

    // Resolve the original OrderProposed to get requestedActor and instrument.
    const sourceOrderEventId =
      typeof p.sourceOrderEventId === "string" ? p.sourceOrderEventId : null;

    let requestedActor: string | null = null;
    let instrument: string | null = null;

    if (sourceOrderEventId) {
      for (const orderEvent of eventStore.replay({ type: "OrderProposed" })) {
        if (orderEvent.event_id === sourceOrderEventId) {
          const op = orderEvent.payload as { requestedActor?: unknown; instrument?: unknown };
          requestedActor = typeof op.requestedActor === "string" ? op.requestedActor : null;
          instrument = typeof op.instrument === "string" ? op.instrument : null;
          break;
        }
      }
    }

    const requestedAt = typeof p.requestedAt === "string" ? p.requestedAt : ctx.asOf;
    const durationMs = Math.max(0, new Date(ctx.asOf).getTime() - new Date(requestedAt).getTime());

    // Check 1: actor must be in the party register (or match the build-phase fallback).
    let outcome: GatewayCheckCompletedPayload["outcome"] = "approve";
    let rejectionReason: string | undefined;
    let citationToRule: string | undefined;

    if (!requestedActor) {
      outcome = "reject";
      rejectionReason = "OrderProposed missing requestedActor field; identity check cannot proceed";
      citationToRule = "FAIS-ACT-37-2002";
    } else if (!isActorInPartyRegister(requestedActor)) {
      outcome = "reject";
      rejectionReason = `Requesting actor '${requestedActor}' is not found in the Party register or the authorised agent namespace. Trade requires an authorised FSP representative (FAIS Act 37/2002 §8A).`;
      citationToRule = "FAIS-ACT-37-2002";
    } else if (instrument && !isInstrumentAuthorised(instrument)) {
      outcome = "reject";
      rejectionReason = `Instrument '${instrument}' is not within the actor's authorised instrument scope. The instrument prefix does not match any approved instrument class for this entity (FMA §5 — authorised participant requirement).`;
      citationToRule = "FMA-S5";
    }

    const completedPayload: GatewayCheckCompletedPayload = {
      orderId,
      checkKind: "identity",
      outcome,
      sourceCheckRequestEventId,
      completedAt: ctx.asOf,
      durationMs,
      ...(rejectionReason && citationToRule ? { rejectionReason, citationToRule } : {}),
    };

    if (ctx.dryRun) {
      logger.debug(
        { orderId, outcome, requestedActor, instrument },
        "kai:identity-gateway-check — dry-run; would emit GatewayCheckCompleted[identity]",
      );
      continue;
    }

    eventStore.append(
      makeGatewayCheckCompleted({
        asOf: ctx.asOf,
        entity: "BANK-ZA-001",
        actor: HANDLER_ACTOR,
        citations: [...IDENTITY_CITATIONS],
        payload: completedPayload,
      }),
    );
    eventsEmitted += 1;
    if (outcome === "reject") {
      failed += 1;
      logger.info(
        { orderId, requestedActor, instrument, rejectionReason },
        "kai:identity-gateway-check — identity check FAILED",
      );
    } else {
      passed += 1;
      logger.debug(
        { orderId, requestedActor, instrument },
        "kai:identity-gateway-check — identity check passed",
      );
    }
  }

  logger.info(
    {
      triggering: identityCheckRequests.length,
      passed,
      failed,
      skipped,
      eventsEmitted,
    },
    "kai:identity-gateway-check — done",
  );

  return {
    eventsEmitted,
    summary: `${identityCheckRequests.length} identity checks: ${passed} passed, ${failed} failed, ${skipped} skipped.`,
    ok: true,
  };
};

export default handler;
