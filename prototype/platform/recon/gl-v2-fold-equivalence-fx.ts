// platform/recon/gl-v2-fold-equivalence-fx.ts
//
// recon:gl-v2-fold-equivalence-fx — ENFORCING byte-equivalence gate.
//
// Proves that the FX contribution to the V2 trial balance, computed as a PURE
// FOLD over the primary FIL FX events (gl-projection-v2 → fx-fold, reading NO
// stored GlPostingEmitted), reproduces BYTE-FOR-BYTE the FX numbers the FX
// posting RULES produce — i.e. the legs the dual-run GL engine emits today.
//
// REFERENCE (golden). The byte-for-byte reference is the lifted FX posting rules
// (`posting-rules-v2/fx.ts`) applied to the SAME production FIL FX events the
// fold reads, accumulated into per-(accountCode,currency) minor balances. The GL
// engine (`gl-posting-engine-v2.ts`) MATERIALISES exactly those lifted legs into
// GlPostingEmitted, so this reference IS the engine's behaviour — without the
// engine's append-time `tenant:`-prefix constraint that the real entity-id
// tenant fixtures would trip. The unit proof
// (`posting-rules-v2/fx-fold.test.ts`) additionally exercises the full
// engine→GlPostingEmitted→fold path end-to-end.
//
// SCOPE: FX only. The reference applies the FX rules to the FX FIL events; the
// fold's FX contribution is compared against it. Non-FX GlPostingEmitted is not
// in scope here (it is covered by recon:gl-v2-parity).
//
// STEP D — EVENT FOLD RETIRED TO ORACLE-ONLY (D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
// After the Step C cutover the GL projection sources FX/capital legs from the
// STATE derivations (deriveFxInstanceLegs / deriveCapitalInstanceLegs); NO
// production path consumes `foldFxContributionLegs` / `foldCapitalContributionLegs`
// any more. The chosen retirement is OPTION (b): keep the event folds strictly as
// recon ORACLES — they survive here as the independent third leg of the byte
// proof (state == golden == event-fold), giving a stronger cross-check than a
// two-way state==golden comparison would. Their oracle-only status (no production
// importer) is now MECHANICALLY ENFORCED by `recon:fil-state-surface-isolation`
// (Step D). This gate stays GREEN and NON-VACUOUS on the seeded anchor store.
//
// CLEAN-STORE BEHAVIOUR: on a store with no FIL FX events / no treatment modules,
// both sides are empty → the gate passes vacuously (0 asserted divergences).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Engineering Charter (fail-closed,
//   whole-tree integrity).
// Author: Atlas (Substrate Architect, engineering).

import type {
  FilFxSettlementConfirmedPayload,
  FilInstrumentAmendedPayload,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
  FilNdfFixingObservedPayload,
} from "../../v2-core/fil-instances/events";
import type { TradeSettlementExecutedPayload } from "../../v2-core/fil-instances/trade-settlement";
import {
  postFxDerecognitionLegs,
  postFxFvociReclassLegs,
  postFxNdfFixingLegs,
  postFxSettlementLegs,
  postFxSwapFarLegLegs,
  postFxSwapNearLegLegs,
} from "../../v2-core/posting-rules/fx-settlement";
import { postTradeSettlementLegs } from "../../v2-core/posting-rules/trade-settlement";
import {
  type FxPostingLeg,
  isFxObsCommitmentLeg,
  postFxCancellationReversalLegs,
  postFxCloseLegs,
  postFxInitialRecognitionLegs,
  postFxObsCommitmentReleaseLegs,
  postFxRevaluationLegs,
} from "../accounting/posting-rules-v2/fx";
import {
  type FxFoldLeg,
  foldFxContributionLegs,
  foldTreatmentRegisterFromStore,
} from "../accounting/posting-rules-v2/fx-fold";
import { deriveFxInstanceLegs } from "../accounting/posting-rules-v2/fx-instance-fold";
import { eventStore } from "../composition";
import { amountToMinorUnits } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { computeTrialBalanceV2Uncached } from "../projections/gl-projection-v2";
import { V2_ANCHOR_ENTITY, V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "gl-v2-fold-equivalence-fx";

const FX_FIL_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentAmended",
  "FilInstrumentTerminated",
  // DUAL-READ settlement (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL) + FVTPL settlement
  // (D-FX-TRADE-DATE-FVTPL-OBS): the golden must model the settlement legs the
  // fold produces, else a settled FX diverges golden vs fold. Both settlement
  // carriers route through the SAME lifted rules the fold uses.
  "TradeSettlementExecuted",
  "FilFxSettlementConfirmed",
  "FilNdfFixingObserved",
] as const;

