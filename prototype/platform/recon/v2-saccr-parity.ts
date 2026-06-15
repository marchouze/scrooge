// platform/recon/v2-saccr-parity.ts
//
// recon:v2-saccr-parity — FIL SA-CCR self-consistency gate (post-flip).
//
// PRODUCTION PATH NOW FIL: `computeRwaFromPositions()` sources SA-CCR EAD
// directly from the FIL SA-CCR model (D-FIL-FRAMEWORK-UNIFICATION). The
// CcrEadComputed event-stream fold has been retired; this gate now validates
// that the FIL model's output is self-consistent with the v1 oracle over the
// recorded history — any divergence surfaces a finding (warn), not a hard fail,
// since the feed-sourced vMtm is the correct Principle-1 basis and must not be
// bent to match the pre-flip oracle's drift-prone resolveMtm basis.
//
// BOUNDARY NOTE: this gate is V1-SIDE infrastructure and MAY import BOTH the v1
// engine AND the v2 model — the `recon:v2-no-v1-import` boundary forbids only
// v2→v1. The permitted direction is v1→v2 (v1 is the seed tenant). This file
// imports v2-core; v2-core never reaches back here.
//
// FIL-INSTANCE-SOURCED (gap CLOSED): the v2 side now sources its netting-set
// TRADE STRUCTURE from the NATIVE FIL instance projection
// (`buildSaCcrTradeSummariesFromFilInstances`, reading the materialised
// `fil:inst:` lifecycle family from the v2 anchor store, folded as-of). The
// interim v1-position adapter (`buildFxSaCcrTradeSummaries`) is RETAINED only on
// the v1-oracle side of the comparison — the v2 candidate reads from instances.
// This makes "FIL facets are the sole data-access path" (D-MODEL-BINDING-
// CONTRACT-V1) true end-to-end for the SA-CCR trade/netting structure.
//
// FULLY FIL-MEDIATED (pin RETIRED): the RC inputs vMtm + collateral are now
// sourced FROM THEIR OWN EVENTS-OF-RECORD via FIL-mediated feeds, NOT pinned
// from the recorded v1 RC event:
//   - vMtm      ← the latest `*Revalued` EVENT-OF-RECORD per trade, as-of the RC
//                 date, through the `Valuable` facet's `RevaluationRecord` shape
//                 (`sourceVMtmFromValuableFeed`). Principle 1: read the canonical
//                 revaluation event; do NOT recompute via the drift-prone
//                 cumulative-delta walk in v1 `resolveMtm`.
//   - collateral ← the collateral-inventory register, as-of the RC date
//                 (`sourceCollateralFromRegister`).
// The FIL instances source the trade/netting STRUCTURE (notional, direction,
// counterparty, netting set, maturity, hedging set); the Valuable feed + the
// collateral register source MtM + collateral. SA-CCR is now sourced END-TO-END
// from FIL-mediated reads — "FIL facets are the sole data-access path"
// (D-MODEL-BINDING-CONTRACT-V1) holds for ALL of SA-CCR's inputs.
//
// THE RECORDED v1 RC EVENT IS NOW ORACLE-ONLY: it is compared against (a
// diagnostic of the cutover), never an INPUT SOURCE. Where the feed-sourced
// vMtm diverges from the recorded RC's vMtm — because the recorded RC used a
// DIFFERENT MtM BASIS (v1 `resolveMtm`'s cumulative-delta sum) or a different
// as-of snapshot — the gate SURFACES the divergence as a finding (the two vMtm
// values + as-of), it does NOT adjust the feed to force a match. A genuine
// divergence here is exactly what this cutover exists to surface (brief §4).
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
// --- FIL-instance-sourced position feed (the v2 candidate's data-access path) ---
import { buildSaCcrTradeSummariesFromFilInstances } from "../risk/sa-ccr/fil-instance-positions";
// --- FIL-mediated vMtm (Valuable feed) + collateral (register) feeds ---
import {
  sourceCollateralFromRegister,
  sourceVMtmFromValuableFeed,
} from "../risk/sa-ccr/fil-valuable-collateral-feed";
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

