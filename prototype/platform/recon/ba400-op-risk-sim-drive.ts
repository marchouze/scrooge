// platform/recon/ba400-op-risk-sim-drive.ts
//
// recon:ba400-op-risk-sim-drive — ENFORCING gate for the simulator-first
// operational-risk capital + RWA (D-BA-RETURN-SIMULATOR-FIRST, Phase A).
//
// FIVE ASSERTION FAMILIES:
//
//   (A) SIMULATED READ DRIVES THE BA 400 SMA ENGINE (live store). With a
//       simulated-inclusive read of the LIVE event store (seeded by `ci:migrate`
//       via `scripts/sim/seed-operating-income-sim-v1.ts`), the BA 400 SMA fold
//       must produce the HAND-COMPUTED golden case (OPE25 §25.2–§25.7) — a
//       domain-truth oracle, NOT internal consistency:
//         ILDC = Min(|120m − 45m|, 2.25% × 2,000m) + 5m = 50m  (the NII CAP binds)
//         SC   = Max(18m,9m) + Max(40m,12m) = 58m
//         FC   = |22m| + |7m| = 29m
//         BI   = 137m (Bucket 1) → BIC = 12% × 137m = 16.44m → ILM=1 → op-RWA = 205.5m
//       DATA-DEPENDENT: fires only when the seeded snapshot is present (so a clean
//       store does not manufacture a pass); when present, a wrong figure is a FAIL.
//
//   (B) PRODUCTION READ STAYS ZERO (live store). With a production-ONLY read, the
//       SAME store's SMA income adapter MUST find NO snapshot (op-RWA 0). The
//       simulated income statement is invisible to production pre-licence-day —
//       the R300m-into-Prod regression guard. A non-null production read is a FAIL.
//
//   (C) BA 700 OP-RWA LEG WIRED (live store). The assembled BA 700 capital
//       return's operationalRwa equals the SMA op-RWA under the simulated lens
//       and 0 under the production lens — the last missing BA 700 RWA leg
//       (GAP-BA700-OPERATIONAL-RWA CLOSED). DATA-DEPENDENT on the seed.
//
//   (D) BORN-V2 REGISTRATION. OperatingIncomeStatementSnapshotted is REGISTERED
//       and tagged `v2-parallel` (never `v1-only`) — a clean-store-provable
//       construction condition. Always asserts.
//
//   (E) ILDC CAP IS LOAD-BEARING (in-memory oracle). A self-contained oracle
//       with an UNcapped NII (small interest-earning assets) yields a different
//       BI than the capped case — proves the cap is real arithmetic, not a
//       coincidence of the seed. Always asserts.
//
// SEVERITY: ENFORCING. The structural legs (D, E) always assert. The live golden
// legs (A, B, C) are data-dependent: they fire only when the seeded snapshot is
// present (so a clean store does not manufacture a pass), but when it IS present
// a wrong figure / leaked production read is a hard FAIL.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-CAPITAL-ASSET-CLASS-V1; D-PROVENANCE-FILTER-ENFORCEMENT;
//   OPE25 / BCBS SCO (SMA); SARB Reg 33 revised; SARB PA D5/2025 §2.1.18; Reg 38.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import { makeOperatingIncomeStatementSnapshotted } from "../event-store/event-types/operating-income-statement";
import { simulatedTag } from "../event-store/provenance";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { EventStore } from "../event-store/store";
import { computeBA700V2 } from "../projections/ba700-v2";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import { buildBa400SmaInput } from "../reporting/ba-400-sma-income-adapter";
import { generateBa400Sma } from "../reporting/ba-400-sma-op-risk";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba400-op-risk-sim-drive";
const ENTITY = "LE-ZA-HOZ-BANK";
const PERIOD_END = "2026-06-30";
const FUNCTIONAL = "ZAR" as Currency;

// Golden-case oracle values (minor cents = MAJOR × 100). OPE25 §25.2–§25.7.
const GOLDEN_BI_MINOR = 13_700_000_000; // R137,000,000
const GOLDEN_BIC_MINOR = 1_644_000_000; // R16,440,000
const GOLDEN_OP_RWA_MINOR = 20_550_000_000; // R205,500,000

