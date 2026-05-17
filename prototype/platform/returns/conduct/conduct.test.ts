// platform/returns/conduct/conduct.test.ts
//
// M3 Slice 9 — Unit tests for the conduct events reporting module.
//
// Authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Asserts:
//   1. All numeric metric cells are non-NaN for empty event store.
//   2. `status === "rehearsal"` for empty event store.
//   3. Non-regulated entity is silently skipped.
//   4. TCF outcome breakdown sums to `totalComplaints`.
//   5. `averageResolutionDays` is 0 (not NaN) when no resolved complaints.
//   6. ConductComplaintFiled events are counted as complaints.
//   7. ConductComplaintResolved updates complaint status + resolution days.
//   8. Resolved-within-5-days counter works correctly.
//   9. Escalated complaints are counted.
//  10. ConductIncidentLogged events populate incidents.
//  11. High-severity incidents are counted separately.
//  12. BestExecutionAnalysisCompleted events populate the summary.
//  13. Best-execution breach verdict fires when breaches exist.
//  14. Events outside the period window are excluded.
//  15. Subscriber wires AccountingPeriodClosed → generator correctly.
//  16. Factory functions produce valid events accepted by the EventStore.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../../core/types";
import {
  makeBestExecutionAnalysisCompleted,
  makeConductComplaintFiled,
  makeConductComplaintResolved,
  makeConductDisclosureEmitted,
  makeConductIncidentLogged,
} from "../../event-store/event-types/conduct";
import { EventStore } from "../../event-store/store";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { generateConductDisclosure } from "./generator";
import { conductPeriodCloseSubscriber } from "./period-close-subscriber";
import type { ConductPeriodMetrics, TCFOutcome } from "./types";
import { CONDUCT_REGULATED_ENTITIES } from "./types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ACTOR = { type: "service" as const, id: "agent:Mira" };

const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-06-01T00:00:00.000Z";

const CLOSED_PAYLOAD = {
  periodId: "period:hoz-bank:month:2026-05",
  closedAt: PERIOD_END,
  trialBalanceSnapshotEventId: newEventId(),
  uptoSequence: 0,
};

const CITATIONS = ["D-MARKET-CONDUCT", "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"];

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Store builder helpers
// ---------------------------------------------------------------------------

function emptyStore(): EventStore {
  return new EventStore(":memory:");
}

function storeWithComplaints(count: number, tcfOutcome: TCFOutcome = 1): EventStore {
  const store = new EventStore(":memory:");
  for (let i = 0; i < count; i++) {
    store.append(
      makeConductComplaintFiled({
        asOf: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          complaintId: `COMP-2026-05-${String(i + 1).padStart(3, "0")}`,
          receivedAt: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
          counterpartyId: `cp-${i + 1}`,
          category: "best-execution",
          tcfOutcome,
        },
      }),
    );
  }
  return store;
}

function storeWithResolvedComplaint(resolutionDays: number, escalated = false): EventStore {
  const store = new EventStore(":memory:");
  const complaintId = "COMP-2026-05-001";
  store.append(
    makeConductComplaintFiled({
      asOf: "2026-05-10T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        complaintId,
        receivedAt: "2026-05-10T10:00:00.000Z",
        counterpartyId: "cp-001",
        category: "disclosure",
        tcfOutcome: 3,
      },
    }),
  );
  store.append(
    makeConductComplaintResolved({
      asOf: "2026-05-15T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        complaintId,
        resolvedAt: "2026-05-15T10:00:00.000Z",
        resolution: "upheld",
        resolutionDays,
        escalated,
        tcfOutcome: 3,
      },
    }),
  );
  return store;
}

function storeWithIncidents(
  count: number,
  severity: "low" | "medium" | "high" | "critical" = "low",
): EventStore {
  const store = new EventStore(":memory:");
  for (let i = 0; i < count; i++) {
    store.append(
      makeConductIncidentLogged({
        asOf: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          incidentId: `INC-2026-05-${String(i + 1).padStart(3, "0")}`,
          occurredAt: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
          category: "front-running",
          severity,
          tcfOutcome: 1,
          regulatoryNotificationFiled: severity === "critical",
        },
      }),
    );
  }
  return store;
}

