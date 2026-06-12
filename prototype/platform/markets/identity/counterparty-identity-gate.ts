// platform/markets/identity/counterparty-identity-gate.ts
//
// Counterparty-identity pre-trade gate — the order-path enforcement of the
// gateway `identity` check (position 1). Until now this check was an
// approve-always stub; this makes it FAIL-CLOSED, mirroring the credit-limit
// (#1177), suitability (#1221), and legal-documentation (#1261) gates.
//
// Posture (ops / COO judgement — Devon, Chief Operating Officer, governance;
// op-risk + onboarding seat): the bank must not transact with a counterparty
// that is not a KYC-accepted party of record. Two conditions, BOTH required:
//
//   1. PARTY-OF-RECORD — the counterparty exists in the markets/onboarding
//      register, evidenced by a `CounterpartyEligibilityScreened` event of
//      record (the Niko institutional-onboarding existence anchor, keyed by
//      counterpartyId). A counterparty the bank has never screened/registered
//      is not a party of record and cannot trade.
//
//   2. KYC-ACCEPTED — a customer-due-diligence acceptance of record exists for
//      the same counterparty. The durable counterparty-keyed CDD-clearance
//      signal in the Niko onboarding lifecycle is `SanctionsClearancePassed`
//      (FIC Act 38/2001 s.21B/s.28A CDD + sanctions clearance at onboarding).
//      The legacy customer onboarding path emits `ClientAccepted`
//      (keyed by candidateId) as the terminal acceptance; either acceptance of
//      record for the counterparty satisfies this condition.
//
// This is deliberately DISTINCT from the order-time `sanctions` check (which
// screens the LIVE blocked list at trade time, fail-on-hit) and from
// `counterparty-eligibility` (institutional eligibility): identity asks the
// prior question — "is this a KYC-accepted party we have onboarded?" — before
// any of the substantive checks run. It is the least-strict gate that still
// fails closed: an institutional / professional counterparty that has been
// onboarded passes; an unknown or un-KYC'd counterparty rejects.
//
// Reads the SAME store the gateway writes to (threaded), not the composition
// global — identical discipline to checkHeadroom / checkLegalDocumentationOf-
// Record.
//
// Does NOT break the sim flow: simulated trades bypass the gateway entirely;
// the RFQ-UI path rejecting a non-KYC counterparty is the intended behaviour.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; FIC-ACT-38-2001 (CDD/sanctions);
//   FAIS-ACT-37-2002; D-KYC-ONBOARDING-BUILD.
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance).

import type { EventStore } from "../../event-store/store";

export interface CounterpartyIdentityCheckResult {
  /** true — the counterparty is a KYC-accepted party of record. */
  readonly ok: boolean;
  /** Which party-of-record signal was found (when ok). */
  readonly partyOfRecordVia?: "CounterpartyEligibilityScreened";
  /** Which KYC-acceptance signal was found (when ok). */
  readonly kycAcceptedVia?: "SanctionsClearancePassed" | "ClientAccepted";
  /** Canonical rejection reason (when not ok). */
  readonly rejectionReason?: string;
}

/**
 * FAIL-CLOSED identity check. The counterparty must be BOTH a party of record
 * (CounterpartyEligibilityScreened of record) AND KYC-accepted
 * (SanctionsClearancePassed of record, or a ClientAccepted of record keyed by
 * the same counterparty). Either condition missing → reject.
 */
export function checkCounterpartyIdentityOfRecord(
  store: Pick<EventStore, "replay">,
  counterpartyId: string,
): CounterpartyIdentityCheckResult {
  // 1. Party-of-record: a CounterpartyEligibilityScreened of record exists.
  let partyOfRecord = false;
  for (const ev of store.replay({ type: "CounterpartyEligibilityScreened" })) {
    const p = ev.payload as { counterpartyId?: string };
    if (p.counterpartyId === counterpartyId) {
      partyOfRecord = true;
      break;
    }
  }

  // 2. KYC-accepted: a SanctionsClearancePassed of record (FIC s.21B/s.28A
  //    onboarding CDD + sanctions clearance), or a ClientAccepted of record,
  //    keyed by the same counterpartyId.
  let kycAcceptedVia: "SanctionsClearancePassed" | "ClientAccepted" | null = null;
  for (const ev of store.replay({ type: "SanctionsClearancePassed" })) {
    const p = ev.payload as { counterpartyId?: string };
    if (p.counterpartyId === counterpartyId) {
      kycAcceptedVia = "SanctionsClearancePassed";
      break;
    }
  }
  if (kycAcceptedVia === null) {
    for (const ev of store.replay({ type: "ClientAccepted" })) {
      const p = ev.payload as { candidateId?: string; clientId?: string; counterpartyId?: string };
      // ClientAccepted is keyed by candidateId/clientId in the customer path;
      // accept a match on any identity field equal to the counterpartyId.
      if (
        p.counterpartyId === counterpartyId ||
        p.candidateId === counterpartyId ||
        p.clientId === counterpartyId
      ) {
        kycAcceptedVia = "ClientAccepted";
        break;
      }
    }
  }

  if (!partyOfRecord && kycAcceptedVia === null) {
    return {
      ok: false,
      rejectionReason: [
        `identity: counterparty ${counterpartyId} is not a KYC-accepted party of record —`,
        "no CounterpartyEligibilityScreened (party-of-record) AND no SanctionsClearancePassed /",
        "ClientAccepted (KYC acceptance) of record. A counterparty must be onboarded and",
        "KYC-accepted BEFORE any trade (FIC Act 38/2001 s.21B/s.28A; fail-closed,",
        "D-FX-HELD-DIMS-SEAT-SWEEP).",
      ].join(" "),
    };
  }
  if (!partyOfRecord) {
    return {
      ok: false,
      rejectionReason: [
        `identity: counterparty ${counterpartyId} has a KYC acceptance but is NOT a party of`,
        "record (no CounterpartyEligibilityScreened) — the onboarding existence anchor is",
        "missing; reject fail-closed (D-FX-HELD-DIMS-SEAT-SWEEP).",
      ].join(" "),
    };
  }
  if (kycAcceptedVia === null) {
    return {
      ok: false,
      rejectionReason: [
        `identity: counterparty ${counterpartyId} is a party of record but has NO KYC acceptance`,
        "of record (no SanctionsClearancePassed / ClientAccepted) — CDD/sanctions clearance is a",
        "precondition to trading (FIC Act 38/2001 s.21B/s.28A; fail-closed,",
        "D-FX-HELD-DIMS-SEAT-SWEEP).",
      ].join(" "),
    };
  }

  return {
    ok: true,
    partyOfRecordVia: "CounterpartyEligibilityScreened",
    kycAcceptedVia,
  };
}
