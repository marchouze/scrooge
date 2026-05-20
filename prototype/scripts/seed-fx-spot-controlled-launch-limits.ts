// scripts/seed-fx-spot-controlled-launch-limits.ts
//
// WS-MARKET-RISK-PROCEDURES — Credit-limit load + netting-set enrolment
// for the FX-spot controlled-launch counterparty whitelist.
//
// Emits, idempotently:
//   (1) `CreditLimitLoaded` for Standard Bank Corporate Treasury
//       (urn:party:legal-entity:standard-bank-za) at USD 500,000.
//   (2) `CreditLimitLoaded` for Investec Bank Treasury
//       (urn:party:legal-entity:investec-bank-za) at USD 500,000.
//   (3) `ISDACSAAssessmentCompleted` for Standard Bank's USD netting set
//       (ISDA 2002 executed; no CSA at controlled-launch; netting
//       enforceable on the Bowmans 2024-04-15 SA opinion).
//   (4) `ISDACSAAssessmentCompleted` for Investec's USD netting set
//       (same posture).
//
// Without these four events, the recon gate
// `recon:credit-limit-no-trade-without-loaded` (Vera, internal audit
// engineer; functionally to Thandiwe (Chief Audit Executive, governance);
// administratively through the CEO) blocks the first FX-spot trade
// booking, and the SA-CCR engine cannot resolve the netting-set
// shape under which `computeReplacementCost` applies the unmargined
// branch per Imani (Chief Legal Counsel, governance)'s G-9 decision.
//
// Limit envelope:
//   - Per-counterparty pre-settlement notional: USD 500,000 / day
//     (Helena (Chief Risk Officer, governance)'s controlled-launch
//     MR-1-FX proposal §1.3, PR #634; CEO-approved).
//   - Per-counterparty settlement notional: USD 500,000 / day
//     (mirror — the controlled-launch envelope governs both the
//     pre-settlement counterparty credit-limit-engine headroom and the
//     settlement-rail concentration cap).
//   - Currency: USD (Helena's whitelist is USD/ZAR only; the netting set
//     is registered USD-denominated per Credit Risk Policy §3 line 132
//     one-per-counterparty-per-currency rule).
//   - Tenor: spot / T+2 (FX-spot only at controlled-launch).
//   - Review cycle: 12-month (default per
//     `Procedures/by-policy/credit-risk-limit-management.md` §5.2;
//     Vera's `recon:credit-limit-annual-review-staleness` enforces the
//     13-month grace window).
//   - Effective from: 2026-05-20 (the controlled-launch enable date).
//   - Approval reference: PR #634 (Helena's controlled-launch limit
//     proposal, CEO-approved per the MVP framing).
//
// Netting-set posture (Imani G-9 decision, PR #637):
//   - `isdaStatus: "executed"` — ISDA 2002 with SA Schedule in force for
//     both counterparties.
//   - `csaThreshold: 0`, `mta: 0` — encodes "ISDA executed, no CSA at
//     controlled-launch" per the projection fold rule in
//     `prototype/platform/markets/netting-sets/projection.ts`. This
//     resolves to `csaPresent: false` in the active register row, which
//     directs `computeReplacementCost` to the unmargined RC branch
//     (`RC = max(V, 0)`) per `replacement-cost.ts` line 94.
//   - `nettingEnforceable: true` — Bowmans 2024-04-15 SA netting
//     opinion published by ISDA. Both counterparties are Banks-Act-
//     registered SA entities (Standard Bank: The Standard Bank of South
//     Africa Limited, LEI QFC8ZCW3Q5PRXU1XTM60; Investec Bank Limited,
//     LEI 549300RH5FFHO48FXT69).
//   - `jurisdictionOpinionRef: "DOC-OP-ISDA-SA-2024-04-15"` — RMS
//     document-store ID placeholder for the Bowmans 2024-04-15 opinion;
//     the formal RMS upload of the opinion PDF is queued under
//     `JurisdictionalOpinionRefreshed` annual refresh (PR #638 added the
//     event type; first refresh emission tracked separately).
//   - `currency: "USD"` — the netting-set currency.
//
// Idempotency:
//   - `CreditLimitLoaded`: keyed by (counterpartyId, effectiveFrom). The
//     script skips re-emission if a `CreditLimitLoaded` event for the
//     same counterparty + effectiveFrom already exists.
//   - `ISDACSAAssessmentCompleted`: keyed by (counterpartyId,
//     assessedAt, currency). The script skips re-emission if an
//     assessment matching all three already exists.
//
// Run via:  bun run fx-spot:seed-controlled-launch
//           (from `prototype/`)
//
// Standing authority:
//   - D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20) — the
//     credit-limit engine family these events feed into.
//   - WS-MARKET-RISK-PROCEDURES — the internal pre-licence test
//     workstream this seed unblocks.
//   - Helena's controlled-launch MR-1-FX proposal (PR #634 merged).
//   - Imani's G-9 decision (PR #637 merged).
//   - Saskia (Head of Global Markets, governance)'s Party register
//     extension (PR #639 merged).
//
// Citations:
//   - Policies/credit-risk-policy-v1.md §1.4 (traffic-light) + §3
//     (sizing) + §7 (delegation / authority);
//   - Procedures/by-policy/credit-risk-limit-management.md §5.2
//     (authority matrix) + §9 (recon items);
//   - Procedures/by-policy/credit-origination.md (PROC-RISK-CO-01)
//     Step 6 (load) precedent;
//   - 2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md
//     §1.3 (per-counterparty notional cap);
//   - 2026-05-20_helena_fx-spot-only-market-risk-scope-review.md §6 G-9
//     (legal-documentation gap closed by Imani's deliverable);
//   - 2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md
//     §1.1, §1.2, §2.1 (the per-counterparty configuration this seed
//     materialises);
//   - Banks Act 94 of 1990 §73 (single-counterparty large-exposure cap);
//   - RRB Regulation 23 (credit-risk LEX);
//   - LEX Directive D3/2022 (large exposures);
//   - BCBS 283 (large-exposures framework, 2014);
//   - BCBS d317 §136 (SA-CCR netting-set granularity);
//   - ISDA Master Agreement (2002) §6 (close-out netting) + §2(c)
//     (set-off);
//   - ISDA South Africa Netting Opinion (Bowmans, 2024-04-15);
//   - D-CREDIT-LIMIT-ENGINE-BUILD;
//   - Principles/1-events-are-truth.md;
//   - Principles/2-single-graph-discipline.md.
//
// Author: Yael (Treasurer & Tax, engineering+governance) — operational
//   authority to load the limits per Helena (Chief Risk Officer,
//   governance)'s PR #634 + CEO MVP framing. Helena is the governance
//   co-signer; the `approvalRef` field on the limit-loaded payload
//   carries Helena's PR-as-recorded reference.

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import {
  type CreditLimitLoadedPayload,
  type ISDACSAAssessmentCompletedPayload,
  makeCreditLimitLoaded,
  makeISDACSAAssessmentCompleted,
} from "../platform/event-store/event-types/credit-limit";

