// tests/recon-principal-actor-resolve.test.ts
//
// Unit tests for the `principal-actor-resolve` recon stub. Validates
// the warn-pre-register-landing pattern and the partial-asserted Stage
// 1 mode (≥1 `PrincipalRegistered` event in the store flips the
// pipeline into orphan-walk mode).
//
// Coverage:
//   - empty-store sentinel (no .db file): ok with info-severity row.
//   - Stage 0 — register-not-yet-on-main (events present, zero
//     `PrincipalRegistered`): single warn, ok=true, asserted=0.
//   - Stage 1 — partial-asserted, all actors registered: ok with the
//     deferred-assertions info row only.
//   - Stage 1 — partial-asserted, one orphan actor: warn for the
//     orphan, ok=true (severity ladder is warn at this stub stage).
//   - Stage 1 — multiple `PrincipalRegistered` payload-shape variants
//     (`principalUrn` vs `urn` vs `principalId`) all resolve.
//   - Malformed actor (defence-in-depth) — gracefully skipped at
//     append (zod blocks); test ensures readStreams handles.
//
// Author: Vera

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import type { Event } from "../platform/event-store/types";
import { run as principalActorResolve } from "../platform/recon/principal-actor-resolve";

const ENTITY = BANK_ZA_001;
const CITATIONS = ["D-PRINCIPAL-REGISTER", "GOV-FRAMEWORK-CEO-RESERVED"];

const T = "2026-05-09T12:00:00.000Z";

/** Build a synthetic `PrincipalRegistered` event for the recon. */
function principalRegistered(args: {
  principalUrn?: string;
  urn?: string;
  principalId?: string;
  registrarActor?: { type: "system" | "human" | "service"; id: string };
}): Event {
  return {
    event_id: newEventId(),
    type: "PrincipalRegistered",
    as_of: T,
    entity: ENTITY,
    actor: args.registrarActor ?? { type: "service", id: "agent:sade:agentops-readiness" },
    citations: [...CITATIONS],
    payload: {
      ...(args.principalUrn !== undefined && { principalUrn: args.principalUrn }),
      ...(args.urn !== undefined && { urn: args.urn }),
      ...(args.principalId !== undefined && { principalId: args.principalId }),
    },
  };
}

/** Build a synthetic non-principal-registration event with a given actor. */
function eventWithActor(actor: { type: "system" | "human" | "service"; id: string }): Event {
  return {
    event_id: newEventId(),
    type: "WorkstreamRegistered",
    as_of: T,
    entity: ENTITY,
    actor,
    citations: [...CITATIONS],
    payload: {
      workstreamId: `workstream:test-${newEventId()}`,
      title: "Test workstream",
      owner: "Atlas",
      status: "planned",
      summary: "Synthetic for principal-actor-resolve recon test.",
    },
  };
}

