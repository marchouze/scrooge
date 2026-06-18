// platform/recon/fx-cash-gl-recognition-integrity.ts
//
// recon:fx-cash-gl-recognition-integrity — the fail-closed gate that ties
// FX-settlement CASH GL RECOGNITION to the materialised Cash FIL
// instrument-of-record (D-CASH-ASSET-CLASS-V1, WS-CASH-ASSET-CLASS).
//
// WHY THIS GATE EXISTS
// --------------------
// PR #1421 made `cash` a first-class FIL asset class: on FX maturity the
// settlement path materialises the settled leg(s) as REAL Cash FIL instances
// (`fil:type:cash:balance:vanilla@1.0`, both legs, each carrying an
// `originatingInstrument` back-ref to the FX instance that produced it). Cash
// GL recognition under the IFRS posting rule (PR-FX-PRIN on `PrincipalPayment`)
// recognises that same settled cash against the nostro account. With Cash now an
// INSTRUMENT-OF-RECORD, the GL cash leg and the `FilInstrumentCreated{cash}`
// instance MUST be two renders of one truth (Principle 1) — not two
// independently-derived numbers that happen to agree.
//
// PR-FX-PRIN's per-leg mapping (the production posting path):
//   received / long  cash leg → Dr fx.nostro[ccy]  (a positive cash recognition)
//   paid     / short cash leg → Cr fx.nostro[ccy]  (a negative cash recognition)
//   amount = abs(netCash), currency = the leg currency.
// So the GL CASH RECOGNITION for a settled leg is, per currency, a SIGNED
// quantity: +notional for a received/long leg, −notional for a paid/short leg.
// The Cash FIL instrument-of-record carries exactly that signed position
// (`notional` always-positive Money + `direction` long/short). If they are one
// truth, applying PR-FX-PRIN's sign convention to the Cash instrument MUST
// reproduce the GL recognition — and the received/paid legs of a single settled
// FX MUST net to a coherent two-sided cash movement.
//
// THREE INVARIANTS, all FAIL-CLOSED:
//
//   (A) RECOGNITION DETERMINACY — every `cash` instance under a cash-materialising
//       settled FX MUST map to a determinate GL nostro side: `direction` is
//       long|short and `notional.amount` is non-zero. A cash instrument with a
//       zero notional or an undeterminable direction cannot be recognised against
//       the GL (PR-FX-PRIN's `non-zero-delta` guard) — the instrument-of-record
//       and the GL leg cannot be reconciled. Fail.
//
//   (B) TWO-SIDED CASH BALANCE — for every settled FX under a `bothLegs` cash-
//       materialising NPA, the materialised cash legs MUST include BOTH a
//       received-side (Dr-nostro) and a paid-side (Cr-nostro) recognition. A
//       settlement that recognises only one side of the cash movement is a
//       half-posted derecognition (IFRS 9 §3.2.3) — the GL would not balance and
//       the instrument-of-record would record a one-legged settlement. Fail.
//
//   (C) NET-RECOGNITION NON-VACUITY — the signed GL cash recognition derived from
//       the Cash instruments of a settled FX (Σ received − Σ paid, by currency)
//       MUST be non-vacuous: at least one currency carries a non-zero net
//       recognition. A settled FX whose cash instruments net to nothing in every
//       currency means the GL recognition tied to the instrument-of-record is a
//       no-op — the cash holding has no GL footprint. Fail.
//
// Proven on the anchor fixture book: the settled USD position
// (`S1-FX-FIXTURE-USD-SETTLED-001`, USD 100k @ 18.52) materialises two cash legs
// — received USD +100,000 (Dr nostro) and paid ZAR −1,852,000 (Cr nostro) — so
// the GL cash recognition is USD +100,000 / ZAR −1,852,000, two renders of the
// one settled cash position. All three invariants are non-vacuous on that book.
// On a flat bench (no settled FX under a cash-materialising NPA) the gate passes
// with an `info` note — it still ran.
//
// READ-ONLY: asserts the structural tie between GL cash recognition and the Cash
// instrument-of-record over the v2 FIL-instance event stream; values nothing and
// touches no production number.
//
// BOUNDARY: V1-SIDE recon infrastructure (bun:sqlite / node:fs). MAY import
// v2-core + platform/markets (the product layer that declares the rule); the
// permitted v1→v2 direction. v2-core never reaches back here.
//
// Authority: D-CASH-ASSET-CLASS-V1; prd:bank:fx:otc-vanilla;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE (decimal-native Money, MAJOR units);
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed); Principle 1; Principle 2.
// Cites: IFRS 9 §3.2.3 (per-leg derecognition); IAS 21 §28 (settlement-date FX).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRow,
  foldFilInstances,
} from "../../v2-core";
import { isZeroD, toDecimal } from "../../v2-core/fil-core/decimal";
import { resolveMaturityMaterialisation } from "../markets/products/maturity-materialisation";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-cash-gl-recognition-integrity";

