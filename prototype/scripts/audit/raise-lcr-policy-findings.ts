// scripts/audit/raise-lcr-policy-findings.ts
//
// One-shot Vera (Internal audit / continuous-assurance engineer, engineering)
// third-line run: raise six AuditFinding events for the LCR (Liquidity Coverage
// Ratio) regulation -> policy coverage review (Scrooge-coordinated, 2026-06-08).
//
// IMPORTANT — run against the SHARED canonical store, not the local working store.
// `platform/composition` resolves with excludeHomeDefault:true, so without an
// explicit BANK_EVENT_DB this writes to the per-worktree local store. Run as:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/audit/raise-lcr-policy-findings.ts
//
// Findings are raised by `agent:vera` and addressed to the remediation owner:
//   L1 -> Helena  (CRO; liquidity-risk-management-policy-v1 owner)  — D1/2022 cluster unclosed
//   L2 -> Mira    (RegTech; BA-form numbering)                      — LCR-return number collision
//   L3 -> Helena  (CRO; HQLA composition §2.2)                      — RCLF missing from L2B
//   L4 -> Mira    (RegTech; Pillar 3 disclosure anchor)            — daily-average disclosure basis
//   L5 -> Helena  (CRO; §9.2 breach taxonomy)                       — non-compliance notification scope
//   L6 -> Helena  (CRO; consolidation rules §2)                     — consolidation rules + substrate
//
// Authority: Marc (CEO) in-session "raise the findings" 2026-06-08.
// Third-line independence: Vera reports functionally to Thandiwe (CAE).

import { nowUtc } from "../../platform/core/types";
import { recordAuditFinding } from "../../platform/records/helpers";

const RAISED_BY = "agent:vera";

interface FindingSpec {
  readonly tag: string;
  readonly agentId: string;
  readonly severity: "high" | "medium";
  readonly summary: string;
  readonly detail: string;
  readonly sourceRef: string;
  readonly citations: readonly string[];
}

