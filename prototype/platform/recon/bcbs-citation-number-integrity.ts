// platform/recon/bcbs-citation-number-integrity.ts
//
// Vera recon: bcbs-citation-number-integrity.
//
// Fail-closed, harden-only gate that pins each cited BCBS document number to
// its canonical title, validated against the BIS source (the domain-truth
// oracle — bis.org). It exists because the library carried a systemic
// d-number mis-citation: the LCR was recorded as BCBS d295 (it is d238) and the
// NSFR as BCBS d335 (it is d295; d335 is the RCAP Saudi Arabia assessment).
// The defect survived the citation-gate because it was internally CONSISTENT
// but wrong — exactly the failure mode this gate now forecloses. A
// consistent-but-wrong result is a finding (Engineering Charter cmd 8;
// D-AGENT-DOMAIN-COMPETENCE).
//
// What it asserts
// ---------------
// For each prose citation of the form `BCBS [D]<nnn>` that appears within a
// short window of a canonical-title keyword (LCR / NSFR / IRRBB / intraday /
// sound-liquidity / SA-CCR / FRTB / stress-testing), the cited number MUST be
// the canonical number for that title, and a number MUST NOT be cited against
// a title that is NOT its canonical title.
//
//   238 = LCR (Basel III LCR + liquidity risk monitoring tools, Jan 2013)
//   295 = NSFR (Basel III: the net stable funding ratio, Oct 2014)
//   368 = IRRBB (Interest rate risk in the banking book, Apr 2016)
//   248 = intraday liquidity monitoring tools (Apr 2013)
//   144 = Principles for Sound Liquidity Risk Management (Sep 2008)
//   279 = SA-CCR (standardised approach for counterparty credit risk, Mar 2014)
//   352 = market risk minimum capital requirements (Jan 2016, superseded)
//   457 = FRTB market risk minimum capital requirements (Jan 2019)
//   450 = Stress testing principles (Oct 2018)
//
// Two numbers are explicitly flagged as NEVER-a-liquidity/IRRBB-standard, so
// any pairing of them with LCR/NSFR/IRRBB is a violation:
//   295 must NOT be cited as the LCR (it is the NSFR)
//   335 must NOT be cited as the NSFR or IRRBB (it is RCAP Saudi Arabia)
//   365 must NOT be cited as the IRRBB standard (it is the leverage-ratio
//       consultative document, Apr 2016 — the IRRBB STANDARD is d368)
//
// Scope / known exception
// -----------------------
// The runtime citation-identifier constant `BCBS-D365-IRRBB` (a hyphenated
// token, distinct from the prose form `BCBS d365`) is a replay-sensitive
// event-citation identity emitted across the markets / ALM event registries.
// Its correction (d365 → d368) is coupled to the `platform/alm/*` engine
// change owned by a separate concurrent task (one-dispatch-path-per-scope).
// This gate therefore asserts only on the PROSE citation form `BCBS [D]<nnn>`
// and explicitly ignores the hyphenated `BCBS-D<nnn>-<TAG>` constant form, to
// avoid colliding with that change. The constant cluster is tracked as a
// cross-task coordination finding under D-BCBS-CITATION-NUMBERING-REMEDIATION.
//
// Mode: blocking (FAIL severity). Harden-only.
//
// Authority: D-BCBS-CITATION-NUMBERING-REMEDIATION (CEO session-delegation
//   2026-06-26); D-ENGINEERING-INTEGRITY-CHARTER; D-AGENT-DOMAIN-COMPETENCE.
// Author: Mira (Compliance / RegTech engineer, compliance — reports to Zara,
//   Chief Compliance Officer), with Eitan (Treasurer) + Helena (CRO) as domain
//   co-authority. Validated against the BIS source.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "bcbs-citation-number-integrity";

/**
 * The canonical BCBS number for each liquidity / IRRBB / stress-testing
 * standard, validated against bis.org (the domain-truth oracle). Kept for
 * documentation + the failure-message wording; the gate enforces the
 * high-precision FORBIDDEN_PAIRINGS below rather than a noisy "every number
 * near this title must be canonical" sweep (multi-standard citation lines
 * legitimately co-mention several correct numbers near several titles).
 */
export const CANONICAL_BCBS_NUMBERS = {
  LCR: 238, // Basel III LCR + liquidity risk monitoring tools, Jan 2013
  NSFR: 295, // Basel III: the net stable funding ratio, Oct 2014
  IRRBB: 368, // Interest rate risk in the banking book, Apr 2016
  INTRADAY: 248, // Monitoring tools for intraday liquidity management, Apr 2013
  SOUND_LIQUIDITY: 144, // Principles for Sound Liquidity Risk Management, Sep 2008
  SA_CCR: 279, // Standardised approach for counterparty credit risk, Mar 2014
  FRTB: 457, // Minimum capital requirements for market risk (FRTB), Jan 2019
  STRESS_TESTING: 450, // Stress testing principles, Oct 2018
} as const;

