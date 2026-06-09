// platform/recon/obligation-divergence.ts
//
// Vera recon: obligation-divergence (ADVISORY). The SA↔BCBS same-outcome /
// divergent model (WS-OBLIGATIONS-CLEANUP P5) lets the bank assert, for any
// SA (`ORG-*`) ↔ BCBS obligation pair, whether the two require the same
// outcome (`equivalent`), the SA gold-plates (`sa-stricter-gold-plates`), or
// they are materially divergent (`materially-divergent`). The verdicts are
// typed `ObligationEquivalenceClassified` events; the substrate is Atlas's,
// the verdict corpus is Mira's standing classification work.
//
// This gate surfaces the GAP: SA↔BCBS pairs that are EXPECTED TO OVERLAP but
// carry no classification event yet ("unclassified overlap"). The expected-
// overlap set is enumerated from the `ADOPTION_EDGES` Basel-provision spine in
// platform/regulatory/basel-adoption.ts — NOT free-text similarity:
//
//   SA instrument  ⟵ ADOPTION_EDGES.localInstrument
//        │            (a `localInstrument` adopts a `baselProvision`)
//        ▼
//   Basel provision ⟵ ADOPTION_EDGES.baselProvision (`urn:reg:bcbs:<std>:<para>`)
//        │            → BCBS obligation id `BCBS-<STD>-s<para>`
//        ▼
//   BCBS obligation
//
// The SA obligations on the SA side of a Basel standard are those whose seed
// citation references that BCBS standard token ("BCBS LEV", "BCBS RBC", ...) —
// the same standard the adoption edge adopts. The cross-product of
// (SA obligations citing standard S) × (BCBS obligation for an adoption edge of
// standard S) is the expected-overlap set.
//
// Mode: ADVISORY (ok:true regardless of unclassified count). It reports:
//   - unclassified overlap pairs (info)
//   - sa-only standards (SA cites a Basel standard with no adoption-edge BCBS
//     obligation present in the graph) (info)
//   - bcbs-only standards (an adoption edge whose Basel standard no SA
//     obligation cites) (info)
// so Mira can target her classification runs; it never blocks CI.
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP (CEO-approved) — WS-OBLIGATIONS-CLEANUP P5.
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../composition";
import type { ObligationEquivalenceClassifiedPayload } from "../event-store/event-types/obligation-equivalence";
import { ADOPTION_EDGES } from "../regulatory/basel-adoption";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "obligation-divergence";

interface SeedRow {
  id: string;
  citation?: string;
}

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

/**
 * Derive the BCBS obligation id (graph node id minus `OBL-`) from a Basel
 * provision URN. `urn:reg:bcbs:lev:20.7` → `BCBS-LEV-s20.7`. Returns undefined
 * for a malformed URN.
 */
export function bcbsObligationIdFromProvision(urn: string): string | undefined {
  const m = urn.match(/^urn:reg:bcbs:([a-z]+):(.+)$/);
  const standard = m?.[1];
  const paragraph = m?.[2];
  if (!standard || !paragraph) return undefined;
  return `BCBS-${standard.toUpperCase()}-s${paragraph}`;
}

/** The Basel standard token (`LEV`, `RBC`, ...) from a Basel provision URN. */
export function baselStandardFromProvision(urn: string): string | undefined {
  const m = urn.match(/^urn:reg:bcbs:([a-z]+):/);
  return m?.[1]?.toUpperCase();
}

/** SA obligations citing a given BCBS standard token ("BCBS LEV", etc.). */
function saObligationsCitingStandard(seed: SeedRow[], standard: string): string[] {
  const re = new RegExp(`BCBS\\s+${standard}\\b`, "i");
  return seed.filter((o) => o.id.startsWith("ORG-") && re.test(o.citation ?? "")).map((o) => o.id);
}

export interface ExpectedOverlapPair {
  saObligationId: string;
  bcbsObligationId: string;
  /** Basel standard token bridging the pair. */
  standard: string;
  /** The adoption-edge local instrument (SA reg) that adopts the provision. */
  localInstrument: string;
}

export interface RunOpts {
  repoRoot?: string;
}

/**
 * Enumerate the expected-overlap pair set from the ADOPTION_EDGES spine.
 * Exported for the proof fixture + Mira's targeting.
 */
