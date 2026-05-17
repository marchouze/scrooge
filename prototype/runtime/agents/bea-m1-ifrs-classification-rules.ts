// runtime/agents/bea-m1-ifrs-classification-rules.ts
//
// Bea's M1 IFRS-9 classification handler. Authority:
// `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07). Brief at
// `Team Inbox/2026-05-07_brief_bea_m1-ifrs-classification-rules.md`.
//
// Source proposal: `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §9 (IFRS classification mapping).
//
// What this handler does (M1 — listed equities only):
//
//   1. Subscribes (event-driven) to:
//        - `CeoDecision`               — life-cycle anchor (the M1 schema
//          foundation decision activates this rule set).
//        - `CdmBindingsRegenerated`    — refresh anchor (when Kai's bindings
//          inventory regenerates, Bea re-runs the rule pass).
//        - `EquityTradeBooked`         — per-trade dispatch.
//        - `EquitySettlementInstructed` — sub-ledger posting (settlement-date
//          confirmation; trade-date booking emits at the trade event).
//        - `EquityCorporateActionApplied` — dividend accrual / corporate
//          action posting.
//
//   2. For each `EquityTradeBooked` in the triggering set:
//        - SPPI gate: equities (residual cash flows, not principal+interest)
//          fail SPPI by construction (IFRS 9 § 4.1.2(b) / B4.1.7-21). They
//          are FVTPL by default for the trading book.
//        - Business-model dispatch (IFRS 9 § 4.1.1, B4.1.2-6):
//            - "trading"        → FVTPL  (default for the M1 institutional
//                                  global-markets franchise).
//            - "fvoci-election" → FVOCI  (IFRS 9 § 5.7.5 irrevocable election
//                                  by instrument; available only for non-
//                                  trading equity holdings; not enabled in
//                                  M1 production but the rule supports it).
//          Amortised cost is structurally unavailable for equities (SPPI
//          fail).
//        - Fair-value hierarchy (IFRS 13 § 72-90):
//            - JSE-listed instrument with `venue: "JSE"` → Level 1 (quoted
//              price in active market).
//            - OTC equity / dark pool / explicit `thinTradingFlag` payload
//              → Level 2 fallback.
//        - FX-revaluation rule (IAS 21 § 23(b)): non-functional currency
//          equity → flag for daily re-translation at the closing rate; the
//          GL projection (Anya) consumes the flag.
//        - Emits one `IfrsClassificationApplied` per trade with the typed
//          payload (classification, hierarchy level, fx flag, citations).
//
//   3. For each `EquityTradeBooked` (trade-date booking) and
//      `EquitySettlementInstructed` (settlement-date confirmation), emits a
//      `SubLedgerPostingEmitted` carrying the typed posting (debit/credit
//      legs against the chart of accounts). Mark-to-market revaluation and
//      realised-gain/loss postings are lifecycle-handled (the brief lists
//      them; in M1 they fire when the projection-runtime mark-to-market
//      pass produces them — out of scope for this slice).
//
//   4. Idempotency: skip emission if an `IfrsClassificationApplied` for the
//      same `tradeId` already exists; same for `SubLedgerPostingEmitted`
//      keyed on `(tradeId, leg)`.
//
// What this handler does NOT do in M1 (per brief out-of-scope):
//   - Bond classification (HTC / HTC&S / FVTPL) — M2.
//   - IRS classification + hedge accounting — M3.
//   - ECL credit-RWA on counterparty exposure — separate Rohan workstream.
//   - GL-projection assembly — owned by Anya; this handler emits the
//     postable events, the GL projection consumes them.
//
// Citation chain (Principle 2):
//   - IFRS-9 § 4.1.1 (business-model classification) → ORG-AC-01 (register).
//   - IFRS-9 § 4.1.2 / B4.1 (SPPI test for debt; equities fail by shape).
//   - IFRS-9 § 5.7.5 (FVOCI irrevocable election for equity instruments).
//   - IFRS-13 § 72-90 (fair-value hierarchy) → ORG-AC-05 (register).
//   - IAS-21 § 23 (FX revaluation at closing rate).
//   - IAS-1 (presentation; sub-ledger posting structure).
//
// Author: Bea (handler) · Atlas (runtime substrate) · Camille (CFO sign-off
// at M5 cutover).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const DEFAULT_ENTITY = "BANK-ZA-001";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:bea:m1-ifrs-classification-rules",
};

