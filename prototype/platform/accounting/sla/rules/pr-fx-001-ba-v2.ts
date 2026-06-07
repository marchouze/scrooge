// platform/accounting/sla/rules/pr-fx-001-ba-v2.ts
//
// PR-FX-001-BA @ version 2 — a REAL v2 supersession of the 4a SARB BA-350
// net-open-position (NOP) memo rule (D-SLA-ENGINE-RULES-AS-DATA Phase 4b
// deliverable 6). This exercises the supersede-never-edit machinery end-to-end:
//   - v1 (pr-fx-001-ba.ts) records the NOP on the RECEIVE leg (bought currency)
//     at the receive-leg counter-notional, effective [2026-01-01, 2026-07-01).
//   - v2 (this file) reclassifies the NOP onto the PAY leg (sold currency) at the
//     pay-leg notional, effective [2026-07-01, ∞) — modelling a SARB BA-350
//     reclassification that takes effect on a regulator's cutover date.
//
// The two windows ABUT exactly (left-closed / right-open): v1 closes at
// 2026-07-01, v2 opens at 2026-07-01 — no gap, no overlap. The IFRS rule
// (PR-FX-001) is UNTOUCHED: representations are versioned independently
// (spec §6.2). This is a SARB-BA-RETURN-only change; the SARB representation is
// NOT activated in production (Phase-4c gate), so no live posting changes.
//
// AUTHORING CONVENTION (supersede-never-edit, spec §6.1): the (closed v1, v2)
// PAIR is produced by `supersede(PR_FX_001_BA, {...})`. The helper sets v1's
// `effective_to` to v2's `effective_from`, stamps v2 as `version: 2` with
// `supersedes: "PR-FX-001-BA@1"`, and never mutates the original v1 object.
// `PR_FX_001_BA_V1_CLOSED` is the v1 object with its now-closed window — it
// REPLACES the open-ended v1 in the SARB registry (rules/index.ts).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (Phase 4b, CEO-approved 2026-06-06);
//            D-SLA-FIRST-REPRESENTATION-SARB-BA (CFO Camille).
// Cites: SARB BA 310 (market risk; net open position); Banks Act 94 of 1990 (exposure).

import type { SlaRule } from "../generated/sla-types";
import { supersede } from "../versioning";
import { PR_FX_001_BA } from "./pr-fx-001-ba";

/** The regulator's reclassification cutover date (inclusive, v2's effective_from). */
export const PR_FX_001_BA_V2_CUTOVER = "2026-07-01";

const [v1Closed, v2] = supersede(PR_FX_001_BA, {
  effective_from: PR_FX_001_BA_V2_CUTOVER,
  effective_to: null,
  applies_to: PR_FX_001_BA.applies_to,
  condition: {
    kind: "always",
    detail: "SARB BA-350 (reclassified 2026-07-01) — NOP recorded on the sold (pay) leg",
  },
  // v2 records the open position on the PAY leg (sold currency) at the pay-leg
  // notional — a genuine basis change from v1 (which used the receive leg). Both
  // legs carry the SAME currency so the memo balances per currency (long==short).
  lines: [
    {
      account: { logical: "reg.nop_long", currency: "event.near.payCurrency" },
      side: "debit",
      amount: "abs(event.near.notional.amountMinor)",
      currency: "event.near.payCurrency",
    },
    {
      account: { logical: "reg.nop_short", currency: "event.near.payCurrency" },
      side: "credit",
      amount: "abs(event.near.notional.amountMinor)",
      currency: "event.near.payCurrency",
    },
  ],
  balancing: "assert_zero",
  cites: ["urn:obligation:sarb:ba350:nop", "urn:obligation:reg:banks-act:fx-exposure"],
  notes:
    "v2 reclassification — records the NOP on the sold (pay) leg per the 2026-07-01 BA-350 revision.",
});

/** PR-FX-001-BA v1 with its window now CLOSED at the v2 cutover (replaces the
 *  open-ended v1 in the SARB registry). */
export const PR_FX_001_BA_V1_CLOSED: SlaRule = v1Closed;

/** PR-FX-001-BA @ version 2 — the in-force SARB BA-350 NOP rule from the cutover. */
export const PR_FX_001_BA_V2: SlaRule = v2;
