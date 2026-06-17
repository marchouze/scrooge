// platform/recon/tb-snapshot-reproducible.ts
//
// recon:tb-snapshot-reproducible — ENFORCING close-snapshot reproducibility gate
// (FX4).
//
// The fold output is materialised EXACTLY ONCE, at period close
// (`closePeriodV2`), as a `TrialBalanceSnapshotted` — the one legitimate derived
// event in the accounting chain (D-DERIVED-EVENT-IRREDUCIBILITY-TEST). That
// snapshot is a CACHE of the fold, never divergent state. This gate PROVES the
// cache property: re-folding the primaries (`computeTrialBalanceV2`) at the
// snapshot's period window reproduces the snapshotted FX rows BYTE-FOR-BYTE. If
// it ever diverges, the snapshot has drifted from the primaries — a Principle-1
// violation (the snapshot would be carrying state the log no longer implies).
//
// SCOPE: the FX (ACC-2100-*) account block — the rows the V2 fold is authoritative
// for (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD). Non-FX rows in a snapshot may be
// sourced from the V1 SubLedgerPostingEmitted close path and are out of scope
// here (covered by the V1 close reproducibility discipline). Every snapshotted FX
// row must equal the re-fold; every re-fold FX row over the window must be in the
// snapshot (no FX row appears or disappears between close and re-fold).
//
// CLEAN-STORE BEHAVIOUR: a store with no AccountingPeriodClosed / no FX rows →
// vacuous pass (0 asserted divergences).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Principle 1; Engineering Charter
//   (replay-safe & append-only; whole-tree integrity).
// Author: Atlas (Substrate Architect, engineering).

import type {
  AccountingPeriodOpenedPayload,
  TrialBalanceSnapshottedPayload,
} from "../event-store/event-types";
import { eventStore } from "../composition";
import { computeTrialBalanceV2 } from "../projections/gl-projection-v2";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "tb-snapshot-reproducible";

/** True iff the account id is in the FX block the V2 fold is authoritative for. */
function isFxAccount(accountId: string): boolean {
  return accountId.startsWith("ACC-2100-");
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    // Index the period windows by (entity, periodId) from AccountingPeriodOpened.
    const windowByKey = new Map<string, { periodStart: string; periodEnd: string }>();
    for (const e of eventStore.replay({ type: "AccountingPeriodOpened" })) {
      const p = e.payload as unknown as AccountingPeriodOpenedPayload;
      windowByKey.set(`${e.entity}::${p.periodId}`, {
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
      });
    }

    let snapshotsChecked = 0;

    for (const snap of eventStore.replay({ type: "TrialBalanceSnapshotted" })) {
      const p = snap.payload as unknown as TrialBalanceSnapshottedPayload;
      if (p.snapshotKind !== "close") continue;
      const window = windowByKey.get(`${snap.entity}::${p.periodId}`);
      if (!window) continue; // no matching open period (cannot re-fold the window)

      // Re-fold the V2 trial balance over the snapshot's period window.
      const refold = computeTrialBalanceV2({
        eventStore,
        entity: snap.entity,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
      });

      // FX rows on each side, keyed (leafAccountId|currency) → amountMinor.
      const snapFx = new Map<string, number>();
      for (const r of p.rows) {
        if (!isFxAccount(r.leafAccountId)) continue;
        snapFx.set(`${r.leafAccountId}|${r.currency}`, r.amountMinor);
      }
      const refoldFx = new Map<string, number>();
      for (const r of refold.rows) {
        if (!isFxAccount(r.leafAccountId)) continue;
        refoldFx.set(`${r.leafAccountId}|${r.currency}`, r.amountMinor);
      }

      if (snapFx.size === 0 && refoldFx.size === 0) continue; // no FX in this snapshot
      snapshotsChecked += 1;

      // (1) Same FX key set.
      const snapKeys = [...snapFx.keys()].sort();
      const refoldKeys = [...refoldFx.keys()].sort();
      result.asserted += 1;
      if (JSON.stringify(snapKeys) !== JSON.stringify(refoldKeys)) {
        const onlySnap = snapKeys.filter((k) => !refoldFx.has(k));
        const onlyRefold = refoldKeys.filter((k) => !snapFx.has(k));
        violations.push({
          subject: `${PIPELINE}:fx-account-set-drift:${snap.entity}:${p.periodId}`,
          message: `Close snapshot ${snap.event_id} (period ${p.periodId}) FX account set diverges from the re-fold at the snapshot window. Only-in-snapshot: [${onlySnap.join(", ")}]; only-in-refold: [${onlyRefold.join(", ")}]. The close snapshot must be a byte-faithful cache of the fold (Principle 1). Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.`,
          severity: "fail",
        });
      }

      // (2) Byte-equal amounts on shared FX keys.
      for (const key of snapKeys) {
        result.asserted += 1;
        const s = snapFx.get(key) ?? 0;
        const r = refoldFx.get(key) ?? 0;
        if (s !== r) {
          violations.push({
            subject: `${PIPELINE}:fx-amount-drift:${snap.entity}:${p.periodId}:${key}`,
            message: `Close snapshot ${snap.event_id} FX row "${key}" amountMinor=${s} but the re-fold at the snapshot window computes ${r}. The snapshot must reproduce the fold byte-for-byte (it is a cache, not divergent state). Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.`,
            severity: "fail",
          });
        }
      }
    }

    result.asOf = `${PIPELINE}: ${snapshotsChecked} close snapshot(s) with FX rows checked. ${
      violations.some((v) => v.severity === "fail") ? "DRIFT" : "snapshot reproduces fold byte-for-byte"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:refold-error`,
      message: `Snapshot re-fold threw: ${err instanceof Error ? err.message : String(err)}.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
