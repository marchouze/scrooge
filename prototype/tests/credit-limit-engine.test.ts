// tests/credit-limit-engine.test.ts
//
// WS-CREDIT-LIMIT-ENGINE — Tests for the credit-limit engine substrate.
//
// Coverage:
//   - Projection: lifecycle round-trip (application → analysis → ISDA →
//     proposed → approved → loaded → annual review → breach → disposition).
//   - checkHeadroom: ok-when-headroom; blocks on exhausted; blocks on
//     not-loaded; blocks on stale annual review; subtracts RC events.
//   - detectBreaches: severities at 79% (none), 80% (amber), 100% (red),
//     100%+LEX cap (critical).
//   - checkLargeExposure: within / amber / breach; connected-group
//     aggregation when party-register relationships are present.
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20);
//   Policies/credit-risk-policy-v1.md; Procedures/by-policy/credit-origination.md.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { type Money, minor, money } from "../platform/core/money";
import { BANK_ZA_001, ZAR, newEventId } from "../platform/core/types";
import {
  makeCcrReplacementCostComputed,
  makeLexUtilisationComputed,
} from "../platform/event-store/event-types/counterparty-credit-risk";
import {
  makeCreditAnalysisCompleted,
  makeCreditLimitAnnualReviewCompleted,
  makeCreditLimitApplicationSubmitted,
  makeCreditLimitApproved,
  makeCreditLimitBreachDisposed,
  makeCreditLimitBreached,
  makeCreditLimitLoaded,
  makeCreditLimitProposed,
  makeISDACSAAssessmentCompleted,
} from "../platform/event-store/event-types/credit-limit";
import {
  checkHeadroom,
  checkLargeExposure,
  detectBreaches,
  getCreditLimit,
  getLimitHistory,
  listActiveLimits,
} from "../platform/risk/credit-limit-engine";

const ENTITY = BANK_ZA_001;
const ACTOR = { type: "service" as const, id: "test:credit-limit-engine" };
const CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD"];

// Use unique counterparty IDs per test to avoid cross-pollution in the
// process-singleton event store.
let cpSeq = 0;
function uniqueCp(prefix: string): string {
  cpSeq += 1;
  return `${prefix}-${process.pid}-${cpSeq}`;
}

function ts(year: number, month: number, day: number, hour = 10): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  return `${year}-${m}-${d}T${h}:00:00.000Z`;
}

function zarMoney(rand: number): Money {
  return money(rand, ZAR);
}

// ---------------------------------------------------------------------------
// Fixtures — push a happy-path lifecycle into the store.
// ---------------------------------------------------------------------------

function seedHappyPath(
  counterpartyId: string,
  opts: {
    limitMinor?: number;
    asOf?: string;
    skipLoaded?: boolean;
    expiryDate?: string;
  } = {},
): void {
  const limitMinor = opts.limitMinor ?? 50_000_000_00; // ZAR 50m
  const asOf = opts.asOf ?? ts(2026, 5, 20);
  const applicationId = `CL-APP-${counterpartyId}`;

  eventStore.append(
    makeCreditLimitApplicationSubmitted({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        applicationId,
        counterpartyId,
        requestedLimit: limitMinor,
        currency: "ZAR",
        tenor: "364D",
        productTypes: ["fx-spot", "fx-forward"],
        tradingDesk: "FX-Sales",
        commercialRationale: "Test counterparty.",
        submittedBy: "test:atlas",
        submittedAt: asOf,
      },
      eventId: newEventId(),
    }),
  );
  eventStore.append(
    makeCreditAnalysisCompleted({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        applicationId,
        counterpartyId,
        externalRating: "BBB+",
        internalRating: "IG-3",
        capitalAdequacyRatio: 15.4,
        liquidityRatio: 142.0,
        concentrationFlags: [],
        analystRef: "test:helena",
        completedAt: asOf,
      },
      eventId: newEventId(),
    }),
  );
  eventStore.append(
    makeISDACSAAssessmentCompleted({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId,
        isdaStatus: "executed",
        csaThreshold: 10_000_000_00,
        mta: 1_000_000_00,
        currency: "ZAR",
        nettingEnforceable: true,
        jurisdictionOpinionRef: "DOC-ISDA-OP-ZA-TEST",
        assessedBy: "test:imani",
        assessedAt: asOf,
      },
      eventId: newEventId(),
    }),
  );
  eventStore.append(
    makeCreditLimitProposed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        applicationId,
        counterpartyId,
        proposedLimit: limitMinor,
        currency: "ZAR",
        basis: "sa-ccr-derived",
        largeExposurePct: 12.5,
        rasHeadroomPct: 7.5,
        conditions: ["ISDA-execution-prerequisite"],
        proposedBy: "test:helena",
        proposedAt: asOf,
      },
      eventId: newEventId(),
    }),
  );
  eventStore.append(
    makeCreditLimitApproved({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        applicationId,
        counterpartyId,
        limit: limitMinor,
        currency: "ZAR",
        tenor: "364D",
        approvedBy: "test:helena",
        approvalAuthority: "CRC",
        approvedAt: asOf,
        conditions: ["ISDA-execution-prerequisite"],
        expiryDate: opts.expiryDate ?? "2099-12-31",
      },
      eventId: newEventId(),
    }),
  );
  if (!opts.skipLoaded) {
    eventStore.append(
      makeCreditLimitLoaded({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId,
          limit: limitMinor,
          currency: "ZAR",
          loadedAt: asOf,
          effectiveFrom: asOf,
          loadedBy: "test:atlas",
        },
        eventId: newEventId(),
      }),
    );
  }
}

