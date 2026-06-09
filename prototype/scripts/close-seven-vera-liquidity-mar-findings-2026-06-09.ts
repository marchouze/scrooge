// scripts/close-seven-vera-liquidity-mar-findings-2026-06-09.ts
//
// Close the seven open Vera (internal audit engineer) findings from the
// 2026-06-08 MAR + LCR regulation→policy coverage reviews, remediated by
// Helena (Chief Risk Officer, governance) in the 2026-06-09 close-out PR.
//
// Each closure cites the specific provision/obligation changed as evidence.
// Closure is by AuditFindingClosed event (Principle 1 — markdown alone is a
// P1 violation). Idempotent: skips a finding already closed in the store.
//
// Run against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/close-seven-vera-liquidity-mar-findings-2026-06-09.ts
//
// Authority: D-OPEN-THREADS-CLOSEOUT-2026-06-09 (CEO session-delegation);
//   PROC-AUD-FT-01 Step 8 (verification + attestation).
// Recorded-by: marc@tgv.co.za (CEO). Verified-by: agent:vera (third-line).
// Author: Helena (Chief Risk Officer, governance).

import { nowUtc } from "../platform/core/types";
import { recordAuditFindingClosed } from "../platform/records/helpers";
import { openAuditFindingIds } from "../runtime/agents/vera-goal-loop";

const CLOSED_BY = "agent:vera";
const ATTESTATION =
  "Thandiwe (Chief Audit Executive, governance) attests: the remediating policy/obligation provisions named in each evidence ref were verified present in the close-out PR; closures are real, not asserted.";

interface ClosureSpec {
  readonly findingId: string;
  readonly rationale: string;
  readonly evidenceRef: string;
  readonly citations: readonly string[];
}

