// platform/recon/ba-form-numbering.ts
//
// Continuous-controls pipeline: ba-form-numbering.
//
// Asserts that no living policy or procedure co-locates a SARB BA-return form
// number with a MEANING that contradicts the canonical schedule. The canonical
// schedule is sourced from the actual downloaded SARB Excel forms in
// Regulations/SARB-PA/ba-returns/schemas/ (each workbook's number-tab cell A1 is the
// official name), consolidated in Regulations/SARB-PA/ba-returns/_canonical-register.md.
//
// Root cause this gate guards against: the bank's corpus FABRICATED a BA-return
// numbering scheme from the D5/2025 directive's routing lines without sight of the
// forms — capital=BA 100, LCR=BA 110, NSFR=BA 120, market=BA 310, FRTB=BA 325,
// op-risk=BA 400, balance-sheet=BA 600. The actual forms say otherwise: BA 100 =
// Balance Sheet, BA 110 = Off-Balance-Sheet Activities, BA 120 = Income Statement,
// BA 300 = Liquidity Risk (LCR), BA 320 = Market Risk, BA 400 = Operational Risk,
// BA 700 = Capital Adequacy + Leverage + TLAC. BA 326 does not exist. This gate FAILS
// on each fabricated (form, meaning) co-location.
//
// Authority:
//   - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO 2026-06-09) — the Excel forms are
//     definitive; supersedes D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025 and
//     D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION.
//
// Allowlist discipline: PENDING_REMEDIATION carries the files still on the fabricated
// numbering that have not yet been re-numbered. The gate FAILS on any non-allowlisted
// violation (a NEW diverging file, or a regression). As each file is remediated it is
// removed; end state empty. A stale allowlist entry (no longer conflicting) fails.
//
// P1 — does not emit events; build-time integrity check.
// P2 — BA-form numbering is a typed property of the regulatory return node.
//
// Author: Atlas (Core banking platform architect, engineering).
// Convention authority: Mira (Compliance / RegTech engineer) under Zara (CCO).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba-form-numbering";
const MODE: "advisory" | "enforcing" = "enforcing";

interface ForbiddenPair {
  readonly id: string;
  readonly form: RegExp;
  readonly meaning: RegExp;
  readonly correct: string;
}

// Form-number matcher: BA 100 / BA-100 / BA100 (case-insensitive).
const ba = (n: number): RegExp => new RegExp(`\\bBA[\\s-]?${n}\\b`, "i");

const FORBIDDEN: readonly ForbiddenPair[] = [
  {
    id: "capital-is-ba700",
    form: ba(100),
    meaning: /capital[-\s]adequacy|capital[-\s]ratio/i,
    correct: "BA 700 (BA 100 = balance sheet)",
  },
  {
    id: "lcr-is-ba300",
    form: ba(110),
    meaning: /\bLCR\b|liquidity[-\s]coverage/i,
    correct: "BA 300 (BA 110 = off-balance-sheet activities)",
  },
  {
    id: "nsfr-is-ba300",
    form: ba(120),
    meaning: /\bNSFR\b|net[-\s]stable[-\s]funding/i,
    correct: "BA 300 series (BA 120 = income statement)",
  },
  {
    id: "lcr-not-ba325",
    form: ba(325),
    meaning: /\bLCR\b|liquidity[-\s]coverage/i,
    correct: "BA 300 (BA 325 = trading & treasury selected risk)",
  },
  {
    id: "oprisk-is-ba400",
    form: ba(300),
    meaning: /operational[-\s]risk/i,
    correct: "BA 400 (BA 300 = liquidity risk)",
  },
  {
    id: "marketrisk-is-ba320",
    form: ba(310),
    meaning: /market[-\s]risk/i,
    correct: "BA 320 (BA 310 = liquid-asset reserve)",
  },
  {
    id: "leverage-is-ba700",
    form: ba(400),
    meaning: /leverage[-\s]ratio/i,
    correct: "BA 700 (BA 400 = operational risk)",
  },
  {
    id: "balancesheet-is-ba100",
    form: ba(600),
    meaning: /balance[-\s]sheet/i,
    correct: "BA 100 (BA 600 = consolidated return)",
  },
  {
    id: "income-is-ba120",
    form: ba(610),
    meaning: /income[-\s]statement/i,
    correct: "BA 120 (BA 610 = foreign operations)",
  },
  {
    id: "lcr-nsfr-not-ba900",
    form: ba(900),
    meaning: /\bLCR\b|\bNSFR\b|liquidity[-\s]coverage|net[-\s]stable[-\s]funding/i,
    correct: "BA 300",
  },
  // BA 326 does not exist in the SARB schedule (real sequence BA 325 -> BA 330).
  {
    id: "ba326-nonexistent",
    form: ba(326),
    meaning: /\S/,
    correct: "no such form — real sequence is BA 325 -> BA 330",
  },
];

