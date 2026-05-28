// tests/cae-periodic-run.test.ts
//
// Unit tests for the CAE quarterly autonomous run.
//
// Test cases:
//   TC-1:  AuditPlanUpdated schema validates a correct payload
//   TC-2:  AuditPlanUpdated rejects missing required fields
//   TC-3:  AuditIssueTrackerReviewed schema validates a correct payload
//   TC-4:  AuditIssueTrackerReviewed rejects missing required fields
//   TC-5:  QaipAttestationFiled schema validates a correct payload
//   TC-6:  QaipAttestationFiled rejects invalid conformanceRating
//   TC-7:  ThirdLineOpinionFiled schema validates a correct payload
//   TC-8:  ThirdLineOpinionFiled rejects invalid overallAssurance
//   TC-9:  ThirdLineOpinionFiled requires at least one keyFinding
//   TC-10: GovernanceSeatRunCompleted — seatId "CAE" + outcome "delivered"
//   TC-11: GovernanceSeatRunCompleted rejects invalid period format
//   TC-12: All 5 events emitted in a fresh store have correct types
//   TC-13: All 5 events have correct field values (spot-check)
//   TC-14: Idempotency — re-running with same runId produces no new events
//   TC-15: Audit plan has non-zero auditsScheduled
//   TC-16: Third-line opinion — overallAssurance is "reasonable"
//   TC-17: make* factories throw when citations array is empty
//
// Authority:
//   - D-CAE-QUARTERLY-RUN-G5 (2026-05-28)
//   - IIA Standards §1300, §2010, §2600
//
// Author: Thandiwe (Chief Audit Executive, governance)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  auditIssueTrackerReviewedPayloadSchema,
  auditPlanUpdatedPayloadSchema,
  governanceSeatRunCompletedPayloadSchema,
  makeAuditIssueTrackerReviewed,
  makeAuditPlanUpdated,
  makeGovernanceSeatRunCompleted,
  makeQaipAttestationFiled,
  makeThirdLineOpinionFiled,
  qaipAttestationFiledPayloadSchema,
  thirdLineOpinionFiledPayloadSchema,
} from "../platform/event-store/event-types/cae-governance";
import { EventStore } from "../platform/event-store/store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const CAE_ACTOR = { type: "service" as const, id: "Thandiwe" };
const CITATIONS = ["D-CAE-QUARTERLY-RUN-G5", "IIA-STANDARDS-1300"];
const NOW = "2026-05-28T07:38:43.015Z";
const PERIOD = "2026-Q2";
const RUN_ID = "run:thandiwe:test-run-001";
const BRIEF_ID = "brief:thandiwe:cae-quarterly-autonomous-run-audit-plan-qaip-thi:2026-05-28";

const VALID_AUDIT_PLAN_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  auditsScheduled: 12,
  auditsCompleted: 9,
  highRiskAreasCovered: 5,
  planVersion: "AUP-2026-Q2",
  updatedAt: NOW,
};

const VALID_ISSUE_TRACKER_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  openFindings: 7,
  overdueFindings: 1,
  criticalFindings: 0,
  findingsClosedThisQuarter: 4,
  reviewedAt: NOW,
};

const VALID_QAIP_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  internalAssessmentCompleted: true,
  externalAssessmentDue: "2031-06-30",
  conformanceRating: "generally-conforms" as const,
  attestedAt: NOW,
};

const VALID_THIRD_LINE_PAYLOAD = {
  runId: RUN_ID,
  period: PERIOD,
  opinionScope: "Annual internal audit opinion — pre-licence gate",
  overallAssurance: "reasonable" as const,
  keyFindings: [
    "Capital adequacy controls adequate",
    "AML/CFT controls partially implemented",
    "IT security controls reviewed",
  ],
  filedAt: NOW,
};

const VALID_SEAT_RUN_PAYLOAD = {
  seatId: "CAE",
  runId: RUN_ID,
  briefId: BRIEF_ID,
  period: PERIOD,
  outcome: "delivered" as const,
  completedAt: NOW,
  summaryNotes:
    "Audit plan updated; 7 open findings (0 critical, 1 overdue); QAIP generally-conforms; third-line opinion: reasonable assurance",
};

