// platform/accounting/gl-posting-engine-v2-capital.ts
//
// WS-V2-AUTHORITATIVE S7 — V2 GL posting handler for the regulatory-capital
// stack. Runs DUAL-PARALLEL to the V1 capital path, exactly like the FX V2
// engine (gl-posting-engine-v2.ts), the Phase 3b money-market V2 engine
// (gl-posting-engine-v2-mm.ts), and the Phase 3c bond V2 engine
// (gl-posting-engine-v2-bond.ts); all share the GlPostingEmitted output shape
// + provenance convention.
//
// THE GAP THIS CLOSES: `platform/projections/ba700-v2.ts` folds
// `GlPostingEmitted` into the capital-classified COA accounts (ACC-5000-001/002
// CET1, ACC-5200-001/002 T2) to form the BA-700 capital numerator. But NO V2 GL
// posting rule wrote to those accounts — only FX / money-market / bond rules
// existed — so the V2 numerator was structurally zero on every store. V1 derives
// its numerator (`platform/reporting/ba-700-events-adapter.ts` →
// `foldCapitalAccountBalances`) by folding `CapitalContributionRecorded` (and
// `SubLedgerPostingEmitted` capital-injection legs) as a CREDIT to the capital
// account. This handler emits the V2-parallel `GlPostingEmitted` for the same
// capital accounts, mirroring V1's debit/credit convention so the V2 fold
// becomes non-zero on a populated store and the parity gate is non-vacuous.
//
// TRIGGER: `CapitalContributionRecorded` — the V1 primary capital-injection
// event. Its payload is `{ accountId, currency, amountMinor, basis }`. It is
// `*Minor`-encoded (a minor-unit integer) and carries NO tenantId (it is a V1
// event). This handler converts the minor integer to decimal-native MoneyWire
// via the shared `moneyWireFromMinor` codec (exact — the source is already an
// integer, no float is introduced) and stamps the anchor tenantId on the V2
// posting. It is currency-agnostic by construction: the leg amount carries the
// contribution's own currency — there is NO hardcoded ZAR (WS-MULTI-BASE-CURRENCY,
// Engineering Charter cmd 4 — source, don't hardcode).
//
// POSTING RULE (S7 scope) — account codes + leg footprint MIRROR V1's capital
// fold so the V1↔V2 parity gate byte-matches per account:
//   PR-CAP-001-V2   CapitalContributionRecorded → capital recognition.
//                     Dr Settlement Cash (ACC-1200-001) — asset increases.
//                     Cr Capital account (the contribution's COA capital account,
//                        e.g. ACC-5000-001 Share Capital) — equity increases.
//
// SIGN CONVENTION: V1's `foldCapitalAccountBalances` treats a
// `CapitalContributionRecorded` as a CREDIT to its `accountId` (capital is
// credit-side; the BA-700 generator takes the absolute magnitude for the gross
// stock). This handler credits the SAME account, so the capital-account net
// balance the two folds derive is identical. The ba700-v2 capital fold then
// reads the V2 credit and reports the same tier1/tier2 stock as V1.
//
// CAPITAL-ACCOUNT GUARD (fail-closed visibility, Charter cmd 2 + cmd 5): a
// contribution whose target `accountId` is NOT a recognised COA capital account
// still posts a balanced DR/CR pair (the economic event happened and must not be
// silently dropped), but the BA-700 capital fold — V1 and V2 alike — only sums
// the capital-classified subset, so an off-capital contribution affects neither
// numerator. The dispatch is exhaustive over the one S7 trigger; no
// CapitalContributionRecorded is silently ignored.
//
// DOUBLE-ENTRY: the handler returns BALANCED legs (Σdebit == Σcredit in the
// contribution currency). A zero-amount contribution emits NO posting (mirrors
// the V1 non-zero-delta skip) — fabricating a zero leg adds no signal and the
// fold is unchanged.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//            D-V1-REMOVAL-PHASE-3A (GlPostingEmitted; v2-parallel);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 38;
//            BCBS Basel III §50–§90; IAS 32; IFRS 9 §3.1.1.
// Author: Atlas (Core banking platform architect, engineering).

import type { TenantId } from "../../v2-core/control-plane/tenant";
import { isZero } from "../core/decimal-money";
import { type MoneyWire, decodeMoney, moneyWireFromMinor } from "../core/money-codec";
import { newEventId } from "../core/types";
import {
  type GlPostingEmittedPayload,
  makeGlPostingEmitted,
} from "../event-store/event-types/fx-accounting";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { coaToCapitalClassifications } from "./coa-registry";

