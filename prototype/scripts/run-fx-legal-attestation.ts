// scripts/run-fx-legal-attestation.ts
//
// One-shot legal-dimension attestation driver for prd:bank:fx:otc-vanilla
// (Imani, Legal-as-code engineer, engineering; governance owner Devon, COO,
// interim, pending future GC).
//
// Sequence:
//   1. GATE A (genuine enforcement, isolated store): prove the gateway
//      documentation check actually enforces — an eligible, FAIS-classified,
//      credit-seeded counterparty WITHOUT a LegalDocumentationSigned must be
//      REJECTED at "documentation"; the same counterparty WITH a signing must
//      be APPROVED. Run against a THROWAWAY tmp store (no fabricated events on
//      the canonical log).
//   2. GATE B (coverage, canonical store): every authorised FX counterparty
//      (netting set and/or live FX trades) has a qualifying signing of record,
//      so the RFQ path still functions after the gate.
//   3. GATE C (watchdog stands, canonical store): the opinion-refresh watchdog
//      evaluates without error; its findings are reported (missing opinions
//      are an EXPECTED honest build-phase state — tracked deferred gap
//      fx-jurisdictional-opinion-refresh — and do not block).
//   4. Promote legal → implementation-attested with tracked deferred gaps.
//
// Over-attestation is the failure mode: if Gate A or Gate B fails, the legal
// dimension is NOT promoted and the driver exits non-zero with the reason.
//
// Run against the SHARED canonical store (do NOT set BANK_EVENT_DB):
//   bun run scripts/run-fx-legal-attestation.ts
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//            D-NEW-PRODUCT-APPROVAL-POLICY §5; ORG-CS3-001.

import "../platform/event-store/resolve-event-db-boot";

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { routeOrderToGateway } from "../dashboard/markets-fx-gateway";
import { quoteRfq } from "../dashboard/markets-fx-trade";
import { clock, eventStore } from "../platform/composition";
import {
  makeCounterpartyEligibilityScreened,
  makeCounterpartyFaisClassified,
  makeSanctionsClearancePassed,
} from "../platform/event-store/event-types";
import {
  makeCreditLimitApproved,
  makeCreditLimitLoaded,
} from "../platform/event-store/event-types/credit-limit";
import { makeLegalDocumentationSigned } from "../platform/event-store/event-types/legal-documentation";
import { EventStore } from "../platform/event-store/store";
import { checkLegalDocumentationOfRecord } from "../platform/markets/legal/legal-documentation-gate";
import { checkOpinionRefresh } from "../platform/markets/legal/opinion-refresh-watchdog";
import { runFxLegalAttestation } from "../platform/markets/products/npa-fx-legal-attestation";

const ENTITY = "LE-ZA-HOZ-BANK";
const PROBE_CP = "cp:legal-gate-probe";
const T_SEED = "2026-06-12T00:00:00.000Z";
const T_NOW = "2026-06-12T07:00:00.000Z";

