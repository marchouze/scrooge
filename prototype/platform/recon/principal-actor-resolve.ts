// platform/recon/principal-actor-resolve.ts
//
// Continuous-controls pipeline: principal-actor-resolve. Asserts that
// every typed event in the bank's event store carries an `actor` field
// that resolves to a `PrincipalRegistered` event in the same store —
// i.e. every action in the bank attributes to a known, registered
// principal (P2 — every action has a typed source; P7 —
// autonomous-by-default, the actor must be a registered agent).
//
// The Principal Register substrate is being designed in parallel by
// Sade + Senna (`Owner Inbox/2026-05-09_sade-senna_principal-register.md`,
// in flight). Until that substrate lands, the recon would have nothing
// to assert against. This file ships as a **stub** pipeline that follows
// the warn-pre-shadow pattern of `parallel-dispatch-divergence` — it
// runs on every CI invocation, is discoverable from day one (no orphan
// capability under P6), and emits warn-only findings that are
// non-failing. As the register's backfill slices land
// (D-PRINCIPAL-REGISTER §7), severity flips from warn to fail per the
// progression in `Owner Inbox/2026-05-09_vera_principal-actor-resolve-recon-scoping.md` §3.
//
// What this pipeline asserts (full hard form, post-register-landing):
//
//   1. **`actor`-field presence.** Every typed event carries a
//      non-empty `actor.type` and `actor.id`. The platform schema
//      enforces this at append-time; the recon re-asserts it at
//      audit-time as a structural defence-in-depth.
//
//   2. **Principal resolution.** Every event's `actor.id` equals the
//      registered URN of some `PrincipalRegistered` event in the same
//      store. An unresolved URN is an `orphan-actor` finding (severe).
//
//   3. **Role coverage at event time.** Sequenced to slice 5 (A1.2
//      re-wire). Not asserted by this stub.
//
//   4. **Fit-and-proper currency for regulated actions.** Sequenced to
//      slice 8 (lifecycle slices). Not asserted by this stub.
//
// Stub behaviour (this slice):
//
//   - Empty-store sentinel — no `.local/event.db` file present. Returns
//     `ok: true` with a single info-severity row noting the empty
//     store. Mirrors `parallel-dispatch-divergence` and
//     `decision-event-recon` for the no-event-store case.
//
//   - Stage 0 (register-not-yet-on-main) — the store has events but
//     zero `PrincipalRegistered` events. Emits a single warn noting
//     the register substrate is not yet live and returns `ok: true`
//     with `asserted: 0`. This is the expected current state.
//
//   - Stage 1 (partial-asserted) — ≥1 `PrincipalRegistered` event
//     exists. The pipeline walks every typed event, computes the set
//     of actor URNs and the set of registered URNs, and emits one
//     warn per orphan actor URN. Severity stays warn until the
//     backfill markers indicate the relevant cohort is complete (per
//     §3 of the scoping brief). `ok: true` for all stub modes.
//
//   - Future: severity flips from warn to fail per actor-type cohort
//     as backfill slices land. The `cohortSeverity` map below is the
//     single point where the flip happens — it is the substrate of
//     the §3 progression and the only line that changes per slice.
//
// Authority + citation chain (P2 — atomic citation discipline):
//   - `D-PRINCIPAL-REGISTER` (Sade + Senna proposal, in flight) — the
//     register substrate this recon asserts against.
//   - `D-A22-RETIRE-LEGACY` — warn-pre-shadow precedent for stub
//     pipelines whose substrate has not yet landed.
//   - `Owner Inbox/2026-05-09_vera_principal-actor-resolve-recon-scoping.md`
//     §1 (assertions), §2 (pre-landing posture), §3 (post-landing
//     progression), §4 (failure-mode taxonomy), §5 (substrate gaps).
//   - Principle 1 — events are authoritative; this pipeline reads the
//     event store directly with no derived-state shortcut.
//   - Principle 2 — every assertion cites the register / regulation
//     that justifies it; an orphan actor is a P2 violation by
//     construction.
//   - Principle 6 — single-graph discipline; this recon closes the
//     upward chain from event-actor to registered principal.
//   - Principle 7 — autonomous-by-default; the audit must verify the
//     autonomous principal, not the procedure that registers it.
//
// Procedure binding (P6 — upward chain): future
// `Procedures/by-policy/continuous-controls-assurance.md` (Vera-owned,
// Thandiwe-signed). Procedure file does not yet exist; surfaced as a
// substrate gap in the scoping brief §5. The recon is the system
// capability that performs the procedure.
//
// Author: Vera (continuous-controls / internal-audit engineer)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const DEFAULT_DB = process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "../../.local/event.db");

/**
 * Cohort-severity flip map. Each actor-type cohort maps to the severity
 * that orphan findings receive once the corresponding backfill slice
 * lands. Until the backfill marker flips, every cohort is `warn`. This
 * map is the single point of change for the §3 assertion progression in
 * the scoping brief — slice 3 flips `internal-agent` to `fail`, slice 4
 * flips `director-officer`, etc.
 */
