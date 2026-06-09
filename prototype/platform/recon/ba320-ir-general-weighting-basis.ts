// platform/recon/ba320-ir-general-weighting-basis.ts
//
// Continuous-controls pipeline: ba320-ir-general-weighting-basis.
//
// ─── THE DEFECT THIS GUARDS (WS-BA-RETURNS-FOLLOWON G1) ─────────────────────
// The BA 320 IR general-risk maturity ladder is fed by two adapters that BOTH
// push `IrMaturityBandRow` rows into the SAME per-band accumulators, which
// `combineIrGeneralLadders` then sums:
//   - ba-320-bond-events-adapter.ts → `nominalMinor × bandRiskWeight` (weighted nominal)
//   - ba-320-irs-events-adapter.ts  → maturity-method notional legs (also weighted nominal)
// The ORIGINAL defect was that the IRS adapter fed `Math.abs(dv01Raw)` — raw
// DV01 (rand-per-bp) — into those accumulators. Summing rand-per-bp with
// weighted nominal is an INCOMMENSURABLE-UNIT error: the combined ladder was
// meaningless and the IRS charge was ~3 orders of magnitude too small. There
// was no automated guard, so the unit mismatch was invisible to recon.
//
// ─── WHAT THIS PIPELINE ASSERTS (statically) ────────────────────────────────
// Over the two adapter modules and the combiner:
//
//   (1) SINGLE WEIGHTING BASIS, STAMPED. Every adapter that produces ladder
//       rows imports `MATURITY_METHOD_WEIGHTED_NOMINAL` from the shared band
//       module and stamps `weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL`
//       on the rows it emits. (A bare `weightingBasis:` set to anything else,
//       or a row-producing adapter that emits no basis, fails.)
//
//   (2) NO RAW-DV01 FEED INTO THE LADDER. The IRS adapter must NOT slot a DV01
//       value into the band accumulators (`weightedLong` / `weightedShort`).
//       i.e. no `dv01` identifier may appear inside the maturity-ladder
//       slotting path. `dv01ByTenorBucket` remaining as an internal sensitivity
//       view on the event payload is fine; what fails is a DV01 quantity being
//       written into a `weighted{Long,Short}` accumulator.
//
//   (3) COMBINER REJECTS A FOREIGN BASIS. `combineIrGeneralLadders` contains a
//       runtime guard that throws on a row whose `weightingBasis` is non-empty
//       and not the canonical constant. This is the last-line defence if a
//       future row source bypasses the static checks.
//
//   (4) DISALLOWANCES COMPUTED, NOT ZEROED (B-IRS-DISALLOWANCES). The BA 320
//       generator (`ba-320-market-risk.ts`) must call
//       `computeIrGeneralDisallowances` to derive the Reg 28(3)(a) vertical /
//       horizontal disallowance charge from the signed weighted-nominal ladder,
//       and must NOT zero-coalesce it (`irGeneralDisallowancesMinor ?? 0`) when
//       the caller omits the optional override. The prior defect silently
//       supplied 0, understating the general-market-risk capital charge.
//
// A reintroduced raw-DV01 row would fail (1) (no canonical basis stamp / a
// foreign basis), fail (2) (a `dv01` write into the accumulator), and be
// rejected at runtime by (3). A reverted disallowance feed (caller-supplied
// zero) fails (4). The co-located test reconstructs each of these and asserts
// the gate FAILS.
//
// ─── SOURCE OF TRUTH ────────────────────────────────────────────────────────
// Static source-text scan of the two adapter modules + the combiner. No runtime
// boot; reads files only (P6 upward chain).
//
// Authority:
//   - Regulations Relating to Banks Reg 28(3)(a) Table A (maturity method;
//     vertical + horizontal disallowances)
//   - BCBS D352 §718(b), §718(iv)–(x) (general market risk — maturity method;
//     matching / disallowances)
//   - D-IRS-DV01-BUCKETING-CALIBRATION (G1 weighting-basis unification;
//     G2/G4/G5 disallowance calibration)
//   - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09)
//
// Author: Mira (Regulatory reporting engineer, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba320-ir-general-weighting-basis";

/** The canonical basis constant name + literal value (kept in sync with the shared module). */
const CANONICAL_BASIS_CONST = "MATURITY_METHOD_WEIGHTED_NOMINAL";
const CANONICAL_BASIS_VALUE = "maturity-method-weighted-nominal";

// ---------------------------------------------------------------------------
// Repo layout
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const REPORTING_DIR = resolve(REPO_ROOT, "prototype/platform/reporting");

