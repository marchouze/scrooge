// scripts/record-legacy-supersession-m6-m7-extension.ts
//
// Records Marc's in-session CEO confirmation (2026-06-18) that two further
// legacy products — prd:bank:treasury:mmd-deposit (M6) and
// prd:bank:treasury:funding-line (M7) — fall under the SAME authority as
// D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION and receive the identical treatment as
// the 5 products withdrawn in PR #1422.
//
// The original decision's recommendation enumerated 5 specific products; these 2
// were deliberately out of that PR's scope. They are the same class (ProductApproved
// 2026-05-28 under the superseded 14-dimension gate policy — design-attested with
// no tracked deferred gaps, missing the data-quality 15th dimension; seeded by
// scripts/approve-m5-m6-m7-products.ts). This append-only DecisionComment threads
// the CEO's scope-extension confirmation under the canonical decision so the
// extension is traceable (Principle 1; no mutation of the original decision event).
//
// The ProductWithheld events themselves are emitted by the engineering change
// (added to scripts/withdraw-legacy-superseded-products.ts) citing
// D-NPA-GATE-POLICY-REDESIGN + D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/record-legacy-supersession-m6-m7-extension.ts
//
// Author: Scrooge (Chief of Staff) — recording instrument for the CEO confirmation.

import { recordDecisionComment } from "../runtime/decisions/record.ts";

const ts = new Date().toISOString();

const result = recordDecisionComment(
  {
    decisionId: "D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION",
    author: "Marc",
    actorType: "human",
    actorId: "marc@tgv.co.za",
    body: "CEO scope-extension confirmation (2026-06-18): prd:bank:treasury:mmd-deposit (Money Market Deposit, M6) and prd:bank:treasury:funding-line (Committed Funding Line, M7) fall under the SAME authority as this decision. Both were ProductApproved 2026-05-28 under the superseded 14-dimension gate policy (design-attested, no tracked deferred gaps, missing the data-quality 15th dimension) — identical to the 5 products withdrawn in PR #1422. They receive the identical treatment: emit ProductWithheld citing D-NPA-GATE-POLICY-REDESIGN + D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (reason: 'approved under the superseded gate policy; non-compliant under the current 15-dimension standard; to be re-run through a clean NPA cycle when substrate ready'), with a substrate-gap-register entry each (re-npa-mmd-deposit, re-npa-funding-line) flagging the clean NPA cycle as build backlog. This confirmation authorises the extension; no fresh decision is required.",
  },
  ts,
);

console.log(JSON.stringify({ comment: result.eventId }, null, 2));
