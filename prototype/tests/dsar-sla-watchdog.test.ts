// tests/dsar-sla-watchdog.test.ts
//
// DSAR substrate tests (privacy dimension, prd:bank:fx:otc-vanilla):
//   - DSARClosed / DSARExtended schemas: refusal requires grounds; extension
//     requires a new deadline + ground.
//   - All three DSAR lifecycle types are REGISTERED in EVENT_TYPE_REGISTRY
//     (F-032: new event types MUST be registered).
//   - Register projection: open/closed status, latest-wins extension deadline,
//     ok/approaching/breached grading, late-closure flag, legacy
//     dsarEventId-pairing replay compatibility.
//   - SLA watchdog: fires SubstrateAlert{integrity, high} for a breached open
//     DSAR, {medium} for approaching; idempotent on a second emit; silent on
//     a closed/in-window register.
//   - recon:dsar-sla: advisory inventory — warn per open-over-SLA, ok:true.
//
// Authority: POPIA 4/2013 ss.23–25; PAIA 2/2000 ss.25–26; ORG-PR(IV)-08;
//   D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11).
// Author: Iris (Information Officer, governance).

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  makeDSARClosed,
  makeDSARExtended,
  makeDSARReceived,
} from "../platform/event-store/event-types/aml-popia-extended";
import { EVENT_TYPE_REGISTRY } from "../platform/event-store/registry";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { foldDsarRegister, openDsars } from "../platform/privacy/dsar-register";
import {
  approachingAlertId,
  breachAlertId,
  checkDsarSla,
  emitDsarSlaAlerts,
} from "../platform/privacy/dsar-sla-watchdog";
import { run as runDsarSlaRecon } from "../platform/recon/dsar-sla";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:test:dsar-sla-watchdog" };
const CITATIONS = ["urn:reg:za:popia:s23", "ORG-PR(IV)-08"];

/** asOf used to grade the register in most tests. */
const AS_OF = "2026-06-12T08:00:00.000Z";

function receive(
  store: EventStore,
  dsarId: string,
  receivedAt: string,
  responseDeadline: string,
): string {
  const ev = makeDSARReceived({
    asOf: receivedAt,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      dsarId,
      dataSubjectRef: "party:counterparty:test-bank-ltd",
      receivedAt,
      requestKind: "access",
      responseDeadline,
    },
  });
  store.append(ev);
  return ev.event_id;
}

describe("DSAR event types (POPIA ss.23–25)", () => {
  it("DSARClosed refuses a refusal without recorded grounds", () => {
    expect(() =>
      makeDSARClosed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          dsarId: "DSAR-001",
          outcome: "refused",
          closedAt: AS_OF,
          closedBy: "agent:iris:information-officer",
        },
      }),
    ).toThrow(/refusalGrounds/);
  });

  it("DSARClosed accepts a refusal carrying its PAIA Ch.4 ground", () => {
    const ev = makeDSARClosed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        dsarId: "DSAR-001",
        outcome: "refused",
        closedAt: AS_OF,
        closedBy: "agent:iris:information-officer",
        refusalGrounds: "PAIA s.64(1)(a) — commercial information of a third party",
      },
    });
    expect(ev.type).toBe("DSARClosed");
  });

  it("all three DSAR lifecycle types are registered (F-032)", () => {
    const registered = new Set(EVENT_TYPE_REGISTRY.map((r) => r.type));
    for (const t of ["DSARReceived", "DSARClosed", "DSARExtended"]) {
      expect(registered.has(t)).toBe(true);
    }
    // The new rows carry typed payload schemas, not envelope-only placeholders.
    for (const t of ["DSARClosed", "DSARExtended"]) {
      const row = EVENT_TYPE_REGISTRY.find((r) => r.type === t);
      expect(row?.payloadSchema).toBeDefined();
      expect(row?.issuer).toBe("Iris");
    }
  });
});

