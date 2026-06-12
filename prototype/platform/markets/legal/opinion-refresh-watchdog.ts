// platform/markets/legal/opinion-refresh-watchdog.ts
//
// Jurisdictional-opinion annual-refresh watchdog (#1102 expected-event-
// watchdog pattern, applied to the legal dimension of the FX umbrella NPA).
//
// Close-out netting under an ISDA Master is only enforceable where a CURRENT
// jurisdictional netting opinion supports it (ISDA 2002 MA §6; Imani G-9 §5).
// This watchdog asserts: every counterparty with an ISDA Master of record
// (`LegalDocumentationSigned{agreementType: isda-2002|isda-2025}`) is covered
// by a `JurisdictionalOpinionRefreshed` whose `opinionDate` is within the
// last 12 months. A missing or stale opinion is a MONITORING finding — a
// medium-severity `SubstrateAlert{alertClass:"integrity"}` on the data-failure
// surface — NOT an order-path block (the refresh SLA is a monitoring control;
// the order-path gate is legal-documentation-gate.ts).
//
// Coverage semantics mirror the event schema: an opinion with
// `coversCounterparties: []` is class-level (e.g. "all Banks-Act-registered SA
// institutions") and covers every counterparty; a non-empty list covers only
// the listed Party URNs.
//
// Alert idempotency: missing-opinion alerts use a stable per-counterparty
// alertId (one-shot until resolved); stale-opinion alerts are month-stamped so
// an SLA that stays breached re-surfaces monthly rather than daily-spamming or
// being suppressed forever — the annual-SLA analogue of #1102's date-stamped
// staleGapAlertId.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//            D-TRUSTED-FIGURES-PROGRAM-V1 (watchdog pattern);
//            Imani G-9 (2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md §5).
// Author: Imani (Legal-as-code engineer, engineering) — governance owner
//         Devon (COO, interim, pending future GC).

import { makeSubstrateAlert } from "../../event-store/event-types/platform";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";

const ENTITY = "LE-ZA-HOZ-BANK";
const WATCHDOG_ACTOR: Actor = { type: "service", id: "agent:imani:opinion-refresh-watchdog" };
const CITATIONS = ["D-FX-HELD-DIMS-SEAT-SWEEP", "D-TRUSTED-FIGURES-PROGRAM-V1"];

/** Refresh window: an opinion older than this many months is stale (annual SLA). */
export const OPINION_REFRESH_WINDOW_MONTHS = 12;

/** ISDA Master forms whose netting reliance requires a current opinion. */
const ISDA_MASTER_TYPES = ["isda-2002", "isda-2025"] as const;

export interface OpinionRefreshFinding {
  readonly counterpartyId: string;
  /** "missing" — no opinion covers the counterparty at all; "stale" — the freshest covering opinion is older than the window. */
  readonly kind: "missing" | "stale";
  /** For "stale": opinionDate of the freshest covering opinion. */
  readonly latestOpinionDate?: string;
  readonly detail: string;
}