/** Accumulate one signed-minor leg into the per-(accountCode|currency) map. */
function accumulate(map: Map<string, number>, leg: FxPostingLeg | FxFoldLeg): void {
  if (!leg.postingDate) return;
  if (leg.postingDate < V2_PERIOD_START || leg.postingDate > V2_PERIOD_END) return;
  const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
  const legMinor = Number(amountToMinorUnits(legMoney));
  const key = `${leg.accountCode}|${leg.amount.currency}`;
  map.set(key, (map.get(key) ?? 0) + (leg.creditDebit === "debit" ? legMinor : -legMinor));
}

/** Golden terminal-event legs — mirrors `fx-fold.postFxTerminationLegs`. */
function goldenTerminationLegs(payload: FilInstrumentTerminatedPayload): FxPostingLeg[] {
  const { derecognitionTerms, fvociReclassTerms } = payload;
  if (derecognitionTerms === undefined && fvociReclassTerms === undefined) {
    return postFxCloseLegs(payload);
  }
  const postingDate = payload.asOf.substring(0, 10);
  const legs: FxPostingLeg[] = [];
  if (derecognitionTerms !== undefined) {
    legs.push(
      ...postFxDerecognitionLegs({
        instanceId: payload.instance,
        tenantId: payload.tenant,
        postingDate,
        currency: derecognitionTerms.accumulatedUnrealised.currency,
        accumulatedUnrealised: derecognitionTerms.accumulatedUnrealised.amount,
      }),
    );
  }
  if (fvociReclassTerms !== undefined) {
    legs.push(
      ...postFxFvociReclassLegs({
        instanceId: payload.instance,
        tenantId: payload.tenant,
        postingDate,
        currency: fvociReclassTerms.accumulatedOci.currency,
        accumulatedOci: fvociReclassTerms.accumulatedOci.amount,
      }),
    );
  }
  return legs;
}

/** Golden settlement-event legs — mirrors `fx-fold.postFxSettlementConfirmedLegs`. */
function goldenSettlementConfirmedLegs(payload: FilFxSettlementConfirmedPayload): FxPostingLeg[] {
  const settlementInput = {
    instanceId: payload.instance,
    tenantId: payload.tenant,
    postingDate: payload.asOf.substring(0, 10),
    boughtCurrency: payload.boughtBooked.currency,
    boughtBookedAmount: payload.boughtBooked.amount,
    boughtSettledAmount: payload.boughtSettled.amount,
    soldCurrency: payload.soldBooked.currency,
    soldBookedAmount: payload.soldBooked.amount,
    soldSettledAmount: payload.soldSettled.amount,
  };
  switch (payload.legRole) {
    case "spot":
      return postFxSettlementLegs(settlementInput);
    case "swap-near":
      return postFxSwapNearLegLegs(settlementInput);
    case "swap-far":
      return postFxSwapFarLegLegs(settlementInput);
  }
}

/**
 * Golden reference: apply the LIFTED FX rules to the production FX FIL events,
 * gated by the SAME treatment decision the fold uses (so a fail-closed instance
 * contributes to neither side). Returns per-(accountCode|currency) minor balance.
 */
