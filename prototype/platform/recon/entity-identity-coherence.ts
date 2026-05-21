// platform/recon/entity-identity-coherence.ts
//
// Atlas recon: assert that every `event.entity` value in the live event
// store is an *active* legal-entity short-id registered in
// `prototype/platform/identity/entity-short-ids.ts`.
//
// Motivation. Pre-unification the substrate carried two divergent
// short-ids for the same legal entity — `LE-ZA-HOZ-BANK` (BA-return
// whitelists, accounting period close) and the legacy `BANK-ZA-001`
// (FX revaluation, daily P&L, SA-CCR, agent runtime defaults). The
// divergence forced a mirror-block workaround in the FX-spot scenario
// to satisfy BA-325. Kai's PR #663 surfaced the gap; Atlas + Imani
// resolved it in the entity-identity unification PR
// (`feat(party): entity-identity unification — single canonical
// identifier for the bank itself`).
//
// This recon catches future drift permanently — any new code path that
// invents a fresh hardcoded `entity` value (e.g. by spelling the
// canonical short-id incorrectly, or by reintroducing a legacy form)
// is reported at CI time as a fail.
//
// Authority chain (Principle 2):
//   - D-PARTY-REGISTER (CEO-approved 2026-05-11)
//   - Regulations/_party-register.md (canonical Party register)
//   - prototype/platform/identity/entity-short-ids.ts (short-id ↔ URN
//     mapping; this is the resolution authority the recon walks)
//
// Empty-state correctness: zero events → asserted=0, ok=true.
//
// Severity. Two-tier — see `MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK`
// below.
//   - Pre-boundary events with a `status:"retired"` short-id degrade
//     to `warn` (defensible historical; Principle 1 prohibits rewriting
//     immutable events).
//   - Post-boundary events with a retired short-id are `fail` (live
//     drift — source patches exist via PR #669).
//   - Unregistered short-ids are `fail` at any timestamp (rogue value).
// The event store accepts any string, so the gate must be at recon
// time. Vera PR #679 surfaced the boundary recommendation.
//
// Author: Atlas (Core banking platform architect, engineering) ·
// co-attributed Imani (Chief Legal Counsel, governance — legal-entity-
// tree authority for the underlying unification decision).

import { eventStore } from "../composition";
import {
  ACTIVE_SHORT_IDS,
  LEGAL_ENTITY_SHORT_ID_REGISTRY,
  lookupShortId,
} from "../identity/entity-short-ids";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "entity-identity-coherence";

/**
 * Migration boundary: PR #669 (entity-identity unification) merged at
 * `2026-05-21T08:57:13Z` UTC. Events emitted strictly before this
 * timestamp may carry the now-retired `BANK-ZA-001` short-id; per
 * Principle 1 (events as the single source of truth) the event log is
 * immutable — historical events cannot be rewritten. The retired-row
 * in `LEGAL_ENTITY_SHORT_ID_REGISTRY` (Vera PR #679 recommendation)
 * lets this recon recognise such events as "known-but-retired"
 * (defensible historical) rather than "unknown-rogue".
 *
 * Classification semantics applied per event:
 *   - `as_of < MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK`:
 *       - entity ∈ active row             → ok
 *       - entity ∈ retired row             → `warn` (defensible historical)
 *       - entity ∉ registry                → `fail` (rogue at any time)
 *   - `as_of >= MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK`:
 *       - entity ∈ active row             → ok
 *       - entity ∈ retired row             → `fail` (live drift)
 *       - entity ∉ registry                → `fail` (rogue at any time)
 *
 * Authority:
 *   - D-PARTY-REGISTER (CEO-approved 2026-05-11)
 *   - Principle 1 (events are the only source of truth) —
 *     immutability of the historical log
 *   - Atlas + Imani PR #669 (entity-identity unification, merged
 *     2026-05-21T08:57:13Z UTC) — establishes the boundary
 *   - Vera PR #679 — surfaced the recommendation
 */
export const MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK = "2026-05-21T08:57:13Z";

/**
 * Minimal event shape — accepted from the live event store and from
 * test injections.
 */
export interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly entity: string;
}

