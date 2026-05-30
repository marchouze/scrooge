// scripts/cleanup-fx-frontend-driver-provenance-pollution.ts
//
// One-shot maintenance script: reclassify two `FxTradeExecuted` events that
// were mis-tagged `kind:production` when they were in fact simulated
// counterparty FX test trades booked through the trade-book front-end driver.
//
// Root cause
// ----------
// The FX front-end trade-input driver (`platform/simulation/fx-frontend-
// driver/README.md`, authority `D-FX-SIM-FRONTEND-INPUT-DRIVER`) documented
// "click the Simulated radio" to set the booking-mode control. That control is
// a pair of VISUALLY-HIDDEN radios (`<input type="radio" name="provenanceMode"
// value="production" checked>` / `value="simulated"`). A raw browser click on
// the hidden radio does NOT register, so the form stayed on its default
// `production` mode. Two simulated test trades (trader =
// `sim:counterparty-fx-request`) were therefore booked tagged `production`:
//
//   - 782a7c66-267f-4926-ad08-bd609b3743be  (MAN-1780135556707-A2F877A9)
//   - e74c3ec1-c01e-44ad-9d59-df29eaac6b5b  (MAN-1780136862743-A7951042)
//
// The driver README is hardened in the same PR to mandate `form_input(ref,
// true)` + a pre-submit `:checked`-value assertion + a post-submit event-store
// provenance verification, so this defect cannot recur.
//
// What this script does
// ----------------------
// For EACH of the two target trades:
//   1. Re-tags the envelope `production -> simulated` via
//      `eventStore.reclassifyProvenance` — the same substrate-managed UPDATE
//      the existing provenance healers use (payload + actor + citations +
//      sequence + as_of all preserved; only the typed envelope axis moves).
//   2. Emits a typed `ProvenanceReclassified` audit event recording the
//      before/after envelope tag, the authorising decision
//      (`D-PROVENANCE-BUILD-PHASE-CLASS`), and a `runRef` clustering the run.
//
// The target row MUST exist before the audit event is emitted (the
// ProvenanceReclassified authoring contract requires it); this script asserts
// existence via the reclassify result (`not-found` is fatal) before appending.
//
// GL / position spillover
// -----------------------
// When these trades booked as `production`, the (scoped, post-#912) GL engine
// emitted `SubLedgerPostingEmitted` rows referencing the trade event via
// `payload.sourceEventId`. This script scans for ANY event referencing either
// target event_id via `sourceEventId` and reclassifies any that are still
// `production` to `simulated` (same audit-event mechanism), so the
// production-only FX position / PnL / GL views stop counting them.
//
// After the run the script CONFIRMS, via a production-only query, that neither
// the two trades NOR any of their postings remain tagged `production`.
//
// Audit-event provenance
// ----------------------
// The ProvenanceReclassified audit events are themselves tagged `simulated`
// (sourceLineage `cleanup:fx-frontend-driver-radio-defect`). They document the
// reclassification of simulated trades; tagging them `simulated` keeps them out
// of production-only projections AND avoids the cross-reference rule
// (`checkCrossReference`: a production event may not reference a simulated
// event — the audit event cites the now-simulated target). The
// `recon:test-lineage-not-in-production` gate only flags `production`-tagged
// ProvenanceReclassified events with a `test-`-prefixed sourceLineage, so this
// non-test, simulated-tagged audit event is clean on that gate.
//
// Idempotency
// -----------
// `reclassifyProvenance` returns `{reclassified: false, reason:
// "already-at-target"}` once a row is `simulated`, in which case no audit event
// is emitted for it. Re-running the script produces a 0-reclassification pass.
//
// Usage
// -----
//   bun run scripts/cleanup-fx-frontend-driver-provenance-pollution.ts
//   bun run scripts/cleanup-fx-frontend-driver-provenance-pollution.ts --dry-run
//
// Exit codes: 0 on success / clean; 1 if a target event is not-found or a
// production residue remains after apply (confirmation failure).
//
// Authority:
//   - D-PROVENANCE-BUILD-PHASE-CLASS (CEO-approved 2026-05-22)
//   - D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10)
//   - D-FX-SIM-FRONTEND-INPUT-DRIVER (context: the defect being remediated)
//   - Principle 1 — events are the only source of truth
//
// Author: Atlas (Core banking platform architect, engineering — substrate)

import { applyDispatchEventDbResolution } from "./dispatch/resolve-event-db";

// Adopt the shared home-store before importing composition (so the cleanup
// operates on the canonical bank event log).
applyDispatchEventDbResolution();

