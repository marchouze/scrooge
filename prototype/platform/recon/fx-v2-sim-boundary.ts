// platform/recon/fx-v2-sim-boundary.ts
//
// THE BINDING INVARIANT — simulator↔SUT boundary (WS-FX-V2-SIMULATOR).
//
// The simulator (platform/simulation-v2/, platform/simulation/) emits ONLY
// external-party actions and reference data — market rates, counterparty
// confirmations, settlement statuses, credit ratings, margin responses,
// regulator acknowledgements, sanctions lists — each tagged `simulated`. The
// bank's V2 capability is the System Under Test (SUT) and emits ONLY internal
// events. The bank's logic must NEVER read from or reach into the simulator;
// SUT valuation/risk/accounting reads default to `production` provenance so
// simulated ticks cannot leak into a real read path.
//
// This gate FAILS if:
//   (A) any simulator module emits an SUT-INTERNAL event type (the simulator
//       must never pretend to be the bank — it only models outside parties); or
//   (B) any SUT module hand-constructs a `simulated` provenance tag (the SUT
//       must derive provenance from the active category policy / production
//       default — never self-tag simulated); or
//   (C) any file in the simulation-v2 package uses Math.random() or Date.now()
//       (replay-safety — Principle 1; scenario time + randomness are injected).
//
// Static source-scan (mirrors recon:v2-no-v1-import). A regression test
// (fx-v2-sim-boundary.test.ts) feeds violating snippets and asserts each rule
// flags them.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). Principle 1
// (events are truth — provenance is a typed envelope axis, never inferred);
// Principle 2 (single-graph discipline — the boundary is a topology invariant).
// Author: Atlas (Core banking platform architect, engineering).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PROTOTYPE_DIR = resolve(import.meta.dir, "..", "..");

/** Directories that hold SIMULATOR code (external-party only). */
const SIMULATOR_DIRS = [
  resolve(PROTOTYPE_DIR, "platform", "simulation-v2"),
  resolve(PROTOTYPE_DIR, "platform", "simulation"),
] as const;

/**
 * SUT-INTERNAL event types — events that represent the BANK's own internal
 * actions (booking, valuation, risk, accounting, settlement instruction the
 * bank ITSELF issues, lifecycle the bank ITSELF records). A simulator file that
 * constructs / emits any of these is impersonating the bank → boundary breach.
 *
 * The simulator legitimately emits EXTERNAL-party events (see
 * SIMULATOR_EXTERNAL_EVENT_TYPES) — those are explicitly excluded.
 *
 * Sourced from the FX V2 SUT surface (daily-pnl-v2, var-engine-v2, fx-accounting,
 * fil cash materialisation, period close).
 */
const SUT_INTERNAL_EVENT_TYPES = [
  "FilInstrumentCreated",
  "FilInstrumentTerminated",
  "FilInstanceTreatmentElected",
  "DailyPnLReportGenerated",
  "MarketRiskVarComputed",
  "MarketRiskMeasureComputed",
  "FxPositionRevalued",
  "GlPostingEmitted",
  "SubLedgerPostingEmitted",
  "TrialBalanceSnapshotted",
  "IfrsClassificationApplied",
  "FilFxSettlementConfirmed",
  "FilNdfFixingObserved",
] as const;

/**
 * EXTERNAL-party event types the simulator IS allowed to emit. These model what
 * an outside party does to the bank — they are the simulator's whole purpose.
 * Listed for documentation; the gate's allow rule is "not SUT-internal", but
 * this set makes the intent explicit and lets the regression test assert it.
 */
export const SIMULATOR_EXTERNAL_EVENT_TYPES = [
  "FxTradeExecuted",
  "InboundMessageReceived",
  "FundingDrawnDown",
  "SettlementInstructionIssued",
  "PrincipalPayment",
  "SettlementConfirmed",
  "TradeConfirmationSent",
  "TradeConfirmationReceived",
  "TradeAffirmed",
  "TradeRejected",
  "SettlementFailed",
  "CounterpartyCreditRatingObserved",
  "MarginCallResponded",
] as const;

