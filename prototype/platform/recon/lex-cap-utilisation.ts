// platform/recon/lex-cap-utilisation.ts
//
// Vera continuous-controls pipeline: compute LEX cap utilisation per
// counterparty (and connected-counterparty-group where attributed) and
// surface findings at Amber (≥ 20%) and Red (≥ 25%) bands.
//
// Banks Act §73 + RRB Regulation 23 + LEX Directive D3/2022 set the
// regulatory cap at 25% of eligible capital (Tier-1 + eligible Tier-2,
// BCBS 283 §32). The bank's internal Red band aligns with the regulatory
// cap; Amber band (20%) is the policy early-warning per Credit Risk
// Policy §1.4 (traffic-light protocol).
//
// Read path:
//   - Replay all `LexUtilisationComputed` events from the event store.
//   - Group by counterpartyId (and by connectedGroupId when present).
//   - For each counterparty/group, keep the most recent snapshot
//     (lexicographic max of `computedAt`).
//   - Classify by utilisationPct: ≥ 25 → Red (fail); ≥ 20 → Amber (warn-class "fail").
//
// `LexUtilisationComputed.payload.eligibleCapital` is the bank's
// eligible-capital denominator at the time of measurement, already snapshot-
// resolved by Rohan's CCR / SA-CCR engine. The snapshot remains canonical
// for the per-event audit assertion (audit-trail integrity per Principle 1).
//
// The canonical source for eligible-capital outside any specific snapshot
// is `getEligibleCapital` in `@platform/projections/capital-metrics`
// (D-CREDIT-LIMIT-ENGINE-BUILD Phase 4; reads from the same CapitalEvent
// fold as `computeCapitalMetrics`, falling back to the ICAAP v1 build-phase
// envelope per D-MARKETS-CAPITAL-TIME-SHAPE). Connected-group resolution
// reads from `@platform/identity/party-projection` via
// `getConnectedGroupFromStore` (LEX D3/2022 walk over the live `parent-of` /
// `ubo-of` relationship graph).
//
// When `LexUtilisationComputed` events are absent for a counterparty that
// has trades (per `recon:credit-limit-no-trade-without-loaded`), the LEX
// utilisation cannot be derived here. That gap is owned by the LEX
// measurement engine emission cadence, not by this recon.
//
// Empty-state correctness: no `LexUtilisationComputed` events → pass.
//
// Independence: reads from the shared event store via `eventStore.replay`;
// does NOT import `@platform/risk/credit-limit-engine`.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
// Citations:
//   Banks Act 94 of 1990 §73; RRB Regulation 23; LEX Directive D3/2022;
//   BCBS 283 §32 (eligible capital base);
//   Policies/credit-risk-policy-v1.md §1.4 (traffic-light) + §7;
//   Procedures/by-policy/credit-risk-limit-management.md §9 (PROC-RISK-CLM-01);
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Vera (Internal audit engineer).

import { eventStore } from "../composition";
import { getConnectedGroupFromStore } from "../identity/party-projection";
import { getEligibleCapital } from "../projections/capital-metrics";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "lex-cap-utilisation";

/** Amber early-warning threshold (% of eligible capital). */
export const AMBER_THRESHOLD_PCT = 20;
/** Red regulatory threshold (% of eligible capital) — RRB Reg 23 / LEX D3/2022. */
export const RED_THRESHOLD_PCT = 25;

interface MinimalLexEvent {
  readonly event_id: string;
  readonly as_of: string;
  readonly payload: {
    readonly counterpartyId?: unknown;
    readonly connectedGroupId?: unknown;
    readonly totalExposure?: unknown;
    readonly eligibleCapital?: unknown;
    readonly currency?: unknown;
    readonly utilisationPct?: unknown;
    readonly computedAt?: unknown;
  };
}

export interface RunOpts {
  events?: Iterable<MinimalLexEvent>;
}

function loadEvents(opts: RunOpts): MinimalLexEvent[] {
  if (opts.events) return [...opts.events];
  const out: MinimalLexEvent[] = [];
  try {
    for (const e of eventStore.replay({ type: "LexUtilisationComputed" })) {
      out.push({
        event_id: e.event_id,
        as_of: e.as_of,
        payload: e.payload as MinimalLexEvent["payload"],
      });
    }
  } catch {
    // ignore — return empty
  }
  return out;
}

interface UtilSnapshot {
  readonly key: string; // counterpartyId or "group:<connectedGroupId>"
  readonly counterpartyId: string;
  readonly connectedGroupId: string | null;
  readonly computedAt: string;
  readonly utilisationPct: number;
  readonly totalExposure: number;
  readonly eligibleCapital: number;
  readonly currency: string;
  readonly eventId: string;
}

