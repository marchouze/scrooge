// platform/recon/ba-form-numbering.ts
//
// Continuous-controls pipeline: ba-form-numbering.
//
// Asserts that no living policy or procedure co-locates a SARB BA-return form
// number with a MEANING that contradicts the canonical D5/2025 schedule. The
// canonical schedule is the one rendered by the actual downloaded forms in
// Regulations/SARB-PA/ba-returns/ (ba-*.md) and consolidated in
// Regulations/SARB-PA/ba-returns/_canonical-register.md.
//
// Root cause this gate guards against: D5/2025 RE-CUT the GG-35950 (2012) form
// schedule — e.g. LCR moved BA 325 -> BA 110, NSFR moved BA 326 -> BA 120, and
// BA 325 was re-assigned to FRTB market risk. Policies/procedures authored against
// the old schedule (or with outright-wrong mappings like BA 900 = LCR, BA 600 =
// large exposures, BA 700 = leverage ratio) silently disagree with the canonical
// numbering. This gate FAILS on each known-wrong (form, meaning) co-location.
//
// Authority:
//   - D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025 (CEO 2026-06-07) — D5/2025 canonical,
//     supersedes GG-35950 and D-BA-RETURN-FORM-NUMBERING-RECON.
//   - D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION (CEO 2026-06-09) — this gate.
//
// Allowlist discipline: PENDING_REMEDIATION carries the files still on the legacy/
// wrong numbering that have not yet been remediated. The gate FAILS on any
// non-allowlisted violation (a NEW diverging file, or a regression in a remediated
// file). As each file is remediated it is removed from the allowlist; the end state
// is an empty allowlist. A non-empty allowlist is itself surfaced (info) so the
// backlog is never silent.
//
// P1 — does not emit events; build-time integrity check.
// P2 — BA-form numbering is a typed property of the regulatory return node; this
//      gate keeps every citing node coherent with the canonical schedule.
//
// Author: Atlas (Core banking platform architect, engineering).
// Convention authority: Mira (Compliance / RegTech engineer) under Zara (CCO).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba-form-numbering";
const MODE: "advisory" | "enforcing" = "enforcing";

// ---------------------------------------------------------------------------
// Forbidden (form, meaning) co-locations — each is a stale-GG-2012 or
// outright-wrong mapping. A line that matches `form` AND `meaning` is a fail.
// ---------------------------------------------------------------------------

interface ForbiddenPair {
  readonly id: string;
  readonly form: RegExp; // the wrong form number
  readonly meaning: RegExp; // the meaning that makes it wrong
  readonly correct: string; // the canonical form for that meaning
}

// Form-number matcher: BA 325 / BA-325 / BA325 (case-insensitive).
const ba = (n: number): RegExp => new RegExp(`\\bBA[\\s-]?${n}\\b`, "i");