function seedAdmittableCounterparty(store: EventStore, counterpartyId: string): void {
  const actor = { type: "service" as const, id: "agent:imani:legal-gate-probe" };
  const citations = ["D-FX-HELD-DIMS-SEAT-SWEEP"];
  store.append(
    makeCounterpartyEligibilityScreened({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations,
      payload: {
        counterpartyId,
        screeningId: `cp-eligibility:${counterpartyId}:2026-06-12`,
        criteria: ["SARB-licensed bank (Banks Act 94/1990)"],
        outcome: "institutional-eligible",
        evidenceRefs: ["legal-gate-probe"],
        asOf: T_SEED,
      },
    }),
  );
  store.append(
    makeCounterpartyFaisClassified({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations,
      payload: {
        counterpartyId,
        faisCategory: "market-counterparty",
        classifiedAt: T_SEED,
        classifiedBy: "agent:imani:legal-gate-probe",
      },
    }),
  );
  // KYC acceptance of record — required for the FAIL-CLOSED identity gateway
  // check (runs first; D-FX-HELD-DIMS-SEAT-SWEEP) so the probe reaches the
  // documentation check it is testing.
  store.append(
    makeSanctionsClearancePassed({
      asOf: T_SEED,
      entity: ENTITY,
      actor,
      citations,
      payload: {
        counterpartyId,
        screeningProvider: "legal-gate-probe",
        screeningRef: `sanctions-clearance:${counterpartyId}:2026-06-12`,
        clearedAt: T_SEED,
        screenedBy: "agent:imani:legal-gate-probe",
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
}

/** Gate A — the documentation check genuinely enforces (isolated tmp store). */
function gateAGenuineEnforcement(): {
  ok: boolean;
  withoutSigning: string;
  withSigning: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "fx-legal-gate-probe-"));
  try {
    const rfq = {
      counterpartyId: PROBE_CP,
      currencyPair: "USD/ZAR",
      side: "buy" as const,
      notional: 1_000_000,
      valueDate: "2026-06-15",
    };

    const storeNoDoc = new EventStore(join(dir, "no-doc.db"));
    seedAdmittableCounterparty(storeNoDoc, PROBE_CP);
    const without = routeOrderToGateway({
      store: storeNoDoc,
      rfqInput: rfq,
      quote: quoteRfq(rfq),
      asOf: T_NOW,
    });
    storeNoDoc.close();

    const storeWithDoc = new EventStore(join(dir, "with-doc.db"));
    seedAdmittableCounterparty(storeWithDoc, PROBE_CP);
    storeWithDoc.append(
      makeLegalDocumentationSigned({
        asOf: T_SEED,
        entity: ENTITY,
        actor: { type: "service", id: "agent:imani:legal-gate-probe" },
        citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "ORG-CS3-001"],
        payload: {
          counterpartyId: PROBE_CP,
          agreementType: "isda-2002",
          version: "2002-MA + SA Schedule (probe)",
          signedDate: "2026-06-12",
          csaPresent: false,
          nettingEnforceable: true,
        },
      }),
    );
    const withDoc = routeOrderToGateway({
      store: storeWithDoc,
      rfqInput: rfq,
      quote: quoteRfq(rfq),
      asOf: T_NOW,
    });
    storeWithDoc.close();

    const ok =
      without.status === "rejected" &&
      without.rejectingCheck === "documentation" &&
      withDoc.status === "approved";
    return {
      ok,
      withoutSigning: `${without.status} at ${without.rejectingCheck ?? "n/a"}`,
      withSigning: withDoc.status,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The authorised FX counterparty population on the canonical store. */
function fxCounterparties(): string[] {
  const out = new Set<string>();
  for (const ev of eventStore.replay({ type: "ISDACSAAssessmentCompleted" })) {
    const p = ev.payload as { counterpartyId?: string };
    if (p.counterpartyId) out.add(p.counterpartyId);
  }
  for (const ev of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = ev.payload as { counterparty?: { partyId?: string } };
    if (p.counterparty?.partyId) out.add(p.counterparty.partyId);
  }
  return [...out].sort();
}

if (import.meta.main) {
  const asOf = clock.now();

  const gateA = gateAGenuineEnforcement();
  if (!gateA.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason:
            "legal attestation GATE A failed — the gateway documentation check does not genuinely enforce; NOT promoting (over-attestation is the failure mode)",
          gateA,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const population = fxCounterparties();
  const uncovered = population.filter((cp) => !checkLegalDocumentationOfRecord(eventStore, cp).ok);
  if (population.length === 0 || uncovered.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason:
            "legal attestation GATE B failed — authorised FX counterparties lack a LegalDocumentationSigned of record (run scripts/register-sim-fx-legal-documentation.ts first); NOT promoting",
          population: population.length,
          uncovered,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const opinionFindings = checkOpinionRefresh(eventStore, asOf);

  const attestation = runFxLegalAttestation(eventStore);

  console.log(
    JSON.stringify(
      {
        ok: true,
        asOf,
        gateA,
        gateB: { population: population.length, uncovered: uncovered.length },
        gateC: {
          watchdogStands: true,
          findings: opinionFindings.length,
          kinds: opinionFindings.reduce<Record<string, number>>((acc, f) => {
            acc[f.kind] = (acc[f.kind] ?? 0) + 1;
            return acc;
          }, {}),
          note: "missing-opinion findings are the expected honest build-phase state (tracked deferred gap fx-jurisdictional-opinion-refresh); monitoring control, not a block",
        },
        attestation: {
          legalPromoted: attestation.promoted,
          legalSkippedIdempotent: attestation.skipped,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
