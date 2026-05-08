// runtime/agents/kai-pre-trade-gateway-aggregator.ts
//
// Kai's pre-trade gateway aggregator (slice 1 of 7 of the v0 envelope).
//
// Authority:
//   - S7-Targeted critical-path item #5; CEO decision
//     D-S7-TARGETED-3-5-OPEN-QUESTIONS approved 2026-05-08 (Saskia + Kai
//     sub-decision C: hard-reject default + soft-flag overlay; synchronous
//     reject-on-timeout; M1 equities only; 4 HITL via AgentEscalation;
//     no override path in v0).
//   - `Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md`
//     — §3 (architecture sketch — fan-out / aggregate over the bus-canonical
//     runtime), §7 (sequencing — slice 1 = aggregator + permission-policy +
//     citation-gate coverage), §7 Kai's note ("Slice 1 lands without any
//     check handler being live; the gateway just emits OrderApprovedAtGateway
//     for every order in that interim state").
//   - `Team/Kai.md` §10 (override-request → AgentEscalation), §12
//     (`@platform/markets/pre-trade-gateway` co-owned with Rohan), §15
//     (architectural non-bypassability — single dispatch point).
//
// What this handler does (slice 1 — interim default-approve behaviour):
//   1. Subscribes to `OrderProposed`.
//   2. For each triggering OrderProposed event in this run, emits a single
//      `OrderApprovedAtGateway` with the citation chain to FAIS / FIC / the
//      strategic-foundation institutional-only constraint / the franchise
//      design.
//   3. Idempotency at the handler layer: skip emission if an
//      `OrderApprovedAtGateway` already exists for the orderId. (The bus
//      layer also de-dupes on (eventId, handlerKey) via BusDispatched —
//      this is belt-and-braces against ad-hoc re-runs.)
//
// What slices 2–7 will add (intentionally NOT in this slice):
//   - Individual check handlers (identity, sanctions, suitability, credit,
//     market-risk, capital-impact, funding, surveillance) and their
//     GatewayCheckRequested fan-out + GatewayCheckCompleted aggregation.
//   - Soft-flag overlay register (slice 7, alongside surveillance).
//   - Override path (per Q5 of the brief, deferred entirely from v0).
//   - Asset-class branch — v0 covers M1 listed equities only; slice 1
//     default-approve has no asset-class gating, so this is recorded in
//     the PR body and revisited at slice 4+.
//   - Vera gateway-integrity recon pipeline (after slice 7).
//
// Non-bypassability (Kai.md §15): the aggregator is the single dispatch
// point that emits OrderApprovedAtGateway / OrderRejectedAtGateway. No
// other handler emits these. Vera's planned gateway-integrity recon
// (post-slice-7) asserts this end-to-end.
//
// Author: Kai (handler) · Saskia (franchise + governance) · Atlas (runtime
// substrate).

import { eventStore, logger } from "../../platform/composition";
import { makeOrderApprovedAtGateway } from "../../platform/event-store/event-types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";

const DEFAULT_ENTITY = "BANK-ZA-001";

const AGGREGATOR_ACTOR = {
  type: "service" as const,
  id: "agent:kai:pre-trade-gateway-aggregator",
};

/**
 * Citation chain for slice-1 default-approve emissions. Per Principle 2,
 * every event traces to a structured source.
 *
 *   - ORG-CD-01 — FAIS Act 37/2002 + FSCA Conduct Standards (TCF). Anchor
 *     for the conduct-side rules the gateway will enforce as slices 2+
 *     wire (suitability, surveillance).
 *   - ORG-FC-13 — UN/OFAC/EU/HMT/POCDATARA sanctions screening (RAS B4).
 *     Anchor for the sanctions check landing in slice 2.
 *   - JSE-RULES-EQUITIES — exchange listing & trading rules. v0 covers
 *     M1 listed equities only.
 *   - FMA-S5 — Financial Markets Act § 5 market integrity.
 *   - GOV-FRAMEWORK-CEO-RESERVED — CEO-reserved governance authority for
 *     the franchise scope and the pre-trade-gateway non-bypassability rule.
 *
 * Strategic-foundation institutional-only constraint and the markets-
 * franchise-design proposal are not yet in the obligations register as
 * formal IDs — flag for Mira to instate `STRATEGIC-FOUNDATION-INSTITUTIONAL`
 * and `MARKETS-FRANCHISE-DESIGN` register entries. Until then we cite the
 * paths inline in the brief; the slice-1 emission carries the four
 * register-resolvable IDs above.
 *
 * [citation: route to Mira] — STRATEGIC-FOUNDATION-INSTITUTIONAL +
 * MARKETS-FRANCHISE-DESIGN to be added to `Regulations/_obligations-register.md`
 * before slice 2.
 */
