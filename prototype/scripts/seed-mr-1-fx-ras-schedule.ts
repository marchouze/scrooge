// scripts/seed-mr-1-fx-ras-schedule.ts
//
// WS-MARKET-RISK-PROCEDURES — Operationalise D-BRC-INTERIM-MR-1-FX.
//
// Emits a `RasLimitSchedulePublished` event with the Helena (Chief Risk Officer,
// governance)-proposed MR-1-FX controlled-launch limits (PR #634 merged;
// D-BRC-INTERIM-MR-1-FX CEO-approved 2026-05-21).
//
// === BANK_EVENT_DB resolution ===
//
// Event-store path follows the cross-worktree sync rule (CLAUDE.md):
//   1. --event-db flag        (not applicable to this script; use BANK_EVENT_DB)
//   2. BANK_EVENT_DB env var  ← PRIMARY override for this script
//   3. BANK_HOME_EVENT_DB env var
//   4. $HOME/.local/share/bank/event.db   ← default (home store)
//   5. .local/event.db                    ← fallback when $HOME unresolvable
//
// IMPORTANT: The existing `seed-ras-limits.ts` hit a cwd-relative-path footgun
// where the import of `../platform/composition` resolved the DB path relative
// to the cwd at runtime, not relative to the script. This script uses the same
// `eventStore` singleton from `../platform/composition`, which honours
// BANK_EVENT_DB.  Run against BOTH stores:
//
//   # 1. Home store (launchd / shared store):
//   bun run ras:seed-mr-1-fx
//
//   # 2. Main worktree store:
//   BANK_EVENT_DB=/Users/marc/code/Bank/.local/event.db bun run ras:seed-mr-1-fx
//
// Idempotent: skips emission if a `RasLimitSchedulePublished` event with
// scheduleId "RAS-LIMIT-SCHEDULE-MR-1-FX-2026-05-21" already exists.
//
// === Path A — notional-proxy treatment of B3 ===
//
// The existing projection folds *gross notional* into B3; Helena's MR-1-FX
// limit is a *1-day 99% VaR*. Comparing gross notional to a VaR limit would
// produce a spurious 24,000% red. This script therefore emits the B3 limit
// as the gross-notional EOD open-position ceiling implied by Helena's proposal
// §1.4 (USD 1,000,000 ≈ ZAR 18,500,000) rather than the 350k VaR limit.
//
// The VaR-vs-notional semantic gap is flagged as Vera finding
// `vera:mr-1-fx-var-projection-gap` (see below). The B3 limitName explicitly
// labels it as a notional proxy to avoid misleading the dashboard.
//
// === Limits emitted ===
//
//   B3 — "Market risk — FX gross notional (proxy for MR-1-FX VaR pending VaR engine)"
//         limitValue: ZAR 18,500,000
//         Amber: 0.80, Red: 1.00 (mirrors Helena §1.4 Amber-Alert at 80%)
//
//   B1 — "Credit risk — FX-spot counterparty pre-settlement (controlled launch)"
//         limitValue: ZAR 18,500,000 gross intraday
//         (USD 500k × 2 counterparties × 18.5 spot rate, per Helena §1.3)
//         Amber: 0.70, Red: 0.90
//
//   B2, B4, B5 — retained from placeholder schedule (MR-1-FX scope = B1 + B3 only)
//
// === Authority ===
//   D-BRC-INTERIM-MR-1-FX (CEO-approved 2026-05-21)
//   2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md §1.1, §1.3, §1.4
//   Principles/1-events-are-truth.md
//   Principles/2-single-graph-discipline.md
//
// Run via:  bun run ras:seed-mr-1-fx
//           (from prototype/)

import { eventStore } from "../platform/composition";
import { newEventId, nowUtc } from "../platform/core/types";
import { makeRasLimitSchedulePublished } from "../platform/event-store/event-types/trading";
import { recordAuditFinding } from "../platform/records/helpers";