function seedRcEvent(opts: {
  counterpartyId: string;
  nettingSetId?: string;
  rc: number; // minor units
  asOf?: string;
  computationDate?: string;
}): void {
  eventStore.append(
    makeCcrReplacementCostComputed({
      asOf: opts.asOf ?? ts(2026, 5, 20),
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        nettingSetId: opts.nettingSetId ?? `NS-${opts.counterpartyId}-ZAR`,
        counterpartyId: opts.counterpartyId,
        rc: opts.rc,
        currency: "ZAR",
        computationDate: opts.computationDate ?? "2026-05-20",
        methodology: "sa-ccr",
        vMtm: opts.rc,
        collateralHeld: 0,
      },
      eventId: newEventId(),
    }),
  );
}

function seedLexUtil(opts: {
  counterpartyId: string;
  utilisationPct: number;
  asOf?: string;
}): void {
  const asOf = opts.asOf ?? ts(2026, 5, 20);
  eventStore.append(
    makeLexUtilisationComputed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: opts.counterpartyId,
        totalExposure: 100_000_000_00,
        eligibleCapital: 1_000_000_000_00,
        currency: "ZAR",
        utilisationPct: opts.utilisationPct,
        computedAt: asOf,
      },
      eventId: newEventId(),
    }),
  );
}

// ---------------------------------------------------------------------------
// Projection tests
// ---------------------------------------------------------------------------

