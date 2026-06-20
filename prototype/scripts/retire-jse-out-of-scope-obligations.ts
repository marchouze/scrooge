// prototype/scripts/retire-jse-out-of-scope-obligations.ts
//
// WS-JSE-OBLIGATION-SCOPE-RETIREMENT — retire the JSE equities / listing-
// requirements / JSE Clear CCP obligations as OUT OF SCOPE for the bank's
// licence posture.
//
// Authority: D-JSE-OBLIGATION-SCOPE-RETIREMENT (CEO session-delegation
// 2026-06-20) + D-LICENCE-TYPE (indirect, non-clearing IRC participant; does
// not trade JSE equities; not a listed issuer; not a JSE Clear CCP member).
// Author: Mira (Compliance / RegTech engineer, engineering — obligations-
// register curator).
//
// Retires six obligation rows by lifecycle transition — NOT deletion. Each
// retired row stays in the register, visible, with status RETIRED and
// adopted=false. Unlike the Phase-1b duplicate cleanup, there is NO
// supersededBy pointer: this is out-of-scope retirement, not consolidation.
//
//   ORG-MK-09       JSE Equities Rules and Directives                  (equities)
//   ORG-MK-15       JSE Equities Rules trade-record retention sub-rules (equities)
//   ORG-MK-10       JSE Listings Requirements (equity issuers)         (listing)
//   ORG-MK-16       JSE Debt Listings Requirements                     (listing)
//   ORG-JSE-IRC-02  JSE Debt Listings Requirements (IRC market)        (listing)
//   ORG-JSE-IRC-03  JSE Clear Clearing Rules (CCP)                      (ccp)
//
// RETAINED (NOT touched here): ORG-JSE-IRC-01 (in-scope IRC participant rules),
// ORG-MK-03 (FMA+JSE comms-recording), ORG-MK-05 (FMA Ch. X insider-info).
//
// The lifecycle transition posts strictly AFTER the backfill correction stamp
// (backfill-obligations CORRECTION_AT = 2026-06-09) so the buildBankObligations
// fold applies the retirement LAST and keeps adopted=false even after
// backfill:obligations re-emits the seed row at CORRECTION_AT.
//
// A lifecycle transition for an UN-ADOPTED obligation is skipped by the
// projection (no ObligationAdopted base record to fold onto). This script
// fails closed if any target row is not currently adopted in the store: that
// would mean the transition silently no-ops and the row would not render
// RETIRED. (All six are adopted via backfill:obligations; the guard protects
// against future drift.)
//
// Idempotent: skips a row that already carries a `retired` transition.
//
// Run from prototype/ against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/retire-jse-out-of-scope-obligations.ts

import { eventStore } from "../platform/composition";
import {
  type ObligationAdoptedPayload,
  type ObligationLifecycleTransitionedPayload,
  makeObligationLifecycleTransitioned,
} from "../platform/event-store/event-types/obligation-lifecycle";
import type { Actor } from "../platform/event-store/types";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:mira:jse-scope-retirement" };
// Strictly after backfill-obligations CORRECTION_AT (2026-06-09) so the fold
// applies the retirement last. Dated to the decision day.
const TRANSITION_AT = "2026-06-20T10:00:00Z";
const CITATIONS = ["D-JSE-OBLIGATION-SCOPE-RETIREMENT", "P1-EVENTS-AS-TRUTH", "D-LICENCE-TYPE"];

interface Retirement {
  readonly obligationId: string;
  /** Status before the transition (the seed reviewStatus carried at adoption). */
  readonly fromStatus: string;
  readonly reason: string;
}

const RETIREMENTS: readonly Retirement[] = [
  {
    obligationId: "ORG-MK-09",
    fromStatus: "reviewed-confirmed",
    reason:
      "Out of scope per D-LICENCE-TYPE — the bank is not a JSE Equities trading member and does not trade JSE equities; the JSE Equities Rules and Directives do not bind.",
  },
  {
    obligationId: "ORG-MK-15",
    fromStatus: "reviewed-confirmed",
    reason:
      "Out of scope per D-LICENCE-TYPE — trade-record-retention sub-rules of the JSE Equities Rules; the bank is not a JSE Equities trading member, so they do not bind.",
  },
  {
    obligationId: "ORG-MK-10",
    fromStatus: "reviewed-confirmed",
    reason:
      "Out of scope per D-LICENCE-TYPE — the bank is not a listed issuer; the JSE Listings Requirements (equity issuers) do not bind.",
  },
  {
    obligationId: "ORG-MK-16",
    fromStatus: "reviewed-confirmed",
    reason:
      "Out of scope per D-LICENCE-TYPE — the bank is not a listed debt issuer; the JSE Debt Listings Requirements do not bind.",
  },
  {
    obligationId: "ORG-JSE-IRC-02",
    fromStatus: "reviewed-confirmed",
    reason:
      "Out of scope per D-LICENCE-TYPE — JSE Debt Listings Requirements on the IRC market; the bank is not a listed issuer, so they do not bind. The in-scope IRC participant rules remain at ORG-JSE-IRC-01.",
  },
  {
    obligationId: "ORG-JSE-IRC-03",
    fromStatus: "reviewed-confirmed",
    reason:
      "Out of scope per D-LICENCE-TYPE — JSE Clear Clearing Rules (CCP); the bank is a non-clearing participant and is not a JSE Clear CCP member (clears via a clearing member under a tripartite arrangement where required).",
  },
];

function isAdopted(obligationId: string): boolean {
  for (const ev of eventStore.replay({ type: "ObligationAdopted" })) {
    if ((ev.payload as ObligationAdoptedPayload).obligationId === obligationId) return true;
  }
  return false;
}

function alreadyRetired(obligationId: string): boolean {
  for (const ev of eventStore.replay({ type: "ObligationLifecycleTransitioned" })) {
    const p = ev.payload as ObligationLifecycleTransitionedPayload;
    if (p.obligationId === obligationId && p.transition === "retired") return true;
  }
  return false;
}

function main(): void {
  let emitted = 0;
  let skipped = 0;
  const notAdopted: string[] = [];

  for (const r of RETIREMENTS) {
    if (alreadyRetired(r.obligationId)) {
      console.log(`  skip  ${r.obligationId} — already retired (idempotent).`);
      skipped++;
      continue;
    }
    if (!isAdopted(r.obligationId)) {
      // A retired transition on an un-adopted obligation is folded away by the
      // projection — fail closed rather than emit a silent no-op.
      notAdopted.push(r.obligationId);
      continue;
    }
    const payload: ObligationLifecycleTransitionedPayload = {
      obligationId: r.obligationId,
      transition: "retired",
      fromStatus: r.fromStatus,
      toStatus: "RETIRED",
      detail: r.reason,
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
    console.log(`  emit  ${r.obligationId} → RETIRED [${event.event_id}].`);
    emitted++;
  }

  if (notAdopted.length > 0) {
    throw new Error(
      `retire-jse-out-of-scope-obligations: ${notAdopted.length} target row(s) are NOT currently adopted in the store, so a retired transition would be skipped by the projection and the row would not render RETIRED: ${notAdopted.join(", ")}. Run backfill:obligations first, or investigate the drift.`,
    );
  }

  console.log(
    `\nretire-jse-out-of-scope-obligations: ${emitted} retired transition(s) emitted, ${skipped} skipped (already retired). 6 JSE equities/listing/CCP rows out of scope per D-LICENCE-TYPE; rows stay visible as RETIRED / adopted=false.`,
  );
}

main();
