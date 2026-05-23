// scenarios/14-treasury-trades.ts
//
// Treasury sim scenario — Repo / MMD / IBL end-to-end with GL posting.
//
// Emits four treasury trade events with `simulated` provenance through the
// full booking flow: event → Bea GL engine → SubLedgerPostingEmitted.
//
// Positions (all ZAR):
//   REPO-SIM-001 — Bank lends R10m vs R186 @ 8.45% / 7 days (ABSA)
//   MMD-SIM-001  — Bank takes R5m wholesale non-op deposit @ 8.25% / 30d (SBK)
//   IBL-SIM-001  — Bank places R20m fixed-term @ 8.30% / 1 month (Investec)
//   IBL-SIM-002  — Bank places R8m overnight call @ 8.20% (RMB)
//
// GL assertions (initial recognition):
//   REPO-SIM-001: Dr ACC-5100-001 R10m / Cr ACC-1100-001 R10m
//   MMD-SIM-001:  Dr ACC-1100-001 R5m  / Cr ACC-6100-004 R5m
//   IBL-SIM-001:  Dr ACC-7100-002 R20m / Cr ACC-1100-001 R20m
//   IBL-SIM-002:  Dr ACC-7100-001 R8m  / Cr ACC-1100-001 R8m
//
// Supersedes boot seeds:
//   When run with BANK_SCENARIO_SHARED=1, `bootTreasurySeeds` in
//   `dashboard/server.ts` detects REPO-SIM-001 / MMD-SIM-001 / IBL-SIM-001 /
//   IBL-SIM-002 and suppresses boot emission entirely
//   (TREASURY_SIM_*_IDS guard in server.ts).
//
// Authority:
//   WS1-PR1a (brief:ravi:ws1-pr1a-repo-mmd-ibl-event-types:2026-05-23)
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   IFRS 9 §3.1.1; IAS 39 §27; BA 325 Table 1
//
// Note: `bun run scenario:treasury-trades:shared` writes to the shared home
// event store and causes `bootTreasurySeeds` to yield on next server restart.
//
// Run: `bun run scenario:treasury-trades`
// Run (shared store): `bun run scenario:treasury-trades:shared`
//
// Authors: Ravi (Treasury/ALM Engineer, engineering),
//          Bea (Accounting & financial reporting engineer, engineering)

import {
  makeDepositTaken,
  makeInterbankLoanPlaced,
  makeRepoTradeOpened,
} from "@platform/event-store/event-types/repo-mmd-ibl";
import { simulatedTag } from "@platform/event-store/provenance";
import { logger } from "@platform/observability/logger";
import { beaGlPostingEngine } from "../runtime/agents/bea-gl-posting-engine";

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

const SCENARIO_ID = "treasury-trades-001";

const SCENARIO_PROVENANCE = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: "scenarios/14-treasury-trades.ts",
  tags: ["treasury", "repo", "mmd", "ibl"],
});

const ENTITY = "LE-BANK-SA";
const ACTOR = {
  type: "service" as const,
  id: "sim:treasury-desk",
  name: "Treasury sim desk",
} as const;

const CITATIONS: readonly string[] = [
  "D-MARKETS-SCHEMA-FOUNDATION",
  "WS1-PR1a",
  "IFRS9-3.1.1",
  "IAS39-27",
];

const AS_OF = "2026-05-23T08:00:00.000Z";

// ---------------------------------------------------------------------------
// Trade payloads
// ---------------------------------------------------------------------------

const REPO_SIM_001 = {
  tradeId: "REPO-SIM-001",
  counterpartyLei: "ABSA00000000000000001",
  startLegSettlementDate: "2026-05-23",
  endLegSettlementDate: "2026-05-30",
  startLegCashZar: 1_000_000_000, // R10m in cents
  repurchasePriceZar: 1_000_161_644,
  repoRateDecimal: 0.0845,
  collateralIsin: "ZAG000109728",
  collateralFaceValue: 1_020_000_000,
  collateralHaircutPct: 0.02,
  bookId: "TREASURY",
  traderRef: "TREAS-SIM-001",
  instrumentRef: "fi:pam:REPO-7D-001",
} as const;