export interface RunOpts {
  /** Override the event source — used by unit tests to feed synthetic events. */
  events?: Iterable<MinimalEvent>;
}

function loadEvents(opts: RunOpts): MinimalEvent[] {
  if (opts.events) return [...opts.events];
  const out: MinimalEvent[] = [];
  for (const e of eventStore.replay({})) {
    out.push({
      event_id: e.event_id,
      type: e.type,
      as_of: e.as_of,
      entity: e.entity,
    });
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Pre-flight: the registry itself must be non-empty. If a future
  // refactor accidentally empties it, every event fails — which would
  // be a confusing diagnosis. Surface the registry-empty case directly.
  if (LEGAL_ENTITY_SHORT_ID_REGISTRY.length === 0) {
    violations.push({
      subject: "platform/identity/entity-short-ids.ts:LEGAL_ENTITY_SHORT_ID_REGISTRY",
      severity: "fail",
      message:
        "LEGAL_ENTITY_SHORT_ID_REGISTRY is empty — recon cannot resolve any event.entity value. Authority: D-PARTY-REGISTER.",
    });
    result.violations = violations;
    result.ok = false;
    return result;
  }

  const events = loadEvents(opts);
  for (const ev of events) {
    result.asserted++;
    const entry = lookupShortId(ev.entity);
    if (entry === null) {
      // Unregistered short-id — `fail` at any timestamp (rogue value).
      violations.push({
        subject: `event:${ev.event_id}:${ev.type}`,
        severity: "fail",
        message: `event.entity "${ev.entity}" is not registered in LEGAL_ENTITY_SHORT_ID_REGISTRY (platform/identity/entity-short-ids.ts). Known active short-ids: [${ACTIVE_SHORT_IDS.join(", ")}]. Authority: D-PARTY-REGISTER (CEO-approved 2026-05-11); Regulations/_party-register.md.`,
      });
      continue;
    }
    if (entry.status === "active") {
      // Active row — always ok.
      continue;
    }
    // Retired row. Classify by migration-boundary timestamp.
    // Pre-boundary → `warn` (defensible historical, immutable per
    // Principle 1). Post-boundary → `fail` (live drift; source patches
    // exist via Atlas + Imani PR #669 + the literal-patch pack).
    const isPreBoundary = ev.as_of < MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK;
    if (isPreBoundary) {
      violations.push({
        subject: `event:${ev.event_id}:${ev.type}`,
        severity: "warn",
        message: `event.entity "${ev.entity}" resolves to a retired Party register row (${entry.partyUrn}, legalName="${entry.legalName}", retiredAt=${entry.retiredAt ?? "unknown"}). Event as_of=${ev.as_of} predates the migration boundary (${MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK}); defensible historical per Principle 1 (immutable event log). Successor: ${entry.successor ?? "(none recorded)"}. Authority: D-PARTY-REGISTER; Atlas + Imani PR #669.`,
      });
    } else {
      violations.push({
        subject: `event:${ev.event_id}:${ev.type}`,
        severity: "fail",
        message: `event.entity "${ev.entity}" resolves to a retired Party register row (${entry.partyUrn}, legalName="${entry.legalName}", retiredAt=${entry.retiredAt ?? "unknown"}). Event as_of=${ev.as_of} is at-or-after the migration boundary (${MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK}) — live drift, must use successor "${entry.successor ?? "(none recorded)"}". Authority: D-PARTY-REGISTER; Atlas + Imani PR #669.`,
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  console.log(
    JSON.stringify({
      level: r.ok ? (warnCount > 0 ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      warnCount,
      failCount,
      ok: r.ok,
      migrationBoundary: MIGRATION_BOUNDARY_TIMESTAMP_FX_HOZ_BANK,
      msg: r.ok
        ? warnCount > 0
          ? `entity-identity-coherence passed — ${r.asserted} event(s) asserted; 0 fail-class; ${warnCount} warn-class (pre-boundary retired-row events; defensible historical per Principle 1).`
          : `entity-identity-coherence passed — every event.entity (${r.asserted}) resolves to an active Party register short-id.`
        : `entity-identity-coherence FAILED — ${failCount} fail-class violation(s); ${warnCount} warn-class.`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
