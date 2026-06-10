// scripts/audit/raise-queue-closeout-hygiene-findings.ts
//
// One-shot Vera (Internal audit / continuous-assurance engineer, engineering;
// functionally to Thandiwe, Chief Audit Executive) run: raise + close the two
// 2026-06-10 queue-closeout hygiene findings. Both were independently
// verified before raising; both remediations are mechanical and land in the
// same PR as this script, so each finding is raised and immediately closed
// with the remediation evidence (raise/close-in-same-PR per the dispatch
// brief brief:vera:raise-remediate-two-queue-closeout-hygiene-findi:2026-06-10).
//
//   H1 -> bea     — PR #1189 left the closure-record markdown render at the
//                   repo root after RMS Phase 4 retired in-tree record
//                   markdown. Remediation: blob verified/copied into the
//                   production document store, root file removed per the
//                   2026-06-08 stray-root-advisory precedent, filing script
//                   guarded against the removed path.
//   H2 -> camille — regulatory-reporting-policy-v1 cited ghost obligation id
//                   ORG-PR-41 (renamed ORG-FC-24 in obligations-register
//                   v1.28); the PR #1187 obligation→policy fold skipped the
//                   edge. Remediation: live citations corrected to ORG-FC-24.
//
// IMPORTANT — run against the SHARED canonical store, not the local working
// store. `platform/composition` resolves with excludeHomeDefault:true, so
// without an explicit BANK_EVENT_DB this writes to the per-worktree local
// store. Run as:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/audit/raise-queue-closeout-hygiene-findings.ts
//
// Authority: D-QUEUE-CLOSEOUT-2026-06-10 (CEO, 2026-06-10) — residuals ledger;
// WS-QUEUE-CLOSEOUT-RESIDUALS. Third-line independence: Vera reports
// functionally to Thandiwe (CAE).

import { nowUtc } from "../../platform/core/types";
import { recordAuditFinding, recordAuditFindingClosed } from "../../platform/records/helpers";

const RAISED_BY = "agent:vera";

