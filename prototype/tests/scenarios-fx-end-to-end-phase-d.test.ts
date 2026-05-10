// tests/scenarios-fx-end-to-end-phase-d.test.ts
//
// Smoke + acceptance tests for Phase D of the first-dry-run FX scenario
// (`scenarios/03-fx-end-to-end-rehearsal.ts`). Asserts:
//   - `runPhaseAandBandD` produces all four BA renders (BA 325 / BA 700 /
//     BA 350 / BA 600) under a single end-to-end run.
//   - Each rendered file lands at `.local/dry-run-outputs/<period>/<form>.json`
//     (the test uses an isolated tmp dir so it does not collide with the
//     bun-run script's well-known path).
//   - Each render parses as valid JSON.
//   - Each render is hash-stored in the per-run BLAKE3 doc store; the
//     stored hash matches the rendered bytes' BLAKE3.
//   - Each `RecordFiled` event references the right report-hash (one event
//     per form; `documentHash` matches the doc-store hash).
//   - Every Phase-D event carries the scenario provenance tag with
//     `sourceLineage: "scenario:03-fx-end-to-end-rehearsal:phase-d"`.
//   - Generator-level meta echoes the period + entity + functional currency
//     from the close.
//
// Authority: D-FIRST-DRY-RUN-SCENARIO §5 Phase D (CEO-approved 2026-05-10).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA generator + render leg)
//   + Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; output writer + provenance + RecordFiled leg).

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { hashContent } from "../platform/document-store";
import { type DocumentHash, LocalFsDocumentStore } from "../platform/document-store";
import type { Ba325Output, Ba350Output, Ba600Output, Ba700Output } from "../platform/reporting";
import {
  PHASE_D_FORMS,
  PHASE_D_SOURCE_LINEAGE,
  SCENARIO_ID,
  SCENARIO_PROVENANCE,
  runPhaseAandBandD,
} from "../scenarios/03-fx-end-to-end-rehearsal";

function makeTempLayout(): {
  readonly dbPath: string;
  readonly outputDir: string;
  readonly docStoreRoot: string;
} {
  const root = mkdtempSync(join(tmpdir(), "scenario-03-phase-d-"));
  return {
    dbPath: join(root, "event.db"),
    outputDir: join(root, "outputs"),
    docStoreRoot: join(root, "doc-store"),
  };
}