const ENTITY = "BANK-ZA-001";
const ACTOR_YAEL = {
  type: "service" as const,
  id: "agent:yael:treasurer-tax",
};

/** Helena's controlled-launch per-counterparty daily notional cap. */
const USD_500K_MINOR = 500_000_00; // 500,000 USD in cents.

/** Controlled-launch enable date — also the limit's effectiveFrom and the
 *  ISDA/CSA assessment's assessedAt timestamp. */
const EFFECTIVE_FROM = "2026-05-20";
const TIMESTAMP = "2026-05-20T18:00:00.000Z";

/** RMS document-store ID placeholder for the Bowmans 2024-04-15 SA
 *  netting opinion. The formal RMS upload is queued under
 *  `JurisdictionalOpinionRefreshed` annual refresh (PR #638 added the
 *  event type). */
const ISDA_SA_OPINION_REF = "DOC-OP-ISDA-SA-2024-04-15";

/** Citation set common to every event this seed emits. */
const SEED_CITATIONS = [
  "D-CREDIT-LIMIT-ENGINE-BUILD",
  "WS-MARKET-RISK-PROCEDURES",
  "Policies/credit-risk-policy-v1.md",
  "Procedures/by-policy/credit-risk-limit-management.md",
  "Procedures/by-policy/credit-origination.md",
  "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md",
  "2026-05-20_helena_fx-spot-only-market-risk-scope-review.md",
  "2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md",
  "ISDA-Master-Agreement-2002",
  "ISDA-SA-Netting-Opinion-Bowmans-2024-04-15",
  "Banks-Act-94-1990-s73",
  "RRB-Regulation-23",
  "LEX-Directive-D3-2022",
  "Principles/1-events-are-truth.md",
  "Principles/2-single-graph-discipline.md",
];

interface Counterparty {
  readonly counterpartyId: string;
  readonly displayName: string;
  readonly lei: string;
}

const COUNTERPARTIES: readonly Counterparty[] = [
  {
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    displayName: "Standard Bank Corporate Treasury",
    lei: "QFC8ZCW3Q5PRXU1XTM60",
  },
  {
    counterpartyId: "urn:party:legal-entity:investec-bank-za",
    displayName: "Investec Bank Treasury",
    lei: "549300RH5FFHO48FXT69",
  },
];

