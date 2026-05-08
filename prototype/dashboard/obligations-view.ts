// dashboard/obligations-view.ts
//
// Parses `Regulations/_obligations-register.md` and returns a map of
// obligation-detail keyed by ORG-* ID, for the /api/obligations endpoint
// consumed by the policies drilldown.
//
// The register exposes six columns today: ID | Citation | Requirement |
// Fulfilment policy | Owner | Status. Source / bind classification are not
// authored in the register yet (memory: project_policies_implement_regs_and_objectives,
// project_rules_bind_at_commencement reshape pending). We derive both
// classifications from the citation text using the same classifiers the
// policy register uses, so the drilldown can render the badges without
// waiting on Mira's authoring pass.
//
// Per CLAUDE.md Principle 6: this is a read-only projection over the
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
}

interface ObligationsView {
  asOf: string;
  count: number;
  byId: Record<string, ObligationDetail>;
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

export function getObligationsView(repoRoot: string): ObligationsView {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  const out: Record<string, ObligationDetail> = {};
  if (!existsSync(path)) return { asOf: new Date().toISOString(), count: 0, byId: {} };
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(TABLE_ROW);
    if (!m) continue;
    const cells = (m[1] ?? "").split("|").map((c) => c.trim());
    // Six-column register: ID | Citation | Requirement | Fulfilment | Owner | Status
    if (cells.length < 6) continue;
    const id = cells[0] ?? "";
    if (!/^ORG-/i.test(id)) continue;
    const citation = cells[1] ?? "";
    out[id] = {
      id,
      citation,
      requirement: cells[2] ?? "",
      fulfilment: cells[3] ?? "",
      owner: cells[4] ?? "",
      source: pickSource(citation),
      bind: pickBind(citation),
      status: (cells[5] ?? "").replace(/\*\*/g, "").trim(),
    };
  }
  return {
    asOf: new Date().toISOString(),
    count: Object.keys(out).length,
    byId: out,
  };
}