describe("scenarios/03-fx-end-to-end-rehearsal — Phase D end-to-end", () => {
  it("produces all 4 BA renders + 4 RecordFiled events at period close", () => {
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });

    expect(result.ok).toBe(true);
    // Phase A: 11 events; Phase B: 11 (9 pre-close + 2 from closePeriod);
    // Phase D: 4 RecordFiled events. Total = 26.
    expect(result.emitted).toBe(26);
    expect(result.phaseDEmitted).toBe(PHASE_D_FORMS.length);
    expect(result.phaseDEmitted).toBe(4);

    expect(result.countsByType.RecordFiled).toBe(4);
    // Phase A+B counts preserved (sanity).
    expect(result.countsByType.AccountingPeriodClosed).toBe(1);
    expect(result.countsByType.TrialBalanceSnapshotted).toBe(1);
  });

  it("writes one canonical-JSON file per form to the output dir", () => {
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });
    expect(result.writeResults.length).toBe(4);

    const forms = result.writeResults.map((w) => w.form);
    expect(forms).toEqual(["ba-325", "ba-700", "ba-350", "ba-600"]);

    for (const w of result.writeResults) {
      // Each output path is under the requested output dir, named <form>.json.
      expect(w.outputPath.endsWith(`/${w.form}.json`)).toBe(true);
      // File is on disk and parses as valid JSON.
      const raw = readFileSync(w.outputPath, "utf8");
      const parsed = JSON.parse(raw);
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe("object");
    }
  });

  it("each render is hash-stored in the BLAKE3 doc store", () => {
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });
    const docStore = new LocalFsDocumentStore({ root: layout.docStoreRoot });

    for (const w of result.writeResults) {
      // The hash returned by the writer matches the doc store's record.
      const hash = w.documentHash as DocumentHash;
      expect(docStore.exists(hash)).toBe(true);

      // And the hash equals BLAKE3 of the on-disk render bytes.
      const bytes = readFileSync(w.outputPath);
      const recomputed = hashContent(bytes, "blake3");
      expect(w.documentHash).toBe(recomputed);
    }
  });

  it("each RecordFiled event payload references the right report-hash + register", () => {
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });

    for (const w of result.writeResults) {
      const e = w.recordFiledEvent;
      expect(e.type).toBe("RecordFiled");

      const payload = e.payload as {
        recordId: string;
        registerKey: string;
        documentHash: string;
        classification: string;
        retention: { citationRef: string; minimumYears: number; archivalTier: string };
      };
      expect(payload.documentHash).toBe(w.documentHash);
      expect(payload.registerKey).toBe("documents");
      expect(payload.classification).toBe("governance-seat");
      expect(payload.retention.minimumYears).toBeGreaterThanOrEqual(5);
      expect(payload.retention.archivalTier).toBe("archive");
      expect(payload.recordId.startsWith("record:documents:")).toBe(true);
      expect(payload.recordId.endsWith(`:${w.form}`)).toBe(true);
    }
  });

  it("every Phase-D event carries scenario provenance with the Phase-D source lineage", () => {
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });

    for (const w of result.writeResults) {
      const prov = w.recordFiledEvent.provenance;
      expect(prov).toBeDefined();
      expect(prov?.kind).toBe("simulated");
      expect(prov?.scenario).toBe(SCENARIO_ID);
      expect(prov?.sourceLineage).toBe(PHASE_D_SOURCE_LINEAGE);
    }
    expect(SCENARIO_PROVENANCE.scenario).toBe(SCENARIO_ID);
  });

  it("exposes summary metrics for all four BA returns", () => {
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });

    // BA 325 — LCR present (string; "infinity" valid for fixture without
    // outflows). The fixture footprint produces no outflows so LCR is
    // either infinite or trivially-compliant — both acceptable for a
    // rehearsal.
    expect(typeof result.summary.ba325.lcrPercent).toBe("string");
    expect(result.summary.ba325.lcrPercent.length).toBeGreaterThan(0);

    // BA 700 — three ratios, all positive, all in percent form. With the
    // fixture R300m CET1 / R3bn RWA the ratio is exactly 10.00%.
    expect(result.summary.ba700.cet1Ratio).toBe("10.00%");
    expect(result.summary.ba700.tier1Ratio).toBe("10.00%");
    expect(result.summary.ba700.totalRatio).toBe("10.00%");

    // BA 350 — long USD 5m × 18.45 = ZAR 92.25m → 8% × 92.25m = 7.38m
    // capital → 12.5 × 7.38m = 92.25m RWA.
    expect(result.summary.ba350.capitalMinor).toBe(738_000_000); // R7.38m
    expect(result.summary.ba350.rwaMinor).toBe(9_225_000_000); // R92.25m

    // BA 600 — BIA fixture: 15% × R10m = R1.5m capital → 12.5 × R1.5m = R18.75m RWA.
    expect(result.summary.ba600.capitalMinor).toBe(150_000_000); // R1.5m
    expect(result.summary.ba600.rwaMinor).toBe(1_875_000_000); // R18.75m
  });

  it("each on-disk render parses against its expected typed shape", () => {
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });

    const byForm: Record<string, string> = {};
    for (const w of result.writeResults) byForm[w.form] = w.outputPath;

    // BA 325 — Slice-3 typed render (`Ba325Render`).
    const ba325 = JSON.parse(readFileSync(byForm["ba-325"] as string, "utf8")) as Record<
      string,
      unknown
    >;
    expect((ba325.meta as { form: string }).form).toBe("BA 325");
    expect((ba325.meta as { entity: string }).entity).toBe("LE-ZA-HOZ-BANK");
    expect((ba325.meta as { periodId: string }).periodId).toBe("2026-Q1-M01");

    // BA 700 — Slice-4 typed render (`Ba700Render`).
    const ba700 = JSON.parse(readFileSync(byForm["ba-700"] as string, "utf8")) as Record<
      string,
      unknown
    >;
    expect((ba700.meta as { form: string }).form).toBe("BA 700");
    expect((ba700.capitalStack as { netTotalCapitalMinor: number }).netTotalCapitalMinor).toBe(
      30_000_000_000,
    );

    // BA 350 — Slice-5 generator output (no typed JSON renderer; emitted as
    // sorted-keys canonical JSON of `Ba350Output`).
    const ba350 = JSON.parse(readFileSync(byForm["ba-350"] as string, "utf8")) as Ba350Output;
    expect(ba350.meta.form).toBe("BA 350");
    expect(ba350.totalMarketRiskCapitalMinor).toBe(738_000_000);

    // BA 600 — same shape pattern as BA 350.
    const ba600 = JSON.parse(readFileSync(byForm["ba-600"] as string, "utf8")) as Ba600Output;
    expect(ba600.meta.form).toBe("BA 600");
    expect(ba600.opRiskCapitalMinor).toBe(150_000_000);
    expect(ba600.meta.approach).toBe("bia");
  });

  it("backwards-compatibility: Phase A+B counts unchanged from prior phases", () => {
    // The existing scenarios-fx-end-to-end-phase-b.test asserts 22-event
    // total for runPhaseAandB. Phase D adds 4 RecordFiled events on top
    // (26 total) but does not modify Phase A or Phase B's emissions.
    const layout = makeTempLayout();
    const result = runPhaseAandBandD({ ...layout, cleanup: false });
    expect(result.emitted - result.phaseDEmitted).toBe(22);
  });
});

// Imports kept for typed reads above; if the imports become unused on a
// generator API change, remove them then. Bun's typecheck flags unused
// type-only imports under noUnusedLocals=false (project default), so they
// remain harmless even if unused.
const _typeKeepalive: Ba325Output | Ba700Output | Ba350Output | Ba600Output | undefined = undefined;
void _typeKeepalive;