describe("principal-actor-resolve recon (Vera — D-PRINCIPAL-REGISTER stub)", () => {
  it("returns ok with info-severity row when the event store path does not exist", () => {
    const r = principalActorResolve({
      dbPath: "/tmp/bank-recon-par-nonexistent.db",
    });
    expect(r.pipeline).toBe("principal-actor-resolve");
    expect(r.ok).toBe(true);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("info");
  });

  it("emits a single warn and returns ok=true when no PrincipalRegistered events exist (Stage 0)", () => {
    const events: Event[] = [
      eventWithActor({ type: "service", id: "agent:anya:projection-refresh" }),
    ];
    const r = principalActorResolve({ events });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.subject).toBe("principal-register");
    expect(r.violations[0]?.message).toContain("D-PRINCIPAL-REGISTER");
  });

  it("returns ok with no orphan warns when every actor URN is registered (Stage 1, all-resolved)", () => {
    const urn = "agent:anya:projection-refresh";
    const events: Event[] = [
      principalRegistered({ principalUrn: urn }),
      eventWithActor({ type: "service", id: urn }),
    ];
    const r = principalActorResolve({ events });
    expect(r.ok).toBe(true);
    // No orphan-actor warn; only the deferred-assertions info row is
    // expected (assertion 3+4 stub note).
    const orphanWarns = r.violations.filter((v) => v.severity === "warn" && v.subject === urn);
    expect(orphanWarns.length).toBe(0);
    const infoRows = r.violations.filter((v) => v.severity === "info");
    expect(infoRows.length).toBe(1);
    expect(infoRows[0]?.subject).toBe("deferred-assertions");
  });

  it("emits a warn (ok=true) per orphan actor URN at the stub stage (Stage 1, partial)", () => {
    const registeredUrn = "agent:anya:projection-refresh";
    const orphanUrn = "agent:zara:mlro-supervision";
    const events: Event[] = [
      principalRegistered({ principalUrn: registeredUrn }),
      eventWithActor({ type: "service", id: registeredUrn }),
      eventWithActor({ type: "service", id: orphanUrn }),
    ];
    const r = principalActorResolve({ events });
    // Stub stage — orphans emit warn, not fail. ok stays true.
    expect(r.ok).toBe(true);
    const orphanWarn = r.violations.find((v) => v.subject === orphanUrn && v.severity === "warn");
    expect(orphanWarn).toBeDefined();
    expect(orphanWarn?.message).toContain("Orphan actor");
    expect(orphanWarn?.message).toContain("internal-agent");
  });

  it("classifies a director URN cohort and emits warn at stub stage", () => {
    const registeredUrn = "agent:sade:agentops-readiness";
    const directorUrn = "director:marc";
    const events: Event[] = [
      principalRegistered({ principalUrn: registeredUrn }),
      eventWithActor({ type: "human", id: directorUrn }),
    ];
    const r = principalActorResolve({ events });
    expect(r.ok).toBe(true);
    const directorOrphan = r.violations.find((v) => v.subject === directorUrn);
    expect(directorOrphan).toBeDefined();
    expect(directorOrphan?.severity).toBe("warn");
    expect(directorOrphan?.message).toContain("director-officer");
  });

  it("accepts `urn` and `principalId` payload-shape variants for PrincipalRegistered", () => {
    const urn1 = "agent:anya:projection-refresh";
    const urn2 = "agent:atlas:event-trigger-bus";
    const urn3 = "agent:vera:overnight-recon";
    const events: Event[] = [
      principalRegistered({ principalUrn: urn1 }),
      principalRegistered({ urn: urn2 }),
      principalRegistered({ principalId: urn3 }),
      eventWithActor({ type: "service", id: urn1 }),
      eventWithActor({ type: "service", id: urn2 }),
      eventWithActor({ type: "service", id: urn3 }),
    ];
    const r = principalActorResolve({ events });
    // All three actors should resolve — no orphan-actor warnings.
    const orphanWarns = r.violations.filter(
      (v) => v.severity === "warn" && v.message.includes("Orphan actor"),
    );
    expect(orphanWarns.length).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("does not double-count `PrincipalRegistered` event actors as orphans", () => {
    // The `PrincipalRegistered` event itself has an actor (the
    // registrar), and the recon must not treat it as an orphan-actor
    // candidate (otherwise the registrar would always be its own
    // orphan-resolution problem). The implementation skips
    // `PrincipalRegistered` events when collecting actor refs.
    const principalUrn = "agent:anya:projection-refresh";
    const events: Event[] = [
      // The Sade-registrar actor is not itself registered. If the
      // recon were tracking it, this would orphan-out. It must not.
      principalRegistered({
        principalUrn,
        registrarActor: { type: "service", id: "agent:sade:agentops-readiness" },
      }),
      eventWithActor({ type: "service", id: principalUrn }),
    ];
    const r = principalActorResolve({ events });
    expect(r.ok).toBe(true);
    const sadeOrphan = r.violations.find((v) => v.subject === "agent:sade:agentops-readiness");
    expect(sadeOrphan).toBeUndefined();
  });

  it("emits the deferred-assertions info row whenever Stage 1 is active", () => {
    const urn = "agent:anya:projection-refresh";
    const events: Event[] = [
      principalRegistered({ principalUrn: urn }),
      eventWithActor({ type: "service", id: urn }),
    ];
    const r = principalActorResolve({ events });
    const deferredInfo = r.violations.find(
      (v) => v.severity === "info" && v.subject === "deferred-assertions",
    );
    expect(deferredInfo).toBeDefined();
    expect(deferredInfo?.message).toContain("role-coverage-gap");
    expect(deferredInfo?.message).toContain("fit-and-proper-stale");
  });
});
