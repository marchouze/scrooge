// scripts/dispatch/resolve-event-db.test.ts
//
// Tests for the dispatch event-db resolver (D-CROSS-WORKTREE-EVENT-STORE-SYNC).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveDispatchEventDb } from "./resolve-event-db";

describe("resolveDispatchEventDb", () => {
  test("--event-db CLI flag wins over everything else", () => {
    const r = resolveDispatchEventDb({
      cliFlag: "/tmp/custom.db",
      envBankEventDb: "/tmp/env.db",
      envBankHomeEventDb: "/tmp/home-env.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("cli-flag");
    expect(r.path).toBe(resolve("/tmp/custom.db"));
    expect(r.shared).toBe(false);
  });

  test("BANK_EVENT_DB env wins when no CLI flag", () => {
    const r = resolveDispatchEventDb({
      envBankEventDb: "/tmp/env.db",
      envBankHomeEventDb: "/tmp/home-env.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-event-db");
    expect(r.path).toBe(resolve("/tmp/env.db"));
    // Conservatively non-shared — caller knows what they set.
    expect(r.shared).toBe(false);
  });

  test("BANK_HOME_EVENT_DB env wins over default", () => {
    const r = resolveDispatchEventDb({
      envBankHomeEventDb: "/custom/home/event.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-home-event-db");
    expect(r.path).toBe(resolve("/custom/home/event.db"));
    expect(r.shared).toBe(true);
  });

  test("home-default fires when only $HOME is known", () => {
    const r = resolveDispatchEventDb({ home: "/Users/marc" });
    expect(r.source).toBe("home-default");
    expect(r.path).toBe(resolve("/Users/marc/.local/share/bank/event.db"));
    expect(r.shared).toBe(true);
  });

  test("fallback to per-worktree .local/event.db when no home", () => {
    const r = resolveDispatchEventDb({});
    expect(r.source).toBe("fallback");
    expect(r.path).toBe(resolve(".local/event.db"));
    expect(r.shared).toBe(false);
  });

  test("empty-string CLI flag is treated as not-supplied", () => {
    const r = resolveDispatchEventDb({
      cliFlag: "   ",
      envBankEventDb: "/tmp/env.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-event-db");
  });

  test("empty-string env-vars are treated as not-supplied", () => {
    const r = resolveDispatchEventDb({
      envBankEventDb: "",
      envBankHomeEventDb: "  ",
      home: "/Users/x",
    });
    expect(r.source).toBe("home-default");
  });

  test("precedence order is stable across all combinations", () => {
    // CLI > BANK_EVENT_DB > BANK_HOME_EVENT_DB > home-default > fallback
    expect(
      resolveDispatchEventDb({
        cliFlag: "/a",
        envBankEventDb: "/b",
        envBankHomeEventDb: "/c",
        home: "/d",
      }).source,
    ).toBe("cli-flag");

    expect(
      resolveDispatchEventDb({
        envBankEventDb: "/b",
        envBankHomeEventDb: "/c",
        home: "/d",
      }).source,
    ).toBe("env-bank-event-db");

    expect(
      resolveDispatchEventDb({
        envBankHomeEventDb: "/c",
        home: "/d",
      }).source,
    ).toBe("env-bank-home-event-db");

    expect(resolveDispatchEventDb({ home: "/d" }).source).toBe("home-default");

    expect(resolveDispatchEventDb({}).source).toBe("fallback");
  });
});
