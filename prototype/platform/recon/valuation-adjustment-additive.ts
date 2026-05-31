// platform/recon/valuation-adjustment-additive.ts
//
// Vera continuous-controls pipeline: valuation-adjustment-additive.
//
// Asserts the integrity of the valuation-adjustment / prudent-valuation AVA
// framework (Rohan, WS-PRODUCT-CONTROL):
//
//   1. ADDITIVITY — every PrudentValuationAvaAggregated umbrella event's
//      `totalAvaZarMinor` equals the sum of its PRESENT category lines
//      (`amountZarMinor` where `present === true`). Absent categories must be
//      excluded from the total, never folded in as a silent 0. (The event's own
//      zod .refine enforces this at construction; this recon re-asserts it over
//      the live store so a hand-crafted / migrated event cannot drift.)
//
//   2. NO SILENT ZERO — every category line is either present-with-a-figure or
//      absent-with-a-reason. A line with `present === false` MUST carry an
//      `absentReason`; a line with `present === true` whose `amountZarMinor`
//      is 0 is allowed only as an explicit present-zero (it is a recorded
//      figure, not a missing input). An absent line that was folded into the
//      total is a fail.
//
//   3. IPV → MARKET-PRICE-UNCERTAINTY LINKAGE — where IpvExceptionRaised
//      variances exist in the store, the `market-price-uncertainty` AVA
//      category on the latest umbrella MUST be present (the IPV variances feed
//      it). An absent market-price-uncertainty category while IPV variances
//      exist is a broken linkage → fail.
//
// EMPTY-STORE POSTURE. On a fresh runner with no PrudentValuationAvaAggregated
// events, missing-event findings are downgraded to `info` and `ok: true`
// (mirrors document-registration.ts): an empty store means the framework has
// never run on this bench, not that an invariant is broken. Real drift —
// umbrella events present but an invariant violated — still fails hard.
//
// Mode: blocking (non-zero exit on any `fail`). Wired into
//       `bun run ci:recon:domain` via `bun run recon:valuation-adjustment-additive`.
//
// Authority: Camille (CFO) recommendation R2; IFRS 13; CRR Art 105 /
//   SA-Basel prudent-valuation; D-TRUSTED-FIGURES-PROGRAM-V1 (no silent zero).
// Author: Rohan (Risk engineer, engineering), under
//   brief:rohan:valuation-adjustment-prudent-valuation-reserve-f:2026-05-31.

import { eventStore } from "../composition";
import { nowUtc } from "../core/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "valuation-adjustment-additive";

interface AvaCategoryLine {
  adjustmentType: string;
  present: boolean;
  amountZarMinor: number;
  absentReason?: string;
}

interface UmbrellaPayload {
  aggregationId: string;
  valuationDate: string;
  totalAvaZarMinor: number;
  categories: AvaCategoryLine[];
}

export interface RunOpts {
  /**
   * Test override: synthetic umbrella payloads to assert over instead of the
   * live store. When provided, the empty-store downgrade is bypassed (the
   * supplied set IS the universe).
   */
  readonly umbrellaOverrides?: readonly UmbrellaPayload[];
  /**
   * Test override: whether IPV variance data exists (drives assertion 3). When
   * omitted, derived from the live store's IpvExceptionRaised events.
   */
  readonly ipvVariancesExistOverride?: boolean;
}

function ipvVariancesExist(): boolean {
  for (const e of eventStore.replay({ type: "IpvExceptionRaised" })) {
    const p = e.payload as { divergenceZar?: unknown };
    if (typeof p.divergenceZar === "number") return true;
  }
  return false;
}