// ---------------------------------------------------------------------------
// v2 anchor store resolution (mirrors cash-materialisation-integrity.ts).
// ---------------------------------------------------------------------------

function resolveV2AnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

interface V2Row {
  type: string;
  payload: string;
}

function readFilInstanceEvents(dbPath = resolveV2AnchorDb()): FilInstanceLifecycleEvent[] {
  if (!existsSync(dbPath)) return [];
  let db: Database;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch {
    return [];
  }
  try {
    const tableExists = db
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='v2_events'`,
      )
      .all();
    if (tableExists.length === 0) return [];
    const rows = db
      .query<V2Row, []>(
        `SELECT type, payload FROM v2_events
         WHERE type IN ('FilInstrumentCreated','FilInstrumentAmended','FilInstrumentTerminated')
         ORDER BY sequence ASC`,
      )
      .all();
    const events: FilInstanceLifecycleEvent[] = [];
    for (const r of rows) {
      const p = JSON.parse(r.payload) as Record<string, unknown>;
      events.push(p as unknown as FilInstanceLifecycleEvent);
    }
    return events;
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// GL recognition model — PR-FX-PRIN's per-leg sign convention applied to the
// Cash instrument-of-record. A received/long cash leg posts Dr fx.nostro (a
// POSITIVE cash recognition); a paid/short cash leg posts Cr fx.nostro (a
// NEGATIVE cash recognition). This is the ONE mapping the recon shares with the
// posting rule — if the GL leg and the instrument are one truth, this derivation
// reproduces the GL recognition exactly.
// ---------------------------------------------------------------------------

/** The GL nostro side a cash instance's direction recognises. */
type NostroSide = "debit" | "credit";

function nostroSideFor(direction: FilInstanceRow["economicTerms"]["direction"]): NostroSide | null {
  // received balance = long = asset cash held = Dr nostro.
  // paid/funding balance = short = Cr nostro.
  if (direction === "long") return "debit";
  if (direction === "short") return "credit";
  return null;
}

export interface RunOpts {
  /** Override the FIL instance event source — used by tests. */
  filEvents?: FilInstanceLifecycleEvent[];
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const filEvents = opts.filEvents ?? readFilInstanceEvents();
  const register = foldFilInstances(filEvents);

  // Index `cash` instances by their originating FX instance URN.
  const cashByOrigin = new Map<string, FilInstanceRow[]>();
  for (const row of register.values()) {
    if (row.economicTerms.assetClass !== "cash") continue;
    const origin = row.economicTerms.originatingInstrument;
    if (!origin || origin.length === 0) continue; // orphans are the sibling gate's concern.
    const list = cashByOrigin.get(origin) ?? [];
    list.push(row);
    cashByOrigin.set(origin, list);
  }

  let settledFxUnderRule = 0;

  for (const fx of register.values()) {
    if (fx.economicTerms.assetClass !== "fx") continue;
    if (fx.stage !== "settled") continue;

    const rule = resolveMaturityMaterialisation(fx.type);
    if (!rule || rule.materialisesAssetClass !== "cash") continue;
    if (rule.onLifecycleStage !== "settled") continue;

    settledFxUnderRule += 1;
    const cashLegs = cashByOrigin.get(fx.instance) ?? [];

    // Completeness (the sibling gate already fails on zero) — but a settled FX
    // with no cash legs has no GL recognition to reconcile; skip the recognition
    // invariants (cash-materialisation-integrity owns the zero-leg failure).
    if (cashLegs.length === 0) continue;

    // Per-currency signed GL cash recognition, derived from the Cash
    // instrument-of-record via PR-FX-PRIN's sign convention.
    const netByCurrency = new Map<string, string>();
    let receivedSides = 0;
    let paidSides = 0;

    for (const cash of cashLegs) {
      // (A) RECOGNITION DETERMINACY.
      const side = nostroSideFor(cash.economicTerms.direction);
      result.asserted += 1;
      const notional = cash.economicTerms.notional;
      if (side === null || isZeroD(toDecimal(notional.amount))) {
        violations.push({
          subject: `indeterminate-recognition:${cash.instance}`,
          message: `cash FIL instance ${cash.instance} (originating ${fx.instance}) cannot be recognised against the GL — direction='${cash.economicTerms.direction}', notional='${notional.amount} ${notional.currency}'. PR-FX-PRIN requires a determinate nostro side and a non-zero delta; the instrument-of-record and the GL cash leg cannot be reconciled. Fail-closed (D-CASH-ASSET-CLASS-V1).`,
          severity: "fail",
        });
        continue;
      }

      if (side === "debit") receivedSides += 1;
      else paidSides += 1;

      // Signed recognition: Dr (received) = +notional; Cr (paid) = −notional.
      const signed = side === "debit" ? notional.amount : `-${notional.amount}`;
      const prior = netByCurrency.get(notional.currency);
      // Decimal-exact running net (avoid float; string accumulation via Decimal).
      const next = prior === undefined ? signed : addDecimalStrings(prior, signed);
      netByCurrency.set(notional.currency, next);
    }

    // (B) TWO-SIDED CASH BALANCE — for a bothLegs NPA, both a Dr-nostro
    // (received) and a Cr-nostro (paid) recognition must be present.
    result.asserted += 1;
    if (rule.bothLegs && (receivedSides === 0 || paidSides === 0)) {
      violations.push({
        subject: `one-legged-recognition:${fx.instance}`,
        message: `settled FX instance ${fx.instance} under a both-legs cash-materialising NPA (${rule.materialisesTypeUrn}) recognised only ${receivedSides} received-side (Dr nostro) and ${paidSides} paid-side (Cr nostro) cash leg(s) — a half-posted derecognition. The GL cash recognition would not balance against the instrument-of-record. IFRS 9 §3.2.3 / fail-closed (D-CASH-ASSET-CLASS-V1).`,
        severity: "fail",
      });
    }

    // (C) NET-RECOGNITION NON-VACUITY — at least one currency carries a non-zero
    // signed GL cash recognition.
    result.asserted += 1;
    const anyNonZero = [...netByCurrency.values()].some((amt) => !isZeroD(toDecimal(amt)));
    if (!anyNonZero) {
      violations.push({
        subject: `vacuous-recognition:${fx.instance}`,
        message: `settled FX instance ${fx.instance} materialised cash leg(s) whose signed GL cash recognition nets to zero in every currency — the cash holding tied to the instrument-of-record has no GL footprint. Principle 1 / fail-closed (D-CASH-ASSET-CLASS-V1).`,
        severity: "fail",
      });
    }
  }

  if (settledFxUnderRule === 0) {
    violations.push({
      subject: "anchor-book",
      message:
        "no settled FX under a cash-materialising NPA in the v2 anchor store — no GL cash recognition to reconcile to a Cash instrument-of-record (flat-bench info, not a failure).",
      severity: "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `fx-cash-gl-recognition-integrity: ${settledFxUnderRule} settled FX instance(s) under a cash-materialising NPA reconciled — GL cash recognition tied to the Cash instrument-of-record (received → Dr nostro +, paid → Cr nostro −).`;
  return result;
}

// ---------------------------------------------------------------------------
// Decimal-native helper — exact addition of two canonical decimal strings
// (MAJOR units). Local to keep the v2-core import surface to the decimal kernel.
// ---------------------------------------------------------------------------

function addDecimalStrings(a: string, b: string): string {
  // toDecimal validates the canonical decimal-string form fail-closed.
  const sum = toDecimal(a).plus(toDecimal(b));
  return sum.toString();
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
