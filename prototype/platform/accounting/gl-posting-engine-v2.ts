// platform/accounting/gl-posting-engine-v2.ts
//
// Phase 3A — V2 GL Posting Engine (D-V1-REMOVAL-PHASE-3A, CEO-approved 2026-06-15).
//
// This engine runs DUAL-PARALLEL to the V1 posting engine (gl-posting-engine.ts
// / fx-accounting.ts SLA interpreter). It does NOT replace V1; it is the V2
// shadow that enables the parity gate (recon:gl-v2-parity) to compare outputs.
//
// ## Scope — what V2 covers in Phase 3A
//
// The only V1 trigger events that have V2 equivalents today are the FIL instance
// lifecycle events (FilInstrumentCreated / FilInstrumentAmended /
// FilInstrumentTerminated). These cover the FX sub-ledger only (3 posting rules):
//
//   PR-FX-001-V2  — Initial recognition at trade date (FilInstrumentCreated, FX)
//   PR-FX-REVAL-V2 — FVTPL revaluation (FilInstrumentAmended, FX, kind=revaluation)
//   PR-FX-CLOSE-V2 — Derecognition on settlement/cancellation (FilInstrumentTerminated)
//
// All other V1 posting rules (bond, equity, IRS, repo, MMD, IBL, period-close)
// have no V2 trigger equivalents yet. Their gap is documented in the design doc
// (prototype/docs/phase3a-gl-v2-design.md) and surfaced by the parity gate as
// advisory warnings — which is correct and expected.
//
// ## Output
//
// The engine emits GlPostingEmitted events (one per DR or CR leg) into the
// caller-supplied event store. Paired events form balanced double-entry entries.
// Each event carries:
//   - accountCode: COA account ID (resolved from the FIL economic terms)
//   - creditDebit: "debit" or "credit"
//   - amount: MoneyWire (decimal-native; NEVER amountMinor)
//   - postingDate: ISO date (from the FIL event asOf)
//   - tenantId: from the FIL event tenant field
//   - sourceEventId: the FIL event's instance URN (as the V2-side event ref)
//   - iasRule: IFRS/IAS citation
//   - postingRuleId: e.g. "PR-FX-001-V2"
//
// ## Package boundary
//
// This file is in platform/, NOT v2-core/, so it MAY import from both sides.
// The v2-core/ package must NOT import from here (recon:v2-no-v1-import).
//
// Authority: D-V1-REMOVAL-PHASE-3A (CEO-approved 2026-06-15).
// Citations: IFRS-9-§3.1.1; IAS-21-§23; P1-EVENTS-AS-TRUTH; P2-SINGLE-GRAPH-DISCIPLINE.
// Author: Atlas (Substrate Architect, engineering).