const cohortSeverity: Readonly<Record<string, "warn" | "fail">> = {
  // Stage-1 stub: every cohort warn-only. Flipped per slice in
  // D-PRINCIPAL-REGISTER §7.
  "internal-agent": "warn",
  "internal-human": "warn",
  "external-human-counterparty": "warn",
  "external-agent-counterparty": "warn",
  contractor: "warn",
  "external-system": "warn",
  customer: "warn",
  "director-officer": "warn",
  unknown: "warn",
};

/**
 * Heuristic mapping from an actor URN to the principal-type cohort.
 * The full mapping comes from the `PrincipalRegistered` event payload
 * once the register lands; pre-register, this stub uses the URN prefix
 * convention already established in the event store
 * (`agent:<persona>:<trigger>` for internal-agents, `service:` for
 * external systems, etc.). Keeps the stub useful before the register
 * exists; replaced post-register by a registry lookup.
 */
function classifyActorUrn(actor: { type: string; id: string }): string {
  if (actor.id.startsWith("agent:")) return "internal-agent";
  if (actor.id.startsWith("director:")) return "director-officer";
  if (actor.id.startsWith("customer:")) return "customer";
  if (actor.id.startsWith("contractor:")) return "contractor";
  if (actor.id.startsWith("counterparty:")) {
    return actor.type === "service" ? "external-agent-counterparty" : "external-human-counterparty";
  }
  if (actor.type === "service") return "external-system";
  if (actor.type === "human") return "internal-human";
  return "unknown";
}

export interface RunOpts {
  /** Override the event store path (default: `.local/event.db`). */
  dbPath?: string;
  /**
   * Inject events directly (bypasses the event store entirely). Tests
   * use this to construct synthetic principal-resolution cases without
   * spinning a sqlite store. When provided, `dbPath` is ignored.
   */
  events?: ReadonlyArray<Event>;
}

interface ParsedStreams {
  /** All typed events seen (used for actor-URN extraction). */
  totalEvents: number;
  /** Set of URNs registered via `PrincipalRegistered` events. */
  registeredUrns: Set<string>;
  /** Distinct actor URNs referenced by events, with first-seen as_of and an example event. */
  actorRefs: Map<string, { firstSeen: string; sampleEventId: string; sampleType: string }>;
  /** Actor objects keyed by URN — preserved so we can classify cohort. */
  actorByUrn: Map<string, { type: string; id: string }>;
  /** Count of events whose `actor` is structurally invalid (missing type or id). */
  malformedActorEvents: ReadonlyArray<{ eventId: string; eventType: string; reason: string }>;
}

function readStreams(events: ReadonlyArray<Event>): ParsedStreams {
  const registeredUrns = new Set<string>();
  const actorRefs = new Map<
    string,
    { firstSeen: string; sampleEventId: string; sampleType: string }
  >();
  const actorByUrn = new Map<string, { type: string; id: string }>();
  const malformedActorEvents: { eventId: string; eventType: string; reason: string }[] = [];
  let totalEvents = 0;

  for (const e of events) {
    totalEvents++;

    // Structural actor check (assertion 1). Defence-in-depth — schema
    // enforces this at append-time, the recon re-asserts at audit-time.
    if (
      !e.actor ||
      typeof e.actor.id !== "string" ||
      e.actor.id.length === 0 ||
      typeof e.actor.type !== "string" ||
      e.actor.type.length === 0
    ) {
      malformedActorEvents.push({
        eventId: e.event_id,
        eventType: e.type,
        reason: "actor missing required type/id fields",
      });
      continue;
    }

    // Track the actor URN for assertion 2 (resolution). Skip events
    // that ARE the principal-registration; otherwise self-registration
    // would be tautologically self-resolving.
    if (e.type !== "PrincipalRegistered") {
      const urn = e.actor.id;
      if (!actorRefs.has(urn)) {
        actorRefs.set(urn, {
          firstSeen: e.as_of,
          sampleEventId: e.event_id,
          sampleType: e.type,
        });
        actorByUrn.set(urn, { type: e.actor.type, id: e.actor.id });
      }
    }

    // Collect registered URNs from `PrincipalRegistered` events. The
    // payload's URN field name is normative per D-PRINCIPAL-REGISTER
    // schema (slice 1); we accept either `principalUrn` (the proposed
    // canonical name) or `urn` (a likely alternative) so the stub
    // tolerates either schema variant the register lands with.
    if (e.type === "PrincipalRegistered") {
      const p = e.payload as Record<string, unknown>;
      const candidate =
        (typeof p.principalUrn === "string" && p.principalUrn) ||
        (typeof p.urn === "string" && p.urn) ||
        (typeof p.principalId === "string" && p.principalId) ||
        "";
      if (candidate) registeredUrns.add(candidate);
    }
  }

  return {
    totalEvents,
    registeredUrns,
    actorRefs,
    actorByUrn,
    malformedActorEvents,
  };
}