describe("credit-limit-engine projection", () => {
  it("folds the happy-path lifecycle to status='loaded' with the approved cap", () => {
    const cp = uniqueCp("CP-PROJ-HAPPY");
    seedHappyPath(cp);
    const limit = getCreditLimit(cp);
    expect(limit).not.toBeNull();
    if (!limit) throw new Error("limit must be present");
    expect(limit.counterpartyId).toBe(cp);
    expect(limit.status).toBe("loaded");
    expect(limit.limit.amount).toBe(BigInt(50_000_000_00));
    expect(String(limit.limit.currency)).toBe("ZAR");
    expect(limit.tenor).toBe("364D");
    expect(limit.approvalAuthority).toBe("CRC");
    expect(limit.conditions).toContain("ISDA-execution-prerequisite");
    expect(limit.approvedAt).toBeDefined();
    expect(limit.loadedAt).toBeDefined();
  });

  it("returns null for an unknown counterparty", () => {
    expect(getCreditLimit(uniqueCp("CP-UNKNOWN"))).toBeNull();
  });

  it("annual review updates limit + lastReviewDate; preserves loaded status", () => {
    const cp = uniqueCp("CP-PROJ-ANNUAL");
    seedHappyPath(cp);
    const reviewAt = ts(2026, 5, 21);
    eventStore.append(
      makeCreditLimitAnnualReviewCompleted({
        asOf: reviewAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cp,
          reviewYear: 2026,
          revisedLimit: 60_000_000_00,
          currency: "ZAR",
          rationale: "fundamentals improved",
          reviewedBy: "test:helena",
          reviewedAt: reviewAt,
        },
        eventId: newEventId(),
      }),
    );
    const limit = getCreditLimit(cp);
    if (!limit) throw new Error("limit must be present");
    expect(limit.status).toBe("loaded");
    expect(limit.limit.amount).toBe(BigInt(60_000_000_00));
    expect(limit.lastReviewDate).toBe(reviewAt);
  });

  it("breach → loaded round-trip on standard disposition", () => {
    const cp = uniqueCp("CP-PROJ-BREACH");
    seedHappyPath(cp);
    const breachAt = ts(2026, 5, 22);
    eventStore.append(
      makeCreditLimitBreached({
        asOf: breachAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cp,
          breachId: `CL-BREACH-${cp}-001`,
          exposure: 55_000_000_00,
          limit: 50_000_000_00,
          currency: "ZAR",
          severity: "red",
          detectedAt: breachAt,
        },
        eventId: newEventId(),
      }),
    );
    expect(getCreditLimit(cp)?.status).toBe("breached");
    const disposeAt = ts(2026, 5, 23);
    eventStore.append(
      makeCreditLimitBreachDisposed({
        asOf: disposeAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cp,
          breachId: `CL-BREACH-${cp}-001`,
          dispositionType: "unwound",
          approvedBy: "test:helena",
          remediationDeadline: disposeAt,
          disposedAt: disposeAt,
        },
        eventId: newEventId(),
      }),
    );
    expect(getCreditLimit(cp)?.status).toBe("loaded");
  });

  it("critical breach + accepted disposition stays 'breached'", () => {
    const cp = uniqueCp("CP-PROJ-STICKY");
    seedHappyPath(cp);
    const breachAt = ts(2026, 5, 22);
    eventStore.append(
      makeCreditLimitBreached({
        asOf: breachAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cp,
          breachId: `CL-BREACH-${cp}-002`,
          exposure: 60_000_000_00,
          limit: 50_000_000_00,
          currency: "ZAR",
          severity: "critical",
          detectedAt: breachAt,
        },
        eventId: newEventId(),
      }),
    );
    const disposeAt = ts(2026, 5, 23);
    eventStore.append(
      makeCreditLimitBreachDisposed({
        asOf: disposeAt,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cp,
          breachId: `CL-BREACH-${cp}-002`,
          dispositionType: "accepted",
          approvedBy: "test:helena",
          remediationDeadline: disposeAt,
          disposedAt: disposeAt,
        },
        eventId: newEventId(),
      }),
    );
    expect(getCreditLimit(cp)?.status).toBe("breached");
  });

  it("expired limit is reported as 'expired'", () => {
    const cp = uniqueCp("CP-PROJ-EXPIRED");
    seedHappyPath(cp, { expiryDate: "2025-01-01" });
    const limit = getCreditLimit(cp, ts(2026, 5, 20));
    if (!limit) throw new Error("limit must be present");
    expect(limit.status).toBe("expired");
  });

  it("listActiveLimits includes the seeded counterparty", () => {
    const cp = uniqueCp("CP-PROJ-LIST");
    seedHappyPath(cp);
    const all = listActiveLimits();
    expect(all.find((l) => l.counterpartyId === cp)).toBeDefined();
  });

  it("getLimitHistory returns events in chronological order", () => {
    const cp = uniqueCp("CP-PROJ-HIST");
    seedHappyPath(cp);
    const history = getLimitHistory(cp);
    expect(history.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < history.length; i += 1) {
      const a = history[i - 1];
      const b = history[i];
      if (!a || !b) throw new Error("history rows must be present");
      expect(a.as_of <= b.as_of).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// checkHeadroom tests
// ---------------------------------------------------------------------------

describe("checkHeadroom", () => {
  it("ok when headroom available, no RC events", () => {
    const cp = uniqueCp("CP-HR-OK");
    seedHappyPath(cp);
    const result = checkHeadroom(cp, zarMoney(1_000_000), ts(2026, 5, 20));
    expect(result.ok).toBe(true);
    expect(result.blockReason).toBeUndefined();
    expect(result.traffic).toBe("green");
    expect(result.limit.amount).toBe(BigInt(50_000_000_00));
  });

  it("subtracts the latest RC event from headroom", () => {
    const cp = uniqueCp("CP-HR-RC");
    seedHappyPath(cp);
    // Existing RC of ZAR 20m → proposed ZAR 5m → utilisation 25/50 = 50%.
    seedRcEvent({ counterpartyId: cp, rc: 20_000_000_00 });
    const result = checkHeadroom(cp, zarMoney(5_000_000), ts(2026, 5, 20));
    expect(result.ok).toBe(true);
    expect(result.utilisationPct).toBeCloseTo(50.0, 1);
    expect(result.currentExposure.amount).toBe(BigInt(20_000_000_00));
  });

  it("blocks when proposed + current exposure exhausts the limit", () => {
    const cp = uniqueCp("CP-HR-EXHAUST");
    seedHappyPath(cp);
    seedRcEvent({ counterpartyId: cp, rc: 49_000_000_00 });
    const result = checkHeadroom(cp, zarMoney(2_000_000), ts(2026, 5, 20));
    expect(result.ok).toBe(false);
    expect(result.blockReason).toBe("CreditLimitExhausted");
    expect(
      result.traffic === "red" || result.traffic === "amber" || result.traffic === "critical",
    ).toBe(true);
  });

  it("blocks when limit is not loaded", () => {
    const cp = uniqueCp("CP-HR-UNLOADED");
    seedHappyPath(cp, { skipLoaded: true });
    const result = checkHeadroom(cp, zarMoney(1_000_000), ts(2026, 5, 20));
    expect(result.ok).toBe(false);
    expect(result.blockReason).toBe("CounterpartyNotApproved");
  });

  it("blocks unknown counterparty as CounterpartyNotApproved", () => {
    const result = checkHeadroom(uniqueCp("CP-HR-MISSING"), zarMoney(1_000_000));
    expect(result.ok).toBe(false);
    expect(result.blockReason).toBe("CounterpartyNotApproved");
  });

  it("blocks on stale annual review (> 13 months)", () => {
    const cp = uniqueCp("CP-HR-STALE");
    // Seed with an asOf well in the past so the review window is exceeded.
    seedHappyPath(cp, { asOf: ts(2024, 1, 1), expiryDate: "2099-12-31" });
    const result = checkHeadroom(cp, zarMoney(1_000_000), ts(2026, 5, 20));
    expect(result.ok).toBe(false);
    expect(result.blockReason).toBe("AnnualReviewStale");
  });

  it("blocks an expired limit", () => {
    const cp = uniqueCp("CP-HR-EXPIRED");
    seedHappyPath(cp, { expiryDate: "2025-01-01" });
    const result = checkHeadroom(cp, zarMoney(1_000_000), ts(2026, 5, 20));
    expect(result.ok).toBe(false);
    expect(result.blockReason).toBe("LimitExpired");
  });
});

// ---------------------------------------------------------------------------
// detectBreaches tests
// ---------------------------------------------------------------------------

describe("detectBreaches", () => {
  it("returns no breach at 79% utilisation", () => {
    const cp = uniqueCp("CP-BR-79");
    seedHappyPath(cp);
    seedRcEvent({ counterpartyId: cp, rc: 39_500_000_00 }); // 79%
    const { newBreaches } = detectBreaches(ts(2026, 5, 20));
    expect(newBreaches.find((b) => b.counterpartyId === cp)).toBeUndefined();
  });

  it("returns amber at 80% utilisation", () => {
    const cp = uniqueCp("CP-BR-80");
    seedHappyPath(cp);
    seedRcEvent({ counterpartyId: cp, rc: 40_000_000_00 }); // 80%
    const { newBreaches } = detectBreaches(ts(2026, 5, 20));
    const breach = newBreaches.find((b) => b.counterpartyId === cp);
    expect(breach).toBeDefined();
    expect(breach?.severity).toBe("amber");
  });

  it("returns red at 100% utilisation with no LEX cap breach", () => {
    const cp = uniqueCp("CP-BR-100");
    seedHappyPath(cp);
    seedRcEvent({ counterpartyId: cp, rc: 50_000_000_00 }); // 100%
    const { newBreaches } = detectBreaches(ts(2026, 5, 20));
    const breach = newBreaches.find((b) => b.counterpartyId === cp);
    expect(breach).toBeDefined();
    expect(breach?.severity).toBe("red");
  });

  it("returns critical at 100% + LEX cap breach", () => {
    const cp = uniqueCp("CP-BR-CRIT");
    seedHappyPath(cp);
    seedRcEvent({ counterpartyId: cp, rc: 55_000_000_00 }); // 110%
    seedLexUtil({ counterpartyId: cp, utilisationPct: 30 }); // > 25
    const { newBreaches } = detectBreaches(ts(2026, 5, 20));
    const breach = newBreaches.find((b) => b.counterpartyId === cp);
    expect(breach).toBeDefined();
    expect(breach?.severity).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// checkLargeExposure tests
// ---------------------------------------------------------------------------

describe("checkLargeExposure", () => {
  it("within when exposure ≤ 20% of eligible capital", () => {
    const cp = uniqueCp("CP-LEX-WITHIN");
    seedHappyPath(cp);
    // ZAR 1bn eligible capital, ZAR 100m exposure = 10%.
    seedRcEvent({ counterpartyId: cp, rc: 100_000_000_00 });
    const eligibleCapital: Money = minor(BigInt(1_000_000_000_00), ZAR);
    const result = checkLargeExposure(cp, eligibleCapital, ts(2026, 5, 20));
    expect(result.status).toBe("within");
    expect(result.utilisationPct).toBeCloseTo(10, 1);
    expect(result.capPct).toBe(25);
  });

  it("amber when 20% < utilisation ≤ 25%", () => {
    const cp = uniqueCp("CP-LEX-AMBER");
    seedHappyPath(cp, { limitMinor: 300_000_000_00 });
    seedRcEvent({ counterpartyId: cp, rc: 230_000_000_00 });
    const eligibleCapital: Money = minor(BigInt(1_000_000_000_00), ZAR);
    const result = checkLargeExposure(cp, eligibleCapital, ts(2026, 5, 20));
    expect(result.status).toBe("amber");
    expect(result.utilisationPct).toBeGreaterThan(20);
    expect(result.utilisationPct).toBeLessThanOrEqual(25);
  });

  it("breach when utilisation > 25%", () => {
    const cp = uniqueCp("CP-LEX-BREACH");
    seedHappyPath(cp, { limitMinor: 500_000_000_00 });
    seedRcEvent({ counterpartyId: cp, rc: 300_000_000_00 });
    const eligibleCapital: Money = minor(BigInt(1_000_000_000_00), ZAR);
    const result = checkLargeExposure(cp, eligibleCapital, ts(2026, 5, 20));
    expect(result.status).toBe("breach");
    expect(result.utilisationPct).toBeGreaterThan(25);
  });

  it("aggregates exposure across a connected group", () => {
    // Use valid party-register URNs so the PartyRelationshipAsserted
    // payload schema accepts the append.
    const parent = `urn:party:legal-entity:lex-parent-${process.pid}-${++cpSeq}`;
    const sub = `urn:party:legal-entity:lex-sub-${process.pid}-${++cpSeq}`;
    seedHappyPath(parent);
    seedHappyPath(sub);
    seedRcEvent({ counterpartyId: parent, rc: 80_000_000_00 });
    seedRcEvent({ counterpartyId: sub, rc: 70_000_000_00 });
    // Emit a parent-of relationship so the connected-group resolver picks
    // up both members. We construct the raw event envelope — the registry's
    // payload schema enforces the canonical `kind` field name and URN
    // shapes for `fromPartyId` / `toPartyId`.
    eventStore.append({
      event_id: newEventId(),
      type: "PartyRelationshipAsserted",
      as_of: ts(2026, 5, 19),
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        relationshipId: `rel-${process.pid}-${cpSeq}`,
        fromPartyId: parent,
        toPartyId: sub,
        kind: "parent-of",
        scopeJson: {},
        effectiveFrom: ts(2026, 5, 19),
        citations: CITATIONS,
      },
    });
    const eligibleCapital: Money = minor(BigInt(1_000_000_000_00), ZAR);
    const result = checkLargeExposure(parent, eligibleCapital, ts(2026, 5, 20));
    // Aggregate exposure should be 150m → 15% within.
    expect(result.exposure.amount).toBe(BigInt(150_000_000_00));
    expect(result.utilisationPct).toBeCloseTo(15, 1);
    expect(result.status).toBe("within");
  });
});