const zar = (m: string) => encodeMoney(money(m, FUNCTIONAL));

/**
 * In-memory ILDC-cap oracle. Two snapshots, identical except for interest-
 * earning assets: one where the NII cap BINDS (small IEA) and one where it does
 * NOT (large IEA). The capped BI must be strictly less than the uncapped BI —
 * proving the 2.25% cap is real arithmetic (a wrong/absent cap would make the
 * two equal). Self-contained — always asserts.
 */
function ildcCapOracle(): { cappedBiMinor: number; uncappedBiMinor: number } {
  const base = {
    entity: ENTITY,
    asOf: PERIOD_END,
    periodId: "period:recon-oracle",
    functionalCurrency: FUNCTIONAL,
    interestIncome: zar("100000000"),
    interestExpense: zar("0"),
    dividendIncome: zar("0"),
    feeIncome: zar("0"),
    feeExpense: zar("0"),
    otherOperatingIncome: zar("0"),
    otherOperatingExpense: zar("0"),
    netPnlTradingBook: zar("0"),
    netPnlBankingBook: zar("0"),
  };
  // Capped: IEA small → cap = 2.25% × 100m = R2.25m < |NII| R100m → ILDC capped.
  const capped = generateBa400Sma({ ...base, interestEarningAssets: zar("100000000") });
  // Uncapped: IEA huge → cap = 2.25% × 100,000m = R2,250m > |NII| R100m → no cap.
  const uncapped = generateBa400Sma({ ...base, interestEarningAssets: zar("100000000000") });
  return { cappedBiMinor: capped.biMinor, uncappedBiMinor: uncapped.biMinor };
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // -----------------------------------------------------------------------
  // (D) Born-V2 registration — clean-store-provable.
  // -----------------------------------------------------------------------
  asserted += 1;
  const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === "OperatingIncomeStatementSnapshotted");
  if (!entry) {
    violations.push({
      subject: `${PIPELINE}:registry-missing`,
      severity: "fail",
      message:
        '"OperatingIncomeStatementSnapshotted" is not in the event type registry. The BA 400 SMA income adapter cannot fold it. Authority: D-BA-RETURN-SIMULATOR-FIRST.',
    });
  } else if (entry.v2Status !== "v2-parallel") {
    violations.push({
      subject: `${PIPELINE}:unexpected-status`,
      severity: "fail",
      message: `"OperatingIncomeStatementSnapshotted" is tagged "${entry.v2Status}" — expected "v2-parallel" (born-V2; never widen the v1-only estate). Authority: D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1.`,
    });
  }

  // -----------------------------------------------------------------------
  // (E) ILDC cap is load-bearing — in-memory oracle, always asserts.
  // -----------------------------------------------------------------------
  asserted += 1;
  const { cappedBiMinor, uncappedBiMinor } = ildcCapOracle();
  if (!(cappedBiMinor < uncappedBiMinor)) {
    violations.push({
      subject: `${PIPELINE}:ildc-cap-not-load-bearing`,
      severity: "fail",
      message: `The ILDC 2.25%×IEA cap (OPE25 §25.3) is not affecting the Business Indicator: capped BI ${cappedBiMinor} ≥ uncapped BI ${uncappedBiMinor} (minor). The cap must reduce NII when |II−IE| exceeds 2.25%×IEA. Authority: OPE25 §25.3.`,
    });
  }

  // -----------------------------------------------------------------------
  // Live-store reads under BOTH provenance lenses. Save+restore the override.
  // -----------------------------------------------------------------------
  let simSma: ReturnType<typeof generateBa400Sma> | null = null;
  let prodInputNull = true;
  let simBa700OpRwa = 0;
  let simBa700Available = false;
  let prodBa700OpRwa = 0;
  let prodBa700Available = true;

  try {
    setDefaultProvenanceModeOverride("combined");
    const simInput = buildBa400SmaInput({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      periodId: `period:${ENTITY}:recon`,
      functionalCurrency: FUNCTIONAL,
      eventStore,
    });
    simSma = simInput !== null ? generateBa400Sma(simInput) : null;
    const simBa700 = computeBA700V2({ eventStore, asOf: PERIOD_END });
    simBa700OpRwa = simBa700.capitalAdequacy.operationalRwa;
    simBa700Available = simBa700.meta.operationalRwaAvailable;

    setDefaultProvenanceModeOverride("production-only");
    const prodInput = buildBa400SmaInput({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      periodId: `period:${ENTITY}:recon`,
      functionalCurrency: FUNCTIONAL,
      eventStore,
    });
    prodInputNull = prodInput === null;
    const prodBa700 = computeBA700V2({ eventStore, asOf: PERIOD_END });
    prodBa700OpRwa = prodBa700.capitalAdequacy.operationalRwa;
    prodBa700Available = prodBa700.meta.operationalRwaAvailable;
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }

  const seedPresent = simSma !== null;

  // -----------------------------------------------------------------------
  // (B) Production read stays ZERO — clean-store-provable + seed-present-proof.
  // (The income statement is simulated-tagged; the production lens excludes it.)
  // -----------------------------------------------------------------------
  asserted += 1;
  if (!prodInputNull || prodBa700Available || prodBa700OpRwa !== 0) {
    violations.push({
      subject: `${PIPELINE}:production-read-nonzero`,
      severity: "fail",
      message: `PRODUCTION-only BA 400 / BA 700 op-RWA read is NON-EMPTY (income-adapter null=${prodInputNull}, ba700 available=${prodBa700Available}, op-RWA=${prodBa700OpRwa} minor) — the simulated income statement must be invisible to the production read pre-licence-day (the R300m-into-Prod regression). A real production op-RWA would need a non-simulated provenance tag. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-PROVENANCE-FILTER-ENFORCEMENT.`,
    });
  }

  // -----------------------------------------------------------------------
  // (A) Simulated read drives the SMA engine to the golden case.
  //     DATA-DEPENDENT: fires only when the seeded snapshot is present.
  // -----------------------------------------------------------------------
  if (seedPresent && simSma !== null) {
    asserted += 1;
    if (simSma.biMinor !== GOLDEN_BI_MINOR) {
      violations.push({
        subject: `${PIPELINE}:bi-mismatch`,
        severity: "fail",
        message: `Simulated BA 400 Business Indicator ${simSma.biMinor} minor ≠ golden ${GOLDEN_BI_MINOR} minor (ILDC 50m + SC 58m + FC 29m). A consistent-but-wrong BI is a finding. Inspect scripts/sim/seed-operating-income-sim-v1.ts. Authority: OPE25 §25.2–§25.5.`,
      });
    }

    asserted += 1;
    if (!simSma.ildcNiiCapped) {
      violations.push({
        subject: `${PIPELINE}:ildc-cap-not-binding`,
        severity: "fail",
        message:
          "Seeded SMA income did not trip the ILDC NII cap (|120m−45m|=75m must exceed 2.25%×2,000m=45m). The seed must exercise the cap so the golden BI is a true OPE25 oracle. Authority: OPE25 §25.3.",
      });
    }

    asserted += 1;
    if (simSma.bicMinor !== GOLDEN_BIC_MINOR || simSma.bucket !== "bucket-1") {
      violations.push({
        subject: `${PIPELINE}:bic-mismatch`,
        severity: "fail",
        message: `Simulated BIC ${simSma.bicMinor} minor (bucket ${simSma.bucket}) ≠ golden ${GOLDEN_BIC_MINOR} minor (bucket-1; 12% × 137m). Authority: OPE25 §25.6.`,
      });
    }

    asserted += 1;
    if (simSma.ilm !== "1" || simSma.lossesUsedForIlm) {
      violations.push({
        subject: `${PIPELINE}:ilm-not-one`,
        severity: "fail",
        message: `Simulated ILM ${simSma.ilm} (lossesUsed=${simSma.lossesUsedForIlm}) — pre-licence the ILM must be 1 with no loss history (OPE25 §25.8; BA 400 R0010 = No). Authority: OPE25 §25.7–§25.8.`,
      });
    }

    asserted += 1;
    if (simSma.opRiskRwaMinor !== GOLDEN_OP_RWA_MINOR) {
      violations.push({
        subject: `${PIPELINE}:op-rwa-mismatch`,
        severity: "fail",
        message: `Simulated op-RWA ${simSma.opRiskRwaMinor} minor ≠ golden ${GOLDEN_OP_RWA_MINOR} minor (12.5 × 16.44m). Authority: OPE25; Reg 38.`,
      });
    }

    // -----------------------------------------------------------------------
    // (C) BA 700 op-RWA leg wired — the assembled return sources the real op-RWA.
    // -----------------------------------------------------------------------
    asserted += 1;
    if (!simBa700Available || simBa700OpRwa !== GOLDEN_OP_RWA_MINOR) {
      violations.push({
        subject: `${PIPELINE}:ba700-leg-mismatch`,
        severity: "fail",
        message: `BA 700 simulated op-RWA leg ${simBa700OpRwa} minor (available=${simBa700Available}) ≠ golden ${GOLDEN_OP_RWA_MINOR} minor — the BA 700 capital return must source the real SMA op-RWA (GAP-BA700-OPERATIONAL-RWA closed). Authority: D-BA-RETURN-SIMULATOR-FIRST; Reg 38.`,
      });
    }
  } else {
    // Seed absent: emit a self-contained in-memory oracle proof so the golden
    // arithmetic is still asserted (no manufactured green; the LIVE legs are
    // dormant, but the engine correctness is proven).
    asserted += 1;
    const store = new EventStore(":memory:");
    store.append(
      makeOperatingIncomeStatementSnapshotted({
        asOf: "2026-06-26T00:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "agent:atlas:recon-op-risk-oracle" },
        citations: ["D-BA-RETURN-SIMULATOR-FIRST", "urn:reg:bcbs:ope25"],
        eventId: "EV-RECON-OISIM-ORACLE",
        provenance: simulatedTag({
          scenario: "op-risk-income-sim-v1",
          sourceLineage: "platform/recon/ba400-op-risk-sim-drive.ts",
        }),
        payload: {
          snapshotId: "RECON-OISIM-ORACLE",
          periodEnd: PERIOD_END,
          averagingYears: 3,
          interestIncome: zar("120000000"),
          interestExpense: zar("45000000"),
          interestEarningAssets: zar("2000000000"),
          dividendIncome: zar("5000000"),
          feeIncome: zar("40000000"),
          feeExpense: zar("12000000"),
          otherOperatingIncome: zar("18000000"),
          otherOperatingExpense: zar("9000000"),
          netPnlTradingBook: zar("22000000"),
          netPnlBankingBook: zar("7000000"),
        },
      }),
    );
    try {
      setDefaultProvenanceModeOverride("combined");
      const oracleInput = buildBa400SmaInput({
        entity: ENTITY,
        periodEnd: PERIOD_END,
        periodId: "period:recon-oracle",
        functionalCurrency: FUNCTIONAL,
        eventStore: store,
      });
      const oracle = oracleInput !== null ? generateBa400Sma(oracleInput) : null;
      if (oracle === null || oracle.opRiskRwaMinor !== GOLDEN_OP_RWA_MINOR) {
        violations.push({
          subject: `${PIPELINE}:oracle-op-rwa-mismatch`,
          severity: "fail",
          message: `In-memory SMA oracle op-RWA ${oracle?.opRiskRwaMinor ?? "null"} minor ≠ golden ${GOLDEN_OP_RWA_MINOR} minor. Authority: OPE25; Reg 38.`,
        });
      }
    } finally {
      setDefaultProvenanceModeOverride(undefined);
    }
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  result.asOf =
    `ba400-op-risk-sim-drive [ENFORCING]: live income snapshot ${seedPresent ? "PRESENT" : "absent (golden legs via in-memory oracle)"}; ` +
    `sim BI=${simSma?.biMinor ?? "n/a"} op-RWA=${simSma?.opRiskRwaMinor ?? "n/a"} minor; ` +
    `ba700 sim op-RWA=${simBa700OpRwa} (available=${simBa700Available}); ` +
    `prod income-null=${prodInputNull} ba700 op-RWA=${prodBa700OpRwa}; ` +
    `${violations.filter((v) => v.severity === "fail").length} fail.`;
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