describe("DSAR register projection", () => {
  it("grades an open in-window request ok, approaching near deadline, breached past it", () => {
    const store = new EventStore();
    receive(store, "DSAR-OK", "2026-06-10T08:00:00.000Z", "2026-07-10T08:00:00.000Z");
    receive(store, "DSAR-NEAR", "2026-05-15T08:00:00.000Z", "2026-06-14T08:00:00.000Z");
    receive(store, "DSAR-LATE", "2026-04-01T08:00:00.000Z", "2026-05-01T08:00:00.000Z");

    const reg = foldDsarRegister(store, AS_OF);
    const byId = new Map(reg.map((e) => [e.dsarId, e]));
    expect(byId.get("DSAR-OK")?.slaState).toBe("ok");
    expect(byId.get("DSAR-NEAR")?.slaState).toBe("approaching");
    expect(byId.get("DSAR-LATE")?.slaState).toBe("breached");
    expect(byId.get("DSAR-LATE")?.ageCalendarDays).toBe(72);
    // Sort order: breached first.
    expect(reg[0]?.dsarId).toBe("DSAR-LATE");
  });

  it("a DSARExtended moves the effective deadline (latest-wins) and clears the breach", () => {
    const store = new EventStore();
    receive(store, "DSAR-EXT", "2026-04-01T08:00:00.000Z", "2026-05-01T08:00:00.000Z");
    store.append(
      makeDSARExtended({
        asOf: "2026-04-28T08:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          dsarId: "DSAR-EXT",
          extendedAt: "2026-04-28T08:00:00.000Z",
          newResponseDeadline: "2026-07-01T08:00:00.000Z",
          extensionGrounds:
            "PAIA s.26(1)(a) — request requires search through a large volume of records",
          extendedBy: "agent:iris:information-officer",
        },
      }),
    );
    const [entry] = foldDsarRegister(store, AS_OF);
    expect(entry?.slaState).toBe("ok");
    expect(entry?.extended).toBe(true);
    expect(entry?.responseDeadline).toBe("2026-07-01T08:00:00.000Z");
  });

  it("a DSARClosed disposition closes the request and records late closure", () => {
    const store = new EventStore();
    receive(store, "DSAR-DONE", "2026-04-01T08:00:00.000Z", "2026-05-01T08:00:00.000Z");
    store.append(
      makeDSARClosed({
        asOf: "2026-05-10T08:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          dsarId: "DSAR-DONE",
          outcome: "fulfilled",
          closedAt: "2026-05-10T08:00:00.000Z",
          closedBy: "agent:iris:information-officer",
        },
      }),
    );
    const [entry] = foldDsarRegister(store, AS_OF);
    expect(entry?.status).toBe("fulfilled");
    expect(entry?.slaState).toBe("closed");
    expect(entry?.closedWithinSla).toBe(false); // 9 days late — visible, not forgotten
    expect(openDsars(store, AS_OF)).toHaveLength(0);
  });

  it("pairs a legacy closure carrying only dsarEventId (goal-loop convention)", () => {
    const store = new EventStore();
    const receivedEventId = receive(
      store,
      "DSAR-LEGACY",
      "2026-04-01T08:00:00.000Z",
      "2026-05-01T08:00:00.000Z",
    );
    store.append(
      makeDSARClosed({
        asOf: "2026-04-20T08:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          // Different business key on the closure; pairing falls back to the
          // DSARReceived event_id, as the Iris goal-loop matches.
          dsarId: "DSAR-LEGACY",
          dsarEventId: receivedEventId,
          outcome: "fulfilled",
          closedAt: "2026-04-20T08:00:00.000Z",
          closedBy: "agent:iris:information-officer",
        },
      }),
    );
    const [entry] = foldDsarRegister(store, AS_OF);
    expect(entry?.status).toBe("fulfilled");
    expect(entry?.closedWithinSla).toBe(true);
  });
});

