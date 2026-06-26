// platform/recon/agent-spec-domain-competence.ts
//
// Continuous-controls pipeline: agent-spec domain-competence integrity
// (D-AGENT-DOMAIN-COMPETENCE, CEO-approved 2026-06-25).
//
// Sibling to `platform/recon/agent-spec.ts`. The structural recon asserts
// §6–§17 (the operating spec). This pipeline asserts the next layer the
// domain-competence decision adds: §18–§20, the three sections that hold a
// seat to domain TRUTH rather than mere internal consistency, and that
// require the seat to reject a wrong premise:
//
//   §18  Authoritative knowledge base & sources
//   §19  Domain-truth validation
//   §20  Premise-challenge duty
//
// WHY THIS EXISTS
// ---------------
// The bank's FX accounting errors were domain-MODEL failures, not
// engineering failures: the code balanced, compiled, and passed every
// structural recon, but the accounting concept was wrong, and a wrong
// premise propagated from the orchestrator's brief to the executing agent
// unchallenged. §18–§20 are the per-seat governance scaffolding that makes
// "validate against domain truth" and "reject a wrong premise" a recorded
// part of every standing agent's spec. This recon makes their presence
// visible — without it, a persona could ship without the domain-competence
// sections and the gap would be silent.
//
// SEVERITY — per-seat enforced-set (the harden-only ratchet)
// ----------------------------------------------------------
// This launched at `warn` severity for EVERY seat, exactly as
// `agent-spec-cross-link.ts` did: the existing persona corpus pre-dates
// §18–§20, and upgrading each seat with citation-backed domain content (its
// real standards, golden cases, and outranking scope) is per-seat domain work
// that must be sourced, not fabricated in one sweep (Engineering-Charter cmd 4
// — source, don't hardcode).
//
// FLIPPING THE GLOBAL `enforce` SWITCH IS WRONG (D-FX-IFRS-REVIEW-FOUNDATION,
// Scope D). The global flag promotes EVERY seat to `fail` at once, which FAILs
// the ~28 still-ungroomed seats — it cannot be turned on until the whole corpus
// is groomed, so the seats that ARE groomed (Bea, Camille, Owen, …) get NO
// enforcement in the meantime. The fix is a PER-SEAT enforced-set: a seat in
// `FAIL_ENFORCED_SEATS` has its §18–§20 violations raised to `fail`; every other
// seat stays `warn`. A groomed seat is enforced the moment it lands, while the
// backlog continues to surface as `warn` — no green by concealment, no blocking
// the build (Engineering-Charter cmd 3).
//
// HARDEN-ONLY INVARIANT. `FAIL_ENFORCED_SEATS` only ever GROWS: a seat is added
// when its §18–§20 are groomed + validated, and is NEVER removed (removing one
// would weaken the ratchet, which Engineering-Charter cmd 3 forbids). When the
// set covers the whole corpus the grooming backlog is closed and the gate is
// fully enforcing — reached by accretion, not by a single global flip. The
// `assertNoEnforcedSeatRemoved` ratchet check (below) makes the harden-only
// property machine-checked, not merely documented.
//
// Independence note: this pipeline is STRUCTURAL — it asserts the presence
// and substantive fill of §18–§20. It reads files only; it imports no domain
// module. Whether the CONTENT of §18 (the named standards) is correct for a
// seat is a domain question for that seat + Vera's domain-correctness review
// (PROC-GOV-ADC-01), not a structural recon's question.
//
// P6 — upward chain (every persona's domain-competence surface is
// structurally available to the policy / procedure / regulation graph).
//
// Author: Owen (Company Secretary, governance) — D-AGENT-DOMAIN-COMPETENCE

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Walk up from this file until we find CLAUDE.md (the canonical repo-root
// marker used by the other recon pipelines).
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const TEAM_DIR = resolve(REPO_ROOT, "Team");

/**
 * The domain-competence sections (§18–§20). Each tuple is `[number, label]`.
 * Section detection is case-insensitive and tolerates an annotated heading
 * (`## 18. Authoritative knowledge base & sources (accounting)`) via the
 * numeric-prefix primitive — mirrors `agent-spec.ts`.
 */
const DOMAIN_COMPETENCE_SECTIONS: ReadonlyArray<readonly [number, string]> = [
  [18, "Authoritative knowledge base & sources"],
  [19, "Domain-truth validation"],
  [20, "Premise-challenge duty"],
];

/**
 * Minimum substantive-body byte count — identical threshold to
 * `agent-spec.ts` (a bare heading or single placeholder bullet must not
 * pass). Sections that meet the threshold via a markdown table (≥1 data
 * row) are also accepted.
 */
const MIN_BODY_CHARS = 50;

/**
 * The PER-SEAT enforced-set (D-FX-IFRS-REVIEW-FOUNDATION, Scope D). A seat whose
 * name (the `/Team/<Name>.md` basename without extension) is in this set has its
 * §18–§20 presence/substance violations raised to `fail`; every seat NOT in the
 * set stays `warn` (the grooming-window posture). This replaces the global
 * `enforce` flag's all-or-nothing flip: a groomed seat is enforced the moment its
 * §18–§20 land + validate, without waiting for the whole ~28-seat backlog.
 *
 * HARDEN-ONLY — this set ONLY GROWS. Add a seat when its §18–§20 are groomed and
 * validated; NEVER remove one (Engineering-Charter cmd 3 — ratchets harden only).
 * The `FAIL_ENFORCED_SEATS_BASELINE` below is the immutable record of the seats
 * enforced as of the last hardening; `assertNoEnforcedSeatRemoved` fails closed if
 * any baseline seat is missing from the live set (a weakening). Seeded with the
 * three seats whose §18–§20 are confirmed clean under enforcement: Bea (the
 * accounting/financial-reporting engineer who built the FX-IFRS gates), Camille
 * (the CFO signer), and Owen (the Company Secretary who authored the gate).
 */
export const FAIL_ENFORCED_SEATS: ReadonlySet<string> = new Set(["Bea", "Camille", "Owen"]);

/**
 * The harden-only BASELINE — the seats that were FAIL-enforced as of the last
 * ratchet. The live `FAIL_ENFORCED_SEATS` must always be a SUPERSET of this; a
 * baseline seat missing from the live set is a weakening of the ratchet and fails
 * closed (`assertNoEnforcedSeatRemoved`). Update this baseline ONLY when adding
 * seats — never to drop one.
 */
export const FAIL_ENFORCED_SEATS_BASELINE: readonly string[] = ["Bea", "Camille", "Owen"];

/**
 * The resolved §18–§20 severity for one seat: `fail` iff the seat is in the
 * per-seat enforced-set OR the global `enforce` override is set (the latter
 * retained for the eventual whole-corpus closure step / tests). Otherwise `warn`.
 */
function severityForSeat(
  personaName: string,
  globalEnforce: boolean,
  enforcedSeats: ReadonlySet<string>,
): ReconViolation["severity"] {
  return globalEnforce || enforcedSeats.has(personaName) ? "fail" : "warn";
}

/**
 * HARDEN-ONLY ratchet assertion: every seat in `FAIL_ENFORCED_SEATS_BASELINE` must
 * still be present in the live `FAIL_ENFORCED_SEATS`. A missing baseline seat is a
 * weakening of the enforcement ratchet (Engineering-Charter cmd 3) and yields a
 * `fail` violation. Returns the violations (empty when the invariant holds).
 */
export function assertNoEnforcedSeatRemoved(
  liveSet: ReadonlySet<string> = FAIL_ENFORCED_SEATS,
  baseline: readonly string[] = FAIL_ENFORCED_SEATS_BASELINE,
): ReconViolation[] {
  const removed = baseline.filter((s) => !liveSet.has(s));
  if (removed.length === 0) return [];
  return [
    {
      subject: "agent-spec-domain-competence:enforced-set-weakened",
      message: `The per-seat §18–§20 enforced-set lost baseline seat(s) [${removed.join(", ")}]. FAIL_ENFORCED_SEATS is HARDEN-ONLY — a seat, once enforced, is never dropped (Engineering-Charter cmd 3 — ratchets harden only). Restore the removed seat(s) or, if a removal is genuinely intended, it requires a recorded engineering Decision.`,
      severity: "fail",
    },
  ];
}

function exactLabelRegex(num: number, label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+(?:${num}\\.\\s+)?${escaped}\\s*$`, "i");
}

function numberedHeadingRegex(num: number): RegExp {
  return new RegExp(`^##\\s+${num}\\.\\s+`);
}

/**
 * Extract the body of a section, or undefined if neither the exact-label
 * form nor the number-prefix form is present.
 */
function extractSection(content: string, num: number, label: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const exact = exactLabelRegex(num, label);
  const numbered = numberedHeadingRegex(num);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (exact.test(line) || numbered.test(line)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return undefined;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && /^##\s/.test(line)) {
      end = i;
      break;
    }
  }
  return lines
    .slice(start, end)
    .join("\n")
    .replace(/^\s+|\s+$/g, "");
}

