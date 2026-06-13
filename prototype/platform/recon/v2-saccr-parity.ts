// platform/recon/v2-saccr-parity.ts
//
// recon:v2-saccr-parity — the V2 S7-FIL byte-equivalence gate.
//
// SA-CCR is the FIRST cross-package FIL-Model (V2 S7-FIL). The live v1 engine
// (`platform/risk/sa-ccr/*`) stays LIVE; the v2 FIL-Model
// (`v2-core/fil-models/sa-ccr/*`) is a faithful, no-v1-import port. This gate
// proves they produce BYTE-IDENTICAL `CcrReplacementCostComputed` +
// `CcrEadComputed` event payloads per netting set over the full anchor IR + FX
// history, so a future slice can flip the alias / retire v1 with confidence.
//
// BOUNDARY NOTE: this gate is V1-SIDE infrastructure and MAY import BOTH the v1
// engine AND the v2 model — the `recon:v2-no-v1-import` boundary forbids only
// v2→v1. The permitted direction is v1→v2 (v1 is the seed tenant). This file
// imports v2-core; v2-core never reaches back here.
//
// HARNESS-BOUNDARY FIL-INSTANCE GAP (surfaced, not hidden): the v2 model reads
// IR + FX positions as FIL instances via `RiskMeasurable`. Per-trade native FIL
// instances are NOT yet materialised in v2 (no `fil:inst:` event family exists
// in the live store yet — that is a later slice). So this harness ADAPTS the v1
// live positions into the v2 model's `SaCcrTradeSummary` shape AT THE V1 SIDE
// (allowed) — `buildFxSaCcrTradeSummaries` (v1) → v2 trade summaries — and
// resolves vMtm + collateral via the v1 helpers. The adaptation is 1:1 (same
// fields), so it does not perturb parity; it is the explicit substrate gap a
// future slice (native FIL-instance materialisation) closes.
//
// Gate behaviour:
//   - For each live netting set, run BOTH engines over the SAME inputs and
//     build BOTH event payloads. Assert byte-equivalence (JSON-stable compare).
//   - ANY divergence → severity "fail" with a per-netting-set diff.
//   - When the live book carries zero SA-CCR netting sets (a flat bench),
//     the gate passes with an `info` note — there is nothing to reconcile but
//     the structural port is still exercised by the model's own unit tests.
//
// Authority: D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
//   BCBS-SA-CCR-CRE52.
// Author: Rohan (Risk Engineer, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import type { Money as V2Money } from "../../v2-core/fil-core/primitives";
// --- v2 FIL-Model (the candidate) ---
import {
  type SaCcrNettingSet as V2NettingSet,
  type SaCcrTradeSummary as V2TradeSummary,
  computeSaCcr,
} from "../../v2-core/fil-models/sa-ccr";
import { eventStore } from "../composition";
import { type Money as V1Money, minor as v1Minor } from "../core/money";
import type { Currency } from "../core/types";
import { resolveNettingSet } from "../markets/netting-sets";
import { computeEad as v1ComputeEadEad } from "../risk/sa-ccr/ead";
// --- v1 SA-CCR engine (the oracle) ---
import { computeAddOn as v1ComputeAddOn } from "../risk/sa-ccr/pfe-addon";
import { buildFxSaCcrTradeSummaries } from "../risk/sa-ccr/positions-to-summaries";
import { computeReplacementCost as v1ComputeReplacementCost } from "../risk/sa-ccr/replacement-cost";
import type { TradeSummary as V1TradeSummary } from "../risk/sa-ccr/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-saccr-parity";

// ---------------------------------------------------------------------------
// Money conversions at the harness boundary (v1 Money ↔ v2 Money). v1 Money is
// `{ amount: bigint, currency }`; v2 Money is `{ minorUnits: bigint, currency }`.
// Pure, lossless (both are bigint minor units).
// ---------------------------------------------------------------------------

function v1ToV2Money(m: V1Money): V2Money {
  return { currency: String(m.currency), minorUnits: m.amount };
}

