// platform/recon/fx-v2-market-path-grounding.ts
//
// recon:fx-v2-market-path-grounding — GROUNDING-HONESTY gate (WS-FX-V2-SIMULATOR).
//
// The Outside-World Simulator surface (`GET /api/v2/markets/world-simulator`)
// presents a market-observation path (spot / forward points / OIS per day). That
// path used to be 100% hardcoded synthetic (USD/ZAR 18.5 zig-zag) and presented
// as the world's mark — Engineering-Charter command-4 (source, don't hardcode)
// violation. It is now sourced from real production marks
// (dashboard/v2-world-simulator-grounding.ts), with EVERY field carrying a
// grounding flag.
//
// THE INVARIANT THIS GATE ENFORCES (fail-closed honesty): every market-path field
// is EITHER backed by a real production mark (`grounded:true` + source + asOf +
// value) OR explicitly flagged `grounded:false` with a reason. No synthetic value
// may be presented without an ungrounded flag — silently-synthetic is a violation.
// Forward points must always be flagged `grounded:false` (no feed exists).
//
// This is the SINGLE-SOURCE honesty check: it builds the grounded path with the
// SAME builder the read surface uses (buildGroundedMarketPath) and runs the SAME
// invariant (assertGroundingHonesty) the view trusts — Principle 2, no second
// derivation site.
//
// CLEAN-STORE SAFE (Charter cmd 7): the invariant is STRUCTURAL — it holds on an
// empty CI store (every field flagged ungrounded with a reason) AND on a real
// store (grounded fields carry provenance). So this gate passes on a clean store
// while still forbidding any silently-synthetic value. To PROVE the grounded path
// is genuinely exercised (not vacuously ungrounded), the gate ALSO seeds an
// in-memory MarketDataStore with one production USD/ZAR + one zaronia-rate mark
// and asserts those fields come back `grounded:true` with the seeded provenance —
// so a regression that stops reading real marks fails here, not just in the test.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); Engineering
// Charter command 4 (source, don't hardcode) + 3/5 (no green by concealment / no
// silent deferral). Principle 1 (market ticks are reference data).
// Author: Atlas (Core banking platform architect, engineering).

