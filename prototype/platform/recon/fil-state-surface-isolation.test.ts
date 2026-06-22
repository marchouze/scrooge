// platform/recon/fil-state-surface-isolation.test.ts
//
// Unit tests for recon:fil-state-surface-isolation (Step D,
// D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
//
// The scanner is driven against a SYNTHETIC prototype tree (injected via
// `prototypeDir`) so the assertions never depend on the real codebase. The
// NEGATIVE tests are the load-bearing ones: they prove the gate FAILS the
// moment a production consumer replays `FilInstrument*` for state, or imports a
// retired event fold into a production path.
//
// Coverage:
//   1. Clean accounting surface (no FIL replay) → ok=true.
//   2. NEGATIVE — a production GL projection that replays FilInstrumentCreated
//      for state → FAIL (the core regression this gate prevents).
//   3. NEGATIVE — a new accounting posting module that iterates FX_FIL_EVENT_TYPES
//      and replays({ type: t }) → FAIL (constant-loop form).
//   4. The allowlisted state-derivation module (fx-instance-fold.ts) replaying
//      FilInstrument* → NOT flagged.
//   5. NEGATIVE — a production (non-test, non-recon) file importing
//      foldFxContributionLegs → FAIL (oracle-only breach).
//   6. A recon oracle importing foldFxContributionLegs → NOT flagged.
//   7. A test importing foldFxContributionLegs → NOT flagged.
//   8. The retired event fold (fx-fold.ts) replaying FilInstrument* → NOT flagged
//      as a surface violation (it is governed by the oracle-only check, not the
//      surface allowlist).
//   9. Comment-only mention of a FIL replay → NOT flagged.
//
// Author: Atlas (Core banking platform architect, engineering).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { run } from "./fil-state-surface-isolation";

let tmpDirs: string[] = [];

function makeSyntheticProto(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "atlas-fil-isolation-"));
  tmpDirs.push(dir);
  // The scanner needs a CLAUDE.md only for the live-mode repo-root walk; in
  // test mode `prototypeDir` is injected, so a sentinel is enough for any
  // incidental existsSync checks under the synthetic dir.
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    const parent = rel.split("/").slice(0, -1).join("/");
    if (parent.length > 0) mkdirSync(join(dir, parent), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

describe("recon:fil-state-surface-isolation", () => {
  it("clean accounting surface (no FIL replay) → ok=true", () => {
    const dir = makeSyntheticProto({
      "platform/accounting/posting-rules-v2/fx.ts": `
        export function postFxInitialRecognitionLegs(p: unknown) { return []; }
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.surfaceReplays).toHaveLength(0);
    expect(r.productionOracleImports).toHaveLength(0);
  });

  it("NEGATIVE: GL projection replaying FilInstrumentCreated for state → FAIL", () => {
    const dir = makeSyntheticProto({
      "platform/projections/gl-projection-v2.ts": `
        export function computeTrialBalanceV2Uncached(args: any) {
          for (const e of args.eventStore.replay({ type: "FilInstrumentCreated" })) {
            // re-introduced raw-event fold — the anti-pattern.
          }
        }
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    expect(r.surfaceReplays.length).toBeGreaterThanOrEqual(1);
    expect(r.surfaceReplays[0]?.file).toBe("platform/projections/gl-projection-v2.ts");
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("NEGATIVE: new accounting module iterating FX_FIL_EVENT_TYPES + replay({type:t}) → FAIL", () => {
    const dir = makeSyntheticProto({
      "platform/accounting/posting-rules-v2/rogue-fold.ts": `
        const FX_FIL_EVENT_TYPES = ["FilInstrumentCreated"] as const;
        export function rogueFold(store: any) {
          for (const t of FX_FIL_EVENT_TYPES) {
            for (const e of store.replay({ type: t })) { void e; }
          }
        }
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    expect(r.surfaceReplays.some((s) => s.kind === "constant-loop")).toBe(true);
  });

  it("allowlisted state-derivation module replaying FilInstrument* → NOT flagged", () => {
    const dir = makeSyntheticProto({
      "platform/accounting/posting-rules-v2/fx-instance-fold.ts": `
        export function deriveFxInstanceLegs(args: any) {
          for (const e of args.eventStore.replay({ type: "FilInstrumentCreated" })) { void e; }
          return { legs: [], skipped: [], deviations: [] };
        }
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.surfaceReplays).toHaveLength(0);
  });

  it("NEGATIVE: production file importing foldFxContributionLegs → FAIL (oracle-only breach)", () => {
    const dir = makeSyntheticProto({
      "platform/projections/some-projection.ts": `
        import { foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
        export function x(store: any) { return foldFxContributionLegs({ eventStore: store }); }
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(false);
    expect(r.productionOracleImports.length).toBeGreaterThanOrEqual(1);
    expect(r.productionOracleImports[0]?.importedSymbol).toBe("foldFxContributionLegs");
  });

  it("recon oracle importing foldFxContributionLegs → NOT flagged", () => {
    const dir = makeSyntheticProto({
      "platform/recon/gl-v2-fold-equivalence-fx.ts": `
        import { foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
        export function run() { return foldFxContributionLegs; }
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.productionOracleImports).toHaveLength(0);
  });

  it("test importing foldFxContributionLegs → NOT flagged", () => {
    const dir = makeSyntheticProto({
      "platform/accounting/posting-rules-v2/fx-instance-fold.test.ts": `
        import { foldFxContributionLegs } from "./fx-fold";
        // cross-check oracle in a test — legitimate.
        void foldFxContributionLegs;
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.productionOracleImports).toHaveLength(0);
    // The test file also contains the symbol but is excluded from the surface scan too.
    expect(r.surfaceReplays).toHaveLength(0);
  });

  it("retired event fold (fx-fold.ts) replaying FilInstrument* → NOT a surface violation", () => {
    // fx-fold.ts MAY replay (it is the oracle); it is governed by the oracle-only
    // import check, not the surface allowlist. With no production importer present,
    // the gate passes.
    const dir = makeSyntheticProto({
      "platform/accounting/posting-rules-v2/fx-fold.ts": `
        export function foldFxContributionLegs(args: any) {
          for (const e of args.eventStore.replay({ type: "FilInstrumentTerminated" })) { void e; }
          return { legs: [], skipped: [], deviations: [] };
        }
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.surfaceReplays).toHaveLength(0);
    expect(r.productionOracleImports).toHaveLength(0);
  });

  it("comment-only mention of a FIL replay → NOT flagged", () => {
    const dir = makeSyntheticProto({
      "platform/accounting/posting-rules-v2/notes.ts": `
        // This module must NOT call replay({ type: "FilInstrumentCreated" }) for state.
        export const x = 1;
      `,
    });
    const r = run({ prototypeDir: dir });
    expect(r.ok).toBe(true);
    expect(r.surfaceReplays).toHaveLength(0);
  });
});
