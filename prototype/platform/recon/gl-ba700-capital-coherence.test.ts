// platform/recon/gl-ba700-capital-coherence.test.ts
//
// Tests for recon:gl-ba700-capital-coherence (D-V2-UI-VISIBILITY-REMEDIATION).
//
// Proves the standing gate (a) PASSES when the V2 GL Share Capital balance equals
// the BA-700 CET1 paid-up-ordinary-shares numerator under both lenses, (b)
// FAIL-CLOSES on a divergence (a stray GL posting bypassing the capital fold), and
// (c) FAIL-CLOSES on a vacuous +Sim lens when non-vacuity is required.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { ANCHOR_TENANT_ID, tenantIdSchema } from "../../v2-core/control-plane/tenant";
import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import type { FilInstrumentCreatedPayload } from "../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../v2-core/fil-models/capital/types/capital-type-definitions";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { makeGlPostingEmitted } from "../event-store/event-types/fx-accounting";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { run } from "./gl-ba700-capital-coherence";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "system", id: "atlas:gl-ba700-coherence-test" };
const CITES = ["D-V2-UI-VISIBILITY-REMEDIATION", "D-CAPITAL-ASSET-CLASS-V1"];
const AS_OF = "2026-06-21T00:00:00.000Z";
const SHARE_CAPITAL_ACCOUNT = "ACC-5000-001";
const R300M_MINOR = 30_000_000_000; // R300,000,000 in minor units

const SIM_PROVENANCE = simulatedTag({
  scenario: "capital-injection-cet1-300m-v2",
  sourceLineage: "atlas:gl-ba700-coherence-test",
  tags: ["manual-simulation", "capital-raise", "cet1"],
});

/** Append the R300m CET1 paid-up-ordinary-shares injection (simulated). */
function seedCapitalInjection(store: EventStore, amount = "300000000"): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: "cap-cet1-300m-test" });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: {
      eventType: "CapitalSubscriptionConfirmed",
      eventId: "CAP-V2-SIM-CET1-300M-TEST",
    },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "capital" as const,
      notional: { currency: "ZAR", amount },
      direction: "long" as const,
      counterpartyId: "urn:party:capital-provider:founding-subscription",
      nettingSetId: "NS-CAPITAL-CET1-ZAR",
      currency: "ZAR",
      settlementDate: "2026-06-21",
      qualifyingCapital: {
        tier: "cet1" as const,
        subCategory: "cet1.paid-up-ordinary-shares" as const,
      },
    },
  };
  const event = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
      typeof makeFilInstrumentCreated
    >[0]["payload"],
  });
  event.provenance = SIM_PROVENANCE;
  store.append(event);
}

/**
 * Append a stray (non-capital) GlPostingEmitted CREDIT to the Share Capital
 * account — the realistic divergence: a hand-authored GL posting that bypasses the
 * capital FIL fold, inflating the GL balance beyond the BA-700 numerator. Untagged
 * provenance → treated as simulated (admitted under the +Sim lens).
 */
function seedStrayShareCapitalPosting(store: EventStore, amount = "50000000"): void {
  const event = makeGlPostingEmitted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: {
      accountCode: SHARE_CAPITAL_ACCOUNT,
      creditDebit: "credit",
      amount: { __money: "v1", currency: "ZAR", amount },
      postingDate: "2026-06-21",
      tenantId: tenantIdSchema.parse(ANCHOR_TENANT_ID),
      sourceEventId: "STRAY-MANUAL-SHARE-CAPITAL-POSTING",
      iasRule: "IAS 32 §22",
      postingRuleId: "PR-MANUAL-STRAY-001",
      description: "Stray manual share-capital posting (bypasses the capital fold)",
    },
  });
  event.provenance = SIM_PROVENANCE;
  store.append(event);
}

describe("recon:gl-ba700-capital-coherence", () => {
  test("PASSES when GL Share Capital == BA-700 CET1 paid-up numerator (R300m injection)", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store);

    const r = run({ eventStore: store, requireNonVacuousCombined: true });

    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(r.asserted).toBeGreaterThan(0);
    // The asOf summary reports the non-zero +Sim numerator (non-vacuous proof).
    expect(r.asOf).toContain(`${R300M_MINOR} minor`);
  });

  test("FAIL-CLOSES on a divergence (stray GL posting bypasses the capital fold)", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store);
    seedStrayShareCapitalPosting(store); // GL credit now R350m, BA-700 still R300m

    const r = run({ eventStore: store, requireNonVacuousCombined: true });

    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.subject === "gl-ba700-capital-coherence:divergence:combined" && v.severity === "fail",
      ),
    ).toBe(true);
  });

  test("FAIL-CLOSES on a vacuous +Sim lens when non-vacuity is required (empty store)", () => {
    const store = new EventStore(":memory:");

    const r = run({ eventStore: store, requireNonVacuousCombined: true });

    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) =>
          v.subject === "gl-ba700-capital-coherence:vacuous-combined-lens" && v.severity === "fail",
      ),
    ).toBe(true);
  });

  test("empty store is coherent (0 == 0) when non-vacuity is NOT required", () => {
    const store = new EventStore(":memory:");

    const r = run({ eventStore: store });

    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    // Both lenses asserted (production-only + combined), neither diverged.
    expect(r.asserted).toBe(2);
  });

  test("production-only lens stays coherent (0 == 0) — the simulated injection is excluded", () => {
    const store = new EventStore(":memory:");
    seedCapitalInjection(store); // simulated → excluded under production-only

    const r = run({ eventStore: store });

    // No production-only divergence (both sides exclude the sim → 0 == 0).
    expect(
      r.violations.some(
        (v) => v.subject === "gl-ba700-capital-coherence:divergence:production-only",
      ),
    ).toBe(false);
  });
});
