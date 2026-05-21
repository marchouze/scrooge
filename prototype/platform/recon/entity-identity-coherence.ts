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
// Severity. Fail-class (P1) — a divergent `entity` value is a
// data-integrity issue, not a convention nit. The event store accepts
// any string, so the gate must be at recon time.
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
      violations.push({
        subject: `event:${ev.event_id}:${ev.type}`,
        severity: "fail",
        message: `event.entity "${ev.entity}" is not registered in LEGAL_ENTITY_SHORT_ID_REGISTRY (platform/identity/entity-short-ids.ts). Known active short-ids: [${ACTIVE_SHORT_IDS.join(", ")}]. Authority: D-PARTY-REGISTER (CEO-approved 2026-05-11); Regulations/_party-register.md.`,
      });
      continue;
    }
    if (entry.status !== "active") {
      violations.push({
        subject: `event:${ev.event_id}:${ev.type}`,
        severity: "fail",
        message: `event.entity "${ev.entity}" resolves to a retired Party register row (${entry.partyUrn}, legalName="${entry.legalName}"). Retired short-ids must not appear on new events. Authority: D-PARTY-REGISTER.`,
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
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `entity-identity-coherence passed — every event.entity (${r.asserted}) resolves to an active Party register short-id.`
        : `entity-identity-coherence FAILED — ${r.violations.length} divergent event.entity value(s).`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
