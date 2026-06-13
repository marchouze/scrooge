// platform/recon/ccr-single-emitter.ts
//
// recon:ccr-single-emitter — the SA-CCR alias-flip single-emitter gate
// (WS-V2-BBAAS). Authority: D-SACCR-V2-CUTOVER-ACCELERATE; D-MODEL-BINDING-
// CONTRACT-V1; Nadia MV-SACCR-V2-002/003.
//
// ─── THE INVARIANT THIS GUARDS ──────────────────────────────────────────────
// After the alias-flip, the counterparty-credit-risk events-of-record
// (`CcrReplacementCostComputed` + `CcrEadComputed`) must have EXACTLY ONE live
// production emitter — the v2-sourced `platform/risk/sa-ccr/compute-and-emit.ts`
// boundary (which computes via the validated v2 FIL-Model and sources RC inputs
// from the FIL-mediated feeds). The defective v1 `resolveMtm` FX-summing path
// is retired; if a second module were to start emitting these CCR events (e.g. a
// resurrected v1 engine, or a parallel un-flipped emitter), the recorded capital
// figures (CreditRWA, BA-700 leverage exposure, CVA) would fork between two
// methodologies — the exact hazard the cutover closes.
//
// The existing `recon:posting-engine-single-subscriber` gate guards GL postings
// (`makeSubLedgerPostingEmitted`); it does NOT cover the CCR event types. This
// gate is the CCR-specific analogue.
//
// ─── WHAT THIS PIPELINE ASSERTS ─────────────────────────────────────────────
// Statically, over the production source tree (`platform/**` + `runtime/**`,
// excluding tests, the event-type DEFINITION module, the parity ORACLE harness,
// and scripts):
//
//   (1) Exactly ONE module statically calls a CCR event maker
//       (`makeCcrReplacementCostComputed` / `makeCcrEadComputed`).
//   (2) That one module is the expected v2-sourced emitter
//       (`platform/risk/sa-ccr/compute-and-emit.ts`).
//   (3) The retired v1 input-resolution function `resolveMtm` does not exist as
//       a live symbol in the emitter module (defect cannot survive as a
//       fallback — Nadia MV-SACCR-V2-003).
//
// SOURCE OF TRUTH: a controlled static scan. Emission is only discoverable from
// code (the maker call site). The scan reads production source only and excludes:
//   - `*.test.ts`                                  — tests are not live wiring.
//   - `event-store/event-types/counterparty-credit-risk.ts` — the maker
//                                                    DEFINITION, not an emitter.
//   - `recon/v2-saccr-parity.ts` + `recon/ccr-single-emitter.ts` — the parity
//                                                    oracle harness builds payloads
//                                                    but does not `eventStore.append`,
//                                                    and this gate mentions the
//                                                    maker names in prose; both are
//                                                    recon infra, not emitters.
//   - `scripts/**`                                 — one-shot tools (incl. the
//                                                    alias-flip recompute script,
//                                                    which re-emits corrected
//                                                    events THROUGH the single
//                                                    emitter — see note below).
//
// NOTE on the recompute script: the alias-flip correction script re-emits the
// corrected RC/EAD by calling `computeAndEmit` (the single emitter), NOT by
// calling the makers directly — so it does not constitute a second emitter and
// is correctly out of scope (scripts/** excluded regardless).
//
// P6 — upward chain. Reads files only; no runtime boot.
//
// Author: Rohan (Risk Engineer, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ccr-single-emitter";

/** The CCR event makers whose call sites define a CCR emitter. */
const CCR_EMIT_CALLS = ["makeCcrReplacementCostComputed", "makeCcrEadComputed"] as const;

/** The single sanctioned emitter module (relative to prototype/). */
const EXPECTED_EMITTER = "platform/risk/sa-ccr/compute-and-emit.ts";

/** The retired defective v1 resolution symbol — must not exist live. */
const RETIRED_SYMBOL = "function resolveMtm";

// ---------------------------------------------------------------------------
// Repo layout — walk up to the prototype/ root (contains platform/ + runtime/).
// ---------------------------------------------------------------------------

function findPrototypeRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "platform")) && existsSync(resolve(dir, "runtime"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate prototype root (platform/ + runtime/ not found by walking up)");
}

const PROTO_ROOT = findPrototypeRoot(import.meta.dir);

// ---------------------------------------------------------------------------
// Scan scope.
// ---------------------------------------------------------------------------

const SCAN_DIRS = ["platform", "runtime"];

/** Files excluded by exact relative path. */
const EXCLUDED_FILES = new Set<string>([
  "platform/event-store/event-types/counterparty-credit-risk.ts", // maker definition
  "platform/recon/v2-saccr-parity.ts", // parity oracle harness (no append)
  "platform/recon/ccr-single-emitter.ts", // this gate (mentions maker names)
]);

function isExcluded(rel: string): boolean {
  if (rel.endsWith(".test.ts")) return true;
  return EXCLUDED_FILES.has(rel);
}

function walkTsFiles(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules") continue;
      walkTsFiles(full, acc);
    } else if (entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
}

function callsAnyMaker(source: string): boolean {
  return CCR_EMIT_CALLS.some((call) => source.includes(`${call}(`));
}

// ---------------------------------------------------------------------------
// Pipeline.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const files: string[] = [];
  for (const d of SCAN_DIRS) {
    const abs = resolve(PROTO_ROOT, d);
    if (existsSync(abs)) walkTsFiles(abs, files);
  }

  const emitters: string[] = [];
  for (const abs of files) {
    const rel = relative(PROTO_ROOT, abs);
    if (isExcluded(rel)) continue;
    const source = readFileSync(abs, "utf8");
    if (callsAnyMaker(source)) emitters.push(rel);
  }
  emitters.sort();

  // (1) Exactly one emitter.
  result.asserted += 1;
  if (emitters.length === 0) {
    violations.push({
      subject: "ccr-emitter-count",
      message:
        "No production module emits CcrReplacementCostComputed / CcrEadComputed. The SA-CCR live emitter is missing — CreditRWA / BA-700 / CVA would have no CCR events of record.",
      severity: "fail",
    });
  } else if (emitters.length > 1) {
    violations.push({
      subject: "ccr-emitter-count",
      message: `CCR events (CcrReplacementCostComputed / CcrEadComputed) are emitted by ${emitters.length} production modules: ${emitters.join(", ")}. Exactly one live emitter is permitted (the v2-sourced ${EXPECTED_EMITTER}). Two emitters fork the recorded capital figures across methodologies — the alias-flip double-emitter hazard (D-SACCR-V2-CUTOVER-ACCELERATE; Nadia MV-SACCR-V2-002).`,
      severity: "fail",
    });
  }

  // (2) The one emitter is the expected v2-sourced module.
  result.asserted += 1;
  if (emitters.length === 1 && emitters[0] !== EXPECTED_EMITTER) {
    violations.push({
      subject: "ccr-emitter-identity",
      message: `The sole CCR emitter is ${emitters[0]}, not the expected v2-sourced ${EXPECTED_EMITTER}. The alias-flip routes live emission through the validated v2 FIL-Model boundary.`,
      severity: "fail",
    });
  }

  // (3) The retired v1 resolveMtm symbol does not exist live in the emitter.
  result.asserted += 1;
  const emitterAbs = resolve(PROTO_ROOT, EXPECTED_EMITTER);
  if (existsSync(emitterAbs)) {
    const emitterSrc = readFileSync(emitterAbs, "utf8");
    if (emitterSrc.includes(RETIRED_SYMBOL)) {
      violations.push({
        subject: "ccr-retired-resolveMtm",
        message: `The retired v1 \`resolveMtm\` (defective FX-summing input resolution) still exists as a live symbol in ${EXPECTED_EMITTER}. It must not survive the cutover as a fallback (Nadia MV-SACCR-V2-003) — the FX arm N-counted the cumulative mark.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `ccr-single-emitter: ${emitters.length} live CCR emitter(s) [${emitters.join(", ") || "none"}]; expected exactly 1 = ${EXPECTED_EMITTER}; v1 resolveMtm retired.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
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
        ? "CCR single-emitter integrity passed — exactly one v2-sourced production emitter; v1 resolveMtm retired"
        : "CCR single-emitter integrity FAILED — see violations",
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