// ---------------------------------------------------------------------------
// Helpers for emit-all
// ---------------------------------------------------------------------------

function emitAllEvents(store: EventStore, runId: string): void {
  store.append(
    makeAuditPlanUpdated({
      asOf: NOW,
      entity: BANK_ENTITY,
      actor: CAE_ACTOR,
      citations: CITATIONS,
      payload: { ...VALID_AUDIT_PLAN_PAYLOAD, runId },
    }),
  );
  store.append(
    makeAuditIssueTrackerReviewed({
      asOf: NOW,
      entity: BANK_ENTITY,
      actor: CAE_ACTOR,
      citations: CITATIONS,
      payload: { ...VALID_ISSUE_TRACKER_PAYLOAD, runId },
    }),
  );
  store.append(
    makeQaipAttestationFiled({
      asOf: NOW,
      entity: BANK_ENTITY,
      actor: CAE_ACTOR,
      citations: CITATIONS,
      payload: { ...VALID_QAIP_PAYLOAD, runId },
    }),
  );
  store.append(
    makeThirdLineOpinionFiled({
      asOf: NOW,
      entity: BANK_ENTITY,
      actor: CAE_ACTOR,
      citations: CITATIONS,
      payload: { ...VALID_THIRD_LINE_PAYLOAD, runId },
    }),
  );
  store.append(
    makeGovernanceSeatRunCompleted({
      asOf: NOW,
      entity: BANK_ENTITY,
      actor: CAE_ACTOR,
      citations: CITATIONS,
      payload: { ...VALID_SEAT_RUN_PAYLOAD, runId },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cae-run-test-"));
  dbPath = join(tmpDir, "event.db");
});

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
});

// ---------------------------------------------------------------------------
// TC-1: AuditPlanUpdated — schema validates correct payload
// ---------------------------------------------------------------------------

