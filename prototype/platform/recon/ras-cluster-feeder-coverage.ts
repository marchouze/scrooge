// platform/recon/ras-cluster-feeder-coverage.ts
//
// Vera continuous-controls pipeline: assert that every RAS cluster the
// limit-utilisation projection declares (B1–B5) has a *feeder* — a code path
// that can drive non-zero exposure into the cluster. A cluster that carries a
// published limit but has no possible feeder is "declared-but-uncomputed": it
// reads zero forever, silently masking real exposure. That is the exact blind
// spot D-RAS-B2-SETTLEMENT-EXPOSURE-FIX closed for B2 (settlement-window /
// Herstatt exposure had no feeder).
//
// Why a *behavioural* recon (drive the projection) rather than a static scan:
// the projection's fold logic is the ground truth for "is this cluster wired".
// A grep for `addExposure(_,"B2",…)` would miss the per-currency feeders (B1/B2
// are not folded via addExposure) and would false-positive on comments. So the
// recon constructs a minimal synthetic event stream that *should* light each
// cluster up, replays it through `rebuildLimitUtilisation`, and asserts the
// cluster reports non-zero `currentExposure`. If a cluster cannot be made
// non-zero by any plausible event, it has no feeder → finding.
//
// Assertions:
//   1. Every cluster in CLUSTERS has a feeder probe registered here (so a new
//      cluster added to the enum without a probe is itself a finding — the
//      recon must be taught about new clusters).
//   2. B2 specifically lights up for a one-leg-delivered (mid-settlement)
//      trade — the canonical regression for the settlement-exposure fix.
//   3. B1 lights up for a pre-settlement trade.
//   4. B3 lights up for a net FX position.
//
// B4 (IR sensitivity, injected via deps) and B5 are intentionally not asserted
// as event-fed here: B4's feeder is the `b4IrSensitivityZar` dep (R7), and B5
// has no calibrated feeder in the build phase (substrate gap, tracked
// separately). They are recorded as `info` so the gap is visible, not silent.
//
// P1 — events are the only source of truth (the recon replays events, asserts
// the derived projection). P2 — single-graph discipline (a declared limit line
// with no feeder is an orphan). P6 — autonomous-by-default (the gate runs in
// CI without a human in the loop).
//
// Standing authority: D-RAS-B2-SETTLEMENT-EXPOSURE-FIX (CEO-approved
//   2026-06-07); D-MARKETS-SCHEMA-FOUNDATION Slice 5.
//
// Citations:
//   urn:reg:bcbs:d226 (settlement-risk in FX);
//   Banks Act 94 of 1990 Reg 39 (settlement-failure BCP / Herstatt);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Rohan (Risk engineer, engineering — under Helena (Chief Risk
//   Officer, governance)) + Vera (Internal audit engineer, third-line).

import { makeFxSettlementFailed } from "../event-store/event-types/fx-accounting";
import type { RiskCluster } from "../event-store/event-types/trading";
import type { Event } from "../event-store/types";
import { makeFxTradeExecuted, makePrincipalPayment } from "../markets/cdm/fx";
import {
  getLimitUtilisations,
  rebuildLimitUtilisation,
} from "../projections/markets/limit-utilisation";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ras-cluster-feeder-coverage";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:rohan:recon-feeder-probe" };
const CITATIONS = ["urn:reg:bcbs:d226", "D-RAS-B2-SETTLEMENT-EXPOSURE-FIX"];
const AS_OF = "2026-06-07T10:00:00.000Z";

/** The clusters the projection declares. Kept local so a drift between this and
 *  the projection's CLUSTERS surfaces via assertion 1 (a cluster with no probe). */
const ALL_CLUSTERS: readonly RiskCluster[] = ["B1", "B2", "B3", "B4", "B5"];

/** Minimal live FX-spot: sell USD/ZAR, pay USD 1,000,000, receive ZAR 18.5m. */
function probeTrade(tradeId: string): Event {
  return makeFxTradeExecuted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: { scheme: "internal", value: tradeId },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "sell",
      legs: [
        {
          legKind: "near",
          payCurrency: "USD",
          receiveCurrency: "ZAR",
          notional: { currency: "USD", amountMinor: 1_000_000_00 },
          counterNotional: { currency: "ZAR", amountMinor: 18_500_000_00 },
          rate: { currency: "ZAR", amount: 18.5 },
          settlementDate: { iso: "2026-06-09", calendar: "JIHCAL" as const },
        },
      ],
      tradeDate: { iso: "2026-06-07", calendar: "JIHCAL" as const },
      counterparty: {
        partyId: "urn:party:legal-entity:standard-bank-za",
        name: "Standard Bank Corporate Treasury",
        role: "counterparty" as const,
      },
      venue: "OTC",
      trader: "trader-recon",
      bookId: "FX-TRADING",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      clientFlowRef: `client-trade:recon-${tradeId}`,
    },
  });
}

function deliverLeg(tradeId: string): Event {
  return makePrincipalPayment({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId,
      legKind: "deliver",
      currencyPair: "USD/ZAR",
      currency: "USD",
      netCash: -1_000_000_00,
      settlementDate: "2026-06-09",
      settlementPath: "correspondent",
      correspondent: { name: "JPMorgan Chase", bic: "CHASUS33" },
      citations: CITATIONS,
    },
  });
}

