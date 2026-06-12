// prototype/scripts/retire-obligation-duplicates-phase-1b.ts
//
// WS-OBLIGATION-CLEANUP Phase-1b — duplication / fragmentation remediation.
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP. Author: Mira (Compliance /
// RegTech engineer, obligations-register curator).
//
// Retires the three duplicate/fragmented obligation rows surfaced by the
// Phase-0 audit (prototype/platform/obligations/cleanup-audit-findings.json)
// by lifecycle transition — NOT deletion. Each retired row stays in the
// register, visible, with status SUPERSEDED and adopted=false, carrying a
// `supersededBy` pointer to its surviving canonical row. Register row count
// stays 567 (3 SUPERSEDED, 0 deleted).
//
//   D1/2015 recovery-plan fragmentation:
//     ORG-PR-30  → superseded by ORG-PR-35 (consolidated clause already in
//                  ORG-BNK-RECOVERY-CONS; survivor is the solo-basis row)
//     ORG-PR-53  → superseded by ORG-PR-35 (NOT_APPLICABLE near-verbatim dup)
//     [survivor   ORG-PR-35 — IN_FORCE, precise D1/2015 instrument anchor,
//                  board-approved minimum-requirements framing]
//
//   D7/2020 SA-CCR leverage cross-family duplicate:
//     ORG-PR-66  → superseded by ORG-PA-049 (PA-family row carries the hard
//                  URN urn:reg:za:banks-act-94-1990:s6.6a+directive:d7-2020;
//                  PR-66 carried only a synthetic urn:obligation:* URN)
//
// The lifecycle transition posts strictly AFTER the backfill correction stamp
// (CORRECTION_AT = 2026-06-09) so the `buildBankObligations` fold applies the
// supersession last and keeps adopted=false even after backfill:obligations
// re-emits the SUPERSEDED-annotated seed row.
//
// Idempotent: skips a row that already carries a `superseded` transition.
//
// Run from prototype/ against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/retire-obligation-duplicates-phase-1b.ts

import { eventStore } from "../platform/composition";
import {
  makeObligationLifecycleTransitioned,
  type ObligationLifecycleTransitionedPayload,
} from "../platform/event-store/event-types/obligation-lifecycle";
import type { Actor } from "../platform/event-store/types";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:mira:obligation-cleanup-phase-1b" };
// Strictly after backfill-obligations CORRECTION_AT (2026-06-09) so the fold
// applies the supersession last.
const TRANSITION_AT = "2026-06-12T00:00:00Z";
const CITATIONS = [
  "D-OBLIGATIONS-REGISTER-CLEANUP",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

interface Retirement {
  readonly obligationId: string;
  readonly supersededBy: string;
  readonly fromStatus: string;
  readonly reason: string;
}

const RETIREMENTS: readonly Retirement[] = [
  {
    obligationId: "ORG-PR-30",
    supersededBy: "ORG-PR-35",
    fromStatus: "PLANNED",
    reason:
      "D1/2015 recovery-plan fragmentation: consolidated-basis clause already carried by ORG-BNK-RECOVERY-CONS; consolidated to solo-basis survivor ORG-PR-35.",
  },
  {
    obligationId: "ORG-PR-53",
    supersededBy: "ORG-PR-35",
    fromStatus: "NOT_APPLICABLE",
    reason:
      "D1/2015 recovery-plan fragmentation: near-verbatim duplicate of the board-approved recovery-plan obligation; consolidated to solo-basis survivor ORG-PR-35.",
  },
  {
    obligationId: "ORG-PR-66",
    supersededBy: "ORG-PA-049",
    fromStatus: "IN_FORCE",
    reason:
      "True cross-family duplicate of the D7/2020 SA-CCR leverage-ratio obligation; the PA-family ORG-PA-049 carries the hard URN and is the survivor. Policy coverage preserved via ORG-PA-049 fulfilmentPolicy 'Capital Management Policy'.",
  },
];

function alreadySuperseded(obligationId: string): boolean {
  for (const ev of eventStore.replay({ type: "ObligationLifecycleTransitioned" })) {
    const p = ev.payload as ObligationLifecycleTransitionedPayload;
    if (p.obligationId === obligationId && p.transition === "superseded") return true;
  }
  return false;
}

function main(): void {
  let emitted = 0;
  let skipped = 0;
  for (const r of RETIREMENTS) {
    if (alreadySuperseded(r.obligationId)) {
      console.log(`  skip  ${r.obligationId} — already superseded (idempotent).`);
      skipped++;
      continue;
    }
    const payload: ObligationLifecycleTransitionedPayload = {
      obligationId: r.obligationId,
      transition: "superseded",
      fromStatus: r.fromStatus,
      toStatus: "SUPERSEDED",
      detail: `supersededBy:${r.supersededBy} — ${r.reason}`,
      at: TRANSITION_AT,
    };
    const event = makeObligationLifecycleTransitioned({
      asOf: TRANSITION_AT,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload,
    });
    eventStore.append(event);
    console.log(`  emit  ${r.obligationId} → SUPERSEDED (supersededBy ${r.supersededBy}) [${event.event_id}].`);
    emitted++;
  }
  console.log(
    `\nretire-obligation-duplicates-phase-1b: ${emitted} superseded transition(s) emitted, ${skipped} skipped (already superseded). Register row count unchanged (567).`,
  );
}

main();
