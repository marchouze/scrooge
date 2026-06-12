// platform/recon/provision-tick-drift.ts
//
// recon:provision-tick-drift — provision-text drift detection (ADVISORY).
//
// Every `ProvisionScopeAdopted { adopted: true }` tick stores a SHA-256
// `verbatimHash` of the verbatim text under the ticked scope at tick time.
// This gate recomputes the hash from the CURRENT structured.json and surfaces
// divergences — the regulation text changed since the bank ticked it.
//
// Findings are REVIEW PROMPTS, not blockers (exit 0): the bank decides
// whether a text change is material enough to re-review and re-adopt the
// scope. Three change classes:
//   - formatting-only restructure → same section text → same hash → no finding
//   - text correction in place    → hash diverges → finding (review prompt)
//   - regulatory amendment        → new slug; old ticks stay on the old slug
//
// Resolution: only the LATEST event per (instrumentSlug, scopeId) is checked,
// and only if it is an adoption (adopted: true) — an untick supersedes the
// stale hash of the tick it reverses.
//
// Authority: D-REGULATORY-ARCHITECTURE-TWO-PLANE; P1-EVENTS-AS-TRUTH.
// Plan: tick-to-obligation workflow Phase 6 (PR #1242 follow-on).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { fileURLToPath } from "node:url";

import { eventStore } from "../composition.ts";
import type { ProvisionScopeAdoptedPayload } from "../event-store/event-types/obligation-lifecycle.ts";
import type { Event } from "../event-store/types.ts";
import {
  type RegStructuredDocMinimal,
  buildProvisionTree,
  computeScopeVerbatimHash,
} from "../regulatory/graph/provision-tree.ts";
import { loadStructuredDocBySlug } from "../regulatory/structured-doc-loader.ts";

const PIPELINE = "recon:provision-tick-drift";

export interface DriftFinding {
  readonly instrumentSlug: string;
  readonly scopeId: string;
  readonly tickedAt: string;
  readonly hashAtTick: string;
  readonly hashNow: string | null;
  readonly message: string;
}

/** Loader signature — injectable for tests. */
export type StructuredDocLoader = (slug: string) => RegStructuredDocMinimal | null;

/**
 * Load the structured doc for a slug — delegates to the shared slug-resolving,
 * BCBS-enriching, id-assigning loader so the recomputed hash is built from the
 * SAME tree shape the adopt route hashed at tick time.
 */
export function loadStructuredDoc(slug: string, repoRoot?: string): RegStructuredDocMinimal | null {
  return loadStructuredDocBySlug(slug, repoRoot) as RegStructuredDocMinimal | null;
}

/**
 * Pure drift check over an event list + injectable doc loader.
 * Returns findings for every currently-adopted scope whose recomputed
 * verbatim hash no longer matches the hash stored at tick time.
 */
export function findTickDrift(
  events: readonly Event[],
  loadDoc: StructuredDocLoader,
): { findings: DriftFinding[]; asserted: number } {
  // Latest event per (instrumentSlug, scopeId), as_of order
  const ordered = [...events]
    .filter((e) => e.type === "ProvisionScopeAdopted")
    .sort((a, b) => (a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0));
  const latest = new Map<string, Event>();
  for (const ev of ordered) {
    const p = ev.payload as ProvisionScopeAdoptedPayload;
    latest.set(`${p.instrumentSlug}::${p.scopeId}`, ev);
  }

  const findings: DriftFinding[] = [];
  let asserted = 0;
  const treeCache = new Map<string, ReturnType<typeof buildProvisionTree> | null>();

  for (const ev of latest.values()) {
    const p = ev.payload as ProvisionScopeAdoptedPayload;
    if (!p.adopted) continue; // unticked — no live hash to defend
    asserted += 1;

    let tree = treeCache.get(p.instrumentSlug);
    if (tree === undefined) {
      const doc = loadDoc(p.instrumentSlug);
      tree = doc ? buildProvisionTree(doc) : null;
      treeCache.set(p.instrumentSlug, tree);
    }

    if (!tree) {
      findings.push({
        instrumentSlug: p.instrumentSlug,
        scopeId: p.scopeId,
        tickedAt: p.adoptedAt,
        hashAtTick: p.verbatimHash,
        hashNow: null,
        message: `Instrument "${p.instrumentSlug}" has an adopted scope "${p.scopeId}" (ticked ${p.adoptedAt}) but no structured.json exists for the slug — the source document was removed or renamed since adoption. Review whether the adoption should move to a successor slug or be unticked.`,
      });
      continue;
    }

    if (!tree.has(p.scopeId)) {
      findings.push({
        instrumentSlug: p.instrumentSlug,
        scopeId: p.scopeId,
        tickedAt: p.adoptedAt,
        hashAtTick: p.verbatimHash,
        hashNow: null,
        message: `Adopted scope "${p.scopeId}" (ticked ${p.adoptedAt}) no longer exists in ${p.instrumentSlug}-structured.json — the outline was restructured since adoption. Re-review the instrument and re-tick the corresponding scope(s).`,
      });
      continue;
    }

    const hashNow = computeScopeVerbatimHash(tree, p.scopeId);
    if (hashNow !== p.verbatimHash) {
      findings.push({
        instrumentSlug: p.instrumentSlug,
        scopeId: p.scopeId,
        tickedAt: p.adoptedAt,
        hashAtTick: p.verbatimHash,
        hashNow,
        message: `Verbatim text under adopted scope "${p.scopeId}" of ${p.instrumentSlug} changed since the bank ticked it (${p.adoptedAt}): hash ${p.verbatimHash.slice(0, 12)}… → ${hashNow.slice(0, 12)}…. Review the change; if material, re-adopt the scope (a fresh tick re-anchors the hash) and re-distill affected obligations.`,
      });
    }
  }

  return { findings, asserted };
}

/** Store-backed entry point. Empty store → green by construction. */
export function main(opts?: { events?: readonly Event[]; loadDoc?: StructuredDocLoader }): {
  findings: DriftFinding[];
  asserted: number;
} {
  let events: readonly Event[];
  if (opts?.events) {
    events = opts.events;
  } else {
    try {
      events = [...eventStore.replay({ type: "ProvisionScopeAdopted" })];
    } catch {
      events = [];
    }
  }
  return findTickDrift(events, opts?.loadDoc ?? ((slug) => loadStructuredDoc(slug)));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { findings, asserted } = main();
  if (findings.length > 0) {
    // ADVISORY: findings are review prompts, not blockers — exit 0.
    console.warn(
      `\n⚠️  ${PIPELINE}: ${findings.length} drift finding(s) across ${asserted} adopted scope(s) (ADVISORY — review prompts, not blockers):\n`,
    );
    for (const f of findings) {
      console.warn(`  - ${f.instrumentSlug}:${f.scopeId}: ${f.message}`);
    }
    process.exit(0);
  }
  console.log(
    `✅ ${PIPELINE}: ${asserted} adopted scope(s) checked — no provision text has drifted from its tick-time verbatim hash`,
  );
}
