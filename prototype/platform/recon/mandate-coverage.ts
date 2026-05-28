// platform/recon/mandate-coverage.ts
//
// Vera Wave-4 #11 — mandate-coverage.
//
// For each obligation in the obligations register, verify at least one active
// agent in Team/_team-roster.json covers it via their mandate / areas-of-
// expertise. Unmatched obligations surface as `warn`-severity violations
// (build-phase tolerance — many obligations bind at licence-day).
//
// Matching strategy (broad to narrow):
//   1. Extract keyword tokens from the obligation ID prefix (domain code) and
//      the obligation's Requirement and Fulfilment-policy columns.
//   2. For each agent, index the tokens from their §3 Mandate and §4 Areas of
//      expertise sections in their persona file.
//   3. Also match by obligation ID prefix against the `expertise` field in the
//      team-roster JSON (quick first-pass; the regex sweep over persona files
//      is the primary signal).
//
// The pipeline is intentionally lenient: one keyword match between an
// obligation row and any agent covers the obligation. The intent is to surface
// complete orphans — obligations whose domain has no agent at all — not to
// produce a fine-grained coverage gap report.
//
// Authority:
//   - D-REGULATORY-READINESS-GATE-PLAN (CEO-approved 2026-05-10) §3
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2)
//   - P6-AUTONOMOUS-BY-DEFAULT (Principle 6)
//
// Author: Vera (Internal audit engineer, governance) — Wave-4 #11

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "mandate-coverage";

// ---------------------------------------------------------------------------
// Repo-root resolution (shared pattern across recon pipelines)
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
// Obligation parsing — reuses the column layout from obligation-review-status
//
// Column layout (0-indexed, split on "|"):
//   0: (empty)
//   1: ID           e.g. ORG-FC-02
//   2: URN
//   3: Citation / regulation text
//   4: Requirement
//   5: Fulfilment policy
//   6: Owner
//   7: Status
//   8: Applies-at
//   9: Entity scope
//   10: Binding class (COMMENCEMENT-BIND / IN_FORCE / LICENCE-BIND / etc.)
//   11: Product scope
//   12: Activity scope
//   13: Risk taxonomy
//   14: Review status
// ---------------------------------------------------------------------------

interface ObligationRow {
  readonly id: string;
  readonly requirement: string;
  readonly fulfilmentPolicy: string;
  readonly owner: string;
  readonly bindingClass: string;
}

