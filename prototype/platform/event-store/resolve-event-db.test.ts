// platform/event-store/resolve-event-db.test.ts
//
// Tests for the shared event-DB resolver — the canonical resolution used
// by both the composition root and the dispatch CLIs (see
// `resolve-event-db.ts` for context).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { resolveEventDbPath } from "./resolve-event-db";

// Inputs that fully bypass env defaults — every channel set to a known
// value (string for set, empty-string for not-set). Tests use this base
// pattern to keep `process.env` out of the precedence assertion.
const NO_ENV = {
  explicit: "",
  envBankEventDb: "",
  envBankHomeEventDb: "",
  home: "",
} as const;

describe("resolveEventDbPath — precedence chain", () => {
  test("explicit override wins over everything else", () => {
    const r = resolveEventDbPath({
      ...NO_ENV,
      explicit: "/tmp/custom.db",
      envBankEventDb: "/tmp/env.db",
      envBankHomeEventDb: "/tmp/home-env.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("explicit");
    expect(r.path).toBe(resolve("/tmp/custom.db"));
    expect(r.shared).toBe(false);
  });

  test("BANK_EVENT_DB env wins when no explicit override", () => {
    const r = resolveEventDbPath({
      ...NO_ENV,
      envBankEventDb: "/tmp/env.db",
      envBankHomeEventDb: "/tmp/home-env.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-event-db");
    expect(r.path).toBe(resolve("/tmp/env.db"));
    // Conservatively non-shared — caller knows what they set.
    expect(r.shared).toBe(false);
  });

  test("BANK_HOME_EVENT_DB env wins over home-default", () => {
    const r = resolveEventDbPath({
      ...NO_ENV,
      envBankHomeEventDb: "/custom/home/event.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-home-event-db");
    expect(r.path).toBe(resolve("/custom/home/event.db"));
    expect(r.shared).toBe(true);
  });

  test("home-default fires when only $HOME is known", () => {
    const r = resolveEventDbPath({ ...NO_ENV, home: "/Users/marc" });
    expect(r.source).toBe("home-default");
    expect(r.path).toBe(resolve("/Users/marc/.local/share/bank/event.db"));
    expect(r.shared).toBe(true);
  });

  test("fallback to per-worktree .local/event.db when no home", () => {
    // All env-bypassing keys present + empty strings to short-circuit the
    // default `process.env` / `homedir()` lookups.
    const r = resolveEventDbPath({
      envBankEventDb: "",
      envBankHomeEventDb: "",
      home: "",
    });
    expect(r.source).toBe("fallback");
    expect(r.path).toBe(resolve(".local/event.db"));
    expect(r.shared).toBe(false);
  });

  test("empty / whitespace explicit override is treated as not-supplied", () => {
    const r = resolveEventDbPath({
      ...NO_ENV,
      explicit: "   ",
      envBankEventDb: "/tmp/env.db",
      home: "/Users/x",
    });
    expect(r.source).toBe("env-bank-event-db");
  });

  test("empty / whitespace env-vars are treated as not-supplied", () => {
    const r = resolveEventDbPath({
      ...NO_ENV,
      envBankEventDb: "",
      envBankHomeEventDb: "  ",
      home: "/Users/x",
    });
    expect(r.source).toBe("home-default");
  });

  test("precedence order is stable across all combinations", () => {
    // explicit > BANK_EVENT_DB > BANK_HOME_EVENT_DB > home-default > fallback
    expect(
      resolveEventDbPath({
        ...NO_ENV,
        explicit: "/a",
        envBankEventDb: "/b",
        envBankHomeEventDb: "/c",
        home: "/d",
      }).source,
    ).toBe("explicit");

    expect(
      resolveEventDbPath({
        ...NO_ENV,
        envBankEventDb: "/b",
        envBankHomeEventDb: "/c",
        home: "/d",
      }).source,
    ).toBe("env-bank-event-db");

    expect(
      resolveEventDbPath({
        ...NO_ENV,
        envBankHomeEventDb: "/c",
        home: "/d",
      }).source,
    ).toBe("env-bank-home-event-db");

    expect(resolveEventDbPath({ ...NO_ENV, home: "/d" }).source).toBe("home-default");

    expect(resolveEventDbPath(NO_ENV).source).toBe("fallback");
  });

  test("paths are resolved to absolute (not bare relative strings)", () => {
    const r = resolveEventDbPath({ ...NO_ENV, explicit: "relative/path.db" });
    expect(r.path.startsWith("/")).toBe(true);
    expect(r.path.endsWith("relative/path.db")).toBe(true);
  });
});

describe("resolveEventDbPath — env-default reads (no injected inputs)", () => {
  // These tests must NOT leak state across the suite. We snapshot + restore.

  test("reads BANK_EVENT_DB from process.env when not injected", () => {
    const prevEvent = process.env.BANK_EVENT_DB;
    const prevHome = process.env.BANK_HOME_EVENT_DB;
    try {
      process.env.BANK_EVENT_DB = "/tmp/from-process-env.db";
      delete process.env.BANK_HOME_EVENT_DB;
      const r = resolveEventDbPath();
      expect(r.source).toBe("env-bank-event-db");
      expect(r.path).toBe(resolve("/tmp/from-process-env.db"));
    } finally {
      if (prevEvent === undefined) delete process.env.BANK_EVENT_DB;
      else process.env.BANK_EVENT_DB = prevEvent;
      if (prevHome === undefined) delete process.env.BANK_HOME_EVENT_DB;
      else process.env.BANK_HOME_EVENT_DB = prevHome;
    }
  });

  test("reads BANK_HOME_EVENT_DB from process.env when not injected", () => {
    const prevEvent = process.env.BANK_EVENT_DB;
    const prevHome = process.env.BANK_HOME_EVENT_DB;
    try {
      delete process.env.BANK_EVENT_DB;
      process.env.BANK_HOME_EVENT_DB = "/tmp/from-home-env.db";
      const r = resolveEventDbPath();
      expect(r.source).toBe("env-bank-home-event-db");
      expect(r.path).toBe(resolve("/tmp/from-home-env.db"));
    } finally {
      if (prevEvent === undefined) delete process.env.BANK_EVENT_DB;
      else process.env.BANK_EVENT_DB = prevEvent;
      if (prevHome === undefined) delete process.env.BANK_HOME_EVENT_DB;
      else process.env.BANK_HOME_EVENT_DB = prevHome;
    }
  });

  test("falls back to os.homedir() when no env vars set", () => {
    const prevEvent = process.env.BANK_EVENT_DB;
    const prevHome = process.env.BANK_HOME_EVENT_DB;
    try {
      delete process.env.BANK_EVENT_DB;
      delete process.env.BANK_HOME_EVENT_DB;
      const r = resolveEventDbPath();
      // On any normal dev / CI runner, homedir() resolves; "fallback" should
      // only fire in unusual containers. Assert on either of the two valid
      // outcomes.
      if (homedir() && homedir().trim() !== "") {
        expect(r.source).toBe("home-default");
        expect(r.shared).toBe(true);
        expect(r.path).toBe(resolve(homedir(), ".local/share/bank/event.db"));
      } else {
        expect(r.source).toBe("fallback");
        expect(r.shared).toBe(false);
      }
    } finally {
      if (prevEvent === undefined) delete process.env.BANK_EVENT_DB;
      else process.env.BANK_EVENT_DB = prevEvent;
      if (prevHome === undefined) delete process.env.BANK_HOME_EVENT_DB;
      else process.env.BANK_HOME_EVENT_DB = prevHome;
    }
  });
});

describe("resolveEventDbPath — identity with prior dispatch-CLI behaviour", () => {
  // Spec table from `scripts/dispatch/resolve-event-db.ts` (the previous
  // home of this logic). Each row must map identically when all four
  // channels are supplied explicitly (so env defaults can't leak in).

  test("explicit > BANK_EVENT_DB > BANK_HOME_EVENT_DB > home-default > fallback", () => {
    const inputs = [
      {
        opts: { explicit: "/a", envBankEventDb: "/b", envBankHomeEventDb: "/c", home: "/d" },
        expected: { source: "explicit", shared: false, path: "/a" },
      },
      {
        opts: { explicit: "", envBankEventDb: "/b", envBankHomeEventDb: "/c", home: "/d" },
        expected: { source: "env-bank-event-db", shared: false, path: "/b" },
      },
      {
        opts: { explicit: "", envBankEventDb: "", envBankHomeEventDb: "/c", home: "/d" },
        expected: { source: "env-bank-home-event-db", shared: true, path: "/c" },
      },
      {
        opts: { explicit: "", envBankEventDb: "", envBankHomeEventDb: "", home: "/d" },
        expected: { source: "home-default", shared: true, path: "/d/.local/share/bank/event.db" },
      },
      {
        opts: { explicit: "", envBankEventDb: "", envBankHomeEventDb: "", home: "" },
        expected: { source: "fallback", shared: false, path: ".local/event.db" },
      },
    ] as const;

    for (const row of inputs) {
      const r = resolveEventDbPath(row.opts);
      expect(r.source).toBe(row.expected.source);
      expect(r.shared).toBe(row.expected.shared);
      expect(r.path).toBe(resolve(row.expected.path));
    }
  });
});
