// dashboard/v2-markets-fx-trade-impact-view.ts
//
// PER-TRADE BA-RETURN IMPACT DRILL-THROUGH (`/api/v2/markets/fx/trade-impact`).
//
// Marc (CEO, D-FX-E2E-CORRECTNESS-V1): "the impact of a trade on the various BA
// returns (BS, OBS, P&L, etc.) must be viewable correctly." This module answers
// the question "what does THIS FX trade do to the returns?" for a single FIL FX
// instance, by REVERSE-ATTRIBUTING from the canonical event-sourced folds — never
// by guessing a number.
//
// THE REVERSE-ATTRIBUTION PATH (provable, not invented):
//   1. GL entries. Every FX GL leg carries `sourceEventId === <instance URN>`
//      (gl-projection-v2 `computeGlEntriesV2`, FX legs derived by
//      `deriveFxInstanceLegs`; verified against the live store). So the trade's
//      ledger footprint is EXACTLY the GL entries whose `sourceEventId` is the
//      instance — the on-balance-sheet derivative legs (BA-100), the off-balance
//      OBS memorandum commitment legs (ACC-9100-*, BA-110), and the P&L legs
//      (BA-120). The account CATEGORY (from the COA) buckets each leg onto its
//      return — sourced, not hardcoded.
//   2. BA-320 net-open-position. The fold sums each open FX instance's SIGNED
//      contribution: +notional (long = commitment to PURCHASE the foreign leg)
//      or −notional (short = sell). The 8% open-position charge is on
//      max(Σ|long|, Σ|short|) (Reg 28(5) / Reg 38). A single trade's clean,
//      non-overlapping contribution is its SIGNED NOP slice; the charge + RWA are
//      book-level (max of two sums), so we surface the trade's NOP contribution
//      and state the book-level relationship honestly rather than fabricate a
//      per-trade charge.
//   3. BA-325 reg-29(3) residency cell. The trade's CELL is
//      (residency-bucket × currency-column × purchase|sell), from the SAME
//      counterparty-residency oracle the fold uses + the SAME currency-column map.
//      An UNMAPPABLE counterparty is surfaced loudly (the trade would drop out of
//      BA-325) — fail-closed, never silently bucketed (Engineering Charter cmd 2).
//   4. BA-350 SA-CCR derivatives grid. The trade's CELL is (asset-class fx ×
//      hedging-set = pair); its effective notional is stated. The EAD add-on is a
//      NETTING-SET-level figure (SA-CCR nets within hedging sets), NOT a clean
//      per-trade number, so we surface the cell coordinate + notional and link to
//      the full BA-350 return rather than invent a per-trade EAD (Charter cmd 2).
//   5. BA-700 capital. Market RWA = 12.5 × the FULL BA-320 standardised charge
//      (ba700-v2 `RWA_PER_CAPITAL_CHARGE`). The trade contributes through its
//      BA-320 NOP slice; stated as derived-from-BA-320, book-level.
//
// PROVENANCE LENS: the impact reads under the supplied provenance filter (the
// established prod+sim lens), never widening to build-phase-fixture (the
// R300m-into-Prod anti-pattern).
//
// NAME-FREE (feedback_no_agent_names_in_ui): no agent/persona names. Counterparty
// LEGAL names ARE surfaced (the policy is about AGENT names, not counterparties).
//
// Authority: D-FX-E2E-CORRECTNESS-V1; D-BA-RETURN-PER-PRODUCT-RICHNESS;
//   Regulations Relating to Banks reg 28(5) / reg 29(3) / reg 38; SARB Currency &
//   Exchanges Manual §A.1/§A.2; D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Noa (Intranet Product Owner & UI Architect, ui/platform).

import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import {
  BA325_RESIDENCY_BUCKET_LABEL,
  type Ba325ResidencyBucket,
  buildResidencyOracle,
} from "../platform/markets/fx/counterparty-residency";
import { type ProvenanceFilter, defaultProvenanceFilter } from "../platform/projections/filter";
import { type GlLedgerEntryV2, computeGlEntriesV2 } from "../platform/projections/gl-projection-v2";
import {
  V2_ANCHOR_ENTITY,
  V2_PERIOD_END,
  V2_PERIOD_START,
} from "../platform/projections/v2-read-window";
import {
  BA325_CURRENCY_COLUMN,
  type Ba325Currency,
  toBa325Currency,
} from "../platform/reporting/ba-325-reg29-fx-residency-fold";
import { type FilInstanceRow, foldFilInstances } from "../v2-core/fil-instances";

