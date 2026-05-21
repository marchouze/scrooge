// platform/recon/fx-pair-direction.ts
//
// Vera advisory recon: assert that every FX pair on the wire and in the sim
// substrate is in **major-first** form per the ACI Model Code currency
// hierarchy.
//
// ACI major-currency hierarchy (canonical for this codebase):
//
//   EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY > everything else
//
// Applied to a pair `BASE/QUOTE`: the base must rank strictly higher in this
// hierarchy than the quote. So `USD/ZAR` is canonical; `ZAR/USD` is not. Two
// currencies neither of which appear in the explicit list (e.g. `MXN/BRL`)
// fall through to alphabetical-ascending order as a deterministic tiebreaker.
//
// Severity: P2 (warn). This is a convention-drift gate, not a data-corruption
// gate; the underlying schema accepts either direction and downstream
// consumers compute on whichever direction is supplied. A non-canonical pair
// is reported but does not fail CI (severity: warn). It will fail CI only if
// the surrounding recon harness escalates the warning — today the runner
// treats warn as advisory.
//
// Empty-state correctness: zero events / empty source files → asserted=0, ok=true.
//
// Sources walked:
//   1. Every `FxTradeExecuted` payload in the live event store (CDM shape:
//      `currencyPair: { base, quote }`).
//   2. Every key in `prototype/seeds/fx-rates.json`.
//   3. Every key in `SEED_MID_RATES` (re-exported from
//      `platform/simulation/fx-sim-rates.ts` for this purpose).
//   4. Every entry in every `eligiblePairs` array on `SIM_COUNTERPARTIES`.
//   5. Every entry in `STANDARD_PAIRS` (re-exported from
//      `platform/simulation/env-sim/market-data-sim.ts`).
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - ACI Model Code §2 (currency-pair quotation convention)
//
// Author: Devon (Chief Operating Officer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../composition";
import { STANDARD_PAIRS } from "../simulation/env-sim/market-data-sim";
import { SIM_COUNTERPARTIES } from "../simulation/fx-sim-counterparties";
import { SEED_MID_RATES_KEYS } from "../simulation/fx-sim-rates";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-pair-direction";

// ---------------------------------------------------------------------------
// ACI hierarchy
// ---------------------------------------------------------------------------

/**
 * ACI Model Code §2 major-currency hierarchy. Currency listed earlier outranks
 * (i.e. is base against) currency listed later. Currencies not in the list
 * sit below every listed currency, and break ties alphabetically.
 */
const ACI_HIERARCHY: readonly string[] = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"];

/** Returns the rank of a currency in the ACI hierarchy (lower = higher priority).
 *  Returns Number.POSITIVE_INFINITY for currencies not in the list. */