import {
  GROUNDED_EOD_HOUR_UTC,
  GROUNDED_PAIR,
  assertGroundingHonesty,
  buildGroundedMarketPath,
} from "../../dashboard/v2-world-simulator-grounding";
import { resolveMarketDataDbPath } from "../market-data/resolve-market-data-db";
import { MarketDataStore } from "../market-data/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-v2-market-path-grounding";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // ---- (1) HONESTY over the LIVE store (whatever production marks exist) ------
  // Use the canonical resolved store path; if unreadable, ground against an
  // undefined store (all-ungrounded, still honest) — NEVER crash, NEVER fabricate.
  let liveStore: MarketDataStore | undefined;
  try {
    liveStore = new MarketDataStore(resolveMarketDataDbPath().path);
  } catch {
    liveStore = undefined;
  }
  try {
    const livePath = buildGroundedMarketPath(liveStore);
    result.asserted += 1;
    for (const v of assertGroundingHonesty(livePath)) {
      violations.push({
        subject: `live:${v.subject}`,
        message: `GROUNDING HONESTY BREACH (live store): ${v.message}. A market-path field on the world-simulator surface presents a value without an honest grounding flag. Authority: D-FX-V2-SIMULATOR-FIRST; Charter cmd 4.`,
        severity: "fail",
      });
    }
    // Forward points must be flagged ungrounded on every live observation.
    result.asserted += 1;
    const fwdGroundedDays = livePath.observations.filter(
      (o) => o.grounding.forwardPoints.grounded,
    ).length;
    if (fwdGroundedDays > 0) {
      violations.push({
        subject: "live:forward-points-grounded",
        message: `GROUNDING HONESTY BREACH: ${fwdGroundedDays} day(s) flag forward points grounded — there is no forward-points feed; they must always be flagged grounded:false. Authority: D-FX-V2-SIMULATOR-FIRST.`,
        severity: "fail",
      });
    }
  } finally {
    liveStore?.close();
  }

  // ---- (2) GROUNDED-PATH PROOF over a seeded in-memory store ------------------
  // Seed one production USD/ZAR + one zaronia-rate mark and assert the builder
  // returns them grounded:true with the seeded provenance. This proves the
  // grounding code actually reads real marks (a regression that silently stops
  // sourcing would fail here even on a clean CI store).
  const seeded = new MarketDataStore(":memory:");
  try {
    const seedSpotAsOf = "2026-06-20T17:00:00.000Z";
    const seedSpot = 16.4321;
    const seedOisAsOf = "2026-06-20T15:00:00+02:00";
    const seedOis = 0.0793;
    seeded.append({
      id: "seed-usdzar",
      source: "twelve-data",
      instrument: GROUNDED_PAIR,
      dataType: "fx-quote",
      provenance: "production",
      asOf: seedSpotAsOf,
      payload: { pair: GROUNDED_PAIR, mid: seedSpot },
    });
    seeded.append({
      id: "seed-zaronia",
      source: "zaronia-sarb",
      instrument: "ZARONIA",
      dataType: "zaronia-rate",
      provenance: "production",
      asOf: seedOisAsOf,
      payload: { rate: String(seedOis), convention: "overnight-compounded" },
    });

    const path = buildGroundedMarketPath(seeded);

    // 2a — honesty still holds on the seeded path.
    result.asserted += 1;
    for (const v of assertGroundingHonesty(path)) {
      violations.push({
        subject: `seeded:${v.subject}`,
        message: `GROUNDING HONESTY BREACH (seeded store): ${v.message}. Authority: D-FX-V2-SIMULATOR-FIRST.`,
        severity: "fail",
      });
    }

    // 2b — the window re-anchored to the seeded data window (anchor date 2026-06-20).
    result.asserted += 1;
    const anchorObs = path.observations[path.observations.length - 1];
    if (!anchorObs || anchorObs.date !== "2026-06-20") {
      violations.push({
        subject: "seeded:window-not-reanchored",
        message: `GROUNDED-PATH PROOF FAILURE: the displayed window did not re-anchor to the seeded real-data window (expected last day 2026-06-20, got ${anchorObs?.date ?? "none"}). The path must re-anchor to where production marks exist. Authority: D-FX-V2-SIMULATOR-FIRST.`,
        severity: "fail",
      });
    }

    // 2c — the anchor day's spot is grounded:true from the seeded production mark.
    result.asserted += 1;
    const sg = anchorObs?.grounding.spot;
    if (
      !sg?.grounded ||
      sg.source !== "twelve-data" ||
      Math.abs((sg.value ?? 0) - seedSpot) > 1e-9
    ) {
      violations.push({
        subject: "seeded:spot-not-grounded",
        message: `GROUNDED-PATH PROOF FAILURE: the anchor-day spot is not grounded from the seeded production mark (grounded=${sg?.grounded}, source=${sg?.source}, value=${sg?.value}, expected twelve-data ${seedSpot}). The builder is not sourcing real spot marks. Authority: D-FX-V2-SIMULATOR-FIRST; Charter cmd 4.`,
        severity: "fail",
      });
    }

    // 2d — the spot value is the REAL level (~16.4), not the synthetic 18.5.
    result.asserted += 1;
    if (anchorObs && Math.abs(anchorObs.spotMid - 18.5) < 0.01) {
      violations.push({
        subject: "seeded:synthetic-spot-leak",
        message:
          "GROUNDED-PATH PROOF FAILURE: the anchor-day spot is the synthetic 18.5 level despite a seeded production mark — the page is presenting synthetic as real. Authority: D-FX-V2-SIMULATOR-FIRST; Charter cmd 4.",
        severity: "fail",
      });
    }

    // 2e — the anchor day's ZAR OIS is grounded:true from the seeded zaronia mark.
    result.asserted += 1;
    const og = anchorObs?.grounding.oisRate;
    if (
      !og?.grounded ||
      og.source !== "zaronia-sarb" ||
      Math.abs((og.value ?? 0) - seedOis) > 1e-9
    ) {
      violations.push({
        subject: "seeded:ois-not-grounded",
        message: `GROUNDED-PATH PROOF FAILURE: the anchor-day ZAR OIS is not grounded from the seeded production zaronia-rate (grounded=${og?.grounded}, source=${og?.source}, value=${og?.value}, expected zaronia-sarb ${seedOis}). Authority: D-FX-V2-SIMULATOR-FIRST.`,
        severity: "fail",
      });
    }

    // 2f — forward points stay ungrounded even with marks present.
    result.asserted += 1;
    if (anchorObs?.grounding.forwardPoints.grounded) {
      violations.push({
        subject: "seeded:forward-points-grounded",
        message:
          "GROUNDED-PATH PROOF FAILURE: forward points were flagged grounded with no forward-points feed. Authority: D-FX-V2-SIMULATOR-FIRST.",
        severity: "fail",
      });
    }

    // 2g — EOD hour constant sanity (the snap instant uses the EOD hour).
    result.asserted += 1;
    const expectedInstant = `2026-06-20T${String(GROUNDED_EOD_HOUR_UTC).padStart(2, "0")}:00:00.000Z`;
    if (anchorObs && anchorObs.asOfInstant !== expectedInstant) {
      violations.push({
        subject: "seeded:eod-instant-mismatch",
        message: `GROUNDED-PATH PROOF FAILURE: the anchor-day EOD instant is ${anchorObs.asOfInstant}, expected ${expectedInstant} (EOD hour ${GROUNDED_EOD_HOUR_UTC}). Authority: D-FX-V2-SIMULATOR-FIRST.`,
        severity: "fail",
      });
    }
  } finally {
    seeded.close();
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  const fails = violations.filter((v) => v.severity === "fail").length;
  result.asOf = `${PIPELINE} [grounding-honesty ENFORCING]: ${result.asserted} assertion(s); ${fails} fail(s). Every world-simulator market-path field is grounded in a real production mark OR explicitly flagged ungrounded — no synthetic value without a flag (D-FX-V2-SIMULATOR-FIRST; Charter cmd 4).`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}\n`);
  process.exit(r.ok ? 0 : 1);
}