// ---------------------------------------------------------------------------
// Canonical scalars — SOURCED (Engineering Charter cmd 4), not magic numbers.
// ---------------------------------------------------------------------------

/** Reg 28(5) / Reg 38 FX net-open-position capital charge: 8% of the greater side. */
const FX_OPEN_POSITION_CHARGE_RATE = 0.08;
/** Basel III / Reg 38 RWA-per-capital-charge scalar: RWA = 12.5 × capital charge. */
const RWA_PER_CAPITAL_CHARGE = 12.5;
/** The OBS memorandum-commitment account prefix (D-FX-TRADE-DATE-FVTPL-OBS). */
const FX_OBS_ACCOUNT_PREFIX = "ACC-9100-";

// ---------------------------------------------------------------------------
// DTOs.
// ---------------------------------------------------------------------------

/** One GL ledger leg attributed to the trade (name-free, decimal-major money). */
export interface FxTradeGlLeg {
  readonly accountId: string;
  readonly accountName: string;
  readonly accountCategory: string;
  readonly debitCredit: "debit" | "credit";
  readonly amount: string;
  readonly currency: string;
  readonly postedAt: string;
  readonly description: string;
  readonly postingRuleId: string | null;
  /** Which BA return this leg sits on (on-BS=BA-100, OBS=BA-110, P&L=BA-120). */
  readonly returnBucket: "BA-100" | "BA-110" | "BA-120" | "other";
}

/** One BA-return impact line — the trade's contribution to that return. */
export interface FxTradeReturnImpact {
  /** SARB form code (e.g. "BA 320"). */
  readonly form: string;
  /** Plain-language return name. */
  readonly title: string;
  /** The specific cell / line this trade lands on. */
  readonly cell: string;
  /**
   * The trade's contribution figure (decimal-major string + ccy), or null when
   * the figure is not a clean per-trade decomposition (then `note` explains why).
   */
  readonly contribution: { amount: string; currency: string } | null;
  /** How the contribution was derived (Principle 2 lineage) / honesty note. */
  readonly note: string;
  /** Link to the full return detail page. */
  readonly returnHref: string;
}

