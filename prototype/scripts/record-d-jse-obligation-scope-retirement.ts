// scripts/record-d-jse-obligation-scope-retirement.ts
//
// Records D-JSE-OBLIGATION-SCOPE-RETIREMENT — Marc's in-session approval
// (2026-06-20) to RETIRE the JSE equities, JSE listings-requirements, and JSE
// Clear CCP obligations from the bank-obligation register as OUT OF SCOPE for
// the bank's licence posture.
//
// Marc's direct instruction: "remove equities obligations, remove ccp
// obligations, remove listing requirements." Under D-LICENCE-TYPE the bank is
// an indirect, non-clearing IRC participant — it does NOT trade JSE equities,
// is NOT a listed issuer, and is NOT a JSE Clear CCP member. The six affected
// obligations are therefore not bank obligations and are retired out of scope.
//
// Removal set (6 rows, verified against Regulations/_obligations-register.md):
//   ORG-MK-09       JSE Equities Rules and Directives                 (equities)
//   ORG-MK-15       JSE Equities Rules trade-record retention sub-rules (equities)
//   ORG-MK-10       JSE Listings Requirements (equity issuers)         (listing)
//   ORG-MK-16       JSE Debt Listings Requirements                     (listing)
//   ORG-JSE-IRC-02  JSE Debt Listings Requirements (IRC market)        (listing)
//   ORG-JSE-IRC-03  JSE Clear Clearing Rules (CCP)                      (ccp)
//
// Explicitly RETAINED (not touched):
//   ORG-JSE-IRC-01  JSE IRC market participant rules — the in-scope IRC
//                   derivatives rules the bank DOES trade under. STAYS.
//   ORG-MK-03       FMA + JSE comms-recording — a recording obligation, not a
//                   JSE equities/listing/CCP instrument. STAYS.
//   ORG-MK-05       FMA Ch. X insider-info (JSE LR parenthetical, conditional)
//                   — a core market-abuse obligation. STAYS.
//
// Mechanism: retirement is events-first and append-only (Principle 1). The
// enacting script (retire-jse-out-of-scope-obligations.ts) emits one
// ObligationLifecycleTransitioned{transition:"retired"} per row (NO
// supersededBy — this is out-of-scope retirement, not consolidation). Rows
// stay visible in the register with status RETIRED / adopted=false.
//
// Idempotent on (decisionId, phase, asOf) with FIXED instants so the
// ci:migrate replay is byte-stable. The decision-symmetry recon gate requires
// a `requested` phase before the terminal phase — emit both. Recording it via
// the dedicated record-d-*.ts script (NOT inside a cycle/seed path) keeps it
// clear of recon:decision-symmetry false positives.
//
// Scrooge is the recording instrument (recordedVia: scrooge:session-delegation);
// Marc is the authorizing principal (authorityRef: marc@tgv.co.za). Out-of-scope
// retirement of regulatory obligations is a compliance decision → CCO/compliance
// category, CEO authority via session delegation (decision-authority-routing).
//
// Authority: CLAUDE.md §"Session delegation"; D-LICENCE-TYPE;
//   D-ENGINEERING-INTEGRITY-CHARTER; P1-EVENTS-AS-TRUTH.
// brief: brief:mira:retire-jse-equities-listing-ccp-obligations-out-:2026-06-20
// Author: Mira (Compliance / RegTech engineer, engineering — obligations-register curator).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

// Fixed instants so the ci:migrate replay is byte-stable. decision-symmetry
// requires every closed decision to carry a `requested` phase before its
// terminal phase (D-DECISIONS-FRAMEWORK-REDESIGN) — emit both.
const REQUESTED = "2026-06-20T08:55:00.000Z";
const APPROVED = "2026-06-20T09:00:00.000Z";

const base = {
  decisionId: "D-JSE-OBLIGATION-SCOPE-RETIREMENT",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Retire JSE equities / listing-requirements / JSE Clear CCP obligations as out of scope (D-LICENCE-TYPE)",
  category: "compliance" as const,
  recommendation:
    'Retire six bank obligations as out of scope for the bank\'s licence posture: ORG-MK-09 (JSE Equities Rules and Directives), ORG-MK-15 (JSE Equities Rules trade-record retention sub-rules), ORG-MK-10 (JSE Listings Requirements — equity issuers), ORG-MK-16 (JSE Debt Listings Requirements), ORG-JSE-IRC-02 (JSE Debt Listings Requirements — IRC market), and ORG-JSE-IRC-03 (JSE Clear Clearing Rules — CCP). Each is retired events-first via ObligationLifecycleTransitioned{transition:"retired", toStatus:"RETIRED"}, with NO supersededBy (out-of-scope retirement, not consolidation). Rows stay visible with status RETIRED / adopted=false. The in-scope JSE IRC derivatives participant rules (ORG-JSE-IRC-01), the FMA+JSE comms-recording obligation (ORG-MK-03), and the FMA Ch. X insider-information obligation (ORG-MK-05) are explicitly retained.',
  rationale:
    "Under D-LICENCE-TYPE the bank is an indirect, non-clearing JSE Interest Rate and Currency (IRC) market participant. It does not trade JSE equities (so the JSE Equities Rules and their trade-record-retention sub-rules do not bind), it is not a listed issuer (so the JSE equity and debt Listings Requirements do not bind), and it is not a JSE Clear CCP member — it clears, where required, through a clearing member under a tripartite arrangement (so the JSE Clear Clearing Rules do not bind the bank as a member). These six obligations were authored into the register as forward-compatible / conditional baseline rows; with the licence posture settled they are out of scope and must not sit in the live register as bank obligations. Retirement is events-first and append-only — the rows remain visible with status RETIRED for audit traceability rather than being deleted. The IRC derivatives participant rules the bank actually trades under (ORG-JSE-IRC-01) remain in force.",
  sourceDocHashes: [],
  citations: [
    "D-LICENCE-TYPE",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "P1-EVENTS-AS-TRUTH",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

// Symmetric phase chain: requested → approved (idempotent on the fixed instants).
requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-JSE-OBLIGATION-SCOPE-RETIREMENT" },
    null,
    2,
  ),
);
