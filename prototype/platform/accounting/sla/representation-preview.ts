// platform/accounting/sla/representation-preview.ts
//
// Side-by-side parallel-representation PREVIEW (Phase-0 spec §9.2 / §2.2 — the
// parallel-basis fan-out demonstration). DRY-RUN / READ-ONLY.
//
// Given a single FX-lifecycle source event, this builds the proposed journal for
// EVERY active representation side by side — for Phase 4a, the IFRS primary book
// AND the SARB-BA-RETURN regulatory NOP memorandum — each with its rule id /
// version, resolved accounts, per-currency balance, and obligation citations.
//
// This is the auditor / CFO inspection point that PROVES the fan-out works: one
// `FxTradeExecuted` event yields two independently-balanced `ProposedPosting`s.
//
// ─── PURITY + SAFETY ────────────────────────────────────────────────────────
// This module is PURE: it calls the pure `interpret(...)` and reshapes the
// result. It emits NOTHING, reads no store, and is NEVER on the production
// posting path — the production GL engine evaluates the IFRS representation only
// (`bea-gl-fx-interpreter-cutover.ts` → `interpret(..., ["IFRS"], ...)`). This
// preview is the ONLY place that evaluates `["IFRS", "SARB-BA-RETURN"]` together,
// and it only ever PROPOSES — it does not post.
//
// Additivity (spec §2.2): the IFRS ProposedPosting this returns is byte-for-byte
// identical to interpreting IFRS alone — proven in the test
// (tests/sla-representation-fanout.test.ts). Adding SARB changes nothing about
// IFRS.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4, CEO-approved 2026-06-06);
//            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille).

import {
  type InterpretOptions,
  type InterpretResult,
  type InterpreterEvent,
  interpret,
} from "./interpreter";
import { FX_ALL_REPRESENTATION_RULES } from "./rules";

/** The two representations the Phase-4a preview fans out over. */
export const PREVIEW_REPRESENTATIONS: readonly string[] = ["IFRS", "SARB-BA-RETURN"];

export interface PreviewLeg {
  readonly accountId: string;
  readonly debitCredit: "debit" | "credit";
  readonly amountMinor: string;
  readonly currency: string;
}

/** Per-currency DR/CR totals + the net (zero iff balanced) for one representation. */
export interface CurrencyBalance {
  readonly currency: string;
  readonly debitMinor: string;
  readonly creditMinor: string;
  readonly netMinor: string;
  readonly balanced: boolean;
}

/** One representation's slice of the side-by-side preview. */
export interface RepresentationPreview {
  readonly representation: string;
  readonly outcome: InterpretResult["outcome"];
  readonly ruleId?: string;
  readonly ruleVersion?: number;
  readonly legs: readonly PreviewLeg[];
  readonly perCurrencyBalance: readonly CurrencyBalance[];
  /** True iff every currency balances (DR == CR). Vacuously true for no legs. */
  readonly balanced: boolean;
  readonly cites: readonly string[];
  /** Suspense-routing alert ids (non-empty → balanced-but-loud). */
  readonly urgentCorrectionAlertIds: readonly string[];
  /** Detail for non-posting outcomes (rejected / ambiguous / intentional-no-impact). */
  readonly detail?: string;
}

export interface RepresentationPreviewResult {
  readonly eventType: string;
  readonly entity: string;
  readonly asOf: string;
  readonly representations: readonly RepresentationPreview[];
}

function perCurrencyBalances(legs: readonly PreviewLeg[]): CurrencyBalance[] {
  const dr = new Map<string, bigint>();
  const cr = new Map<string, bigint>();
  for (const leg of legs) {
    const amt = BigInt(leg.amountMinor);
    const target = leg.debitCredit === "debit" ? dr : cr;
    target.set(leg.currency, (target.get(leg.currency) ?? 0n) + amt);
  }
  const currencies = new Set<string>([...dr.keys(), ...cr.keys()]);
  return [...currencies].sort().map((currency) => {
    const debit = dr.get(currency) ?? 0n;
    const credit = cr.get(currency) ?? 0n;
    const net = debit - credit;
    return {
      currency,
      debitMinor: debit.toString(),
      creditMinor: credit.toString(),
      netMinor: net.toString(),
      balanced: net === 0n,
    };
  });
}

function toPreview(result: InterpretResult): RepresentationPreview {
  if (result.outcome === "post") {
    const legs: PreviewLeg[] = result.legs.map((l) => ({
      accountId: l.accountId,
      debitCredit: l.debitCredit,
      amountMinor: l.amountMinor,
      currency: l.currency,
    }));
    const perCurrencyBalance = perCurrencyBalances(legs);
    return {
      representation: result.representation,
      outcome: "post",
      ruleId: result.ruleId,
      ruleVersion: result.ruleVersion,
      legs,
      perCurrencyBalance,
      balanced: perCurrencyBalance.every((b) => b.balanced),
      cites: result.cites,
      urgentCorrectionAlertIds: result.urgentCorrections.map((c) => c.alertId),
    };
  }

  if (result.outcome === "intentional-no-impact") {
    return {
      representation: result.representation,
      outcome: "intentional-no-impact",
      ruleId: result.ruleId,
      legs: [],
      perCurrencyBalance: [],
      balanced: true,
      cites: [],
      urgentCorrectionAlertIds: [],
      detail: result.detail,
    };
  }

  if (result.outcome === "ambiguous") {
    return {
      representation: result.representation,
      outcome: "ambiguous",
      legs: [],
      perCurrencyBalance: [],
      balanced: false,
      cites: [],
      urgentCorrectionAlertIds: [],
      detail: `${result.detail} — candidates: ${result.candidateRuleIds.join(", ")}`,
    };
  }

  // rejected
  return {
    representation: result.representation,
    outcome: "rejected",
    legs: [],
    perCurrencyBalance: [],
    balanced: false,
    cites: [],
    urgentCorrectionAlertIds: [],
    detail: `${result.reason}: ${result.detail}`,
  };
}

/**
 * Build the side-by-side preview for one event across IFRS + SARB-BA-RETURN.
 * PURE + DRY-RUN: proposes only, emits nothing. The order of `representations`
 * in the result follows `PREVIEW_REPRESENTATIONS` (IFRS first).
 */
export function buildRepresentationPreview(
  event: InterpreterEvent,
  asOf: string,
  options: InterpretOptions = {},
): RepresentationPreviewResult {
  const results = interpret(
    event,
    FX_ALL_REPRESENTATION_RULES,
    PREVIEW_REPRESENTATIONS,
    asOf,
    options,
  );

  const representations = PREVIEW_REPRESENTATIONS.map((rep) => {
    const r = results.find((x) => x.representation === rep);
    if (!r) {
      // Should not happen — interpret() returns a result per representation —
      // but never silently drop one.
      return {
        representation: rep,
        outcome: "rejected" as const,
        legs: [],
        perCurrencyBalance: [],
        balanced: false,
        cites: [],
        urgentCorrectionAlertIds: [],
        detail: "interpreter produced no result for this representation",
      } satisfies RepresentationPreview;
    }
    return toPreview(r);
  });

  return {
    eventType: event.type,
    entity: event.entity ?? "LE-ZA-HOZ-BANK",
    asOf,
    representations,
  };
}