export interface V2FxTradeImpactView {
  /** "found" | "not-found" | "not-fx" — honest resolution state. */
  readonly state: "found" | "not-found" | "not-fx";
  readonly reason: string | null;
  readonly instance: string;
  readonly tradeId: string;
  readonly economicTerms: {
    readonly type: string;
    readonly pair: string;
    readonly direction: "long" | "short";
    readonly notional: { amount: string; currency: string };
    readonly counterpartyId: string;
    readonly counterpartyName: string | null;
    readonly counterpartyJurisdiction: string | null;
    readonly counterpartySector: string | null;
    readonly nettingSetId: string;
    readonly settlementDate: string;
    readonly tradeDate: string | null;
    readonly stage: string;
    readonly residencyBucket: Ba325ResidencyBucket | null;
    readonly residencyLabel: string | null;
    readonly residencyUnmapped: boolean;
    readonly residencyReason: string | null;
  } | null;
  /** The trade's GL footprint (entries whose sourceEventId === instance). */
  readonly glLegs: readonly FxTradeGlLeg[];
  /** Per-return impact decomposition. */
  readonly returnImpacts: readonly FxTradeReturnImpact[];
  readonly asOf: string;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function readTradeDate(terms: unknown): string | null {
  if (typeof terms !== "object" || terms === null) return null;
  const v = (terms as Record<string, unknown>).tradeDate;
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Bucket a GL leg onto the BA return its account category implies:
 *   - OBS memorandum account (ACC-9100-*) → BA-110 (off-balance-sheet notional).
 *   - revenue / expense category           → BA-120 (P&L).
 *   - asset / liability / equity category  → BA-100 (on-balance-sheet).
 * Sourced from the COA account category carried on the entry — not hardcoded.
 */
function glReturnBucket(entry: GlLedgerEntryV2): FxTradeGlLeg["returnBucket"] {
  if (entry.accountId.startsWith(FX_OBS_ACCOUNT_PREFIX)) return "BA-110";
  const cat = entry.accountCategory.toLowerCase();
  if (cat.includes("revenue") || cat.includes("income") || cat.includes("expense")) return "BA-120";
  if (cat.includes("asset") || cat.includes("liabilit") || cat.includes("equity")) {
    return "BA-100";
  }
  return "other";
}

/** Net debit-minus-credit magnitude for a bucket of legs, in their (single) ccy. */
function netBucketMajor(
  legs: readonly FxTradeGlLeg[],
): { amount: string; currency: string } | null {
  const byCcy = new Map<string, number>();
  for (const l of legs) {
    const signed = l.debitCredit === "debit" ? Number(l.amount) : -Number(l.amount);
    byCcy.set(l.currency, (byCcy.get(l.currency) ?? 0) + signed);
  }
  // Report the dominant currency leg (FX legs are per-currency; the on-BS net is
  // carried in the position currency). When a single currency, that one.
  let pick: { amount: string; currency: string } | null = null;
  let max = -1;
  for (const [ccy, amt] of byCcy) {
    if (Math.abs(amt) > max) {
      max = Math.abs(amt);
      pick = { amount: amt.toFixed(2), currency: ccy };
    }
  }
  return pick;
}

/**
 * GROSS commitment magnitude for a bucket of legs (the larger debit-or-credit
 * side per currency, then the dominant currency). BA-110 reports the OBS
 * commitment NOTIONAL — which is the gross commitment, not the net of the
 * balancing double-entry legs (the OBS memorandum legs net to zero by design).
 */
function grossBucketMajor(
  legs: readonly FxTradeGlLeg[],
): { amount: string; currency: string } | null {
  const byCcy = new Map<string, { dr: number; cr: number }>();
  for (const l of legs) {
    const t = byCcy.get(l.currency) ?? { dr: 0, cr: 0 };
    if (l.debitCredit === "debit") t.dr += Number(l.amount);
    else t.cr += Number(l.amount);
    byCcy.set(l.currency, t);
  }
  let pick: { amount: string; currency: string } | null = null;
  let max = -1;
  for (const [ccy, t] of byCcy) {
    const gross = Math.max(t.dr, t.cr);
    if (gross > max) {
      max = gross;
      pick = { amount: gross.toFixed(2), currency: ccy };
    }
  }
  return pick;
}

/**
 * Link to the full return detail page. `formKey` is the CANONICAL no-space form
 * id from the return-contract registry (e.g. "BA320") — the key `return.html`
 * resolves against; the display `form` label ("BA 320") is separate.
 */
const returnHref = (formKey: string): string =>
  `/v2/finance/return.html?form=${encodeURIComponent(formKey)}`;

// ---------------------------------------------------------------------------
// Builder.
// ---------------------------------------------------------------------------

export interface BuildV2FxTradeImpactArgs {
  readonly eventStore: EventStore;
  readonly instance: string;
  readonly nowIso: string;
  readonly filter?: ProvenanceFilter;
}

export function buildV2FxTradeImpactView(args: BuildV2FxTradeImpactArgs): V2FxTradeImpactView {
  const { eventStore, instance, nowIso } = args;
  const filter = args.filter ?? defaultProvenanceFilter();
  const empty = (state: "not-found" | "not-fx", reason: string): V2FxTradeImpactView => ({
    state,
    reason,
    instance,
    tradeId: instance.split(":").pop() ?? instance,
    economicTerms: null,
    glLegs: [],
    returnImpacts: [],
    asOf: nowIso,
  });

  // Fold the FIL register and resolve the instance (all stages, not only live —
  // a settled / terminated trade still has a return footprint).
  const events: unknown[] = [];
  for (const type of [
    "FilInstrumentCreated",
    "FilInstrumentAmended",
    "FilInstrumentTerminated",
  ] as const) {
    try {
      for (const e of eventStore.replay({ type })) events.push(e.payload);
    } catch {
      // Family not registered — fold what we have.
    }
  }
  const register = foldFilInstances(events as never);
  const row: FilInstanceRow | undefined = register.get(instance as never);
  if (!row) {
    return empty(
      "not-found",
      `Instance '${instance}' is not in the FIL register on this store under this lens.`,
    );
  }
  if (row.economicTerms.assetClass !== "fx") {
    return empty(
      "not-fx",
      `Instance '${instance}' is asset-class '${row.economicTerms.assetClass}', not 'fx'. The FX trade-impact drill serves FX instances only.`,
    );
  }

  const t = row.economicTerms;
  const oracle = buildResidencyOracle(eventStore);
  const detail = oracle.classifyDetail(t.counterpartyId);
  const classified = detail.residency.classified ? detail.residency : null;
  const pair = t.hedgingSetTag ?? `${t.currency}/${anchorFunctionalCurrency()}`;

  // --- GL footprint: entries whose sourceEventId === this instance. ---
  const allEntries = computeGlEntriesV2({
    eventStore,
    entity: V2_ANCHOR_ENTITY,
    periodStart: V2_PERIOD_START,
    periodEnd: V2_PERIOD_END,
    filter,
  });
  const glLegs: FxTradeGlLeg[] = allEntries
    .filter((e) => e.sourceEventId === instance)
    .map((e) => ({
      accountId: e.accountId,
      accountName: e.accountName,
      accountCategory: e.accountCategory,
      debitCredit: e.debitCredit,
      amount: e.amount.amount,
      currency: e.currency,
      postedAt: e.postedAt,
      description: e.description,
      postingRuleId: e.postingRuleId ?? null,
      returnBucket: glReturnBucket(e),
    }));

  const onBs = glLegs.filter((l) => l.returnBucket === "BA-100");
  const obs = glLegs.filter((l) => l.returnBucket === "BA-110");
  const pnl = glLegs.filter((l) => l.returnBucket === "BA-120");

  // --- BA-320 signed NOP contribution + book-level charge/RWA relationship. ---
  const baseCcy = pair.split("/")[0] ?? t.currency;
  const signedNop = t.direction === "long" ? Number(t.notional.amount) : -Number(t.notional.amount);
  const chargeBasis = Math.abs(signedNop) * FX_OPEN_POSITION_CHARGE_RATE;

  // --- BA-325 cell coordinate. ---
  const ba325Ccy: Ba325Currency = toBa325Currency(baseCcy);
  const commitment = t.direction === "long" ? "purchase" : "sell";

  const returnImpacts: FxTradeReturnImpact[] = [
    {
      form: "BA 100",
      title: "Balance sheet — on-balance-sheet fair value",
      cell: "FX derivative position (FVTPL)",
      contribution: netBucketMajor(onBs),
      note:
        onBs.length > 0
          ? "Net of this trade's on-balance-sheet GL legs (FVTPL derivative carrying value). Derived from the trade's own ledger footprint (sourceEventId = instance)."
          : "This trade has no on-balance-sheet GL legs in the read window (an at-market forward recognises OBS-only at trade date; the on-BS position appears on revaluation/settlement).",
      returnHref: returnHref("BA100"),
    },
    {
      form: "BA 110",
      title: "Off-balance-sheet activities — commitment notional",
      cell: "FX forward/spot commitment (memorandum)",
      contribution: grossBucketMajor(obs),
      note:
        obs.length > 0
          ? "Gross OBS memorandum commitment notional (ACC-9100-*). The trade-date off-balance-sheet commitment, released on settlement/maturity. (The balancing memorandum double-entry nets to zero by design; BA-110 reports the gross commitment.)"
          : "No OBS memorandum legs in the read window (released on settlement/maturity, or out of window).",
      returnHref: returnHref("BA110"),
    },
    {
      form: "BA 120",
      title: "Income statement — trading P&L",
      cell: "FX trading revenue (unrealised + realised)",
      contribution: netBucketMajor(pnl),
      note:
        pnl.length > 0
          ? "Net of this trade's P&L GL legs (revenue/expense category). Negative = a debit-net loss; positive = a credit-net gain."
          : "No P&L legs in the read window (an at-market trade with no revaluation booked yet contributes no P&L).",
      returnHref: returnHref("BA120"),
    },
    {
      form: "BA 320",
      title: "Market risk — FX net open position (Reg 28(5))",
      cell: `${baseCcy} net-open-position (${t.direction === "long" ? "+long" : "−short"})`,
      contribution: { amount: signedNop.toFixed(2), currency: baseCcy },
      note:
        `Signed NOP contribution: ${t.direction} ⇒ ${t.direction === "long" ? "+" : "−"}notional in ${baseCcy}. ` +
        `The 8% open-position charge is on max(Σ|long|, Σ|short|) across the book (Reg 28(5)); this trade's stand-alone charge basis is ${chargeBasis.toFixed(2)} ${baseCcy} (8% × |notional|), but the book charge is the greater-side max, not a per-trade sum.`,
      returnHref: returnHref("BA320"),
    },
    {
      form: "BA 325",
      title: "Reg 29(3) — foreign-currency residency-segmented detail",
      cell: classified
        ? `${BA325_RESIDENCY_BUCKET_LABEL[classified.bucket]} × ${ba325Ccy.toUpperCase()} (${BA325_CURRENCY_COLUMN[ba325Ccy]}) · commitment to ${commitment}`
        : "UNMAPPED — would drop out of BA-325",
      contribution: classified
        ? { amount: Number(t.notional.amount).toFixed(2), currency: t.notional.currency }
        : null,
      note: classified
        ? `Residency: ${classified.lineage}. A ${t.direction} FX position is a commitment to ${commitment} foreign currency (${commitment === "purchase" ? "R0620 against rand" : "R0690 against rand"} block).`
        : `FAIL-CLOSED: ${detail.residency.classified ? "" : detail.residency.reason} This trade would NOT fold into the BA-325 reg-29(3) residency detail until its counterparty is classifiable.`,
      returnHref: returnHref("BA325"),
    },
    {
      form: "BA 350",
      title: "Derivative instruments — SA-CCR counterparty-credit grid",
      cell: `asset-class FX · hedging set ${pair}`,
      contribution: { amount: Number(t.notional.amount).toFixed(2), currency: t.notional.currency },
      note: "The trade's effective notional and hedging-set cell. The SA-CCR EAD add-on is computed at the NETTING-SET level (SA-CCR nets within hedging sets), so a faithful per-trade EAD is not a clean decomposition — see the full BA-350 return for the netting-set EAD this trade participates in.",
      returnHref: returnHref("BA350"),
    },
    {
      form: "BA 700",
      title: "Capital adequacy — market-risk RWA contribution",
      cell: "Market RWA (12.5 × FX open-position charge)",
      contribution: {
        amount: (chargeBasis * RWA_PER_CAPITAL_CHARGE).toFixed(2),
        currency: baseCcy,
      },
      note: `Market RWA = 12.5 × the BA-320 standardised FX charge (Reg 38 / Basel III). 12.5 × 8% = 1.0, so this trade's stand-alone RWA basis equals its |notional| (${Math.abs(signedNop).toFixed(2)} ${baseCcy}). The book RWA derives from the greater-side max charge, so this is an indicative per-trade slice, not an additive book total.`,
      returnHref: returnHref("BA700"),
    },
  ];

  return {
    state: "found",
    reason: null,
    instance,
    tradeId: instance.split(":").pop() ?? instance,
    economicTerms: {
      type: row.type,
      pair,
      direction: t.direction,
      notional: { amount: t.notional.amount, currency: t.notional.currency },
      counterpartyId: t.counterpartyId,
      counterpartyName: detail.legalName,
      counterpartyJurisdiction: detail.jurisdiction,
      counterpartySector: detail.sector,
      nettingSetId: t.nettingSetId,
      settlementDate: t.settlementDate,
      tradeDate: readTradeDate(t),
      stage: row.stage,
      residencyBucket: classified ? classified.bucket : null,
      residencyLabel: classified ? BA325_RESIDENCY_BUCKET_LABEL[classified.bucket] : null,
      residencyUnmapped: !detail.residency.classified,
      residencyReason: detail.residency.classified ? null : detail.residency.reason,
    },
    glLegs,
    returnImpacts,
    asOf: nowIso,
  };
}
