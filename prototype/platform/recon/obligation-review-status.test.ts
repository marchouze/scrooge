// platform/recon/obligation-review-status.test.ts
//
// Tests for the authored-summary coverage fold added in P4
// (D-OBLIGATIONS-REGISTER-CLEANUP). The queue-depth path is exercised by the
// existing recon chain; these tests pin the per-domain coverage computation.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, test } from "bun:test";

import { makeObligationAdopted } from "../event-store/event-types/obligation-lifecycle";
import { makeObligationReviewCompleted } from "../event-store/event-types/obligation-review";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { computeSummaryCoverage } from "./obligation-review-status";

const ACTOR: Actor = { type: "service", id: "agent:mira:test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-OBLIGATIONS-REGISTER-CLEANUP"];

function adopt(id: string, domain: string, urn: string, asOf: string) {
  return makeObligationAdopted({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: {
      obligationId: id,
      urn,
      domain,
      citation: "Banks Act s.70",
      requirement: `${id} requirement`,
      fulfilmentPolicy: "Policy",
      owner: "cfo",
      status: "active",
      adoptedAt: asOf,
    },
  });
}

function review(urn: string, status: "reviewed-confirmed" | "reviewed-modified", asOf: string) {
  return makeObligationReviewCompleted({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: {
      obligationUrn: urn,
      newStatus: status,
      reviewerAgentName: "Mira",
      reviewerSeat: "cfo",
      rationale: "test",
      ...(status === "reviewed-modified" ? { modifications: { requirement: "rewritten" } } : {}),
    },
  });
}

describe("computeSummaryCoverage", () => {
  test("counts a reviewed obligation against its domain by populated urn", () => {
    const store = new EventStore();
    store.append(adopt("ORG-PR-01", "A", "urn:obligation:bank:org-pr-01", "2026-06-01"));
    store.append(review("urn:obligation:bank:org-pr-01", "reviewed-confirmed", "2026-06-02"));

    const a = computeSummaryCoverage(store).find((c) => c.domain === "A");
    expect(a?.adopted).toBe(1);
    expect(a?.reviewed).toBe(1);
    expect(a?.confirmed).toBe(1);
    expect(a?.coverage).toBe(1);
  });

  test("maps a [TBD]-urn obligation to its id-derived review urn", () => {
    const store = new EventStore();
    store.append(adopt("ORG-PR-02", "A", "[TBD]", "2026-06-01"));
    // The authoring emitter keys [TBD] rows on the id-derived fallback urn.
    store.append(review("urn:obligation:bank:org-pr-02", "reviewed-modified", "2026-06-02"));

    const a = computeSummaryCoverage(store).find((c) => c.domain === "A");
    expect(a?.reviewed).toBe(1);
    expect(a?.modified).toBe(1);
  });

  test("folds BCBS prudential chapters into Domain A", () => {
    const store = new EventStore();
    store.append(adopt("BCBS-LCR20", "Liquidity", "urn:reg:bcbs:lcr:20", "2026-06-01"));
    store.append(review("urn:reg:bcbs:lcr:20", "reviewed-modified", "2026-06-02"));

    const a = computeSummaryCoverage(store).find((c) => c.domain === "A");
    expect(a?.adopted).toBe(1);
    expect(a?.reviewed).toBe(1);
    // The long-form "Liquidity" domain must not appear as a separate row.
    expect(computeSummaryCoverage(store).find((c) => c.domain === "Liquidity")).toBeUndefined();
  });

  test("an unreviewed obligation lowers coverage below 1", () => {
    const store = new EventStore();
    store.append(adopt("ORG-PR-01", "A", "urn:obligation:bank:org-pr-01", "2026-06-01"));
    store.append(adopt("ORG-PR-03", "A", "urn:obligation:bank:org-pr-03", "2026-06-01"));
    store.append(review("urn:obligation:bank:org-pr-01", "reviewed-confirmed", "2026-06-02"));

    const a = computeSummaryCoverage(store).find((c) => c.domain === "A");
    expect(a?.adopted).toBe(2);
    expect(a?.reviewed).toBe(1);
    expect(a?.coverage).toBe(0.5);
  });

  test("latest review status wins the fold (modified supersedes earlier confirm)", () => {
    const store = new EventStore();
    store.append(adopt("ORG-PR-01", "A", "urn:obligation:bank:org-pr-01", "2026-06-01"));
    store.append(review("urn:obligation:bank:org-pr-01", "reviewed-confirmed", "2026-06-02"));
    store.append(review("urn:obligation:bank:org-pr-01", "reviewed-modified", "2026-06-03"));

    const a = computeSummaryCoverage(store).find((c) => c.domain === "A");
    expect(a?.reviewed).toBe(1);
    expect(a?.modified).toBe(1);
    expect(a?.confirmed).toBe(0);
  });

  test("other domains stay at zero coverage when only Domain A is reviewed", () => {
    const store = new EventStore();
    store.append(adopt("ORG-PR-01", "A", "urn:obligation:bank:org-pr-01", "2026-06-01"));
    store.append(adopt("ORG-FC-01", "B", "urn:obligation:bank:org-fc-01", "2026-06-01"));
    store.append(review("urn:obligation:bank:org-pr-01", "reviewed-confirmed", "2026-06-02"));

    const cov = computeSummaryCoverage(store);
    expect(cov.find((c) => c.domain === "A")?.coverage).toBe(1);
    expect(cov.find((c) => c.domain === "B")?.coverage).toBe(0);
  });
});
