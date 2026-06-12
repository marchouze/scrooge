// platform/markets/products/oprisk-attestation-gates.ts
//
// Genuine-enforcement gates for the FX operational-risk dimension attestation.
// Both probes run against ISOLATED in-memory/tmp stores — no fabricated events
// ever touch the canonical log. They prove, at code level, that the substrate
// being attested actually works (over-attestation is the failure mode).
//
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { routeOrderToGateway } from "../../../dashboard/markets-fx-gateway";
import { quoteRfq } from "../../../dashboard/markets-fx-trade";
import {
  makeCounterpartyEligibilityScreened,
  makeCounterpartyFaisClassified,
  makeSanctionsClearancePassed,
} from "../../event-store/event-types";
import {
  makeCreditLimitApproved,
  makeCreditLimitLoaded,
} from "../../event-store/event-types/credit-limit";
import { makeLegalDocumentationSigned } from "../../event-store/event-types/legal-documentation";
import { makeOperationalLossEvent } from "../../event-store/event-types/operational-risk";
import { EventStore } from "../../event-store/store";
import { buildOperationalLossProjection } from "../../reporting/operational-loss-projection";

const ENTITY = "LE-ZA-HOZ-BANK";
const T_SEED = "2026-06-12T00:00:00.000Z";
const T_NOW = "2026-06-12T07:00:00.000Z";

/**
 * GATE 1 — the OperationalLossEvent type is registered and a captured loss
 * round-trips through the registered schema into the projection. Runs against
 * an isolated tmp store.
 */
export function isOperationalLossEventRegistered(): boolean {
  const dir = mkdtempSync(join(tmpdir(), "fx-oprisk-loss-probe-"));
  try {
    const store = new EventStore(join(dir, "loss.db"));
    store.append(
      makeOperationalLossEvent({
        asOf: T_SEED,
        entity: ENTITY,
        actor: { type: "service", id: "agent:tomas:oprisk-probe" },
        citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "BCBS-D196-§644"],
        payload: {
          lossEventId: "loss:probe:001",
          eventDate: "2026-06-10",
          discoveryDate: "2026-06-11",
          grossLossMinor: 100_00,
          currency: "ZAR",
          businessLine: "trading-and-sales",
          eventTypeCategory: "execution-delivery-and-process-management",
          status: "open",
          description: "probe loss",
        },
      }),
    );
    const proj = buildOperationalLossProjection(store);
    store.close();
    return (
      proj.totals.count === 1 &&
      proj.openRecords.length === 1 &&
      proj.byBusinessLine.some((l) => l.businessLine === "trading-and-sales")
    );
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Seed every gate EXCEPT identity so the probe isolates the identity check. */
function seedNonIdentityGates(store: EventStore, counterpartyId: string): void {
  const actor = { type: "service" as const, id: "agent:tomas:oprisk-probe" };
  store.append(
    makeCounterpartyFaisClassified({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations: ["FAIS-ACT-37-2002"],
      payload: {
        counterpartyId,
        faisCategory: "market-counterparty",
        classifiedAt: T_SEED,
        classifiedBy: "agent:tomas:oprisk-probe",
      },
    }),
  );
  const limitMinor = 1_000_000_000_000_00;
  store.append(
    makeCreditLimitApproved({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations: ["D-CREDIT-LIMIT-ENGINE-BUILD"],
      payload: {
        applicationId: `CL-APP-${counterpartyId}`,
        counterpartyId,
        limit: limitMinor,
        currency: "ZAR",
        tenor: "364D",
        approvedBy: "probe:helena",
        approvalAuthority: "CRC",
        approvedAt: T_SEED,
        conditions: [],
        expiryDate: "2099-12-31",
      },
    }),
  );
  store.append(
    makeCreditLimitLoaded({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations: ["D-CREDIT-LIMIT-ENGINE-BUILD"],
      payload: {
        counterpartyId,
        limit: limitMinor,
        currency: "ZAR",
        loadedAt: T_SEED,
        effectiveFrom: T_SEED,
        loadedBy: "probe:ops",
      },
    }),
  );
  store.append(
    makeLegalDocumentationSigned({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "ORG-CS3-001"],
      payload: {
        counterpartyId,
        agreementType: "isda-2002",
        version: "2002-MA + SA Schedule (probe)",
        signedDate: "2026-06-12",
        csaPresent: false,
        nettingEnforceable: true,
      },
    }),
  );
}