import { ANCHOR_TENANT_ID, type TenantId } from "../../v2-core/control-plane/tenant";
import type { FilInstanceLifecycleEvent } from "../../v2-core/fil-instances/events";
import type {
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../v2-core/fil-instances/events";
import { newEventId } from "../core/types";
import {
  type GlPostingEmittedPayload,
  makeGlPostingEmitted,
} from "../event-store/event-types/fx-accounting";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { readFilInstanceEvents } from "../risk/sa-ccr/fil-instance-positions";

// ---------------------------------------------------------------------------
// Supported product types from the FIL taxonomy.
// ---------------------------------------------------------------------------

const FX_TYPE_PREFIX = "fil:type:fx:";

function isFxInstance(typeUrn: string): boolean {
  return typeUrn.startsWith(FX_TYPE_PREFIX);
}

// ---------------------------------------------------------------------------
// COA account resolution for V2 FX postings.
//
// These are the same accounts the V1 SLA interpreter targets for FX trades.
// Hardcoded here for Phase 3A scope (FX sub-ledger only). A later phase will
// introduce a V2 account-resolver that reads the COA registry dynamically.
// ---------------------------------------------------------------------------

interface FxAccountSet {
  /** Trading receivable (debit-natural) in the trade currency. */
  readonly receivable: string;
  /** Trading payable (credit-natural) in the trade currency. */
  readonly payable: string;
  /** Unrealised P&L — FVTPL (credit-natural, ZAR). */
  readonly unrealisedPnl: string;
  /** Realised FX P&L (credit-natural, ZAR). */
  readonly realisedPnl: string;
}

/**
 * Resolve the COA account set for a given ISO-4217 currency pair.
 * Only currencies with dedicated per-currency accounts are supported; all
 * others route to the FX Unresolved-Currency Suspense (ACC-2100-007) —
 * matching the V1 SLA interpreter's fail-closed pattern.
 */
function resolveFxAccountSet(currency: string): FxAccountSet {
  switch (currency) {
    case "ZAR":
      return {
        receivable: "ACC-2100-001",
        payable: "ACC-2100-003",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
    case "USD":
      return {
        receivable: "ACC-2100-002",
        payable: "ACC-2100-004",
        unrealisedPnl: "ACC-2100-005", // ZAR P&L account
        realisedPnl: "ACC-2100-006",
      };
    case "GBP":
      return {
        receivable: "ACC-2100-010",
        payable: "ACC-2100-011",
        unrealisedPnl: "ACC-2100-012",
        realisedPnl: "ACC-2100-006",
      };
    case "EUR":
      return {
        receivable: "ACC-2100-013",
        payable: "ACC-2100-014",
        unrealisedPnl: "ACC-2100-015",
        realisedPnl: "ACC-2100-006",
      };
    case "CHF":
      return {
        receivable: "ACC-2100-016",
        payable: "ACC-2100-017",
        unrealisedPnl: "ACC-2100-018",
        realisedPnl: "ACC-2100-006",
      };
    case "AUD":
      return {
        receivable: "ACC-2100-019",
        payable: "ACC-2100-020",
        unrealisedPnl: "ACC-2100-021",
        realisedPnl: "ACC-2100-006",
      };
    case "JPY":
      return {
        receivable: "ACC-2100-022",
        payable: "ACC-2100-023",
        unrealisedPnl: "ACC-2100-024",
        realisedPnl: "ACC-2100-006",
      };
    default:
      // Fail-closed: route to unresolved-currency suspense (same as V1).
      return {
        receivable: "ACC-2100-007",
        payable: "ACC-2100-007",
        unrealisedPnl: "ACC-2100-005",
        realisedPnl: "ACC-2100-006",
      };
  }
}

// ---------------------------------------------------------------------------
// Leg factory — emit a single DR or CR GlPostingEmitted event.
// ---------------------------------------------------------------------------

function makeLeg(
  creditDebit: "debit" | "credit",
  accountCode: string,
  amount: GlPostingEmittedPayload["amount"],
  postingDate: string,
  tenantId: TenantId,
  sourceEventId: string,
  iasRule: string,
  postingRuleId: string,
  description: string,
  actor: Actor,
  entity: string,
  citations: string[],
): Event {
  return makeGlPostingEmitted({
    asOf: postingDate,
    entity,
    actor,
    citations,
    payload: {
      creditDebit,
      accountCode,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
    },
    eventId: newEventId(),
  });
}

// ---------------------------------------------------------------------------
// Encoding helper — convert v2-core Money to MoneyWire shape.
// Both have the same shape { currency, amount } (decimal string in major units).
// MoneyWire adds the __money discriminant for type safety; we satisfy it here.
// ---------------------------------------------------------------------------

function toMoneyWire(money: {
  currency: string;
  amount: string;
}): GlPostingEmittedPayload["amount"] {
  return {
    __money: "v1" as const,
    currency: money.currency,
    amount: money.amount,
  };
}

// ---------------------------------------------------------------------------
// PR-FX-001-V2 — Initial recognition at trade date (FilInstrumentCreated, FX)
//
// IFRS 9 §3.1.1: financial asset/liability recognised at trade date.
//
// For a "long" (buy) FX trade: Dr FX Trading Receivable / Cr FX Trading Payable
// The receivable is in the FCY; the payable is in ZAR (or the quote currency).
// ---------------------------------------------------------------------------

function postFxInitialRecognition(
  payload: FilInstrumentCreatedPayload,
  actor: Actor,
  entity: string,
  citations: string[],
): Event[] {
  const t = payload.economicTerms;
  const accounts = resolveFxAccountSet(t.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10); // ISO date
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = "IFRS 9 §3.1.1 — recognition on trade date";
  const postingRuleId = "PR-FX-001-V2";
  const description = `FX Initial Recognition ${t.currency} ${t.direction} (V2)`;

  if (t.direction === "long") {
    // Dr FX Trading Receivable (FCY) / Cr FX Trading Payable (ZAR)
    return [
      makeLeg(
        "debit",
        accounts.receivable,
        amount,
        postingDate,
        tenantId,
        sourceEventId,
        iasRule,
        postingRuleId,
        description,
        actor,
        entity,
        citations,
      ),
      makeLeg(
        "credit",
        accounts.payable,
        amount,
        postingDate,
        tenantId,
        sourceEventId,
        iasRule,
        postingRuleId,
        description,
        actor,
        entity,
        citations,
      ),
    ];
  }
  // direction === "short": Dr FX Trading Payable / Cr FX Trading Receivable
  return [
    makeLeg(
      "debit",
      accounts.payable,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      actor,
      entity,
      citations,
    ),
    makeLeg(
      "credit",
      accounts.receivable,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      actor,
      entity,
      citations,
    ),
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-REVAL-V2 — FVTPL revaluation (FilInstrumentAmended, FX)
//
// IFRS 9 §5.7.1 / IAS 21 §28: fair-value change recognised in P&L.
// The amended economic terms carry the updated notional (which represents the
// new fair value after revaluation). The delta is the difference from the prior
// economic terms. In Phase 3A we post the full notional change as a memo
// (advisory); a future phase will compute the delta properly.
//
// NOTE: This is an ADVISORY approximation. A proper delta-based revaluation
// requires reading the prior economic terms from the FIL instance register.
// Phase 3A posts the updated notional amount as the revaluation basis.
// ---------------------------------------------------------------------------

function postFxRevaluation(
  payload: FilInstrumentAmendedPayload,
  actor: Actor,
  entity: string,
  citations: string[],
): Event[] {
  const t = payload.economicTerms;
  const accounts = resolveFxAccountSet(t.currency);
  const amount = toMoneyWire(t.notional);
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = "IFRS 9 §5.7.1 — FVTPL revaluation";
  const postingRuleId = "PR-FX-REVAL-V2";
  const description = `FX Revaluation ${t.currency} (V2 advisory)`;

  // Dr/Cr Unrealised P&L / FX Trading Receivable (simplified basis)
  return [
    makeLeg(
      "debit",
      accounts.receivable,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      actor,
      entity,
      citations,
    ),
    makeLeg(
      "credit",
      accounts.unrealisedPnl,
      amount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      actor,
      entity,
      citations,
    ),
  ];
}

// ---------------------------------------------------------------------------
// PR-FX-CLOSE-V2 — Derecognition on settlement/cancellation (FilInstrumentTerminated)
//
// IFRS 9 §3.2.3: derecognition when the bank's obligation to deliver cash is met
// or the instrument is cancelled. We reverse the initial recognition entry.
// ---------------------------------------------------------------------------

function postFxClose(
  payload: FilInstrumentTerminatedPayload,
  actor: Actor,
  entity: string,
  citations: string[],
): Event[] {
  // FilInstrumentTerminated does NOT carry economic terms — only the terminal
  // stage and instance URN. A proper derecognition entry needs the notional
  // from the prior Created/Amended events. In Phase 3A this posts a zero-amount
  // memo (advisory) to mark the close; a future phase reads the prior state.
  //
  // The advisory close is still valuable for the parity gate: it ensures
  // the V2 trial balance has an entry for every terminated instance, and the
  // gate can surface the zero-amount difference as a known gap.
  const postingDate = payload.asOf.substring(0, 10);
  const tenantId = (payload.tenant ?? ANCHOR_TENANT_ID) as TenantId;
  const sourceEventId = payload.instance;
  const iasRule = "IFRS 9 §3.2.3 — derecognition on settlement/cancellation";
  const postingRuleId = "PR-FX-CLOSE-V2";
  const description = `FX Derecognition ${payload.terminalStage} (V2 advisory)`;

  // Zero-amount memo — until the prior economic terms are carried on Terminated.
  // The account code uses ZAR suspense as a placeholder; the parity gate surfaces
  // the discrepancy for manual resolution.
  const zeroAmount: GlPostingEmittedPayload["amount"] = {
    __money: "v1" as const,
    currency: "ZAR",
    amount: "0",
  };

  return [
    makeLeg(
      "debit",
      "ACC-2100-005",
      zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      actor,
      entity,
      citations,
    ),
    makeLeg(
      "credit",
      "ACC-2100-005",
      zeroAmount,
      postingDate,
      tenantId,
      sourceEventId,
      iasRule,
      postingRuleId,
      description,
      actor,
      entity,
      citations,
    ),
  ];
}

// ---------------------------------------------------------------------------
// Main engine function — process a batch of FIL instance events and emit
// GlPostingEmitted events to the supplied store.
// ---------------------------------------------------------------------------

export interface GlV2EngineArgs {
  /** FIL instance lifecycle events to process. Defaults to reading from V2 anchor store. */
  readonly events?: readonly FilInstanceLifecycleEvent[];
  /** Event store to emit GlPostingEmitted events into. */
  readonly eventStore: EventStore;
  /** Actor to attribute postings to. */
  readonly actor: Actor;
  /** Legal entity the postings belong to. */
  readonly entity: string;
  /** ISO 8601 as-of bound — only process events at or before this date. */
  readonly asOf?: string;
}

export interface GlV2EngineResult {
  /** Total number of GlPostingEmitted events emitted. */
  readonly emitted: number;
  /** FIL instances processed (by kind). */
  readonly processed: {
    readonly created: number;
    readonly amended: number;
    readonly terminated: number;
    readonly skipped: number; // non-FX or out-of-scope
  };
}

const CITATIONS = [
  "IFRS-9-§3.1.1",
  "IFRS-9-§5.7.1",
  "IFRS-9-§3.2.3",
  "IAS-21-§23",
  "D-V1-REMOVAL-PHASE-3A",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

/**
 * Process FIL instance lifecycle events and emit V2 GL postings.
 *
 * This is the core V2 posting engine. It reads V2 FIL instance events
 * and applies the posting rules for the covered FX sub-set (PR-FX-001-V2,
 * PR-FX-REVAL-V2, PR-FX-CLOSE-V2). All other instrument types are skipped
 * with a count in `processed.skipped`.
 *
 * The engine is DUAL-RUN parallel to V1 — it NEVER writes to the same
 * store as V1 SubLedgerPostingEmitted events. The caller passes a distinct
 * event store (typically a V2-specific store or a test store). If called
 * with the shared V1 canonical store, GlPostingEmitted and SubLedgerPostingEmitted
 * co-exist (different event types) and the parity gate folds each separately.
 */
export function runGlV2Engine(args: GlV2EngineArgs): GlV2EngineResult {
  const events = args.events ?? readFilInstanceEvents();
  const cutoff = args.asOf;

  let emitted = 0;
  const processed = { created: 0, amended: 0, terminated: 0, skipped: 0 };

  for (const event of events) {
    // As-of gate: skip events after the cutoff.
    if (cutoff && event.asOf > cutoff) continue;

    let legs: Event[] = [];

    if (event.kind === "FilInstrumentCreated") {
      if (!isFxInstance(event.type)) {
        processed.skipped++;
        continue;
      }
      legs = postFxInitialRecognition(
        event as FilInstrumentCreatedPayload,
        args.actor,
        args.entity,
        CITATIONS,
      );
      processed.created++;
    } else if (event.kind === "FilInstrumentAmended") {
      if (!isFxInstance(event.type)) {
        processed.skipped++;
        continue;
      }
      legs = postFxRevaluation(
        event as FilInstrumentAmendedPayload,
        args.actor,
        args.entity,
        CITATIONS,
      );
      processed.amended++;
    } else if (event.kind === "FilInstrumentTerminated") {
      // Terminated events don't carry type URN for non-FX check; include all.
      // The termination derecognition applies to any FIL instance regardless of
      // type (the initial recognition was already posted by Created). However,
      // we only posted Created for FX instances, so we only need to close those.
      // Since Terminated doesn't carry the type URN independently, we emit the
      // advisory zero-amount close for all terminations at Phase 3A scope.
      legs = postFxClose(
        event as FilInstrumentTerminatedPayload,
        args.actor,
        args.entity,
        CITATIONS,
      );
      processed.terminated++;
    }

    for (const leg of legs) {
      args.eventStore.append(leg);
      emitted++;
    }
  }

  return { emitted, processed };
}
