// scripts/backfill-fx-settled-cash-cost-basis.ts
//
// Append-only, replay-safe backfill of the ZAR cost basis on settled FOREIGN cash
// instances that were materialised BEFORE the cost-basis stamping landed (commit
// 9ff89b7f added `zarCostBasis`; the live FX simulator had already materialised
// some settled USD cash legs without it). Those legs carry no `zarCostBasis`, so
// the revaluation engine SKIPS them (daily-pnl-v2 does NOT retranslate a cash leg
// with no basis) and the settled FCY exposure silently drops out of the revalued
// set — the exact defect recon:fx-pnl-fcy-exposure-integrity flags RED on the live
// home store.
//
// THE CORRECTION (Principle 1 — append-only; latest-wins fold). For each
// effectively-live settled FOREIGN cash instance with NO `zarCostBasis`, this
// appends a `FilInstrumentAmended` that re-stamps the SAME economic terms plus the
// derived `zarCostBasis`. The fold (v2-core/fil-instances/projection.ts) replaces
// `economicTerms` latest-wins on a `FilInstrumentAmended`, so the corrected basis
// becomes the effective value WITHOUT mutating or deleting the original event.
//
// THE BASIS (IAS 21 §21 — same rule the materialisation grammar now always applies).
// An FCY settled cash leg's ZAR cost basis is the reporting-currency (ZAR) amount of
// the COUNTER leg of the spot (the ZAR given up / received). This script reads it
// off the paired `<tradeId>-cash-paid` (or `-cash-received`) ZAR leg in the store —
// the EXACT cost basis, no rate lookup. A leg with no readable ZAR counter leg is
// REPORTED and SKIPPED (fail-closed — never a guessed basis); none such exist in the
// current home store (the live sim only booked <FCY>/ZAR spots).
//
// Idempotent: an instance that already carries a `zarCostBasis` (whether on the
// Created event or a prior amendment) is skipped, so re-running is a no-op.
//
// Provenance: the amendment matches the original instance's provenance tag
// (`simulated`, scenario `fx-v2-live`) — a correction to a simulated holding stays
// simulated.
//
// Run (against the shared home store):
//   BANK_EVENT_DB="$HOME/.local/share/bank/event.db" bun run \
//     scripts/backfill-fx-settled-cash-cost-basis.ts [--apply]
// Without `--apply` it is a DRY RUN (reports what it would amend, writes nothing).
//
// Authority: D-FX-PNL-FCY-EXPOSURE-REVALUATION (CEO-approved 2026-06-25);
//   D-CASH-ASSET-CLASS-V1; Engineering Charter cmd 1 (root-cause), cmd 2
//   (fail-closed), Principle 1 (append-only). Cites IAS 21 §21, §28.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { makeFilInstrumentAmended } from "../platform/event-store/event-types/fil-instances";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import { eventStore } from "../platform/composition";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRegister,
  effectiveLiveCashInstances,
  foldFilInstances,
} from "../v2-core";

const APPLY = process.argv.includes("--apply");
const ACTOR = { type: "service" as const, id: "agent:bea:fx-settled-cash-cost-basis-backfill" };
const CITATIONS = ["D-FX-PNL-FCY-EXPOSURE-REVALUATION", "D-CASH-ASSET-CLASS-V1"];

/** Fold the FIL register from the canonical store (Created→Amended→Terminated). */
function foldRegister(): FilInstanceRegister {
  const events: FilInstanceLifecycleEvent[] = [];
  for (const t of ["FilInstrumentCreated", "FilInstrumentAmended", "FilInstrumentTerminated"]) {
    for (const e of eventStore.replay({ type: t })) {
      events.push(e.payload as unknown as FilInstanceLifecycleEvent);
    }
  }
  return foldFilInstances(events);
}

/** The originating `FilInstrumentCreated` event for a cash instance (for terms +
 *  provenance + entity to re-stamp on the amendment). */
function createdEventFor(instance: string) {
  for (const e of eventStore.replay({ type: "FilInstrumentCreated" })) {
    if ((e.payload as { instance?: string }).instance === instance) return e;
  }
  return undefined;
}

/**
 * The ZAR cost-basis amount for a settled FCY cash leg, read off the paired
 * reporting-currency cash leg of the SAME trade. The cash legs share the URN stem
 * `<tradeId>-cash-<side>`; the counter is the OTHER side, denominated in the
 * reporting currency. Returns the positive major-unit string, or undefined when no
 * reporting-currency counter leg exists (fail-closed — report + skip).
 */