/**
 * Numbers that are categorically NOT a given standard — citing them against
 * that title is always a violation. These are the exact mis-citations the
 * remediation removed; pinning them is the durable guard.
 */
const FORBIDDEN_PAIRINGS: readonly {
  number: number;
  titleLabel: string;
  keywords: readonly string[];
  reason: string;
}[] = [
  {
    number: 295,
    titleLabel: "LCR",
    keywords: ["lcr", "liquidity coverage ratio"],
    reason: "BCBS d295 is the NSFR (Oct 2014); the LCR is BCBS d238 (Jan 2013)",
  },
  {
    number: 335,
    titleLabel: "NSFR",
    keywords: ["nsfr", "net stable funding"],
    reason:
      "BCBS d335 is the RCAP Saudi Arabia assessment (Sep 2015); the NSFR is BCBS d295 (Oct 2014)",
  },
  {
    number: 335,
    titleLabel: "IRRBB",
    keywords: [
      "irrbb",
      "interest rate risk in the banking book",
      "interest-rate risk in the banking book",
    ],
    reason:
      "BCBS d335 is the RCAP Saudi Arabia assessment; the IRRBB standard is BCBS d368 (Apr 2016)",
  },
  {
    number: 365,
    titleLabel: "IRRBB",
    keywords: [
      "irrbb",
      "interest rate risk in the banking book",
      "interest-rate risk in the banking book",
    ],
    reason:
      "BCBS d365 is the Basel III leverage-ratio revisions consultative document (Apr 2016); the IRRBB STANDARD is BCBS d368",
  },
  {
    number: 295,
    titleLabel: "stress testing",
    keywords: ["stress testing", "stress-testing"],
    reason: "BCBS d295 is the NSFR; the Stress Testing Principles are BCBS d450 (Oct 2018)",
  },
];

/**
 * Proximity window (characters either side of the number token) for keyword
 * scan. Kept tight: a wrong number is reported only when its title keyword sits
 * in immediate apposition (e.g. `BCBS d295 (LCR)`, `LCR ... BCBS d295`, or
 * `BCBS d295 *Stress Testing*`), not merely on the same multi-standard line.
 */
const WINDOW = 28;

/**
 * For each number with a single canonical title, the keyword(s) that — when
 * found in IMMEDIATE apposition after the token (`d295 (NSFR)`, `d295 — NSFR`,
 * `d295 *Stress Testing*`) — prove the citation correct and suppress any
 * forbidden-pairing report driven by a DIFFERENT title keyword sitting nearby
 * on the same multi-standard line.
 */
const OWN_APPOSED_TITLE: Record<number, readonly string[]> = {
  238: ["lcr", "liquidity coverage"],
  295: ["nsfr", "net stable funding"],
  368: [
    "irrbb",
    "interest rate risk in the banking book",
    "interest-rate risk in the banking book",
  ],
  248: ["intraday"],
  144: ["sound liquidity", "principles for sound"],
  279: ["sa-ccr", "counterparty credit risk"],
  457: ["frtb", "market risk"],
  450: ["stress testing", "stress-testing"],
};

/**
 * Lines that DOCUMENT a correction (the established `[correction (...)]`
 * annotation, or a changelog row recording the legacy-then-corrected value)
 * legitimately mention the old wrong number to record the fix. Skip them so the
 * gate does not flag its own remediation trail.
 */
function isCorrectionContext(line: string): boolean {
  const l = line.toLowerCase();
  return (
    l.includes("[correction (") ||
    l.includes("correction (mira") ||
    l.includes("was wrongly") ||
    l.includes("corrected d") ||
    l.includes("→ d2") ||
    l.includes("→ d3") ||
    l.includes('legacy "bcbs') ||
    l.includes('legacy `"bcbs') ||
    l.includes("not the nsfr") ||
    l.includes("not the lcr") ||
    l.includes("not the irrbb") ||
    l.includes("rcap saudi arabia")
  );
}

/**
 * Prose BCBS citation token. Matches `BCBS D295`, `BCBS d295`, `BCBS 248` —
 * but NOT the hyphenated constant `BCBS-D365-IRRBB` (which is preceded by a
 * hyphen and followed by `-TAG`), nor a hyphen-joined `BCBS-D295`. We require a
 * whitespace separator between `BCBS` and the optional `D`/`d` + digits, and we
 * reject a trailing `-<LETTER>` constant tag.
 */
const TOKEN_RE = /BCBS\s+[Dd]?(\d{3})\b(?!-[A-Za-z])/g;

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

