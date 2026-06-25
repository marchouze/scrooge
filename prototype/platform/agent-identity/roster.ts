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
  readonly mandateDomains?: readonly string[];
}

interface RosterVocabularyShape {
  readonly tags?: readonly string[];
  readonly shared?: string;
}

interface RosterFileShape {
  readonly personas?: readonly RosterPersonaShape[];
  readonly mandateDomainVocabulary?: RosterVocabularyShape;
}

/**
 * WS-AGENT-MEMORY Slice 2 — the RESERVED tag whose memory EVERY agent loads in
 * addition to its own mandate domains (the bank-wide common-core). `readMyMemory`
 * unions `{SHARED_DOMAIN_TAG}` into every agent's filter. Sourced from the roster
 * vocabulary's `shared` field; this constant is the fallback only if the roster
 * omits it (it never should — recon:agent-mandate-domains-coverage asserts it).
 */
export const SHARED_DOMAIN_TAG = "shared" as const;

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

/**
 * The roster, parsed ONCE and indexed for the resolvers below.
 *   - `agentIds`         name(lower) → agentId
 *   - `mandateByAgentId` agentId → readonly mandate-domain tags
 *   - `mandateByName`    name(lower) → readonly mandate-domain tags
 *   - `vocabulary`       the closed set of known mandate-domain tags (incl `shared`)
 *   - `sharedTag`        the reserved bank-wide common-core tag
 */
interface LoadedRoster {
  readonly agentIds: ReadonlyMap<string, string>;
  readonly mandateByAgentId: ReadonlyMap<string, readonly string[]>;
  readonly mandateByName: ReadonlyMap<string, readonly string[]>;
  readonly vocabulary: ReadonlySet<string>;
  readonly sharedTag: string;
}

let memo: LoadedRoster | undefined;

function loadRoster(): LoadedRoster {
  if (memo) return memo;
  const repoRoot = findRepoRoot(import.meta.dir);
  const path = resolve(repoRoot, "Team/_team-roster.json");
  const raw = readFileSync(path, "utf-8");
  const file = JSON.parse(raw) as RosterFileShape;

  const agentIds = new Map<string, string>();
  const mandateByAgentId = new Map<string, readonly string[]>();
  const mandateByName = new Map<string, readonly string[]>();

  for (const p of file.personas ?? []) {
    if (typeof p.name !== "string" || p.name.length === 0) continue;
    if (typeof p.agentId !== "string" || p.agentId.length === 0) {
      // Fail-closed: a roster persona missing `agentId` is a Slice-0 regression.
      throw new Error(
        `agent-identity/roster: persona "${p.name}" is missing a stable \`agentId\` in Team/_team-roster.json (Slice 0 requires every persona to carry one)`,
      );
    }
    agentIds.set(p.name.toLowerCase(), p.agentId);

    // WS-AGENT-MEMORY Slice 2 — mandateDomains is read here but NOT fail-closed
    // at load time: an empty/missing value is surfaced as a recon FINDING
    // (recon:agent-mandate-domains-coverage), not a hard module-load throw, so a
    // grooming gap does not brick every dispatch CLI that resolves an agentId.
    const domains = Array.isArray(p.mandateDomains)
      ? p.mandateDomains.filter((d): d is string => typeof d === "string" && d.length > 0)
      : [];
    mandateByAgentId.set(p.agentId, domains);
    mandateByName.set(p.name.toLowerCase(), domains);
  }

  const vocab = file.mandateDomainVocabulary;
  const sharedTag =
    typeof vocab?.shared === "string" && vocab.shared.length > 0 ? vocab.shared : SHARED_DOMAIN_TAG;
  const vocabulary = new Set<string>(
    Array.isArray(vocab?.tags)
      ? vocab.tags.filter((t): t is string => typeof t === "string" && t.length > 0)
      : [],
  );
  // Defence-in-depth: the shared tag is always part of the vocabulary even if the
  // roster's `tags` list forgot to include it.
  vocabulary.add(sharedTag);

  memo = { agentIds, mandateByAgentId, mandateByName, vocabulary, sharedTag };
  return memo;
}

function loadRosterAgentIds(): ReadonlyMap<string, string> {
  return loadRoster().agentIds;
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
      `agent-identity/roster: no roster persona named "${name}" in Team/_team-roster.json — cannot resolve a stable agentId (Charter cmd 2: fail-closed)`,
    );
  }
  return id;
}

/** The full name→agentId map (lowercase keys). For recon + tests. */
export function rosterAgentIds(): ReadonlyMap<string, string> {
  return loadRosterAgentIds();
}

// ---------------------------------------------------------------------------
// WS-AGENT-MEMORY Slice 2 — mandate-domain resolution
// ---------------------------------------------------------------------------

/** The reserved bank-wide common-core tag, sourced from the roster vocabulary. */
export function sharedDomainTag(): string {
  return loadRoster().sharedTag;
}

/** The closed vocabulary of known mandate-domain tags (incl. `shared`). For recon. */
export function mandateDomainVocabulary(): ReadonlySet<string> {
  return loadRoster().vocabulary;
}

/** The full agentId → mandate-domain tags map. For recon + tests. */
export function rosterMandateDomainsByAgentId(): ReadonlyMap<string, readonly string[]> {
  return loadRoster().mandateByAgentId;
}

/**
 * Roster-sourced mandate-domain tags for an `agent:<slug>` agentId OR a bare
 * persona name (case-insensitive on the name). Returns `undefined` when the
 * agent is not a known roster persona; returns `[]` (empty) when the persona is
 * known but carries no mandateDomains (a grooming gap — surfaced by recon, not a
 * throw here).
 */
export function mandateDomainsForAgent(agentIdOrName: string): readonly string[] | undefined {
  const roster = loadRoster();
  const byId = roster.mandateByAgentId.get(agentIdOrName);
  if (byId !== undefined) return byId;
  return roster.mandateByName.get(agentIdOrName.toLowerCase());
}

/**
 * The effective load-filter for an agent: its explicit mandate domains UNIONED
 * with the reserved `shared` tag (the bank-wide common-core every agent loads).
 * Returns `undefined` when the agent is unknown to the roster — fail-closed: a
 * dispatch for a non-roster agent must not silently fall through to "shared only"
 * (the caller decides how to surface the unknown).
 */
export function loadDomainsForAgent(agentIdOrName: string): readonly string[] | undefined {
  const mandate = mandateDomainsForAgent(agentIdOrName);
  if (mandate === undefined) return undefined;
  const shared = loadRoster().sharedTag;
  const set = new Set<string>(mandate);
  set.add(shared);
  return [...set].sort();
}

/** Test seam — clear the memoised roster (agentIds + mandate domains + vocab). */
export function __resetRosterAgentIdMemo(): void {
  memo = undefined;
}
