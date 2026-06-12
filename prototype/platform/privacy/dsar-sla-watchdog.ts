// platform/privacy/dsar-sla-watchdog.ts
//
// DSAR 30-day SLA watchdog — the privacy-dimension instance of the
// expected-event-watchdog pattern (platform/model-registry/expected-event-
// watchdog.ts, PR #1102 freshness extension): check the live store, surface
// each gap as a `SubstrateAlert{alertClass:"integrity"}` so the cross-page
// data-failure banner shows it, idempotently.
//
// The expected-event watchdog asks "did the event that should exist land?".
// This watchdog asks the deadline-shaped variant: "is any OPEN DSAR past (or
// approaching) its statutory response deadline without a DSARClosed
// disposition?" — the absence of a DSARClosed inside the POPIA s.23 / PAIA
// s.25 window is precisely an expected-event gap with a per-request clock.
//
// Alert semantics:
//   - BREACHED  → severity "high". One stable alertId per dsarId (a breach is
//     a single fact about that request until it is closed; the open register
//     keeps it visible — no daily re-spam).
//   - APPROACHING (≤ APPROACHING_WINDOW_DAYS to deadline) → severity "medium".
//     One stable alertId per dsarId — the early-warning shot.
//
// Idempotent: an alertId already in the log is skipped (append-only audit
// trail), mirroring emitExpectedEventGapAlerts.
//
// Authority: POPIA 4/2013 ss.23–25; PAIA 2/2000 ss.25–26; ORG-PR(IV)-08;
//   D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-TRUSTED-FIGURES-PROGRAM-V1 (watchdog pattern).
// Author: Iris (Information Officer, governance).

import { makeSubstrateAlert } from "../event-store/event-types/platform";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { type DsarRegisterEntry, openDsars } from "./dsar-register";

const ENTITY = "LE-ZA-HOZ-BANK";
const WATCHDOG_ACTOR: Actor = { type: "service", id: "agent:iris:dsar-sla-watchdog" };
const CITATIONS = ["ORG-PR(IV)-08", "D-FX-HELD-DIMS-SEAT-SWEEP"];

/** SubstrateAlert alertId must match /^alert:[a-z]+:[a-z0-9-]+$/. */
function slug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return s.length > 0 ? s : "unidentified";
}

export function breachAlertId(dsarId: string): string {
  return `alert:integrity:dsar-sla-breach-${slug(dsarId)}`;
}

export function approachingAlertId(dsarId: string): string {
  return `alert:integrity:dsar-sla-approaching-${slug(dsarId)}`;
}

export interface DsarSlaGap {
  readonly entry: DsarRegisterEntry;
  readonly kind: "breached" | "approaching";
  readonly alertId: string;
}

/**
 * Every open DSAR whose SLA state warrants an alert at `asOf`. Pure function
 * of the store — no side effects.
 */
export function checkDsarSla(store: EventStore, asOf: string): DsarSlaGap[] {
  const gaps: DsarSlaGap[] = [];
  for (const entry of openDsars(store, asOf)) {
    if (entry.slaState === "breached") {
      gaps.push({ entry, kind: "breached", alertId: breachAlertId(entry.dsarId) });
    } else if (entry.slaState === "approaching") {
      gaps.push({ entry, kind: "approaching", alertId: approachingAlertId(entry.dsarId) });
    }
  }
  return gaps;
}

/**
 * Emit a `SubstrateAlert{alertClass:"integrity"}` for each open DSAR SLA gap.
 * Idempotent on alertId (append-only audit trail). Returns the emitted /
 * skipped dsarIds, mirroring the expected-event watchdog's contract.
 */
export function emitDsarSlaAlerts(
  store: EventStore,
  asOf: string,
): { emitted: string[]; skipped: string[] } {
  const emitted: string[] = [];
  const skipped: string[] = [];

  const existingAlertIds = new Set<string>();
  for (const ev of store.replay({ type: "SubstrateAlert" })) {
    const id = (ev.payload as { alertId?: string }).alertId;
    if (id) existingAlertIds.add(id);
  }

  for (const gap of checkDsarSla(store, asOf)) {
    if (existingAlertIds.has(gap.alertId)) {
      skipped.push(gap.entry.dsarId);
      continue;
    }
    const e = gap.entry;
    const details =
      gap.kind === "breached"
        ? `DSAR SLA BREACH: request ${e.dsarId} (${e.requestKind}, data subject ${e.dataSubjectRef}) received ${e.receivedAt.slice(0, 10)} is OPEN past its response deadline ${e.responseDeadline.slice(0, 10)}${e.extended ? " (already extended once — PAIA s.26 allows no further extension)" : ""} — the POPIA s.23 / PAIA s.25 statutory clock is breached. Owner: Iris (Information Officer, governance).`
        : `DSAR SLA approaching: request ${e.dsarId} (${e.requestKind}, data subject ${e.dataSubjectRef}) received ${e.receivedAt.slice(0, 10)} has ${e.daysToDeadline} day(s) to its response deadline ${e.responseDeadline.slice(0, 10)}${e.extended ? " (extended)" : ""}. Owner: Iris (Information Officer, governance).`;

    store.append(
      makeSubstrateAlert({
        asOf,
        entity: ENTITY,
        actor: WATCHDOG_ACTOR,
        citations: CITATIONS,
        payload: {
          alertId: gap.alertId,
          alertClass: "integrity",
          details,
          severity: gap.kind === "breached" ? "high" : "medium",
        },
      }),
    );
    emitted.push(gap.entry.dsarId);
  }

  return { emitted, skipped };
}
