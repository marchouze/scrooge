// platform/recon/fx-book-nop-parity.ts
//
// recon:fx-book-nop-parity — the V2 A2 GL⟷NOP parity gate.
//
// THE ASSERTION (A2 "Prove" §2): the `book:fx-trading` slice value reconciles to
// the standing-NOP basis (`deriveNetFxPositionByCurrency` — the shared B3 / VaR
// fold, the ~R499k VaR book). READ-ONLY comparison PARALLEL TO v1 — the gate
// changes no production number.
//
// HOW THE RECONCILIATION WORKS. The fx-trading book's economic position is the
// bank's standing net FX position per foreign currency. The v2 attribution layer
// derives that book position by:
//   1. taking the SAME shared NOP fold the B3 limit-utilisation projection + the
//      VaR engine consume (`deriveNetFxPositionByCurrency`) — single-source, no
//      parallel fold (the lesson of D-VAR-EXPOSURE-INCLUDES-STANDING-NOP);
//   2. building one fx-trading book MEMBER per net-currency position, as an FCY-
//      cash `Valuable` carrying that currency's signed net notional;
//   3. evaluating the `fx-pnl` metric (the A1 attribution engine path) per
//      currency at a UNIT rate (rate = 1) so the metric returns the FCY net
//      notional in minor units — the directly-comparable NOP basis.
// The gate then asserts, currency-for-currency, that the v2 book's per-currency
// net FCY position equals `deriveNetFxPositionByCurrency`. Because the v2 members
// are built from the SAME fold, parity holds by construction; the gate proves
// the v2 attribution path (member projection → metric → engine) faithfully
// reproduces the NOP basis and SURFACES any drift as a per-currency delta.
//
// The PARITY DELTA reported is Σ|v2 book net − NOP fold net| over all foreign
// currencies (major units). Zero on a faithful path.
//
// ZAR (home residual) is excluded on both sides per BA 310 / reg 29(3), matching
// the B3 / VaR treatment.
//
// BOUNDARY: V1-SIDE recon infrastructure. MAY import BOTH the v1 NOP fold AND the
// v2-core attribution kernel + FX models (the permitted v1→v2 direction). v2-core
// never reaches back here.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2);
//   D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (the shared NOP fold);
//   D-MODEL-BINDING-CONTRACT-V1; Principle 1.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import {
  type Instant,
  type MarketDataSlice,
  type ResolvedMember,
  type Slice,
  type SliceMember,
  type TenantId,
  evaluateSlice,
  fcyCashFromSettledReceivable,
  fcyCashValuable,
  fxPnlMetric,
} from "../../v2-core";
import { eventStore } from "../composition";
import type { Event } from "../event-store/types";
import { deriveNetFxPositionByCurrency } from "../projections/markets/limit-utilisation";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-book-nop-parity";

/** Anchor tenant the fx-trading book belongs to (the seed tenant, branded). */
const ANCHOR_TENANT = "tenant:za-bank" as TenantId;

/** Tolerance: the two derivations should agree to the cent (1 minor unit). */
const TOLERANCE_MINOR = 1n;

export interface RunOpts {
  /** Override the event source — used by tests. */
  events?: Iterable<Event>;
}

/**
 * Build the fx-trading book members from the shared NOP fold: one FCY-cash
 * `Valuable` member per non-ZAR net-currency position, carrying that currency's
 * signed net notional (in minor units). The book is the bank's standing net FX
 * position — the same basis the VaR engine + B3 projection measure.
 */
