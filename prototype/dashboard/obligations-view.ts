// dashboard/obligations-view.ts
//
// Parses `Regulations/_obligations-register.md` and returns a map of
// obligation-detail keyed by ORG-* ID, for the /api/obligations endpoint
// consumed by the policies drilldown.
//
// The register exposes a unified nine-column schema as of v1.13
// (`compliance(register): v1.13 — schema unification + header reconciliation`,
// 2026-05-10): ID | URN | Citation | Requirement | Fulfilment policy | Owner |
// Status | Entity scope | Applies-at. Source / bind classification are not
// authored in the register yet (memory: project_policies_implement_regs_and_objectives,
// project_rules_bind_at_commencement reshape pending). We derive both
// classifications from the citation text using the same classifiers the
// policy register uses, so the drilldown can render the badges without
// waiting on Mira's authoring pass. Entity scope and Applies-at are now
// surfaced directly from the register's dedicated columns rather than
// derived.
//
// Per CLAUDE.md Principle 2: this is a read-only projection over the
// canonical obligations register. The register file is the single citable
// source; this view is a query-time shape-shift, not authored content.
//
// Author: Anya (data)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { classifyBinds, classifySources } from "./policy-register";

interface ObligationDetail {
  id: string;
  citation: string;
  requirement: string;
  fulfilment: string;
  owner: string;
  /** Derived: REGULATORY / OBJECTIVE / BOTH / "" — joined comma if both. */
  source: string;
  /** Derived: first matching bind class — empty when no rule matches. */
  bind: string;
  status: string;
  /**
   * Derived source-instrument family for grouping in the obligations
   * dashboard (Banks Act, FIC Act, FAIS, POPIA, BCBS, IFRS, JS-2024,
   * JS-2020, FATF, etc.). Single string; the most-specific match wins.
   * "OTHER" when no rule fires.
   */
  family: string;
  /**
   * Policy names parsed from the Fulfilment column. Each entry is the
   * normalised policy name (semicolon-split, "Policy" qualifier kept as
   * authored) — the obligations dashboard cross-references these against
   * the policy register to detect citation-chain gaps under Principle 2.
   */
  linkedPolicies: string[];
  /**
   * Citation-chain gap flags surfaced on the obligations dashboard's
   * "Citation-integrity findings" panel. Empty array means the chain is
   * complete (or as complete as the register can attest at this layer).
   *
   * Each flag is a short token: NO-FULFILMENT (Fulfilment cell empty),
   * NO-OWNER (Owner cell empty), NO-FAMILY (citation matched no
   * source-family rule).
   */
  gaps: string[];
}

interface ObligationsView {
  asOf: string;
  count: number;
  byId: Record<string, ObligationDetail>;
  /**
   * Histogram by source-instrument family, count of obligations with that
   * family. Pre-computed server-side to keep the page render trivial.
   */
  familyCounts: Record<string, number>;
  /**
   * Histogram by bind class. Empty bind reported under "UNCLASSIFIED".
   */
  bindCounts: Record<string, number>;
  /**
   * Histogram by normalised status. Empty status reported under
   * "UNCLASSIFIED".
   */
  statusCounts: Record<string, number>;
}

const TABLE_ROW = /^\s*\|(.*)\|\s*$/;

function pickSource(citation: string): string {
  const sources = classifySources(citation);
  if (sources.length === 0) return "";
  if (sources.length === 1) return sources[0] ?? "";
  return "BOTH";
}

function pickBind(citation: string): string {
  const binds = classifyBinds(citation);
  return binds[0] ?? "";
}

// ---------------------------------------------------------------------------
// Source-instrument family classifier.
//
// Each rule's first matching token wins; rules are ordered most-specific →
// least-specific so e.g. "BCBS 239" lands as BCBS, not "OTHER". The family
// label is the user-facing grouping key on the obligations dashboard's
// summary stats, filterable column, and Principle-6 citation map.
//
// Rules harvested from the obligations register's Citation column. New
// regulators / instruments are added here as they appear in the register;
// no hand-authored copies of the citation text — derived only.
// ---------------------------------------------------------------------------

