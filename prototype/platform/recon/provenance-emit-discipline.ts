// platform/recon/provenance-emit-discipline.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE — PR6 (incremental-adoption tail).
// Bypass-detection gate for the emitter-side provenance discipline.
//
// ─── THE RULE THIS GUARDS ───────────────────────────────────────────────────
// `provenanceForEmit` (platform/event-store/provenance.ts) is the single
// sanctioned way for a production emitter to obtain a `ProvenanceTag`: the
// production/simulated decision routes through the active per-category policy
// (`BankModePolicySet` → bank-mode projection), never through a hardcoded tag
// at the call-site. An emitter that constructs a tag explicitly —
// `productionTag(...)`, `simulatedTag(...)`, `buildPhaseFixtureTag(...)`,
// `PRODUCTION_CARVE_OUTS.X`, `PRE_SUBSTRATE_BACKFILL_TAG`, or an inline
// `provenance: { kind: ... }` literal — bypasses the policy: flipping the
// bank-wide category policy would silently NOT reach that emitter.
//
// ─── WHAT THIS PIPELINE ASSERTS ─────────────────────────────────────────────
// Statically, over the production trees (`platform/`, `runtime/`,
// `dashboard/`, non-test files, comments stripped): every explicit-provenance
// construction site is on the carve-out allowlist below. A NEW explicit
// construction site anywhere else is a `fail` violation. An allowlist entry
// that no longer matches anything is a `warn` (stale entry — clean it up).
//
// ─── LEGITIMATE CARVE-OUTS (why explicit tags still exist at all) ───────────
// An emitter whose provenance kind is fixed BY CONSTRUCTION — not by bank
// mode — must not route through the policy:
//   - simulators / sim hubs (always simulated + scenario-bound),
//   - fixture ingesters (the *source* is a fixture regardless of mode),
//   - `build-phase-fixture` authors (the third kind is deliberately not
//     expressible in the category policy),
//   - the provenance substrate itself (constructors, soft-tagger, backfill).
// Out of scan scope by design (not allowlist): `scenarios/` (scenario-bound
// by definition), `scripts/` (one-shot seeds/backfills with audit-specific
// lineage), `*.test.ts` (tests construct specific tags to exercise filters).
//
// Static-scan approach precedent: recon:posting-engine-single-subscriber.
// P6 — upward chain. Reads files only; no runtime boot.
//
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { type ReconResult, emptyResult } from "./types";

const PIPELINE = "recon:provenance-emit-discipline";