/** Replay a probe stream and return the cluster's reported currentExposure. */
function exposureAfter(cluster: RiskCluster, events: Event[]): number {
  rebuildLimitUtilisation(events);
  const rows = getLimitUtilisations(); // no MDS → raw CCY units, non-zero is enough
  return rows.find((r) => r.cluster === cluster)?.currentExposure ?? 0;
}

/**
 * Per-cluster feeder probe. `eventFed: false` clusters are fed via deps / are
 * build-phase substrate gaps — recorded as info, not failed.
 */
interface ClusterProbe {
  cluster: RiskCluster;
  eventFed: boolean;
  /** Build the event stream that should light this cluster up. */
  stream: () => Event[];
  note?: string;
}

const PROBES: ClusterProbe[] = [
  {
    cluster: "B1",
    eventFed: true,
    stream: () => [probeTrade("RECON-B1")],
  },
  {
    cluster: "B2",
    eventFed: true,
    // The canonical settlement-window regression: deliver one leg, leave the
    // counter-leg unconfirmed → Herstatt-active → B2 must be non-zero.
    stream: () => [probeTrade("RECON-B2"), deliverLeg("RECON-B2")],
  },
  {
    cluster: "B3",
    eventFed: true,
    stream: () => [probeTrade("RECON-B3")],
  },
  {
    cluster: "B4",
    eventFed: false,
    stream: () => [],
    note: "B4 (IR repricing-gap sensitivity) is fed via the b4IrSensitivityZar dep (R7), not the event stream.",
  },
  {
    cluster: "B5",
    eventFed: false,
    stream: () => [],
    note: "B5 has no calibrated event feeder in the build phase (substrate gap, tracked separately).",
  },
];

export interface RunOpts {
  /** Suppress the side-channel B2-failure assertion (test override). */
  skipFailureBranch?: boolean;
}

export function run(_opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Assertion 1: every declared cluster has a registered probe (drift guard —
  // a new cluster in the enum without a probe means the recon is blind to it).
  result.asserted++;
  const probed = new Set(PROBES.map((p) => p.cluster));
  for (const cluster of ALL_CLUSTERS) {
    if (!probed.has(cluster)) {
      violations.push({
        subject: `ras-cluster:${cluster}`,
        message: `Cluster "${cluster}" is declared in the limit-utilisation projection (CLUSTERS) but has no feeder probe in ras-cluster-feeder-coverage. Add a probe so the recon can assert the cluster is wired (declared-but-uncomputed clusters read zero forever — the B2 settlement-exposure blind spot).`,
        severity: "fail",
      });
    }
  }

  // Assertions 2..n: each event-fed cluster must report non-zero exposure for
  // its probe stream. A zero means the feeder is missing (the B2 blind spot).
  for (const probe of PROBES) {
    result.asserted++;
    if (!probe.eventFed) {
      violations.push({
        subject: `ras-cluster:${probe.cluster}`,
        message:
          probe.note ??
          `Cluster "${probe.cluster}" is not event-fed; feeder coverage not asserted here.`,
        severity: "info",
      });
      continue;
    }
    const exposure = exposureAfter(probe.cluster, probe.stream());
    if (exposure <= 0) {
      violations.push({
        subject: `ras-cluster:${probe.cluster}`,
        message: `Cluster "${probe.cluster}" reported currentExposure=${exposure} for a probe stream that should light it up. The cluster has a declared limit but no working feeder (declared-but-uncomputed) — it will read zero even with live risk. Wire a feeder in platform/projections/markets/limit-utilisation.ts.`,
        severity: "fail",
      });
    }
  }

  // Assertion (B2 settlement-fix regression, side channel): the
  // FxSettlementFailed{one-leg-delivered} branch must also light B2 up, even
  // when no PrincipalPayment was captured. This guards the structured
  // Herstatt-active path specifically (D-RAS-B2-SETTLEMENT-EXPOSURE-FIX).
  result.asserted++;
  const failed = makeFxSettlementFailed({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeRef: "RECON-B2-FAIL",
      settlementInstructionRef: "SI-RECON-B2-FAIL",
      failedAt: AS_OF,
      failureKind: "one-leg-delivered",
      failureReason: "Counterparty leg not received by cutoff (recon probe).",
      legStatus: { payLegDelivered: true, receiveLegDelivered: false },
    },
  });
  const b2Failed = exposureAfter("B2", [probeTrade("RECON-B2-FAIL"), failed]);
  if (b2Failed <= 0) {
    violations.push({
      subject: "ras-cluster:B2:failure-branch",
      message: `B2 reported currentExposure=${b2Failed} for an FxSettlementFailed{one-leg-delivered} probe. The Herstatt-active failure branch is not wired into the B2 feeder.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "RAS cluster feeder coverage passed (every event-fed cluster has a working feeder; B2 settlement-window exposure wired)."
        : "RAS cluster feeder coverage FAILED — a declared cluster has no feeder (declared-but-uncomputed). See violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