function zarCostBasisFromCounterLeg(
  instance: string,
  reporting: string,
): { currency: string; amount: string } | undefined {
  // `fil:inst:<tenant>:<tradeId>-cash-received` → stem `fil:inst:<tenant>:<tradeId>-cash-`.
  const m = instance.match(/^(.*-cash-)(received|paid)$/);
  if (!m) return undefined;
  const stem = m[1];
  for (const e of eventStore.replay({ type: "FilInstrumentCreated" })) {
    const p = e.payload as { instance?: string; economicTerms?: Record<string, unknown> };
    const inst = p.instance ?? "";
    if (inst === instance) continue;
    if (!inst.startsWith(stem)) continue; // a different trade's leg
    const t = p.economicTerms;
    if (!t || t.currency !== reporting) continue;
    const notional = t.notional as { currency?: string; amount?: string } | undefined;
    if (!notional?.amount || !notional.currency) continue;
    return { currency: notional.currency, amount: notional.amount };
  }
  return undefined;
}

function main(): void {
  const reporting = anchorFunctionalCurrency();
  const register = foldRegister();
  const liveCash = effectiveLiveCashInstances(register);

  let needing = 0;
  let amended = 0;
  let skippedNoCounter = 0;

  for (const row of liveCash) {
    const t = row.economicTerms;
    if (t.currency === undefined || t.currency === reporting) continue; // domestic: no FX
    if (t.originatingInstrument === undefined) continue; // not a settled-FX cash leg
    if (t.zarCostBasis !== undefined) continue; // already has a basis — idempotent skip
    needing += 1;

    const basis = zarCostBasisFromCounterLeg(row.instance, reporting);
    if (basis === undefined) {
      skippedNoCounter += 1;
      process.stderr.write(
        `[skip] ${row.instance} (${t.currency}) — no reporting-currency (${reporting}) counter leg in store; ` +
          `cannot derive an exact IAS 21 §21 cost basis. Supply one explicitly (settlement-date rate × notional) ` +
          `— NOT guessed here (fail-closed).\n`,
      );
      continue;
    }

    const created = createdEventFor(row.instance);
    if (!created) {
      process.stderr.write(`[skip] ${row.instance} — no originating FilInstrumentCreated found.\n`);
      continue;
    }
    const createdPayload = created.payload as {
      type: string;
      tenant: string;
      economicTerms: Record<string, unknown>;
      originatingEvent: { eventType: string; eventId: string };
    };
    const provenance = (created as { provenance?: ProvenanceTag }).provenance;
    if (!provenance) {
      process.stderr.write(`[skip] ${row.instance} — originating event has no provenance tag.\n`);
      continue;
    }

    const amendedTerms = { ...createdPayload.economicTerms, zarCostBasis: basis };
    const eventId = `bea:fx-settled-cash-cost-basis-backfill:${row.instance}`;

    process.stdout.write(
      `[amend] ${row.instance} (${t.currency}) → zarCostBasis ${basis.amount} ${basis.currency}\n`,
    );

    if (!APPLY) continue;

    const ev = makeFilInstrumentAmended({
      asOf: (created as { as_of: string }).as_of,
      entity: (created as { entity: string }).entity,
      actor: ACTOR,
      citations: CITATIONS,
      provenance,
      eventId,
      payload: {
        kind: "FilInstrumentAmended",
        instance: row.instance,
        type: createdPayload.type,
        tenant: createdPayload.tenant,
        asOf: (created as { as_of: string }).as_of,
        // The amendment IS the carrier of this cost-basis correction (no separate
        // detail event); `amendmentVia` names the lifecycle event-type ref (the
        // recon-time join target). `originatingEvent` keeps the P1 lineage back to
        // the original settlement creation event.
        amendmentVia: "FilInstrumentAmended",
        originatingEvent: { ...createdPayload.originatingEvent },
        economicTerms: amendedTerms,
      } as Parameters<typeof makeFilInstrumentAmended>[0]["payload"],
    });
    eventStore.append(ev);
    amended += 1;
  }

  process.stdout.write(
    `\n${APPLY ? "APPLIED" : "DRY RUN"}: ${needing} settled-FCY-cash instance(s) without a cost basis; ` +
      `${APPLY ? amended : needing - skippedNoCounter} amendable, ${skippedNoCounter} skipped (no counter leg).\n` +
      `${APPLY ? "" : "Re-run with --apply to write the corrections.\n"}`,
  );
}

main();
