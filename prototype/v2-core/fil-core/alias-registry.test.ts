// v2-core/fil-core/alias-registry.test.ts
//
// Tests for the SHARED FIL alias-registry — the one substrate every swappable
// seam resolves through (WS-V2-BBAAS).
//
// Pillars (brief §4):
//   - register / resolve a default
//   - swap + restore (the cutover / rollback primitive)
//   - eager-default: resolve returns the registered default before any swap
//   - multi-key isolation: independent keys do not collide
//   - unknown-key resolve / swap throws (no silent undefined; not dangling)
//   - register-twice throws (default registered exactly once)
//
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";
import {
  isAliasRegistered,
  registerAlias,
  resolveAlias,
  swapAlias,
} from "./alias-registry";

// Each test uses a UNIQUE key so the process-global registry is not shared
// across tests (the registry is module-scoped + process-global by design; the
// production seams own the `fil-core:*` / `fil-models:*` namespaces, so tests
// here mint disposable `test:*` keys).
let keySeq = 0;
function uniqueKey(label: string): string {
  keySeq += 1;
  return `test:alias-registry:${label}:${keySeq}`;
}

describe("alias-registry — register + resolve", () => {
  it("resolves the registered default (eager default)", () => {
    const key = uniqueKey("default");
    const impl = { tag: "default-impl" };
    registerAlias(key, impl);
    expect(resolveAlias(key)).toBe(impl);
  });

  it("reports registration via isAliasRegistered", () => {
    const key = uniqueKey("is-registered");
    expect(isAliasRegistered(key)).toBe(false);
    registerAlias(key, { tag: "x" });
    expect(isAliasRegistered(key)).toBe(true);
  });

  it("throws on resolve of an unregistered key (not dangling/undefined)", () => {
    const key = uniqueKey("unregistered-resolve");
    expect(() => resolveAlias(key)).toThrow(/not registered/);
  });

  it("throws on a second register of the same key (default registered once)", () => {
    const key = uniqueKey("double-register");
    registerAlias(key, { tag: "first" });
    expect(() => registerAlias(key, { tag: "second" })).toThrow(/already has a registered default/);
    // The first default is untouched by the rejected re-register.
    expect(resolveAlias<{ tag: string }>(key).tag).toBe("first");
  });
});

describe("alias-registry — swap + restore", () => {
  it("swap replaces the resolved impl; restore unwinds to the previous", () => {
    const key = uniqueKey("swap-restore");
    const def = { tag: "default" };
    const swapped = { tag: "swapped" };
    registerAlias(key, def);

    expect(resolveAlias(key)).toBe(def);

    const handle = swapAlias(key, swapped);
    expect(resolveAlias(key)).toBe(swapped);

    handle.restore();
    expect(resolveAlias(key)).toBe(def);
  });

  it("nested swaps restore to the immediately-previous impl (LIFO)", () => {
    const key = uniqueKey("nested-swap");
    const a = { tag: "a" };
    const b = { tag: "b" };
    const c = { tag: "c" };
    registerAlias(key, a);

    const h1 = swapAlias(key, b);
    expect(resolveAlias(key)).toBe(b);
    const h2 = swapAlias(key, c);
    expect(resolveAlias(key)).toBe(c);

    h2.restore();
    expect(resolveAlias(key)).toBe(b);
    h1.restore();
    expect(resolveAlias(key)).toBe(a);
  });

  it("throws on swap of an unregistered key (cannot swap a seam with no default)", () => {
    const key = uniqueKey("swap-unregistered");
    expect(() => swapAlias(key, { tag: "x" })).toThrow(/has no registered default/);
  });
});

describe("alias-registry — multi-key isolation", () => {
  it("independent keys do not collide; swapping one leaves the other intact", () => {
    const keyA = uniqueKey("iso-a");
    const keyB = uniqueKey("iso-b");
    const defA = { tag: "A-default" };
    const defB = { tag: "B-default" };
    registerAlias(keyA, defA);
    registerAlias(keyB, defB);

    const handleA = swapAlias(keyA, { tag: "A-swapped" });
    // B is untouched by the swap of A.
    expect(resolveAlias<{ tag: string }>(keyB).tag).toBe("B-default");
    expect(resolveAlias<{ tag: string }>(keyA).tag).toBe("A-swapped");

    handleA.restore();
    expect(resolveAlias<{ tag: string }>(keyA).tag).toBe("A-default");
    expect(resolveAlias<{ tag: string }>(keyB).tag).toBe("B-default");
  });

  it("carries a typed implementation through resolve (the seam-accessor cast site)", () => {
    type Fn = (n: number) => number;
    const key = uniqueKey("typed");
    const dbl: Fn = (n) => n * 2;
    registerAlias<Fn>(key, dbl);
    const resolved = resolveAlias<Fn>(key);
    expect(resolved(21)).toBe(42);
  });
});
