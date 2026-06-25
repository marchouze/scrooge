// platform/agent-identity/roster.ts
//
// WS-AGENT-MEMORY Slice 0 — the canonical, roster-SOURCED `agentId` resolver.
//
// Slice 0 makes `agentId` load-bearing: the dispatch CLIs (open-brief, start-run,
// close-run) build an `rmsAgentRef` for the issuing / executing agent and MUST
// stamp a STABLE `agentId` on it, sourced from `Team/_team-roster.json` (the
// single source of truth — Charter cmd 4 "source, don't hardcode"), not computed
// ad-hoc at each call site.
//
// Each roster persona carries an `agentId` of the form `agent:<slug>` (the
// long-standing convention the CLIs previously computed inline). This module
// reads that field and exposes:
//
//   - `agentIdForName(name)`     — fail-closed lookup (throws on a name the roster
//                                  does not know — a typo'd dispatch must not
//                                  silently mint a non-canonical id).
//   - `tryAgentIdForName(name)`  — soft lookup returning `undefined` for unknown
//                                  names (for callers that fall back, e.g. a
//                                  non-roster external issuer).
//   - `rosterAgentIds()`         — the full name→agentId map (recon / tests).
//
// Lookup is case-insensitive on the bare name (`Atlas` == `atlas`). The roster is
// read once and memoised (the file is static within a process).
//
// FALLBACK SLUG: `tryAgentIdForName` returns `undefined` for an unknown name; the
// `agent:<slugify(name)>` fallback the CLIs used historically is preserved ONLY at
// the call site for genuinely off-roster references (it is never used to override
// a roster-sourced id). On-roster names always resolve to the roster value.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 0; brief:atlas:ws-agent-memory-slice-0-1-agentid-born-v2-agentm:2026-06-25.
//   Engineering Charter cmd 4 (source, don't hardcode); cmd 2 (fail-closed).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface RosterPersonaShape {
  readonly name: string;
  readonly agentId?: string;
}

interface RosterFileShape {
  readonly personas?: readonly RosterPersonaShape[];
}

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error(
    "agent-identity/roster: cannot locate repo root (CLAUDE.md not found by walking up)",
  );
}

/**
 * Slugify a name to the `agent:<slug>` shape — the canonical id form. Used to
 * verify roster ids conform and (only at call sites, never here) as the
 * off-roster fallback.
 */
export function slugifyAgentId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `agent:${slug}`;
}

let memo: ReadonlyMap<string, string> | undefined;

function loadRosterAgentIds(): ReadonlyMap<string, string> {
  if (memo) return memo;
  const repoRoot = findRepoRoot(import.meta.dir);
  const path = resolve(repoRoot, "Team/_team-roster.json");
  const raw = readFileSync(path, "utf-8");
  const file = JSON.parse(raw) as RosterFileShape;
  const map = new Map<string, string>();
  for (const p of file.personas ?? []) {
    if (typeof p.name !== "string" || p.name.length === 0) continue;
    if (typeof p.agentId !== "string" || p.agentId.length === 0) {
      // Fail-closed: a roster persona missing `agentId` is a Slice-0 regression.
      throw new Error(
        `agent-identity/roster: persona "${p.name}" is missing a stable \`agentId\` ` +
          "in Team/_team-roster.json (Slice 0 requires every persona to carry one)",
      );
    }
    map.set(p.name.toLowerCase(), p.agentId);
  }
  memo = map;
  return map;
}

/**
 * Roster-sourced `agentId` for `name`, case-insensitive. Returns `undefined`
 * when the name is not a known roster persona (off-roster issuer / external).
 */
export function tryAgentIdForName(name: string): string | undefined {
  return loadRosterAgentIds().get(name.toLowerCase());
}

/**
 * Roster-sourced `agentId` for `name`, fail-closed: throws when the name is not
 * a known roster persona. Dispatch CLIs use this for the roster agent they are
 * acting for, so a typo'd dispatch fails loudly rather than minting a
 * non-canonical id.
 */
export function agentIdForName(name: string): string {
  const id = tryAgentIdForName(name);
  if (!id) {
    throw new Error(
      `agent-identity/roster: no roster persona named "${name}" in ` +
        "Team/_team-roster.json — cannot resolve a stable agentId (Charter cmd 2: fail-closed)",
    );
  }
  return id;
}

/** The full name→agentId map (lowercase keys). For recon + tests. */
export function rosterAgentIds(): ReadonlyMap<string, string> {
  return loadRosterAgentIds();
}

/** Test seam — clear the memoised map. */
export function __resetRosterAgentIdMemo(): void {
  memo = undefined;
}
