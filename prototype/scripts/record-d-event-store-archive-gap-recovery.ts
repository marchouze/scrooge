// scripts/record-d-event-store-archive-gap-recovery.ts
//
// Records D-EVENT-STORE-ARCHIVE-GAP-RECOVERY (approved) — the 2026-06-12
// Principle-1 archive-tier integrity recovery: rebuild + register the missing
// 203832–222995 cold partition (19,164 fixture events) from the 2026-05-27
// backup, and register the 7 orphan archive files (seq 1–123431) that were on
// disk but absent from the registry. After both, recon:event-store-append-only
// is green and all 17 partitions pass SHA-256 integrity verification.
//
// Authority: CEO (marc@tgv.co.za) via Scrooge session delegation 2026-06-12
// ("c" — pick up the orphan-archive chip). Accountable seat: Atlas (substrate
// engineer; owns D-EVENT-STORE-SCALING-PHASE-5).
//
// Run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/record-d-event-store-archive-gap-recovery.ts

import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const { eventId } = recordDecision(
  {
    decisionId: "D-EVENT-STORE-ARCHIVE-GAP-RECOVERY",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Event-store archive-tier integrity recovery — close the 203832–222995 gap + register 7 orphan archives",
    category: "engineering",
    recommendation:
      "Rebuild the missing 203832–222995 cold partition (19,164 build-phase-fixture events) from the 2026-05-27 full backup and register it; register the 7 orphan archive files (seq 1–123431) present on disk but absent from archive_partitions. No events-table mutation — registry rows + recovered cold file only.",
    rationale:
      "recon:event-store-append-only failed with archive_partitions:sequence-gap (Principle-1 breach): rows 203832–222995 were in neither the hot store nor any registered partition. Forensics showed the rows were deleted from hot between 2026-05-27 and 2026-05-29 by a pre-Phase-5-hardening extraction that never registered a partition; the range survives intact in two full backups. Per Principle 1 the chain is restored rather than the loss accepted. The 7 orphan archives are the sole archive copy of the earliest fixture events; each was registered only after passing range-disjointness and event_id-collision guards. Post-fix: recon green, 17/17 partitions SHA-verified, archive tier spans seq 1. Scripts are idempotent and no-op on a clean store.",
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  },
  "2026-06-12T00:00:00.000Z",
);

logger.info({ eventId }, "recorded D-EVENT-STORE-ARCHIVE-GAP-RECOVERY (approved)");