/**
 * Citation chain on every emission. Anchored to obligations-register rows
 * ORG-AC-01 (IFRS-9 SPPI + business-model) and ORG-AC-05 (IFRS-13 FV
 * hierarchy). IAS-1 anchors the sub-ledger posting structure; IAS-21
 * anchors the FX revaluation rule per Principle 5.
 */
const CLASSIFICATION_CITATIONS: readonly string[] = [
  "IFRS-9-§4.1.1",
  "IFRS-9-§4.1.2",
  "IFRS-9-§5.7.5",
  "IFRS-13-§72-90",
  "IAS-21-§23",
  "ORG-AC-01",
  "ORG-AC-05",
];

const POSTING_CITATIONS: readonly string[] = [
  "IFRS-9-§4.1.1",
  "IAS-1",
  "IAS-21-§23",
  "ORG-AC-01",
  "ORG-AC-08",
];

/**
 * The four CDM equity event types this handler subscribes to plus the
 * lifecycle anchor `CdmBindingsRegenerated` and the activation anchor
 * `CeoDecision` / `Decision`. Mirrored in `runtime/handlers-metadata.ts`.
 *
 * D-DECISIONS-FRAMEWORK-REDESIGN Slice C: `Decision` added alongside
 * the legacy `CeoDecision` alias.
 */
const SUBSCRIBED_TYPES = new Set<string>([
  "CeoDecision",
  "Decision", // D-DECISIONS-FRAMEWORK-REDESIGN Slice C unified type
  "CdmBindingsRegenerated",
  "EquityTradeBooked",
  "EquitySettlementInstructed",
  "EquityCorporateActionApplied",
]);

// --------------------------------------------------------------------------
// Classification logic
// --------------------------------------------------------------------------

export type IfrsCategory = "FVTPL" | "FVOCI" | "amortised-cost";
export type FvHierarchyLevel = "L1" | "L2" | "L3";
export type BusinessModel = "trading" | "fvoci-election";

export interface ClassificationDecision {
  readonly category: IfrsCategory;
  readonly hierarchyLevel: FvHierarchyLevel;
  readonly fxRevaluationRequired: boolean;
  readonly businessModel: BusinessModel;
  /** Per-step citation chain explaining the dispatch. */
  readonly citations: readonly string[];
  /** Functional currency assumed for FX revaluation gate (M1: ZAR). */
  readonly functionalCurrency: string;
  /** SPPI result — equities always fail by shape. Recorded for audit. */
  readonly sppiPass: boolean;
}

interface EquityTradePayload {
  readonly tradeId: { readonly scheme: string; readonly value: string };
  readonly instrument: {
    readonly identifier: { readonly scheme: string; readonly value: string };
    readonly class: string;
    readonly venue?: string;
    readonly currency: string;
  };
  readonly side: "buy" | "sell";
  readonly venue: string;
  readonly bookId: string;
  /**
   * Optional flag set upstream when the instrument is observed thin-trading
   * for the relevant day. Forces L2 fallback per IFRS 13 § 72-90. M1
   * heuristic; replaced by Anya's market-data feed at M2.
   */
  readonly thinTradingFlag?: boolean;
  /**
   * Optional explicit business-model override. Defaults to "trading" for
   * the M1 global-markets franchise. The non-trading FVOCI election is
   * not yet enabled in production but the rule supports the override.
   */
  readonly businessModelOverride?: BusinessModel;
}

const FUNCTIONAL_CURRENCY = "ZAR";

/**
 * Apply IFRS 9 + IFRS 13 + IAS 21 to a single equity trade.
 *
 * SPPI gate (IFRS 9 § 4.1.2 / B4.1.7-21): equities have residual cash flows,
 * not solely-principal-and-interest. They fail SPPI by construction; the
 * amortised-cost and FVOCI-debt categories are structurally unavailable.
 *
 * Business-model dispatch (IFRS 9 § 4.1.1):
 *   - "trading" → FVTPL (default for M1 institutional global-markets).
 *   - "fvoci-election" → FVOCI (IFRS 9 § 5.7.5 irrevocable per-instrument
 *     election; available only for equity instruments not held for trading).
 *
 * FV hierarchy (IFRS 13 § 72-90):
 *   - JSE-venue + no thin-trading flag → L1.
 *   - thin-trading flag OR non-JSE OTC venue → L2.
 *   - L3 reserved for unobservable inputs (not in M1 listed-equity scope).
 *
 * FX revaluation (IAS 21 § 23(b)): if the trade currency differs from the
 * bank's functional currency (ZAR in M1), the position requires daily
 * re-translation at the closing rate. The flag is consumed by the GL
 * projection (Anya).
 */
