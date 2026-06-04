// dashboard/obligation-readers-view.ts
//
// /api/obligation-readers — migration tracker for the obligations-register cut
// (D-REGULATORY-ARCHITECTURE-TWO-PLANE). Under PR 2b the authored origin moved
// to Regulations/_obligations.seed.json + the ObligationAdopted event stream;
// the markdown is a retained render. ~50 legacy readers still consume the
// markdown directly and must migrate onto the event projection
// (loadBankObligations). This view scans the codebase for those readers so the
// migration progress is visible on /obligation-readers.html until all are moved.
//
// Self-updating: a file drops off the list automatically once it stops
// referencing the markdown. Migration tooling that legitimately reads the
// markdown (seed generator, parity recon) is excluded.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const MARKER = "_obligations-register";
const SCAN_ROOTS = ["platform", "dashboard", "runtime", "scripts"];

// Files that reference the markdown as part of the migration itself, not as a
// legacy data dependency — excluded so they do not show as "to migrate".
const EXCLUDED = new Set([
  "scripts/generate-obligations-seed.ts",
  "scripts/backfill-obligations.ts",
  "platform/recon/obligations-seed-parity.ts",
  "dashboard/obligation-readers-view.ts",
]);

export interface ObligationReader {
  path: string;
  category: string;
}

export interface ObligationReadersView {
  total: number;
  byCategory: Array<{ category: string; count: number; readers: ObligationReader[] }>;
  note: string;
}

function categorise(path: string): string {
  if (path.startsWith("platform/recon/")) return "Recon gates";
  if (path.startsWith("dashboard/")) return "Dashboard views";
  if (path.startsWith("runtime/agents/")) return "Runtime agents";
  if (path.startsWith("scripts/")) return "Scripts";
  if (path.startsWith("platform/semantic") || path.startsWith("platform/taxonomies"))
    return "Semantic / taxonomies";
  if (path.startsWith("platform/event-store")) return "Event store";
  return "Other platform";
}

function walk(dir: string, repoRoot: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, repoRoot, out);
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      try {
        if (readFileSync(full, "utf8").includes(MARKER)) {
          out.push(relative(repoRoot, full));
        }
      } catch {
        // unreadable — skip
      }
    }
  }
}

export function getObligationReadersView(prototypeRoot: string): ObligationReadersView {
  const hits: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(resolve(prototypeRoot, root), prototypeRoot, hits);
  }

  const readers: ObligationReader[] = hits
    .filter((p) => !EXCLUDED.has(p))
    .sort()
    .map((path) => ({ path, category: categorise(path) }));

  const grouped = new Map<string, ObligationReader[]>();
  for (const r of readers) {
    const arr = grouped.get(r.category) ?? [];
    arr.push(r);
    grouped.set(r.category, arr);
  }

  const byCategory = [...grouped.entries()]
    .map(([category, rs]) => ({ category, count: rs.length, readers: rs }))
    .sort((a, b) => b.count - a.count);

  return {
    total: readers.length,
    byCategory,
    note: "Legacy readers of Regulations/_obligations-register.md still to migrate onto the loadBankObligations event projection. A file drops off automatically once it stops referencing the markdown.",
  };
}
