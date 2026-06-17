// dashboard/agent-title.ts
//
// Standing rule (Marc): V2 UI surfaces NEVER render agent personal names —
// refer to seats by their function / role **Title** only. The bank is an
// autonomous AI institution; the persona names (Helena, Camille, Bea, …) are
// internal implementation detail, not something the human overseer reads.
//
// Names are stripped at the /api/v2 boundary via `seatTitle()` so the client
// never receives a name to render. The canonical name→Title source is the
// roster (Team/_team-roster.json) — personas carry a full `role`; top-of-house
// seats are parsed from `ceoDirectReports` ("Helena (CRO)").
//
// Non-name tokens ("substrate", "any-agent", "external", "audit", "dashboard")
// and any identifier not in the roster pass through unchanged.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

let cache: Map<string, string> | null = null;

/** Walk up to the repo root (the dir containing `CLAUDE.md`). */
function findRepoRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

function loadNameToTitle(): Map<string, string> {
  if (cache) return cache;
  const map = new Map<string, string>();
  try {
    const raw = readFileSync(
      resolve(findRepoRoot(import.meta.dir), "Team", "_team-roster.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as {
      personas?: Array<{ name?: string; role?: string }>;
      topOfHouse?: { ceoDirectReports?: string[] };
    };
    for (const p of parsed.personas ?? []) {
      if (p.name && p.role) map.set(p.name, p.role);
    }
    for (const entry of parsed.topOfHouse?.ceoDirectReports ?? []) {
      // "Helena (CRO)" → name "Helena", title "CRO". Personas (full role) win.
      const m = entry.match(/^([^(]+?)\s*\(([^)]+)\)/);
      const name = m?.[1]?.trim();
      const title = m?.[2]?.trim();
      if (name && title && !map.has(name)) map.set(name, title);
    }
  } catch {
    // Roster unreadable — resolver degrades to identity passthrough.
  }
  cache = map;
  return map;
}

/** Map an agent reference to its seat/function Title. Unknown tokens pass through. */
export function seatTitle(identifier: string): string {
  return loadNameToTitle().get(identifier) ?? identifier;
}

/** Map + de-duplicate + sort a list of agent references to Titles. */
export function seatTitles(identifiers: readonly string[]): string[] {
  return [...new Set(identifiers.map(seatTitle))].sort((a, b) => a.localeCompare(b));
}