/** Make the counterparty a party-of-record (eligible) + KYC-accepted. */
function seedIdentity(store: EventStore, counterpartyId: string): void {
  const actor = { type: "service" as const, id: "agent:tomas:oprisk-probe" };
  store.append(
    makeCounterpartyEligibilityScreened({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations: ["FAIS-ACT-37-2002"],
      payload: {
        counterpartyId,
        screeningId: `cp-eligibility:${counterpartyId}:2026-06-12`,
        criteria: ["SARB-licensed bank (probe)"],
        outcome: "institutional-eligible",
        evidenceRefs: ["oprisk-probe"],
        asOf: T_SEED,
      },
    }),
  );
  store.append(
    makeSanctionsClearancePassed({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations: ["FIC-ACT-38-2001"],
      payload: {
        counterpartyId,
        screeningProvider: "oprisk-probe",
        screeningRef: `sanctions-clearance:${counterpartyId}:2026-06-12`,
        clearedAt: T_SEED,
        screenedBy: "agent:tomas:oprisk-probe",
      },
    }),
  );
}

export interface IdentityProbeResult {
  readonly ok: boolean;
  readonly detail?: string;
}

/**
 * GATE 2 — the gateway identity check genuinely enforces. In an isolated probe:
 *   - a counterparty with NO party-of-record / KYC acceptance (but every OTHER
 *     gate seeded) REJECTS at "identity"; and
 *   - the SAME counterparty, once made a KYC-accepted party of record, APPROVES.
 * Proves fail-closed AND not reject-always.
 */
export function probeIdentityEnforcement(): IdentityProbeResult {
  const dir = mkdtempSync(join(tmpdir(), "fx-oprisk-identity-probe-"));
  const PROBE_CP = "cp:oprisk-identity-probe";
  const rfq = {
    counterpartyId: PROBE_CP,
    currencyPair: "USD/ZAR",
    side: "buy" as const,
    notional: 1_000_000,
    valueDate: "2026-06-15",
  };
  try {
    // Path A — every gate EXCEPT identity seeded → must reject at identity.
    const storeNoId = new EventStore(join(dir, "no-id.db"));
    seedNonIdentityGates(storeNoId, PROBE_CP);
    const without = routeOrderToGateway({
      store: storeNoId,
      rfqInput: rfq,
      quote: quoteRfq(rfq),
      asOf: T_NOW,
    });
    storeNoId.close();

    // Path B — add identity-of-record → must approve.
    const storeWithId = new EventStore(join(dir, "with-id.db"));
    seedNonIdentityGates(storeWithId, PROBE_CP);
    seedIdentity(storeWithId, PROBE_CP);
    const withId = routeOrderToGateway({
      store: storeWithId,
      rfqInput: rfq,
      quote: quoteRfq(rfq),
      asOf: T_NOW,
    });
    storeWithId.close();

    const rejectsWhenUnknown =
      without.status === "rejected" && without.rejectingCheck === "identity";
    const approvesWhenKnown = withId.status === "approved";
    const ok = rejectsWhenUnknown && approvesWhenKnown;
    if (ok) return { ok: true };
    return {
      ok: false,
      detail: `without-identity: ${without.status}@${without.rejectingCheck ?? "n/a"}; with-identity: ${withId.status}@${withId.rejectingCheck ?? "n/a"}`,
    };
  } catch (e) {
    return { ok: false, detail: `probe threw: ${String(e)}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