const BOND_ADAPTER = resolve(REPORTING_DIR, "ba-320-bond-events-adapter.ts");
const IRS_ADAPTER = resolve(REPORTING_DIR, "ba-320-irs-events-adapter.ts");
const MARKET_RISK_GENERATOR = resolve(REPORTING_DIR, "ba-320-market-risk.ts");

// ---------------------------------------------------------------------------
// Inputs (overridable for tests)
// ---------------------------------------------------------------------------

export interface RunOpts {
  /** Override the bond-adapter source text (for tests). */
  bondAdapterSource?: string;
  /** Override the IRS-adapter source text (for tests; this file also holds the combiner). */
  irsAdapterSource?: string;
  /** Override the market-risk generator source text (for tests). */
  marketRiskGeneratorSource?: string;
}

function readOrEmpty(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

// ---------------------------------------------------------------------------
// Source-text checks
// ---------------------------------------------------------------------------

/**
 * Does the source produce IrMaturityBandRow rows? Heuristic: it pushes objects
 * with `weightedLongMinor` / `weightedShortMinor` fields (the row shape).
 */
function producesLadderRows(source: string): boolean {
  return source.includes("weightedLongMinor") && source.includes("weightedShortMinor");
}

/**
 * Find every `weightingBasis:` assignment in row-literal position and return the
 * RHS token text (trimmed up to the line/expression terminator). Captures both
 * `weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,` and a string-literal form.
 */
function weightingBasisAssignments(source: string): string[] {
  const out: string[] = [];
  const re = /weightingBasis\s*:\s*([^,\n}]+)/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop.
  while ((m = re.exec(source)) !== null) {
    const rhs = m[1];
    if (rhs === undefined) continue;
    out.push(rhs.trim());
  }
  return out;
}

/**
 * Does any `weightedLong` / `weightedShort` accumulator write involve a `dv01`
 * quantity? We scan each line that mutates a weighted accumulator and flag a
 * `dv01` identifier on the same line. (`dv01ByTenorBucket` on the event payload
 * is fine; what fails is a dv01 magnitude flowing INTO the ladder accumulator.)
 */