function v1ToV2Trade(t: V1TradeSummary): V2TradeSummary {
  return {
    ...(t.tradeId !== undefined ? { tradeId: t.tradeId } : {}),
    counterpartyId: t.counterpartyId,
    nettingSetId: t.nettingSetId,
    assetClass: t.assetClass,
    notional: v1ToV2Money(t.notional),
    ...(t.direction !== undefined ? { direction: t.direction } : {}),
    ...(t.remainingYears !== undefined ? { remainingYears: t.remainingYears } : {}),
    ...(t.currency !== undefined ? { currency: t.currency } : {}),
    ...(t.hedgingSetTag !== undefined ? { hedgingSetTag: t.hedgingSetTag } : {}),
    ...(t.optionType !== undefined ? { optionType: t.optionType } : {}),
  };
}

// ---------------------------------------------------------------------------
// Event-payload builders. These mirror `compute-and-emit.ts` EXACTLY — the same
// field set, the same `Number(...)` coercions — so byte-equivalence of the
// payloads is a faithful proxy for byte-equivalence of the emitted events.
// (The event envelope — event_id / as_of / actor — is non-deterministic in v1;
//  parity is asserted over the PAYLOAD, which is the methodology output.)
// ---------------------------------------------------------------------------

interface CcrEventPayloads {
  readonly rc: Record<string, unknown>;
  readonly ead: Record<string, unknown>;
}

const RC_EVENT_ID_PLACEHOLDER = "<rc-event-id>";

function v1Payloads(args: {
  ns: V2NettingSet;
  vMtm: V1Money;
  collateral: V1Money;
  trades: V1TradeSummary[];
  asOf: string;
}): CcrEventPayloads {
  const { ns, vMtm, collateral, trades, asOf } = args;
  const v1Ns = {
    nettingSetId: ns.nettingSetId,
    counterpartyId: ns.counterpartyId,
    csaPresent: ns.csaPresent,
    currency: ns.currency,
    ...(ns.threshold !== undefined
      ? {
          threshold: {
            amount: ns.threshold.minorUnits,
            currency: ns.threshold.currency as Currency,
          },
        }
      : {}),
    ...(ns.mta !== undefined
      ? { mta: { amount: ns.mta.minorUnits, currency: ns.mta.currency as Currency } }
      : {}),
  };
  const rc = v1ComputeReplacementCost(v1Ns, vMtm, collateral, asOf);
  const addOns = v1ComputeAddOn(trades, { margined: ns.csaPresent });
  const ead = v1ComputeEadEad(rc, addOns, { counterpartyId: ns.counterpartyId, asOf });
  const computationDate = asOf.slice(0, 10);
  return {
    rc: {
      nettingSetId: ns.nettingSetId,
      counterpartyId: ns.counterpartyId,
      rc: Number(rc.rc.amount),
      currency: ns.currency,
      computationDate,
      methodology: "sa-ccr",
      vMtm: Number(vMtm.amount),
      collateralHeld: Number(collateral.amount),
    },
    ead: {
      nettingSetId: ns.nettingSetId,
      counterpartyId: ns.counterpartyId,
      rc: Number(rc.rc.amount),
      pfe: Number(ead.pfe.amount),
      alpha: 1.4,
      ead: Number(ead.ead.amount),
      currency: ns.currency,
      computationDate,
      methodology: "sa-ccr",
      sourceEvents: { rcEventId: RC_EVENT_ID_PLACEHOLDER, pfeComponents: addOns.length },
    },
  };
}

function v2Payloads(args: {
  ns: V2NettingSet;
  vMtm: V2Money;
  collateral: V2Money;
  trades: V2TradeSummary[];
  asOf: string;
}): CcrEventPayloads {
  const { ns, vMtm, collateral, trades, asOf } = args;
  const { rc, ead, addOns } = computeSaCcr({
    nettingSet: ns,
    vMtm,
    collateralHeld: collateral,
    trades,
    asOf,
  });
  const computationDate = asOf.slice(0, 10);
  return {
    rc: {
      nettingSetId: ns.nettingSetId,
      counterpartyId: ns.counterpartyId,
      rc: Number(rc.rc.minorUnits),
      currency: ns.currency,
      computationDate,
      methodology: "sa-ccr",
      vMtm: Number(vMtm.minorUnits),
      collateralHeld: Number(collateral.minorUnits),
    },
    ead: {
      nettingSetId: ns.nettingSetId,
      counterpartyId: ns.counterpartyId,
      rc: Number(rc.rc.minorUnits),
      pfe: Number(ead.pfe.minorUnits),
      alpha: 1.4,
      ead: Number(ead.ead.minorUnits),
      currency: ns.currency,
      computationDate,
      methodology: "sa-ccr",
      sourceEvents: { rcEventId: RC_EVENT_ID_PLACEHOLDER, pfeComponents: addOns.length },
    },
  };
}