/** Citation surfaces this gate scans. Source-doc verbatim extracts are excluded. */
const SCAN_DIRS = ["Policies", "Procedures", "Regulations"] as const;
const SCAN_FILES = [
  "prototype/platform/reporting/ba-300-lcr.ts",
  "prototype/platform/reporting/ba-330-irrbb.ts",
  "prototype/platform/accounting/coa-registry.ts",
] as const;

const SKIP_PATH_FRAGMENTS = [
  "/source-docs/",
  "/archive/",
  "/node_modules/",
  // The remediation audit deliberately documents the OLD wrong number→title
  // pairings to record the correction (Charter cmd 5); it is a record OF the
  // fix, not a live mis-citation. Excluded like source-doc verbatim extracts.
  "_bcbs-citation-numbering-remediation-audit.md",
];
const SCAN_EXTS = [".md", ".html", ".ts", ".json", ".yml", ".yaml"];

function shouldSkip(path: string): boolean {
  return SKIP_PATH_FRAGMENTS.some((frag) => path.includes(frag));
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (shouldSkip(full)) continue;
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (SCAN_EXTS.some((e) => full.endsWith(e))) {
        out.push(full);
      }
    }
  };
  for (const d of SCAN_DIRS) walk(resolve(root, d));
  for (const f of SCAN_FILES) {
    const full = resolve(root, f);
    if (existsSync(full) && !shouldSkip(full)) out.push(full);
  }
  return out;
}

function nearbyHasKeyword(
  text: string,
  idx: number,
  len: number,
  keywords: readonly string[],
): boolean {
  const start = Math.max(0, idx - WINDOW);
  const end = Math.min(text.length, idx + len + WINDOW);
  const win = text.slice(start, end).toLowerCase();
  return keywords.some((k) => win.includes(k));
}

/**
 * The title in IMMEDIATE apposition AFTER the number token: `d295 (NSFR)`,
 * `d295 — NSFR`, `d295 *Stress Testing*`, `d295,` followed by a title within a
 * few chars. If a number is directly apposed to its OWN canonical title, the
 * citation is correct and must not be flagged because some OTHER title keyword
 * happens to sit nearby on a multi-standard line. Returns the lower-cased
 * apposed snippet (up to 36 chars after the token).
 */
function apposedTitleSnippet(text: string, idx: number, len: number): string {
  // Stop at the first citation delimiter so the snippet cannot bleed into the
  // NEXT BCBS token on a multi-standard line (`d295 (LCR); BCBS d295 (NSFR)` —
  // the first token's apposed title is "(LCR)", not "(NSFR)").
  const raw = text.slice(idx + len, Math.min(text.length, idx + len + 36));
  const stop = raw.search(/[;)\]\n]|\bBCBS\b/i);
  return (stop >= 0 ? raw.slice(0, stop) : raw).toLowerCase();
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const root = findRepoRoot(import.meta.dir);
  const files = collectFiles(root);

  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = file.slice(root.length + 1);

    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null = TOKEN_RE.exec(text);
    while (m !== null) {
      const num = Number(m[1]);
      const idx = m.index;
      const len = m[0].length;
      asserted++;

      const lineNo = text.slice(0, idx).split("\n").length;
      const lineText = text.split("\n")[lineNo - 1] ?? "";

      // Forbidden pairings: a number cited in apposition to a title that is NOT
      // its standard. Skip lines that DOCUMENT a correction (they legitimately
      // recite the old wrong number to record the fix), and suppress when the
      // number is directly apposed to its OWN canonical title (a correct cite
      // that merely sits near another title on a multi-standard line).
      if (!isCorrectionContext(lineText)) {
        const apposed = apposedTitleSnippet(text, idx, len);
        const ownTitles = OWN_APPOSED_TITLE[num] ?? [];
        const apposedToOwnTitle = ownTitles.some((k) => apposed.includes(k));
        if (!apposedToOwnTitle) {
          for (const fp of FORBIDDEN_PAIRINGS) {
            if (num === fp.number && nearbyHasKeyword(text, idx, len, fp.keywords)) {
              violations.push({
                subject: `${rel}:${lineNo}`,
                message: `BCBS d${num} cited as the ${fp.titleLabel} — ${fp.reason}`,
                severity: "fail",
              });
            }
          }
        }
      }

      m = TOKEN_RE.exec(text);
    }
  }

  // De-duplicate identical (subject,message) violations.
  const seen = new Set<string>();
  const deduped: ReconViolation[] = [];
  for (const v of violations) {
    const key = `${v.subject}::${v.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(v);
  }

  result.asserted = asserted;
  result.violations = deduped;
  result.ok = deduped.filter((v) => v.severity === "fail").length === 0;
  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  for (const v of fails.slice(0, 40)) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }
  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} BCBS citation token(s) checked; every cited number matches its canonical title`,
    );
  } else {
    console.error(`\nrecon:${PIPELINE} FAILED — ${fails.length} mis-cited BCBS number(s)`);
    process.exit(1);
  }
}