const SCHEDULE_ID = "RAS-LIMIT-SCHEDULE-MR-1-FX-2026-05-21";
const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-21T00:00:00.000Z";

// Helena §1.4: USD 1,000,000 EOD open position ≈ ZAR 18,500,000 at 18.50 spot.
const B3_NOTIONAL_LIMIT_ZAR = 18_500_000;

// Helena §1.3: USD 500,000 per counterparty × 2 whitelisted CPs × 18.50 = ZAR 18,500,000.
// This is the gross-intraday ceiling across both counterparties; per-CP cap is ZAR 9,250,000.
const B1_PRE_SETTLEMENT_LIMIT_ZAR = 18_500_000;

const SEED_CITATIONS = [
  "D-BRC-INTERIM-MR-1-FX",
  "WS-MARKET-RISK-PROCEDURES",
  "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md",
  "Policies/market-risk-policy-v1.md",
  "Policies/trading-mandate-v1.md",
  "Principles/1-events-are-truth.md",
  "Principles/2-single-graph-discipline.md",
];

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

const existing = [...eventStore.replay({ type: "RasLimitSchedulePublished" })].find(
  (e) => (e.payload as { scheduleId?: string }).scheduleId === SCHEDULE_ID,
);

if (existing) {
  console.log(`[seed-mr-1-fx] Schedule ${SCHEDULE_ID} already exists — skipping.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Emit RasLimitSchedulePublished
// ---------------------------------------------------------------------------

const event = makeRasLimitSchedulePublished({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "human", id: "marc@tgv.co.za" },
  citations: SEED_CITATIONS,
  payload: {
    scheduleId: SCHEDULE_ID,
    publishedBy: "marc@tgv.co.za",
    effectiveFrom: "2026-05-21",
    limits: [
      {
        // B1 — Credit risk — counterparty pre-settlement exposure.
        // Helena §1.3: per-counterparty daily notional cap USD 500k × 2 CPs.
        // B1 accumulates counterparty pre-settlement exposure (10% of notional
        // from the projection fold in limit-utilisation.ts).  Setting the limit
        // at the full gross-intraday ceiling (USD 1m equiv ≈ ZAR 18.5m) gives
        // the CRO a real-time view of aggregate counterparty concentration.
        cluster: "B1",
        limitName:
          "Credit risk — FX-spot counterparty pre-settlement (controlled launch — MR-1-FX §1.3)",
        limitValue: B1_PRE_SETTLEMENT_LIMIT_ZAR,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
      {
        // B2 — Credit risk — settlement exposure (not in MR-1-FX scope).
        // Retained from placeholder; awaits Helena's full schedule.
        cluster: "B2",
        limitName:
          "Credit risk — settlement exposure (placeholder — MR-1-FX scope covers B1+B3 only)",
        limitValue: 100_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
      {
        // B3 — Market risk — FX gross notional.
        //
        // PATH A (per dispatch guidance): the existing projection folds gross notional;
        // Helena's MR-1-FX limit is a 1-day 99% VaR. Rather than emit a ZAR 350,000 VaR
        // limit against a ZAR 86m gross-notional accumulator (which would show 24,660% red
        // spuriously), this schedule entry uses the notional EOD open-position ceiling from
        // Helena §1.4 (USD 1m ≈ ZAR 18.5m) as the B3 limit.
        //
        // The VaR engine gap is flagged as Vera finding vera:mr-1-fx-var-projection-gap below.
        cluster: "B3",
        limitName:
          "Market risk — FX gross notional (proxy for MR-1-FX VaR pending VaR engine — Helena §1.4 EOD open-position ceiling)",
        limitValue: B3_NOTIONAL_LIMIT_ZAR,
        currency: "ZAR",
        breachThresholdAmber: 0.8,
        breachThresholdRed: 1.0,
      },
      {
        // B4 — Market risk — IR notional (not in MR-1-FX scope).
        // Retained from placeholder; awaits full MR schedule.
        cluster: "B4",
        limitName:
          "Market risk — IR notional (placeholder — MR-1-FX scope covers B1+B3 only)",
        limitValue: 150_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
      {
        // B5 — Liquidity — intraday (not in MR-1-FX scope).
        // Retained from placeholder; awaits full RAS schedule.
        cluster: "B5",
        limitName: "Liquidity — intraday (placeholder — MR-1-FX scope covers B1+B3 only)",
        limitValue: 500_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
    ],
  },
  eventId: newEventId(),
});

eventStore.append(event);
console.log(
  `[seed-mr-1-fx] Emitted RasLimitSchedulePublished event_id=${event.event_id}`,
);
console.log(
  `[seed-mr-1-fx] Schedule: ${SCHEDULE_ID} effective from 2026-05-21 (B1+B3 MR-1-FX aligned; B2/B4/B5 placeholder)`,
);

// ---------------------------------------------------------------------------
// File Vera finding: VaR-vs-notional projection semantic gap
// ---------------------------------------------------------------------------

const VERA_FINDING_ALREADY_KEY = "vera:mr-1-fx-var-projection-gap";

const veraFindingAlreadyFiled = [...eventStore.replay({ type: "AuditFinding" })].some((e) => {
  const p = e.payload as { summary?: string };
  return p.summary?.includes(VERA_FINDING_ALREADY_KEY);
});

if (!veraFindingAlreadyFiled) {
  const findingId = recordAuditFinding(
    {
      agentId: "rohan",
      severity: "medium",
      category: "output",
      summary:
        "vera:mr-1-fx-var-projection-gap — B3 projection folds gross notional; Helena MR-1-FX limit is 1-day 99% VaR (ZAR 350,000)",
      detail: [
        "The LimitUtilisationProjection (platform/projections/markets/limit-utilisation.ts)",
        "accumulates FX gross notional into cluster B3 via the FxTradeExecuted fold.",
        "Helena (Chief Risk Officer, governance)'s MR-1-FX limit (D-BRC-INTERIM-MR-1-FX,",
        "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md §1.1) is denominated",
        "in 1-day 99% VaR (ZAR 350,000), not gross notional.",
        "",
        "Comparing gross notional (e.g. ZAR 86m from 10+ trades) to a ZAR 350k VaR limit",
        "would produce a 24,000%+ red breach that is semantically meaningless.",
        "",
        "PATH A WORKAROUND (this PR): B3 schedule row uses Helena §1.4 gross-notional",
        "EOD open-position ceiling (USD 1m ≈ ZAR 18.5m) as a notional proxy.",
        "The limitName is explicitly labelled 'proxy for MR-1-FX VaR pending VaR engine'.",
        "",
        "TO CLOSE THIS FINDING: Build a VarComputed event family + VaR projection that",
        "folds VaR (not gross notional) into B3. Wire MarketRiskMeasureComputed events",
        "from the FRTB SA engine. Set the B3 schedule limit to ZAR 350,000 once the",
        "VaR projection is live and validated (Helena §1.6 + §1.8 criterion #2 G-2).",
        "",
        "Workstream: WS-MARKET-RISK-PROCEDURES. Substrate gap.",
      ].join("\n"),
      sourceRef:
        "prototype/platform/projections/markets/limit-utilisation.ts + D-BRC-INTERIM-MR-1-FX",
      raisedBy: "marc@tgv.co.za",
      citations: [
        "D-BRC-INTERIM-MR-1-FX",
        "WS-MARKET-RISK-PROCEDURES",
        "2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md",
        "Principles/1-events-are-truth.md",
      ],
    },
    nowUtc(),
  );
  console.log(
    `[seed-mr-1-fx] Filed Vera finding vera:mr-1-fx-var-projection-gap (findingId=${findingId})`,
  );
} else {
  console.log(
    `[seed-mr-1-fx] Vera finding vera:mr-1-fx-var-projection-gap already filed — skipping.`,
  );
}