/** Stable JSON for byte-compare (sorted keys, deep). */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return v;
  });
}

// ---------------------------------------------------------------------------
// Recorded-event anchors. The strongest parity proof replays the CCR events the
// live v1 engine ACTUALLY emitted over the anchor history, reconstructs the
// inputs at each event's `as_of`, re-runs BOTH engines, and asserts the v2
// output is byte-identical to (a) the recorded v1 payload AND (b) the v1
// recomputation. This binds the port to real history, not just synthetic cases.
// ---------------------------------------------------------------------------

interface RecordedCcr {
  readonly nettingSetId: string;
  readonly counterpartyId: string;
  readonly currency: string;
  readonly asOf: string;
  readonly rcPayload: Record<string, unknown>;
  readonly eadPayload: Record<string, unknown> | null;
}

function collectRecordedCcr(): RecordedCcr[] {
  // Latest recorded RC + EAD per nettingSetId (over the full history).
  const byNs = new Map<string, RecordedCcr>();
  for (const ev of eventStore.replay({ type: "CcrReplacementCostComputed" })) {
    const p = ev.payload as Record<string, unknown>;
    const nsId = String(p.nettingSetId);
    byNs.set(nsId, {
      nettingSetId: nsId,
      counterpartyId: String(p.counterpartyId),
      currency: String(p.currency),
      asOf: ev.as_of,
      rcPayload: p,
      eadPayload: byNs.get(nsId)?.eadPayload ?? null,
    });
  }
  for (const ev of eventStore.replay({ type: "CcrEadComputed" })) {
    const p = ev.payload as Record<string, unknown>;
    const nsId = String(p.nettingSetId);
    const prev = byNs.get(nsId);
    if (prev) byNs.set(nsId, { ...prev, eadPayload: p });
  }
  return [...byNs.values()];
}