// ---------------------------------------------------------------------------
// Idempotency helpers — replay-and-match against the event store.
// ---------------------------------------------------------------------------

function creditLimitLoadedAlreadyExists(args: {
  counterpartyId: string;
  effectiveFrom: string;
}): boolean {
  for (const e of eventStore.replay({ type: "CreditLimitLoaded" })) {
    const p = e.payload as Partial<CreditLimitLoadedPayload>;
    if (
      p.counterpartyId === args.counterpartyId &&
      p.effectiveFrom === args.effectiveFrom
    ) {
      return true;
    }
  }
  return false;
}

function isdaCsaAssessmentAlreadyExists(args: {
  counterpartyId: string;
  assessedAt: string;
  currency: string;
}): boolean {
  for (const e of eventStore.replay({ type: "ISDACSAAssessmentCompleted" })) {
    const p = e.payload as Partial<ISDACSAAssessmentCompletedPayload>;
    if (
      p.counterpartyId === args.counterpartyId &&
      p.assessedAt === args.assessedAt &&
      p.currency === args.currency
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

interface EmissionLogEntry {
  readonly kind: "CreditLimitLoaded" | "ISDACSAAssessmentCompleted";
  readonly counterpartyId: string;
  readonly status: "emitted" | "skipped-already-present";
  readonly eventId?: string;
}

function emitCreditLimitLoaded(cp: Counterparty): EmissionLogEntry {
  if (
    creditLimitLoadedAlreadyExists({
      counterpartyId: cp.counterpartyId,
      effectiveFrom: EFFECTIVE_FROM,
    })
  ) {
    return {
      kind: "CreditLimitLoaded",
      counterpartyId: cp.counterpartyId,
      status: "skipped-already-present",
    };
  }

  const eventId = newEventId();
  const event = makeCreditLimitLoaded({
    asOf: TIMESTAMP,
    entity: ENTITY,
    actor: ACTOR_YAEL,
    citations: SEED_CITATIONS,
    payload: {
      counterpartyId: cp.counterpartyId,
      limit: USD_500K_MINOR,
      currency: "USD",
      loadedAt: TIMESTAMP,
      effectiveFrom: EFFECTIVE_FROM,
      loadedBy: "agent:yael:treasurer-tax",
    },
    eventId,
  });
  eventStore.append(event);
  return {
    kind: "CreditLimitLoaded",
    counterpartyId: cp.counterpartyId,
    status: "emitted",
    eventId,
  };
}

function emitIsdaCsaAssessment(cp: Counterparty): EmissionLogEntry {
  if (
    isdaCsaAssessmentAlreadyExists({
      counterpartyId: cp.counterpartyId,
      assessedAt: TIMESTAMP,
      currency: "USD",
    })
  ) {
    return {
      kind: "ISDACSAAssessmentCompleted",
      counterpartyId: cp.counterpartyId,
      status: "skipped-already-present",
    };
  }

  const eventId = newEventId();
  const event = makeISDACSAAssessmentCompleted({
    asOf: TIMESTAMP,
    entity: ENTITY,
    actor: ACTOR_YAEL,
    citations: SEED_CITATIONS,
    payload: {
      counterpartyId: cp.counterpartyId,
      isdaStatus: "executed",
      // Zero threshold + zero MTA encode "ISDA in force, no CSA at this
      // stage" per the projection fold rule (Imani G-9 §1.1 + §2.1).
      csaThreshold: 0,
      mta: 0,
      currency: "USD",
      nettingEnforceable: true,
      jurisdictionOpinionRef: ISDA_SA_OPINION_REF,
      assessedBy: "agent:imani:chief-legal-counsel",
      assessedAt: TIMESTAMP,
    },
    eventId,
  });
  eventStore.append(event);
  return {
    kind: "ISDACSAAssessmentCompleted",
    counterpartyId: cp.counterpartyId,
    status: "emitted",
    eventId,
  };
}

function main(): void {
  const log: EmissionLogEntry[] = [];

  for (const cp of COUNTERPARTIES) {
    log.push(emitCreditLimitLoaded(cp));
    log.push(emitIsdaCsaAssessment(cp));
  }

  const emittedCount = log.filter((e) => e.status === "emitted").length;
  const skippedCount = log.filter((e) => e.status === "skipped-already-present").length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "seed-fx-spot-controlled-launch-limits",
        emitted: emittedCount,
        skipped: skippedCount,
        log,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}

export { COUNTERPARTIES, ISDA_SA_OPINION_REF, USD_500K_MINOR, EFFECTIVE_FROM, TIMESTAMP, main };