export function classifyEquityTrade(payload: EquityTradePayload): ClassificationDecision {
  const businessModel: BusinessModel = payload.businessModelOverride ?? "trading";

  // SPPI gate — equities fail by shape (residual cash flows).
  const sppiPass = false;

  let category: IfrsCategory;
  if (businessModel === "fvoci-election") {
    // IFRS 9 § 5.7.5 — irrevocable per-instrument FVOCI election. Available
    // only for equity instruments not held for trading.
    category = "FVOCI";
  } else {
    // Default: trading book → FVTPL (IFRS 9 § 4.1.4).
    category = "FVTPL";
  }

  // Fair-value hierarchy (IFRS 13 § 72-90).
  let hierarchyLevel: FvHierarchyLevel;
  const thin = payload.thinTradingFlag === true;
  const onJse = payload.venue === "JSE" || payload.instrument.venue === "JSE";
  if (onJse && !thin) {
    hierarchyLevel = "L1";
  } else {
    // Off-JSE venue or thin-trading day → L2 fallback. L3 reserved.
    hierarchyLevel = "L2";
  }

  const fxRevaluationRequired = payload.instrument.currency !== FUNCTIONAL_CURRENCY;

  const citations: string[] = ["IFRS-9-§4.1.1", "IFRS-9-§4.1.2"];
  if (category === "FVOCI") citations.push("IFRS-9-§5.7.5");
  citations.push("IFRS-13-§72-90");
  if (fxRevaluationRequired) citations.push("IAS-21-§23");
  citations.push("ORG-AC-01", "ORG-AC-05");

  return {
    category,
    hierarchyLevel,
    fxRevaluationRequired,
    businessModel,
    citations,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    sppiPass,
  };
}

// --------------------------------------------------------------------------
// Sub-ledger posting derivation (trade-date + settlement-date)
// --------------------------------------------------------------------------

export interface SubLedgerLeg {
  readonly debit: string;
  readonly credit: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly memo: string;
}

export interface SubLedgerPosting {
  readonly tradeId: string;
  readonly postingType: "trade-date-booking" | "settlement-confirmation" | "dividend-accrual";
  readonly legs: readonly SubLedgerLeg[];
  readonly asOfDate: string;
  readonly citations: readonly string[];
}

/**
 * Trade-date booking per IAS 1 / IFRS 9. For a buy: debit equity-position
 * (asset), credit pending-settlement (liability); reverse for sell. Real
 * GL accounts are stubbed (`ACC-equities-buy-stub` etc.) — the chart of
 * accounts (`platform/accounting/chart-of-accounts.schema.json`) currently
 * holds only ACC-1100-001; equity-book accounts arrive when the close
 * engine substrate lands (Bea Substrate Gap §3, target M2).
 */
function deriveTradeDatePosting(
  tradeId: string,
  payload: EquityTradePayload,
  consideration: { currency: string; amountMinor: number },
  tradeDate: string,
): SubLedgerPosting {
  const isBuy = payload.side === "buy";
  return {
    tradeId,
    postingType: "trade-date-booking",
    legs: [
      {
        debit: isBuy ? "ACC-equity-position-stub" : "ACC-pending-settlement-stub",
        credit: isBuy ? "ACC-pending-settlement-stub" : "ACC-equity-position-stub",
        currency: consideration.currency,
        amountMinor: consideration.amountMinor,
        memo: `Trade-date ${payload.side} ${payload.instrument.identifier.value} on ${payload.venue}`,
      },
    ],
    asOfDate: tradeDate,
    citations: [...POSTING_CITATIONS],
  };
}

/**
 * Settlement-date confirmation. Closes pending-settlement; debits/credits
 * cash. Mark-to-market and realised-P&L postings fire from downstream
 * lifecycle events (out of M1-slice scope).
 */
