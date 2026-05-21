// runtime/agents/atlas-alco-pack.ts
//
// Atlas's monthly ALCO pack handler.
//
// Closes the final Wave 1 substrate gap for Eitan (Treasurer):
// "Auto-generated ALCO pack — not yet built."
//
// Each run:
//   1. Calls generateALCOPack(asOf) to assemble all 8 sections from live
//      projection events in the event store.
//   2. Calls serialiseALCOPack(pack) to render the pack as structured markdown.
//   3. Files the markdown via RecordFiled (document store + event).
//   4. Emits an ALCOPackGenerated event with the document hash.
//   5. Returns { status: "ok", packId, sectionsWithNoData }.
//
// Build-phase posture:
//   All event queries will return empty (fresh event store with no positions).
//   All 8 sections will be null / empty. `overallTreasuryStatus` will be
//   "no-positions". The handler still completes successfully — the pack is
//   filed as a build-phase record documenting the zero-position baseline.
//
// Authority: D-TREASURY-GAPS-WAVE1; BA 325; BA 326; BCBS d365;
//   Banks Act 94 of 1990.
// Author: Atlas (Core banking platform architect, engineering)

import { generateALCOPack, serialiseALCOPack } from "../../platform/alco";
import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { makeALCOPackGenerated } from "../../platform/event-store/event-types/alco";
import { recordFiled } from "../../platform/records/helpers";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "BA-325",
  "BA-326",
  "BCBS-D365-IRRBB",
  "D-TREASURY-GAPS-WAVE1",
];

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const date = fmtDateUTC(ctx.asOf);
  const packId = `${ctx.asOf}-monthly`;

  // 1. Assemble the ALCO pack from live event store
  const pack = generateALCOPack(ctx.asOf);

  // 2. Serialise to markdown
  const markdownBody = serialiseALCOPack(pack);

  let eventsEmitted = 0;
  let documentHash = "no-hash-dry-run";

  if (!ctx.dryRun) {
    // 3. File the pack document via RecordFiled
    const recordResult = recordFiled(
      {
        recordId: `alco-pack:${packId}`,
        registerKey: "documents",
        body: markdownBody,
        classification: "governance-seat",
        retention: {
          citationRef: "D-TREASURY-GAPS-WAVE1",
          minimumYears: 7,
          archivalTier: "cool",
        },
        citations: EVENT_CITATIONS,
        actor: { type: "service", id: "agent:atlas:alco-pack" },
        metadata: {
          title: `ALCO Pack — ${pack.cycleLabel}`,
          path: `rms://alco/packs/${packId}`,
          category: "ALCO pack",
          date: date,
          author: "Atlas (Core banking platform architect, engineering)",
        },
      },
      ctx.asOf,
    );
    eventsEmitted++; // RecordFiled event
    documentHash = recordResult.documentHash;

    // 4. Emit ALCOPackGenerated event
    const sectionsIncluded: string[] = [];
    if (pack.liquidity !== null) sectionsIncluded.push("liquidity");
    if (pack.hqlaComposition !== null) sectionsIncluded.push("hqlaComposition");
    if (pack.almIRRBB !== null) sectionsIncluded.push("almIRRBB");
    if (pack.intradayLiquidity !== null) sectionsIncluded.push("intradayLiquidity");
    if (pack.ftpCurve !== null) sectionsIncluded.push("ftpCurve");
    if (pack.ilaapSummary !== null) sectionsIncluded.push("ilaapSummary");
    // openRiskItems and proposedResolutions are always present
    sectionsIncluded.push("openRiskItems");
    sectionsIncluded.push("proposedResolutions");

    const packEvent = makeALCOPackGenerated({
      asOf: ctx.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:atlas:alco-pack" },
      citations: EVENT_CITATIONS,
      eventId: newEventId(),
      payload: {
        packId,
        asOf: ctx.asOf,
        cycleLabel: pack.cycleLabel,
        sectionsIncluded,
        sectionsWithNoData: pack.sectionsWithNoData,
        overallTreasuryStatus: pack.overallTreasuryStatus,
        documentHash,
      },
    });
    eventStore.append(packEvent);
    eventsEmitted++;
  }

  logger.info(
    {
      packId,
      overallTreasuryStatus: pack.overallTreasuryStatus,
      sectionsWithNoData: pack.sectionsWithNoData,
      eventsEmitted,
      dryRun: ctx.dryRun,
    },
    "atlas:alco-pack — ALCO pack generation complete",
  );

  return {
    eventsEmitted,
    summary: `ALCO pack ${packId} generated: status=${pack.overallTreasuryStatus}, ${pack.sectionsWithNoData.length} sections with no data (build phase), documentHash=${documentHash}.`,
    ok: true,
  };
};

export default handler;
