// platform/recon/no-prop-attribution.ts
//
// Vera continuous-controls pipeline: assert that every `FxTradeExecuted`
// event in the event store carries **exactly one** of `clientFlowRef` or
// `hedgeProgrammeRef` (no-prop attribution invariant).
//
// Schema-level enforcement already exists on the CDM payload schema
// (`platform/markets/cdm/fx.ts` — Atlas PR #633 superRefine). This recon
// is the **gate-level** enforcement that catches any event that bypasses
// the schema (e.g. raw `eventStore.append` calls, a back-filled event, a
// future event factory that mis-spells the field). Without it, the
// no-prop invariant lives entirely at parse-time and is silently bypassable.
//
// Failure modes asserted:
//   - Neither field present                          → fail (no attribution)
//   - Both fields present                            → fail (ambiguous)
//   - One field present but empty string             → fail (empty)
//   - One field present and non-empty                → ok
//
// Empty-state correctness: zero `FxTradeExecuted` events on a fresh bench
// → `ok: true, asserted: 0` (matches the canonical recon-empty-state
// pattern; see `credit-limit-no-trade-without-loaded.ts`).
//
// Standing authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - Policies/trading-mandate-v1.md §5 (positive enumeration; no
//     proprietary positions)
//   - Atlas PR #633 (schema-level XOR refinement; this recon is the
//     gate-level enforcement)
//   - Helena (Chief Risk Officer, governance) FX-spot-only market-risk
//     scope review (2026-05-20) §6 gap G-3
//   - Principles/1-events-are-truth.md
//   - Principles/2-single-graph-discipline.md
//
// Author: Vera (Internal audit engineer, governance —
//   functionally to Thandiwe (Chief Audit Executive, governance);
//   administratively through the CEO).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "no-prop-attribution";

// ---------------------------------------------------------------------------
// Minimal event shape (avoid importing the full CDM payload — the recon's
// job is to assert against the persisted payload, whatever shape it took
// at append-time).
// ---------------------------------------------------------------------------

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

export interface RunOpts {
  /**
   * Override the event source — used by tests to feed synthetic events
   * without touching the live event store.
   */
  fxTradeEvents?: Iterable<MinimalEvent>;
}

function loadFxTradeEvents(opts: RunOpts): MinimalEvent[] {
  if (opts.fxTradeEvents) return [...opts.fxTradeEvents];
  const out: MinimalEvent[] = [];
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    out.push({
      event_id: e.event_id,
      type: e.type,
      as_of: e.as_of,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Attribution classification.
// ---------------------------------------------------------------------------

type AttributionVerdict =
  | { kind: "ok" }
  | { kind: "neither" }
  | { kind: "both" }
  | { kind: "empty-client-flow" }
  | { kind: "empty-hedge-programme" };

export function classifyAttribution(payload: Record<string, unknown>): AttributionVerdict {
  const clientRaw = payload.clientFlowRef;
  const hedgeRaw = payload.hedgeProgrammeRef;

  const clientPresent = clientRaw !== undefined && clientRaw !== null;
  const hedgePresent = hedgeRaw !== undefined && hedgeRaw !== null;

  if (!clientPresent && !hedgePresent) return { kind: "neither" };

  // Empty-string is a violation — present-but-empty is treated as a
  // field-was-set-incorrectly bug, not as absence.
  if (clientPresent && typeof clientRaw === "string" && clientRaw.length === 0) {
    return { kind: "empty-client-flow" };
  }
  if (hedgePresent && typeof hedgeRaw === "string" && hedgeRaw.length === 0) {
    return { kind: "empty-hedge-programme" };
  }

  // After empty-check, treat non-empty-string presence as effective presence.
  // (A non-string type would also be a violation, but we let downstream
  // schema validation catch type-shape issues; the recon's job is the XOR
  // invariant.)
  const clientEffective = clientPresent && typeof clientRaw === "string" && clientRaw.length > 0;
  const hedgeEffective = hedgePresent && typeof hedgeRaw === "string" && hedgeRaw.length > 0;

  if (clientEffective && hedgeEffective) return { kind: "both" };
  if (clientEffective || hedgeEffective) return { kind: "ok" };

  // Defensive — neither field carries a non-empty string. Treat as
  // "neither" so the violation surfaces with a clear message.
  return { kind: "neither" };
}

function extractTradeRef(payload: Record<string, unknown>): string {
  const tradeRef = payload.tradeRef;
  if (typeof tradeRef === "string" && tradeRef.length > 0) return tradeRef;
  return "unknown";
}

// ---------------------------------------------------------------------------
// Pipeline run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const fxTradeEvents = loadFxTradeEvents(opts);

  for (const event of fxTradeEvents) {
    result.asserted++;

    const verdict = classifyAttribution(event.payload);
    if (verdict.kind === "ok") continue;

    const tradeRef = extractTradeRef(event.payload);
    const baseSubject = `FxTradeExecuted:${event.event_id}:trade=${tradeRef}`;

    switch (verdict.kind) {
      case "neither":
        violations.push({
          subject: baseSubject,
          severity: "fail",
          message: `FxTradeExecuted ${event.event_id} (tradeRef=${tradeRef}, as_of=${event.as_of}) carries NEITHER clientFlowRef NOR hedgeProgrammeRef. A trade with no attribution is indistinguishable from proprietary risk-taking. Authority: Policies/trading-mandate-v1.md §5; D-MARKETS-SCHEMA-FOUNDATION; Atlas PR #633.`,
        });
        break;
      case "both":
        violations.push({
          subject: baseSubject,
          severity: "fail",
          message: `FxTradeExecuted ${event.event_id} (tradeRef=${tradeRef}, as_of=${event.as_of}) carries BOTH clientFlowRef AND hedgeProgrammeRef. A single trade cannot simultaneously offset a client RFQ and implement a sanctioned hedge programme — exactly one of the two must be set. Authority: Policies/trading-mandate-v1.md §5; D-MARKETS-SCHEMA-FOUNDATION; Atlas PR #633.`,
        });
        break;
      case "empty-client-flow":
        violations.push({
          subject: baseSubject,
          severity: "fail",
          message: `FxTradeExecuted ${event.event_id} (tradeRef=${tradeRef}, as_of=${event.as_of}) carries an EMPTY clientFlowRef (length=0). Empty-string attribution is a present-but-meaningless field — treat as absence. Authority: Policies/trading-mandate-v1.md §5; D-MARKETS-SCHEMA-FOUNDATION; Atlas PR #633.`,
        });
        break;
      case "empty-hedge-programme":
        violations.push({
          subject: baseSubject,
          severity: "fail",
          message: `FxTradeExecuted ${event.event_id} (tradeRef=${tradeRef}, as_of=${event.as_of}) carries an EMPTY hedgeProgrammeRef (length=0). Empty-string attribution is a present-but-meaningless field — treat as absence. Authority: Policies/trading-mandate-v1.md §5; D-MARKETS-SCHEMA-FOUNDATION; Atlas PR #633.`,
        });
        break;
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

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
        ? "no-prop-attribution passed — every FxTradeExecuted carries exactly one of clientFlowRef or hedgeProgrammeRef."
        : "no-prop-attribution FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
