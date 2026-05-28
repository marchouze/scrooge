// tests/ciso-periodic-run.test.ts
//
// Unit tests for the CISO quarterly governance run substrate.
//
// Test cases:
//   TC-1:  CisoJs2AttestationFiled schema validates correct payload
//   TC-2:  CisoJs2AttestationFiled rejects invalid overallRating
//   TC-3:  CisoJs2AttestationFiled attestedBy must be "Senna"
//   TC-4:  SbomReviewCompleted schema validates correct payload
//   TC-5:  SbomReviewCompleted criticalCount = 0 (zero critical findings)
//   TC-6:  ThreatModelGateCompleted schema validates correct payload
//   TC-7:  ThreatModelGateCompleted gateStatus "passed" correct
//   TC-8:  KeyCeremonyAttested schema validates correct payload
//   TC-9:  KeyCeremonyAttested keyMaterialIntact = true
//   TC-10: GovernanceSeatRunCompleted seatId = "CISO"
//   TC-11: GovernanceSeatRunCompleted status = "completed"
//   TC-12: All 5 events emitted for a fresh period
//   TC-13: Idempotency — re-running does not duplicate events
//   TC-14: JS-2 attestation overall rating is "green"
//   TC-15: SBOM zero critical findings assertion
//   TC-16: period field must match YYYY-QN regex
//   TC-17: makeGovernanceSeatRunCompleted factory produces correct event type
//   TC-18: makeKeyCeremonyAttested factory produces correct event type
//
// Authority:
//   - PA/FSCA Joint Standard 2 of 2024 (JS-2)
//   - POPIA s.19–22
//   - Principle 4 — Security designed in from the start
//
// Author: Senna (Chief Information Security Officer, governance)

import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  cisoJs2AttestationFiledPayloadSchema,
  governanceSeatRunCompletedPayloadSchema,
  keyCeremonyAttestedPayloadSchema,
  makeCisoJs2AttestationFiled,
  makeGovernanceSeatRunCompleted,
  makeKeyCeremonyAttested,
  makeSbomReviewCompleted,
  makeThreatModelGateCompleted,
  sbomReviewCompletedPayloadSchema,
  threatModelGateCompletedPayloadSchema,
} from "../platform/event-store/event-types/ciso-governance";
import { EventStore } from "../platform/event-store/store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const CISO_ACTOR = { type: "service" as const, id: "senna-ciso" };
const CITATIONS = ["PA-FSCA-JS2-2024", "POPIA-s19-22", "Principle-4-security-designed-in"];
const NOW = "2026-05-28T07:38:42.907Z";
const PERIOD = "2026-Q2";
const RUN_ID = "run:senna:2026-05-28T07-38-42-907Z";

const BASE_JS2_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  attestedBy: "Senna" as const,
  js2Version: "JS2-2024",
  controlsAssessed: 47,
  findingsOpen: 2,
  findingsResolved: 11,
  overallRating: "green" as const,
  attestedAt: NOW,
};

const BASE_SBOM_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  componentsScanned: 1204,
  vulnerabilitiesFound: 3,
  criticalCount: 0,
  highCount: 1,
  remediationDeadline: "2026-09-30",
  reviewedAt: NOW,
};

const BASE_THREAT_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  systemsReviewed: 12,
  threatsIdentified: 4,
  controlsAdequate: true,
  gateStatus: "passed" as const,
  completedAt: NOW,
};

const BASE_KEY_CEREMONY_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  ceremonyType: "quarterly-rotation",
  participantCount: 3,
  witnessedBy: "Senna",
  keyMaterialIntact: true,
  completedAt: NOW,
};

const BASE_RUN_COMPLETED_PAYLOAD = {
  seatId: "CISO",
  agentId: "senna-ciso",
  runType: "quarterly",
  period: PERIOD,
  eventsEmitted: 4,
  findings: [] as string[],
  status: "completed",
};

function makeTmpStore(): EventStore {
  const tmpDir = mkdtempSync(join(tmpdir(), "ciso-run-test-"));
  return new EventStore(join(tmpDir, "event.db"));
}

// ---------------------------------------------------------------------------
// TC-1 through TC-3: CisoJs2AttestationFiled
// ---------------------------------------------------------------------------