const PENDING_REMEDIATION = new Set<string>([
  // Seeded 2026-06-09 from the bank-wide scan (87 conflicts / 21 files) under
  // D-BA-RETURN-NUMBERING-EXCEL-CANONICAL. All 21 policy/procedure files were
  // re-numbered to the canonical Excel forms by Mira (Compliance / RegTech engineer)
  // under WS-BA-NUMBERING-REMEDIATION and removed from this allowlist (2026-06-09).
  // The set is now EMPTY: the policy/procedure corpus is clean. The reporting code
  // (ba-110-lcr.ts etc.) and the obligations register ORG-PR-RETURNS-* are NOT scanned
  // by this gate (it walks Policies/ + Procedures/ only); their replay-safe re-number is
  // a separate track owned by Bea/Atlas under the same authority. End state reached: empty.
]);

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

function collectMarkdown(dir: string, repoRoot: string, acc: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectMarkdown(full, repoRoot, acc);
    else if (entry.endsWith(".md")) acc.push(full.slice(repoRoot.length + 1));
  }
}

export interface BaFormNumberingOpts {
  readonly repoRootOverride?: string;
  readonly pathsOverride?: readonly string[];
  readonly allowlistOverride?: ReadonlySet<string>;
}

export function runBaFormNumberingRecon(opts: BaFormNumberingOpts = {}): ReconResult {
  const repoRoot = opts.repoRootOverride ?? REPO_ROOT;
  const allowlist = opts.allowlistOverride ?? PENDING_REMEDIATION;
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  let paths: string[];
  if (opts.pathsOverride) {
    paths = [...opts.pathsOverride];
  } else {
    paths = [];
    collectMarkdown(resolve(repoRoot, "Policies"), repoRoot, paths);
    collectMarkdown(resolve(repoRoot, "Procedures"), repoRoot, paths);
  }

  let asserted = 0;
  const flaggedFiles = new Set<string>();

  for (const rel of paths) {
    asserted++;
    let content: string;
    try {
      content = readFileSync(resolve(repoRoot, rel), "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      for (const pair of FORBIDDEN) {
        if (pair.form.test(line) && pair.meaning.test(line)) {
          flaggedFiles.add(rel);
          const allowlisted = allowlist.has(rel);
          violations.push({
            subject: `${rel}:${i + 1}`,
            message: `BA-form-number conflict [${pair.id}]: line co-locates a fabricated form number with its meaning — correct form is ${pair.correct}.${allowlisted ? " (allowlisted: PENDING_REMEDIATION)" : ""}`,
            severity: allowlisted ? "warn" : "fail",
          });
        }
      }
    }
  }

  for (const rel of allowlist) {
    if (!flaggedFiles.has(rel)) {
      violations.push({
        subject: rel,
        message:
          "Stale PENDING_REMEDIATION entry — file no longer has a BA-form-number conflict; remove it from the allowlist.",
        severity: "fail",
      });
    }
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = MODE === "enforcing" ? violations.every((v) => v.severity !== "fail") : true;

  const fails = violations.filter((v) => v.severity === "fail").length;
  const warns = violations.filter((v) => v.severity === "warn").length;

  logger.info({
    pipeline: PIPELINE,
    asserted,
    fails,
    warns,
    ok: result.ok,
    mode: MODE,
    pendingRemediation: allowlist.size,
    msg: result.ok
      ? `${PIPELINE} (${MODE}): asserted ${asserted} file(s); ${fails} fail(s), ${warns} warn(s) (allowlisted); ${allowlist.size} pending remediation`
      : `${PIPELINE} FAILED — ${fails} non-allowlisted BA-form-number conflict(s)`,
    detail: violations,
  });

  return result;
}

if (import.meta.main) {
  const result = runBaFormNumberingRecon();
  const fails = result.violations.filter((v) => v.severity === "fail").length;
  const warns = result.violations.filter((v) => v.severity === "warn").length;
  console.log(
    JSON.stringify({
      level: result.ok ? "info" : "error",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      fails,
      warns,
      ok: result.ok,
      mode: MODE,
      msg: result.ok
        ? `${PIPELINE} (${MODE}): ${fails} fail(s), ${warns} warn(s)`
        : `${PIPELINE} FAILED — ${fails} fail(s)`,
      detail: result.violations,
    }),
  );
  process.exit(result.ok ? 0 : 1);
}