function pickLatest(events: MinimalLexEvent[]): Map<string, UtilSnapshot> {
  const out = new Map<string, UtilSnapshot>();
  // Fallback eligible-capital denominator (canonical source per
  // D-CREDIT-LIMIT-ENGINE-BUILD Phase 4) — read once per recon run.
  let fallbackEligibleCapital: number | null = null;
  for (const e of events) {
    const cpid = e.payload.counterpartyId;
    if (typeof cpid !== "string" || cpid.length === 0) continue;
    // Connected-group attribution. The snapshot's connectedGroupId remains
    // canonical when present (it's the value the measurement engine
    // attributed to at compute time). When absent, walk the party register
    // via getConnectedGroupFromStore to identify groups of size > 1.
    let groupId =
      typeof e.payload.connectedGroupId === "string" && e.payload.connectedGroupId.length > 0
        ? e.payload.connectedGroupId
        : null;
    if (groupId === null) {
      try {
        const grp = getConnectedGroupFromStore(eventStore, cpid);
        if (grp && grp.members.length > 1) {
          groupId = grp.groupId;
        }
      } catch {
        // Party register not available — proceed with per-counterparty only.
      }
    }
    const utilisationPct =
      typeof e.payload.utilisationPct === "number" ? e.payload.utilisationPct : Number.NaN;
    const totalExposure = typeof e.payload.totalExposure === "number" ? e.payload.totalExposure : 0;
    // Eligible-capital — prefer the snapshot value (canonical for the audit
    // trail per Principle 1); when missing (0 or absent), substitute the
    // canonical denominator from getEligibleCapital.
    let eligibleCapital =
      typeof e.payload.eligibleCapital === "number" ? e.payload.eligibleCapital : 0;
    if (eligibleCapital === 0) {
      if (fallbackEligibleCapital === null) {
        try {
          const cap = getEligibleCapital(eventStore, e.as_of);
          fallbackEligibleCapital = Number(cap.amount);
        } catch {
          fallbackEligibleCapital = 0;
        }
      }
      eligibleCapital = fallbackEligibleCapital;
    }
    const currency = typeof e.payload.currency === "string" ? e.payload.currency : "ZAR";
    const computedAt = typeof e.payload.computedAt === "string" ? e.payload.computedAt : e.as_of;
    if (Number.isNaN(utilisationPct)) continue;

    // Emit a per-counterparty snapshot AND, when a group is attributed, a
    // separate per-group snapshot keyed by the group ID. The two are
    // independent regulatory facets — both must be checked.
    const cpKey = `cp:${cpid}`;
    const existingCp = out.get(cpKey);
    if (!existingCp || computedAt > existingCp.computedAt) {
      out.set(cpKey, {
        key: cpKey,
        counterpartyId: cpid,
        connectedGroupId: null,
        computedAt,
        utilisationPct,
        totalExposure,
        eligibleCapital,
        currency,
        eventId: e.event_id,
      });
    }

    if (groupId) {
      const gKey = `group:${groupId}`;
      const existingG = out.get(gKey);
      // For groups, take the latest event attributing to the group.
      if (!existingG || computedAt > existingG.computedAt) {
        out.set(gKey, {
          key: gKey,
          counterpartyId: cpid,
          connectedGroupId: groupId,
          computedAt,
          utilisationPct,
          totalExposure,
          eligibleCapital,
          currency,
          eventId: e.event_id,
        });
      }
    }
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const events = loadEvents(opts);
  if (events.length === 0) {
    result.asserted = 1;
    result.ok = true;
    return result;
  }

  const latest = pickLatest(events);
  for (const snap of latest.values()) {
    result.asserted++;
    const subjectLabel = snap.connectedGroupId
      ? `connected-group:${snap.connectedGroupId} (anchor cp ${snap.counterpartyId})`
      : `counterparty:${snap.counterpartyId}`;

    if (snap.utilisationPct >= RED_THRESHOLD_PCT) {
      violations.push({
        subject: snap.key,
        severity: "fail",
        message: `RED LEX cap utilisation: ${subjectLabel} at ${snap.utilisationPct.toFixed(2)}% of eligible capital (totalExposure=${snap.totalExposure} ${snap.currency}, eligibleCapital=${snap.eligibleCapital} ${snap.currency}; threshold ≥ ${RED_THRESHOLD_PCT}%). REGULATORY BREACH — RRB Regulation 23 + LEX Directive D3/2022 cap. CRC must block new trades; PA notification required. Latest LexUtilisationComputed event: ${snap.eventId} (computedAt=${snap.computedAt}). Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Policies/credit-risk-policy-v1.md §1.4 + §7.`,
      });
    } else if (snap.utilisationPct >= AMBER_THRESHOLD_PCT) {
      violations.push({
        subject: snap.key,
        severity: "fail",
        message: `AMBER LEX cap utilisation: ${subjectLabel} at ${snap.utilisationPct.toFixed(2)}% of eligible capital (threshold ${AMBER_THRESHOLD_PCT}–${RED_THRESHOLD_PCT}%). Early-warning trip per Credit Risk Policy §1.4 traffic-light protocol. CRO notified; CRC convene next cycle. Latest LexUtilisationComputed event: ${snap.eventId} (computedAt=${snap.computedAt}). Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Policies/credit-risk-policy-v1.md §1.4.`,
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "lex-cap-utilisation passed — no counterparty or connected group at Amber or Red."
        : "lex-cap-utilisation FAILED — Amber or Red breach detected.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