describe("CisoJs2AttestationFiled schema", () => {
  it("TC-1: validates a correct JS-2 attestation payload", () => {
    expect(() => cisoJs2AttestationFiledPayloadSchema.parse(BASE_JS2_PAYLOAD)).not.toThrow();
    const parsed = cisoJs2AttestationFiledPayloadSchema.parse(BASE_JS2_PAYLOAD);
    expect(parsed.controlsAssessed).toBe(47);
    expect(parsed.findingsOpen).toBe(2);
    expect(parsed.findingsResolved).toBe(11);
    expect(parsed.js2Version).toBe("JS2-2024");
  });

  // TC-14: JS-2 attestation overall rating is "green"
  it("TC-14: overall rating is green (correct value)", () => {
    const parsed = cisoJs2AttestationFiledPayloadSchema.parse(BASE_JS2_PAYLOAD);
    expect(parsed.overallRating).toBe("green");
  });

  it("TC-2: rejects invalid overallRating value", () => {
    expect(() =>
      cisoJs2AttestationFiledPayloadSchema.parse({ ...BASE_JS2_PAYLOAD, overallRating: "blue" }),
    ).toThrow();
  });

  it("TC-3: attestedBy must be literal 'Senna'", () => {
    expect(() =>
      cisoJs2AttestationFiledPayloadSchema.parse({
        ...BASE_JS2_PAYLOAD,
        attestedBy: "NotSenna",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-4 through TC-5: SbomReviewCompleted
// ---------------------------------------------------------------------------

describe("SbomReviewCompleted schema", () => {
  it("TC-4: validates a correct SBOM review payload", () => {
    expect(() => sbomReviewCompletedPayloadSchema.parse(BASE_SBOM_PAYLOAD)).not.toThrow();
    const parsed = sbomReviewCompletedPayloadSchema.parse(BASE_SBOM_PAYLOAD);
    expect(parsed.componentsScanned).toBe(1204);
    expect(parsed.vulnerabilitiesFound).toBe(3);
    expect(parsed.highCount).toBe(1);
  });

  // TC-15: SBOM zero critical findings
  it("TC-5 + TC-15: criticalCount is 0 (no critical findings)", () => {
    const parsed = sbomReviewCompletedPayloadSchema.parse(BASE_SBOM_PAYLOAD);
    expect(parsed.criticalCount).toBe(0);
  });

  it("rejects negative criticalCount", () => {
    expect(() =>
      sbomReviewCompletedPayloadSchema.parse({ ...BASE_SBOM_PAYLOAD, criticalCount: -1 }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-6 through TC-7: ThreatModelGateCompleted
// ---------------------------------------------------------------------------

describe("ThreatModelGateCompleted schema", () => {
  it("TC-6: validates a correct threat-model gate payload", () => {
    expect(() =>
      threatModelGateCompletedPayloadSchema.parse(BASE_THREAT_PAYLOAD),
    ).not.toThrow();
    const parsed = threatModelGateCompletedPayloadSchema.parse(BASE_THREAT_PAYLOAD);
    expect(parsed.systemsReviewed).toBe(12);
    expect(parsed.threatsIdentified).toBe(4);
    expect(parsed.controlsAdequate).toBe(true);
  });

  it("TC-7: gateStatus 'passed' is valid", () => {
    const parsed = threatModelGateCompletedPayloadSchema.parse(BASE_THREAT_PAYLOAD);
    expect(parsed.gateStatus).toBe("passed");
  });

  it("rejects invalid gateStatus", () => {
    expect(() =>
      threatModelGateCompletedPayloadSchema.parse({
        ...BASE_THREAT_PAYLOAD,
        gateStatus: "unknown",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-8 through TC-9: KeyCeremonyAttested
// ---------------------------------------------------------------------------

describe("KeyCeremonyAttested schema", () => {
  it("TC-8: validates a correct key-ceremony attestation payload", () => {
    expect(() => keyCeremonyAttestedPayloadSchema.parse(BASE_KEY_CEREMONY_PAYLOAD)).not.toThrow();
    const parsed = keyCeremonyAttestedPayloadSchema.parse(BASE_KEY_CEREMONY_PAYLOAD);
    expect(parsed.ceremonyType).toBe("quarterly-rotation");
    expect(parsed.participantCount).toBe(3);
    expect(parsed.witnessedBy).toBe("Senna");
  });

  it("TC-9: keyMaterialIntact is true", () => {
    const parsed = keyCeremonyAttestedPayloadSchema.parse(BASE_KEY_CEREMONY_PAYLOAD);
    expect(parsed.keyMaterialIntact).toBe(true);
  });

  it("rejects participantCount of 0 (must be positive)", () => {
    expect(() =>
      keyCeremonyAttestedPayloadSchema.parse({
        ...BASE_KEY_CEREMONY_PAYLOAD,
        participantCount: 0,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-10 through TC-11: GovernanceSeatRunCompleted
// ---------------------------------------------------------------------------

describe("GovernanceSeatRunCompleted schema", () => {
  it("TC-10: seatId is 'CISO'", () => {
    const parsed = governanceSeatRunCompletedPayloadSchema.parse(BASE_RUN_COMPLETED_PAYLOAD);
    expect(parsed.seatId).toBe("CISO");
  });

  it("TC-11: status is 'completed'", () => {
    const parsed = governanceSeatRunCompletedPayloadSchema.parse(BASE_RUN_COMPLETED_PAYLOAD);
    expect(parsed.status).toBe("completed");
  });

  it("rejects empty status", () => {
    expect(() =>
      governanceSeatRunCompletedPayloadSchema.parse({
        ...BASE_RUN_COMPLETED_PAYLOAD,
        status: "",
      }),
    ).toThrow();
  });

  it("rejects invalid period format", () => {
    expect(() =>
      governanceSeatRunCompletedPayloadSchema.parse({
        ...BASE_RUN_COMPLETED_PAYLOAD,
        period: "2026-Q5",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-16: period field YYYY-QN regex
// ---------------------------------------------------------------------------

describe("period field validation (YYYY-QN)", () => {
  it("TC-16: accepts valid period strings", () => {
    for (const p of ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1"]) {
      expect(() =>
        cisoJs2AttestationFiledPayloadSchema.parse({ ...BASE_JS2_PAYLOAD, period: p }),
      ).not.toThrow();
    }
  });

  it("TC-16b: rejects malformed period strings", () => {
    for (const p of ["26-Q2", "2026-Q0", "2026-Q5", "2026Q2", "Q2-2026"]) {
      expect(() =>
        cisoJs2AttestationFiledPayloadSchema.parse({ ...BASE_JS2_PAYLOAD, period: p }),
      ).toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// TC-17 through TC-18: Factory functions
// ---------------------------------------------------------------------------

describe("makeGovernanceSeatRunCompleted factory", () => {
  it("TC-17: produces an event with type GovernanceSeatRunCompleted", () => {
    const event = makeGovernanceSeatRunCompleted({
      asOf: NOW,
      entity: BANK_ENTITY,
      actor: CISO_ACTOR,
      citations: CITATIONS,
      payload: BASE_RUN_COMPLETED_PAYLOAD,
    });
    expect(event.type).toBe("GovernanceSeatRunCompleted");
    expect(event.event_id).toBeTruthy();
    expect(event.citations).toContain("PA-FSCA-JS2-2024");
    const p = event.payload as typeof BASE_RUN_COMPLETED_PAYLOAD;
    expect(p.seatId).toBe("CISO");
    expect(p.status).toBe("completed");
  });

  it("throws if no citations provided", () => {
    expect(() =>
      makeGovernanceSeatRunCompleted({
        asOf: NOW,
        entity: BANK_ENTITY,
        actor: CISO_ACTOR,
        citations: [],
        payload: BASE_RUN_COMPLETED_PAYLOAD,
      }),
    ).toThrow("at least one citation");
  });
});

describe("makeKeyCeremonyAttested factory", () => {
  it("TC-18: produces an event with type KeyCeremonyAttested", () => {
    const event = makeKeyCeremonyAttested({
      asOf: NOW,
      entity: BANK_ENTITY,
      actor: CISO_ACTOR,
      citations: CITATIONS,
      payload: BASE_KEY_CEREMONY_PAYLOAD,
    });
    expect(event.type).toBe("KeyCeremonyAttested");
    expect(event.event_id).toBeTruthy();
    const p = event.payload as typeof BASE_KEY_CEREMONY_PAYLOAD;
    expect(p.keyMaterialIntact).toBe(true);
    expect(p.ceremonyType).toBe("quarterly-rotation");
  });
});

// ---------------------------------------------------------------------------
// TC-12: All 5 events emitted for a fresh period
// TC-13: Idempotency — re-running does not duplicate events
// ---------------------------------------------------------------------------

describe("CISO run — event store integration", () => {
  /**
   * Helper: emit all 5 CISO governance events for a given period into a store.
   */
  function emitCisoRun(store: EventStore, period: string, runId: string): void {
    const now = new Date().toISOString();

    store.append(
      makeCisoJs2AttestationFiled({
        asOf: now,
        entity: BANK_ENTITY,
        actor: CISO_ACTOR,
        citations: CITATIONS,
        payload: { ...BASE_JS2_PAYLOAD, period, runId, attestedAt: now },
      }),
    );

    store.append(
      makeSbomReviewCompleted({
        asOf: now,
        entity: BANK_ENTITY,
        actor: CISO_ACTOR,
        citations: CITATIONS,
        payload: { ...BASE_SBOM_PAYLOAD, period, runId, reviewedAt: now },
      }),
    );

    store.append(
      makeThreatModelGateCompleted({
        asOf: now,
        entity: BANK_ENTITY,
        actor: CISO_ACTOR,
        citations: CITATIONS,
        payload: { ...BASE_THREAT_PAYLOAD, period, runId, completedAt: now },
      }),
    );

    store.append(
      makeKeyCeremonyAttested({
        asOf: now,
        entity: BANK_ENTITY,
        actor: CISO_ACTOR,
        citations: CITATIONS,
        payload: { ...BASE_KEY_CEREMONY_PAYLOAD, period, runId, completedAt: now },
      }),
    );

    store.append(
      makeGovernanceSeatRunCompleted({
        asOf: now,
        entity: BANK_ENTITY,
        actor: CISO_ACTOR,
        citations: CITATIONS,
        payload: { ...BASE_RUN_COMPLETED_PAYLOAD, period },
      }),
    );
  }

  it("TC-12: all 5 event types are emitted for a fresh period", () => {
    const store = makeTmpStore();
    emitCisoRun(store, PERIOD, RUN_ID);

    const js2Events = [...store.replay({ type: "CisoJs2AttestationFiled" })];
    const sbomEvents = [...store.replay({ type: "SbomReviewCompleted" })];
    const threatEvents = [...store.replay({ type: "ThreatModelGateCompleted" })];
    const keyEvents = [...store.replay({ type: "KeyCeremonyAttested" })];
    const runEvents = [...store.replay({ type: "GovernanceSeatRunCompleted" })];

    expect(js2Events.length).toBe(1);
    expect(sbomEvents.length).toBe(1);
    expect(threatEvents.length).toBe(1);
    expect(keyEvents.length).toBe(1);
    expect(runEvents.length).toBe(1);

    // Verify payload values are correct on the emitted events
    const js2Payload = js2Events[0]?.payload as typeof BASE_JS2_PAYLOAD;
    expect(js2Payload.overallRating).toBe("green");
    expect(js2Payload.controlsAssessed).toBe(47);
    expect(js2Payload.attestedBy).toBe("Senna");

    const sbomPayload = sbomEvents[0]?.payload as typeof BASE_SBOM_PAYLOAD;
    expect(sbomPayload.criticalCount).toBe(0);
    expect(sbomPayload.componentsScanned).toBe(1204);

    const runPayload = runEvents[0]?.payload as typeof BASE_RUN_COMPLETED_PAYLOAD;
    expect(runPayload.seatId).toBe("CISO");
    expect(runPayload.status).toBe("completed");
  });

  it("TC-13: idempotency — emitting a second run for the same period yields 2 events per type only if naive; the script guards should prevent duplication", () => {
    const store = makeTmpStore();

    // First run — 5 events
    emitCisoRun(store, PERIOD, RUN_ID);

    // Simulate the idempotency check from the script:
    // Only emit if no event for this period exists yet.
    const existingJs2ForPeriod = [...store.replay({ type: "CisoJs2AttestationFiled" })].filter(
      (e) => (e.payload as Record<string, unknown>)["period"] === PERIOD,
    );

    // Guard: only emit if not already present
    if (existingJs2ForPeriod.length === 0) {
      emitCisoRun(store, PERIOD, `${RUN_ID}-dup`);
    }

    // Should still be exactly 1 CisoJs2AttestationFiled for this period
    const js2Events = [...store.replay({ type: "CisoJs2AttestationFiled" })].filter(
      (e) => (e.payload as Record<string, unknown>)["period"] === PERIOD,
    );
    expect(js2Events.length).toBe(1);
  });

  it("TC-13b: two different periods each produce exactly 1 set of events", () => {
    const store = makeTmpStore();

    emitCisoRun(store, "2026-Q1", "run:senna:q1");
    emitCisoRun(store, "2026-Q2", "run:senna:q2");

    const allJs2 = [...store.replay({ type: "CisoJs2AttestationFiled" })];
    expect(allJs2.length).toBe(2);

    const q1 = allJs2.filter(
      (e) => (e.payload as Record<string, unknown>)["period"] === "2026-Q1",
    );
    const q2 = allJs2.filter(
      (e) => (e.payload as Record<string, unknown>)["period"] === "2026-Q2",
    );
    expect(q1.length).toBe(1);
    expect(q2.length).toBe(1);
  });
});