function loadUmbrellasFromStore(): UmbrellaPayload[] {
  const out: UmbrellaPayload[] = [];
  for (const e of eventStore.replay({ type: "PrudentValuationAvaAggregated" })) {
    const p = e.payload as Record<string, unknown>;
    const cats = Array.isArray(p.categories) ? (p.categories as AvaCategoryLine[]) : [];
    out.push({
      aggregationId: typeof p.aggregationId === "string" ? p.aggregationId : "(unknown)",
      valuationDate: typeof p.valuationDate === "string" ? p.valuationDate : "(unknown)",
      totalAvaZarMinor: typeof p.totalAvaZarMinor === "number" ? p.totalAvaZarMinor : Number.NaN,
      categories: cats,
    });
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const synthetic = opts.umbrellaOverrides !== undefined;
  const umbrellas = opts.umbrellaOverrides ? [...opts.umbrellaOverrides] : loadUmbrellasFromStore();
  const ipvExist =
    opts.ipvVariancesExistOverride !== undefined
      ? opts.ipvVariancesExistOverride
      : synthetic
        ? false
        : ipvVariancesExist();

  // -------------------------------------------------------------------------
  // Empty-store posture: no umbrella events → downgrade to info / ok.
  // -------------------------------------------------------------------------
  if (umbrellas.length === 0 && !synthetic) {
    return {
      pipeline: PIPELINE,
      ok: true,
      asserted: 0,
      violations: [
        {
          subject: PIPELINE,
          message:
            "No PrudentValuationAvaAggregated events in the store — valuation-adjustment framework has not run on this bench yet. " +
            "Run the valuation-adjustment engine (platform/market-risk/valuation-adjustment-engine.ts) to populate.",
          severity: "info",
        },
      ],
      asOf: nowUtc(),
    };
  }

  for (const u of umbrellas) {
    const subject = `PrudentValuationAvaAggregated:${u.aggregationId}`;

    // --- Assertion 2: no silent zero — present/absent split well-formed. ---
    for (const c of u.categories) {
      asserted += 1;
      if (c.present === false) {
        if (!c.absentReason || c.absentReason.trim().length === 0) {
          violations.push({
            subject: `${subject}/${c.adjustmentType}`,
            message: `absent AVA category "${c.adjustmentType}" carries no absentReason — an absent category must record WHY (no silent zero: absence is explicit, never an unexplained 0)`,
            severity: "fail",
          });
        }
      }
    }

    // --- Assertion 1: additivity — total == Σ present categories. ----------
    asserted += 1;
    const presentSum = u.categories
      .filter((c) => c.present)
      .reduce((s, c) => s + c.amountZarMinor, 0);
    if (Number.isNaN(u.totalAvaZarMinor) || u.totalAvaZarMinor !== presentSum) {
      violations.push({
        subject,
        message: `AVA additivity violated: totalAvaZarMinor=${u.totalAvaZarMinor} but Σ present categories=${presentSum}. The umbrella total must equal the sum of present categories only; absent categories must be excluded, never folded in as 0.`,
        severity: "fail",
      });
    }

    // --- Assertion 3: IPV → market-price-uncertainty linkage. --------------
    asserted += 1;
    if (ipvExist) {
      const mpu = u.categories.find((c) => c.adjustmentType === "market-price-uncertainty");
      if (!mpu || mpu.present === false) {
        violations.push({
          subject: `${subject}/market-price-uncertainty`,
          message:
            "IPV variances exist in the store but the market-price-uncertainty AVA category is absent — broken linkage. IPV variances (IpvExceptionRaised.divergenceZar) must feed the market-price-uncertainty AVA (CRR Art 105(10)).",
          severity: "fail",
        });
      }
    }
  }

  const hasFailures = violations.some((v) => v.severity === "fail");
  result.ok = !hasFailures;
  result.asserted = asserted;
  result.violations = violations;
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint — invoked by `bun run recon:valuation-adjustment-additive`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  const statusLabel = result.ok ? "PASS" : "FAIL";
  console.log(
    `[${PIPELINE}] ${statusLabel} — ${result.asserted} asserted, ${result.violations.length} violation(s)`,
  );
  if (result.violations.length > 0) {
    for (const v of result.violations) {
      const prefix = v.severity === "fail" ? "  FAIL" : v.severity === "warn" ? "  WARN" : "  INFO";
      console.log(`${prefix}  ${v.subject}: ${v.message}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}