function storeWithBestExecution(
  tradesReviewed: number,
  breachCount: number,
): EventStore {
  const store = new EventStore(":memory:");
  store.append(
    makeBestExecutionAnalysisCompleted({
      asOf: "2026-05-31T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        analysisId: "BEA-2026-05-LE-ZA-HOZ-BANK",
        period: "2026-05",
        completedAt: "2026-05-31T10:00:00.000Z",
        verdict: breachCount > 0 ? "breach" : "compliant",
        tradesReviewed,
        breachCount,
        breachRatePct: tradesReviewed > 0 ? (breachCount / tradesReviewed) * 100 : 0,
        venuesCovered: ["JSE", "OTC-bilateral"],
        assetClassesCovered: ["ZA-GOV-BOND", "JSE-EQUITY"],
        remedialActions: breachCount > 0 ? ["review-execution-policy"] : [],
      },
    }),
  );
  return store;
}

// ---------------------------------------------------------------------------
// Helper: assert numeric cell safety
// ---------------------------------------------------------------------------

function assertMetricsNonNaN(metrics: ConductPeriodMetrics): void {
  expect(Number.isNaN(metrics.totalComplaints)).toBe(false);
  expect(Number.isNaN(metrics.resolvedComplaints)).toBe(false);
  expect(Number.isNaN(metrics.resolvedWithin5Days)).toBe(false);
  expect(Number.isNaN(metrics.averageResolutionDays)).toBe(false);
  expect(Number.isNaN(metrics.escalatedCount)).toBe(false);
  expect(Number.isNaN(metrics.totalIncidents)).toBe(false);
  expect(Number.isNaN(metrics.highSeverityIncidents)).toBe(false);
  expect(Number.isNaN(metrics.regulatoryNotificationsCount)).toBe(false);
  expect(Number.isNaN(metrics.bestExecution.tradesReviewed)).toBe(false);
  expect(Number.isNaN(metrics.bestExecution.breachCount)).toBe(false);
  expect(Number.isNaN(metrics.bestExecution.aggregateBreachRatePct)).toBe(false);

  const outcomes: TCFOutcome[] = [1, 2, 3, 4, 5, 6];
  for (const o of outcomes) {
    expect(Number.isNaN(metrics.tcfOutcomeBreakdown[o])).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// 1. All numeric cells non-NaN (empty store)
// ---------------------------------------------------------------------------

describe("Conduct generator — numeric cell safety", () => {
  it("produces non-NaN numeric cells from empty event store", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: emptyStore(),
      periodStart: PERIOD_START,
    });
    assertMetricsNonNaN(disclosure.metrics);
  });

  it("produces non-NaN numeric cells when events exist", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithComplaints(3),
      periodStart: PERIOD_START,
    });
    assertMetricsNonNaN(disclosure.metrics);
  });
});

// ---------------------------------------------------------------------------
// 2. status === "rehearsal" for empty event store
// ---------------------------------------------------------------------------

describe("Conduct generator — rehearsal status", () => {
  it("returns status='rehearsal' for empty event store", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: emptyStore(),
      periodStart: PERIOD_START,
    });
    expect(disclosure.status).toBe("rehearsal");
  });

  it("returns status='rehearsal' even with live conduct events (no thresholds configured yet)", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithComplaints(2),
      periodStart: PERIOD_START,
    });
    expect(disclosure.status).toBe("rehearsal");
  });
});

// ---------------------------------------------------------------------------
// 3. Non-regulated entity is silently skipped
// ---------------------------------------------------------------------------