/** ISO date exactly `months` months before `asOf` (calendar-month arithmetic). */
function monthsBefore(asOf: string, months: number): string {
  const d = new Date(asOf);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

/** Counterparties with an ISDA Master of record (latest signing per cp). */
export function counterpartiesWithIsdaMaster(store: Pick<EventStore, "replay">): string[] {
  const out = new Set<string>();
  for (const ev of store.replay({ type: "LegalDocumentationSigned" })) {
    const p = ev.payload as { counterpartyId?: string; agreementType?: string };
    if (!p.counterpartyId) continue;
    if (!ISDA_MASTER_TYPES.includes(p.agreementType as (typeof ISDA_MASTER_TYPES)[number]))
      continue;
    out.add(p.counterpartyId);
  }
  return [...out].sort();
}

/**
 * Evaluate the annual opinion-refresh SLA for every counterparty-with-ISDA as
 * of `asOf`. Pure read — emission is `emitOpinionRefreshGapAlerts`.
 */
export function checkOpinionRefresh(
  store: Pick<EventStore, "replay">,
  asOf: string,
): OpinionRefreshFinding[] {
  const counterparties = counterpartiesWithIsdaMaster(store);
  if (counterparties.length === 0) return [];

  // Freshest class-level opinionDate + freshest per-counterparty opinionDate.
  let freshestClassOpinion: string | null = null;
  const freshestByCp = new Map<string, string>();
  for (const ev of store.replay({ type: "JurisdictionalOpinionRefreshed" })) {
    const p = ev.payload as { opinionDate?: string; coversCounterparties?: string[] };
    const opinionDate = p.opinionDate ?? "";
    if (!opinionDate) continue;
    const covers = Array.isArray(p.coversCounterparties) ? p.coversCounterparties : [];
    if (covers.length === 0) {
      if (freshestClassOpinion === null || opinionDate > freshestClassOpinion) {
        freshestClassOpinion = opinionDate;
      }
      continue;
    }
    for (const cp of covers) {
      const prev = freshestByCp.get(cp);
      if (prev === undefined || opinionDate > prev) freshestByCp.set(cp, opinionDate);
    }
  }

  const windowFloor = monthsBefore(asOf, OPINION_REFRESH_WINDOW_MONTHS).slice(0, 10);
  const findings: OpinionRefreshFinding[] = [];
  for (const cp of counterparties) {
    const cpDate = freshestByCp.get(cp);
    const best =
      cpDate !== undefined && (freshestClassOpinion === null || cpDate > freshestClassOpinion)
        ? cpDate
        : freshestClassOpinion;
    if (best === null || best === undefined) {
      findings.push({
        counterpartyId: cp,
        kind: "missing",
        detail: `counterparty ${cp} relies on an ISDA Master of record but NO JurisdictionalOpinionRefreshed covers it — close-out netting reliance has no current opinion anchor (ISDA 2002 MA §6; Imani G-9 §5)`,
      });
      continue;
    }
    if (best.slice(0, 10) < windowFloor) {
      findings.push({
        counterpartyId: cp,
        kind: "stale",
        latestOpinionDate: best,
        detail: `counterparty ${cp} has an ISDA Master of record but its freshest covering JurisdictionalOpinionRefreshed is dated ${best.slice(0, 10)} — older than the ${OPINION_REFRESH_WINDOW_MONTHS}-month annual refresh window (ISDA 2002 MA §6; Imani G-9 §5)`,
      });
    }
  }
  return findings;
}

/** Slug-safe fragment for a SubstrateAlert alertId ([a-z0-9-] only). */
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable alertId for a MISSING-opinion finding (one-shot until resolved). */
export function missingOpinionAlertId(counterpartyId: string): string {
  return `alert:integrity:isda-opinion-missing-${slug(counterpartyId)}`;
}

/** Month-stamped alertId for a STALE-opinion finding (re-alerts monthly while breached). */
export function staleOpinionAlertId(counterpartyId: string, asOf: string): string {
  return `alert:integrity:isda-opinion-stale-${slug(counterpartyId)}-${asOf.slice(0, 7)}`;
}

/**
 * Emit a medium-severity `SubstrateAlert{alertClass:"integrity"}` for each
 * open opinion-refresh finding. Idempotent by alertId. MEDIUM, not high: the
 * refresh SLA is a monitoring control, not an order-path block — it must
 * surface on the data-failure banner without tripping the CEO-escalation
 * (high+) channel.
 */
export function emitOpinionRefreshGapAlerts(
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

  for (const finding of checkOpinionRefresh(store, asOf)) {
    const alertId =
      finding.kind === "missing"
        ? missingOpinionAlertId(finding.counterpartyId)
        : staleOpinionAlertId(finding.counterpartyId, asOf);
    if (existingAlertIds.has(alertId)) {
      skipped.push(alertId);
      continue;
    }
    store.append(
      makeSubstrateAlert({
        asOf,
        entity: ENTITY,
        actor: WATCHDOG_ACTOR,
        citations: CITATIONS,
        payload: {
          alertId,
          alertClass: "integrity",
          details: `ISDA opinion-refresh SLA: ${finding.detail}. Owner: Imani (Legal-as-code engineer, engineering); governance: Devon (COO, interim, pending future GC). Monitoring control — NOT an order-path block.`,
          severity: "medium",
        },
      }),
    );
    emitted.push(alertId);
  }

  return { emitted, skipped };
}
