// dashboard/obligations-view.ts
//
// Parses `Regulations/_obligations-register.md` and returns a map of
// obligation-detail keyed by ORG-* ID, for the /api/obligations endpoint
// consumed by the policies drilldown.
//
// Per CLAUDE.md Principle 6: this is a read-only projection over the
// canonical obligations register. The register file is the single citable
// source; this view is a query-time shape-shift, not authored content.
//
// Author: Anya (data)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ObligationDetail {
  id: string;
  citation: string;
  requirement: string;
  fulfilment: string;
  owner: string;
  source: string;
  bind: string;
  status: string;
}

interface ObligationsView {
  asOf: string;
  count: number;
  byId: Record<string, ObligationDetail>;
}

const TABLE_ROW = /^\s*\|(.*)\|\s*$/;

export function getObligationsView(repoRoot: string): ObligationsView {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  const out: Record<string, ObligationDetail> = {};
  if (!existsSync(path)) return { asOf: new Date().toISOString(), count: 0, byId: {} };
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(TABLE_ROW);
    if (!m) continue;
    const cells = (m[1] ?? "").split("|").map((c) => c.trim());
    if (cells.length < 8) continue;
    const id = cells[0] ?? "";
    if (!/^ORG-/i.test(id)) continue;
    out[id] = {
      id,
      citation: cells[1] ?? "",
      requirement: cells[2] ?? "",
      fulfilment: cells[3] ?? "",
      owner: cells[4] ?? "",
      source: (cells[5] ?? "").replace(/`/g, "").trim(),
      bind: (cells[6] ?? "").replace(/`/g, "").trim(),
      status: (cells[7] ?? "").replace(/\*\*/g, "").trim(),
    };
  }
  return {
    asOf: new Date().toISOString(),
    count: Object.keys(out).length,
    byId: out,
  };
}
