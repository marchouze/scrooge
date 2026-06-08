// platform/recon/ras-register-parity.ts
//
// Continuous-controls pipeline: RAS appetite-register parity.
//
// Gate for D-RAS-STRUCTURED-REGISTER (CEO-approved 2026-06-08). The 14 RAS
// appetite lines now live in ONE typed citation-bound register
// (`platform/risk/ras-appetite-register.ts`). This pipeline is the regression
// gate that keeps the register canonical:
//
//   (a) Citation integrity — every register line cites a `rasSection` AND at
//       least one Decision (a `D-…` citation; D-RAS is the standing authority
//       on every line). Principle 2 — every line traces upward to its source.
//   (b) Anti-duplication — no runtime handler re-defines a parallel
//       appetite-line array. A re-introduced hand-curated shadow in
//       `runtime/agents/*.ts` (an `id: "appetite:…"` object-literal array)
//       is the split-brain failure this PR retired; the gate fails loudly if
//       it reappears. Mirrors the structural anti-duplication recons (e.g.
//       prose-duplication, test-lineage-not-in-production).
//   (c) Snapshot parity — the latest `RiskAppetiteSnapshot.lineStatuses`
//       keyset equals the register's id keyset. Drift means a handler dropped
//       or added a line without updating the register (or vice-versa).
//
// Build-phase softening: when the event store holds zero RiskAppetiteSnapshot
// events (fresh bench), assertion (c) downgrades to `info` — Helena's handler
// has not been run on this bench yet. Assertions (a) and (b) are pure /
// build-time and always run.
//
// Independence note: this pipeline reads the canonical register, scans runtime
// handler source files read-only, and replays RiskAppetiteSnapshot events. It
// imports no agent runtime — recon is build-time-pure.
//
// Authority: D-RAS (CEO-approved 2026-05-06); D-RAS-STRUCTURED-REGISTER
//   (CEO-approved 2026-06-08); RAS §§B2–B8 + A2.
// Author: Atlas (Substrate engineer, engineering) ·
//         Vera (Internal audit engineer, third line of defence — recon shape).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../composition";
import { RAS_APPETITE_LINES, RAS_APPETITE_LINE_IDS } from "../risk/ras-appetite-register";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ras-register-parity";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const RUNTIME_AGENTS_DIR = resolve(REPO_ROOT, "prototype", "runtime", "agents");