export function enumerateExpectedOverlaps(seed: SeedRow[]): {
  pairs: ExpectedOverlapPair[];
  saOnlyStandards: string[];
  bcbsOnlyStandards: string[];
} {
  const pairs: ExpectedOverlapPair[] = [];
  const seen = new Set<string>();
  const bcbsStandards = new Set<string>();
  const saStandardsWithPair = new Set<string>();

  for (const edge of ADOPTION_EDGES) {
    const standard = baselStandardFromProvision(edge.baselProvision);
    const bcbsObligationId = bcbsObligationIdFromProvision(edge.baselProvision);
    if (!standard || !bcbsObligationId) continue;
    bcbsStandards.add(standard);

    const saIds = saObligationsCitingStandard(seed, standard);
    for (const saObligationId of saIds) {
      const key = `${saObligationId}::${bcbsObligationId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      saStandardsWithPair.add(standard);
      pairs.push({
        saObligationId,
        bcbsObligationId,
        standard,
        localInstrument: edge.localInstrument,
      });
    }
  }

  // sa-only: SA obligations cite a BCBS standard that has no adoption edge.
  const allCitedStandards = new Set<string>();
  for (const o of seed) {
    if (!o.id.startsWith("ORG-")) continue;
    for (const m of (o.citation ?? "").matchAll(/BCBS\s+([A-Z]{2,4})\b/g)) {
      const token = m[1];
      if (token) allCitedStandards.add(token.toUpperCase());
    }
  }
  const saOnlyStandards = [...allCitedStandards].filter((s) => !bcbsStandards.has(s)).sort();
  // bcbs-only: adoption-edge standard that no SA obligation cites.
  const bcbsOnlyStandards = [...bcbsStandards].filter((s) => !saStandardsWithPair.has(s)).sort();

  return { pairs, saOnlyStandards, bcbsOnlyStandards };
}

function loadClassifiedPairs(): Set<string> {
  const out = new Set<string>();
  for (const event of eventStore.replay({ type: "ObligationEquivalenceClassified" })) {
    const p = event.payload as ObligationEquivalenceClassifiedPayload;
    out.add(`${p.saObligationId}::${p.bcbsObligationId}`);
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = opts.repoRoot ?? findRepoRoot(import.meta.dir);
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const seedPath = resolve(repoRoot, "Regulations/_obligations.seed.json");
  if (!existsSync(seedPath)) {
    // Without the seed there is no SA side to enumerate; advisory, so report
    // and return ok:true.
    violations.push({
      subject: "Regulations/_obligations.seed.json",
      message: "canonical obligations seed missing — cannot enumerate SA side",
      severity: "info",
    });
    result.violations = violations;
    result.ok = true;
    return result;
  }

  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedRow[];
  const { pairs, saOnlyStandards, bcbsOnlyStandards } = enumerateExpectedOverlaps(seed);
  result.asserted = pairs.length;

  const classified = loadClassifiedPairs();

  let unclassified = 0;
  for (const pair of pairs) {
    const key = `${pair.saObligationId}::${pair.bcbsObligationId}`;
    if (classified.has(key)) continue;
    unclassified++;
    violations.push({
      subject: key,
      message: `unclassified overlap (standard ${pair.standard}, via ${pair.localInstrument}) — no ObligationEquivalenceClassified event`,
      severity: "info",
    });
  }

  for (const s of saOnlyStandards) {
    violations.push({
      subject: `standard:${s}`,
      message: "sa-only: SA obligation cites this BCBS standard but no adoption edge maps it",
      severity: "info",
    });
  }
  for (const s of bcbsOnlyStandards) {
    violations.push({
      subject: `standard:${s}`,
      message: "bcbs-only: adoption edge maps this standard but no SA obligation cites it",
      severity: "info",
    });
  }

  // Advisory: ok:true regardless of unclassified count.
  result.violations = violations;
  result.ok = true;
  result.asOf = `expected=${pairs.length} unclassified=${unclassified}`;
  return result;
}

if (import.meta.main) {
  const result = run();
  const seedPath = resolve(findRepoRoot(import.meta.dir), "Regulations/_obligations.seed.json");
  const seed = existsSync(seedPath)
    ? (JSON.parse(readFileSync(seedPath, "utf8")) as SeedRow[])
    : [];
  const { pairs } = enumerateExpectedOverlaps(seed);
  const classified = loadClassifiedPairs();
  const unclassified = pairs.filter(
    (p) => !classified.has(`${p.saObligationId}::${p.bcbsObligationId}`),
  ).length;

  for (const v of result.violations.slice(0, 40)) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${pairs.length} expected-overlap pair(s) from the ADOPTION_EDGES spine; ${unclassified} unclassified, ${classified.size} classification event(s) loaded`,
  );
}