function aciRank(ccy: string): number {
  const i = ACI_HIERARCHY.indexOf(ccy);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/** Returns the canonical major-first form of a pair `BASE/QUOTE`. */
export function canonicalisePair(base: string, quote: string): string {
  const rb = aciRank(base);
  const rq = aciRank(quote);
  if (rb < rq) return `${base}/${quote}`;
  if (rb > rq) return `${quote}/${base}`;
  // Both unranked: alphabetical-ascending tiebreaker.
  return base <= quote ? `${base}/${quote}` : `${quote}/${base}`;
}

/** Returns true iff `BASE/QUOTE` is already in canonical major-first form. */
export function isCanonical(base: string, quote: string): boolean {
  if (base === quote) return false; // degenerate; flag separately
  return canonicalisePair(base, quote) === `${base}/${quote}`;
}

/** Parse "BASE/QUOTE" → { base, quote }. Returns null on malformed input. */
function splitPair(pair: string): { base: string; quote: string } | null {
  const slash = pair.indexOf("/");
  if (slash === -1) return null;
  const base = pair.slice(0, slash);
  const quote = pair.slice(slash + 1);
  if (!base || !quote) return null;
  return { base, quote };
}

// ---------------------------------------------------------------------------
// Source loaders
// ---------------------------------------------------------------------------

interface MinimalFxEvent {
  readonly event_id: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

export interface RunOpts {
  /** Override the event source — used by tests to feed synthetic events. */
  fxTradeEvents?: Iterable<MinimalFxEvent>;
  /** Override the seeds/fx-rates.json keys (test injection). */
  seedKeys?: Iterable<string>;
  /** Override the SEED_MID_RATES keys (test injection). */
  midRateKeys?: Iterable<string>;
  /** Override the SIM_COUNTERPARTIES list (test injection). */
  counterparties?: ReadonlyArray<{ name: string; eligiblePairs: ReadonlyArray<string> }>;
  /** Override the STANDARD_PAIRS list (test injection). */
  standardPairs?: ReadonlyArray<string>;
}

function loadFxTradeEvents(opts: RunOpts): MinimalFxEvent[] {
  if (opts.fxTradeEvents) return [...opts.fxTradeEvents];
  const out: MinimalFxEvent[] = [];
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    out.push({
      event_id: e.event_id,
      as_of: e.as_of,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    });
  }
  return out;
}

function loadSeedRateKeys(opts: RunOpts): string[] {
  if (opts.seedKeys) return [...opts.seedKeys];
  try {
    const path = resolve(import.meta.dir, "../../seeds/fx-rates.json");
    const raw = readFileSync(path, "utf8");
    const table = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(table).filter((k) => !k.startsWith("_"));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Per-source assertions
// ---------------------------------------------------------------------------

function assertPairString(pair: string, subjectPrefix: string, violations: ReconViolation[]): void {
  const parts = splitPair(pair);
  if (!parts) {
    violations.push({
      subject: `${subjectPrefix}:${pair}`,
      severity: "warn",
      message: `Pair "${pair}" is not in BASE/QUOTE form. Authority: ACI Model Code §2.`,
    });
    return;
  }
  if (parts.base === parts.quote) {
    violations.push({
      subject: `${subjectPrefix}:${pair}`,
      severity: "warn",
      message: `Pair "${pair}" has identical base and quote — degenerate.`,
    });
    return;
  }
  if (!isCanonical(parts.base, parts.quote)) {
    const canonical = canonicalisePair(parts.base, parts.quote);
    violations.push({
      subject: `${subjectPrefix}:${pair}`,
      severity: "warn",
      message: `Pair "${pair}" is not in canonical major-first form; expected "${canonical}" per ACI hierarchy (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY > others). Authority: ACI Model Code §2; D-MARKETS-SCHEMA-FOUNDATION.`,
    });
  }
}

function assertPairObject(
  payload: Record<string, unknown>,
  subjectPrefix: string,
  violations: ReconViolation[],
): void {
  const cp = payload.currencyPair;
  if (cp === undefined || cp === null) {
    violations.push({
      subject: subjectPrefix,
      severity: "warn",
      message: "FxTradeExecuted payload has no currencyPair field.",
    });
    return;
  }
  // CDM payload uses { base, quote }; older non-CDM payloads occasionally
  // string-encode the pair — accept both.
  if (typeof cp === "string") {
    assertPairString(cp, subjectPrefix, violations);
    return;
  }
  if (typeof cp !== "object") {
    violations.push({
      subject: subjectPrefix,
      severity: "warn",
      message: `currencyPair has unexpected type "${typeof cp}".`,
    });
    return;
  }
  const obj = cp as Record<string, unknown>;
  const base = typeof obj.base === "string" ? obj.base : undefined;
  const quote = typeof obj.quote === "string" ? obj.quote : undefined;
  if (!base || !quote) {
    violations.push({
      subject: subjectPrefix,
      severity: "warn",
      message: `currencyPair missing base/quote string fields (base=${String(obj.base)}, quote=${String(obj.quote)}).`,
    });
    return;
  }
  assertPairString(`${base}/${quote}`, subjectPrefix, violations);
}

// ---------------------------------------------------------------------------
// Pipeline run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // 1. FxTradeExecuted events.
  const fxEvents = loadFxTradeEvents(opts);
  for (const ev of fxEvents) {
    result.asserted++;
    assertPairObject(ev.payload, `FxTradeExecuted:${ev.event_id}`, violations);
  }

  // 2. seeds/fx-rates.json keys.
  const seedKeys = loadSeedRateKeys(opts);
  for (const key of seedKeys) {
    result.asserted++;
    assertPairString(key, "seeds/fx-rates.json", violations);
  }

  // 3. SEED_MID_RATES keys.
  const midRateKeys = opts.midRateKeys ? [...opts.midRateKeys] : [...SEED_MID_RATES_KEYS];
  for (const key of midRateKeys) {
    result.asserted++;
    assertPairString(key, "fx-sim-rates:SEED_MID_RATES", violations);
  }

  // 4. SIM_COUNTERPARTIES eligiblePairs.
  const counterparties = opts.counterparties ?? SIM_COUNTERPARTIES;
  for (const cp of counterparties) {
    for (const p of cp.eligiblePairs) {
      result.asserted++;
      assertPairString(p, `fx-sim-counterparties:${cp.name}`, violations);
    }
  }

  // 5. STANDARD_PAIRS.
  const standardPairs = opts.standardPairs ?? STANDARD_PAIRS;
  for (const p of standardPairs) {
    result.asserted++;
    assertPairString(p, "env-sim/market-data-sim:STANDARD_PAIRS", violations);
  }

  result.violations = violations;
  // Advisory severity P2 — never fail on warn-only violations.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  console.log(
    JSON.stringify({
      level: r.ok ? (warnCount > 0 ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? warnCount > 0
          ? `fx-pair-direction passed with ${warnCount} advisory warning(s) — non-canonical pair detected.`
          : "fx-pair-direction passed — every FX pair is in canonical major-first form."
        : "fx-pair-direction FAILED — see violations.",
      detail: r.violations,
    }),
  );
  // P2 advisory — exit 0 even on warn violations (does not fail CI).
  process.exit(r.ok ? 0 : 1);
}