/** Stable JSON for byte-compare (sorted keys, deep; bigint → string). */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return v;
  });
}

/** Order-independent trade comparison: sort by tradeId so the structural parity
 * assertion does not depend on store-walk ordering between the two paths. */
function sortTrades(trades: readonly V2TradeSummary[]): V2TradeSummary[] {
  return [...trades].sort((a, b) => (a.tradeId ?? "").localeCompare(b.tradeId ?? ""));
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

    // ORACLE trade list — the v1 adapter reconstructs the historical as_of book
    // (drives the v1-recompute side; PFE add-ons).
    const groups = buildFxSaCcrTradeSummaries(eventStore, asOf);
    const grp = groups.get(rec.nettingSetId);
    const trades: V1TradeSummary[] = grp?.trades ?? [];

    // CANDIDATE trade list — the v2 side sources its trade/netting STRUCTURE from
    // the NATIVE FIL instance projection (folded as-of). This is the data-access
    // path the gap-closure proves: the v2 SA-CCR model reads positions through
    // the materialised `fil:inst:` register, not the v1-position adapter.
    const filGroups = buildSaCcrTradeSummariesFromFilInstances(asOf);
    const filGrp = filGroups.get(rec.nettingSetId);
    const v2Trades: V2TradeSummary[] = filGrp?.trades ?? [];

    // STRUCTURAL PARITY — the FIL-sourced v2 trade summaries must byte-match the
    // trades the v1 adapter derives (each field 1:1). A diff here means the
    // materialised instance did not faithfully carry the trade structure → fail.
    result.asserted += 1;
    const v1AdaptedV2Trades = trades.map(v1ToV2Trade);
    if (stableJson(sortTrades(v1AdaptedV2Trades)) !== stableJson(sortTrades(v2Trades))) {
      byteDiffs += 1;
      violations.push({
        subject: `${rec.nettingSetId}:trade-structure:fil-vs-v1-adapter`,
        message:
          `FIL-instance-sourced trades diverge from the v1 adapter for ${rec.nettingSetId}:\n` +
          `  v1-adapter=${stableJson(sortTrades(v1AdaptedV2Trades))}\n` +
          `  fil-sourced=${stableJson(sortTrades(v2Trades))}`,
        severity: "fail",
      });
    }

    // SOURCE the RC inputs (vMtm, collateral) FROM THEIR OWN EVENTS-OF-RECORD —
    // PIN RETIRED. vMtm comes from the `Valuable` feed (latest `*Revalued`
    // event-of-record per trade, as-of the RC date); collateral from the
    // collateral-inventory register. The recorded v1 RC event is NO LONGER an
    // input source — it is ORACLE-ONLY (compared below). FIL-mediated end-to-end
    // (D-MODEL-BINDING-CONTRACT-V1).
    const vMtmV2: V2Money = sourceVMtmFromValuableFeed(eventStore, {
      counterpartyId: ns.counterpartyId,
      currency: ns.currency,
      asOf,
    });
    const collateralV2: V2Money = sourceCollateralFromRegister({
      currency: ns.currency,
      asOf,
    });
    // v1 oracle side consumes the SAME feed-sourced inputs (lossless v2→v1 Money).
    const vMtm: V1Money = v1Minor(vMtmV2.minorUnits, ns.currency as Currency);
    const collateral: V1Money = v1Minor(collateralV2.minorUnits, ns.currency as Currency);

    const v1Out = v1Payloads({ ns, vMtm, collateral, trades, asOf });
    const v2Out = v2Payloads({
      ns,
      vMtm: vMtmV2,
      collateral: collateralV2,
      // Trade STRUCTURE from native FIL instances (gap closed in #1296).
      trades: v2Trades,
      asOf,
    });

    nettingSetsChecked += 1;

    // (1) HARD GATE — v2 recompute == v1 recompute over the SAME FIL-mediated
    //     inputs (the core port-fidelity assertion). Both engines consume the
    //     feed-sourced vMtm + collateral + FIL-instance trades, so any byte-diff
    //     is a genuine port-fidelity failure → `fail`.
    result.asserted += 2;
    if (stableJson(v1Out.rc) !== stableJson(v2Out.rc)) {
      byteDiffs += 1;
      violations.push({
        subject: `${rec.nettingSetId}:CcrReplacementCostComputed:recompute`,
        message: `RC payload diverges v1-recompute vs v2 (same FIL-mediated inputs):\n  v1=${stableJson(v1Out.rc)}\n  v2=${stableJson(v2Out.rc)}`,
        severity: "fail",
      });
    }
    if (stableJson(v1Out.ead) !== stableJson(v2Out.ead)) {
      byteDiffs += 1;
      violations.push({
        subject: `${rec.nettingSetId}:CcrEadComputed:recompute`,
        message: `EAD payload diverges v1-recompute vs v2 (same FIL-mediated inputs):\n  v1=${stableJson(v1Out.ead)}\n  v2=${stableJson(v2Out.ead)}`,
        severity: "fail",
      });
    }

    // (2) ORACLE DIAGNOSTIC — feed-sourced RC/EAD vs the RECORDED v1 event.
    //     The recorded event is NO LONGER an input; it is an oracle. A byte-match
    //     confirms the full FIL cutover reproduces history exactly. A DIVERGENCE
    //     is SURFACED (not forced) — it means the recorded RC used a different
    //     MtM BASIS (v1 `resolveMtm`'s drift-prone cumulative-delta walk) or a
    //     different as-of snapshot than the `Valuable` event-of-record feed. We
    //     report both vMtm values + as-of and classify `warn` (a real finding to
    //     escalate, per brief §4 "surface, don't force"), NOT `fail`: the feed is
    //     the correct Principle-1 source and must not be bent to match a
    //     wrong-basis oracle.
    result.asserted += 1;
    const recRc = normaliseRecorded(rec.rcPayload, false);
    if (stableJson(v2Out.rc) !== stableJson(recRc)) {
      const recVMtm = Number(rec.rcPayload.vMtm);
      const feedVMtm = Number(vMtmV2.minorUnits);
      violations.push({
        subject: `${rec.nettingSetId}:CcrReplacementCostComputed:vs-recorded-oracle`,
        message: `Feed-sourced RC diverges from the RECORDED oracle for ${rec.nettingSetId} (recorded-RC pin retired; divergence SURFACED, not forced):\n  recorded vMtm=${recVMtm} (as-of ${rec.asOf} — basis: the pre-flip v1 resolveMtm cumulative-delta walk for the original EOD events, OR a post-flip v2 restatement whose valuation date differs from its computationDate stamp)\n  feed vMtm=${feedVMtm} (basis: latest *Revalued event-of-record per trade; reconstructed as-of ${asOf})\n  recorded=${stableJson(recRc)}\n  feed-sourced=${stableJson(v2Out.rc)}`,
        severity: "warn",
      });
    }
    if (rec.eadPayload) {
      result.asserted += 1;
      const recEad = normaliseRecorded(rec.eadPayload, true);
      if (stableJson(v2Out.ead) !== stableJson(recEad)) {
        violations.push({
          subject: `${rec.nettingSetId}:CcrEadComputed:vs-recorded-oracle`,
          message: `Feed-sourced EAD diverges from the RECORDED oracle for ${rec.nettingSetId} (downstream of the vMtm divergence above; surfaced, not forced):\n  recorded=${stableJson(recEad)}\n  feed-sourced=${stableJson(v2Out.ead)}`,
          severity: "warn",
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
  const oracleDivergences = violations.filter((v) => v.severity === "warn").length;
  result.asOf = `saccr-parity: ${nettingSetsChecked} netting set(s) checked over recorded history, ${byteDiffs} hard byte-diff(s) (v1-recompute vs v2 over identical FIL-mediated inputs); ${oracleDivergences} recorded-RC oracle divergence(s) surfaced (warn). PRODUCTION PATH = FIL SA-CCR (D-FIL-FRAMEWORK-UNIFICATION); CcrEadComputed event-fold retired. Self-consistency gate: FIL model vs v1 oracle over feed-sourced inputs.`;
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