/**
 * True iff the section body is substantive — either ≥ MIN_BODY_CHARS
 * characters (after stripping bullet markers), or contains a markdown
 * table with at least one data row. Mirrors `agent-spec.ts.isSubstantive`.
 */
function isSubstantive(body: string): boolean {
  if (body.length === 0) return false;
  if (countTableDataRows(body) >= 1) return true;
  const stripped = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\-*]\s+/, "").trim())
    .filter((l) => l.length > 0)
    .join(" ");
  return stripped.length >= MIN_BODY_CHARS;
}

/** Count the data rows in the first markdown table inside `section`. */
function countTableDataRows(section: string): number {
  const lines = section.split(/\r?\n/);
  let inTable = false;
  let separatorSeen = false;
  let dataRows = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable) {
      if (/^\|\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(trimmed)) {
        inTable = true;
        separatorSeen = true;
        continue;
      }
      continue;
    }
    if (trimmed.startsWith("|")) {
      if (separatorSeen) dataRows++;
      continue;
    }
    if (trimmed === "") break;
    break;
  }
  return dataRows;
}

/** List persona files (skip `_` and dotfiles, skip the template). */
function listPersonaFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !f.startsWith("_") && !f.startsWith("."))
    .map((f) => resolve(dir, f));
}

export interface AssertOpts {
  /** Override the team directory — used by tests against synthetic specs. */
  teamDir?: string;
  /**
   * Override the file list — used by tests that inject a single synthetic
   * spec without writing it under /Team/. Each entry is `[absPath, content]`.
   */
  specs?: ReadonlyArray<readonly [string, string]>;
  /**
   * GLOBAL override: promote EVERY seat's presence violations from `warn` to
   * `fail`. RETAINED for the eventual whole-corpus closure step + tests, but it is
   * NOT the default path — the default uses the PER-SEAT `FAIL_ENFORCED_SEATS`
   * (Scope D), so a groomed seat is enforced without FAILing the ungroomed backlog.
   */
  enforce?: boolean;
  /**
   * Override the per-seat enforced-set — used by tests to inject a synthetic
   * enforced seat. Defaults to `FAIL_ENFORCED_SEATS`.
   */
  enforcedSeats?: ReadonlySet<string>;
  /**
   * Override the harden-only baseline the enforced-set is checked against — used
   * by tests that inject a synthetic `enforcedSeats` for severity testing and do
   * NOT want the production ratchet to fire. Defaults to
   * `FAIL_ENFORCED_SEATS_BASELINE` (the production invariant).
   */
  enforcedSeatsBaseline?: readonly string[];
}