const APPROVAL_CITATIONS: readonly string[] = [
  "ORG-CD-01",
  "ORG-FC-13",
  "JSE-RULES-EQUITIES",
  "FMA-S5",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

/**
 * Walk the event store for any existing OrderApprovedAtGateway whose
 * payload.orderId equals the given id. Idempotency at the handler layer.
 */
function alreadyApproved(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "OrderApprovedAtGateway" })) {
    const payload = e.payload as { orderId?: unknown };
    if (typeof payload.orderId === "string" && payload.orderId === orderId) {
      return true;
    }
  }
  return false;
}

/**
 * Walk the event store for any existing OrderRejectedAtGateway whose
 * payload.orderId equals the given id. The aggregator must not emit
 * OrderApprovedAtGateway if a rejection already terminated the order
 * (mutual exclusion per Atlas registry: pair-coupled with OrderProposed).
 */
function alreadyRejected(orderId: string): boolean {
  for (const e of eventStore.replay({ type: "OrderRejectedAtGateway" })) {
    const payload = e.payload as { orderId?: unknown };
    if (typeof payload.orderId === "string" && payload.orderId === orderId) {
      return true;
    }
  }
  return false;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const orderProposed = triggering.filter((e): e is Event => e.type === "OrderProposed");

  if (orderProposed.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no OrderProposed events in triggering set; nothing to gate",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  let approved = 0;
  let skipped = 0;

  for (const e of orderProposed) {
    const payload = e.payload as { orderId?: unknown };
    const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
    if (!orderId) {
      logger.warn(
        { eventId: e.event_id },
        "kai:pre-trade-gateway-aggregator — OrderProposed missing orderId; skipping",
      );
      skipped += 1;
      continue;
    }

    // Mutual exclusion + idempotency. Once any terminal gateway event
    // exists for this orderId, the aggregator does NOT re-fire. This
    // also preserves non-bypassability when slices 2–7 wire individual
    // checks: a reject from any check terminates the order.
    if (alreadyApproved(orderId) || alreadyRejected(orderId)) {
      skipped += 1;
      continue;
    }

    if (ctx.dryRun) {
      // Dry-run mode: we still log the intent so the recon harness can
      // observe the pre-emission shape, but we do not append.
      logger.debug(
        { orderId, parentEventId: e.event_id },
        "kai:pre-trade-gateway-aggregator — dry-run; would emit OrderApprovedAtGateway",
      );
      continue;
    }

    eventStore.append(
      makeOrderApprovedAtGateway({
        asOf: ctx.asOf,
        entity: DEFAULT_ENTITY,
        actor: AGGREGATOR_ACTOR,
        citations: [...APPROVAL_CITATIONS],
        payload: {
          orderId,
          // Slice 1 carries the same chain on every approval. Slices 2–7
          // will union per-check approval citations into this list.
          approvalCitations: [...APPROVAL_CITATIONS],
          passedAt: ctx.asOf,
        },
      }),
    );
    eventsEmitted += 1;
    approved += 1;
  }

  logger.info(
    { triggering: orderProposed.length, approved, skipped, eventsEmitted },
    "kai:pre-trade-gateway-aggregator — done",
  );

  return {
    eventsEmitted,
    summary: `${orderProposed.length} OrderProposed; ${approved} approved (slice-1 default-approve), ${skipped} skipped (idempotent / no orderId).`,
    ok: true,
  };
};

export default handler;