function deriveSettlementPosting(
  tradeId: string,
  netCash: { currency: string; amountMinor: number },
  settlementDate: string,
  side: "receive" | "pay",
): SubLedgerPosting {
  const isReceive = side === "receive";
  return {
    tradeId,
    postingType: "settlement-confirmation",
    legs: [
      {
        debit: isReceive ? "ACC-1100-001" : "ACC-pending-settlement-stub",
        credit: isReceive ? "ACC-pending-settlement-stub" : "ACC-1100-001",
        currency: netCash.currency,
        amountMinor: Math.abs(netCash.amountMinor),
        memo: `Settlement ${side} ${tradeId}`,
      },
    ],
    asOfDate: settlementDate,
    citations: [...POSTING_CITATIONS],
  };
}

// --------------------------------------------------------------------------
// Idempotency
// --------------------------------------------------------------------------

function classificationAlreadyApplied(tradeId: string): boolean {
  for (const e of eventStore.replay({ type: "IfrsClassificationApplied" })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string" && p.tradeId === tradeId) return true;
  }
  return false;
}

function postingAlreadyEmitted(tradeId: string, postingType: string): boolean {
  for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
    const p = e.payload as { tradeId?: unknown; postingType?: unknown };
    if (
      typeof p.tradeId === "string" &&
      p.tradeId === tradeId &&
      typeof p.postingType === "string" &&
      p.postingType === postingType
    ) {
      return true;
    }
  }
  return false;
}

// --------------------------------------------------------------------------
// Event extraction helpers
// --------------------------------------------------------------------------

function tradeIdOf(e: Event): string | undefined {
  const p = e.payload as { tradeId?: { value?: unknown } };
  if (p.tradeId && typeof p.tradeId.value === "string") return p.tradeId.value;
  return undefined;
}

// --------------------------------------------------------------------------
// Run summary + report
// --------------------------------------------------------------------------

interface RunSummary {
  readonly tradesSeen: number;
  readonly classificationsEmitted: number;
  readonly classificationsSkipped: number;
  readonly tradePostingsEmitted: number;
  readonly settlementPostingsEmitted: number;
  readonly postingsSkipped: number;
  readonly lifecycleAnchorsSeen: number;
}

function buildReportMarkdown(ctx: AgentRunContext, sum: RunSummary): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Bea", "m1-ifrs-classification-rules", ctx.asOf));
  lines.push(`# Bea — M1 IFRS classification rules, ${date}`);
  lines.push("");
  lines.push(
    "Event-driven run of Bea's M1 IFRS-classification handler per `Team Inbox/2026-05-07_brief_bea_m1-ifrs-classification-rules.md`. Authority: `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07). Subscribes to `CeoDecision`, `CdmBindingsRegenerated`, `EquityTradeBooked`, `EquitySettlementInstructed`, `EquityCorporateActionApplied`.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${sum.tradesSeen} EquityTradeBooked seen; ${sum.classificationsEmitted} IfrsClassificationApplied emitted (${sum.classificationsSkipped} skipped — already classified); ${sum.tradePostingsEmitted + sum.settlementPostingsEmitted} SubLedgerPostingEmitted (${sum.tradePostingsEmitted} trade-date / ${sum.settlementPostingsEmitted} settlement); ${sum.lifecycleAnchorsSeen} lifecycle anchors (CeoDecision / CdmBindingsRegenerated).`,
  );
  lines.push("");
  lines.push("## Rule shape (M1 — listed equities)");
  lines.push("");
  lines.push(
    "- **SPPI gate** — equities fail SPPI by shape (residual cash flows, not principal+interest). IFRS 9 § 4.1.2 / B4.1.7-21. Amortised-cost and FVOCI-debt categories structurally unavailable.",
  );
  lines.push(
    "- **Business-model dispatch** — `trading` → FVTPL (default for M1 institutional global-markets); `fvoci-election` → FVOCI (IFRS 9 § 5.7.5 irrevocable per-instrument election; not enabled in M1 production).",
  );
  lines.push(
    "- **FV hierarchy** — JSE-venue + no thin-trading flag → L1 (quoted price in active market, IFRS 13 § 76); else L2 fallback. L3 reserved for unobservable inputs.",
  );
  lines.push(
    "- **FX revaluation** — instrument.currency != ZAR (functional currency) → flag for daily re-translation at the closing rate (IAS 21 § 23(b)). GL projection (Anya) consumes the flag.",
  );
  lines.push("");
  lines.push("## Citation chain");
  lines.push("");
  lines.push(`- Classification: ${CLASSIFICATION_CITATIONS.join(", ")}`);
  lines.push(`- Postings: ${POSTING_CITATIONS.join(", ")}`);
  lines.push("");
  lines.push("## Out of scope (M1)");
  lines.push("");
  lines.push("- Bond classification (HTC / HTC&S / FVTPL) — M2.");
  lines.push("- IRS classification + hedge accounting — M3.");
  lines.push("- ECL credit-RWA on counterparty exposure — Rohan workstream.");
  lines.push(
    "- Mark-to-market revaluation + realised-gain/loss posting — fire from downstream lifecycle (Anya projection-runtime); out of slice.",
  );
  lines.push("");
  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Triggering events from `ctx.trigger.triggeringEvents`; idempotency walks `eventStore.replay({type:...})`; emissions through `eventStore.append`. Citation IDs anchor to `Regulations/_obligations-register.md` rows ORG-AC-01 (IFRS-9 SPPI + business-model) and ORG-AC-05 (IFRS-13 FV hierarchy).",
  );
  lines.push("");
  return lines.join("\n");
}