const MMD_SIM_001 = {
  depositId: "MMD-SIM-001",
  counterpartyLei: "SBK000000000000000001",
  principalZar: 500_000_000, // R5m in cents
  interestRateDecimal: 0.0825,
  maturityDate: "2026-06-22",
  depositCategory: "wholesale-non-operational" as const,
  bookId: "TREASURY",
  instrumentRef: "fi:pam:MMD-30D-001",
} as const;

const IBL_SIM_001 = {
  placementId: "IBL-SIM-001",
  counterpartyLei: "INV000000000000000001",
  principalZar: 2_000_000_000, // R20m in cents
  rateDecimal: 0.083,
  startDate: "2026-05-23",
  maturityDate: "2026-06-23",
  placementType: "fixed-term" as const,
  bookId: "TREASURY",
  instrumentRef: "fi:pam:IBL-1M-001",
} as const;

const IBL_SIM_002 = {
  placementId: "IBL-SIM-002",
  counterpartyLei: "RMB000000000000000001",
  principalZar: 800_000_000, // R8m in cents
  rateDecimal: 0.082,
  startDate: "2026-05-23",
  maturityDate: null,
  placementType: "call" as const,
  bookId: "TREASURY",
  instrumentRef: "fi:clm:IBL-CALL-001",
} as const;

// ---------------------------------------------------------------------------
// Scenario runner
//
// Uses the composition eventStore singleton (same store the GL engine reads).
// The BANK_EVENT_DB env var controls which DB file is used — set it before
// importing this module (or import it first) to target the shared home store.
// ---------------------------------------------------------------------------