function buildFxTradingBookMembers(net: Map<string, number>): {
  members: ResolvedMember[];
  perCurrencyNetMinor: Map<string, bigint>;
} {
  const members: ResolvedMember[] = [];
  const perCurrencyNetMinor = new Map<string, bigint>();
  let i = 0;
  for (const [ccy, positionMajor] of net) {
    if (ccy === "ZAR") continue; // home residual — excluded from NOP
    // positionMajor is in FCY MAJOR units (signed); convert to minor (2dp).
    const signedMinor = BigInt(Math.round(positionMajor * 100));
    if (signedMinor === 0n) continue;
    perCurrencyNetMinor.set(ccy, signedMinor);
    const valuable = fcyCashValuable(
      fcyCashFromSettledReceivable({ currency: ccy, signedNotionalMinor: signedMinor }),
    );
    const member: ResolvedMember = {
      instanceUrn:
        `fil:inst:${ANCHOR_TENANT}:fx-book-nop-${ccy}-${i++}` as SliceMember["instanceUrn"],
      stage: "settled",
      tenantId: ANCHOR_TENANT,
      facets: { Valuable: valuable },
    };
    members.push(member);
  }
  return { members, perCurrencyNetMinor };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const events = opts.events ? [...opts.events] : [...eventStore.replay()];

  // The shared NOP fold — the SAME fold B3 + VaR consume (single source).
  const net = deriveNetFxPositionByCurrency(events);

  const { members, perCurrencyNetMinor } = buildFxTradingBookMembers(net);

  // -------------------------------------------------------------------------
  // Evaluate the fx-pnl metric over the book slice per-currency at a UNIT rate,
  // so the metric returns each currency's net FCY notional (minor units) — the
  // directly-comparable NOP basis. We run the A1 engine path (evaluateSlice) so
  // the parity is asserted over the REAL attribution pipeline, not a shortcut.
  // -------------------------------------------------------------------------
  const asOf = new Date().toISOString();
  let parityDeltaMinor = 0n;
  let currenciesChecked = 0;

  for (const member of members) {
    const ccy = currencyOfMember(member);
    if (!ccy) continue;
    currenciesChecked += 1;
    result.asserted += 1;

    // Per-currency slice: a single-cell leaf slice over just this member, valued
    // at a unit rate (FCY-major basis). The metric reads Valuable.value.
    const slice: Slice = {
      sliceId: "slice:book:fx-trading",
      tenantId: ANCHOR_TENANT,
      where: [{ dim: "book", op: "eq", value: "fx-trading" }],
      level: "leaf",
    };
    const unitMarks: MarketDataSlice = {
      asOf: asOf as Instant,
      observables: { [`${ccy}/ZAR`]: 1 },
    };
    const evaluation = evaluateSlice(fxPnlMetric, slice, [member], unitMarks, asOf as Instant);
    const cell = evaluation.cells[0];
    const v2BookNetMinor = cell ? cell.value.minorUnits : 0n;

    const nopNetMinor = perCurrencyNetMinor.get(ccy) ?? 0n;
    const deltaMinor = v2BookNetMinor - nopNetMinor;
    const absDelta = deltaMinor < 0n ? -deltaMinor : deltaMinor;
    parityDeltaMinor += absDelta;

    if (absDelta > TOLERANCE_MINOR) {
      violations.push({
        subject: `${ccy}:book-vs-nop`,
        message: `fx-trading book net position ${v2BookNetMinor} (minor) != standing-NOP fold ${nopNetMinor} (minor) for ${ccy} — delta ${deltaMinor}. The v2 attribution book must reconcile to the shared NOP basis (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP).`,
        severity: "fail",
      });
    }
  }

  if (currenciesChecked === 0) {
    violations.push({
      subject: "fx-trading book",
      message:
        "live book carries no standing FX position (flat bench) — no book⟷NOP to reconcile. Parity assertion skipped (info).",
      severity: opts.events !== undefined ? "fail" : "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `fx-book-nop-parity: ${currenciesChecked} currency(ies) checked; parity delta Σ|book − NOP| = ${parityDeltaMinor} minor units (${(Number(parityDeltaMinor) / 100).toFixed(2)} FCY major, summed across currencies). Read-only; v1 untouched.`;
  return result;
}

/** Recover the member's currency from its synthetic urn (`…fx-book-nop-<CCY>-<i>`). */
function currencyOfMember(member: SliceMember): string | undefined {
  const m = /fx-book-nop-([A-Z]{3})-\d+$/.exec(member.instanceUrn);
  return m ? m[1] : undefined;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}; ${r.violations.length} violation(s) (${failCount} fail)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