const FAMILY_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ["Joint Standard 2 of 2024", /Joint Standard 2 of 2024|JS\s*2[\s/]?2024/i],
  ["Joint Standard 2 of 2020", /Joint Standard 2 of 2020|JS\s*2[\s/]?2020/i],
  ["Joint Standard", /Joint Standard|Joint Notice/i],
  ["Banks Act + Regs", /Banks Act|Reg\s*Banks|Regulations Relating to Banks/i],
  ["BCBS", /BCBS|Basel|D\s?(?:295|335|352|368|457)|BA\s?(?:32[5-6]|330)/i],
  ["FIC Act", /FIC Act|FIC GN|FIC Guidance/i],
  ["FATF", /FATF/i],
  [
    "Sanctions (UN/OFAC/HMT/EU/DTI)",
    /OFAC|UN Security Council|EU consolidated|HMT|POCDATARA|DTI list/i,
  ],
  ["FAIS", /FAIS/i],
  ["FSCA Conduct", /FSCA|Conduct Standard/i],
  ["FMA / Financial Markets Act", /FMA|Financial Markets Act/i],
  ["JSE", /JSE/i],
  ["POPIA", /POPIA|PAIA|Information Regulator/i],
  ["IFRS / IAS", /IFRS|IAS\s/i],
  ["Companies Act / King IV", /Companies Act|King IV/i],
  ["ECTA", /ECTA|Electronic Communications and Transactions Act/i],
  ["FATCA / CRS", /FATCA|CRS|Tax Admin Act/i],
  ["Tax (other)", /Income Tax Act|VAT Act|STT|Transfer Pricing/i],
  ["BCEA / LRA / EE", /BCEA|LRA|Employment Equity|Skills Development/i],
  ["PA Directive / Guidance", /PA Directive|PA Guidance Note|SARB Directive|SARB/i],
  ["PRECCA / Bribery", /PRECCA|UK Bribery Act|FCPA/i],
  ["Internal RAS / Objective", /RAS\b|Risk Appetite|Internal RAS|CEO approved/i],
];

function pickFamily(citation: string): string {
  for (const [label, rx] of FAMILY_RULES) {
    if (rx.test(citation)) return label;
  }
  return "OTHER";
}

// ---------------------------------------------------------------------------
// Linked-policy parsing.
//
// The Fulfilment column is free-text; multiple policies are typically
// separated by ";" or, less consistently, by " · ". We split on both and
// strip leading / trailing whitespace; markdown asterisks are stripped to
// match how policy names appear in the policy register.
// ---------------------------------------------------------------------------

function parseLinkedPolicies(fulfilment: string): string[] {
  if (!fulfilment) return [];
  return fulfilment
    .split(/[;·]/)
    .map((s) => s.replace(/\*\*/g, "").trim())
    .filter((s) => s.length > 0);
}

function detectGaps(detail: {
  fulfilment: string;
  owner: string;
  family: string;
}): string[] {
  const gaps: string[] = [];
  if (!detail.fulfilment) gaps.push("NO-FULFILMENT");
  if (!detail.owner) gaps.push("NO-OWNER");
  if (detail.family === "OTHER") gaps.push("NO-FAMILY");
  return gaps;
}

export function getObligationsView(repoRoot: string): ObligationsView {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  const out: Record<string, ObligationDetail> = {};
  const familyCounts: Record<string, number> = {};
  const bindCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  if (!existsSync(path)) {
    return {
      asOf: new Date().toISOString(),
      count: 0,
      byId: {},
      familyCounts,
      bindCounts,
      statusCounts,
    };
  }
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(TABLE_ROW);
    if (!m) continue;
    const cells = (m[1] ?? "").split("|").map((c) => c.trim());
    // Nine-column register (v1.13+):
    //   ID | URN | Citation | Requirement | Fulfilment | Owner | Status | Entity scope | Applies-at
    if (cells.length < 9) continue;
    const id = cells[0] ?? "";
    if (!/^ORG-/i.test(id)) continue;
    const citation = cells[2] ?? "";
    const fulfilment = cells[4] ?? "";
    const owner = cells[5] ?? "";
    const family = pickFamily(citation);
    const status = (cells[6] ?? "").replace(/\*\*/g, "").trim();
    const bind = pickBind(citation);
    const linkedPolicies = parseLinkedPolicies(fulfilment);
    const gaps = detectGaps({ fulfilment, owner, family });

    out[id] = {
      id,
      citation,
      requirement: cells[3] ?? "",
      fulfilment,
      owner,
      source: pickSource(citation),
      bind,
      status,
      family,
      linkedPolicies,
      gaps,
    };

    familyCounts[family] = (familyCounts[family] ?? 0) + 1;
    const bindKey = bind || "UNCLASSIFIED";
    bindCounts[bindKey] = (bindCounts[bindKey] ?? 0) + 1;
    const statusKey = status || "UNCLASSIFIED";
    statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;
  }
  return {
    asOf: new Date().toISOString(),
    count: Object.keys(out).length,
    byId: out,
    familyCounts,
    bindCounts,
    statusCounts,
  };
}
