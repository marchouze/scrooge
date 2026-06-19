// platform/projections/markets/fil-fx-limit-utilisation-v2.ts
//
// FIL-sourced RAS B3 (FX market-risk) limit-utilisation projection — the V2
// numerator for the FX desk headroom panel (WS-FX-OTC-CLOSURE FU3).
//
// ## Why this exists
//
// The legacy headroom panel (`/api/markets/fx/headroom`) folds the V1
// `FxTradeExecuted` near-leg into the B3 market-risk bucket via the V1
// LimitUtilisationProjection (`limit-utilisation.ts`). The FX FU3 follow-on
// takes the FX desk's B3 utilisation onto the FIL data model: the B3 FX
// net-open-position EXPOSURE is derived from the SAME FIL FX instances the V2
// BA-320 projection (`computeBA320V2`) and the V2 risk panel already consume —
// `FilInstrumentCreated` / `FilInstrumentTerminated` (FX) — never from
// `FxTradeExecuted`. The B3 LIMIT (denominator) is still sourced from the
// `RasLimitSchedulePublished` event Helena (Chief Risk Officer, governance)
// publishes — that is the canonical RAS schedule and there is no separate "V2
// RAS schedule"; the schedule is the limit framework, not a trade-leg event.
//
// SCOPE — B3 ONLY. The FX desk headroom panel is the FX market-risk view; B3
// (the FX net-open-position cluster) is the cluster the FX book drives. The
// other RAS clusters (B1 pre-settlement credit, B2 settlement-window, B4 IRRBB,
// B5) fold non-FX or settlement-lifecycle events and are out of scope for the
// FX FU3 V2 cutover (they stay on the V1 limit-utilisation projection, consumed
// by the legacy desk pages). This projection surfaces ONLY the B3 FX line, fed
// from FIL. The honesty contract below states this explicitly.
//
// ## Honesty (Engineering Charter cmd 3 — never a silent zero)
//
// The projection carries an explicit `dataState`:
//   - "live"     — a B3 RAS schedule row AND ≥1 FIL FX position both present.
//   - "no-limit" — FIL FX positions exist but NO B3 row in the RAS schedule
//                  (cannot compute utilisation without a denominator; the
//                  exposure is reported, utilisation is null).
//   - "empty"    — no FIL FX positions on this store (build-phase clean store:
//                  no executed FX trades pre-licence-day). Exposure is a true
//                  zero ONLY here, and it is labelled, not silent.
// A missing functional-currency rate for a position is surfaced via the BA-320
// V2 coverage status + gap markers (carried through), never papered over.
//
// ## Citations (Principle 2 — every quantity cites upward)
//   - B3 exposure basis: Reg 28(5); BCBS D352 §718(xiii) (FX open-position) —
//     via `computeBA320V2` (D-V1-REMOVAL-PHASE-3E).
//   - RAS limit framework: ORG-PR-19 / ORG-PR-48 (RAS), ORG-JSE-IRC-01.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO scope-extension 2026-06-19);
//   D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-PHASE-3E (BA-320 V2 FX basis).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Core banking platform architect, engineering).

import type { RasLimitRow, RasLimitSchedulePublishedPayload } from "../../event-store/event-types/trading";
import type { EventStore } from "../../event-store/store";
import type { MarketDataStore } from "../../market-data/store";
import { computeBA320V2 } from "../ba320-fx-v2";

// ---------------------------------------------------------------------------
// Output shape — name-free; mirrors the V1 HeadroomRow fields the desk consumes
// so a future desk-page migration is a field-for-field swap, plus an honest
// dataState + the FIL coverage carried through.
// ---------------------------------------------------------------------------

export type FilFxHeadroomDataState = "live" | "no-limit" | "empty";

export interface FilFxHeadroomB3Row {
  /** Always "B3" — the FX market-risk net-open-position cluster. */
  readonly cluster: "B3";
  /** RAS limit row name (from the published schedule), or a placeholder. */
  readonly limitName: string;
  /**
   * Aggregate FX net-open-position EXPOSURE in functional-currency MINOR units,
   * derived from the FIL FX instances (max(Σ|long|, Σ|short|) per Reg 28(5)).
   * `null` when no FIL FX position carries a functional-currency figure
   * (fail-closed — never a fabricated number).
   */
  readonly currentExposureFunctionalMinor: number | null;
  /**
   * B3 limit VALUE in functional-currency MINOR units, from the RAS schedule.
   * `null` when no B3 row is published (→ utilisation cannot be computed).
   */
  readonly limitValueFunctionalMinor: number | null;
  /** Utilisation (0.0–9.99, capped) = exposure / limit. `null` when either is null. */
  readonly utilisationPct: number | null;
  /** RAG status vs the schedule's amber/red thresholds. `null` when utilisation is null. */
  readonly ragStatus: "green" | "amber" | "red" | null;
  /** Functional (reporting) currency the figures are denominated in. */
  readonly currency: string;
  /** Number of open FIL FX instances contributing to the B3 exposure. */
  readonly openInstanceCount: number;
}

