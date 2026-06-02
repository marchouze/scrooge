// platform/alm/ftp-curve-publisher.ts
//
// FTP (Funds Transfer Pricing) curve publisher — build-phase ZAR overnight curve.
//
// Publishes a daily ZAR `FtpCurvePublished` event whose overnight (1D) rate is
// the latest SARB ZARONIA fixing read from MarketDataStore — NOT a hardcoded
// constant. This is the funding-cost input the Product Control P&L attribution
// carry component resolves against (resolveCarry() in pnl-attribution.ts matches
// currency=ZAR, effectiveDate=reportDate, tenor "ON" | "1D"). With a curve
// present, the pnl-attribution figure lifts from `degraded` (carry absent) to
// `ok` (carry resolved).
//
// NO SILENT CONSTANTS (the point): when no ZARONIA fixing is available in the
// market-data store, the publisher emits NOTHING — the carry component then
// resolves `absent` (degraded, surfaced loudly) rather than a fabricated rate.
// This replaces the earlier inline flat-8.50% synthetic that lived in
// bea-product-control-daily.ts.
//
// Idempotent: skips when a ZAR `FtpCurvePublished` for the asOf date already
// exists in the store.
//
// Authority: D-PNL-ATTR-FTP-CURVE-FIX; D-TRUSTED-FIGURES-PROGRAM-V1.
// Author: Ravi (Treasury / ALM engineer, engineering).

import { newEventId, nowUtc } from "../core/types";
import { makeFtpCurvePublished } from "../event-store/event-types/ftp";
import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const RAVI_ACTOR = { type: "service" as const, id: "agent:ravi-treasury-alm" };
const CITATIONS = ["D-PNL-ATTR-FTP-CURVE-FIX", "D-TRUSTED-FIGURES-PROGRAM-V1"];

/** Market-data lineage of the SARB ZARONIA overnight fixing. */
const ZARONIA_SOURCE = "zaronia-sarb";
const ZARONIA_INSTRUMENT = "ZARONIA";

export interface PublishFtpCurveDeps {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  /** ISO 8601 timestamp — the report instant the curve is published for. */
  readonly asOf: string;
  readonly logger?: { warn: (obj: unknown, msg: string) => void };
}

export interface PublishFtpCurveResult {
  readonly published: boolean;
  readonly reason: "published" | "already-present" | "no-zaronia";
  /** The ZARONIA rate published (decimal), present only when reason === "published". */
  readonly rate?: number;
}

/**
 * Publish a ZAR FTP curve for `asOf`'s date if one is not already present,
 * sourcing the overnight rate from the latest SARB ZARONIA fixing (≤ asOf).
 *
 * Pure side-effect on the event store (append-only); returns a structured
 * result describing what happened. No silent constant: a missing ZARONIA
 * fixing yields `published: false, reason: "no-zaronia"` and emits nothing.
 */
export function publishFtpCurveIfMissing(deps: PublishFtpCurveDeps): PublishFtpCurveResult {
  const { eventStore, marketDataStore, asOf, logger } = deps;
  const reportDate = asOf.slice(0, 10);

  // Idempotency — skip if a ZAR curve for today already exists.
  try {
    for (const e of eventStore.replay({ type: "FtpCurvePublished" })) {
      const p = e.payload as { currency?: unknown; effectiveDate?: unknown };
      if (p.currency === "ZAR" && p.effectiveDate === reportDate) {
        return { published: false, reason: "already-present" };
      }
    }
  } catch {
    // FtpCurvePublished not registered yet — it registers on the append below.
  }

  // Read the latest available ZARONIA fixing (the most recent tick on or before
  // asOf). ZARONIA is tagged production (regulator-grade published rate) even in
  // the build phase, so the read is provenance="production".
  const tick = marketDataStore.getLatest(
    ZARONIA_SOURCE,
    ZARONIA_INSTRUMENT,
    asOf,
    "production", // provenance: production-only — never read a simulated rate
  );
  if (!tick) {
    logger?.warn(
      { reportDate },
      "ftp-curve-publisher: no ZARONIA fixing available — FTP curve not published (carry degrades, no silent constant)",
    );
    return { published: false, reason: "no-zaronia" };
  }

  const rate = Number((tick.payload as { rate?: unknown }).rate);
  if (!Number.isFinite(rate) || rate < 0) {
    logger?.warn(
      { reportDate, raw: (tick.payload as { rate?: unknown }).rate },
      "ftp-curve-publisher: ZARONIA fixing is not a usable rate — FTP curve not published",
    );
    return { published: false, reason: "no-zaronia" };
  }

  eventStore.append(
    makeFtpCurvePublished({
      asOf: reportDate,
      entity: BANK_ENTITY,
      actor: RAVI_ACTOR,
      citations: CITATIONS,
      payload: {
        curveId: `FTP-ZAR-${reportDate}-${newEventId().slice(0, 8)}`,
        currency: "ZAR",
        effectiveDate: reportDate,
        // Overnight tenor only — the FX-SPOT desk carry component funds against
        // the ON rate. resolveCarry() matches "ON" first, then "1D"; ZARONIA is
        // an overnight-compounded benchmark so "1D" is the canonical tenor here.
        tenors: [{ tenor: "1D", rate, basis: "ZARONIA" }],
        methodology: "pool-rate",
        publishedBy: "ravi",
        publishedAt: nowUtc(),
      },
    }),
  );
  return { published: true, reason: "published", rate };
}