describe("Conduct subscriber — entity guard", () => {
  it("skips LE-ZA-HOZ-SECURITIES (not conduct-regulated)", () => {
    const result = conductPeriodCloseSubscriber({
      closedPayload: CLOSED_PAYLOAD,
      entity: ENTITY_SECURITIES,
      eventStore: emptyStore(),
      actor: ACTOR,
      periodStart: PERIOD_START,
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("not in CONDUCT_REGULATED_ENTITIES");
  });

  it("does not skip LE-ZA-HOZ-BANK", () => {
    const result = conductPeriodCloseSubscriber({
      closedPayload: CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: emptyStore(),
      actor: ACTOR,
      periodStart: PERIOD_START,
    });
    expect(result.skipped).toBe(false);
  });

  it("CONDUCT_REGULATED_ENTITIES contains LE-ZA-HOZ-BANK", () => {
    expect(CONDUCT_REGULATED_ENTITIES).toContain(ENTITY_BANK);
  });
});

// ---------------------------------------------------------------------------
// 4. TCF outcome breakdown sums to totalComplaints
// ---------------------------------------------------------------------------

describe("Conduct generator — TCF outcome breakdown invariant", () => {
  it("breakdown sums to 0 for empty store", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: emptyStore(),
      periodStart: PERIOD_START,
    });
    const sum = (Object.values(disclosure.metrics.tcfOutcomeBreakdown) as number[]).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(0);
    expect(sum).toBe(disclosure.metrics.totalComplaints);
  });

  it("breakdown sums to totalComplaints when complaints exist", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithComplaints(4, 2),
      periodStart: PERIOD_START,
    });
    const sum = (Object.values(disclosure.metrics.tcfOutcomeBreakdown) as number[]).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(disclosure.metrics.totalComplaints);
    expect(disclosure.metrics.tcfOutcomeBreakdown[2]).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 5. averageResolutionDays is 0 (not NaN) when no resolved complaints
// ---------------------------------------------------------------------------

describe("Conduct generator — averageResolutionDays safety", () => {
  it("averageResolutionDays is 0 (not NaN) when no resolved complaints", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithComplaints(3),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.averageResolutionDays).toBe(0);
    expect(Number.isNaN(disclosure.metrics.averageResolutionDays)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. ConductComplaintFiled events are counted
// ---------------------------------------------------------------------------

describe("Conduct generator — ConductComplaintFiled", () => {
  it("counts 5 filed complaints", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithComplaints(5),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.totalComplaints).toBe(5);
    expect(disclosure.complaints).toHaveLength(5);
  });

  it("complaints start as 'open'", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithComplaints(2),
      periodStart: PERIOD_START,
    });
    for (const c of disclosure.complaints) {
      expect(c.status).toBe("open");
    }
  });
});

// ---------------------------------------------------------------------------
// 7. ConductComplaintResolved updates complaint status
// ---------------------------------------------------------------------------

describe("Conduct generator — ConductComplaintResolved", () => {
  it("updates complaint status to 'resolved' when resolved within period", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithResolvedComplaint(4),
      periodStart: PERIOD_START,
    });
    expect(disclosure.complaints).toHaveLength(1);
    expect(disclosure.complaints[0].status).toBe("resolved");
    expect(disclosure.complaints[0].resolutionDays).toBe(4);
    expect(disclosure.metrics.resolvedComplaints).toBe(1);
  });

  it("updates complaint status to 'escalated' when escalated flag is true", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithResolvedComplaint(3, true),
      periodStart: PERIOD_START,
    });
    expect(disclosure.complaints[0].status).toBe("escalated");
    expect(disclosure.complaints[0].escalated).toBe(true);
    expect(disclosure.metrics.escalatedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 8. Resolved-within-5-days counter
// ---------------------------------------------------------------------------

describe("Conduct generator — resolvedWithin5Days", () => {
  it("counts resolution of 4 days as within-5-days", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithResolvedComplaint(4),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.resolvedWithin5Days).toBe(1);
  });

  it("counts resolution of 5 days as within-5-days", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithResolvedComplaint(5),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.resolvedWithin5Days).toBe(1);
  });

  it("does not count resolution of 6 days as within-5-days", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithResolvedComplaint(6),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.resolvedWithin5Days).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 10. ConductIncidentLogged events
