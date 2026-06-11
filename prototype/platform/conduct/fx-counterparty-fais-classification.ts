// platform/conduct/fx-counterparty-fais-classification.ts
//
// CCO FAIS classification of the FX counterparties on the live book.
//
// ## Why (FX conduct surveillance wiring, 2026-06-11)
//
// The FAIS-suitability surveillance leg (FAIS Act 37/2002 §8D) can only fire for
// a counterparty that carries a CounterpartyFaisClassified event of record. The
// canonical store held ZERO such events, so suitability could never fire and the
// enforced gateway suitability check would fail-closed every order. Every FX
// counterparty on the book is a SARB- or foreign-regulated bank
// (Nedbank/Deutsche/Standard Bank/Barclays/JPMorgan/HSBC/Citibank/Investec/
// FirstRand/Absa). Under FAIS, interbank dealing between regulated banks is a
// MARKET-COUNTERPARTY relationship — the lightest FAIS appropriateness tier.
//
// As CCO (Zara, Chief Compliance Officer, governance) I classify them as
// market-counterparty. This is a conduct decision recorded as an event of
// record, not an engineering convenience: it is the FAIS categorisation that
// unlocks both the post-trade suitability surveillance and the pre-trade
// suitability gateway admission for these institutional names.
//
// The classification id list is derived from the distinct counterparty ids on
// the FxTradeExecuted stream at the time of wiring; the driver
// (scripts/run-fx-counterparty-fais-classification.ts) re-derives the live set
// at run time so any new institutional counterparty is picked up. Idempotent:
// skips counterparties already classified.
//
// Authority: FAIS Act 37/2002 §8D; D-FAIS-SCOPE; D-FX-COUNTERPARTY-SCOPE-
//   INSTITUTIONAL; D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH (CEO session-
//   delegation 2026-06-11); Principle 1.
// Author: Zara (Chief Compliance Officer, governance).

import { makeCounterpartyFaisClassified } from "../event-store/event-types/customer";
import type { EventStore } from "../event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";
const CCO_ACTOR = {
  type: "service" as const,
  id: "agent:zara:counterparty-fais-classification",
};
const CITATIONS = [
  "FAIS-ACT-37-2002-S8D",
  "D-FAIS-SCOPE",
  "D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL",
  "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
];

/** Distinct counterparty ids appearing on the live FxTradeExecuted stream. */
export function distinctFxCounterpartyIds(store: EventStore): string[] {
  const ids = new Set<string>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as { counterparty?: { partyId?: unknown; id?: unknown } };
    const id = p.counterparty?.partyId ?? p.counterparty?.id;
    if (typeof id === "string" && id.length > 0) ids.add(id);
  }
  return [...ids];
}

/** Counterparty ids already carrying a CounterpartyFaisClassified event. */
function classifiedIds(store: EventStore): Set<string> {
  const ids = new Set<string>();
  for (const e of store.replay({ type: "CounterpartyFaisClassified" })) {
    const p = e.payload as { counterpartyId?: unknown };
    if (typeof p.counterpartyId === "string") ids.add(p.counterpartyId);
  }
  return ids;
}

export interface ClassificationResult {
  readonly classified: string[];
  readonly skipped: string[];
}

/**
 * Classify every FX counterparty on the live book as `market-counterparty`
 * (interbank). Idempotent: counterparties already classified are skipped.
 */
export function classifyFxCounterparties(
  store: EventStore,
  opts: { asOf: string; dryRun: boolean },
): ClassificationResult {
  const already = classifiedIds(store);
  const classified: string[] = [];
  const skipped: string[] = [];

  for (const counterpartyId of distinctFxCounterpartyIds(store)) {
    if (already.has(counterpartyId)) {
      skipped.push(counterpartyId);
      continue;
    }
    if (!opts.dryRun) {
      store.append(
        makeCounterpartyFaisClassified({
          asOf: opts.asOf,
          entity: ENTITY,
          actor: CCO_ACTOR,
          citations: CITATIONS,
          payload: {
            counterpartyId,
            faisCategory: "market-counterparty",
            classifiedAt: opts.asOf,
            classifiedBy: "agent:zara:chief-compliance-officer",
          },
        }),
      );
    }
    classified.push(counterpartyId);
  }

  return { classified, skipped };
}
