// One-shot: normalise owners on the 43 adopted RRB rows to the canonical
// domain-accountable seat (D-DOMAIN-OWNERSHIP-MAP), then rebuild the register's
// RRB block from the seed. Enforces the domain-ownership-coherence invariant
// (obligation owner == its domain's accountable seat). No-op for rows already
// aligned; corrects the rest. Run: bun run scripts/fix-rrb-owners.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { seatForObligation } from "../platform/regulatory/domain-ownership-map";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const SEED = resolve(REPO_ROOT, "Regulations/_obligations.seed.json");
const REGISTER = resolve(REPO_ROOT, "Regulations/_obligations-register.md");
const BLOCK_MARKER = "## Regulations Relating to Banks — adopted 2026-06-19";

interface Row {
  section: string;
  id: string;
  citation: string;
  requirement: string;
  owner: string;
  [k: string]: unknown;
}

const seed = JSON.parse(readFileSync(SEED, "utf8")) as Row[];

// The adopted RRB rows are exactly those whose urn is urn:reg:za:rrb and id in
// ORG-PR-067..111 (gaps at 092/093). Identify by urn + ORG-PR id >= 67.
function isAdoptedRrb(r: Row): boolean {
  if (typeof r.urn !== "string" || !r.urn.startsWith("urn:reg:za:rrb")) return false;
  const m = r.id.match(/^ORG-PR-(\d+)$/);
  return m ? Number.parseInt(m[1] ?? "0", 10) >= 67 : false;
}

let changed = 0;
for (const r of seed) {
  if (!isAdoptedRrb(r)) continue;
  const seat = seatForObligation({ id: r.id, citation: r.citation, requirement: r.requirement });
  if (!seat) {
    console.error(`WARN ${r.id}: unclassifiable — leaving owner "${r.owner}"`);
    continue;
  }
  if (r.owner !== seat) {
    console.log(`  ${r.id}: owner ${r.owner} -> ${seat}`);
    r.owner = seat;
    changed++;
  }
}
console.log(`owners normalised: ${changed} changed`);

writeFileSync(SEED, JSON.stringify(seed, null, 2));

// ── Rebuild the register's RRB block from the (now-updated) seed ────────────
const COLS = [
  "id",
  "urn",
  "citation",
  "requirement",
  "fulfilmentPolicy",
  "owner",
  "status",
  "bindTrigger",
  "entityScope",
  "appliesAt",
  "productScope",
  "activityScope",
  "riskTaxonomy",
  "reviewStatus",
  "reviewAuthor",
  "reviewDate",
  "reviewEventId",
] as const;
const HEADER =
  "| ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Bind-trigger | Entity scope | Applies-at | Product scope | Activity scope | Risk taxonomy | review-status | review-author | review-date | review-event-id |";
const DIVIDER = `|${"---|".repeat(17)}`;

function cell(v: unknown): string {
  return String(v ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

const rrbRows = seed.filter(isAdoptedRrb);
const bySection = new Map<string, Row[]>();
for (const r of rrbRows) {
  if (!bySection.has(r.section)) bySection.set(r.section, []);
  bySection.get(r.section)?.push(r);
}

const block: string[] = [];
block.push(`${BLOCK_MARKER} (D-RRB-OBLIGATIONS-ADOPT)`);
block.push("");
block.push(
  "> Source: `Regulations/SARB-PA/source-docs/rrb-structured.json` (GN R.1029, GG 35950). " +
    "Adopted via `D-RRB-OBLIGATIONS-ADOPT` + 2026-06-19 in-session amendment (status IN_FORCE; " +
    "reg31/reg35/reg36 held this phase; owners normalised to the domain-ownership map). " +
    "Authored origin is `_obligations.seed.json`; this render is parity-checked.",
);
for (const [section, rows] of bySection) {
  block.push("");
  block.push(`### ${section}`);
  block.push("");
  block.push(HEADER);
  block.push(DIVIDER);
  for (const r of rows) block.push(`| ${COLS.map((c) => cell(r[c])).join(" | ")} |`);
}

const md = readFileSync(REGISTER, "utf8");
const idx = md.indexOf(BLOCK_MARKER);
const head = idx >= 0 ? md.slice(0, idx).replace(/\s*$/, "\n\n") : md.replace(/\s*$/, "\n\n");
writeFileSync(REGISTER, `${head}${block.join("\n")}\n`);
console.log(`register RRB block rebuilt (${rrbRows.length} rows).`);
