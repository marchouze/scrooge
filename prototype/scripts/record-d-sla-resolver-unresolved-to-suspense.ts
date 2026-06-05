// scripts/record-d-sla-resolver-unresolved-to-suspense.ts
//
// Records D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE — Marc's in-session correction
// (2026-06-05): SLA resolver must resolve per-currency (USD=USD, no FCY-pool
// fallback); a resolver miss posts the leg to a balancing FX unresolved-currency
// suspense account and raises a high-severity urgent-correction alert — never a
// silent USD fallback, never a dropped posting.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation).
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-05T09:59:00.000Z";
const APP = "2026-06-05T10:00:00.000Z";
const base = {
  decisionId: "D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "SLA resolver: per-currency accounts (USD=USD); unresolved-currency leg -> balancing suspense + urgent-correction alert",
  category: "engineering" as const,
  recommendation:
    "Correct the SLA account resolver and spec sections 5.2/7.3: (1) each currency resolves to its OWN account — the USD account (ACC-2100-002/004) is USD-only, NOT a multi-currency FCY pool; remove the currency-wildcard-to-pool fallback. (2) On an account-resolution miss, do NOT silently fall back to the USD account and do NOT drop the posting — post the leg to a dedicated BALANCING FX unresolved-currency suspense account and raise a high-severity urgent-correction alert + recon finding so the item is glaringly visible and tracked for prompt correction. Byte-for-byte parity with the legacy engine therefore holds only for currencies the legacy engine books correctly (ZAR, USD); for other currencies the corrected engine deliberately diverges (own account, or suspense), fixing the latent default-to-USD mis-booking.",
  rationale:
    "Phase 1 byte-for-byte parity faithfully reproduced a latent defect: the legacy default->USD-slot fallback mis-books any non-ZAR/USD foreign currency into the USD account. USD=USD; foreign currency must not be parked in the USD account. A bare dropped posting loses the transaction; the correct accounting treatment is a balancing suspense posting that preserves double-entry integrity while loudly flagging the unresolved item for urgent correction. CEO design correction, in-session 2026-06-05.",
  citations: [
    "D-SLA-ENGINE-RULES-AS-DATA",
    "Principles/5-multi-currency-entity-country.md",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};
requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