export async function runTreasuryTradesScenario(): Promise<{
  ok: boolean;
  tradesEmitted: number;
  glPostingsEmitted: number;
  errors: string[];
}> {
  // Import composition store after env is set so BANK_EVENT_DB is honoured.
  const { eventStore } = await import("@platform/composition");

  const errors: string[] = [];
  let tradesEmitted = 0;

  // ── Idempotency — collect existing business IDs ───────────────────────

  const existingRepoIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "RepoTradeOpened" })) {
    const p = ev.payload as { tradeId?: string };
    if (p.tradeId) existingRepoIds.add(p.tradeId);
  }

  const existingDepositIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "DepositTaken" })) {
    const p = ev.payload as { depositId?: string };
    if (p.depositId) existingDepositIds.add(p.depositId);
  }

  const existingPlacementIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "InterbankLoanPlaced" })) {
    const p = ev.payload as { placementId?: string };
    if (p.placementId) existingPlacementIds.add(p.placementId);
  }

  // ── Emit trade events ─────────────────────────────────────────────────

  const simTradeEventIds: string[] = [];

  if (!existingRepoIds.has(REPO_SIM_001.tradeId)) {
    const ev = makeRepoTradeOpened({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: [...CITATIONS],
      payload: REPO_SIM_001,
    });
    ev.provenance = SCENARIO_PROVENANCE;
    eventStore.append(ev);
    simTradeEventIds.push(ev.event_id);
    tradesEmitted++;
    logger.info({ tradeId: REPO_SIM_001.tradeId }, "treasury-sim: RepoTradeOpened emitted");
  } else {
    // Collect existing event ID for GL assertion
    for (const ev of eventStore.replay({ type: "RepoTradeOpened" })) {
      const p = ev.payload as { tradeId?: string };
      if (p.tradeId === REPO_SIM_001.tradeId) simTradeEventIds.push(ev.event_id);
    }
    logger.debug({ tradeId: REPO_SIM_001.tradeId }, "treasury-sim: repo idempotent — skipped");
  }

  if (!existingDepositIds.has(MMD_SIM_001.depositId)) {
    const ev = makeDepositTaken({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: [...CITATIONS],
      payload: MMD_SIM_001,
    });
    ev.provenance = SCENARIO_PROVENANCE;
    eventStore.append(ev);
    simTradeEventIds.push(ev.event_id);
    tradesEmitted++;
    logger.info({ depositId: MMD_SIM_001.depositId }, "treasury-sim: DepositTaken emitted");
  } else {
    for (const ev of eventStore.replay({ type: "DepositTaken" })) {
      const p = ev.payload as { depositId?: string };
      if (p.depositId === MMD_SIM_001.depositId) simTradeEventIds.push(ev.event_id);
    }
    logger.debug(
      { depositId: MMD_SIM_001.depositId },
      "treasury-sim: deposit idempotent — skipped",
    );
  }

  for (const payload of [IBL_SIM_001, IBL_SIM_002]) {
    if (!existingPlacementIds.has(payload.placementId)) {
      const ev = makeInterbankLoanPlaced({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [...CITATIONS],
        payload,
      });
      ev.provenance = SCENARIO_PROVENANCE;
      eventStore.append(ev);
      simTradeEventIds.push(ev.event_id);
      tradesEmitted++;
      logger.info(
        { placementId: payload.placementId },
        "treasury-sim: InterbankLoanPlaced emitted",
      );
    } else {
      for (const ev of eventStore.replay({ type: "InterbankLoanPlaced" })) {
        const p = ev.payload as { placementId?: string };
        if (p.placementId === payload.placementId) simTradeEventIds.push(ev.event_id);
      }
      logger.debug({ placementId: payload.placementId }, "treasury-sim: IBL idempotent — skipped");
    }
  }

  // ── Run Bea's GL engine to post the new trade events ─────────────────

  const ctx = {
    agent: "bea",
    asOf: AS_OF,
    trigger: { kind: "on-request" as const, id: `scenario:${SCENARIO_ID}` },
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };

  const glResult = await beaGlPostingEngine(ctx);

  if (!glResult.ok) {
    errors.push(`GL engine: ${glResult.summary}`);
  }

  // ── Assert GL postings exist for each sim trade event ────────────────

  const postings = [...eventStore.replay({ type: "SubLedgerPostingEmitted" })];
  const postedSourceIds = new Set(
    postings.map((e) => (e.payload as { sourceEventId?: string }).sourceEventId),
  );

  let glPostingsEmitted = 0;
  for (const eventId of simTradeEventIds) {
    if (postedSourceIds.has(eventId)) {
      glPostingsEmitted++;
    } else {
      errors.push(`GL posting missing for sim trade event ${eventId}`);
    }
  }

  const ok = errors.length === 0;
  if (ok) {
    logger.info(
      { tradesEmitted, glPostingsEmitted },
      "treasury-sim: scenario complete — all trades booked and GL-posted",
    );
  } else {
    logger.error({ errors }, "treasury-sim: scenario completed with errors");
  }

  return { ok, tradesEmitted, glPostingsEmitted, errors };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const shared = process.env.BANK_SCENARIO_SHARED === "1";

  if (shared) {
    logger.info("treasury-sim: BANK_SCENARIO_SHARED=1 — targeting shared home event store");
  } else {
    // Point to an isolated local DB for dry-run testing
    if (!process.env.BANK_EVENT_DB) {
      process.env.BANK_EVENT_DB = ".local/scenario-treasury-trades.db";
    }
    logger.info(
      { db: process.env.BANK_EVENT_DB },
      "treasury-sim: running against isolated local event store",
    );
  }

  const result = await runTreasuryTradesScenario();

  if (!result.ok) {
    logger.error({ errors: result.errors }, "treasury-sim: FAILED");
    process.exit(1);
  }

  logger.info(
    { tradesEmitted: result.tradesEmitted, glPostingsEmitted: result.glPostingsEmitted },
    "treasury-sim: SUCCESS",
  );
}