function parseObligationRows(content: string): ObligationRow[] {
  const rows: ObligationRow[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!/^\|\s*ORG-/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    const id = cells[1] ?? "";
    if (!id.startsWith("ORG-")) continue;
    rows.push({
      id,
      requirement: cells[4] ?? "",
      fulfilmentPolicy: cells[5] ?? "",
      owner: cells[6] ?? "",
      bindingClass: cells[10] ?? "",
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Token extraction helpers
// ---------------------------------------------------------------------------

/**
 * Tokenise a free-form text block into lower-cased alpha tokens of ≥ 3 chars.
 * Stop-words are removed to reduce false-positive matches. The goal is to
 * extract meaningful domain keywords (e.g. "capital", "liquidity", "sanctions",
 * "FATF", "credit", "payments").
 */
const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "this",
  "that",
  "with",
  "from",
  "into",
  "its",
  "are",
  "all",
  "any",
  "has",
  "have",
  "not",
  "but",
  "per",
  "via",
  "may",
  "shall",
  "must",
  "each",
  "upon",
  "one",
  "two",
  "set",
  "out",
  "act",
  "law",
  "new",
  "end",
  "use",
  "used",
  "uses",
  "see",
  "also",
  "row",
  "col",
  "cell",
  "rows",
  "cols",
  "bank",
  "banks",
  "hoz",
  "ltd",
  "pty",
]);

function tokenise(text: string): Set<string> {
  const tokens = new Set<string>();
  const words = text.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  for (const w of words) {
    if (!STOP_WORDS.has(w)) tokens.add(w);
  }
  return tokens;
}

/**
 * Map obligation ID domain prefix to a set of broad coverage keywords. This
 * provides a fast first-pass without needing to parse all persona files.
 */
function domainKeywords(id: string): string[] {
  const prefix = id.replace(/^ORG-/, "").split("-")[0] ?? "";
  const map: Record<string, string[]> = {
    PR: [
      "capital",
      "prudential",
      "liquidity",
      "leverage",
      "pillar",
      "icaap",
      "ilaap",
      "sarb",
      "basel",
      "ifrs",
    ],
    FC: [
      "fic",
      "aml",
      "cft",
      "sanctions",
      "pep",
      "str",
      "ctr",
      "kyc",
      "cdd",
      "edd",
      "fatf",
      "screening",
    ],
    EXCON: ["forex", "excon", "exchange", "control", "sarb", "currency"],
    FX: ["forex", "exchange", "currency", "hedging"],
    CY: ["cyber", "security", "ciso", "threat", "js2", "popia", "data"],
    GV: ["governance", "board", "committee", "directors", "reporting", "secretariat"],
    MK: ["market", "trading", "conduct", "jse", "surveillance"],
    JSE: ["jse", "trading", "exchange", "equities", "bonds", "listing"],
    FAIS: ["fais", "fsca", "advice", "conduct", "suitability", "disclosure"],
    AC: ["accounting", "ifrs", "financial", "reporting", "ba-returns", "cfo"],
    CD: ["conduct", "tcf", "disclosure", "complaints", "conflict"],
    CS1: ["crisis", "recovery", "resolution", "continuity"],
    CS2: ["crisis", "recovery", "resolution", "continuity"],
    CS3: ["crisis", "recovery", "resolution", "continuity"],
    RM: ["risk", "management", "rmcp", "framework", "appetite"],
    BNK: ["bank", "consolidation", "group", "capital"],
    GRP: ["group", "consolidation", "reporting", "parent"],
    HR: ["remuneration", "fit", "proper", "employment", "staff", "conduct"],
    JN2: ["group", "consolidated", "ifrs"],
    JS2: ["cyber", "security", "js2", "ciso", "threat"],
    TX: ["tax", "vat", "cit", "stt", "fatca", "crs", "sars"],
    EL: ["legal", "compliance", "election", "notices"],
    FMA: ["financial", "markets", "act", "market", "trading", "reporting"],
    WB: ["whistleblowing", "conduct", "integrity", "ethics"],
  };
  return map[prefix] ?? ["compliance", "regulatory"];
}

// ---------------------------------------------------------------------------
// Agent persona parsing — §3 Mandate + §4 Areas of expertise
// ---------------------------------------------------------------------------

function extractSection(content: string, num: number, label: string): string {
  const lines = content.split(/\r?\n/);
  const labelEscaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRe = new RegExp(`^##\\s+(?:${num}\\.\\s+)?${labelEscaped}\\s*$`, "i");
  const numberedRe = new RegExp(`^##\\s+${num}\\.\\s+`);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (startRe.test(line) || numberedRe.test(line)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s/.test(line)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join(" ");
}

interface AgentCoverage {
  readonly name: string;
  readonly tokens: Set<string>;
}

function buildAgentCoverageIndex(teamDir: string, rosterJson: string): AgentCoverage[] {
  const agents: AgentCoverage[] = [];

  // Parse roster for names and expertise strings.
  let rosterData: {
    personas?: Array<{ name?: string; expertise?: string | string[]; mandate?: string }>;
  } = {};
  try {
    rosterData = JSON.parse(rosterJson);
  } catch {
    // malformed JSON — proceed with file-only parsing
  }

  // Map name → roster expertise tokens for quick lookup
  const rosterTokens = new Map<string, Set<string>>();
  for (const persona of rosterData.personas ?? []) {
    if (!persona.name) continue;
    const combined = [
      ...(Array.isArray(persona.expertise) ? persona.expertise : [persona.expertise ?? ""]),
      persona.mandate ?? "",
    ].join(" ");
    rosterTokens.set(persona.name, tokenise(combined));
  }

  // Walk persona files
  if (!existsSync(teamDir)) return agents;
  const files = readdirSync(teamDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_") && !f.startsWith("."),
  );

  for (const file of files) {
    const name = basename(file, ".md");
    const content = readFileSync(resolve(teamDir, file), "utf8");
    const mandateText = extractSection(content, 3, "Mandate");
    const expertiseText = extractSection(content, 4, "Areas of expertise");
    const combined = `${mandateText} ${expertiseText}`;
    const tokens = tokenise(combined);
    // Merge in roster-JSON expertise tokens for this agent
    const rt = rosterTokens.get(name);
    if (rt) for (const t of rt) tokens.add(t);
    agents.push({ name, tokens });
  }

  return agents;
}

// ---------------------------------------------------------------------------
// Coverage check
// ---------------------------------------------------------------------------

function isCovered(obligation: ObligationRow, agents: readonly AgentCoverage[]): boolean {
  const oblTokens = new Set([
    ...tokenise(obligation.requirement),
    ...tokenise(obligation.fulfilmentPolicy),
    ...tokenise(obligation.owner),
    ...domainKeywords(obligation.id),
  ]);

  for (const agent of agents) {
    for (const token of oblTokens) {
      if (agent.tokens.has(token)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MandateCoverageRunOpts {
  /** Override obligations content — used by tests. */
  readonly obligationsOverride?: string;
  /** Override roster JSON — used by tests. */
  readonly rosterOverride?: string;
  /** Override team directory — used by tests. */
  readonly teamDirOverride?: string;
}

export function runMandateCoverageRecon(
  repoRoot: string,
  opts: MandateCoverageRunOpts = {},
): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const obligationsPath = resolve(repoRoot, "Regulations/_obligations-register.md");
  const rosterPath = resolve(repoRoot, "Team/_team-roster.json");
  const teamDir = opts.teamDirOverride ?? resolve(repoRoot, "Team");

  const obligationsContent =
    opts.obligationsOverride ??
    (existsSync(obligationsPath) ? readFileSync(obligationsPath, "utf8") : null);

  if (!obligationsContent) {
    logger.warn({ pipeline: PIPELINE, msg: "Obligations register not found — skipping" });
    result.ok = true;
    return result;
  }

  const rosterJson =
    opts.rosterOverride ?? (existsSync(rosterPath) ? readFileSync(rosterPath, "utf8") : "{}");

  const agents = buildAgentCoverageIndex(teamDir, rosterJson);

  const obligations = parseObligationRows(obligationsContent);

  let asserted = 0;
  for (const obl of obligations) {
    asserted++;
    if (!isCovered(obl, agents)) {
      violations.push({
        subject: `Regulations/_obligations-register.md:${obl.id}`,
        message: `Obligation ${obl.id} (${obl.bindingClass || "binding-class-unset"}) has no active agent whose mandate or areas-of-expertise covers it. Add coverage to the appropriate agent's §3/§4 or the team-roster JSON expertise field. Build-phase tolerance: warn only.`,
        severity: "warn",
      });
    }
  }

  result.asserted = asserted;
  result.violations = violations;
  // Advisory: ok = true as long as there are no fail-severity violations.
  result.ok = violations.every((v) => v.severity !== "fail");

  const uncovered = violations.length;
  logger.info({
    pipeline: PIPELINE,
    asserted,
    uncovered,
    covered: asserted - uncovered,
    msg: `${PIPELINE}: ${asserted - uncovered}/${asserted} obligations have at least one covering agent`,
  });

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runMandateCoverageRecon(REPO_ROOT);
  const warns = result.violations.filter((v) => v.severity === "warn");

  console.log(
    JSON.stringify({
      level: result.ok ? (warns.length ? "warn" : "info") : "error",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      ok: result.ok,
      msg: result.ok
        ? warns.length
          ? `${PIPELINE}: ${warns.length} obligation(s) uncovered — warn`
          : `${PIPELINE} passed`
        : `${PIPELINE} FAILED`,
      detail: result.violations,
    }),
  );
  process.exit(result.ok ? 0 : 1);
}
