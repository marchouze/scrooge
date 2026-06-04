// dashboard/bank-obligations-view.ts
//
// /api/bank-obligations — the EVENT-SOURCED bank-obligation register (Plane B,
// D-REGULATORY-ARCHITECTURE-TWO-PLANE). Reads the ObligationAdopted lifecycle
// projection (platform/obligations/projection.ts), NOT the legacy markdown.
// This is the canonical viewer for the bank's accepted obligations; the legacy
// /api/obligations (markdown-backed) is one of the readers tracked for
// migration on /obligation-readers.html.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { EventStore } from "../platform/event-store/store";
import { type BankObligation, loadBankObligations } from "../platform/obligations/projection";

export interface BankObligationsView {
  obligations: BankObligation[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    byDomain: Record<string, number>;
    withDerivesFrom: number;
  };
}

export function getBankObligationsView(store: EventStore): BankObligationsView {
  const obligations = loadBankObligations(store);
  const byStatus: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  let withDerivesFrom = 0;

  for (const o of obligations) {
    const status = o.status || "(unset)";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const domain = o.domain || "(unset)";
    byDomain[domain] = (byDomain[domain] ?? 0) + 1;
    if (o.derivesFrom.length > 0) withDerivesFrom++;
  }

  return {
    obligations,
    summary: { total: obligations.length, byStatus, byDomain, withDerivesFrom },
  };
}