// ---------------------------------------------------------------------------

describe("Conduct generator — ConductIncidentLogged", () => {
  it("counts 3 low-severity incidents", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithIncidents(3, "low"),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.totalIncidents).toBe(3);
    expect(disclosure.incidents).toHaveLength(3);
    expect(disclosure.metrics.highSeverityIncidents).toBe(0);
  });

  it("counts high-severity incidents separately", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithIncidents(2, "high"),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.highSeverityIncidents).toBe(2);
  });

  it("counts critical-severity incidents as high-severity", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithIncidents(1, "critical"),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.highSeverityIncidents).toBe(1);
    expect(disclosure.metrics.regulatoryNotificationsCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 12. BestExecutionAnalysisCompleted events
// ---------------------------------------------------------------------------

describe("Conduct generator — BestExecutionAnalysisCompleted", () => {
  it("no-analysis verdict is 'not-applicable' for empty store", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: emptyStore(),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.bestExecution.verdict).toBe("not-applicable");
    expect(disclosure.metrics.bestExecution.analysisCount).toBe(0);
  });

  it("compliant verdict when no breaches", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithBestExecution(100, 0),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.bestExecution.verdict).toBe("compliant");
    expect(disclosure.metrics.bestExecution.tradesReviewed).toBe(100);
    expect(disclosure.metrics.bestExecution.breachCount).toBe(0);
    expect(disclosure.metrics.bestExecution.aggregateBreachRatePct).toBe(0);
  });

  it("breach verdict and correct breach rate when breaches exist", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithBestExecution(100, 5),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.bestExecution.verdict).toBe("breach");
    expect(disclosure.metrics.bestExecution.breachCount).toBe(5);
    expect(disclosure.metrics.bestExecution.aggregateBreachRatePct).toBe(5);
  });

  it("populates asset classes and venues from analysis events", () => {
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: storeWithBestExecution(50, 0),
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.bestExecution.assetClassesCovered).toContain("ZA-GOV-BOND");
    expect(disclosure.metrics.bestExecution.venuesCovered).toContain("JSE");
  });
});

// ---------------------------------------------------------------------------
// 14. Events outside the period window are excluded
// ---------------------------------------------------------------------------

