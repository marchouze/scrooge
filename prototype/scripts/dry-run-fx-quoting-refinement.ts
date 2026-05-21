// scripts/dry-run-fx-quoting-refinement.ts
//
// One-off dry-run: walks every persisted `FxTradeExecuted` event in the
// live event store and re-parses each payload through the
// `fxTradeExecutedPayloadSchema` (which now carries the
// D-FX-QUOTING-CONVENTION cross-field refinement). Reports how many
// existing events would fail under the new refinement, and which fields.
//
// The output of this script frames Slice 3b's scope (Devon — sim
// generator simplification): the canonical pre-Slice-3b sim-generator
// emits FX trades with an inverted `rate.currency` (base instead of
// quote) and the wrong magnitude (1/mid instead of mid for BUY); both
// will fail the new refinement.
//
// The schema refinement still ships in Slice 1; the dry-run does not
// auto-fix or backfill anything. The long-running version of this dry
// run is `recon:fx-quoting-convention` (advisory mode until Slice 3b
// lands).
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//
// Author: Kai (trading systems engineer)

import { eventStore } from "../platform/composition";
import { fxTradeExecutedPayloadSchema } from "../platform/markets/cdm/fx";

interface FailureSummary {
  totalEvents: number;
  failingEvents: number;
  failingPercent: number;
  issuesByField: Record<string, number>;
  sampleFailures: Array<{ event_id: string; as_of: string; issues: string[] }>;
}

function dryRun(): FailureSummary {
  const summary: FailureSummary = {
    totalEvents: 0,
    failingEvents: 0,
    failingPercent: 0,
    issuesByField: {},
    sampleFailures: [],
  };

  const SAMPLE_LIMIT = 5;

  for (const ev of eventStore.replay({ type: "FxTradeExecuted" })) {
    summary.totalEvents++;
    const parsed = fxTradeExecutedPayloadSchema.safeParse(ev.payload);
    if (parsed.success) continue;

    summary.failingEvents++;
    const issueStrings: string[] = [];
    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String).join(".") || "<root>";
      summary.issuesByField[path] = (summary.issuesByField[path] ?? 0) + 1;
      issueStrings.push(`${path}: ${issue.message}`);
    }
    if (summary.sampleFailures.length < SAMPLE_LIMIT) {
      summary.sampleFailures.push({
        event_id: ev.event_id,
        as_of: ev.as_of,
        issues: issueStrings,
      });
    }
  }

  summary.failingPercent =
    summary.totalEvents === 0
      ? 0
      : Math.round((summary.failingEvents / summary.totalEvents) * 1000) / 10;

  return summary;
}

if (import.meta.main) {
  const summary = dryRun();
  console.log(
    JSON.stringify(
      {
        pipeline: "dry-run-fx-quoting-refinement",
        asOf: new Date().toISOString(),
        ...summary,
      },
      null,
      2,
    ),
  );
  // Exit 0 always — this is a reporting script, not a gate.
  process.exit(0);
}

export { dryRun };