const FORBIDDEN: readonly ForbiddenPair[] = [
  {
    id: "lcr-is-ba110",
    form: ba(325),
    meaning: /\bLCR\b|liquidity[-\s]coverage/i,
    correct: "BA 110",
  },
  {
    id: "nsfr-is-ba120",
    form: ba(326),
    meaning: /\bNSFR\b|net[-\s]stable[-\s]funding/i,
    correct: "BA 120",
  },
  {
    id: "lcr-nsfr-not-ba900",
    form: ba(900),
    meaning: /\bLCR\b|\bNSFR\b|liquidity[-\s]coverage|net[-\s]stable[-\s]funding/i,
    correct: "BA 110 (LCR) / BA 120 (NSFR)",
  },
  {
    id: "frtb-imanot-ba326",
    form: ba(326),
    meaning: /\bFRTB\b|\bIMA\b/i,
    correct: "BA 325 (FRTB; no BA 326 IMA form)",
  },
  {
    id: "saccr-is-ba210",
    form: ba(325),
    meaning: /SA[-\s]?CCR|counterparty[-\s]credit/i,
    correct: "BA 210",
  },
  {
    id: "ccp-not-ba326",
    form: ba(326),
    meaning: /\bCCP\b|central[-\s]counterparty/i,
    correct: "BA 210 (no BA 326 CCP form)",
  },
  {
    id: "marketrisk-is-ba310",
    form: ba(300),
    meaning: /market[-\s]risk/i,
    correct: "BA 310 (BA 300 = operational risk)",
  },
  {
    id: "largeexp-not-ba600",
    form: ba(600),
    meaning: /large[-\s]exposure/i,
    correct: "BA 600 = balance sheet (large-exposures ≠ BA 600)",
  },
  {
    id: "leverage-is-ba400",
    form: ba(700),
    meaning: /leverage[-\s]ratio/i,
    correct: "BA 400 (BA 700 = PVA + leverage disclosure)",
  },
  {
    id: "creditrisk-not-ba340",
    form: ba(340),
    meaning: /credit[-\s]risk[-\s]return|credit[-\s]risk[-\s]capital/i,
    correct: "BA 200 (BA 340 = equity risk in banking book)",
  },
  {
    id: "fxnop-not-ba110",
    form: ba(110),
    meaning: /FX[-\s]?NOP|net[-\s]open[-\s]position|daily[-\s]return[-\s]NOP/i,
    correct: "BA 110 = LCR; FX-NOP rides BA 310 (daily-NOP form unresolved)",
  },
];

// ---------------------------------------------------------------------------
// PENDING_REMEDIATION — repo-relative paths still on legacy/wrong numbering.
// Each is tracked under D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION; remove a
// path once remediated. End state: empty.
// ---------------------------------------------------------------------------

const PENDING_REMEDIATION = new Set<string>([
  // Seeded 2026-06-09 from the bank-wide sweep (94 conflicts / 19 files) under
  // D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION. Remove each path as it is
  // remediated to the canonical D5/2025 numbering. End state: empty.
  "Policies/credit-risk-policy-v1.md",
  "Policies/ifrs9-ecl-provisioning-policy-v1.md",
  "Policies/operational-resilience-policy-v1.md",
  "Policies/pillar-3-disclosure-policy-v1.md",
  "Policies/regulatory-reporting-policy-v1.md",
  "Procedures/by-policy/ba-return-generation.md",
  "Procedures/by-policy/credit-risk-limit-management.md",
  "Procedures/by-policy/pillar-3-disclosure-cycle.md",
  // NPA v2 + npa-gate carry a substantive FX-NOP framing error ("BA-110
  // daily-return NOP") that is NOT a mechanical number swap: BA 110 is the LCR
  // return, and the correct daily effective-NOP attestation form (Reg 29(3)) is
  // itself unresolved per D-FX-NOP-SLA-CITATION-D5-MIGRATION. Correcting a
  // CORPORATE-BIND policy's substance is owner-gated (Saskia/Owen) — tracked here
  // rather than swept mechanically.
  "Policies/new-product-approval-policy-v2.md",
  "Procedures/by-policy/npa-gate.md",
]);

// ---------------------------------------------------------------------------
// Repo root
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

// ---------------------------------------------------------------------------
// Markdown file collection
// ---------------------------------------------------------------------------

function collectMarkdown(dir: string, repoRoot: string, acc: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectMarkdown(full, repoRoot, acc);
    } else if (entry.endsWith(".md")) {
      acc.push(full.slice(repoRoot.length + 1));
    }
  }
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

export interface BaFormNumberingOpts {
  readonly repoRootOverride?: string;
  readonly pathsOverride?: readonly string[]; // for tests
  readonly allowlistOverride?: ReadonlySet<string>; // for tests
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
            message: `BA-form-number conflict [${pair.id}]: line co-locates a wrong form number with its meaning — correct form is ${pair.correct}.${allowlisted ? " (allowlisted: PENDING_REMEDIATION)" : ""}`,
            severity: allowlisted ? "warn" : "fail",
          });
        }
      }
    }
  }

  // Surface the standing backlog (never silent) + flag stale allowlist entries.
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
