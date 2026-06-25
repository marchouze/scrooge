// scripts/dispatch/args.test.ts
//
// Tests for the shared dispatch arg parser's boolean-flag support — the fix for
// `dispatch:recall --json` dying with "Flag --json requires a value". Before the
// fix, parseArgs treated every `--flag` as requiring a value and die()'d on a
// trailing bare flag; now flags declared in `booleanFlags` are presence-only.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 2.

import { describe, expect, test } from "bun:test";
import { optionalBoolean, parseArgs } from "./args";

const NONE = new Set<string>();
const JSON_BOOL = new Set<string>(["json"]);

describe("parseArgs boolean flags", () => {
  test("trailing --json is presence-only (the recall bug): no value required", () => {
    // Pre-fix this threw "Flag --json requires a value" via process.exit(1);
    // reaching the assertions at all proves it no longer dies.
    const args = parseArgs(["--agent", "Bea", "--json"], NONE, JSON_BOOL);
    expect(args.agent).toBe("Bea");
    expect(optionalBoolean(args, "json")).toBe(true);
  });

  test("--json mid-args does not swallow the following flag", () => {
    const args = parseArgs(["--json", "--agent", "Bea"], NONE, JSON_BOOL);
    expect(optionalBoolean(args, "json")).toBe(true);
    expect(args.agent).toBe("Bea");
  });

  test("absent boolean flag → optionalBoolean false", () => {
    const args = parseArgs(["--agent", "Bea"], NONE, JSON_BOOL);
    expect(optionalBoolean(args, "json")).toBe(false);
  });

  test("value flags still parse normally alongside a boolean flag", () => {
    const args = parseArgs(
      ["--agent", "Bea", "--domains", "accounting,shared", "--json"],
      NONE,
      JSON_BOOL,
    );
    expect(args.domains).toBe("accounting,shared");
    expect(optionalBoolean(args, "json")).toBe(true);
  });

  test("no booleanFlags argument keeps the legacy value-required behaviour intact", () => {
    // Backward-compat: existing callers pass no booleanFlags, so every flag
    // still takes a value. `--agent Bea` parses as a value flag, unchanged.
    const args = parseArgs(["--agent", "Bea"], NONE);
    expect(args.agent).toBe("Bea");
    expect(optionalBoolean(args, "json")).toBe(false);
  });
});
