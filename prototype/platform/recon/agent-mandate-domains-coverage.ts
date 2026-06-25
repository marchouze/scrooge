// platform/recon/agent-mandate-domains-coverage.ts
//
// recon:agent-mandate-domains-coverage — WS-AGENT-MEMORY Slice 2 coverage gate.
//
// THE INVARIANT (fail-closed): the read-at-dispatch path loads a mandate-scoped
// memory slice for every agent, so every roster persona MUST carry an EXPLICIT,
// non-empty `mandateDomains[]` whose tags are all in the closed roster
// vocabulary (`mandateDomainVocabulary.tags`), and the reserved `shared` tag MUST
// be present in the vocabulary (it is the bank-wide common-core every agent
// loads). A persona with no mandateDomains has no load-filter — read-at-dispatch
// silently returns nothing for it. A tag outside the vocabulary is a typo that
// federates a memory into a bucket no agent's filter names.
//
// WHY EXPLICIT, NOT DERIVED (sourced, not invented — Charter cmd 4): the brief
// is emphatic — do NOT derive mandateDomains from reportsTo or the
// domain-ownership map. Governance seats (Owen/Iris) own statutory domains with
// no engineering builder, so a derivation would either mis-assign them or leave
// them empty. The roster carries the truth explicitly; this gate asserts it is
// present and well-formed.
//
// ASSERTIONS (per persona + the vocabulary itself):
//   1. every persona has a non-empty mandateDomains[],
//   2. every tag is in the closed vocabulary,
//   3. the vocabulary reserves/handles the `shared` tag.
//
// NEGATIVE TEST (sabotage-proof, in the .test): a persona with EMPTY/ABSENT
// mandateDomains FAILS this gate; a tag outside the vocabulary FAILS; a clean
// roster passes.
//
// SEVERITY: ENFORCING — the roster ships complete this slice, so a clean tree
// passes; any future un-tagged persona or off-vocabulary tag is a real break.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 2; brief:atlas:ws-agent-memory-slice-2-read-at-dispatch-mandate:2026-06-25.
//   Engineering Charter cmd 2 (fail-closed), cmd 4 (source-don't-hardcode).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-mandate-domains-coverage";
const ENFORCING = true;

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

/** The shape this gate reads out of the roster JSON. */
export interface RosterForCoverage {
  readonly personas: ReadonlyArray<{
    readonly name?: string;
    readonly mandateDomains?: unknown;
  }>;
  readonly vocabulary: {
    readonly tags?: unknown;
    readonly shared?: unknown;
  };
}

/** Parse the raw roster JSON into the coverage shape. Throws on malformed JSON. */
export function parseRosterForCoverage(rosterJson: string): RosterForCoverage {
  const raw = JSON.parse(rosterJson) as {
    personas?: Array<{ name?: string; mandateDomains?: unknown }>;
    mandateDomainVocabulary?: { tags?: unknown; shared?: unknown };
  };
  return {
    personas: raw.personas ?? [],
    vocabulary: {
      tags: raw.mandateDomainVocabulary?.tags,
      shared: raw.mandateDomainVocabulary?.shared,
    },
  };
}

/**
 * Pure assertion core (exercised sabotage-proof in the test). Returns a violation
 * per persona with empty/absent mandateDomains or an off-vocabulary tag, plus a
 * violation if the vocabulary does not reserve the `shared` tag.
 */
export function assertMandateDomainsCoverage(
  roster: RosterForCoverage,
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const tags = Array.isArray(roster.vocabulary.tags)
    ? roster.vocabulary.tags.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const vocab = new Set(tags);
  const sharedTag =
    typeof roster.vocabulary.shared === "string" && roster.vocabulary.shared.length > 0
      ? roster.vocabulary.shared
      : "shared";

  // Assertion 3: the vocabulary reserves/handles `shared`.
  asserted++;
  if (!vocab.has(sharedTag)) {
    violations.push({
      subject: "mandateDomainVocabulary",
      message: `The reserved bank-wide common-core tag "${sharedTag}" is not present in mandateDomainVocabulary.tags — readMyMemory unions it into every agent's load-filter, so it MUST be a known tag (D-AGENT-MEMORY-PERSISTENCE).`,
      severity,
    });
  }

  // Assertions 1 + 2: every persona has a non-empty, in-vocabulary mandateDomains.
  for (const p of roster.personas) {
    const name = typeof p.name === "string" && p.name.length > 0 ? p.name : "(unnamed persona)";
    asserted++;

    const domains = Array.isArray(p.mandateDomains)
      ? p.mandateDomains.filter((d): d is string => typeof d === "string" && d.length > 0)
      : [];

    if (domains.length === 0) {
      violations.push({
        subject: `Team/_team-roster.json:${name}`,
        message: `Persona "${name}" has no explicit mandateDomains[] — read-at-dispatch (readMyMemory) has no load-filter for it and would silently return nothing. Add explicit mandate tags (NOT derived from reportsTo). D-AGENT-MEMORY-PERSISTENCE.`,
        severity,
      });
      continue;
    }

    for (const d of domains) {
      if (!vocab.has(d)) {
        violations.push({
          subject: `Team/_team-roster.json:${name}`,
          message: `Persona "${name}" carries mandate tag "${d}" which is NOT in the closed mandateDomainVocabulary.tags — a federated memory tagged "${d}" would land in a bucket no agent loads. Add the tag to the vocabulary or fix the typo. D-AGENT-MEMORY-PERSISTENCE.`,
          severity,
        });
      }
    }
  }

  return { asserted, violations };
}

export interface MandateDomainsCoverageDeps {
  /** Override roster JSON (tests). Default: read Team/_team-roster.json. */
  readonly rosterJson?: string;
}

export function run(deps: MandateDomainsCoverageDeps = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  const rosterPath = resolve(REPO_ROOT, "Team/_team-roster.json");
  const rosterJson =
    deps.rosterJson ?? (existsSync(rosterPath) ? readFileSync(rosterPath, "utf8") : "{}");

  let roster: RosterForCoverage;
  try {
    roster = parseRosterForCoverage(rosterJson);
  } catch (e) {
    result.asserted = 1;
    result.violations = [
      {
        subject: "Team/_team-roster.json",
        message: `roster JSON failed to parse: ${(e as Error).message}`,
        severity,
      },
    ];
    result.ok = false;
    return result;
  }

  const { asserted, violations } = assertMandateDomainsCoverage(roster, severity);
  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : result.ok ? "ADVISORY" : "FAIL";
  console.log(`recon:agent-mandate-domains-coverage [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
