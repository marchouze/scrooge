// runtime/agents/mira-kyc-onboarding-gateway.ts
//
// Mira's KYC onboarding gateway — processes ClientCandidateRegistered
// through PROC-FC-01 steps 1–9.
//
// Authority:
//   - PROC-FC-01 (Approved) — 9-step KYC onboarding gate
//   - KYC/CDD/EDD Policy (BRC-approved)
//   - Citations: ORG-FC-02, ORG-FC-03, ORG-FC-04, ORG-FC-05,
//     FIC-ACT-S21, FIC-ACT-S21B, FATF-REC-10, FATF-REC-12
//
// Flow (maps to PROC-FC-01 steps 1–9):
//   Step 1: ClientCandidateRegistered — trigger (already emitted by caller)
//   Step 2: Sanctions screening → SanctionsClearancePassed | ClientRejected(SANCTIONS_HIT)
//   Step 3: PEP screening → PEPScreeningCompleted
//   Step 4: BeneficialOwnerResolved (stub UBO — single natural person)
//   Step 5: RiskRatingAssigned via RBA engine
//   Step 6: PROHIBITED → ClientRejected(PROHIBITED_ENTITY)
//   Step 7: STANDARD → PopiaConsentRecorded → ClientAccepted
//   Step 8: HIGH | PEP → EddInitiated (terminal event deferred to EDD flow)
//   Step 9: Screening ERROR → ClientRejected(SCREENING_ERROR)
//
// Idempotency: the handler skips any candidateId for which a terminal
// event (ClientAccepted, ClientRejected, EddInitiated) already exists.
//
// Actor: { type: "service", id: "agent:mira:kyc-onboarding-gateway" }
//
// Author: Mira (Regulatory Intelligence Engineer)

import {
  beneficialOwnerResolved,
  clientAccepted,
  clientRejected,
  eddInitiated,
  pepScreeningCompleted,
  popiaConsentRecorded,
  riskRatingAssigned,
  sanctionsClearancePassed,
} from "../../domains/customer/onboarding";
import type { ClientCandidateRegisteredPayload } from "../../domains/customer/types";
import type { PartyId } from "../../domains/party";
import { eventStore, logger } from "../../platform/composition";
import { nowUtc } from "../../platform/core/types";
import type { Event } from "../../platform/event-store/types";
import { assignRiskRating } from "../../platform/kyc/risk-rating-engine";
import { StubScreeningAdapter } from "../../platform/kyc/screening-adapter";
import type { AgentRunContext, AgentRunOutput } from "../types";

const GATEWAY_ACTOR = {
  type: "service" as const,
  id: "agent:mira:kyc-onboarding-gateway",
} as const;

const GATEWAY_ACTOR_ID = GATEWAY_ACTOR.id as PartyId;

// Citations used across PROC-FC-01 emissions (Principle 2).
const KYC_CITATIONS = [
  "ORG-FC-02",
  "ORG-FC-03",
  "ORG-FC-04",
  "ORG-FC-05",
  "FIC-ACT-S21",
  "FIC-ACT-S21B",
  "FATF-REC-10",
  "FATF-REC-12",
] as const;

// Terminal event types: once any of these exists for a candidateId, the
// handler considers the candidate fully processed and skips re-processing.
const TERMINAL_TYPES = ["ClientAccepted", "ClientRejected", "EddInitiated"] as const;

/**
 * Check whether a terminal event already exists for a given candidateId.
 * Idempotency guard — prevents duplicate processing on re-runs.
 */
