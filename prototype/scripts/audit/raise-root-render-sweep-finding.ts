// scripts/audit/raise-root-render-sweep-finding.ts
//
// One-shot Vera (Internal audit / continuous-assurance engineer, engineering;
// functionally to Thandiwe, Chief Audit Executive) run: raise + close the
// systemic root-render hygiene finding — the full-population extension of the
// single-file finding F-BEA-20260610-0NH9 (PR #1194).
//
// Population (re-derived from the tree at sweep time): 51 tracked root-level
// record renders (50 .md + 1 PDF, 2026-05-18 → 2026-06-10) sitting at the
// repo root after RMS Phase 4 (D-RMS-PHASE-4) made the registers + document
// store sole canonical. Of these:
//   - 21 had a RecordFiled event in the shared store; only 2 of those had
//     their blob in the PRODUCTION document store (19 dangling references —
//     the #1194 ephemeral-worktree-store failure mode at population scale);
//   - 1 (helena b3-fx-market-risk-measure-review) was filed but the tree copy
//     had drifted (edited by PR #1065 post-filing) and the originally-filed
//     blob is unrecoverable;
//   - 29 had NO RecordFiled event at all (Principle 1 / D-RMS-PHASE-3 gap),
//     12 of them despite having an authored filing script in
//     prototype/scripts/ whose events never reached the shared store.
//
// Remediation (same PR): 19 blobs rescued into the production store
// (hash-proven from tree bytes); 13 filings landed by running the existing
// scripts against the shared store; 17 filings emitted by
// scripts/file-root-record-render-sweep-2026-06-10.ts (16 new incl. the
// binary PDF + 1 drift-supersede v2); 49 renders removed from the tree; 2
// manifest-replay sources moved to archive/root-renders/; 35 one-shot scripts
// guarded against the removed paths via scripts/lib/root-render-filing-guard.ts.
//
// IMPORTANT — run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/audit/raise-root-render-sweep-finding.ts
//
// Authority: D-QUEUE-CLOSEOUT-2026-06-10 residuals; D-RMS-PHASE-4;
//            brief:vera:sweep-tracked-root-level-record-renders-into-rms:2026-06-10.

import { nowUtc } from "../../platform/core/types";
import { recordAuditFinding, recordAuditFindingClosed } from "../../platform/records/helpers";

const RAISED_BY = "agent:vera";
const BRIEF = "brief:vera:sweep-tracked-root-level-record-renders-into-rms:2026-06-10";

function main(): void {
  const asOf = nowUtc();

  const findingId = recordAuditFinding(
    {
      agentId: "scrooge",
      severity: "medium",
      category: "process",
      summary:
        "Systemic root-render hygiene gap (population extension of F-BEA-20260610-0NH9): 51 tracked root-level record renders (50 .md + 1 PDF, 2026-05-18 → 2026-06-10) remained in-tree after RMS Phase 4; 29 had no RecordFiled event at all and 19 of the 21 filed ones had dangling document references (blob only ever existed in an ephemeral dispatch-worktree store).",
      detail:
        "Verified per file against the shared store + production document store. Counts: 21/51 filed (2 fully canonical, 19 dangling blob references, the #1194 failure mode at population scale); 1 filed-but-drifted (2026-06-03_helena_b3-fx-market-risk-measure-review.md edited by PR #1065 after filing; original blob blake3:0180758827f7876147148f66cb59418e08da247c287d180a53650410366b7778 unrecoverable — superseded by record:documents:helena:b3-fx-market-risk-measure-review:v2:2026-06-10); 29/51 never filed, 12 of them despite an authored file-*.ts script whose events only ever reached a worktree-local store (the known excludeHomeDefault default-store trap). Remediation in the same PR: 19 blobs rescued (hash-proven from tree bytes); 30 RecordFiled events emitted (13 via the existing scripts, 16 new via the sweep script incl. the binary attestation-evidence PDF, 1 drift-supersede v2); 49 renders removed from the tree; 2 manifest-replay sources (recordfiled-manifest.json) moved to archive/root-renders/ with sourcePaths repointed so fresh-runner ci:migrate stays green; 35 one-shot scripts guarded via scripts/lib/root-render-filing-guard.ts (file-* scripts skip when the record exists / fail loudly with a blob pointer when not; record-d-* scripts fall back to the canonical blob). OBSERVATIONS (not remediated here): (1) cross-worktree DOCUMENT-store sync remains the substrate gap noted in #1194 — D-CROSS-WORKTREE-EVENT-STORE-SYNC covers the event DB only; this sweep found 19 more dangling references, strengthening the case for an Atlas substrate slice; (2) two Decision events whose cards were filed here (D-MR-1-FX-IPV-TOLERANCE-RECAL, D-OPRISK-ENGINEER-ROLE-LICENCE-DAY) are still absent from the shared store — their record-d-*.ts scripts never ran against it; decision-backfill is Owen's (Company Secretary, governance) call, out of this sweep's scope; (3) left in place as genuine living/non-record files: CLAUDE.md, .gitignore, bounce.sh, dashboard.sh, dedup-mt202-inbound.sh (operational tooling), fic-act-full.txt, popia-full.txt (regulation source text — Plane A reference data, not record renders).",
      sourceRef:
        "repo root (51 dated renders, removed in this PR); prototype/scripts/file-root-record-render-sweep-2026-06-10.ts (per-file table in PR description)",
      raisedBy: RAISED_BY,
      citations: ["D-RMS-PHASE-4", "D-RMS-PHASE-3", "D-QUEUE-CLOSEOUT-2026-06-10", BRIEF],
    },
    asOf,
  );

  recordAuditFindingClosed(
    {
      findingId,
      disposition: "resolved",
      verificationMethod: "source-removed",
      closedBy: RAISED_BY,
      rationale:
        "Full-population remediation in the same PR: every one of the 51 root renders is now canonically held in RMS (RecordFiled event in the shared store whose documentHash resolves in the production document store — re-verified 51/51 post-sweep), the renders are removed from the tree (2 archived for manifest replay), and every script that re-read a removed path is guarded. The two unremediated observations (cross-worktree document-store sync; two missing Decision events) are recorded in the finding detail for Atlas (Core banking platform architect, engineering) and Owen (Company Secretary, governance) respectively.",
      evidenceRef:
        "PR (WS-QUEUE-CLOSEOUT-RESIDUALS, branch vera/sweep-root-record-renders-2026-06-10): 49 deletions + 2 archive moves + sweep/guard scripts; sweep run output 2026-06-10T19:25Z (19 rescued / 17 filed / 0 missing)",
      citations: ["D-RMS-PHASE-4", "D-QUEUE-CLOSEOUT-2026-06-10", BRIEF],
    },
    asOf,
  );

  console.log("\nRoot-render sweep finding raised + closed by agent:vera (third-line):");
  console.log(`  [medium] -> ${findingId}  (addressed to agent:scrooge; resolved/source-removed)`);
  console.log(`  As-of: ${asOf}`);
  console.log(
    `  Store: ${process.env.BANK_EVENT_DB ?? "(default — WARNING: not the shared store)"}`,
  );
}

main();