describe("DSAR SLA watchdog (expected-event-watchdog pattern)", () => {
  it("fires a high-severity integrity alert for a breached open DSAR, idempotently", () => {
    const store = new EventStore();
    receive(store, "DSAR-BREACH", "2026-04-01T08:00:00.000Z", "2026-05-01T08:00:00.000Z");

    const gaps = checkDsarSla(store, AS_OF);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.kind).toBe("breached");
    expect(gaps[0]?.alertId).toBe(breachAlertId("DSAR-BREACH"));

    const first = emitDsarSlaAlerts(store, AS_OF);
    expect(first.emitted).toEqual(["DSAR-BREACH"]);

    const alerts = [...store.replay({ type: "SubstrateAlert" })];
    expect(alerts).toHaveLength(1);
    const payload = alerts[0]?.payload as {
      alertId?: string;
      alertClass?: string;
      severity?: string;
      details?: string;
    };
    expect(payload.alertId).toBe("alert:integrity:dsar-sla-breach-dsar-breach");
    expect(payload.alertClass).toBe("integrity");
    expect(payload.severity).toBe("high");
    expect(payload.details).toContain("POPIA s.23");

    // Idempotent: second emission skips, no duplicate alert.
    const second = emitDsarSlaAlerts(store, AS_OF);
    expect(second.emitted).toEqual([]);
    expect(second.skipped).toEqual(["DSAR-BREACH"]);
    expect([...store.replay({ type: "SubstrateAlert" })]).toHaveLength(1);
  });

  it("fires a medium-severity early warning for an approaching deadline", () => {
    const store = new EventStore();
    receive(store, "DSAR-NEAR", "2026-05-15T08:00:00.000Z", "2026-06-14T08:00:00.000Z");

    const { emitted } = emitDsarSlaAlerts(store, AS_OF);
    expect(emitted).toEqual(["DSAR-NEAR"]);
    const payload = [...store.replay({ type: "SubstrateAlert" })][0]?.payload as {
      alertId?: string;
      severity?: string;
    };
    expect(payload.alertId).toBe(approachingAlertId("DSAR-NEAR"));
    expect(payload.severity).toBe("medium");
  });

  it("stays silent on a closed or comfortably-in-window register", () => {
    const store = new EventStore();
    receive(store, "DSAR-OK", "2026-06-10T08:00:00.000Z", "2026-07-10T08:00:00.000Z");
    receive(store, "DSAR-DONE", "2026-04-01T08:00:00.000Z", "2026-05-01T08:00:00.000Z");
    store.append(
      makeDSARClosed({
        asOf: "2026-04-15T08:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          dsarId: "DSAR-DONE",
          outcome: "fulfilled",
          closedAt: "2026-04-15T08:00:00.000Z",
          closedBy: "agent:iris:information-officer",
        },
      }),
    );
    const { emitted } = emitDsarSlaAlerts(store, AS_OF);
    expect(emitted).toEqual([]);
    expect([...store.replay({ type: "SubstrateAlert" })]).toHaveLength(0);
  });
});

describe("recon:dsar-sla (advisory inventory)", () => {
  it("warns per open-over-SLA DSAR and stays advisory (ok:true)", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "dsar-sla-recon-")), "event.db");
    const store = new EventStore(dbPath);
    receive(store, "DSAR-BREACH", "2026-04-01T08:00:00.000Z", "2026-05-01T08:00:00.000Z");
    receive(store, "DSAR-OK", "2026-06-10T08:00:00.000Z", "2026-07-10T08:00:00.000Z");

    const result = runDsarSlaRecon({ dbPath, asOf: AS_OF });
    expect(result.pipeline).toBe("dsar-sla");
    expect(result.asserted).toBe(2);
    expect(result.ok).toBe(true); // advisory
    const warns = result.violations.filter((v) => v.severity === "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.subject).toBe("DSAR-BREACH");
  });

  it("returns clean OK on a missing store (clean CI runner)", () => {
    const result = runDsarSlaRecon({
      dbPath: join(mkdtempSync(join(tmpdir(), "dsar-sla-none-")), "absent.db"),
    });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0);
  });
});