function hasTerminalEvent(candidateId: string): boolean {
  for (const termType of TERMINAL_TYPES) {
    for (const e of eventStore.replay({ type: termType })) {
      const p = e.payload as { candidateId?: unknown };
      if (typeof p.candidateId === "string" && p.candidateId === candidateId) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Add +N calendar days to an ISO timestamp (UTC). Used for SLA deadlines.
 */
function addDays(isoTs: string, days: number): string {
  const d = new Date(isoTs);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

const screening = new StubScreeningAdapter();

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const candidates = triggering.filter((e): e is Event => e.type === "ClientCandidateRegistered");

  if (candidates.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "no ClientCandidateRegistered events in triggering set; nothing to process",
      ok: true,
    };
  }

  let eventsEmitted = 0;
  let processed = 0;
  let skipped = 0;

  for (const triggerEvent of candidates) {
    const p = triggerEvent.payload as unknown as ClientCandidateRegisteredPayload;
    const { candidateId, entityType } = p;

    if (!candidateId) {
      logger.warn(
        { eventId: triggerEvent.event_id },
        "mira:kyc-onboarding-gateway — ClientCandidateRegistered missing candidateId; skipping",
      );
      skipped += 1;
      continue;
    }

    // Idempotency: skip if terminal event already exists for this candidate.
    if (hasTerminalEvent(candidateId)) {
      logger.debug(
        { candidateId },
        "mira:kyc-onboarding-gateway — terminal event already exists; skipping (idempotent)",
      );
      skipped += 1;
      continue;
    }

    if (ctx.dryRun) {
      logger.debug(
        { candidateId },
        "mira:kyc-onboarding-gateway — dry-run; would process candidate",
      );
      continue;
    }

    const opts = {
      actor: GATEWAY_ACTOR,
      citations: [...KYC_CITATIONS],
      asOf: ctx.asOf,
    };

    try {
      // -------------------------------------------------------------------------
      // Step 2: Sanctions screening (PROC-FC-01 step 2)
      // Fail-closed: error → ClientRejected(SCREENING_ERROR)
      // -------------------------------------------------------------------------
      let sanctionsClear = false;
      try {
        const sanctionsResult = await screening.checkSanctions(candidateId, p.entity);

        if (sanctionsResult.result === "HIT") {
          // Sanctions hit — reject immediately (PROC-FC-01 step 2).
          eventStore.append(
            clientRejected(
              {
                candidateId,
                reasonCode: "SANCTIONS_HIT",
                rejectedBy: GATEWAY_ACTOR_ID,
              },
              opts,
            ),
          );
          eventsEmitted += 1;
          processed += 1;
          continue;
        }

        if (sanctionsResult.result === "ERROR") {
          // Screening error — fail-closed, reject.
          eventStore.append(
            clientRejected(
              {
                candidateId,
                reasonCode: "SCREENING_ERROR",
                rejectedBy: GATEWAY_ACTOR_ID,
              },
              opts,
            ),
          );
          eventsEmitted += 1;
          processed += 1;
          continue;
        }

        // CLEAR
        sanctionsClear = true;
        eventStore.append(
          sanctionsClearancePassed(
            {
              counterpartyId: candidateId as Parameters<
                typeof sanctionsClearancePassed
              >[0]["counterpartyId"],
              screeningProvider: "stub",
              screeningRef: `stub-sanctions-${candidateId}`,
              clearedAt: ctx.asOf,
              screenedBy: GATEWAY_ACTOR.id,
            },
            opts,
          ),
        );
        eventsEmitted += 1;
      } catch (err) {
        // Adapter threw — treat as ERROR (fail-closed).
        logger.warn(
          { candidateId, err },
          "mira:kyc-onboarding-gateway — sanctions adapter threw; fail-closed → SCREENING_ERROR",
        );
        eventStore.append(
          clientRejected(
            {
              candidateId,
              reasonCode: "SCREENING_ERROR",
              rejectedBy: GATEWAY_ACTOR_ID,
            },
            opts,
          ),
        );
        eventsEmitted += 1;
        processed += 1;
        continue;
      }

      // -------------------------------------------------------------------------
      // Step 3: PEP screening (PROC-FC-01 step 3)
      // Fail-closed: error → ClientRejected(SCREENING_ERROR)
      // -------------------------------------------------------------------------
      let pepStatus = false;
      let pepTier: 1 | 2 | 3 | undefined;
      try {
        const pepResult = await screening.checkPEP(
          candidateId,
          p.entity,
          "ZA", // Default nationality; real adapter gets this from candidate data.
        );

        if (pepResult.result === "ERROR") {
          eventStore.append(
            clientRejected(
              {
                candidateId,
                reasonCode: "SCREENING_ERROR",
                rejectedBy: GATEWAY_ACTOR_ID,
              },
              opts,
            ),
          );
          eventsEmitted += 1;
          processed += 1;
          continue;
        }

        pepStatus = pepResult.result === "HIT";
        pepTier = pepResult.pepTier;

        eventStore.append(
          pepScreeningCompleted(
            {
              candidateId,
              result: pepResult.result,
              ...(pepResult.pepTier !== undefined ? { pepTier: pepResult.pepTier } : {}),
              ...(pepResult.matchRefs !== undefined ? { matchRefs: pepResult.matchRefs } : {}),
            },
            opts,
          ),
        );
        eventsEmitted += 1;
      } catch (err) {
        logger.warn(
          { candidateId, err },
          "mira:kyc-onboarding-gateway — PEP adapter threw; fail-closed → SCREENING_ERROR",
        );
        eventStore.append(
          clientRejected(
            {
              candidateId,
              reasonCode: "SCREENING_ERROR",
              rejectedBy: GATEWAY_ACTOR_ID,
            },
            opts,
          ),
        );
        eventsEmitted += 1;
        processed += 1;
        continue;
      }

      // -------------------------------------------------------------------------
      // Step 4: BeneficialOwnerResolved (PROC-FC-01 step 4)
      // Stub: single natural-person UBO (full UBO chain walker is a future slice).
      // -------------------------------------------------------------------------
      eventStore.append(
        beneficialOwnerResolved(
          {
            counterpartyId: candidateId as Parameters<
              typeof beneficialOwnerResolved
            >[0]["counterpartyId"],
            beneficialOwners: [
              {
                partyId: candidateId,
                ownershipPct: 100,
                controlBasis: "direct-ownership",
              },
            ],
            resolvedAt: ctx.asOf,
            resolvedBy: GATEWAY_ACTOR.id,
          },
          opts,
        ),
      );
      eventsEmitted += 1;

      // -------------------------------------------------------------------------
      // Step 5: RBA risk rating (PROC-FC-01 step 5)
      // -------------------------------------------------------------------------
      const rbaResult = assignRiskRating({
        entityType,
        jurisdictionRisk: "low", // Stub: default low. Real adapter reads from candidate data.
        pepStatus,
        sanctionsClear,
        uboChainDepth: 1, // Stub: depth 1 (single natural-person UBO above).
        productTypes: [], // Stub: no product data at this stage.
      });

      eventStore.append(
        riskRatingAssigned(
          {
            candidateId,
            rating: rbaResult.rating,
            rbaScoreFactors: rbaResult.factors,
          },
          opts,
        ),
      );
      eventsEmitted += 1;

      // -------------------------------------------------------------------------
      // Step 6: PROHIBITED → reject (PROC-FC-01 step 6)
      // -------------------------------------------------------------------------
      if (rbaResult.rating === "PROHIBITED") {
        eventStore.append(
          clientRejected(
            {
              candidateId,
              reasonCode: "PROHIBITED_ENTITY",
              rejectedBy: GATEWAY_ACTOR_ID,
            },
            opts,
          ),
        );
        eventsEmitted += 1;
        processed += 1;
        continue;
      }

      // -------------------------------------------------------------------------
      // Step 7: STANDARD → POPIA consent + accept (PROC-FC-01 step 7)
      // -------------------------------------------------------------------------
      if (rbaResult.rating === "STANDARD") {
        // Auto-consent stub — real flow requires explicit consent capture.
        eventStore.append(
          popiaConsentRecorded(
            {
              counterpartyId: candidateId as Parameters<
                typeof popiaConsentRecorded
              >[0]["counterpartyId"],
              consentScope: ["kyc-processing", "regulatory-reporting"],
              recordedAt: ctx.asOf,
              recordedBy: GATEWAY_ACTOR.id,
            },
            opts,
          ),
        );
        eventsEmitted += 1;

        eventStore.append(
          clientAccepted(
            {
              candidateId,
              riskRating: "STANDARD",
              kycTier: "Tier-1",
              acceptedBy: GATEWAY_ACTOR_ID,
            },
            opts,
          ),
        );
        eventsEmitted += 1;
        processed += 1;
        continue;
      }

      // -------------------------------------------------------------------------
      // Step 8: HIGH | PEP → EDD initiated (PROC-FC-01 step 8)
      // SLA: +10 days for HIGH, +2 days for PEP
      // No terminal event yet — EDD completion is a separate human-triggered flow.
      // -------------------------------------------------------------------------
      const slaDays = rbaResult.rating === "PEP" ? 2 : 10;
      const slaDeadlineIso = addDays(ctx.asOf, slaDays);

      const eddReason =
        rbaResult.rating === "PEP"
          ? `PEP match detected (tier: ${pepTier ?? "unknown"}) — EDD required per FATF-REC-12`
          : `HIGH risk rating — EDD required per FATF-REC-10. Factors: ${rbaResult.factors.join("; ")}`;

      eventStore.append(
        eddInitiated(
          {
            candidateId,
            reason: eddReason,
            assignedTo: GATEWAY_ACTOR_ID,
            slaDeadlineIso,
          },
          opts,
        ),
      );
      eventsEmitted += 1;
      processed += 1;
    } catch (err) {
      logger.error(
        { candidateId, err },
        "mira:kyc-onboarding-gateway — unexpected error processing candidate",
      );
      // Unrecoverable: emit a rejection to close the candidate's state.
      try {
        eventStore.append(
          clientRejected(
            {
              candidateId,
              reasonCode: "SCREENING_ERROR",
              rejectedBy: GATEWAY_ACTOR_ID,
            },
            {
              actor: GATEWAY_ACTOR,
              citations: [...KYC_CITATIONS],
              asOf: nowUtc(),
            },
          ),
        );
        eventsEmitted += 1;
      } catch {
        // Best-effort; log is already above.
      }
      processed += 1;
    }
  }

  logger.info(
    { triggering: candidates.length, processed, skipped, eventsEmitted },
    "mira:kyc-onboarding-gateway — done",
  );

  return {
    eventsEmitted,
    summary: `${candidates.length} ClientCandidateRegistered; ${processed} processed, ${skipped} skipped (idempotent / no candidateId). ${eventsEmitted} events emitted.`,
    ok: true,
  };
};

export default handler;