// ---------------------------------------------------------------------------
// Repo layout
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("provenance-emit-discipline: could not locate repo root (CLAUDE.md)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const PROTOTYPE_ROOT = resolve(REPO_ROOT, "prototype");

/** Production trees scanned for explicit-provenance construction. */
const SCAN_ROOTS = ["platform", "runtime", "dashboard"] as const;

/**
 * Substrate-internal paths excluded from the scan (prototype-relative
 * prefixes). These DEFINE or REFERENCE the constructors as part of the
 * provenance substrate itself — they are not emitters.
 */
const EXCLUDED_PREFIXES: readonly string[] = [
  "platform/event-store/", // constructors, store soft-tagger, carve-out registry
  "platform/recon/", // this scanner + category-policy-coverage reference the names
];

/**
 * Carve-out allowlist — prototype-relative file path → reason. Every entry
 * is an emitter whose provenance kind is fixed by construction (see header).
 * Adding a file here is a reviewed act: the PR must state why the category
 * policy cannot serve the emitter.
 */
export const EXPLICIT_PROVENANCE_ALLOWLIST: Readonly<Record<string, string>> = {
  "platform/agent-spec/bounded-write.ts":
    "production tag on policy-unmapped 'AgentPromptOptimizationApplied' — explicit value DIFFERS from the " +
    "category-policy derivation (unmapped → simulated); kept as carve-out per PR6 no-silent-flip rule. " +
    "Follow-up: map the event type to the governance/build category, then migrate to provenanceForEmit.",
  "platform/markets/products/npa-attestation-runner.ts":
    "build-phase-fixture tag — the third provenance kind is deliberately not expressible in the " +
    "category policy (real build-phase bank state, not mode-dependent).",
  "platform/markets/products/npa-fx-verification-pass-2.ts":
    "build-phase-fixture tag on NPA dimension attestations (same basis as npa-attestation-runner.ts) — " +
    "the third provenance kind is deliberately not expressible in the category policy " +
    "(real build-phase bank state, not mode-dependent).",
  "platform/markets/products/npa-fx-conduct-attestation.ts":
    "build-phase-fixture tag on the FX conduct-dimension attestation (same basis as " +
    "npa-fx-verification-pass-2.ts) — the third provenance kind is deliberately not expressible in the " +
    "category policy (real build-phase bank state, not mode-dependent).",
  "platform/markets/products/npa-fx-infosec-attestation.ts":
    "build-phase-fixture tag on the FX infosec-dimension CISO ratification + attestation (same basis as " +
    "npa-fx-conduct-attestation.ts) — the third provenance kind is deliberately not expressible in the " +
    "category policy (real build-phase bank state, not mode-dependent).",
  "platform/market-data/sarb-fixing-ingester.ts":
    "structurally simulated fixture ingester — the source is a JSON fixture regardless of bank mode; " +
    "scenario-bound by construction (SARB_FIXING_FIXTURE_PROVENANCE).",
  "platform/simulation/hub/types.ts":
    "third-party-sim hub — simulated + scenario-bound by construction; a simulator must never emit " +
    "production events even if the trading category policy flips.",
  "platform/projections/filter.ts":
    "read-side filter default for legacy untagged events (UNTAGGED_AS_SIMULATED mirrors " +
    "PRE_SUBSTRATE_BACKFILL_TAG without the import cycle) — not an emit site.",
  "dashboard/bond-gateway.ts":
    "operator-selected provenance mode — the human operator chooses sim/production per booking request; " +
    "an explicit per-request choice channel is not derivable from the bank-wide category policy.",
  "dashboard/instruments-view.ts":
    "operator-selected provenance mode (production / build-phase-fixture) on manual instrument definition — " +
    "per-request operator choice, incl. the policy-inexpressible build-phase-fixture kind.",
  "dashboard/markets-fx-gateway.ts":
    "sim FX order gateway — simulated + scenario-bound by construction (operator sim bookings).",
  "dashboard/markets-fx-trade.ts":
    "sim FX RFQ/trade flow — simulated + scenario-bound by construction (operator sim bookings).",
  "dashboard/trade-book-view.ts":
    "operator-selected provenance mode on manual trade booking — per-request operator choice; " +
    "not derivable from the bank-wide category policy.",
};

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Strip // line comments and /* *\/ block comments (good-enough lexer). */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

interface PatternSpec {
  readonly label: string;
  readonly regex: RegExp;
}

const PATTERNS: readonly PatternSpec[] = [
  { label: "productionTag(...)", regex: /\bproductionTag\s*\(/ },
  { label: "simulatedTag(...)", regex: /\bsimulatedTag\s*\(/ },
  { label: "buildPhaseFixtureTag(...)", regex: /\bbuildPhaseFixtureTag\s*\(/ },
  { label: "PRODUCTION_CARVE_OUTS reference", regex: /\bPRODUCTION_CARVE_OUTS\b/ },
  { label: "PRE_SUBSTRATE_BACKFILL_TAG reference", regex: /\bPRE_SUBSTRATE_BACKFILL_TAG\b/ },
  // Inline tag literal in provenance position. Requires a `kind:` axis inside
  // the braces so non-envelope `provenance:` metadata objects (e.g. extraction
  // provenance on Plane-A artefacts) do not false-positive.
  { label: "inline provenance literal { kind: ... }", regex: /provenance:\s*\{[^}]*\bkind\s*:/ },
  // Typed tag-literal const (`const X: ProvenanceTag = {...}` /
  // `const X: Event["provenance"] = {...}`) — the indirection a file uses to
  // hand-roll a tag once and attach it by identifier, which the
  // provenance-position literal pattern alone would miss.
  {
    label: "typed ProvenanceTag literal const",
    regex: /:\s*(ProvenanceTag|Event\["provenance"\])\s*=\s*\{/,
  },
];

export interface ExplicitProvenanceHit {
  /** Prototype-relative file path. */
  readonly file: string;
  readonly patterns: readonly string[];
}

function walkTsFiles(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walkTsFiles(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
}

/**
 * Scan the production trees for explicit-provenance construction sites.
 * Exposed for the regression test (which also runs it over a synthetic tree).
 */
export function scanExplicitProvenance(prototypeRoot: string): ExplicitProvenanceHit[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    const abs = resolve(prototypeRoot, root);
    if (existsSync(abs)) walkTsFiles(abs, files);
  }
  const hits: ExplicitProvenanceHit[] = [];
  for (const file of files) {
    const rel = relative(prototypeRoot, file).replaceAll("\\", "/");
    if (EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) continue;
    const source = stripComments(readFileSync(file, "utf8"));
    const matched = PATTERNS.filter((p) => p.regex.test(source)).map((p) => p.label);
    if (matched.length > 0) hits.push({ file: rel, patterns: matched });
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file));
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function run(prototypeRoot: string = PROTOTYPE_ROOT): ReconResult {
  const result = emptyResult(PIPELINE);
  const hits = scanExplicitProvenance(prototypeRoot);
  const hitFiles = new Set(hits.map((h) => h.file));

  // (1) Every explicit-construction site must be allowlisted.
  for (const hit of hits) {
    result.asserted += 1;
    if (!(hit.file in EXPLICIT_PROVENANCE_ALLOWLIST)) {
      result.violations.push({
        subject: hit.file,
        message: [
          `explicit provenance construction outside the carve-out allowlist (${hit.patterns.join("; ")}) —`,
          "route the emitter through provenanceForEmit (platform/event-store/provenance.ts) so the active",
          "category policy decides the kind, or (only if the kind is fixed by construction) add the file to",
          "EXPLICIT_PROVENANCE_ALLOWLIST with a reason. Authority: D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR6.",
        ].join(" "),
        severity: "fail",
      });
    }
  }

  // (2) Stale allowlist entries are warn-level findings (hygiene).
  for (const file of Object.keys(EXPLICIT_PROVENANCE_ALLOWLIST)) {
    result.asserted += 1;
    if (!hitFiles.has(file)) {
      result.violations.push({
        subject: file,
        message:
          "stale EXPLICIT_PROVENANCE_ALLOWLIST entry — the file no longer constructs an explicit provenance " +
          "tag (or was removed); delete the entry.",
        severity: "warn",
      });
    }
  }

  result.ok = result.violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    const warns = r.violations.filter((v) => v.severity === "warn");
    const warnSuffix = warns.length > 0 ? `; ${warns.length} stale-allowlist warn(s)` : "";
    process.stdout.write(
      `${PIPELINE}: ok — ${r.asserted} assertion(s); explicit-provenance sites all allowlisted${warnSuffix}\n`,
    );
    for (const v of warns) process.stdout.write(`  [warn] ${v.subject}: ${v.message}\n`);
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