export interface FilFxHeadroomView {
  readonly dataState: FilFxHeadroomDataState;
  /** Why the panel is empty / no-limit. `null` when live. */
  readonly reason: string | null;
  /** The single B3 FX line. */
  readonly b3: FilFxHeadroomB3Row;
  /** BA-320 V2 coverage carried through (no-data | partial | complete). */
  readonly coverageStatus: "no-data" | "partial" | "complete";
  /** Advisory gap markers from the BA-320 V2 FIL projection (tracked, not hidden). */
  readonly gaps: readonly string[];
  readonly asOf: string;
}

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Latest-wins fold of the published RAS schedule, returning the B3 row (if any).
 * The RAS schedule is the canonical limit framework Helena publishes
 * (`RasLimitSchedulePublished`); a later schedule supersedes an earlier one
 * (D-MARKETS-SCHEMA-FOUNDATION Slice 5). We take the B3 row from the most recent
 * schedule by event order (the store replays oldest-first).
 */
function latestB3LimitRow(store: Pick<EventStore, "replay">): RasLimitRow | null {
  let b3: RasLimitRow | null = null;
  for (const e of store.replay({ type: "RasLimitSchedulePublished" })) {
    const payload = e.payload as unknown as RasLimitSchedulePublishedPayload;
    const row = payload.limits.find((r) => r.cluster === "B3");
    // Each newer schedule overwrites; a schedule that omits B3 clears it (the
    // schedule is authoritative for what limits are live).
    b3 = row ?? null;
  }
  return b3;
}

