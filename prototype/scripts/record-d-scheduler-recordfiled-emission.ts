// scripts/record-d-scheduler-recordfiled-emission.ts
//
// One-shot Decision record (CEO session-delegation) authorising Atlas to
// remediate the autonomous-run scheduler's RecordFiled emission. The runtime
// agent scheduler (runtime/run.ts + runtime/agents/*) writes daily run outputs
// as markdown to `archive/owner-inbox/` but most agents do NOT emit a backing
// `RecordFiled` event — only a few (atlas-alco-pack, ravi-intraday-stress,
// atlas-ilaap-run) do. The result is 21 post-Phase-3 Owner Inbox files without
// RecordFiled events flagged by `recon:rms-documents-parity` in the shared
// store: a Principle-1 / Phase-3 "markdown-without-event" violation.
//
// Marc approved the remediation in-session ("y", 2026-06-11) → CEO authority,
// recorded via scrooge:session-delegation.
//
// Authority: D-RMS-PHASE-3; D-PROACTIVE-ESCALATION-SURFACING.
// Author: Scrooge (Chief of Staff / orchestrator)

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const result = recordDecision(
  {
    decisionId: "D-SCHEDULER-RECORDFILED-EMISSION",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Remediate scheduler RecordFiled emission for autonomous-run Owner Inbox snapshots",
    category: "engineering",
    recommendation:
      "Atlas (substrate / platform engineer) makes the runtime agent-output write path emit a backing RecordFiled event (registerKey: documents) for every autonomous run snapshot written to archive/owner-inbox/, consistent with the agents that already do so (atlas-alco-pack, ravi-intraday-stress, atlas-ilaap-run), and backfills the existing post-Phase-3 orphans, restoring recon:rms-documents-parity to green in the shared store.",
    rationale:
      "Phase-3 (D-RMS-PHASE-3) requires every deliverable from 2026-05-17 onward to carry a backing RecordFiled event; markdown-without-event is a Principle-1 violation. recon:rms-documents-parity currently fails with 21 such orphans (autonomous launchd-run snapshots dated 2026-06-10/11). Centralising the emit at the scheduler's output path closes the class, not just the instances.",
    sourceDocHashes: [],
    citations: ["D-RMS-PHASE-3", "D-PROACTIVE-ESCALATION-SURFACING"],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    { ok: true, eventId: result.eventId, decisionId: "D-SCHEDULER-RECORDFILED-EMISSION" },
    null,
    2,
  ),
);