function loadEvents(opts: RunOpts): ReadonlyArray<Event> | undefined {
  if (opts.events) return opts.events;
  const dbPath = opts.dbPath ?? DEFAULT_DB;
  if (!existsSync(dbPath)) return undefined; // empty-store sentinel
  const store = new EventStore(dbPath);
  try {
    const out: Event[] = [];
    for (const e of store.replay()) out.push(e);
    return out;
  } finally {
    store.close();
  }
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("principal-actor-resolve");
  const violations: ReconViolation[] = [];

  const events = loadEvents(opts);
  if (events === undefined) {
    // Empty-store sentinel — no event database yet. Mirrors the
    // convention of `parallel-dispatch-divergence` and
    // `decision-event-recon` for the no-event-store case.
    result.asserted = 1;
    result.violations = [
      {
        subject: opts.dbPath ?? DEFAULT_DB,
        message:
          "Event store not present at the configured path. Pipeline cannot evaluate principal-actor resolution until the store materialises (typical fresh-runner state). No assertion made.",
        severity: "info",
      },
    ];
    return result;
  }

  const streams = readStreams(events);

  // Stage 0 — register-not-yet-on-main. Zero `PrincipalRegistered`
  // events in the store. Per scoping-brief §2, the stub emits a single
  // warn flagging the substrate gap and returns ok: true with no
  // assertions made. The pipeline is discoverable today; the
  // assertions go hard as the register's backfill slices land.
  if (streams.registeredUrns.size === 0) {
    result.asserted = 0;
    result.violations = [
      {
        subject: "principal-register",
        message:
          "Principal Register substrate not yet on main; awaiting D-PRINCIPAL-REGISTER §7 slice 1+2. Pipeline emits warn-only until any `PrincipalRegistered` event lands; severity ladder per `Owner Inbox/2026-05-09_vera_principal-actor-resolve-recon-scoping.md` §3.",
        severity: "warn",
      },
    ];
    result.ok = true;
    return result;
  }

  // Stage 1 — partial-asserted. ≥1 `PrincipalRegistered` event exists.
  // Walk every actor reference and emit one finding per orphan. All
  // emissions are warn-severity until per-cohort backfill markers flip
  // to fail per the §3 progression.

  // Assertion 1 — structural actor-field presence. Re-asserted at
  // audit-time as defence-in-depth. Severity warn for the stub; flips
  // to fail at slice 1 (schema landing) — but at this stub stage we
  // keep it warn to match the rest of the pipeline.
  for (const m of streams.malformedActorEvents) {
    result.asserted++;
    violations.push({
      subject: m.eventId,
      message: `Event \`${m.eventType}\` (id=${m.eventId}) has malformed actor: ${m.reason}. Schema is supposed to enforce this at append-time; surfaced here as a defence-in-depth structural finding.`,
      severity: "warn",
    });
  }

  // Assertion 2 — principal resolution. For every actor URN referenced
  // by any event, assert it appears in `registeredUrns`. Orphans
  // emit warn at this stage; severity flips per cohort per §3.
  for (const [urn, ref] of streams.actorRefs) {
    result.asserted++;
    if (!streams.registeredUrns.has(urn)) {
      const actor = streams.actorByUrn.get(urn) ?? { type: "unknown", id: urn };
      const cohort = classifyActorUrn(actor);
      const severity = cohortSeverity[cohort] ?? "warn";
      violations.push({
        subject: urn,
        message: `Orphan actor — URN \`${urn}\` (cohort=${cohort}, type=${actor.type}) referenced by event \`${ref.sampleType}\` (id=${ref.sampleEventId}, first seen ${ref.firstSeen}) but no \`PrincipalRegistered\` event resolves it. Per scoping-brief §4, this is the \`orphan-actor\` failure class; severity is currently warn pre-backfill and flips to fail as the cohort's backfill slice lands.`,
        severity,
      });
    }
  }

  // Assertions 3 (role-coverage-gap) and 4 (fit-and-proper-stale) are
  // deferred to slices 5 and 8 of D-PRINCIPAL-REGISTER §7 — see
  // scoping-brief §3. The stub does not assert them. A single info
  // row notes the deferred assertions so the pipeline output is
  // self-describing.
  result.asserted++;
  violations.push({
    subject: "deferred-assertions",
    message:
      "Assertions 3 (role-coverage-gap, slice 5) and 4 (fit-and-proper-stale, slice 8) are sequenced to later slices of D-PRINCIPAL-REGISTER §7 and are not yet evaluated. Stub asserts only `actor`-field presence (1) and principal resolution (2).",
    severity: "info",
  });

  result.violations = violations;
  // Stub stays ok: true regardless of warn-count; severity ladder
  // flips fail per cohort as backfill slices land. ok flips to false
  // only on `severity: "fail"` rows.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail").length;
  const warns = r.violations.filter((v) => v.severity === "warn").length;
  console.log(
    JSON.stringify({
      level: r.ok ? (warns ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? warns
          ? `Principal-actor-resolve recon: ${warns} warn(s) — Principal Register substrate not yet fully populated (D-PRINCIPAL-REGISTER §7 backfill in progress); stub emits warn-only`
          : "Principal-actor-resolve recon passed — every event actor resolves to a registered principal"
        : `Principal-actor-resolve recon FAILED — ${fails} fail violation(s); orphan-actor / role-coverage-gap / fit-and-proper-stale findings present`,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