const FINDINGS: readonly FindingSpec[] = [
  {
    tag: "L1",
    agentId: "helena",
    severity: "high",
    summary:
      "The D1/2022 LCR directive cluster (ORG-PR-LCR-001..010) is closed by no policy; liquidity-risk-management-policy-v1 anchors on the older D6/2015 and never references D1/2022.",
    detail:
      "The policy's LCR framework reads against PA Directive D6/2015 — described in the policy itself as a 'proposed Government Notice' (2015) — and does not reference Directive D1/2022 ('LCR: Scope of Application and Calculation'), the current instrument the adopted ORG-PR-LCR-001..010 obligations derive from. All ten D1/2022 obligations (HQLA stock for 30-day stress; LCR disclosure per Directive 1/2019; consolidation scope; summation; intragroup elimination; 75% inflow cap on a group basis; Rand solo+consolidated reporting; monthly consolidated calculation; quarterly daily-average disclosure; non-compliance notification) are closed by no policy. Substance is partly present but attributed to the older instrument and the granular obligations are orphaned at the policy layer. Remediation: re-anchor §1.3 regulatory hierarchy and §2 on D1/2022; add the ten obligations to the §10 closure table with substantive section mapping.",
    sourceRef:
      "Policies/liquidity-risk-management-policy-v1.md §1.3/§2 (closure table omits ORG-PR-LCR-001..010); Regulations/_obligations.seed.json (Domain PR-LCR)",
    citations: ["ORG-PR-LCR-001", "ORG-PR-LCR-010", "liquidity-risk-management-policy-v1"],
  },
  {
    tag: "L2",
    agentId: "mira",
    severity: "high",
    summary:
      "Systemic BA-form-number collision for the LCR return: liquidity policy calls it 'BA 325', Pillar 3 sources it from 'BA 900', but D5/2025 (ORG-PR-RETURNS-003) says the LCR return is BA 110.",
    detail:
      "Three conflicting form numbers for the LCR return: (1) liquidity-risk-management-policy-v1 calls the LCR engine/return 'BA 325' (ba-325-lcr.ts, §2.2/§9); (2) pillar-3-disclosure-policy-v1 sources LCR disclosure from 'BA 900' (line 126); (3) the D5/2025 returns register (ORG-PR-RETURNS-003) says the LCR return is BA 110. Meanwhile BA 325 is independently used for FRTB market risk (market-risk-policy-v1) and SA-CCR (regulatory-reporting-policy-v1) — 3+ meanings for BA 325, and the LCR return mis-numbered in two policies. Same defect class as MAR finding F-MIRA-20260608-D9PR; D-BA-RETURN-FORM-NUMBERING-RECON (FX/liquidity daily returns ride BA-110) has not propagated to the liquidity or Pillar 3 policies. Recommend a single bank-wide BA-form-number reconciliation (market risk + LCR + counterparty credit) rather than per-domain patches.",
    sourceRef:
      "Policies/liquidity-risk-management-policy-v1.md (BA 325 LCR); Policies/pillar-3-disclosure-policy-v1.md:126 (BA 900 LCR); cross-ref AuditFinding F-MIRA-20260608-D9PR",
    citations: [
      "D-BA-RETURN-FORM-NUMBERING-RECON",
      "ORG-PR-RETURNS-003",
      "liquidity-risk-management-policy-v1",
      "pillar-3-disclosure-policy-v1",
    ],
  },
  {
    tag: "L3",
    agentId: "helena",
    severity: "medium",
    summary:
      "SARB RCLF (Restricted Committed Liquidity Facility) is missing from the L2B HQLA composition (ORG-PR-NSFR-009).",
    detail:
      "D1/2023 §2.3.6.1 requires the SARB Restricted Committed Liquidity Facility (RCLF) be reported as Level 2B HQLA. The policy §2.2 L2B composition lists eligible corporate bonds, qualifying equities, and qualifying RMBS but omits the RCLF. Substantive HQLA-composition gap, closed by no policy — material in the SA context where Level-1 SAGB supply is constrained and the committed liquidity facility is a recognised HQLA source. Remediation: add the RCLF to the §2.2 L2B composition with its D1/2023 §2.3.6.1 treatment and any cap.",
    sourceRef: "Policies/liquidity-risk-management-policy-v1.md §2.2 (L2B composition)",
    citations: ["ORG-PR-NSFR-009", "liquidity-risk-management-policy-v1"],
  },
  {
    tag: "L4",
    agentId: "mira",
    severity: "medium",
    summary:
      "Public LCR disclosure basis not reconciled to D1/2022 / Directive 1/2019 (simple averages of daily observations) — ORG-PR-LCR-002/009.",
    detail:
      "D1/2022 §3.2/§4.1.4 (per Directive 1/2019) requires public LCR disclosure presented as simple averages of daily observations over the previous quarter (~90 observations). The Pillar 3 policy anchors LCR disclosure on D10/2025's averaging methodology with a [citation: TBC] and does not reference the D1/2022 / 1-2019 daily-observation basis; the liquidity policy computes LCR daily internally but does not specify the public-disclosure averaging convention. Directive 1/2019 is referenced by no policy as the LCR disclosure anchor. Remediation: anchor the Pillar 3 LCR disclosure table on D1/2022 §3.2 / Directive 1/2019 simple-average-of-daily-observations basis.",
    sourceRef:
      "Policies/pillar-3-disclosure-policy-v1.md:126; Policies/liquidity-risk-management-policy-v1.md §2.3",
    citations: ["ORG-PR-LCR-002", "ORG-PR-LCR-009", "pillar-3-disclosure-policy-v1"],
  },
  {
    tag: "L5",
    agentId: "helena",
    severity: "medium",
    summary:
      "Non-compliance notification in policy is narrower than D1/2022 §4.1.6 (ratio-breach-only, not any-requirement non-compliance) — ORG-PR-LCR-010.",
    detail:
      "D1/2022 §4.1.6 requires that ANY inability to comply with the directive be reported to the PA in writing as soon as practicable, stating the reasons. The policy §9.2 'Critical' tier notifies the PA on a ratio breach (LCR <= 100%) 'per Reg 26 notification obligations' with a [citation: TBC] — narrower than D1/2022 §4.1.6 (covers only the ratio breach, not non-compliance with any requirement of the directive). Remediation: add an explicit D1/2022 §4.1.6 non-compliance written-notification obligation to §9.2 / the breach taxonomy.",
    sourceRef: "Policies/liquidity-risk-management-policy-v1.md §9.2 (breach taxonomy)",
    citations: ["ORG-PR-LCR-010", "liquidity-risk-management-policy-v1"],
  },
  {
    tag: "L6",
    agentId: "helena",
    severity: "medium",
    summary:
      "Granular D1/2022 consolidation rules unspecified and consolidated-LCR substrate not built (ORG-PR-LCR-003/004/005).",
    detail:
      "The D1/2022 consolidation rules — only banking/deposit-taking entities (§4.1.2.1); branch home/host treatment (§2.5); entity-level HQLA cap at the lower of the minimum (§4.1.2.5); intragroup-transaction elimination (§4.1.2.7) — are not spelled out in the policy, and the consolidated LCR computation is flagged in-policy as a 'W2 Slice 5 deliverable' (not yet built). Part acknowledged substrate gap (consolidated computation -> Bea), part policy-coverage gap (the consolidation rules themselves). Remediation: spell out the D1/2022 consolidation rules in §2; track the consolidated-LCR substrate build as the bound deliverable.",
    sourceRef:
      "Policies/liquidity-risk-management-policy-v1.md §2 (consolidation) + line ~679 (W2 Slice 5 substrate note)",
    citations: ["ORG-PR-LCR-003", "ORG-PR-LCR-005", "liquidity-risk-management-policy-v1"],
  },
] as const;

function main(): void {
  const asOf = nowUtc();
  const raised: { tag: string; findingId: string; addressedTo: string; severity: string }[] = [];

  for (const f of FINDINGS) {
    const findingId = recordAuditFinding(
      {
        agentId: f.agentId,
        severity: f.severity,
        category: "process",
        summary: f.summary,
        detail: f.detail,
        sourceRef: f.sourceRef,
        raisedBy: RAISED_BY,
        citations: f.citations,
      },
      asOf,
    );
    raised.push({ tag: f.tag, findingId, addressedTo: `agent:${f.agentId}`, severity: f.severity });
  }

  console.log("\nLCR policy-coverage AuditFindings raised by agent:vera (third-line):");
  for (const r of raised) {
    console.log(`  ${r.tag} [${r.severity}] -> ${r.findingId}  (addressed to ${r.addressedTo})`);
  }
  console.log(`\n  As-of: ${asOf}`);
  console.log(`  Total: ${raised.length} AuditFinding events appended.`);
  console.log(
    `  Store: ${process.env.BANK_EVENT_DB ?? "(default — WARNING: not the shared store)"}`,
  );
}

main();
