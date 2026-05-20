// platform/event-store/event-types/regulatory-pa.ts
//
// PA / FSCA / FIC regulator-notification event-payload schemas.
//
// Covers:
//   - PaNotificationSubmitted — a notification submitted to a SA financial-
//     services authority (PA / FSCA / FIC), capturing the lex-cap-breach,
//     incident, control-failure, restatement, or other regulatory channel.
//
// Forward-compatible with the credit-limit recon pipelines:
//   - `recon:credit-limit-breach-unescalated` reads `PaNotificationSubmitted`
//     events as one of the three sanctioned escalation channels for a
//     `CreditLimitBreached`.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Citations:
//   Banks Act 94 of 1990 §§ 60A (notifications to PA) + 73 (large exposures);
//   Regulations Relating to Banks (RRB) Regulation 23;
//   LEX Directive D3/2022 (Large Exposures) — PA notification of LEX breaches;
//   FIC Act 38 of 2001 §§ 28A / 29 (regulated-reportable transactions);
//   Joint Standard 2 of 2024 (PA/FSCA — IT risk management);
//   Policies/credit-risk-policy-v1.md §8 line 252 (PA notification of
//     LEX-cap breach);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering — regulator interface) +
//   Helena (Chief Risk Officer, governance — credit-risk escalation owner).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// PaNotificationSubmitted
//
// Captured when the bank submits a notification to one of the SA financial-
// services authorities (PA / FSCA / FIC). The event is the immutable audit
// record of the submission — copies of the underlying letter / form / FIC
// goAML XML live in the document store and are referenced by `regulatoryRef`.
// ---------------------------------------------------------------------------

/**
 * Notification category. The five canonical channels named in policy §8
 * line 252 and the FIC Act / PA notification framework:
 *
 *   lex-cap-breach   — LEX cap utilisation exceeded 25% of eligible capital
 *                      (RRB Reg 23(7); D3/2022); CRO + BRC notified, PA notified.
 *   incident         — operational / cyber / fraud incident requiring
 *                      PA notification under Joint Standard 2 of 2024 or
 *                      Banks Act notification regime.
 *   control-failure  — a SOX-equivalent or internal-control failure detected
 *                      that requires self-reporting to the PA / FSCA.
 *   restatement      — a financial restatement requiring PA notification
 *                      (regulatory return correction, AFS restatement).
 *   other            — any other regulator-notification flow not yet typed
 *                      (free-form `notificationType` + `regulatoryRef`).
 */
export const paNotificationTypeSchema = z.enum([
  "lex-cap-breach",
  "incident",
  "control-failure",
  "restatement",
  "other",
]);

export type PaNotificationType = z.infer<typeof paNotificationTypeSchema>;

/**
 * Recipient authority. PA = Prudential Authority (SARB); FSCA = Financial
 * Sector Conduct Authority; FIC = Financial Intelligence Centre.
 */
export const paRecipientAuthoritySchema = z.enum(["PA", "FSCA", "FIC"]);

export type PaRecipientAuthority = z.infer<typeof paRecipientAuthoritySchema>;

export const paNotificationSubmittedPayloadSchema = z.object({
  /** Notification aggregate identifier. Convention: `PA-NOTIF-<YYYY>-<seq>`. */
  notificationId: z.string().min(1),

  /** Category of the notification — drives downstream routing + retention. */
  notificationType: paNotificationTypeSchema,

  /** ISO 8601 date the notification was submitted to the authority. */
  notificationDate: z.string().min(1),

  /**
   * Free-form reference of the submission as recorded by the recipient
   * authority. Examples:
   *   "PA-LETTER-2026-04-17"
   *   "FIC-STR-2026-000412"
   *   "FSCA-NOTIF-2026-09-LEX-BREACH"
   *   "blake3:<hash>" referencing the document-store copy of the letter
   *
   * For breach-style notifications, recon pipelines treat this string as a
   * substring search target — e.g. `recon:credit-limit-breach-unescalated`
   * matches against `breachId` / `counterpartyId` here.
   */
  regulatoryRef: z.string().min(1),

  /** Recipient authority. */
  recipientAuthority: paRecipientAuthoritySchema,

  /** Party register ID of the submitter (typically Mira, Helena, or the MLRO). */
  submittedBy: z.string().min(1),

  /** ISO 8601 timestamp of submission (machine wall-clock at emission). */
  submittedAt: z.string().min(1),
});

export type PaNotificationSubmittedPayload = z.infer<
  typeof paNotificationSubmittedPayloadSchema
>;

export function makePaNotificationSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PaNotificationSubmittedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PaNotificationSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: paNotificationSubmittedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// REGULATORY_PA_TYPED_EVENT_TYPES — registry of event types in this module.
//
// To add a new regulator-notification event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array,
//   (3) add a row to platform/event-store/registry/regulatory-pa.ts,
//   (4) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const REGULATORY_PA_TYPED_EVENT_TYPES = [
  "PaNotificationSubmitted",
] as const;

export type RegulatoryPaEventType = (typeof REGULATORY_PA_TYPED_EVENT_TYPES)[number];