// A re-introduced shadow looks like an object-literal array element keying an
// appetite line by id in a RUNTIME handler. The canonical register lives in
// platform/risk/, so any such literal under runtime/agents/ is a duplication.
const SHADOW_LINE_LITERAL = /id:\s*["']appetite:/;

interface RiskAppetiteSnapshotLike {
  readonly event_id: string;
  readonly as_of: string;
  readonly payload: { readonly lineStatuses?: unknown };
}

export interface RunOpts {
  /** Override the snapshot source — used by tests. */
  events?: Iterable<RiskAppetiteSnapshotLike>;
  /** Override the runtime-handler source scan — used by tests. */
  runtimeSources?: ReadonlyArray<{ path: string; content: string }>;
}

function loadSnapshotEvents(opts: RunOpts): RiskAppetiteSnapshotLike[] {
  if (opts.events) return [...opts.events];
  const out: RiskAppetiteSnapshotLike[] = [];
  for (const e of eventStore.replay({ type: "RiskAppetiteSnapshot" })) {
    out.push({
      event_id: e.event_id,
      as_of: e.as_of,
      payload: e.payload as RiskAppetiteSnapshotLike["payload"],
    });
  }
  return out;
}

function loadRuntimeSources(opts: RunOpts): ReadonlyArray<{ path: string; content: string }> {
  if (opts.runtimeSources) return opts.runtimeSources;
  if (!existsSync(RUNTIME_AGENTS_DIR)) return [];
  return readdirSync(RUNTIME_AGENTS_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => {
      const path = resolve(RUNTIME_AGENTS_DIR, f);
      return { path, content: readFileSync(path, "utf8") };
    });
}

function latestByAsOf(
  events: readonly RiskAppetiteSnapshotLike[],
): RiskAppetiteSnapshotLike | null {
  let latest: RiskAppetiteSnapshotLike | null = null;
  for (const e of events) {
    if (latest === null || e.as_of > latest.as_of) latest = e;
  }
  return latest;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const registerIds = new Set(RAS_APPETITE_LINE_IDS);

  // -------------------------------------------------------------------------
  // (a) Citation integrity — every line cites a rasSection AND ≥1 Decision.
  // -------------------------------------------------------------------------
  for (const line of RAS_APPETITE_LINES) {
    result.asserted++;
    if (typeof line.rasSection !== "string" || line.rasSection.trim().length === 0) {
      violations.push({
        subject: `RasAppetiteLine:${line.id}`,
        message: `Line \`${line.id}\` has no rasSection. Every appetite line must cite the RAS section that defines it (Principle 2).`,
        severity: "fail",
      });
    }
    const decisionCitations = line.citations.filter((c) => /^D-/.test(c));
    if (decisionCitations.length === 0) {
      violations.push({
        subject: `RasAppetiteLine:${line.id}`,
        message: `Line \`${line.id}\` cites no Decision (no \`D-…\` citation). Every appetite line must trace to ≥1 approving Decision (D-RAS is the standing authority). Citations present: ${line.citations.join(", ") || "(none)"}.`,
        severity: "fail",
      });
    }
  }

  // -------------------------------------------------------------------------
  // (b) Anti-duplication — no runtime handler re-defines an appetite-line
  //     array. A `id: "appetite:…"` literal under runtime/agents/ is a shadow.
  // -------------------------------------------------------------------------
  result.asserted++;
  const runtimeSources = loadRuntimeSources(opts);
  for (const src of runtimeSources) {
    const lines = src.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? "";
      if (SHADOW_LINE_LITERAL.test(text)) {
        const rel = src.path.replace(`${REPO_ROOT}/`, "");
        violations.push({
          subject: `${rel}:${i + 1}`,
          message: `Runtime handler re-defines an appetite line as a local literal (\`${text.trim()}\`). Appetite lines are canonical in platform/risk/ras-appetite-register.ts; runtime handlers must import RAS_APPETITE_LINES, not re-declare a parallel shadow (D-RAS-STRUCTURED-REGISTER, gap #6).`,
          severity: "fail",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // (c) Snapshot parity — latest RiskAppetiteSnapshot.lineStatuses keyset
  //     equals the register keyset.
  // -------------------------------------------------------------------------
  result.asserted++;
  const snapshots = loadSnapshotEvents(opts);
  if (snapshots.length === 0) {
    if (opts.events !== undefined) {
      violations.push({
        subject: "RiskAppetiteSnapshot",
        message:
          "No RiskAppetiteSnapshot events provided (synthetic mode). Pipeline requires at least one snapshot to assert keyset parity.",
        severity: "fail",
      });
    } else {
      violations.push({
        subject: "RiskAppetiteSnapshot",
        message:
          "No RiskAppetiteSnapshot events in the store — Helena's daily appetite-watch handler has not been run on this bench. Run the handler to seed a snapshot. Keyset-parity assertion skipped.",
        severity: "info",
      });
    }
  } else {
    const latest = latestByAsOf(snapshots);
    const raw = latest?.payload.lineStatuses;
    if (raw === undefined || raw === null || typeof raw !== "object") {
      violations.push({
        subject: `RiskAppetiteSnapshot:${latest?.event_id ?? "?"}`,
        message:
          "Latest snapshot lacks a `lineStatuses` object map; cannot reconcile keyset against the register.",
        severity: "fail",
      });
    } else {
      const snapKeys = new Set(Object.keys(raw as Record<string, unknown>));
      const missingFromSnapshot = [...registerIds].filter((id) => !snapKeys.has(id));
      const extraInSnapshot = [...snapKeys].filter((id) => !registerIds.has(id));
      if (missingFromSnapshot.length > 0) {
        violations.push({
          subject: `RiskAppetiteSnapshot:${latest?.event_id}`,
          message: `Register lines absent from the latest snapshot's lineStatuses keyset: ${missingFromSnapshot.join(", ")}. The handler must emit a status for every register line.`,
          severity: "fail",
        });
      }
      if (extraInSnapshot.length > 0) {
        violations.push({
          subject: `RiskAppetiteSnapshot:${latest?.event_id}`,
          message: `Snapshot lineStatuses keyset carries ids absent from the register: ${extraInSnapshot.join(", ")}. The register is canonical; a snapshot key with no register line indicates a shadow line.`,
          severity: "fail",
        });
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "RAS register parity passed (citations intact, no runtime shadow, snapshot keyset == register keyset)."
        : "RAS register parity FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