// ---------------------------------------------------------------------------
// COA accounts — MIRROR the V1 capital fold (ba-700-events-adapter.ts) +
// the simulated capital-injection posting (scripts/emit-capital-injection-sim.ts:
// Dr ACC-1200-001 / Cr ACC-5000-001). Currency-agnostic: the leg amount carries
// its own currency on the MoneyWire.
// ---------------------------------------------------------------------------

const ACC = {
  /** Settlement-cash / nostro leg of a capital injection (the funding side). */
  settlementCash: "ACC-1200-001",
} as const;

const CITATIONS = [
  "Banks-Act-94-1990-s70",
  "RRB-Regulation-38",
  "BCBS-Basel-III-§50-§90",
  "IAS-32",
  "IFRS-9-§3.1.1",
  "D-V1-REMOVAL-PHASE-3A",
  "D-BANK-WIDE-V2-MIGRATION",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

/** The recognised COA capital account set (CET1 + AT1 + T2), sourced from the COA. */
function capitalAccountIds(): ReadonlySet<string> {
  return new Set(coaToCapitalClassifications().map((c) => c.leafAccountId));
}

// ---------------------------------------------------------------------------
// V1 trigger payload — only the fields this handler folds on.
// ---------------------------------------------------------------------------

/**
 * V1 `CapitalContributionRecorded` payload shape (minor-encoded). Confirmed
 * against the rehearsal scenario factory (scenarios/03-fx-end-to-end-rehearsal.ts
 * `makeCapitalContributionPlaceholder`) and the V1 fold
 * (ba-700-events-adapter.ts `foldCapitalAccountBalances`).
 */
interface CapitalContributionRecordedPayload {
  /** The COA account the contribution credits (e.g. "ACC-5000-001" Share Capital). */
  readonly accountId?: string;
  /** ISO 4217 currency of the contribution. */
  readonly currency?: string;
  /** Contribution amount in MINOR units (integer). */
  readonly amountMinor?: number;
  /** Free-text basis (e.g. "founding capital — ordinary share issuance"). */
  readonly basis?: string;
}

// ---------------------------------------------------------------------------
// Leg factory — one balanced DR or CR GlPostingEmitted event.
// ---------------------------------------------------------------------------

interface LegArgs {
  readonly creditDebit: "debit" | "credit";
  readonly accountCode: string;
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  readonly actor: Actor;
  readonly entity: string;
}

function makeLeg(a: LegArgs): Event {
  const payload: GlPostingEmittedPayload = {
    creditDebit: a.creditDebit,
    accountCode: a.accountCode,
    amount: a.amount,
    postingDate: a.postingDate,
    tenantId: a.tenantId,
    sourceEventId: a.sourceEventId,
    iasRule: a.iasRule,
    postingRuleId: a.postingRuleId,
    description: a.description,
  };
  return makeGlPostingEmitted({
    asOf: a.postingDate,
    entity: a.entity,
    actor: a.actor,
    citations: CITATIONS,
    payload,
    eventId: newEventId(),
  });
}

function isoDate(asOf: string): string {
  return asOf.substring(0, 10);
}

// ---------------------------------------------------------------------------
// PR-CAP-001-V2 — CapitalContributionRecorded → capital recognition.
//   Dr Settlement Cash (ACC-1200-001) / Cr Capital account (contribution's COA).
// ---------------------------------------------------------------------------

function postCapitalContribution(
  p: CapitalContributionRecordedPayload,
  ctx: { readonly actor: Actor; readonly entity: string; readonly asOf: string },
  tenantId: TenantId,
  sourceEventId: string,
): Event[] {
  const accountId = p.accountId;
  const currency = p.currency;
  const amountMinor = p.amountMinor;
  // Fail-closed visibility: an ill-formed contribution (missing account /
  // currency / amount) emits no posting rather than fabricating a leg with a
  // guessed currency or account (Charter cmd 2 + cmd 4). The recon gate folds
  // the recorded population, so a dropped malformed event is observable there.
  if (!accountId || !currency || amountMinor === undefined) return [];

  // Decimal-native MoneyWire from the minor-unit integer (exact — the source is
  // already an integer; the codec introduces no float). Currency carried on the
  // wire — NO hardcoded ZAR (WS-MULTI-BASE-CURRENCY, Charter cmd 4).
  const amount = moneyWireFromMinor(amountMinor, currency);
  if (isZero(decodeMoney(amount))) return [];

  const ctxLeg = {
    postingDate: isoDate(ctx.asOf),
    tenantId,
    sourceEventId,
    iasRule:
      "IAS 32 / IFRS 9 §3.1.1 — recognition of a regulatory-capital contribution " +
      "(equity / qualifying-instrument credit; funded against settlement cash)",
    postingRuleId: "PR-CAP-001-V2",
    description: `Capital contribution recognition ${currency}${p.basis ? ` (${p.basis})` : ""} (V2)`,
    actor: ctx.actor,
    entity: ctx.entity,
  };

  // Dr settlement cash (asset ↑) / Cr capital account (equity ↑). The credit
  // hits the contribution's COA capital account — the SAME account V1's fold
  // credits — so the V1 and V2 capital-account balances byte-match.
  return [
    makeLeg({ ...ctxLeg, creditDebit: "debit", accountCode: ACC.settlementCash, amount }),
    makeLeg({ ...ctxLeg, creditDebit: "credit", accountCode: accountId, amount }),
  ];
}

// ---------------------------------------------------------------------------
// Engine entry point — process CapitalContributionRecorded events and emit
// balanced GlPostingEmitted legs.
// ---------------------------------------------------------------------------

export interface GlV2CapitalEngineArgs {
  /** Event store: read CapitalContributionRecorded events from + emit postings into. */
  readonly eventStore: EventStore;
  /** Actor to attribute postings to. */
  readonly actor: Actor;
  /** Legal entity the postings belong to. */
  readonly entity: string;
  /** Anchor tenant axis stamped on the V2 postings. */
  readonly tenantId: TenantId;
  /** ISO-8601 as-of bound — only process events at or before this date. */
  readonly asOf?: string;
}

export interface GlV2CapitalEngineResult {
  /** Number of GlPostingEmitted legs appended. */
  readonly emitted: number;
  /** Number of CapitalContributionRecorded events processed. */
  readonly processed: number;
  /**
   * Number of processed contributions whose credit leg hit a recognised COA
   * capital account (ACC-5000-xxx / ACC-5200-xxx) — i.e. those that move the BA-700
   * capital numerator. Off-capital contributions are posted but excluded here,
   * mirroring the V1/V2 capital fold's classified-subset restriction.
   */
  readonly capitalClassified: number;
}

/**
 * Process the V1-primary `CapitalContributionRecorded` events and emit balanced
 * `GlPostingEmitted` legs to the capital accounts. DUAL-RUN parallel to V1 (the
 * V1 fold reads CapitalContributionRecorded directly; this emits the V2 GL
 * postings co-existing with V1). The handler dispatch is exhaustive over the one
 * S7 trigger; no CapitalContributionRecorded is silently dropped (fail-closed
 * visibility, Charter cmd 2 + cmd 5).
 *
 * NOTE: this is a pure emitter over the event store. It does NOT itself guard
 * idempotency — the ci:migrate backfill (scripts/backfill-capital-gl-v2-dual-run.ts)
 * keys idempotency on the source event id (INSERT OR IGNORE semantics). Calling
 * this directly twice would double-post; production wiring goes through the
 * backfill's idempotency scan.
 */
export function runGlV2CapitalEngine(args: GlV2CapitalEngineArgs): GlV2CapitalEngineResult {
  const { eventStore, actor, entity, tenantId, asOf } = args;
  const capitalAccounts = capitalAccountIds();
  let emitted = 0;
  let processed = 0;
  let capitalClassified = 0;

  for (const event of eventStore.replay(asOf ? { entity, asOf } : { entity })) {
    if (event.type !== "CapitalContributionRecorded") continue;
    processed++;
    const payload = event.payload as CapitalContributionRecordedPayload;
    const legs = postCapitalContribution(
      payload,
      { actor, entity, asOf: event.as_of },
      tenantId,
      event.event_id,
    );
    if (legs.length > 0 && payload.accountId && capitalAccounts.has(payload.accountId)) {
      capitalClassified++;
    }
    for (const leg of legs) {
      eventStore.append(leg);
      emitted++;
    }
  }

  return { emitted, processed, capitalClassified };
}
