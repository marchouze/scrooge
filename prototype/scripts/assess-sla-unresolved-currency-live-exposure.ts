// scripts/assess-sla-unresolved-currency-live-exposure.ts
//
// READ-ONLY live-exposure assessment for D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE.
//
// The legacy `receivableAccountFor`/`payableAccountFor` switches in
// platform/accounting/posting-rules/fx-spot.ts mis-book ANY non-ZAR/USD foreign
// currency into the USD trading accounts (ACC-2100-002 / ACC-2100-004) via their
// `default → USD slot` fallback. This script scans the event store for the
// fingerprint of that defect: `SubLedgerPostingEmitted` legs posted to a USD
// trading account but carrying a NON-USD `currency`. It reports count,
// currencies, ZAR-equivalent magnitude (best-effort via leg currency), and the
// trade / posting ids.
//
// EMITS NOTHING — pure read. Per the brief, live GL is NOT corrected here; any
// exposure is a flagged follow-on for sign-off.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";

const USD_ACCOUNTS = new Set(["ACC-2100-002", "ACC-2100-004"]);

interface Leg {
  accountId?: string;
  currency?: string;
  amountMinor?: number;
  debitCredit?: string;
}
interface PostingPayload {
  legs?: Leg[];
  postingType?: string;
  sourceEventId?: string;
  tradeId?: string;
}

let totalPostings = 0;
let usdAcctPostings = 0;
const offenders: Array<{
  eventId: string;
  tradeId?: string;
  sourceEventId?: string;
  accountId: string;
  currency: string;
  amountMinor: number;
  provenance?: string;
  asOf: string;
}> = [];
const byCcy = new Map<string, { count: number; amountMinor: number }>();
const byProvenance = new Map<string, number>();

for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
  totalPostings++;
  const p = e.payload as PostingPayload;
  const legs = p.legs ?? [];
  if (legs.some((l) => l.accountId && USD_ACCOUNTS.has(l.accountId))) usdAcctPostings++;
  for (const l of legs) {
    if (l.accountId && USD_ACCOUNTS.has(l.accountId) && l.currency && l.currency !== "USD") {
      const provenance = (e as { provenance?: { kind?: string } }).provenance?.kind ?? "unknown";
      offenders.push({
        eventId: e.event_id,
        tradeId: p.tradeId,
        sourceEventId: p.sourceEventId,
        accountId: l.accountId,
        currency: l.currency,
        amountMinor: l.amountMinor ?? 0,
        provenance,
        asOf: e.as_of,
      });
      const agg = byCcy.get(l.currency) ?? { count: 0, amountMinor: 0 };
      agg.count++;
      agg.amountMinor += l.amountMinor ?? 0;
      byCcy.set(l.currency, agg);
      byProvenance.set(provenance, (byProvenance.get(provenance) ?? 0) + 1);
    }
  }
}

console.log(
  JSON.stringify(
    {
      scan: "non-USD currency booked into USD trading accounts (ACC-2100-002/004)",
      totalSubLedgerPostings: totalPostings,
      postingsTouchingUsdTradingAccounts: usdAcctPostings,
      misBookedLegCount: offenders.length,
      byCurrency: Object.fromEntries([...byCcy.entries()]),
      byProvenance: Object.fromEntries([...byProvenance.entries()]),
      sampleOffenders: offenders.slice(0, 50),
    },
    null,
    2,
  ),
);
