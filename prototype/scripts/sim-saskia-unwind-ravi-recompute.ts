#!/usr/bin/env bun
// Simulated market actions:
//   Saskia — 2-tranche USD/ZAR spot sell to reduce NOP (CEO-approved ESC-FX-B3-2026-05-28)
//   Ravi   — NOP recompute confirming B3 < ZAR 180M target
// Provenance: sim (build-phase; no real trades executed)

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeAgentDecision } from "../platform/event-store/event-types/agent";
import { eventSchema } from "../platform/event-store/types";

const ENTITY = "LE-ZA-HOZ-BANK";
const NOW = new Date();
const AS_OF = NOW.toISOString();
const TRADE_DATE = AS_OF.slice(0, 10); // 2026-05-28
const SETTLE_DATE = "2026-05-30"; // T+2 (Wed → Fri)
const RATE = 16.4674; // twelve-data live USD/ZAR

// Two tranches: ~USD 2M + USD 1.27M = USD 3.27M → ~ZAR 53.85M
const TRANCHES = [
  {
    id: "SASKIA-UNWIND-2026-05-28-001",
    usdMinor: 200_000_000,
    zarMinor: Math.round(200_000_000 * RATE),
  },
  {
    id: "SASKIA-UNWIND-2026-05-28-002",
    usdMinor: 127_000_000,
    zarMinor: Math.round(127_000_000 * RATE),
  },
];

const totalUsd = TRANCHES.reduce((s, t) => s + t.usdMinor, 0) / 100;
const totalZar = TRANCHES.reduce((s, t) => s + t.zarMinor, 0) / 100;

console.log("=== Saskia — USD/ZAR unwind (CEO-approved) ===");
console.log(`Rate:     USD/ZAR ${RATE}`);
console.log(`Total:    USD ${(totalUsd / 1e6).toFixed(2)}M → ZAR ${(totalZar / 1e6).toFixed(2)}M`);
console.log(`Settle:   ${SETTLE_DATE}`);
console.log("");

// ---------------------------------------------------------------------------
// Saskia — FxTradeExecuted (2 tranches, side=sell USD)
// ---------------------------------------------------------------------------
for (const t of TRANCHES) {
  const event = eventSchema.parse({
    event_id: newEventId(),
    type: "FxTradeExecuted",
    as_of: AS_OF,
    entity: ENTITY,
    actor: { type: "service", id: "agent:saskia" },
    citations: ["RAS-B3", "EXCON-OECD-FX-001", "EITAN-FX-REDUCE-2026-05-28"],
    payload: {
      tradeId: { scheme: "internal", value: t.id },
      productTaxonomy: "FX-spot",
      currencyPair: { base: "USD", quote: "ZAR" },
      side: "sell",
      legs: [
        {
          legKind: "near",
          payCurrency: "USD",
          receiveCurrency: "ZAR",
          notional: { currency: "USD", amountMinor: t.usdMinor },
          counterNotional: { currency: "ZAR", amountMinor: t.zarMinor },
          rate: { currency: "ZAR", amount: RATE },
          settlementDate: { iso: SETTLE_DATE, calendar: "JIHCAL" },
        },
      ],
      tradeDate: { iso: TRADE_DATE, calendar: "JIHCAL" },
      counterparty: {
        partyId: "CPTY-ABSA-FX-001",
        name: "ABSA Bank Limited",
        role: "counterparty",
        jurisdiction: "ZA",
      },
      venue: "OTC",
      trader: "saskia@bank.local",
      bookId: "FX-TRADING",
      bookType: "trading",
      settlementForm: "physical",
      settlementPath: "correspondent",
      clientFlowRef: `nop-unwind:${t.id}`,
      provenance: "sim",
    },
  });
  eventStore.append(event);
  console.log(
    `[Saskia] FxTradeExecuted  ${t.id}  sell USD ${(t.usdMinor / 100 / 1e6).toFixed(2)}M @ ${RATE}  → receive ZAR ${(t.zarMinor / 100 / 1e6).toFixed(2)}M  settle ${SETTLE_DATE}`,
  );
}

// ---------------------------------------------------------------------------
// Ravi — NOP recompute confirmation (AgentDecision)
// ---------------------------------------------------------------------------
const B3_BEFORE = 233_850_085;
const B3_AFTER = Math.round(B3_BEFORE - totalZar); // ≈ ZAR 180.0M
const B3_LIMIT = 200_000_000;
const utilPct = ((B3_AFTER / B3_LIMIT) * 100).toFixed(1);

const raviConfirm = makeAgentDecision({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "service", id: "agent:ravi:intraday-stress" },
  citations: ["RAS-B3", "EXCON-OECD-FX-001"],
  payload: {
    decisionId: `RAVI-NOP-RECOMPUTE-${TRADE_DATE}`,
    decidedBy: "agent:ravi:intraday-stress",
    what: "Recompute B3 NOP post-Saskia unwind and confirm limit compliance",
    inScopeBy: "agent:ravi:intraday-stress",
    options: ["compliant", "still-breaching"],
    chosen: "compliant",
    rationale: `Post-unwind B3 NOP = ZAR ${(B3_AFTER / 1e6).toFixed(1)}M (${utilPct}% of ZAR ${(B3_LIMIT / 1e6).toFixed(0)}M limit). Saskia executed 2 tranches: USD 2.00M + USD 1.27M at ${RATE} ZAR/USD (settle ${SETTLE_DATE}). Reduction: ZAR ${(totalZar / 1e6).toFixed(2)}M. B3 now within target ZAR 180M. Breach ESC-FX-B3-${TRADE_DATE} resolved.`,
  },
});
eventStore.append(raviConfirm);

console.log("");
console.log(
  `[Ravi]   AgentDecision      RAVI-NOP-RECOMPUTE-${TRADE_DATE}  B3 post-unwind = ZAR ${(B3_AFTER / 1e6).toFixed(1)}M (${utilPct}% of limit)  → compliant`,
);
console.log("");
console.log("=== Sequence complete. 3 events emitted. ===");
console.log(
  `B3: ZAR ${(B3_BEFORE / 1e6).toFixed(1)}M → ZAR ${(B3_AFTER / 1e6).toFixed(1)}M  (limit ZAR ${(B3_LIMIT / 1e6).toFixed(0)}M)`,
);
console.log("Escalation ESC-FX-B3-2026-05-28: closed.");
console.log("Next: server refresh to reflect updated NOP in dashboard B3 tile.");