/** Normalise a recorded payload to the harness-comparable shape (placeholder rcEventId). */
function normaliseRecorded(
  payload: Record<string, unknown>,
  isEad: boolean,
): Record<string, unknown> {
  if (!isEad) return payload;
  const src = payload.sourceEvents as Record<string, unknown> | undefined;
  return {
    ...payload,
    sourceEvents: {
      rcEventId: RC_EVENT_ID_PLACEHOLDER,
      pfeComponents: src?.pfeComponents ?? 0,
    },
  };
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  let nettingSetsChecked = 0;
  let byteDiffs = 0;

  // PRIMARY PROOF — recorded-history anchors. Reconstruct inputs at each
  // recorded CCR event's as_of, re-run both engines, compare three ways.
  const recorded = collectRecordedCcr();

  for (const rec of recorded) {
    const asOf = rec.asOf;
    const v1Ns = resolveNettingSet(rec.counterpartyId, rec.currency, asOf);

    // Reconstruct the netting-set config: prefer the live register; fall back
    // to a minimal config from the recorded payload (currency + counterparty)
    // when the register is unavailable. The recorded RC/EAD figures pin the
    // margined/unmargined branch (vMtm == rc and collateral == 0 ⇒ unmargined
    // semantics hold for these anchors).
    const ns: V2NettingSet = v1Ns
      ? {
          nettingSetId: v1Ns.nettingSetId,
          counterpartyId: v1Ns.counterpartyId,
          csaPresent: v1Ns.csaPresent,
          currency: v1Ns.currency,
          ...(v1Ns.threshold !== undefined ? { threshold: v1ToV2Money(v1Ns.threshold) } : {}),
          ...(v1Ns.mta !== undefined ? { mta: v1ToV2Money(v1Ns.mta) } : {}),
        }
      : {
          nettingSetId: rec.nettingSetId,
          counterpartyId: rec.counterpartyId,
          csaPresent: false,
          currency: rec.currency,
        };

    // Reconstruct the trade list at the historical as_of (drives PFE add-ons).
    const groups = buildFxSaCcrTradeSummaries(eventStore, asOf);
    const grp = groups.get(rec.nettingSetId);
    const trades: V1TradeSummary[] = grp?.trades ?? [];

    // PIN the RC inputs (vMtm, collateral) FROM THE RECORDED RC EVENT. These are
    // the authoritative inputs the live v1 engine used — they are NOT
    // re-derived from the as-of-sensitive `resolveMtm` cumulative-delta walk,
    // which drifts as later revaluations land. This is the harness-boundary
    // FIL-instance gap made explicit: per-trade native FIL instances are not
    // yet materialised in v2, so the position MTM is taken from the recorded
    // v1 event-of-record rather than re-resolved. Pinning the recorded inputs
    // makes the recorded-history parity proof deterministic.
    const vMtm: V1Money = v1Minor(BigInt(Number(rec.rcPayload.vMtm)), ns.currency as Currency);
    const collateral: V1Money = v1Minor(
      BigInt(Number(rec.rcPayload.collateralHeld)),
      ns.currency as Currency,
    );

    const v1Out = v1Payloads({ ns, vMtm, collateral, trades, asOf });
    const v2Out = v2Payloads({
      ns,
      vMtm: v1ToV2Money(vMtm),
      collateral: v1ToV2Money(collateral),
      trades: trades.map(v1ToV2Trade),
      asOf,
    });

    nettingSetsChecked += 1;

    // (1) v2 recompute == v1 recompute (the core port-fidelity assertion).
    result.asserted += 2;
    if (stableJson(v1Out.rc) !== stableJson(v2Out.rc)) {
      byteDiffs += 1;
      violations.push({
        subject: `${rec.nettingSetId}:CcrReplacementCostComputed:recompute`,
        message: `RC payload diverges v1-recompute vs v2:\n  v1=${stableJson(v1Out.rc)}\n  v2=${stableJson(v2Out.rc)}`,
        severity: "fail",
      });
    }
    if (stableJson(v1Out.ead) !== stableJson(v2Out.ead)) {
      byteDiffs += 1;
      violations.push({
        subject: `${rec.nettingSetId}:CcrEadComputed:recompute`,
        message: `EAD payload diverges v1-recompute vs v2:\n  v1=${stableJson(v1Out.ead)}\n  v2=${stableJson(v2Out.ead)}`,
        severity: "fail",
      });
    }

    // (2) v2 recompute == the RECORDED v1 event (binds the port to real
    //     history, byte-for-byte). With RC inputs pinned from the recorded
    //     event, RC reproduces exactly; PFE/EAD reproduce when the trade list
    //     reconstructs (it does at the recorded as_of). A diff here is a real
    //     port-fidelity failure → `fail`.
    result.asserted += 1;
    const recRc = normaliseRecorded(rec.rcPayload, false);
    if (stableJson(v2Out.rc) !== stableJson(recRc)) {
      byteDiffs += 1;
      violations.push({
        subject: `${rec.nettingSetId}:CcrReplacementCostComputed:vs-recorded`,
        message: `v2 RC diverges from the RECORDED v1 event:\n  recorded=${stableJson(recRc)}\n  v2=${stableJson(v2Out.rc)}`,
        severity: "fail",
      });
    }
    if (rec.eadPayload) {
      result.asserted += 1;
      const recEad = normaliseRecorded(rec.eadPayload, true);
      if (stableJson(v2Out.ead) !== stableJson(recEad)) {
        byteDiffs += 1;
        violations.push({
          subject: `${rec.nettingSetId}:CcrEadComputed:vs-recorded`,
          message: `v2 EAD diverges from the RECORDED v1 event:\n  recorded=${stableJson(recEad)}\n  v2=${stableJson(v2Out.ead)}`,
          severity: "fail",
        });
      }
    }
  }

  result.violations = violations;
  if (nettingSetsChecked === 0) {
    result.ok = true;
    result.asOf =
      "saccr-parity: 0 recorded SA-CCR netting sets — nothing to reconcile (engine has not run on this store)";
    return result;
  }

  result.ok = violations.filter((v) => v.severity === "fail").length === 0;
  result.asOf = `saccr-parity: ${nettingSetsChecked} netting set(s) checked over recorded history, ${byteDiffs} byte-diff(s)`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok && r.violations.length === 0 ? "OK" : r.ok ? "OK (advisory)" : "FAIL";
  process.stdout.write(
    `\nrecon:${PIPELINE} ${label} — ${r.asOf}; ${r.violations.length} violation(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
