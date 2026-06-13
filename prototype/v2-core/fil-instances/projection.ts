// v2-core/fil-instances/projection.ts
//
// FIL instance PROJECTION — folds the FIL instance lifecycle event family into
// a register of live FIL instances keyed by instance URN.
//
// Principle 1: the register is a QUERY; the lifecycle events are canonical. The
// projection is pure — it takes an iterable of lifecycle events (read from the
// v2 anchor store by the caller) and folds them into the current-state view.
//
// Each register row exposes:
//   - taxonomy type (`fil:type:…`), current lifecycle stage, tenant,
//   - the economic terms a RiskMeasurable consumer needs (notional, currency,
//     counterparty / netting set, asset class, direction, settlement date,
//     hedging-set tag), and
//   - the originating v1 event ref (Principle 1 lineage).
//
// `remainingYears(asOf)` is DERIVED from the static `settlementDate` minus the
// query as_of — the as-of-sensitive maturity is NOT stored on the event (it
// would go stale); it is computed exactly as the v1 SA-CCR adapter does, so the
// SA-CCR parity proof is byte-clean.
//
// PACKAGE BOUNDARY: inside `v2-core/` — no v1 imports.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   Principle 1; Principle 2.
// Author: Atlas (Substrate Architect, engineering).

import type { FilLifecycleStage } from "../fil-core/lifecycle";
import type { Money } from "../fil-core/primitives";
import type { FilInstanceUrn, FilTypeUrn } from "../fil-core/urn";
import type {
  FilEconomicTerms,
  FilInstanceLifecycleEvent,
  FilOriginatingEventRef,
} from "./events";

// ---------------------------------------------------------------------------
// The register row — the current-state view of one FIL instance.
// ---------------------------------------------------------------------------

export interface FilInstanceRow {
  /** `fil:inst:<tenant>:<instance-id>`. */
  readonly instance: FilInstanceUrn;
  /** `fil:type:<asset-class>:<family>:<slug>@maj.min`. */
  readonly type: FilTypeUrn;
  /** The tenant axis. */
  readonly tenant: string;
  /** Current lifecycle stage (latest transition wins, P1). */
  readonly stage: FilLifecycleStage;
  /** Economic terms (latest snapshot — re-stamped by amendments). */
  readonly economicTerms: FilEconomicTerms;
  /** The originating v1 event (Principle 1 lineage). */
  readonly originatingEvent: FilOriginatingEventRef;
  /** asOf of the first (creation) event. */
  readonly createdAsOf: string;
  /** asOf of the most recent lifecycle event. */
  readonly lastAsOf: string;
}

/** The folded register: instanceUrn → current-state row. */
export type FilInstanceRegister = ReadonlyMap<FilInstanceUrn, FilInstanceRow>;

// ---------------------------------------------------------------------------
// Fold.
// ---------------------------------------------------------------------------

interface MutableRow {
  instance: FilInstanceUrn;
  type: FilTypeUrn;
  tenant: string;
  stage: FilLifecycleStage;
  economicTerms: FilEconomicTerms;
  originatingEvent: FilOriginatingEventRef;
  createdAsOf: string;
  lastAsOf: string;
}

/**
 * Fold the lifecycle event family into the current-state register. Events are
 * applied in iteration order; the caller passes them in store order (creation
 * before amendments/termination for any given instance). A terminated instance
 * stays in the register with its terminal stage (it is a closed-but-recorded
 * instance — Principle 1; consumers filter on stage).
 */
export function foldFilInstances(
  events: Iterable<FilInstanceLifecycleEvent>,
): FilInstanceRegister {
  const byUrn = new Map<FilInstanceUrn, MutableRow>();

  for (const ev of events) {
    switch (ev.kind) {
      case "FilInstrumentCreated": {
        // Latest creation wins per URN (idempotent re-materialisation).
        byUrn.set(ev.instance, {
          instance: ev.instance,
          type: ev.type,
          tenant: ev.tenant,
          stage: ev.initialStage,
          economicTerms: ev.economicTerms,
          originatingEvent: ev.originatingEvent,
          createdAsOf: ev.asOf,
          lastAsOf: ev.asOf,
        });
        break;
      }
      case "FilInstrumentAmended": {
        const prev = byUrn.get(ev.instance);
        if (prev) {
          prev.economicTerms = ev.economicTerms;
          prev.lastAsOf = ev.asOf;
        }
        break;
      }
      case "FilInstrumentTerminated": {
        const prev = byUrn.get(ev.instance);
        if (prev) {
          prev.stage = ev.terminalStage;
          prev.lastAsOf = ev.asOf;
        }
        break;
      }
    }
  }

  const out = new Map<FilInstanceUrn, FilInstanceRow>();
  for (const [urn, row] of byUrn) out.set(urn, { ...row });
  return out;
}

// ---------------------------------------------------------------------------
// Query helpers — the RiskMeasurable consumer reads positions off these.
// ---------------------------------------------------------------------------

/** `true` iff the instance is still on the book (active — not terminal). */
export function isLiveStage(stage: FilLifecycleStage): boolean {
  return stage === "active" || stage === "proposed";
}

/** Live instances only (active/proposed), as an array. */
export function liveInstances(register: FilInstanceRegister): FilInstanceRow[] {
  const out: FilInstanceRow[] = [];
  for (const row of register.values()) {
    if (isLiveStage(row.stage)) out.push(row);
  }
  return out;
}

/**
 * Remaining tenor in years from `asOf` to the instance's settlement date (≥ 0).
 * Derived — NOT stored — so it tracks the query as_of exactly as the v1 SA-CCR
 * adapter (`positions-to-summaries.remainingYears`) does. Identical arithmetic:
 * `(settlement - asOf) / (365.25 * 24 * 60 * 60 * 1000)`, floored at 0.
 */
export function remainingYears(settlementIso: string, asOf: string): number {
  const ms = new Date(settlementIso).getTime() - new Date(asOf).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/** Notional convenience accessor (the economic-terms Money). */
export function instanceNotional(row: FilInstanceRow): Money {
  return row.economicTerms.notional;
}