function ragStatus(
  utilisationPct: number,
  amberThreshold: number,
  redThreshold: number,
): "green" | "amber" | "red" {
  if (utilisationPct >= redThreshold) return "red";
  if (utilisationPct >= amberThreshold) return "amber";
  return "green";
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build the FIL-sourced B3 FX headroom view.
 *
 * EXPOSURE (numerator): the FX open-position figure from `computeBA320V2`
 *   (max(Σ|long|, Σ|short|) in functional-currency minor units; Reg 28(5)).
 *   This is the SAME FIL FX basis the V2 risk panel reports — single source of
 *   truth (no parallel fold). Fail-closed: `null` when no rate makes the charge
 *   computable.
 *
 * LIMIT (denominator): the B3 row from the latest published RAS schedule. The
 *   schedule's `limitValue` is in MAJOR units of its `currency`; we convert to
 *   minor units to compare against the BA-320 V2 minor-unit exposure. A
 *   `pct-capital` basis is NOT resolved here (the FX headroom view does not hold
 *   the capital figure); when the B3 row is `pct-capital` we fall back to its
 *   stored `limitValue` and flag it in the reason — never silently treat it as
 *   an absolute amount with the wrong scale.
 */
export function buildFilFxHeadroomView(
  store: EventStore,
  marketDataStore: MarketDataStore,
  nowIso: string,
): FilFxHeadroomView {
  const ba320 = computeBA320V2({
    eventStore: store,
    asOf: nowIso,
    marketDataStore,
    entity: ANCHOR_ENTITY,
  });
  const functionalCurrency = ba320.meta.functionalCurrency;
  const openInstanceCount = ba320.meta.openFxInstanceCount;

  // EXPOSURE: the FX open-position figure is max(Σ|long|, Σ|short|). BA-320 V2
  // exposes the two sides; recompute the regulatory figure here so the headroom
  // numerator is the SAME quantity the Reg 28(5) charge is taken on (8% × this).
  // `null` when the charge is uncomputable (no functional figure / no rate).
  const totalLong = ba320.fx.totalLongZarMinor;
  const totalShort = ba320.fx.totalShortZarMinor;
  const exposureMinor =
    totalLong !== null && totalShort !== null ? Math.max(totalLong, totalShort) : null;

  const b3LimitRow = latestB3LimitRow(store);

  // ---- empty: no FIL FX positions at all (clean build-phase store) ----
  if (openInstanceCount === 0) {
    return {
      dataState: "empty",
      reason:
        "No open FX FIL instruments on this store. The build-phase store carries no " +
        "executed FX trades yet (no real customers pre-licence-day), so the B3 FX " +
        "net-open-position is a labelled zero — not a silent zero. The B3 utilisation " +
        "lights up once FIL FX instruments exist. Authority: D-FX-OTC-CLOSURE-BACKLOG.",
      b3: {
        cluster: "B3",
        limitName: b3LimitRow?.limitName ?? "B3 — FX net open position",
        currentExposureFunctionalMinor: 0,
        limitValueFunctionalMinor:
          b3LimitRow !== null ? Math.round(b3LimitRow.limitValue * 100) : null,
        utilisationPct: b3LimitRow !== null ? 0 : null,
        ragStatus: b3LimitRow !== null ? "green" : null,
        currency: functionalCurrency,
        openInstanceCount: 0,
      },
      coverageStatus: ba320.fx.coverageStatus,
      gaps: [...ba320.gaps],
      asOf: nowIso,
    };
  }

  // ---- no-limit: FIL positions exist but no B3 schedule row ----
  if (b3LimitRow === null) {
    return {
      dataState: "no-limit",
      reason:
        "FIL FX instruments are present, but no B3 row exists in the latest published " +
        "RAS limit schedule (RasLimitSchedulePublished). The B3 FX net-open-position " +
        "exposure is reported below; utilisation is null because there is no limit " +
        "denominator to divide by — never a fabricated 0% or 100%. Publish a B3 RAS " +
        "limit to light up the RAG. Authority: D-FX-OTC-CLOSURE-BACKLOG; ORG-PR-19.",
      b3: {
        cluster: "B3",
        limitName: "B3 — FX net open position (no RAS limit published)",
        currentExposureFunctionalMinor: exposureMinor,
        limitValueFunctionalMinor: null,
        utilisationPct: null,
        ragStatus: null,
        currency: functionalCurrency,
        openInstanceCount,
      },
      coverageStatus: ba320.fx.coverageStatus,
      gaps: [...ba320.gaps],
      asOf: nowIso,
    };
  }

  // ---- live: both present ----
  // The schedule limitValue is MAJOR units; convert to minor to match BA-320 V2.
  const limitValueMinor = Math.round(b3LimitRow.limitValue * 100);
  const isPctCapital = (b3LimitRow.limitBasis ?? "absolute") === "pct-capital";

  let utilisationPct: number | null = null;
  let rag: "green" | "amber" | "red" | null = null;
  const gaps = [...ba320.gaps];
  if (exposureMinor !== null && limitValueMinor > 0) {
    const raw = exposureMinor / limitValueMinor;
    utilisationPct = Math.min(raw, 9.99);
    rag = ragStatus(raw, b3LimitRow.breachThresholdAmber, b3LimitRow.breachThresholdRed);
  }
  if (isPctCapital) {
    gaps.push(
      "GAP-FU3-B3-PCT-CAPITAL: the published B3 RAS row uses a `pct-capital` basis, " +
        "but the FX headroom view does not hold the net-qualifying-capital figure, so " +
        "the denominator falls back to the row's stored `limitValue`. Wire the capital " +
        "figure (as the V1 limit-utilisation projection does via LimitUtilisationDeps) " +
        "to resolve the pct-capital limit exactly. Authority: D-FX-OTC-CLOSURE-BACKLOG.",
    );
  }
  const exposureUncomputable = exposureMinor === null;
  if (exposureUncomputable) {
    gaps.push(
      "GAP-FU3-B3-RATE: the B3 FX exposure is null because the BA-320 V2 FX charge is " +
        "uncomputable on this store (a position lacks a functional-currency rate — " +
        "fail-closed). Utilisation is null rather than a fabricated figure. See the " +
        "GAP-3E-005 marker. Authority: D-FX-OTC-CLOSURE-BACKLOG; D-V1-REMOVAL-PHASE-3E.",
    );
  }

  return {
    dataState: "live",
    reason: exposureUncomputable
      ? "FIL FX instruments and a B3 RAS limit are both present, but the B3 exposure is " +
        "null (fail-closed: a position lacks a functional-currency rate). Utilisation is " +
        "null — not a fabricated figure. See gaps."
      : null,
    b3: {
      cluster: "B3",
      limitName: b3LimitRow.limitName,
      currentExposureFunctionalMinor: exposureMinor,
      limitValueFunctionalMinor: limitValueMinor,
      utilisationPct,
      ragStatus: rag,
      currency: functionalCurrency,
      openInstanceCount,
    },
    coverageStatus: ba320.fx.coverageStatus,
    gaps,
    asOf: nowIso,
  };
}
