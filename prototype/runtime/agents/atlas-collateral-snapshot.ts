// runtime/agents/atlas-collateral-snapshot.ts
//
// Atlas's daily collateral inventory snapshot handler.
//
// Closes Eitan's substrate gap "Collateral inventory substrate — not yet built."
//
// What this handler does:
//   1. Calls getCollateralInventory(asOf) from the collateral projection module.
//   2. Emits a CollateralInventorySnapshotted event with the HQLA buffer totals
//      and BA 110 Annex 1 cap-check results.
//   3. If l2CapBreached or l2bCapBreached: also emits HQLACompositionDrift
//      with severity "breach".
//   4. Writes a brief daily deliverable record.
//   5. Returns { status: "ok", eventsEmitted: number }.
//
// Build-phase posture:
//   - Zero real trades → zero positions, zero HQLA buffer (expected).
//   - The substrate is wired and ready; real positions flow once trade-booking
//     events start appearing in the event store at licence-day.
//
// Authority: BA 110 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getCollateralInventory } from "../../platform/collateral";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeCollateralInventorySnapshotted } from "../../platform/event-store/event-types/collateral";
import { makeHQLACompositionDrift } from "../../platform/event-store/event-types/risk-treasury-extended";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BANKS-REG-26",
  "BA-110-ANNEX-1",
  "D-TREASURY-GAPS-WAVE1",
];

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);
  const snapshotId = `COLL-SNAP-${date}`;

  const inventory = getCollateralInventory(ctx.asOf);
  let eventsEmitted = 0;

  if (!ctx.dryRun) {
    // 1. Emit CollateralInventorySnapshotted
    const snapshotEvent = makeCollateralInventorySnapshotted({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:atlas:collateral-snapshot" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        snapshotId,
        asOf: ctx.asOf,
        totalHQLAZar: inventory.totalHQLAZar,
        l1Zar: inventory.l1Zar,
        l2aZar: inventory.l2aZar,
        l2bZar: inventory.l2bZar,
        l2CapBreached: inventory.l2CapBreached,
        l2bCapBreached: inventory.l2bCapBreached,
        securityCount: inventory.positions.length,
        currency: "ZAR",
      },
    });
    eventStore.append(snapshotEvent);
    eventsEmitted++;

    // 2. Emit HQLACompositionDrift if caps are breached
    if (inventory.l2CapBreached || inventory.l2bCapBreached) {
      const totalHQLA = inventory.totalHQLAZar;
      const l2bPctOfTotal = totalHQLA > 0 ? (inventory.l2bZar / totalHQLA) * 100 : 0;
      const l1PctOfTotal = totalHQLA > 0 ? (inventory.l1Zar / totalHQLA) * 100 : 0;

      const breachedBand = inventory.l2bCapBreached
        ? "L2b > 15% of total HQLA (BA 110 Annex 1 cap)"
        : "L2 > 40% of total HQLA (BA 110 Annex 1 cap)";

      const driftEvent = makeHQLACompositionDrift({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:atlas:collateral-snapshot" },
        citations: EVENT_CITATIONS,
        eventId: newEventId(),
        payload: {
          alertId: `HQLA-DRIFT-${date}`,
          detectedAt: ctx.asOf,
          l1HQLAPct: l1PctOfTotal,
          l2aHQLAPct:
            inventory.totalHQLAZar > 0 ? (inventory.l2aZar / inventory.totalHQLAZar) * 100 : 0,
          l2bHQLAPct: l2bPctOfTotal,
          policyBandBreached: breachedBand,
          severity: "breach",
        },
      });
      eventStore.append(driftEvent);
      eventsEmitted++;
    }

    // 3. Write deliverable
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${date}_atlas_collateral-snapshot.md`;
    const lines: string[] = [];
    lines.push(frontmatter("Atlas", "collateral-snapshot", ctx.asOf));
    lines.push(`# Atlas — Collateral inventory snapshot, ${date}`);
    lines.push("");
    lines.push(
      `Daily HQLA collateral inventory snapshot — BA 110 Annex 1 classification, ${date}.`,
    );
    lines.push("");
    lines.push("## HQLA buffer summary");
    lines.push("");
    lines.push("| Bucket | Haircut-adjusted ZAR | % of total HQLA |");
    lines.push("|---|---|---|");

    const fmt = (n: number): string =>
      n === 0
        ? "0"
        : `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pct = (n: number, total: number): string =>
      total === 0 ? "—" : `${((n / total) * 100).toFixed(1)}%`;

    lines.push(
      `| L1 (0% haircut) | ${fmt(inventory.l1Zar)} | ${pct(inventory.l1Zar, inventory.totalHQLAZar)} |`,
    );
    lines.push(
      `| L2a (15% haircut) | ${fmt(inventory.l2aZar)} | ${pct(inventory.l2aZar, inventory.totalHQLAZar)} |`,
    );
    lines.push(
      `| L2b (25–50% haircut) | ${fmt(inventory.l2bZar)} | ${pct(inventory.l2bZar, inventory.totalHQLAZar)} |`,
    );
    lines.push(`| **Total HQLA buffer** | **${fmt(inventory.totalHQLAZar)}** | 100% |`);
    lines.push("");
    lines.push("## BA 110 cap checks");
    lines.push("");
    lines.push(`- **L2 cap (max 40% of HQLA):** ${inventory.l2CapBreached ? "BREACHED" : "OK"}`);
    lines.push(`- **L2b cap (max 15% of HQLA):** ${inventory.l2bCapBreached ? "BREACHED" : "OK"}`);
    lines.push("");

    if (inventory.positions.length === 0) {
      lines.push(
        "**Build phase:** zero security positions in the event store (expected). " +
          "Buffer will populate once trade-booking events flow at licence-day.",
      );
    } else {
      lines.push(`## Position register (${inventory.positions.length} securities)`);
      lines.push("");
      lines.push("| ISIN | Description | Market Value ZAR | HQLA Level | Haircut | Adjusted ZAR |");
      lines.push("|---|---|---|---|---|---|");
      for (const pos of inventory.positions) {
        lines.push(
          `| ${pos.isin} | ${pos.description} | ${fmt(pos.marketValueZar)} | ${pos.hqlaLevel} | ${(pos.haircut * 100).toFixed(0)}% | ${fmt(pos.haircutAdjustedValueZar)} |`,
        );
      }
    }

    lines.push("");
    lines.push("## Substrate gaps");
    lines.push("");
    lines.push(
      "- Live trade-booking events not yet flowing (build phase). HQLA buffer will populate at licence-day once TradeBooked/TradeSettled events start arriving.",
    );
    lines.push(
      "- Market-value revaluation (daily repricing) deferred to Ravi's market-data connector (vendor-selection phase).",
    );
    lines.push("");
    lines.push(`**Events emitted:** ${eventsEmitted}`);
    lines.push("");

    writeFileSync(resolve(ctx.ownerInboxDir, filename), lines.join("\n"), "utf8");
  }

  logger.info(
    {
      snapshotId,
      positionCount: inventory.positions.length,
      totalHQLAZar: inventory.totalHQLAZar,
      l2CapBreached: inventory.l2CapBreached,
      l2bCapBreached: inventory.l2bCapBreached,
      dryRun: ctx.dryRun,
    },
    "atlas:collateral-snapshot — snapshot complete",
  );

  return {
    eventsEmitted,
    summary: `Collateral inventory snapshot: ${snapshotId} — ${inventory.positions.length} securities, HQLA buffer ZAR ${inventory.totalHQLAZar.toLocaleString("en-ZA")}. L2 cap: ${inventory.l2CapBreached ? "BREACHED" : "OK"}. L2b cap: ${inventory.l2bCapBreached ? "BREACHED" : "OK"}.`,
    ok: true,
  };
};

export default handler;