function goldenFxBalances(): Map<string, number> {
  const filter = defaultProvenanceFilter();
  const register = foldTreatmentRegisterFromStore(eventStore);
  const map = new Map<string, number>();

  // Reuse the fold's own treatment decision by folding once and inspecting which
  // instances it admitted: the fold already encapsulates "preferred product
  // binding, else fail-closed fallback". The golden then applies the lifted rules
  // to the SAME admitted instances. To keep the golden an INDEPENDENT computation
  // (not a copy of the fold's leg output), it re-applies the lifted rule per
  // admitted FIL event here.
  const admitted = new Set(
    foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    }).legs.map((l) => l.filEventId),
  );
  void register; // registry is consumed inside foldFxContributionLegs; kept for parity of inputs.

  // Bare-cancellation reversal (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN). The
  // golden mirrors the fold: a bare cancellation (terminalStage "cancelled", no
  // derecognition / FVOCI terms) reverses the instance's accumulated opening
  // position. Scanned across the FULL terminated stream (no provenance filter) so a
  // build-phase-fixture cancellation is observed when the production creation folds.
  const bareCancellations = new Map<string, { instance: string; tenant?: string; asOf: string }>();
  for (const e of eventStore.replay({
    entity: V2_ANCHOR_ENTITY,
    type: "FilInstrumentTerminated",
  })) {
    const p = e.payload as unknown as FilInstrumentTerminatedPayload;
    if (p.terminalStage !== "cancelled") continue;
    if (p.derecognitionTerms !== undefined || p.fvociReclassTerms !== undefined) continue;
    if (p.instance === undefined || p.instance.length === 0) continue;
    const existing = bareCancellations.get(p.instance);
    if (existing === undefined || p.asOf < existing.asOf) {
      bareCancellations.set(p.instance, {
        instance: p.instance,
        ...(p.tenant !== undefined ? { tenant: p.tenant } : {}),
        asOf: p.asOf,
      });
    }
  }
  // Settlement / maturity terminations (D-FX-TRADE-DATE-FVTPL-OBS) — release the
  // trade-date OBS commitment. Scanned PROVENANCE-DECOUPLED, mirroring the fold's
  // `findSettledTerminations`.
  const settledTerminations = new Map<
    string,
    { instance: string; tenant?: string; asOf: string }
  >();
  for (const e of eventStore.replay({
    entity: V2_ANCHOR_ENTITY,
    type: "FilInstrumentTerminated",
  })) {
    const p = e.payload as unknown as FilInstrumentTerminatedPayload;
    if (p.terminalStage !== "settled" && p.terminalStage !== "matured") continue;
    if (p.instance === undefined || p.instance.length === 0) continue;
    const existing = settledTerminations.get(p.instance);
    if (existing === undefined || p.asOf < existing.asOf) {
      settledTerminations.set(p.instance, {
        instance: p.instance,
        ...(p.tenant !== undefined ? { tenant: p.tenant } : {}),
        asOf: p.asOf,
      });
    }
  }
  const openingByInstance = new Map<string, FxPostingLeg[]>();
  const obsOpeningByInstance = new Map<string, FxPostingLeg[]>();

  for (const t of FX_FIL_EVENT_TYPES) {
    for (const e of eventStore.replay({ entity: V2_ANCHOR_ENTITY, type: t })) {
      if (!eventMatchesProvenanceFilter(e, filter)) continue;
      if (!admitted.has(e.event_id)) continue;
      let legs: FxPostingLeg[] = [];
      let isOpening = false;
      switch (t) {
        case "FilInstrumentCreated":
          legs = postFxInitialRecognitionLegs(e.payload as unknown as FilInstrumentCreatedPayload);
          isOpening = true;
          break;
        case "FilInstrumentAmended":
          legs = postFxRevaluationLegs(e.payload as unknown as FilInstrumentAmendedPayload);
          isOpening = true;
          break;
        case "FilInstrumentTerminated":
          legs = goldenTerminationLegs(e.payload as unknown as FilInstrumentTerminatedPayload);
          break;
        case "TradeSettlementExecuted":
          legs = postTradeSettlementLegs(e.payload as unknown as TradeSettlementExecutedPayload);
          break;
        case "FilFxSettlementConfirmed":
          legs = goldenSettlementConfirmedLegs(
            e.payload as unknown as FilFxSettlementConfirmedPayload,
          );
          break;
        case "FilNdfFixingObserved": {
          const p = e.payload as unknown as FilNdfFixingObservedPayload;
          legs = postFxNdfFixingLegs({
            instanceId: p.instance,
            tenantId: p.tenant,
            postingDate: p.asOf.substring(0, 10),
            settlementCurrency: p.settlementCurrency,
            netCashDifference: p.netCashDifference.amount,
          });
          break;
        }
      }
      // The settlement event keys on the TRADE (`tradeInstance`); every other
      // event keys on `instance` (mirrors fx-instance-fold.groupingKeyOf).
      const payloadAny = e.payload as { instance?: string; tradeInstance?: string };
      const instance =
        t === "TradeSettlementExecuted"
          ? (payloadAny.tradeInstance ?? "")
          : (payloadAny.instance ?? "");
      for (const leg of legs) {
        accumulate(map, leg);
        if (!leg.postingDate) continue;
        if (leg.postingDate < V2_PERIOD_START || leg.postingDate > V2_PERIOD_END) continue;
        // Window-passing opening legs for a bare-cancelled instance are captured to
        // reverse below (mirrors the fold's per-lens capture).
        if (isOpening && bareCancellations.has(instance)) {
          const acc = openingByInstance.get(instance) ?? [];
          acc.push(leg);
          openingByInstance.set(instance, acc);
        }
        // OBS opening legs for a settled/matured instance — released below.
        if (isOpening && settledTerminations.has(instance) && isFxObsCommitmentLeg(leg)) {
          const acc = obsOpeningByInstance.get(instance) ?? [];
          acc.push(leg);
          obsOpeningByInstance.set(instance, acc);
        }
      }
    }
  }

  // Apply the bare-cancellation reversal once per cancelled instance.
  for (const [instance, cancel] of bareCancellations) {
    const opening = openingByInstance.get(instance);
    if (opening === undefined || opening.length === 0) continue;
    for (const leg of postFxCancellationReversalLegs(opening, cancel)) accumulate(map, leg);
  }

  // Apply the OBS-commitment release once per settled/matured instance.
  for (const [instance, settle] of settledTerminations) {
    const obsOpening = obsOpeningByInstance.get(instance);
    if (obsOpening === undefined || obsOpening.length === 0) continue;
    for (const leg of postFxObsCommitmentReleaseLegs(obsOpening, settle)) accumulate(map, leg);
  }

  for (const [k, v] of [...map.entries()]) if (v === 0) map.delete(k);
  return map;
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    const golden = goldenFxBalances();

    // The fold's FX contribution as it surfaces in the combined trial balance: a
    // store with no non-FX GlPostingEmitted (the build-phase norm) means every
    // ACC-2100-* (FX) row in the TB is the fold's FX contribution. To isolate FX
    // robustly we recompute the FX-only balances directly from the fold legs.
    const fxLegs = foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });
    const folded = new Map<string, number>();
    for (const leg of fxLegs.legs) accumulate(folded, leg);
    for (const [k, v] of [...folded.entries()]) if (v === 0) folded.delete(k);

    // The STATE-DRIVEN derivation (Step B, D-FIL-CONSUMER-SURFACE-ARCHITECTURE):
    // legs derived by folding the FIL STATE register (NOT by replaying
    // FilInstrument* for state). The third comparison below proves it reproduces
    // the golden + event-fold net byte-for-byte BEFORE Step C cuts the trial
    // balance over to it. DARK: this gate is the only reader of it today.
    const stateLegs = deriveFxInstanceLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });
    const stateDerived = new Map<string, number>();
    for (const leg of stateLegs.legs) accumulate(stateDerived, leg);
    for (const [k, v] of [...stateDerived.entries()]) if (v === 0) stateDerived.delete(k);

    // (1) Same key set.
    const goldenKeys = [...golden.keys()].sort();
    const foldedKeys = [...folded.keys()].sort();
    result.asserted += 1;
    if (JSON.stringify(goldenKeys) !== JSON.stringify(foldedKeys)) {
      const onlyGolden = goldenKeys.filter((k) => !folded.has(k));
      const onlyFolded = foldedKeys.filter((k) => !golden.has(k));
      violations.push({
        subject: `${PIPELINE}:account-set-divergence`,
        message: `FX fold account/currency set diverges from the lifted-rule golden. Only-in-golden: [${onlyGolden.join(", ")}]; only-in-fold: [${onlyFolded.join(", ")}]. The FX trial-balance fold must reproduce the FX posting rules byte-for-byte. Inspect posting-rules-v2/fx-fold.ts treatment resolution. Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.`,
        severity: "fail",
      });
    }

    // (2) Byte-equal amounts on shared keys.
    for (const key of goldenKeys) {
      result.asserted += 1;
      const g = golden.get(key) ?? 0;
      const f = folded.get(key) ?? 0;
      if (g !== f) {
        violations.push({
          subject: `${PIPELINE}:amount-mismatch:${key}`,
          message: `FX fold amountMinor for "${key}" = ${f} but the lifted-rule golden = ${g}. Must byte-match. Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.`,
          severity: "fail",
        });
      }
    }

    // (3) STATE-DERIVATION byte-equivalence (Step B). The register-driven
    // `deriveFxInstanceLegs` net must equal BOTH the golden (lifted-rule reference)
    // AND the event-fold net, per (accountCode,currency). This is the safety net
    // proven before the Step C cutover: state-derivation == golden == event-fold.
    const stateKeys = [...stateDerived.keys()].sort();
    result.asserted += 1;
    if (JSON.stringify(stateKeys) !== JSON.stringify(goldenKeys)) {
      const onlyState = stateKeys.filter((k) => !golden.has(k));
      const onlyGolden = goldenKeys.filter((k) => !stateDerived.has(k));
      violations.push({
        subject: `${PIPELINE}:state-derivation-account-set-divergence`,
        message: `State-driven FX derivation account/currency set diverges from the golden. Only-in-state: [${onlyState.join(", ")}]; only-in-golden: [${onlyGolden.join(", ")}]. The register-driven derivation (deriveFxInstanceLegs) must reproduce the FX posting rules byte-for-byte. Inspect posting-rules-v2/fx-instance-fold.ts. Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE.`,
        severity: "fail",
      });
    }
    for (const key of goldenKeys) {
      result.asserted += 1;
      const g = golden.get(key) ?? 0;
      const s = stateDerived.get(key) ?? 0;
      if (g !== s) {
        violations.push({
          subject: `${PIPELINE}:state-derivation-amount-mismatch:${key}`,
          message: `State-driven FX derivation amountMinor for "${key}" = ${s} but the lifted-rule golden = ${g}. The register-driven derivation must byte-match the golden + event fold. Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE.`,
          severity: "fail",
        });
      }
    }
    // Cross-check directly against the event fold too (state == event-fold), so a
    // simultaneous drift on both vs the golden cannot mask a state≠event-fold gap.
    const stateVsFoldKeys = new Set([...stateKeys, ...foldedKeys]);
    for (const key of [...stateVsFoldKeys].sort()) {
      result.asserted += 1;
      const s = stateDerived.get(key) ?? 0;
      const f = folded.get(key) ?? 0;
      if (s !== f) {
        violations.push({
          subject: `${PIPELINE}:state-vs-event-fold-mismatch:${key}`,
          message: `State-driven derivation amountMinor for "${key}" = ${s} but the event fold = ${f}. deriveFxInstanceLegs must reproduce foldFxContributionLegs byte-for-byte (Step B safety net). Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE.`,
          severity: "fail",
        });
      }
    }

    // (4) Surface fail-closed skips as advisory info (no silent deferral — they
    // are visible, not swallowed). An unresolved instance is correct fail-closed
    // behaviour, not a divergence, so it does not fail the gate by itself.
    result.asserted += 1;
    if (fxLegs.skipped.length > 0) {
      for (const s of fxLegs.skipped) {
        violations.push({
          subject: `${PIPELINE}:fail-closed-skip:${s.instance}`,
          message: `FX fold skipped ${s.kind} ${s.instance} (fail-closed): ${s.reason} — ${s.detail}. This instance contributes to NEITHER the fold nor the golden (correct fail-closed). Resolve by binding a product (S0d) or declaring a unique FX posting-rules treatment.`,
          severity: "warn",
        });
      }
    }

    // (5) Cross-check against the projection trial balance: every FX (ACC-2100-*)
    // row in the full combined TB must equal the fold's FX figure (proves the
    // projection wiring, not just the helper, surfaces the folded FX numbers).
    const tb = computeTrialBalanceV2Uncached({
      eventStore,
      entity: V2_ANCHOR_ENTITY,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });
    for (const row of tb.rows) {
      if (!row.leafAccountId.startsWith("ACC-2100-")) continue; // FX account block
      result.asserted += 1;
      const key = `${row.leafAccountId}|${row.currency}`;
      const f = folded.get(key) ?? 0;
      if (row.amountMinor !== f) {
        violations.push({
          subject: `${PIPELINE}:projection-row-divergence:${key}`,
          message: `Trial-balance FX row "${key}" amountMinor=${row.amountMinor} but the fold computes ${f}. The projection must surface the fold's FX contribution unchanged. Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.`,
          severity: "fail",
        });
      }
    }

    result.asOf = `${PIPELINE}: golden FX accounts=${goldenKeys.length}, folded FX accounts=${foldedKeys.length}, state-derived FX accounts=${stateKeys.length}, fail-closed skips=${fxLegs.skipped.length}. ${
      violations.some((v) => v.severity === "fail")
        ? "DIVERGENCE"
        : "byte-equivalent (state==golden==event-fold)"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:fold-error`,
      message: `FX fold / golden threw: ${err instanceof Error ? err.message : String(err)}.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