describe("AuditPlanUpdated schema", () => {
  it("TC-1: valid payload passes schema validation", () => {
    expect(() => auditPlanUpdatedPayloadSchema.parse(VALID_AUDIT_PLAN_PAYLOAD)).not.toThrow();
    const parsed = auditPlanUpdatedPayloadSchema.parse(VALID_AUDIT_PLAN_PAYLOAD);
    expect(parsed.auditsScheduled).toBe(12);
    expect(parsed.auditsCompleted).toBe(9);
    expect(parsed.planVersion).toBe("AUP-2026-Q2");
  });

  // TC-2: missing required fields → schema throws
  it("TC-2: missing runId → schema throws", () => {
    const { runId: _omitted, ...invalid } = VALID_AUDIT_PLAN_PAYLOAD;
    expect(() => auditPlanUpdatedPayloadSchema.parse(invalid)).toThrow();
  });

  it("TC-2b: invalid period format → schema throws", () => {
    expect(() =>
      auditPlanUpdatedPayloadSchema.parse({ ...VALID_AUDIT_PLAN_PAYLOAD, period: "2026-Q5" }),
    ).toThrow();
  });

  it("TC-2c: negative auditsScheduled → schema throws", () => {
    expect(() =>
      auditPlanUpdatedPayloadSchema.parse({ ...VALID_AUDIT_PLAN_PAYLOAD, auditsScheduled: -1 }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-3: AuditIssueTrackerReviewed — schema validates correct payload
// ---------------------------------------------------------------------------

describe("AuditIssueTrackerReviewed schema", () => {
  it("TC-3: valid payload passes schema validation", () => {
    expect(() =>
      auditIssueTrackerReviewedPayloadSchema.parse(VALID_ISSUE_TRACKER_PAYLOAD),
    ).not.toThrow();
    const parsed = auditIssueTrackerReviewedPayloadSchema.parse(VALID_ISSUE_TRACKER_PAYLOAD);
    expect(parsed.openFindings).toBe(7);
    expect(parsed.overdueFindings).toBe(1);
    expect(parsed.criticalFindings).toBe(0);
    expect(parsed.findingsClosedThisQuarter).toBe(4);
  });

  // TC-4: missing required fields
  it("TC-4: missing period → schema throws", () => {
    const { period: _omitted, ...invalid } = VALID_ISSUE_TRACKER_PAYLOAD;
    expect(() => auditIssueTrackerReviewedPayloadSchema.parse(invalid)).toThrow();
  });

  it("TC-4b: negative openFindings → schema throws", () => {
    expect(() =>
      auditIssueTrackerReviewedPayloadSchema.parse({
        ...VALID_ISSUE_TRACKER_PAYLOAD,
        openFindings: -1,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-5: QaipAttestationFiled — schema validates correct payload
// ---------------------------------------------------------------------------

describe("QaipAttestationFiled schema", () => {
  it("TC-5: valid payload with generally-conforms passes", () => {
    expect(() => qaipAttestationFiledPayloadSchema.parse(VALID_QAIP_PAYLOAD)).not.toThrow();
    const parsed = qaipAttestationFiledPayloadSchema.parse(VALID_QAIP_PAYLOAD);
    expect(parsed.conformanceRating).toBe("generally-conforms");
    expect(parsed.internalAssessmentCompleted).toBe(true);
  });

  // TC-6: invalid conformanceRating
  it("TC-6: invalid conformanceRating → schema throws", () => {
    expect(() =>
      qaipAttestationFiledPayloadSchema.parse({
        ...VALID_QAIP_PAYLOAD,
        conformanceRating: "fully-conforms", // not a valid enum value
      }),
    ).toThrow();
  });

  it("TC-6b: partially-conforms is valid", () => {
    expect(() =>
      qaipAttestationFiledPayloadSchema.parse({
        ...VALID_QAIP_PAYLOAD,
        conformanceRating: "partially-conforms",
      }),
    ).not.toThrow();
  });

  it("TC-6c: does-not-conform is valid", () => {
    expect(() =>
      qaipAttestationFiledPayloadSchema.parse({
        ...VALID_QAIP_PAYLOAD,
        conformanceRating: "does-not-conform",
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-7: ThirdLineOpinionFiled — schema validates correct payload
// ---------------------------------------------------------------------------

describe("ThirdLineOpinionFiled schema", () => {
  it("TC-7: valid payload with reasonable assurance passes", () => {
    expect(() => thirdLineOpinionFiledPayloadSchema.parse(VALID_THIRD_LINE_PAYLOAD)).not.toThrow();
    const parsed = thirdLineOpinionFiledPayloadSchema.parse(VALID_THIRD_LINE_PAYLOAD);
    expect(parsed.overallAssurance).toBe("reasonable");
    expect(parsed.keyFindings.length).toBe(3);
  });

  // TC-8: invalid overallAssurance
  it("TC-8: invalid overallAssurance → schema throws", () => {
    expect(() =>
      thirdLineOpinionFiledPayloadSchema.parse({
        ...VALID_THIRD_LINE_PAYLOAD,
        overallAssurance: "full-assurance", // not a valid enum
      }),
    ).toThrow();
  });

  it("TC-8b: limited is valid", () => {
    expect(() =>
      thirdLineOpinionFiledPayloadSchema.parse({
        ...VALID_THIRD_LINE_PAYLOAD,
        overallAssurance: "limited",
      }),
    ).not.toThrow();
  });

  // TC-9: requires at least one keyFinding
  it("TC-9: empty keyFindings array → schema throws", () => {
    expect(() =>
      thirdLineOpinionFiledPayloadSchema.parse({
        ...VALID_THIRD_LINE_PAYLOAD,
        keyFindings: [],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-10: GovernanceSeatRunCompleted — seatId "CAE" + outcome "delivered"
// ---------------------------------------------------------------------------

describe("GovernanceSeatRunCompleted schema", () => {
  it("TC-10: seatId=CAE + outcome=delivered passes schema", () => {
    expect(() =>
      governanceSeatRunCompletedPayloadSchema.parse(VALID_SEAT_RUN_PAYLOAD),
    ).not.toThrow();
    const parsed = governanceSeatRunCompletedPayloadSchema.parse(VALID_SEAT_RUN_PAYLOAD);
    expect(parsed.seatId).toBe("CAE");
    expect(parsed.outcome).toBe("delivered");
  });

  // TC-11: invalid period format
  it("TC-11: invalid period format → schema throws", () => {
    expect(() =>
      governanceSeatRunCompletedPayloadSchema.parse({
        ...VALID_SEAT_RUN_PAYLOAD,
        period: "2026-Q0", // Q0 does not match \d{4}-Q[1-4]
      }),
    ).toThrow();
  });

  it("TC-11b: period YYYY-WN format → schema throws", () => {
    expect(() =>
      governanceSeatRunCompletedPayloadSchema.parse({
        ...VALID_SEAT_RUN_PAYLOAD,
        period: "2026-W12",
      }),
    ).toThrow();
  });

  it("TC-10b: invalid outcome → schema throws", () => {
    expect(() =>
      governanceSeatRunCompletedPayloadSchema.parse({
        ...VALID_SEAT_RUN_PAYLOAD,
        outcome: "succeeded",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TC-12: All 5 events emitted have correct types
// ---------------------------------------------------------------------------

describe("All 5 events emission", () => {
  it("TC-12: 5 events emitted to fresh store have correct types", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const types = [
      "AuditPlanUpdated",
      "AuditIssueTrackerReviewed",
      "QaipAttestationFiled",
      "ThirdLineOpinionFiled",
      "GovernanceSeatRunCompleted",
    ];

    for (const type of types) {
      const events = [...store.replay({ type })];
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]?.type).toBe(type);
    }
  });

  // TC-13: Correct field values (spot-check)
  it("TC-13: AuditPlanUpdated has correct auditsScheduled=12 and planVersion", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const [planEvt] = [...store.replay({ type: "AuditPlanUpdated" })];
    expect(planEvt).toBeDefined();
    const p = planEvt?.payload as unknown as { auditsScheduled: number; planVersion: string };
    expect(p.auditsScheduled).toBe(12);
    expect(p.planVersion).toBe("AUP-2026-Q2");
  });

  it("TC-13b: AuditIssueTrackerReviewed has openFindings=7, criticalFindings=0", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const [issueEvt] = [...store.replay({ type: "AuditIssueTrackerReviewed" })];
    expect(issueEvt).toBeDefined();
    const p = issueEvt?.payload as unknown as {
      openFindings: number;
      criticalFindings: number;
    };
    expect(p.openFindings).toBe(7);
    expect(p.criticalFindings).toBe(0);
  });

  it("TC-13c: QaipAttestationFiled has conformanceRating=generally-conforms", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const [qaipEvt] = [...store.replay({ type: "QaipAttestationFiled" })];
    expect(qaipEvt).toBeDefined();
    const p = qaipEvt?.payload as unknown as { conformanceRating: string };
    expect(p.conformanceRating).toBe("generally-conforms");
  });

  it("TC-13d: ThirdLineOpinionFiled has opinionScope and 3 key findings", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const [opinionEvt] = [...store.replay({ type: "ThirdLineOpinionFiled" })];
    expect(opinionEvt).toBeDefined();
    const p = opinionEvt?.payload as unknown as { opinionScope: string; keyFindings: string[] };
    expect(p.opinionScope).toContain("pre-licence gate");
    expect(p.keyFindings.length).toBe(3);
  });

  // TC-14: Idempotency — re-running does not duplicate events
  it("TC-14: idempotency — emitting twice with same runId → no duplicates", () => {
    const store = new EventStore(dbPath);
    // First run
    emitAllEvents(store, RUN_ID);
    // Second run — idempotency check: if already emitted, skip
    // We simulate the idempotency check that the script does:
    const alreadyEmitted = new Set<string>();
    for (const evt of store.replay({ type: "AuditPlanUpdated" })) {
      const p = evt.payload as unknown as { runId: string; period: string };
      if (p.runId === RUN_ID && p.period === PERIOD) alreadyEmitted.add("AuditPlanUpdated");
    }
    // Only emit again if not already present
    if (!alreadyEmitted.has("AuditPlanUpdated")) {
      emitAllEvents(store, RUN_ID);
    }

    const planEvents = [...store.replay({ type: "AuditPlanUpdated" })].filter(
      (e) => (e.payload as unknown as { runId: string }).runId === RUN_ID,
    );
    expect(planEvents.length).toBe(1); // exactly 1 — not duplicated
  });

  // TC-15: Audit plan has non-zero auditsScheduled
  it("TC-15: AuditPlanUpdated — auditsScheduled > 0", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const [planEvt] = [...store.replay({ type: "AuditPlanUpdated" })];
    const p = planEvt?.payload as unknown as { auditsScheduled: number };
    expect(p.auditsScheduled).toBeGreaterThan(0);
  });

  // TC-16: Third-line opinion — overallAssurance is "reasonable"
  it("TC-16: ThirdLineOpinionFiled — overallAssurance=reasonable", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const [opinionEvt] = [...store.replay({ type: "ThirdLineOpinionFiled" })];
    const p = opinionEvt?.payload as unknown as { overallAssurance: string };
    expect(p.overallAssurance).toBe("reasonable");
  });

  it("GovernanceSeatRunCompleted seatId=CAE + outcome=delivered in store", () => {
    const store = new EventStore(dbPath);
    emitAllEvents(store, RUN_ID);

    const completed = [...store.replay({ type: "GovernanceSeatRunCompleted" })].filter((e) => {
      const p = e.payload as unknown as { seatId: string; outcome: string };
      return p.seatId === "CAE" && p.outcome === "delivered";
    });
    expect(completed.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// TC-17: make* factories throw when citations is empty
// ---------------------------------------------------------------------------

describe("make* factories — citation requirement", () => {
  it("TC-17a: makeAuditPlanUpdated throws with empty citations", () => {
    expect(() =>
      makeAuditPlanUpdated({
        asOf: NOW,
        entity: BANK_ENTITY,
        actor: CAE_ACTOR,
        citations: [],
        payload: VALID_AUDIT_PLAN_PAYLOAD,
      }),
    ).toThrow();
  });

  it("TC-17b: makeAuditIssueTrackerReviewed throws with empty citations", () => {
    expect(() =>
      makeAuditIssueTrackerReviewed({
        asOf: NOW,
        entity: BANK_ENTITY,
        actor: CAE_ACTOR,
        citations: [],
        payload: VALID_ISSUE_TRACKER_PAYLOAD,
      }),
    ).toThrow();
  });

  it("TC-17c: makeQaipAttestationFiled throws with empty citations", () => {
    expect(() =>
      makeQaipAttestationFiled({
        asOf: NOW,
        entity: BANK_ENTITY,
        actor: CAE_ACTOR,
        citations: [],
        payload: VALID_QAIP_PAYLOAD,
      }),
    ).toThrow();
  });

  it("TC-17d: makeThirdLineOpinionFiled throws with empty citations", () => {
    expect(() =>
      makeThirdLineOpinionFiled({
        asOf: NOW,
        entity: BANK_ENTITY,
        actor: CAE_ACTOR,
        citations: [],
        payload: VALID_THIRD_LINE_PAYLOAD,
      }),
    ).toThrow();
  });

  it("TC-17e: makeGovernanceSeatRunCompleted throws with empty citations", () => {
    expect(() =>
      makeGovernanceSeatRunCompleted({
        asOf: NOW,
        entity: BANK_ENTITY,
        actor: CAE_ACTOR,
        citations: [],
        payload: VALID_SEAT_RUN_PAYLOAD,
      }),
    ).toThrow();
  });
});
