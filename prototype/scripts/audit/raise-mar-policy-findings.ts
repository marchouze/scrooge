// scripts/audit/raise-mar-policy-findings.ts
//
// One-shot Vera (Internal audit / continuous-assurance engineer, engineering)
// third-line run: raise three AuditFinding events for the MAR (market risk)
// regulation -> policy coverage review (Scrooge-coordinated, 2026-06-08).
//
// Findings are raised by `agent:vera` and addressed to the responsible policy
// owner for remediation routing:
//   Gap 1 -> Helena (CRO; market-risk-policy-v1 owner)        — overstated closure
//   Gap 2 -> Mira   (RegTech; citation owner)                 — stale BA-form numbering
//   Gap 3 -> Mira   (RegTech; returns-register coverage)      — returns unclosed by policy
//
// All three are `process` / `high`: they are policy-integrity defects (an asserted
// closure with no substantive coverage, and a numbering reconciliation that has not
// propagated), i.e. the assertion-vs-liveness defect class the completeness-audit
// workstream exists to catch.
//
// Run against the shared event store (default $HOME/.local/share/bank/event.db):
//   bun run scripts/audit/raise-mar-policy-findings.ts
//
// Authority: Marc (CEO) in-session routing 2026-06-08 (option a — raise findings
// before any policy patch). Third-line independence: Vera reports functionally to
// Thandiwe (Chief Audit Executive, governance).

import { nowUtc } from "../../platform/core/types";
import { recordAuditFinding } from "../../platform/records/helpers";

const RAISED_BY = "agent:vera";

interface FindingSpec {
  readonly agentId: string;
  readonly summary: string;
  readonly detail: string;
  readonly sourceRef: string;
  readonly citations: readonly string[];
}

const FINDINGS: readonly FindingSpec[] = [
  {
    // Gap 1 — overstated closure
    agentId: "helena",
    summary:
      "market-risk-policy-v1 §7 marks ORG-PR-60 'closed' but the 72.5% output floor is absent from the policy body — overstated closure.",
    detail:
      "ORG-PR-60 requires the bank to 'apply the 72.5% output floor if IMA capital falls below the SA-derived floor' and report SA + IMA quarterly. The §7 obligations-closure table marks ORG-PR-60 'IN FORCE — closed' against §4 (FRTB Capital Framework) and §6.2 (Reporting). However the policy body contains no treatment of the output floor: no floor comparison, no floor-constrained capital add-on, no trigger (grep for 'output floor'/'72.5' on the policy body returns nothing; it appears only in Procedures/validation/_methodology-tier-1.md with a [citation: TBC]). Remediation: add an output-floor sub-section to §4 specifying the SA-floor comparison and add-on mechanics, and correct the §7 closure status until substantive coverage exists. Same defect class as the v1-NPA assertion-vs-liveness hole that NPA v2 was written to close.",
    sourceRef: "Policies/market-risk-policy-v1.md §7 / §4 / §6.2",
    citations: ["ORG-PR-60", "market-risk-policy-v1", "D-COMPLETENESS-AUDIT-WORKSTREAM"],
  },
  {
    // Gap 2 — stale BA-form numbering, contradicts the numbering recon + two policies
    agentId: "mira",
    summary:
      "market-risk-policy-v1 cites BA-325/BA-326 as FRTB market-risk capital returns — stale per D-BA-RETURN-FORM-NUMBERING-RECON; contradicts NPA v2 and regulatory-reporting-policy-v1.",
    detail:
      "market-risk-policy-v1 §4.1, §6.2, and the roles section state 'BA-325 (FRTB SA capital) / BA-326 (FRTB IMA capital).' Three live conflicts: (1) D-BA-RETURN-FORM-NUMBERING-RECON established FX-NOP rides BA-310 / BA-110 and that there is no BA-320/325 in that sense; (2) new-product-approval-policy-v2 (PR #1104, merged 2026-06-08) explicitly refreshed 'stale BA-325 -> BA-310/BA-110' and flagged the old numbering as a coverage hole; (3) regulatory-reporting-policy-v1 §100-102 assigns BA-325 = Counterparty Credit Risk (SA-CCR) and BA-326 = CCP exposures — a different meaning from market-risk-policy's 'BA-325 = FRTB SA capital.' The two policies that name BA-325 disagree on what it is. The NPA-v2 fix did not propagate to market-risk-policy or regulatory-reporting-policy. Remediation: propagate the numbering reconciliation into both policies so a single canonical mapping holds bank-wide.",
    sourceRef:
      "Policies/market-risk-policy-v1.md §4.1/§6.2; cross-ref Policies/regulatory-reporting-policy-v1.md §100-102",
    citations: [
      "D-BA-RETURN-FORM-NUMBERING-RECON",
      "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
      "market-risk-policy-v1",
      "regulatory-reporting-policy-v1",
    ],
  },
  {
    // Gap 3 — adopted market-risk return obligations closed by no policy
    agentId: "mira",
    summary:
      "Adopted market-risk return obligations ORG-PR-RETURNS-011/012/013 (BA-310/BA-320/BA-325) are closed by no policy — orphaned at the policy layer.",
    detail:
      "ORG-PR-RETURNS-011 (BA-310 market-risk SA return), -012 (BA-320 alternative market-risk return), and -013 (BA-325 FRTB revised-SA return) are the canonical D5/2025 market-risk return obligations. None is closed by any policy. regulatory-reporting-policy-v1 enumerates BA-100/200/300/325/326 but not BA-310/320, and its BA-325 means SA-CCR (see Gap 2). The substantive market-risk framework (market-risk-policy-v1) covers measurement/capital but does not close the return-filing obligations. This interacts with Gap 2: the BA form numbers in scope are themselves unreconciled. Remediation: after the Gap-2 numbering reconciliation, assign ORG-PR-RETURNS-011/012/013 to regulatory-reporting-policy-v1 (or market-risk-policy §6.2) with correct form numbers.",
    sourceRef:
      "Regulations/_obligations.seed.json (Domain A-PR-RETURNS); Policies/regulatory-reporting-policy-v1.md",
    citations: [
      "ORG-PR-RETURNS-011",
      "ORG-PR-RETURNS-012",
      "ORG-PR-RETURNS-013",
      "regulatory-reporting-policy-v1",
    ],
  },
] as const;

function main(): void {
  const asOf = nowUtc();
  const raised: { gap: number; findingId: string; addressedTo: string }[] = [];

  FINDINGS.forEach((f, i) => {
    const findingId = recordAuditFinding(
      {
        agentId: f.agentId,
        severity: "high",
        category: "process",
        summary: f.summary,
        detail: f.detail,
        sourceRef: f.sourceRef,
        raisedBy: RAISED_BY,
        citations: f.citations,
      },
      asOf,
    );
    raised.push({ gap: i + 1, findingId, addressedTo: `agent:${f.agentId}` });
  });

  console.log("\nMAR policy-coverage AuditFindings raised by agent:vera (third-line):");
  for (const r of raised) {
    console.log(`  Gap ${r.gap} -> ${r.findingId}  (addressed to ${r.addressedTo})`);
  }
  console.log(`\n  As-of: ${asOf}`);
  console.log(`  Total: ${raised.length} AuditFinding events appended to the shared store.`);
}

main();
