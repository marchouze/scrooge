// platform/alm/ftp-curve-publisher.test.ts
//
// Guardrail for the FTP curve publisher: the ZAR overnight FTP curve must be
// sourced from the latest SARB ZARONIA fixing (no hardcoded constant), be
// idempotent per report date, and emit NOTHING when no ZARONIA fixing exists
// (no-silent-constant — the carry component then degrades loudly).
//
// Authority: D-PNL-ATTR-FTP-CURVE-FIX; D-TRUSTED-FIGURES-PROGRAM-V1.

import { describe, expect, it } from "bun:test";

import { EventStore } from "../event-store/store";
import { deriveSarbZaroniaTickId } from "../market-data/sarb-zaronia-ingester";
import { MarketDataStore } from "../market-data/store";
import { computePnLAttribution } from "../product-control/pnl-attribution";
import { isPresent } from "../types/financial-input";
import { publishFtpCurveIfMissing } from "./ftp-curve-publisher";

const AS_OF = "2026-06-02T08:00:00.000Z";

/** Seed one ZARONIA fixing into a fresh in-memory market-data store. */
function seedZaronia(md: MarketDataStore, asOfDate: string, rate: string): void {
  md.append({
    id: deriveSarbZaroniaTickId(asOfDate),
    source: "zaronia-sarb",
    instrument: "ZARONIA",
    dataType: "zaronia-rate",
    provenance: "production",
    asOf: `${asOfDate}T17:00:00+02:00`,
    payload: {
      rate,
      convention: "overnight-compounded",
      refTime: "17:00:00+02:00",
      fixingVariant: "build-phase-fixture",
    },
  });
}

const silentLogger = { warn: (): void => {} };

describe("ftp-curve-publisher", () => {
  it("publishes a ZAR curve from the latest ZARONIA fixing (≤ asOf)", () => {
    const store = new EventStore();
    const md = new MarketDataStore(":memory:");
    // Two fixings — the publisher must pick the latest on or before asOf (05-27).
    seedZaronia(md, "2026-05-26", "0.0794");
    seedZaronia(md, "2026-05-27", "0.0793");

    const result = publishFtpCurveIfMissing({
      eventStore: store,
      marketDataStore: md,
      asOf: AS_OF,
      logger: silentLogger,
    });

    expect(result.published).toBe(true);
    expect(result.reason).toBe("published");
    expect(result.rate).toBeCloseTo(0.0793, 6);

    const curves = [...store.replay({ type: "FtpCurvePublished" })];
    expect(curves.length).toBe(1);
    const p = curves[0]?.payload as {
      currency: string;
      effectiveDate: string;
      tenors: { tenor: string; rate: number; basis: string }[];
    };
    expect(p.currency).toBe("ZAR");
    expect(p.effectiveDate).toBe("2026-06-02");
    const overnight = p.tenors.find((t) => t.tenor === "1D");
    expect(overnight?.rate).toBeCloseTo(0.0793, 6);
    expect(overnight?.basis).toBe("ZARONIA");
    md.close();
  });

  it("is idempotent — a second call for the same date publishes nothing", () => {
    const store = new EventStore();
    const md = new MarketDataStore(":memory:");
    seedZaronia(md, "2026-05-27", "0.0793");

    const first = publishFtpCurveIfMissing({
      eventStore: store,
      marketDataStore: md,
      asOf: AS_OF,
      logger: silentLogger,
    });
    const second = publishFtpCurveIfMissing({
      eventStore: store,
      marketDataStore: md,
      asOf: AS_OF,
      logger: silentLogger,
    });

    expect(first.published).toBe(true);
    expect(second.published).toBe(false);
    expect(second.reason).toBe("already-present");
    expect([...store.replay({ type: "FtpCurvePublished" })].length).toBe(1);
    md.close();
  });

  it("publishes NOTHING when no ZARONIA fixing exists (no silent constant)", () => {
    const store = new EventStore();
    const md = new MarketDataStore(":memory:"); // empty — no ZARONIA

    const result = publishFtpCurveIfMissing({
      eventStore: store,
      marketDataStore: md,
      asOf: AS_OF,
      logger: silentLogger,
    });

    expect(result.published).toBe(false);
    expect(result.reason).toBe("no-zaronia");
    expect([...store.replay({ type: "FtpCurvePublished" })].length).toBe(0);
    md.close();
  });

  it("resolves the P&L attribution carry component once the curve is published", () => {
    const store = new EventStore();
    const md = new MarketDataStore(":memory:");
    seedZaronia(md, "2026-05-27", "0.0793");

    const reportDate = "2026-06-02";
    const priorDate = "2026-06-01";

    // Before publishing: no FTP curve → carry resolves `absent` (degraded).
    const before = computePnLAttribution(store, reportDate, priorDate);
    expect(isPresent(before.carry)).toBe(false);

    // Publish the curve from ZARONIA, then re-run: carry is now `present`
    // (value 0 on an empty book, but RESOLVED — the input is no longer missing).
    publishFtpCurveIfMissing({
      eventStore: store,
      marketDataStore: md,
      asOf: `${reportDate}T08:00:00.000Z`,
      logger: silentLogger,
    });
    const after = computePnLAttribution(store, reportDate, priorDate);
    expect(isPresent(after.carry)).toBe(true);
    md.close();
  });
});
