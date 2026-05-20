// platform/risk/credit-limit-engine/breach-detector.ts
//
// WS-CREDIT-LIMIT-ENGINE — passive breach detector.
//
// Iterates all loaded credit limits, computes current exposure via the same
// RC fold used by pre-deal-check, and returns the implied
// CreditLimitBreachedPayload payloads with policy-correct severity.
//
// `detectBreaches` does NOT emit events. Emission is the caller's
// responsibility (typically Helena's CRO daily sweep, which wraps each
// payload in an actor-attributed `makeCreditLimitBreached` call).
//
// Severity (Credit Risk Policy §1.4):
//   amber    — utilisationPct ≥ 80
//   red      — utilisationPct ≥ 100
//   critical — utilisationPct ≥ 100 AND LEX cap (25% Tier-1+2) also breached
//
// The LEX-cap test for `critical` requires the bank's eligible capital base.
// We look it up from the most recent LexUtilisationComputed event for the
// counterparty (which carries eligibleCapital in its payload). If no
// LexUtilisationComputed exists yet, severity falls back to `red`.
//
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../composition";
import type {
  CcrReplacementCostComputedPayload,
  LexUtilisationComputedPayload,
} from "../../event-store/event-types/counterparty-credit-risk";
import type { CreditLimitBreachedPayload } from "../../event-store/event-types/credit-limit";
import { utcNow } from "../../types/time";
import { getCurrentExposure } from "./pre-deal-check";
import { listActiveLimits } from "./projection";

// ---------------------------------------------------------------------------
// LEX-cap helper. Returns true iff the latest LexUtilisationComputed for the
// counterparty shows utilisationPct > 25 (the RRB Reg 23 / D3/2022 cap).
// ---------------------------------------------------------------------------

function lexCapBreached(counterpartyId: string, asOf?: string): boolean {
  let latest: LexUtilisationComputedPayload | undefined;
  const replayOpts =
    asOf !== undefined
      ? ({ type: "LexUtilisationComputed", asOf } as const)
      : ({ type: "LexUtilisationComputed" } as const);
  for (const event of eventStore.replay(replayOpts)) {
    const p = event.payload as LexUtilisationComputedPayload;
    if (p.counterpartyId !== counterpartyId) continue;
    if (!latest || latest.computedAt <= p.computedAt) latest = p;
  }
  if (!latest) return false;
  return latest.utilisationPct > 25;
}

// ---------------------------------------------------------------------------
// Detector. Returns the breach payloads — the caller emits.
// ---------------------------------------------------------------------------

let breachCounter = 0;
function nextBreachId(asOf: string): string {
  const year = asOf.slice(0, 4);
  breachCounter += 1;
  // Compact synthetic ID; caller may override before emission.
  const seq = String(breachCounter).padStart(3, "0");
  return `CL-BREACH-${year}-${seq}`;
}

export interface BreachDetectionResult {
  newBreaches: CreditLimitBreachedPayload[];
}

export function detectBreaches(asOf?: string): BreachDetectionResult {
  const nowIso = asOf ?? utcNow();
  const detectedAt = nowIso;
  const limits = listActiveLimits(nowIso);
  const breaches: CreditLimitBreachedPayload[] = [];

  for (const limit of limits) {
    if (limit.status !== "loaded") continue; // only loaded limits are breach-checked
    const exposure = getCurrentExposure(limit.counterpartyId, limit.currency, nowIso);
    if (exposure.amount === 0n) continue; // no exposure observed
    const limitMinor = limit.limit.amount;
    if (limitMinor <= 0n) continue;
    const utilScaled = (exposure.amount * 1000n) / limitMinor;
    const utilisationPct = Math.round(Number(utilScaled)) / 10;
    if (utilisationPct < 80) continue;

    const severity = computeSeverity(utilisationPct, limit.counterpartyId, nowIso);
    breaches.push({
      counterpartyId: limit.counterpartyId,
      breachId: nextBreachId(detectedAt),
      exposure: Number(exposure.amount),
      limit: Number(limitMinor),
      currency: limit.currency,
      severity,
      detectedAt,
    });
  }

  return { newBreaches: breaches };
}

function computeSeverity(
  utilisationPct: number,
  counterpartyId: string,
  asOf: string,
): "amber" | "red" | "critical" {
  if (utilisationPct >= 100 && lexCapBreached(counterpartyId, asOf)) return "critical";
  if (utilisationPct >= 100) return "red";
  return "amber";
}

// ---------------------------------------------------------------------------
// Re-use helper for the CCR RC fold so tests don't have to wire two stores.
// ---------------------------------------------------------------------------

export type { CcrReplacementCostComputedPayload };