import { eventStore } from "../platform/composition";
import { BANK_ZA_001, newEventId } from "../platform/core/types";
import { makeProvenanceReclassified } from "../platform/event-store/event-types/provenance-reclassified";
import { type ProvenanceTag, simulatedTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";

const PIPELINE = "cleanup:fx-frontend-driver-provenance-pollution";

/** The two mis-tagged simulated FX test trades (trader sim:counterparty-fx-request). */
export const TARGET_TRADE_EVENT_IDS: ReadonlyArray<string> = [
  "782a7c66-267f-4926-ad08-bd609b3743be", // MAN-1780135556707-A2F877A9
  "e74c3ec1-c01e-44ad-9d59-df29eaac6b5b", // MAN-1780136862743-A7951042
];

const RECLASSIFICATION_REASON =
  "front-end-driver radio-selection defect — agent-booked simulated FX test trade " +
  "mis-tagged production (hidden provenanceMode radio not set by raw click; " +
  "form stayed on default production). See platform/simulation/fx-frontend-driver/README.md.";

export interface CleanupResult {
  readonly tradesReclassified: number;
  readonly tradesAlreadyClean: number;
  readonly postingsReclassified: number;
  readonly postingsAlreadyClean: number;
  readonly auditEventsEmitted: number;
  readonly notFound: ReadonlyArray<string>;
  readonly productionResidue: ReadonlyArray<string>;
}

interface CleanupOpts {
  readonly dryRun?: boolean;
  readonly runRef?: string;
}

/**
 * Reclassify a single event `production -> simulated` and emit the audit
 * event. Returns "reclassified" | "already-clean" | "not-found".
 *
 * The new `simulated` tag preserves the prior `sourceLineage` and `tags` so
 * the audit trail keeps the operator/manual lineage; only `kind` flips and a
 * `scenario` is attached identifying the cleanup.
 */
function reclassifyOne(
  eventId: string,
  runRef: string,
  dryRun: boolean,
): "reclassified" | "already-clean" | "not-found" {
  // Read current tag to build a lineage-preserving simulated tag.
  const current = eventStore.replay().find((e) => e.event_id === eventId);
  if (!current) return "not-found";
  const prior = current.provenance;
  if (prior && prior.kind === "simulated") return "already-clean";

  if (dryRun) {
    // In dry-run we only report what WOULD happen; treat non-simulated as a
    // would-reclassify and missing-prior as production-default.
    return "reclassified";
  }

  const newTag: ProvenanceTag = simulatedTag({
    scenario: "fx-sim:front-end-driver-radio-defect",
    sourceLineage: prior?.sourceLineage ?? "operator:manual-trade-booking",
    ...(prior?.variant !== undefined ? { variant: prior.variant } : {}),
    ...(prior?.tags !== undefined ? { tags: prior.tags } : {}),
  });

  const result = eventStore.reclassifyProvenance(eventId, newTag);
  if (!result.reclassified) {
    if (result.reason === "not-found") return "not-found";
    return "already-clean"; // already-at-target
  }

  // Emit the typed audit event AFTER the UPDATE so the target is `simulated`
  // at emit time. The audit event is itself `simulated`, so a production
  // event never references a simulated one (cross-reference rule honoured).
  const auditEvent = makeProvenanceReclassified({
    eventId: newEventId(),
    asOf: new Date().toISOString(),
    entity: BANK_ZA_001,
    actor: { type: "system", id: "atlas@bank" },
    citations: [
      "D-PROVENANCE-BUILD-PHASE-CLASS",
      "D-DATA-PROVENANCE-SUBSTRATE",
      "D-FX-SIM-FRONTEND-INPUT-DRIVER",
      eventId,
    ],
    payload: {
      targetEventId: eventId,
      targetEventType: current.type,
      priorKind: result.priorTag.kind,
      priorSourceLineage: result.priorTag.sourceLineage,
      ...(result.priorTag.scenario !== undefined
        ? { priorScenario: result.priorTag.scenario }
        : {}),
      newKind: newTag.kind,
      newSourceLineage: newTag.sourceLineage,
      newScenario: "fx-sim:front-end-driver-radio-defect",
      decisionRef: "D-PROVENANCE-BUILD-PHASE-CLASS",
      reclassificationReason: RECLASSIFICATION_REASON,
      runRef,
    },
  });
  const auditEventWithProvenance: typeof auditEvent = {
    ...auditEvent,
    provenance: simulatedTag({
      scenario: "fx-sim:front-end-driver-radio-defect",
      sourceLineage: "cleanup:fx-frontend-driver-radio-defect",
    }),
  };
  eventStore.append(auditEventWithProvenance);
  return "reclassified";
}

export function runCleanup(opts: CleanupOpts = {}): CleanupResult {
  const dryRun = opts.dryRun ?? false;
  const runRef =
    opts.runRef ?? `cleanup:fx-frontend-driver-provenance-pollution:${new Date().toISOString()}`;

  let tradesReclassified = 0;
  let tradesAlreadyClean = 0;
  let postingsReclassified = 0;
  let postingsAlreadyClean = 0;
  let auditEventsEmitted = 0;
  const notFound: string[] = [];

  // --- (a) the two trades themselves ---
  for (const eventId of TARGET_TRADE_EVENT_IDS) {
    const outcome = reclassifyOne(eventId, runRef, dryRun);
    if (outcome === "not-found") {
      notFound.push(eventId);
      continue;
    }
    if (outcome === "reclassified") {
      tradesReclassified += 1;
      if (!dryRun) auditEventsEmitted += 1;
    } else {
      tradesAlreadyClean += 1;
    }
  }

  // --- (b) GL / position spillover: any event referencing a target via
  // payload.sourceEventId that is still production-tagged ---
  const targetSet = new Set(TARGET_TRADE_EVENT_IDS);
  const spilloverIds: string[] = [];
  for (const e of eventStore.replay()) {
    const src = (e.payload as Record<string, unknown> | undefined)?.sourceEventId;
    if (typeof src !== "string" || !targetSet.has(src)) continue;
    // Only act on production-tagged spillover; simulated/build-phase already excluded.
    if (e.provenance && e.provenance.kind !== "production") {
      postingsAlreadyClean += 1;
      continue;
    }
    spilloverIds.push(e.event_id);
  }
  for (const eventId of spilloverIds) {
    const outcome = reclassifyOne(eventId, runRef, dryRun);
    if (outcome === "not-found") {
      notFound.push(eventId);
      continue;
    }
    if (outcome === "reclassified") {
      postingsReclassified += 1;
      if (!dryRun) auditEventsEmitted += 1;
    } else {
      postingsAlreadyClean += 1;
    }
  }

  // --- (c) confirmation: production-only residue for the two trades + postings ---
  const productionResidue: string[] = [];
  if (!dryRun) {
    for (const e of eventStore.replay()) {
      const isTarget = targetSet.has(e.event_id);
      const src = (e.payload as Record<string, unknown> | undefined)?.sourceEventId;
      const isSpillover = typeof src === "string" && targetSet.has(src);
      if (!isTarget && !isSpillover) continue;
      const kind = e.provenance?.kind;
      if (kind === "production") productionResidue.push(`${e.type}:${e.event_id}`);
    }
  }

  return {
    tradesReclassified,
    tradesAlreadyClean,
    postingsReclassified,
    postingsAlreadyClean,
    auditEventsEmitted,
    notFound,
    productionResidue,
  };
}

function main(argv: ReadonlyArray<string>): number {
  const dryRun = argv.includes("--dry-run");

  const before = eventStore.countByProvenanceKind();
  logger.info({ mode: dryRun ? "dry-run" : "apply", ...before }, `${PIPELINE} — pre-counts`);

  const result = runCleanup({ dryRun });

  const after = eventStore.countByProvenanceKind();
  logger.info(
    {
      mode: dryRun ? "dry-run" : "apply",
      tradesReclassified: result.tradesReclassified,
      tradesAlreadyClean: result.tradesAlreadyClean,
      postingsReclassified: result.postingsReclassified,
      postingsAlreadyClean: result.postingsAlreadyClean,
      auditEventsEmitted: result.auditEventsEmitted,
      notFound: result.notFound,
      productionResidue: result.productionResidue,
      ...after,
    },
    dryRun ? `${PIPELINE} — dry-run summary (no events mutated)` : `${PIPELINE} — apply summary`,
  );

  if (result.notFound.length > 0) {
    process.stderr.write(
      `${PIPELINE}: FATAL — target event(s) not found: ${result.notFound.join(", ")}\n`,
    );
    return 1;
  }
  if (!dryRun && result.productionResidue.length > 0) {
    process.stderr.write(
      `${PIPELINE}: FATAL — production residue remains after apply: ${result.productionResidue.join(", ")}\n`,
    );
    return 1;
  }

  process.stdout.write(
    `${PIPELINE}: ${dryRun ? "dry-run" : "apply"} ok — ` +
      `trades reclassified=${result.tradesReclassified} (already-clean=${result.tradesAlreadyClean}), ` +
      `postings reclassified=${result.postingsReclassified} (already-clean=${result.postingsAlreadyClean}), ` +
      `audit events=${result.auditEventsEmitted}` +
      (dryRun ? "" : `; production residue for trades+postings=${result.productionResidue.length}`) +
      "\n",
  );
  return 0;
}

if (import.meta.path === Bun.main) {
  process.exit(main(process.argv.slice(2)));
}