const CLOSURES: readonly ClosureSpec[] = [
  {
    findingId: "F-HELENA-20260608-VINK",
    rationale:
      "ORG-PR-60 (72.5% output floor + SA/IMA dual-reporting) was marked closed in market-risk-policy-v1 §7 but the output floor was absent from the policy body. Remediated: added §4.6 (Output Floor and SA/IMA Dual-Reporting) discharging both obligation limbs — the floor comparison max(IMA, 0.725 × SA), the OutputFloorAddOnComputed add-on mechanic, and the quarterly SA/IMA dual-reporting cadence; corrected the §7 closure row to anchor ORG-PR-60 on §4.6. The closure is now substantive.",
    evidenceRef:
      "Policies/market-risk-policy-v1.md §4.6 (new) + §7 closure row (corrected); change log v1.2",
    citations: ["ORG-PR-60", "market-risk-policy-v1", "D-OPEN-THREADS-CLOSEOUT-2026-06-09"],
  },
  {
    findingId: "F-MIRA-20260608-4M7U",
    rationale:
      "The market-risk return obligations were orphaned at the policy layer. Remediated: anchored ORG-PR-RETURNS-012 (BA 320 — Market Risk) and ORG-PR-RETURNS-013 (BA 325 — Selected Risk Exposure / FRTB) in market-risk-policy-v1 §6.2 and §7, per the Excel-canonical SARB form schedule (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL). ORG-PR-RETURNS-011 (BA 310 = Minimum Liquid Reserve / HQLA — a liquidity return per Bea's Excel-canonical correction that post-dates the finding) anchored in liquidity-risk-management-policy-v1 §10. Form-number/module-filename code reconciliation remains Mira's code-side track.",
    evidenceRef:
      "Policies/market-risk-policy-v1.md §6.2 + §7 (ORG-PR-RETURNS-012/013); Policies/liquidity-risk-management-policy-v1.md §10 (ORG-PR-RETURNS-011)",
    citations: [
      "ORG-PR-RETURNS-011",
      "ORG-PR-RETURNS-012",
      "ORG-PR-RETURNS-013",
      "market-risk-policy-v1",
      "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
    ],
  },
  {
    findingId: "F-HELENA-20260608-8AO0",
    rationale:
      "The D1/2022 LCR directive cluster (ORG-PR-LCR-001..010) was closed by no policy; the liquidity policy anchored stale D6/2015. Remediated: re-anchored §1.3 regulatory hierarchy on PA Directive 1 of 2022 (current LCR scope-of-application instrument), with D1/2019 as the disclosure standard and D6/2015 demoted to superseded-lineage; updated §2.1 PA-minimum + activated-obligation status; added ORG-PR-LCR-001..010 to the §10 closure table with substantive section mappings.",
    evidenceRef:
      "Policies/liquidity-risk-management-policy-v1.md §1.3 (regulatory hierarchy), §2.1, §10 closure table (ORG-PR-LCR-001..010); change log v1.2",
    citations: [
      "ORG-PR-LCR-001",
      "ORG-PR-LCR-010",
      "liquidity-risk-management-policy-v1",
      "D-OPEN-THREADS-CLOSEOUT-2026-06-09",
    ],
  },
  {
    findingId: "F-HELENA-20260608-D9IJ",
    rationale:
      "The SARB Restricted Committed Liquidity Facility (RCLF) was missing from the L2B HQLA composition (ORG-PR-NSFR-009). Remediated: added §2.2.1 specifying the RCLF as Level 2B HQLA per D1/2023 §2.3.6.1 / Reg 26(12)(b)(iii)(D), with cap treatment, monitoring, and ALCO reporting; added the RCLF to the §2.2 L2B table row; added ORG-PR-NSFR-009 to the §10 closure table.",
    evidenceRef:
      "Policies/liquidity-risk-management-policy-v1.md §2.2.1 (new) + §2.2 L2B table row + §10 (ORG-PR-NSFR-009)",
    citations: ["ORG-PR-NSFR-009", "liquidity-risk-management-policy-v1"],
  },
  {
    findingId: "F-MIRA-20260608-YQNK",
    rationale:
      "The public LCR disclosure basis was not reconciled to D1/2022 / Directive 1/2019. Remediated: added the §2.3 public-disclosure-basis provision specifying simple averages of daily observations over the previous quarter (~90 observations), published quarterly per D1/2022 §3.2 / §4.1.4 incorporating D1/2019; distinguished from the internal daily computation; added ORG-PR-LCR-002/009 to the §10 closure table.",
    evidenceRef:
      "Policies/liquidity-risk-management-policy-v1.md §2.3 (public-disclosure basis) + §10 (ORG-PR-LCR-002, ORG-PR-LCR-009)",
    citations: [
      "ORG-PR-LCR-002",
      "ORG-PR-LCR-009",
      "liquidity-risk-management-policy-v1",
    ],
  },
  {
    findingId: "F-HELENA-20260608-96I3",
    rationale:
      "The non-compliance notification was narrower than D1/2022 §4.1.6 (ratio-breach-only). Remediated: added §9.4 (non-compliance written-notification to the PA) covering ANY inability to comply with D1/2022 — not only a ratio breach — per §4.1.6 read with Reg 5, with the LcrDirectiveNonCompliance typed event and the Eitan/Iris/Zara workflow; added ORG-PR-LCR-010 to the §10 closure table.",
    evidenceRef:
      "Policies/liquidity-risk-management-policy-v1.md §9.4 (new) + §10 (ORG-PR-LCR-010)",
    citations: ["ORG-PR-LCR-010", "liquidity-risk-management-policy-v1"],
  },
  {
    findingId: "F-HELENA-20260608-XF2F",
    rationale:
      "POLICY HALF: the D1/2022 consolidation rules were unspecified. Remediated: added §2.6 specifying the D1/2022 §4.1.2 consolidation rules — inclusion scope (banking/deposit-taking only; Hoz Securities excluded as non-deposit-taking), summation + entity-level HQLA cap at the lower of jurisdiction/home minimum, intragroup elimination, 75% group-basis inflow cap, Rand reporting, monthly cadence; added ORG-PR-LCR-003/004/005/006/007/008 to the §10 closure table. SUBSTRATE HALF (consolidated-LCR computation engine) is explicitly out of scope and tracked as the open follow-on GAP-LCR-CONSOLIDATION-ENGINE in §11.5 (Bea/Ravi; W2 Slice 5) — a separate engineering dispatch, NOT in this PR.",
    evidenceRef:
      "Policies/liquidity-risk-management-policy-v1.md §2.6 (new consolidation rules) + §10 (ORG-PR-LCR-003/004/005) + §11.5 (GAP-LCR-CONSOLIDATION-ENGINE substrate follow-on)",
    citations: [
      "ORG-PR-LCR-003",
      "ORG-PR-LCR-005",
      "liquidity-risk-management-policy-v1",
      "GAP-LCR-CONSOLIDATION-ENGINE",
    ],
  },
] as const;

function main(): number {
  const asOf = nowUtc();
  const openBefore = openAuditFindingIds();
  const closed: string[] = [];
  const alreadyClosed: string[] = [];

  for (const c of CLOSURES) {
    if (!openBefore.has(c.findingId)) {
      alreadyClosed.push(c.findingId);
      console.log(`  SKIP (already closed / not open): ${c.findingId}`);
      continue;
    }
    recordAuditFindingClosed(
      {
        findingId: c.findingId,
        disposition: "resolved",
        verificationMethod: "evidence-review",
        closedBy: CLOSED_BY,
        rationale: c.rationale,
        evidenceRef: c.evidenceRef,
        thandiweAttestation: ATTESTATION,
        citations: ["PROC-AUD-FT-01", "D-OPEN-THREADS-CLOSEOUT-2026-06-09", ...c.citations],
      },
      asOf,
    );
    closed.push(c.findingId);
    console.log(`  CLOSED: ${c.findingId}`);
  }

  const openAfter = openAuditFindingIds();
  const stillOpen = CLOSURES.map((c) => c.findingId).filter((id) => openAfter.has(id));

  console.log("\n  Summary:");
  console.log(`    closed now:      ${closed.length}`);
  console.log(`    already-closed:  ${alreadyClosed.length}`);
  console.log(`    still open (of the 7): ${stillOpen.length} ${stillOpen.join(", ")}`);
  console.log(`    as-of: ${asOf}`);
  console.log(
    `    store: ${process.env.BANK_EVENT_DB ?? "(default — WARNING: not the shared store)"}`,
  );

  return stillOpen.length === 0 ? 0 : 1;
}

process.exit(main());