function main(): void {
  const asOf = nowUtc();

  // -------------------------------------------------------------------------
  // H1 — closure-record markdown left at repo root (PR #1189)
  // -------------------------------------------------------------------------
  const h1 = recordAuditFinding(
    {
      agentId: "bea",
      severity: "low",
      category: "process",
      summary:
        "PR #1189 committed the closure-record markdown render 2026-06-10_bea_irs-tail-closure-b-irs-disallowances-b-irs-multicurve.md at the repo root; RMS Phase 4 (D-RMS-PHASE-4) retired in-tree record markdown — the canonical copy is the RecordFiled event + document-store blob.",
      detail:
        "Verified: RecordFiled event 74cc7968-95c9-49e0-ba39-8e4aadef37f0 (recordId record:documents:bea:irs-tail-closure-disallowances-multicurve:2026-06-10, blake3:8cb3a86e717c01a47e39c2205143c06b2951e368cb7878ba4fd1bcb798d976e6) exists in the shared store and the blob content is byte-identical to the in-tree file. Precedent (2026-06-08): the two stray root advisories (record:documents:scrooge:mar-policy-representation-advisory:2026-06-04 / record:documents:scrooge:principle-2-capability-to-procedure-review:2026-06-04) were filed as RecordFiled then removed from the tree, with blobs resident in the production document store. Deviation found during verification: Bea's blob existed ONLY in the ephemeral dispatch worktree's local document store (cross-worktree event-store sync per D-CROSS-WORKTREE-EVENT-STORE-SYNC covers the event DB but NOT document blobs — substrate-gap observation for Atlas); the blob was copied into the production store before removal so the RecordFiled reference resolves. Filing script prototype/scripts/file-bea-irs-tail-closure.ts guarded against the removed root path (idempotency gate already prevents re-read against the canonical store).",
      sourceRef:
        "repo root 2026-06-10_bea_irs-tail-closure-b-irs-disallowances-b-irs-multicurve.md (PR #1189); prototype/scripts/file-bea-irs-tail-closure.ts",
      raisedBy: RAISED_BY,
      citations: ["D-RMS-PHASE-4", "D-QUEUE-CLOSEOUT-2026-06-10", "D-RMS-PHASE-3"],
    },
    asOf,
  );

  recordAuditFindingClosed(
    {
      findingId: h1,
      disposition: "resolved",
      verificationMethod: "source-removed",
      closedBy: RAISED_BY,
      rationale:
        "Mechanical remediation in the same PR per the 2026-06-08 stray-root-advisory precedent: document-store blob blake3:8cb3a86e717c01a47e39c2205143c06b2951e368cb7878ba4fd1bcb798d976e6 verified byte-identical to the tree copy and placed in the production document store; root markdown removed from the tree (git rm); filing script now fails loudly with a document-store pointer if re-run against a fresh store. Canonical record remains RecordFiled 74cc7968-95c9-49e0-ba39-8e4aadef37f0.",
      evidenceRef:
        "PR (WS-QUEUE-CLOSEOUT-RESIDUALS, branch worktree-agent-a58e7cd12f6212cf6): deletion of 2026-06-10_bea_irs-tail-closure-b-irs-disallowances-b-irs-multicurve.md + guard in prototype/scripts/file-bea-irs-tail-closure.ts",
      citations: ["D-RMS-PHASE-4", "D-QUEUE-CLOSEOUT-2026-06-10"],
    },
    asOf,
  );

  // -------------------------------------------------------------------------
  // H2 — ghost obligation citation ORG-PR-41 in regulatory-reporting-policy-v1
  // -------------------------------------------------------------------------
  const h2 = recordAuditFinding(
    {
      agentId: "camille",
      severity: "medium",
      category: "process",
      summary:
        "regulatory-reporting-policy-v1 cited ghost obligation id ORG-PR-41 — renamed ORG-FC-24 in obligations-register v1.28 (D4/2022 reclassified Domain A→B: AML/CFT ML/TF/PF risk return under FIC Act s.43A(3), not a prudential BA-return obligation) — so the PR #1187 obligation→policy fold skipped 1 IMPLEMENTED_BY edge.",
      detail:
        "Verified: the register holds no ORG-PR-41 row; ORG-FC-24 (urn:obligation:bank:fc:pa-d4-2022-aml-cft-reporting:v1, owner cco) is the renamed row and its linked-artefacts column already anticipates 'Regulatory Reporting Policy (planned)' — ghost-citation case, not a missing register row, so no escalation to Zara (Chief Compliance Officer, governance) for register authoring is required. Disposition: citation fixed in place (summary 'Closes obligations' list — the fold's harvest source — plus the five live body citations; historical v1 change-log row retained per the numbering-history convention). RESIDUAL for the policy owner Camille (Chief Financial Officer, governance) at next policy review: §3 still characterises the D4/2022 return content as operational-risk/market-risk/credit-large-exposures categories — the superseded prudential reading; the instrument is an ML/TF/PF risk return and ownership of the underlying obligation moved to the CCO seat (Zara/Mira/Iris per register v1.28), so §3's content description and the CFO/CCO seat split for this return need owner-level recharacterisation.",
      sourceRef:
        "Policies/regulatory-reporting-policy-v1.md (summary + §1, §3, §4, §8 closure table); Regulations/_obligations-register.md v1.28 note + ORG-FC-24 row; obligation-policy fold (PR #1187)",
      raisedBy: RAISED_BY,
      citations: ["ORG-FC-24", "regulatory-reporting-policy-v1", "D-QUEUE-CLOSEOUT-2026-06-10"],
    },
    asOf,
  );

  recordAuditFindingClosed(
    {
      findingId: h2,
      disposition: "resolved",
      verificationMethod: "evidence-review",
      closedBy: RAISED_BY,
      rationale:
        "Ghost-citation case confirmed (register rename ORG-PR-41 → ORG-FC-24, v1.28) and mechanically remediated in the same PR: all live citations in regulatory-reporting-policy-v1 corrected to ORG-FC-24 with the reclassification noted; the fold's harvest source (frontmatter summary) now resolves to an existing Obligation node, healing the skipped IMPLEMENTED_BY edge at next graph seed. Residual §3 content recharacterisation flagged to the policy owner in the finding detail — owner-level work at next policy review, outside this mechanical scope.",
      evidenceRef:
        "PR (WS-QUEUE-CLOSEOUT-RESIDUALS, branch worktree-agent-a58e7cd12f6212cf6): Policies/regulatory-reporting-policy-v1.md citation corrections",
      citations: ["ORG-FC-24", "D-QUEUE-CLOSEOUT-2026-06-10"],
    },
    asOf,
  );

  console.log("\nQueue-closeout hygiene findings raised + closed by agent:vera (third-line):");
  console.log(`  H1 [low]    -> ${h1}  (addressed to agent:bea; resolved/source-removed)`);
  console.log(`  H2 [medium] -> ${h2}  (addressed to agent:camille; resolved/evidence-review)`);
  console.log(`\n  As-of: ${asOf}`);
  console.log(
    `  Store: ${process.env.BANK_EVENT_DB ?? "(default — WARNING: not the shared store)"}`,
  );
}

main();