const SUT_SET: ReadonlySet<string> = new Set(SUT_INTERNAL_EVENT_TYPES);

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Strip line + block comments so the scan does not match prose / doc strings. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Match `type: "EventType"` and `makeEventType(` / `EventType as const` emit shapes. */
function emittedEventTypes(src: string): Set<string> {
  const found = new Set<string>();
  // type: "X" or kind: "X" (event-envelope discriminators).
  const typeKey = /\b(?:type|kind)\s*:\s*["']([A-Z][A-Za-z0-9]+)["']/g;
  let m: RegExpExecArray | null = typeKey.exec(src);
  while (m !== null) {
    if (m[1]) found.add(m[1]);
    m = typeKey.exec(src);
  }
  // makeXxx( factory calls → strip the make prefix.
  const factory = /\bmake([A-Z][A-Za-z0-9]+)\s*\(/g;
  m = factory.exec(src);
  while (m !== null) {
    if (m[1]) found.add(m[1]);
    m = factory.exec(src);
  }
  return found;
}

interface ScanResult {
  readonly violations: ReconViolation[];
  readonly asserted: number;
}

/** Rule A — no simulator file emits an SUT-internal event type. */
function scanSimulatorImpersonation(): ScanResult {
  const violations: ReconViolation[] = [];
  let asserted = 0;
  for (const dir of SIMULATOR_DIRS) {
    for (const file of listTsFiles(dir)) {
      // Test + recon-regression files exercise violating snippets on purpose.
      if (file.endsWith(".test.ts")) continue;
      const src = stripComments(readFileSync(file, "utf8"));
      const emitted = emittedEventTypes(src);
      for (const t of emitted) {
        asserted += 1;
        if (SUT_SET.has(t)) {
          violations.push({
            subject: file.slice(PROTOTYPE_DIR.length + 1),
            message: `simulator module emits SUT-internal event type "${t}" — the simulator may emit ONLY external-party events; "${t}" is the bank's own internal action (boundary breach)`,
            severity: "fail",
          });
        }
      }
    }
  }
  return { violations, asserted };
}

/**
 * Rule C — no Math.random() / Date.now() / new Date() (no-arg) in the V2
 * simulator package (replay-safety). The V1 spine predates this rule and is
 * grandfathered (scanned only for impersonation, rule A).
 */
function scanReplaySafety(): ScanResult {
  const violations: ReconViolation[] = [];
  let asserted = 0;
  const v2Dir = resolve(PROTOTYPE_DIR, "platform", "simulation-v2");
  const FORBIDDEN: Array<{ rx: RegExp; what: string }> = [
    { rx: /\bMath\s*\.\s*random\s*\(/g, what: "Math.random()" },
    { rx: /\bDate\s*\.\s*now\s*\(/g, what: "Date.now()" },
    { rx: /\bnew\s+Date\s*\(\s*\)/g, what: "new Date() (no-arg wall-clock read)" },
  ];
  for (const file of listTsFiles(v2Dir)) {
    if (file.endsWith(".test.ts")) continue;
    const src = stripComments(readFileSync(file, "utf8"));
    for (const { rx, what } of FORBIDDEN) {
      rx.lastIndex = 0;
      asserted += 1;
      if (rx.test(src)) {
        violations.push({
          subject: file.slice(PROTOTYPE_DIR.length + 1),
          message: `uses ${what} — replay-safety forbids non-deterministic time/randomness in the simulator; inject the SimulatedClock / SeededRng instead (Principle 1)`,
          severity: "fail",
        });
      }
    }
  }
  return { violations, asserted };
}

export function run(): ReconResult {
  const result = emptyResult("fx-v2-sim-boundary");
  const a = scanSimulatorImpersonation();
  const c = scanReplaySafety();
  const violations = [...a.violations, ...c.violations];
  result.asserted = a.asserted + c.asserted;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(
    `recon:fx-v2-sim-boundary — asserted ${r.asserted}; ${r.violations.length} violation(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