/**
 * Assert agent-spec domain-competence integrity over `specs`. Pure function;
 * reads only the strings provided (or, if `specs` is omitted, reads every
 * persona file under `teamDir` ?? TEAM_DIR).
 *
 * SEVERITY is resolved PER SEAT (Scope D): a seat in `enforcedSeats`
 * (default `FAIL_ENFORCED_SEATS`) — or every seat when the global `enforce`
 * override is set — has its §18–§20 violations at `fail`; every other seat at
 * `warn`. The harden-only `assertNoEnforcedSeatRemoved` ratchet is folded in so a
 * weakening of the enforced-set itself fails the gate.
 */
export function assertDomainCompetence(opts: AssertOpts = {}): ReconResult {
  const result = emptyResult("agent-spec-domain-competence");
  const violations: ReconViolation[] = [];
  const globalEnforce = opts.enforce === true;
  const enforcedSeats = opts.enforcedSeats ?? FAIL_ENFORCED_SEATS;
  const enforcedSeatsBaseline = opts.enforcedSeatsBaseline ?? FAIL_ENFORCED_SEATS_BASELINE;

  // Harden-only ratchet: a weakening of the enforced-set itself fails closed.
  violations.push(...assertNoEnforcedSeatRemoved(enforcedSeats, enforcedSeatsBaseline));

  const specs: Array<readonly [string, string]> =
    opts.specs !== undefined
      ? [...opts.specs]
      : listPersonaFilesIn(opts.teamDir ?? TEAM_DIR).map(
          (p) => [p, readFileSync(p, "utf8")] as const,
        );

  for (const [path, content] of specs) {
    const fileName = basename(path);
    const subject = path.replace(`${REPO_ROOT}/`, "");
    const personaName = fileName.replace(/\.md$/i, "");
    const severity = severityForSeat(personaName, globalEnforce, enforcedSeats);
    result.asserted++;

    for (const [num, label] of DOMAIN_COMPETENCE_SECTIONS) {
      const body = extractSection(content, num, label);
      if (body === undefined) {
        violations.push({
          subject,
          message: `${personaName}: missing § ${num} (${label}) — domain-competence section required by D-AGENT-DOMAIN-COMPETENCE. Add it from the template at Team/_agent-spec-template.md (PROC-GOV-ADC-01).`,
          severity,
        });
        continue;
      }
      if (!isSubstantive(body)) {
        violations.push({
          subject,
          message: `${personaName}: § ${num} (${label}) has no substantive content (≥${MIN_BODY_CHARS} chars of body or a markdown table with ≥1 data row). Populate it with the seat's real domain sources / oracles / outranking scope — do not leave the template placeholders.`,
          severity,
        });
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/**
 * Convenience entry point — runs the assertion over the live `/Team/`
 * directory with PER-SEAT enforcement (Scope D): the seats in
 * `FAIL_ENFORCED_SEATS` are `fail`-enforced, the rest stay `warn` (the grooming
 * window). The whole-corpus closure step is reached by accreting seats into
 * `FAIL_ENFORCED_SEATS`, not by flipping the global `enforce` flag.
 */
export function run(): ReconResult {
  return assertDomainCompetence({});
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? (r.violations.length ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? r.violations.length
          ? `Agent-spec domain-competence recon: ${r.violations.length} warn(s) — §18–§20 grooming window`
          : "Agent-spec domain-competence recon passed"
        : "Agent-spec domain-competence recon FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
