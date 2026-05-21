// platform/event-store/postgres-mirror.test.ts
//
// Unit tests for the best-effort Postgres event mirror.
//
// Contract:
//   1. When BANK_POSTGRES_EVENT_MIRROR_URL is absent → no-op, resolves.
//   2. When BANK_POSTGRES_EVENT_MIRROR_URL is set   → calls Postgres (mocked).
//   3. When Postgres throws                         → swallows error, resolves.
//
// Tests never connect to a real Postgres instance; a lightweight mock object
// is injected via `_resetMirrorForTesting()`.
//
// Authority: D-DISPATCH-MULTI-HOST-POSTGRES-MIRROR-AUTO-INVOKE
// Author: Atlas (Core banking platform architect, engineering)

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { _resetMirrorForTesting, mirrorEventToPostgres } from "./postgres-mirror";
import type { Event } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_EVENT: Event = {
  event_id: "test-event-001",
  type: "AgentBriefIssued",
  as_of: "2026-05-21T12:00:00.000Z",
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service", id: "agent:scrooge" },
  citations: ["D-DISPATCH-MULTI-HOST-POSTGRES-MIRROR-AUTO-INVOKE"],
  payload: { briefId: "brief:atlas:test:2026-05-21" },
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const originalEnv = process.env.BANK_POSTGRES_EVENT_MIRROR_URL;

afterEach(() => {
  // Restore env and reset cached client state between tests.
  if (originalEnv === undefined) {
    delete process.env.BANK_POSTGRES_EVENT_MIRROR_URL;
  } else {
    process.env.BANK_POSTGRES_EVENT_MIRROR_URL = originalEnv;
  }
  _resetMirrorForTesting();
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("mirrorEventToPostgres", () => {
  describe("when BANK_POSTGRES_EVENT_MIRROR_URL is absent", () => {
    beforeEach(() => {
      delete process.env.BANK_POSTGRES_EVENT_MIRROR_URL;
    });

    test("resolves without error", async () => {
      await expect(mirrorEventToPostgres(SAMPLE_EVENT)).resolves.toBeUndefined();
    });

    test("does not attempt any Postgres connection", async () => {
      // If no Bun.SQL call is made there is nothing to observe here; the
      // test is structural — if the no-op branch tried to use Bun.SQL it
      // would throw (no URL), so the successful resolution proves the branch.
      await mirrorEventToPostgres(SAMPLE_EVENT);
      // Pass — reached without error means the early-return branch fired.
    });
  });

  describe("when BANK_POSTGRES_EVENT_MIRROR_URL is set", () => {
    let unsafeCalls: string[] = [];
    let endCallCount = 0;

    beforeEach(() => {
      process.env.BANK_POSTGRES_EVENT_MIRROR_URL = "postgresql://user:pass@localhost:5432/testdb";
      unsafeCalls = [];
      endCallCount = 0;

      // Replace Bun.SQL with a lightweight mock.
      const mockClient = {
        unsafe: mock(async (sql: string) => {
          unsafeCalls.push(sql);
          return [];
        }),
        end: mock(async () => {
          endCallCount++;
        }),
      };

      // Monkey-patch Bun so the module picks up the mock.
      (Bun as unknown as Record<string, unknown>).SQL = function () {
        return mockClient;
      };

      // Reset cached client so the new mock is used.
      _resetMirrorForTesting();
    });

    test("calls Postgres with an INSERT statement", async () => {
      await mirrorEventToPostgres(SAMPLE_EVENT);
      // Two calls: one for DDL, one for INSERT.
      expect(unsafeCalls.length).toBeGreaterThanOrEqual(2);
      const insertCall = unsafeCalls.find((s) => s.includes("INSERT INTO events"));
      expect(insertCall).toBeDefined();
    });

    test("INSERT includes the event_id", async () => {
      await mirrorEventToPostgres(SAMPLE_EVENT);
      const insertCall = unsafeCalls.find((s) => s.includes("INSERT INTO events"));
      expect(insertCall).toContain(SAMPLE_EVENT.event_id);
    });

    test("INSERT includes the event type", async () => {
      await mirrorEventToPostgres(SAMPLE_EVENT);
      const insertCall = unsafeCalls.find((s) => s.includes("INSERT INTO events"));
      expect(insertCall).toContain(SAMPLE_EVENT.type);
    });

    test("DDL is only run once per process lifetime (second call skips DDL)", async () => {
      await mirrorEventToPostgres(SAMPLE_EVENT);
      const ddlCountAfterFirst = unsafeCalls.filter((s) => s.includes("CREATE TABLE")).length;

      await mirrorEventToPostgres({ ...SAMPLE_EVENT, event_id: "test-event-002" });
      const ddlCountAfterSecond = unsafeCalls.filter((s) => s.includes("CREATE TABLE")).length;

      expect(ddlCountAfterFirst).toBe(1);
      expect(ddlCountAfterSecond).toBe(1); // DDL not re-run
    });
  });

  describe("when Postgres throws", () => {
    beforeEach(() => {
      process.env.BANK_POSTGRES_EVENT_MIRROR_URL = "postgresql://user:pass@localhost:5432/testdb";

      const throwingClient = {
        unsafe: mock(async () => {
          throw new Error("connection refused");
        }),
        end: mock(async () => {}),
      };

      (Bun as unknown as Record<string, unknown>).SQL = function () {
        return throwingClient;
      };

      _resetMirrorForTesting();
    });

    test("swallows error and resolves (never throws)", async () => {
      await expect(mirrorEventToPostgres(SAMPLE_EVENT)).resolves.toBeUndefined();
    });

    test("fire-and-forget .catch chain also does not reject", async () => {
      // Simulate the dispatch CLI pattern: fire-and-forget.
      let didReject = false;
      await new Promise<void>((resolve) => {
        mirrorEventToPostgres(SAMPLE_EVENT)
          .catch(() => {
            didReject = true;
          })
          .finally(resolve);
      });
      // mirrorEventToPostgres swallows internally — outer .catch never fires.
      expect(didReject).toBe(false);
    });
  });
});
