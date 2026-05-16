// dashboard/server-schemas.ts
//
// Zod schemas for all dashboard HTTP POST request bodies.
//
// Each schema mirrors the TypeScript interface it validates (in `types.ts`)
// and is used by `server.ts` to gate business logic behind a hard parse;
// malformed or injected payloads are rejected with HTTP 400 before they
// reach any handler.
//
// Authority: Vera P1 finding F-029 / D-PROVENANCE-FILTER-ENFORCEMENT.
// Author: Senna (Security engineer, engineering).

import { z } from "zod";

// ---------------------------------------------------------------------------
// /api/decide  →  DecisionRequestBody & { followOnRoutes?, actor?, comment? }
// ---------------------------------------------------------------------------

const DECISION_ACTIONS = ["approve", "defer", "modify", "request-revision"] as const;

export const DecideBodySchema = z
  .object({
    decisionId: z.string().min(1),
    action: z.enum(DECISION_ACTIONS),
    outcome: z.string().min(1),
    comment: z.string().optional(),
    /** Identity of the caller. Required — `/api/decide` returns 401 when
     *  absent. D-DECISIONS-FRAMEWORK-REDESIGN Slice B removed the
     *  server-side hard-coded fallback. */
    actor: z.string().min(1).optional(),
    followOnRoutes: z.array(z.string()).optional(),
  })
  .strict();

export type DecideBody = z.infer<typeof DecideBodySchema>;

// ---------------------------------------------------------------------------
// /api/decisions/comment  →  { decisionId, body, inReplyToEventId?, actorId?, author? }
// ---------------------------------------------------------------------------

export const CommentBodySchema = z
  .object({
    decisionId: z.string().min(1),
    body: z.string().min(1),
    inReplyToEventId: z.string().optional(),
    actorId: z.string().optional(),
    author: z.string().optional(),
  })
  .strict();

export type CommentBody = z.infer<typeof CommentBodySchema>;

// ---------------------------------------------------------------------------
// /api/inflight/start  →  StartWorkstreamRequestBody & { actor? }
// ---------------------------------------------------------------------------

export const StartWorkstreamBodySchema = z
  .object({
    id: z.string().min(1),
    actor: z.string().optional(),
  })
  .strict();

export type StartWorkstreamBody = z.infer<typeof StartWorkstreamBodySchema>;

// ---------------------------------------------------------------------------
// /api/inflight/complete  →  CompleteWorkstreamRequestBody & { actor? }
// ---------------------------------------------------------------------------

export const CompleteWorkstreamBodySchema = z
  .object({
    id: z.string().min(1),
    outcomeDoc: z.string().optional(),
    outcomeNote: z.string().optional(),
    actor: z.string().optional(),
  })
  .strict();

export type CompleteWorkstreamBody = z.infer<typeof CompleteWorkstreamBodySchema>;

// ---------------------------------------------------------------------------
// /api/markets/fx/quote  →  RfqInput (quote-only, no trade event emitted)
// /api/markets/fx/trade  →  RfqInput (emits FxTradeExecuted event)
//
// Both endpoints accept the same shape. The Zod schema replaces the
// manual validateRfqInput() guard that was the sole parse layer
// (F-029 — Vera codebase-quality-review 2026-05-10). Downstream
// emitTrade / quoteOnly still call validateRfqInput internally for
// business-logic constraints (eligible currency pair, notional > 0,
// counterparty eligibility) after the structural parse passes here.
// ---------------------------------------------------------------------------

const CURRENCY_PAIR_RE = /^[A-Z]{3}\/[A-Z]{3}$/;
const VALUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const RfqBodySchema = z
  .object({
    counterpartyId: z.string().min(1),
    currencyPair: z
      .string()
      .regex(CURRENCY_PAIR_RE, "currencyPair must match BASE/QUOTE (3-letter ISO codes)"),
    side: z.enum(["buy", "sell"]),
    notional: z.number().finite().positive(),
    valueDate: z.string().regex(VALUE_DATE_RE, "valueDate must be ISO YYYY-MM-DD"),
    rfqId: z.string().min(1).optional(),
  })
  .strict();

export type RfqBody = z.infer<typeof RfqBodySchema>;