describe("Conduct generator — period window filtering", () => {
  it("excludes ConductComplaintFiled events before period start", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeConductComplaintFiled({
        asOf: "2026-04-15T10:00:00.000Z", // before PERIOD_START
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          complaintId: "COMP-OLD-001",
          receivedAt: "2026-04-15T10:00:00.000Z",
          counterpartyId: "cp-old",
          category: "disclosure",
          tcfOutcome: 1,
        },
      }),
    );
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.totalComplaints).toBe(0);
  });

  it("excludes ConductIncidentLogged events after period end", () => {
    const store = new EventStore(":memory:");
    store.append(
      makeConductIncidentLogged({
        asOf: "2026-07-01T10:00:00.000Z", // after PERIOD_END
        entity: ENTITY_BANK,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          incidentId: "INC-FUTURE-001",
          occurredAt: "2026-07-01T10:00:00.000Z",
          category: "front-running",
          severity: "high",
          tcfOutcome: 1,
          regulatoryNotificationFiled: false,
        },
      }),
    );
    const { disclosure } = generateConductDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.totalIncidents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 15. Subscriber wires period-close → generator
// ---------------------------------------------------------------------------

describe("Conduct subscriber — period-close integration", () => {
  it("produces disclosure from subscriber on period close (bank entity)", () => {
    const store = storeWithComplaints(2);
    const result = conductPeriodCloseSubscriber({
      closedPayload: CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
      periodLabel: "2026-05",
    });
    expect(result.skipped).toBe(false);
    expect(result.disclosure).toBeDefined();
    expect(result.disclosure.entityId).toBe(ENTITY_BANK);
    expect(result.disclosure.reportingDate).toBe(PERIOD_END);
    expect(result.disclosure.metrics.period).toBe("2026-05");
    expect(result.disclosure.status).toBe("rehearsal");
    expect(result.disclosure.metrics.totalComplaints).toBe(2);
  });

  it("subscriber skips non-regulated entity and returns typed disclosure", () => {
    const result = conductPeriodCloseSubscriber({
      closedPayload: CLOSED_PAYLOAD,
      entity: ENTITY_SECURITIES,
      eventStore: emptyStore(),
      actor: ACTOR,
      periodStart: PERIOD_START,
    });
    expect(result.skipped).toBe(true);
    expect(result.disclosure).toBeDefined();
    expect(result.disclosure.metrics.totalComplaints).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 16. Factory functions produce valid events accepted by the EventStore
// ---------------------------------------------------------------------------

describe("Conduct event factory functions — EventStore integration", () => {
  it("makeConductComplaintFiled appends without error", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      store.append(
        makeConductComplaintFiled({
          asOf: "2026-05-10T10:00:00.000Z",
          entity: ENTITY_BANK,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            complaintId: "COMP-2026-05-001",
            receivedAt: "2026-05-10T10:00:00.000Z",
            counterpartyId: "cp-001",
            category: "best-execution",
            tcfOutcome: 2,
          },
        }),
      ),
    ).not.toThrow();
  });

  it("makeConductComplaintResolved appends without error", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      store.append(
        makeConductComplaintResolved({
          asOf: "2026-05-15T10:00:00.000Z",
          entity: ENTITY_BANK,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            complaintId: "COMP-2026-05-001",
            resolvedAt: "2026-05-15T10:00:00.000Z",
            resolution: "upheld",
            resolutionDays: 5,
            escalated: false,
            tcfOutcome: 2,
          },
        }),
      ),
    ).not.toThrow();
  });

  it("makeConductIncidentLogged appends without error", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      store.append(
        makeConductIncidentLogged({
          asOf: "2026-05-12T10:00:00.000Z",
          entity: ENTITY_BANK,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            incidentId: "INC-2026-05-001",
            occurredAt: "2026-05-12T10:00:00.000Z",
            category: "conflict-not-declared",
            severity: "medium",
            tcfOutcome: 1,
            regulatoryNotificationFiled: false,
          },
        }),
      ),
    ).not.toThrow();
  });

  it("makeBestExecutionAnalysisCompleted appends without error", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      store.append(
        makeBestExecutionAnalysisCompleted({
          asOf: "2026-05-31T10:00:00.000Z",
          entity: ENTITY_BANK,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            analysisId: "BEA-2026-05-LE-ZA-HOZ-BANK",
            period: "2026-05",
            completedAt: "2026-05-31T10:00:00.000Z",
            verdict: "compliant",
            tradesReviewed: 500,
            breachCount: 0,
            breachRatePct: 0,
            venuesCovered: ["JSE"],
            assetClassesCovered: ["ZA-GOV-BOND"],
            remedialActions: [],
          },
        }),
      ),
    ).not.toThrow();
  });

  it("makeConductDisclosureEmitted appends without error", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      store.append(
        makeConductDisclosureEmitted({
          asOf: "2026-06-01T10:00:00.000Z",
          entity: ENTITY_BANK,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            disclosureId: "CD-2026-05-LE-ZA-HOZ-BANK",
            period: "2026-05",
            emittedAt: "2026-06-01T10:00:00.000Z",
            entityId: ENTITY_BANK,
            framework: "FSCA-CMS",
            status: "rehearsal",
            totalComplaints: 0,
            totalIncidents: 0,
            bestExecutionBreaches: 0,
          },
        }),
      ),
    ).not.toThrow();
  });
});
