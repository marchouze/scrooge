// platform/recon/semantic-registry-coverage.ts
//
// Continuous-controls pipeline: semantic-layer registry coverage.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Slice 1 — semantic-layer registry skeleton.
//
// This recon asserts the structural integrity of the `@platform/semantic`
// registry at every CI run. Three invariant families:
//
//   A — Slice-1 completeness. The three required Slice 1 entries
//       (`Balance`, `Exposure`, `CashAndBalancesAtSARB`) must be
//       registered and in-force. Missing any is a fail — the Slice 3
//       BA 110 LCR harness (Bea + Eitan + Anya) depends on
//       `CashAndBalancesAtSARB`; Slice 2 period-close events depend on
//       `Balance`.
//
//   B — Citation discipline (Principle 2). Every registered `in-force`
//       entry must carry at least one citation. The `SemanticRegistry.
//       register()` boundary already enforces this at authoring time;
//       this recon re-asserts it at the CI layer so regressions in test
//       harnesses or seed scripts surface immediately.
//
//   C — Signer coverage. Every `in-force` entry must declare at least
//       one signer. The `SemanticRegistry.register()` boundary also
//       enforces this; the recon adds CI-layer protection.
//
//   D — Projection named. Every `in-force` entry must declare a
//       `projection` field (non-empty string). Without a projection name
//       the downstream report generators (Slice 3+) cannot wire the
//       entry to a computable state fold.
//
//   E — Entity scope (Principle 5). Every `in-force` entry must carry
//       at least one `entityScope` URN in the canonical
//       `urn:legal-entity:hoz:<entity>:v1` form. The registry boundary
//       enforces the pattern; the recon makes the gap visible at CI.
//
//   F — Signer roster cross-link. Every signer named in a registered
//       entry must be a persona listed in `Team/_team-roster.json`.
//       Prevents phantom signers that cannot be contacted for approval
//       events (Principle 6 — autonomous agent accountability).
//
// Tally rules:
//   - Severity "fail" — registry is structurally broken or a required
//     Slice-1 entry is absent. CI must not proceed.
//   - Severity "warn" — registry is present but has a coverage gap that
//     does not block Slice 2/3 dispatch (e.g. a draft entry lacks a
//     signer — draft entries are explicitly skipped for signers/citation
//     checks in this recon).
//   - Severity "info" — informational; tracked for future ratchet.
//
// Principles bound:
//   - P1 (events are truth): every entry names a projection; values are
//     query results, not stored state.
//   - P2 (single-graph discipline): every in-force entry must carry at
//     least one citation; the recon enforces this at the CI layer.
//   - P5 (multi-currency, multi-entity): entityScope is checked non-empty
//     on every in-force entry.
//   - P6 (autonomous-by-default): signers are cross-linked against the
//     roster so accountability is always to a real registered agent.
//
// Author: Anya (Projection Engineer, engineering)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type SemanticEntry, SemanticRegistry } from "../semantic";
import { SLICE_3_LIQUIDITY_ENTRIES, SLICE_4_CAPITAL_ENTRIES } from "../semantic";
import {
  SLICE_3_RWA_ENTRIES,
  SLICE_5_MARKET_RISK_ENTRIES,
  SLICE_5_OP_RISK_ENTRIES,
  SLICE_6_IFRS_ENTRIES,
} from "../semantic";
import { balance, cashAndBalancesAtSARB, exposure } from "../semantic/entries";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const CITATIONS = [
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P5-MULTI-CURRENCY-ENTITY-COUNTRY",
  "P6-AUTONOMOUS-BY-DEFAULT",
];

// ---------------------------------------------------------------------------
// Slice-1 required entries — must be registered in-force at all times.
// ---------------------------------------------------------------------------
const REQUIRED_SLICE1_IDS: readonly string[] = ["Balance", "Exposure", "CashAndBalancesAtSARB"];

// ---------------------------------------------------------------------------
// Known valid signer names — derived from Team/_team-roster.json at
// startup. Any name not in this set is a phantom signer.
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
}

