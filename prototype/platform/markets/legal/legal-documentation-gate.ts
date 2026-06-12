// platform/markets/legal/legal-documentation-gate.ts
//
// Legal-documentation pre-trade gate — the order-path enforcement of
// ORG-CS3-001 (FSCA Conduct Standard 3 of 2018 §3: a WRITTEN trading-
// relationship agreement must exist BEFORE any OTC derivative transaction).
//
// Posture: FAIL-CLOSED, mirroring the credit-limit gate
// (D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED, #1177) and the suitability gate
// (D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH, #1221): a counterparty
// with NO `LegalDocumentationSigned` of record for a trading master form
// (ISDA Master 2002/2025 or an FX-bilateral master) is REJECTED at the
// gateway — a missing agreement is a hard legal block, not a warning.
// `"none-listed"` (account-mandate / SLA only) and custody/repo forms
// (GMRA/GMSLA) do NOT admit an OTC FX order.
//
// The annual jurisdictional-opinion refresh SLA is deliberately NOT part of
// this gate — it is a monitoring control (opinion-refresh-watchdog.ts), per
// the dispatch brief: stale opinion → finding/alert, not an order-path block.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//            D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; ORG-CS3-001;
//            Imani G-9 (2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md).
// Author: Imani (Legal-as-code engineer, engineering) — governance owner
//         Devon (COO, interim, pending future GC).

import type { LegalDocumentationAgreementType } from "../../event-store/event-types/legal-documentation";
import type { EventStore } from "../../event-store/store";

/**
 * Master-agreement forms that constitute a written OTC-trading relationship
 * agreement for the FX umbrella product (ORG-CS3-001). GMRA (repo) and GMSLA
 * (securities lending) are real master forms but do not document an OTC FX
 * derivative relationship; "none-listed" is explicitly NOT an agreement.
 */
export const FX_TRADING_AGREEMENT_TYPES: readonly LegalDocumentationAgreementType[] = [
  "isda-2002",
  "isda-2025",
  "fx-bilateral",
];

export interface LegalDocumentationCheckResult {
  /** true — a qualifying signed master agreement of record exists. */
  readonly ok: boolean;
  /** The qualifying form found (when ok). */
  readonly agreementType?: LegalDocumentationAgreementType;
  /** Execution date of the qualifying agreement (when ok). */
  readonly signedDate?: string;
  /** Canonical rejection reason (when not ok). */
  readonly rejectionReason?: string;
}

/**
 * FAIL-CLOSED check: does `counterpartyId` have a `LegalDocumentationSigned`
 * event of record for a qualifying trading master form? Reads the SAME store
 * the gateway writes to (threaded), not the composition global — identical
 * discipline to `checkHeadroom` in the credit-limit gate.
 */
export function checkLegalDocumentationOfRecord(
  store: Pick<EventStore, "replay">,
  counterpartyId: string,
): LegalDocumentationCheckResult {
  let latest: { agreementType: LegalDocumentationAgreementType; signedDate: string } | null = null;
  for (const ev of store.replay({ type: "LegalDocumentationSigned" })) {
    const p = ev.payload as {
      counterpartyId?: string;
      agreementType?: LegalDocumentationAgreementType;
      signedDate?: string;
    };
    if (p.counterpartyId !== counterpartyId) continue;
    if (!p.agreementType || !FX_TRADING_AGREEMENT_TYPES.includes(p.agreementType)) continue;
    if (latest === null || (p.signedDate ?? "") > latest.signedDate) {
      latest = { agreementType: p.agreementType, signedDate: p.signedDate ?? "" };
    }
  }
  if (latest === null) {
    return {
      ok: false,
      rejectionReason:
        `legal-documentation: counterparty ${counterpartyId} has no signed trading master ` +
        "agreement of record (ISDA Master or FX-bilateral; LegalDocumentationSigned) — " +
        "a written trading-relationship agreement is required BEFORE any OTC derivative " +
        "transaction (ORG-CS3-001, FSCA Conduct Standard 3/2018 §3; fail-closed, " +
        "D-FX-HELD-DIMS-SEAT-SWEEP)",
    };
  }
  return { ok: true, agreementType: latest.agreementType, signedDate: latest.signedDate };
}