function dv01FeedsLadder(source: string): boolean {
  const lines = source.split("\n");
  for (const line of lines) {
    const touchesAccumulator = /weightedLong\b|weightedShort\b/.test(line);
    if (!touchesAccumulator) continue;
    // `dv01` token NOT part of the word `dv01ByTenorBucket` (the payload field).
    if (/\bdv01(?!ByTenorBucket)\w*/i.test(line)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const bondSource = opts.bondAdapterSource ?? readOrEmpty(BOND_ADAPTER);
  const irsSource = opts.irsAdapterSource ?? readOrEmpty(IRS_ADAPTER);
  const generatorSource = opts.marketRiskGeneratorSource ?? readOrEmpty(MARKET_RISK_GENERATOR);

  if (bondSource.length === 0) {
    violations.push({
      subject: "ba-320-bond-events-adapter.ts",
      message: "Bond IR-general adapter source not found — cannot assert weighting basis.",
      severity: "fail",
    });
  }
  if (irsSource.length === 0) {
    violations.push({
      subject: "ba-320-irs-events-adapter.ts",
      message: "IRS IR-general adapter source not found — cannot assert weighting basis.",
      severity: "fail",
    });
  }

  const adapters: ReadonlyArray<{ name: string; source: string }> = [
    { name: "ba-320-bond-events-adapter.ts", source: bondSource },
    { name: "ba-320-irs-events-adapter.ts", source: irsSource },
  ];

  // -----------------------------------------------------------------------
  // Check (1): every row-producing adapter stamps the canonical basis, and no
  // weightingBasis assignment uses a foreign value.
  // -----------------------------------------------------------------------
  for (const { name, source } of adapters) {
    if (source.length === 0) continue;
    if (!producesLadderRows(source)) continue;
    result.asserted++;

    const assignments = weightingBasisAssignments(source);
    if (assignments.length === 0) {
      violations.push({
        subject: name,
        message: [
          `${name} produces IR-general ladder rows but stamps NO weightingBasis.`,
          `Every ladder row MUST carry weightingBasis: ${CANONICAL_BASIS_CONST}`,
          `("${CANONICAL_BASIS_VALUE}") so bond + IRS contributions are commensurate (G1).`,
        ].join(" "),
        severity: "fail",
      });
      continue;
    }

    for (const rhs of assignments) {
      const ok =
        rhs === CANONICAL_BASIS_CONST ||
        rhs === `"${CANONICAL_BASIS_VALUE}"` ||
        rhs === `'${CANONICAL_BASIS_VALUE}'`;
      if (!ok) {
        violations.push({
          subject: name,
          message: [
            `${name} stamps a FOREIGN weighting basis "${rhs}" on an IR-general ladder row.`,
            `Only ${CANONICAL_BASIS_CONST} ("${CANONICAL_BASIS_VALUE}", i.e. notional × bandRiskWeight)`,
            "is permitted — a raw-DV01 (rand-per-bp) basis is incommensurate (G1).",
          ].join(" "),
          severity: "fail",
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Check (2): the IRS adapter must NOT feed a raw DV01 quantity into the
  // band accumulators (the original G1 defect).
  // -----------------------------------------------------------------------
  if (irsSource.length > 0) {
    result.asserted++;
    if (dv01FeedsLadder(irsSource)) {
      violations.push({
        subject: "ba-320-irs-events-adapter.ts",
        message: [
          "The IRS adapter writes a raw DV01 quantity into a weightedLong/weightedShort",
          "ladder accumulator. Raw DV01 (rand-per-bp) is INCOMMENSURABLE with the bond",
          "adapter's weighted nominal (notional × bandRiskWeight). The IR-general ladder",
          "must be fed via the maturity-method notional decomposition, NOT DV01 (G1).",
        ].join(" "),
        severity: "fail",
      });
    }
  }

  // -----------------------------------------------------------------------
  // Check (3): combineIrGeneralLadders contains the foreign-basis runtime guard.
  // The combiner lives in the IRS adapter module.
  // -----------------------------------------------------------------------
  if (irsSource.length > 0) {
    result.asserted++;
    const hasCombiner = irsSource.includes("export function combineIrGeneralLadders");
    const hasGuard =
      irsSource.includes("foreign weighting basis") &&
      irsSource.includes(`row.weightingBasis !== ${CANONICAL_BASIS_CONST}`);
    if (hasCombiner && !hasGuard) {
      violations.push({
        subject: "combineIrGeneralLadders",
        message: [
          "combineIrGeneralLadders does not reject rows on a foreign weighting basis.",
          `It MUST throw when a row's weightingBasis is non-empty and !== ${CANONICAL_BASIS_CONST},`,
          "so a row source bypassing the static checks (e.g. a reintroduced raw-DV01 feed)",
          "cannot silently produce a mixed-unit ladder (G1).",
        ].join(" "),
        severity: "fail",
      });
    }
  }

  // -----------------------------------------------------------------------
  // Check (4): the BA 320 generator COMPUTES IR-general disallowances from the
  // ladder — it does NOT default them to a caller-supplied zero (B-IRS-
  // DISALLOWANCES). The prior defect was `irGeneralDisallowancesMinor ?? 0`,
  // which silently zeroed the vertical/horizontal disallowance charge and
  // understated the general-market-risk capital. The generator must (a) call
  // `computeIrGeneralDisallowances` and (b) NOT zero-coalesce the disallowance
  // away when the caller omits the optional override.
  // -----------------------------------------------------------------------
  if (generatorSource.length > 0) {
    result.asserted++;
    const callsAlgebra = generatorSource.includes("computeIrGeneralDisallowances(");
    // The legacy understatement: `const disallowances = Math.max(0,
    // input.irGeneralDisallowancesMinor ?? 0);` — disallowances default to 0.
    const zeroCoalesces = /irGeneralDisallowancesMinor\s*\?\?\s*0/.test(generatorSource);
    if (!callsAlgebra) {
      violations.push({
        subject: "ba-320-market-risk.ts",
        message: [
          "The BA 320 generator does NOT call computeIrGeneralDisallowances — the Reg 28(3)(a)",
          "vertical/horizontal disallowance charge is not derived from the maturity ladder.",
          "It must compute the matched-position charge from the signed long/short band positions,",
          "not accept a caller-supplied zero (B-IRS-DISALLOWANCES; Reg 28(3)(a); BCBS D352 §718).",
        ].join(" "),
        severity: "fail",
      });
    }
    if (zeroCoalesces) {
      violations.push({
        subject: "ba-320-market-risk.ts",
        message: [
          "The BA 320 generator zero-coalesces IR-general disallowances",
          "(`irGeneralDisallowancesMinor ?? 0`) — the legacy understatement defect. When the",
          "caller omits the optional override the disallowance MUST be the computed algebra value,",
          "not 0 (B-IRS-DISALLOWANCES; Reg 28(3)(a)).",
        ].join(" "),
        severity: "fail",
      });
    }
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
        ? "BA 320 IR-general weighting basis integrity passed — bond + IRS ladders share one weighted-nominal basis; no raw-DV01 feed; combiner rejects foreign basis"
        : "BA 320 IR-general weighting basis integrity FAILED — a ladder feed is on an incommensurate basis (raw DV01 vs weighted nominal) — G1",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
