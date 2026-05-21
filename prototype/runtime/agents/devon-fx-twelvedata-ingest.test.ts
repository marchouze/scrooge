// runtime/agents/devon-fx-twelvedata-ingest.test.ts
//
// Unit tests for Devon's twelve-data ingest handler — focuses on the
// missing-key path. Happy-path behaviour is covered by
// `scripts/agents/fx-twelvedata-ingest.test.ts` and the per-hour
// launchd plist; this file exercises the loud-warning + dedup
// substrate-alert logic introduced in the 2026-05-21 brief.
//
// Brief: brief:devon:twelve-data-ingest-propagate-bank-twelvedata-api:2026-05-21
// Authority: D-AGENT-AUTONOMY-OPERATIONAL, D-MARKETS-SCHEMA-FOUNDATION.
//
// Author: Devon (Chief Operating Officer, governance).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { eventStore } from "../../platform/composition";
import type { AgentRunContext } from "../types";
import devonFxTwelvedataIngest, { makeMissingKeyAlertId } from "./devon-fx-twelvedata-ingest";

function buildCtx(asOf: string): AgentRunContext {
  return {
    agent: "Devon",
    trigger: { kind: "on-request", id: "fx-twelvedata-ingest" },
    asOf,
    repoRoot: process.cwd(),
    ownerInboxDir: `${process.cwd()}/Owner Inbox`,
    dryRun: false,
  };
}

describe("devon-fx-twelvedata-ingest — missing-key path", () => {
  const previousKey = process.env.BANK_TWELVEDATA_API_KEY;

  beforeEach(() => {
    // biome-ignore lint/performance/noDelete: env-var test isolation needs true absence, not undefined-assignment
    delete process.env.BANK_TWELVEDATA_API_KEY;
  });

  afterEach(() => {
    if (previousKey !== undefined) {
      process.env.BANK_TWELVEDATA_API_KEY = previousKey;
    } else {
      // biome-ignore lint/performance/noDelete: env-var test isolation needs true absence, not undefined-assignment
      delete process.env.BANK_TWELVEDATA_API_KEY;
    }
  });

  test("returns ok:false when BANK_TWELVEDATA_API_KEY missing", async () => {
    // Use a unique UTC hour bucket so we don't collide with the dedup test.
    const ctx = buildCtx("2025-01-01T01:07:33Z");
    const out = await devonFxTwelvedataIngest(ctx);
    expect(out.ok).toBe(false);
    expect(out.summary).toContain("BANK_TWELVEDATA_API_KEY not set");
  });

  test("emits exactly one SubstrateAlert in a UTC hour bucket", async () => {
    // Use a unique year+hour so tests don't pollute each other within
    // the shared composition event store.
    const before = [...eventStore.replay({ type: "SubstrateAlert" })].filter((e) => {
      const p = e.payload as { alertId?: string };
      return typeof p.alertId === "string" && p.alertId.includes("2025-02-02t02");
    }).length;

    // First fire — emits.
    const out1 = await devonFxTwelvedataIngest(buildCtx("2025-02-02T02:02:00Z"));
    expect(out1.ok).toBe(false);
    expect(out1.eventsEmitted).toBe(1);

    // Second fire 30 minutes later in the same hour — dedup'd.
    const out2 = await devonFxTwelvedataIngest(buildCtx("2025-02-02T02:32:00Z"));
    expect(out2.ok).toBe(false);
    expect(out2.eventsEmitted).toBe(0);
    expect(out2.summary).toContain("already raised");

    // Third fire in the next UTC hour — emits a fresh alert.
    const out3 = await devonFxTwelvedataIngest(buildCtx("2025-02-02T03:01:00Z"));
    expect(out3.ok).toBe(false);
    expect(out3.eventsEmitted).toBe(1);

    const after = [...eventStore.replay({ type: "SubstrateAlert" })].filter((e) => {
      const p = e.payload as { alertId?: string };
      return (
        typeof p.alertId === "string" &&
        (p.alertId.includes("2025-02-02t02") || p.alertId.includes("2025-02-02t03"))
      );
    }).length;
    // Two distinct UTC-hour buckets => two alerts emitted in this test.
    expect(after - before).toBe(2);
  });

  test("alertId follows the substrateAlertPayloadSchema regex", () => {
    // The schema requires /^alert:[a-z]+:[a-z0-9-]+$/. Our alertId is
    // `alert:integrity:twelvedata-missing-key-YYYY-MM-DDTHH` lowercased.
    const id = makeMissingKeyAlertId("2026-05-21T16:00:00Z");
    expect(id).toBe("alert:integrity:twelvedata-missing-key-2026-05-21t16");
    expect(/^alert:[a-z]+:[a-z0-9-]+$/.test(id)).toBe(true);
  });

  test("dry-run path does not append events", async () => {
    const ctx: AgentRunContext = { ...buildCtx("2025-03-03T03:01:00Z"), dryRun: true };
    const before = [...eventStore.replay({ type: "SubstrateAlert" })].length;
    const out = await devonFxTwelvedataIngest(ctx);
    expect(out.ok).toBe(false);
    expect(out.eventsEmitted).toBe(0);
    const after = [...eventStore.replay({ type: "SubstrateAlert" })].length;
    expect(after).toBe(before);
  });
});