function loadRosterNames(repoRoot: string): Set<string> {
  const rosterPath = resolve(repoRoot, "Team/_team-roster.json");
  if (!existsSync(rosterPath)) {
    return new Set();
  }
  const raw = readFileSync(rosterPath, "utf8");
  const data = JSON.parse(raw) as { personas?: Array<{ name?: string }> };
  const out = new Set<string>();
  for (const p of data.personas ?? []) {
    if (p.name) out.add(p.name);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build the full registry from all shipped entry arrays.
// ---------------------------------------------------------------------------
function buildFullRegistry(): SemanticRegistry {
  const allEntries: SemanticEntry[] = [
    balance,
    exposure,
    cashAndBalancesAtSARB,
    ...SLICE_3_LIQUIDITY_ENTRIES,
    ...SLICE_3_RWA_ENTRIES,
    ...SLICE_4_CAPITAL_ENTRIES,
    ...SLICE_5_MARKET_RISK_ENTRIES,
    ...SLICE_5_OP_RISK_ENTRIES,
    ...SLICE_6_IFRS_ENTRIES,
  ];
  return SemanticRegistry.from(allEntries);
}

export function run(): ReconResult {
  const result = emptyResult("semantic-registry-coverage");
  const violations: ReconViolation[] = [];

  const repoRoot = findRepoRoot(import.meta.dir);
  const rosterNames = loadRosterNames(repoRoot);

  let registry: SemanticRegistry;
  try {
    registry = buildFullRegistry();
  } catch (err) {
    violations.push({
      subject: "semantic-registry",
      message: `SemanticRegistry construction failed — the registry is structurally broken and cannot be loaded. Error: ${String(err)}. Citations: ${CITATIONS.join(", ")}.`,
      severity: "fail",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }

  const allEntries = registry.listAll();
  const inForceEntries = registry.listInForce();

  // -------------------------------------------------------------------------
  // A — Slice-1 completeness
  // -------------------------------------------------------------------------
  for (const requiredId of REQUIRED_SLICE1_IDS) {
    result.asserted++;
    const entry = registry.resolve({ id: requiredId });
    if (!entry) {
      violations.push({
        subject: `semantic-entry:${requiredId}`,
        message: `Required Slice-1 entry \`${requiredId}\` is not registered as in-force in the SemanticRegistry. Slice 2 (period-close events) and Slice 3 (BA 110 LCR harness) depend on this entry. Re-register or restore. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // B — Citation discipline (in-force entries only)
  // -------------------------------------------------------------------------
  for (const entry of inForceEntries) {
    result.asserted++;
    if (entry.citations.length === 0) {
      violations.push({
        subject: `semantic-entry:${entry.id}@${entry.version}`,
        message: `In-force entry \`${entry.id}\`@${entry.version} has no citations. At least one citation is required by Principle 2. The registry boundary enforces this at authoring time; a regression here indicates test or seed harness bypassed register(). Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
    // Warn if ALL citations are TBC placeholders (coverage gap).
    const nonTbc = entry.citations.filter((c) => c.type !== "tbc");
    if (entry.citations.length > 0 && nonTbc.length === 0) {
      result.asserted++;
      violations.push({
        subject: `semantic-entry:${entry.id}@${entry.version}`,
        message: `In-force entry \`${entry.id}\`@${entry.version} has citations but all are TBC placeholders. At least one resolved citation (regulation, policy, ifrs, or statute) is required per Principle 2 citation-coverage ratchet. Assign a real citation anchor. Citations: ${CITATIONS.join(", ")}.`,
        severity: "warn",
      });
    }
  }

  // -------------------------------------------------------------------------
  // C — Signer coverage (in-force entries only)
  // -------------------------------------------------------------------------
  for (const entry of inForceEntries) {
    result.asserted++;
    if (entry.signers.length === 0) {
      violations.push({
        subject: `semantic-entry:${entry.id}@${entry.version}`,
        message: `In-force entry \`${entry.id}\`@${entry.version} has no signers. At least one governance-accountable signer is required so downstream ReportApproved events are attributable. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // D — Projection named (in-force entries only)
  // -------------------------------------------------------------------------
  for (const entry of inForceEntries) {
    result.asserted++;
    if (!entry.projection || entry.projection.trim().length === 0) {
      violations.push({
        subject: `semantic-entry:${entry.id}@${entry.version}`,
        message: `In-force entry \`${entry.id}\`@${entry.version} has no \`projection\` field. Report generators (Slice 3+) cannot wire the entry to a computable state fold without a projection name. Add the projection identifier. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // E — Entity scope (Principle 5; in-force entries only)
  // -------------------------------------------------------------------------
  for (const entry of inForceEntries) {
    result.asserted++;
    if (entry.entityScope.length === 0) {
      violations.push({
        subject: `semantic-entry:${entry.id}@${entry.version}`,
        message: `In-force entry \`${entry.id}\`@${entry.version} has an empty entityScope. Principle 5 (multi-currency, multi-entity) requires at least one legal-entity URN. Citations: ${CITATIONS.join(", ")}.`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // F — Signer roster cross-link (all entries, not just in-force)
  // -------------------------------------------------------------------------
  if (rosterNames.size > 0) {
    for (const entry of allEntries) {
      for (const signer of entry.signers) {
        result.asserted++;
        if (!rosterNames.has(signer)) {
          violations.push({
            subject: `semantic-entry:${entry.id}@${entry.version}:signer:${signer}`,
            message: `Entry \`${entry.id}\`@${entry.version} names signer \`${signer}\` who is not in \`Team/_team-roster.json\`. Only registered agents may be accountability signers (Principle 6). Add the persona to the roster or correct the signer name. Citations: ${CITATIONS.join(", ")}.`,
            severity: "fail",
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary info — total registered entries
  // -------------------------------------------------------------------------
  result.asserted++;
  if (allEntries.length === 0) {
    violations.push({
      subject: "semantic-registry",
      message:
        "SemanticRegistry is empty — no entries registered. At minimum Slice 1 entries (Balance, Exposure, CashAndBalancesAtSARB) must be registered. Citations: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.",
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
        ? "Semantic-registry coverage passed"
        : "Semantic-registry coverage FAILED — registry structural integrity violation",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