// --------------------------------------------------------------------------
// Handler
// --------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter((e) => SUBSCRIBED_TYPES.has(e.type));

  if (relevant.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no subscribed events in triggering set; nothing to classify",
      ok: true,
    };
  }

  const sum = {
    tradesSeen: 0,
    classificationsEmitted: 0,
    classificationsSkipped: 0,
    tradePostingsEmitted: 0,
    settlementPostingsEmitted: 0,
    postingsSkipped: 0,
    lifecycleAnchorsSeen: 0,
  };

  let eventsEmitted = 0;

  for (const e of relevant) {
    // D-DECISIONS-FRAMEWORK-REDESIGN Slice C: accept both legacy CeoDecision
    // and the unified Decision event type as lifecycle anchors.
    if (e.type === "CeoDecision" || e.type === "Decision" || e.type === "CdmBindingsRegenerated") {
      sum.lifecycleAnchorsSeen += 1;
      // Lifecycle anchors don't emit per-event; they activate / refresh the
      // rule set. The rule set itself is code (this module) — re-running
      // the handler against future trades exercises any rule update.
      continue;
    }

    if (e.type === "EquityTradeBooked") {
      sum.tradesSeen += 1;
      const tradeId = tradeIdOf(e);
      if (!tradeId) {
        logger.warn(
          { eventId: e.event_id },
          "bea:m1-ifrs-classification-rules — EquityTradeBooked missing tradeId; skipping",
        );
        sum.classificationsSkipped += 1;
        continue;
      }

      const payload = e.payload as unknown as EquityTradePayload & {
        consideration: { currency: string; amountMinor?: number; amount?: number };
        tradeDate: { iso: string };
      };

      // Idempotency on classification.
      if (classificationAlreadyApplied(tradeId)) {
        sum.classificationsSkipped += 1;
      } else {
        const decision = classifyEquityTrade(payload);
        if (!ctx.dryRun) {
          eventStore.append({
            event_id: newEventId(),
            type: "IfrsClassificationApplied",
            as_of: ctx.asOf,
            entity: e.entity ?? DEFAULT_ENTITY,
            actor: HANDLER_ACTOR,
            citations: [...CLASSIFICATION_CITATIONS],
            payload: {
              tradeId,
              instrumentClass: payload.instrument.class,
              category: decision.category,
              hierarchyLevel: decision.hierarchyLevel,
              fxRevaluationRequired: decision.fxRevaluationRequired,
              functionalCurrency: decision.functionalCurrency,
              tradeCurrency: payload.instrument.currency,
              businessModel: decision.businessModel,
              sppiPass: decision.sppiPass,
              sourceEventId: e.event_id,
              ruleCitations: decision.citations,
            },
          });
          eventsEmitted += 1;
        }
        sum.classificationsEmitted += 1;
      }

      // Trade-date booking posting.
      if (postingAlreadyEmitted(tradeId, "trade-date-booking")) {
        sum.postingsSkipped += 1;
      } else {
        // Tolerate either {amountMinor} (CDM Money minor units) or {amount}
        // (legacy fixtures); fall back to 0 if both missing.
        const considMinor =
          typeof payload.consideration.amountMinor === "number"
            ? payload.consideration.amountMinor
            : typeof payload.consideration.amount === "number"
              ? Math.round(payload.consideration.amount * 100)
              : 0;
        const posting = deriveTradeDatePosting(
          tradeId,
          payload,
          { currency: payload.consideration.currency, amountMinor: considMinor },
          payload.tradeDate.iso,
        );
        if (!ctx.dryRun) {
          eventStore.append({
            event_id: newEventId(),
            type: "SubLedgerPostingEmitted",
            as_of: ctx.asOf,
            entity: e.entity ?? DEFAULT_ENTITY,
            actor: HANDLER_ACTOR,
            citations: [...POSTING_CITATIONS],
            payload: { ...posting, sourceEventId: e.event_id },
          });
          eventsEmitted += 1;
        }
        sum.tradePostingsEmitted += 1;
      }
      continue;
    }

    if (e.type === "EquitySettlementInstructed") {
      const tradeId = tradeIdOf(e);
      if (!tradeId) {
        sum.postingsSkipped += 1;
        continue;
      }
      if (postingAlreadyEmitted(tradeId, "settlement-confirmation")) {
        sum.postingsSkipped += 1;
        continue;
      }
      const payload = e.payload as unknown as {
        netCash: { currency: string; amountMinor?: number; amount?: number };
        settlementDate: { iso: string };
      };
      const netMinor =
        typeof payload.netCash.amountMinor === "number"
          ? payload.netCash.amountMinor
          : typeof payload.netCash.amount === "number"
            ? Math.round(payload.netCash.amount * 100)
            : 0;
      const side: "receive" | "pay" = netMinor >= 0 ? "receive" : "pay";
      const posting = deriveSettlementPosting(
        tradeId,
        { currency: payload.netCash.currency, amountMinor: netMinor },
        payload.settlementDate.iso,
        side,
      );
      if (!ctx.dryRun) {
        eventStore.append({
          event_id: newEventId(),
          type: "SubLedgerPostingEmitted",
          as_of: ctx.asOf,
          entity: e.entity ?? DEFAULT_ENTITY,
          actor: HANDLER_ACTOR,
          citations: [...POSTING_CITATIONS],
          payload: { ...posting, sourceEventId: e.event_id },
        });
        eventsEmitted += 1;
      }
      sum.settlementPostingsEmitted += 1;
      continue;
    }

    if (e.type === "EquityCorporateActionApplied") {
      // Corporate-action posting is a thin slice in M1 — only cash-dividend
      // accrual fires; non-cash actions (split, scrip, rights) are
      // position-only with no GL leg in this slice. Lands in the dividend-
      // accrual posting pipeline at M2.
      // For M1 we emit a no-op marker posting so the source-event audit
      // trail is preserved.
      const payload = e.payload as { actionId?: { value?: string }; actionType?: string };
      const actionId = payload.actionId?.value ?? "(unknown)";
      logger.debug(
        { actionId, actionType: payload.actionType },
        "bea:m1-ifrs-classification-rules — corporate-action observed; M1 posting deferred to M2",
      );
      // Intentional no-op — no posting emitted. The classification handler
      // is the audit trail; Vera's recon walks against `EquityCorporateActionApplied`
      // → M2 settlement.
    }
  }

  // Owner-Inbox deliverable
  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_bea_m1-ifrs-classification-rules.md`;
    writeFileSync(resolve(ctx.ownerInboxDir, filename), buildReportMarkdown(ctx, sum), "utf8");
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.info(
    {
      tradesSeen: sum.tradesSeen,
      classificationsEmitted: sum.classificationsEmitted,
      classificationsSkipped: sum.classificationsSkipped,
      tradePostingsEmitted: sum.tradePostingsEmitted,
      settlementPostingsEmitted: sum.settlementPostingsEmitted,
      lifecycleAnchorsSeen: sum.lifecycleAnchorsSeen,
      eventsEmitted,
    },
    "bea:m1-ifrs-classification-rules — done",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${sum.tradesSeen} trades · ${sum.classificationsEmitted} classified (${sum.classificationsSkipped} skipped) · ${sum.tradePostingsEmitted + sum.settlementPostingsEmitted} postings · ${sum.lifecycleAnchorsSeen} lifecycle anchors.`,
    ok: true,
  };
};

export default handler;
