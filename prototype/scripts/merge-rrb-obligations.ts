// One-shot: merge the reviewed RRB obligations into the canonical seed + register
// render, per D-RRB-OBLIGATIONS-ADOPT and the in-session amendment recorded as a
// DecisionComment on 2026-06-19 (status IN_FORCE; reg35/reg36 held, not adopted).
//
// Transforms applied to the reviewed set (Regulations/SARB-PA/_obligations.rrb-reviewed.json):
//   - DROP reg35 (ORG-PR-092) and reg36 (ORG-PR-093) — held this phase like reg31.
//   - status "PROPOSED" -> "IN_FORCE" on the remaining rows.
//   - IDs NOT renumbered (gaps at 092/093 preserve references from the
//     deferred-values register and decision records).
// Writes:
//   - Regulations/_obligations.seed.json   (append the 43 rows)
//   - Regulations/_obligations-register.md  (append a new section + 17-col table)
//
// Idempotent: refuses to append if any target id is already present in the seed.
// Run: bun run scripts/merge-rrb-obligations.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const REVIEWED = resolve(REPO_ROOT, "Regulations/SARB-PA/_obligations.rrb-reviewed.json");
const SEED = resolve(REPO_ROOT, "Regulations/_obligations.seed.json");
const REGISTER = resolve(REPO_ROOT, "Regulations/_obligations-register.md");

const DROP_IDS = new Set(["ORG-PR-092", "ORG-PR-093"]); // reg35, reg36 — held this phase

interface Row {
  section: string;
  id: string;
  urn: string;
  citation: string;
  requirement: string;
  fulfilmentPolicy: string;
  owner: string;
  status: string;
  bindTrigger: string;
  entityScope: string;
  appliesAt: string;
  productScope: string;
  activityScope: string;
  riskTaxonomy: string;
  reviewStatus: string;
  reviewAuthor: string;
  reviewDate: string;
  reviewEventId: string;
  domain: string;
  [k: string]: unknown;
}

const reviewed = JSON.parse(readFileSync(REVIEWED, "utf8")) as Row[];
const seed = JSON.parse(readFileSync(SEED, "utf8")) as Row[];

// Transform: drop held rows, flip status.
const toAdd = reviewed
  .filter((r) => !DROP_IDS.has(r.id))
  .map((r) => ({ ...r, status: r.status === "PROPOSED" ? "IN_FORCE" : r.status }));

console.log(
  `reviewed: ${reviewed.length} rows; dropping ${DROP_IDS.size} (reg35/reg36); merging ${toAdd.length}`,
);

// Idempotency / collision guard.
const seedIds = new Set(seed.map((r) => r.id));
const clashes = toAdd.filter((r) => seedIds.has(r.id)).map((r) => r.id);
if (clashes.length > 0) {
  console.error(`ABORT: ids already present in seed: ${clashes.join(", ")}`);
  process.exit(1);
}

// Verify no row still carries PROPOSED or _provenance.
for (const r of toAdd) {
  if (r.status === "PROPOSED") {
    console.error(`ABORT: ${r.id} still PROPOSED`);
    process.exit(1);
  }
  if ("_provenance" in r) {
    console.error(`ABORT: ${r.id} carries _provenance`);
    process.exit(1);
  }
}

// ── Seed JSON ──────────────────────────────────────────────────────────────
// Match existing formatting: 2-space indent, no trailing newline after the
// closing bracket (file ends "}\n]").
const merged = [...seed, ...toAdd];
writeFileSync(SEED, JSON.stringify(merged, null, 2));
console.log(`seed: ${seed.length} -> ${merged.length} rows written to ${SEED}`);

// ── Register markdown ──────────────────────────────────────────────────────
// 17-column schema (no section/domain columns). Cells are single-line and
// contain no '|' (verified). Group rows by their section header for human
// coherence; the parity recon keys on id/fulfilment-policy/owner only.
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
function mdRow(r: Row): string {
  return `| ${COLS.map((c) => cell(r[c])).join(" | ")} |`;
}

// Group by section header (each maps to a single domain — parity 1:1).
const bySection = new Map<string, Row[]>();
for (const r of toAdd) {
  if (!bySection.has(r.section)) bySection.set(r.section, []);
  bySection.get(r.section)?.push(r);
}

const block: string[] = [];
block.push("");
block.push("## Regulations Relating to Banks — adopted 2026-06-19 (D-RRB-OBLIGATIONS-ADOPT)");
block.push("");
block.push(
  "> Source: `Regulations/SARB-PA/source-docs/rrb-structured.json` (GN R.1029, GG 35950). " +
    "Adopted via `D-RRB-OBLIGATIONS-ADOPT` + 2026-06-19 in-session amendment (status IN_FORCE; " +
    "reg31/reg35/reg36 held this phase). Authored origin is `_obligations.seed.json`; this render is parity-checked.",
);
for (const [section, rows] of bySection) {
  block.push("");
  block.push(`### ${section}`);
  block.push("");
  block.push(HEADER);
  block.push(DIVIDER);
  for (const r of rows) block.push(mdRow(r));
}
block.push("");

const registerMd = readFileSync(REGISTER, "utf8").replace(/\s*$/, "\n");
writeFileSync(REGISTER, `${registerMd}${block.join("\n")}\n`);
console.log(
  `register: appended ${toAdd.length} rows across ${bySection.size} section(s) to ${REGISTER}`,
);
console.log("Done.");
