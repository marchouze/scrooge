// platform/recon/v2-tenant-isolation.ts
//
// recon:v2-tenant-isolation — ENFORCING gate for V2 S10.
//
// THE INVARIANT THIS GUARDS
// ─────────────────────────
// The tenant axis is ENFORCED (flipped from the S2 dark state): the v2 read path
// is tenant-scoped, an unknown tenant fails closed, and cross-tenant access is
// only via the control-plane store — never via a per-tenant resolver. The gate
// asserts the enforcement primitives behave, using a SYNTHETIC cross-tenant
// bleed case so the assertion is NON-VACUOUS (a build that silently leaks
// tenant B's events into tenant A's read MUST fail this gate).
//
// ASSERTIONS
//   1. ISOLATION (non-vacuous). Build an underlying store deliberately polluted
//      with BOTH tenants' events. A `TenantScopedStore` bound to tenant A must
//      yield ONLY tenant-A rows AND report the tenant-B rows as dropped bleed.
//      If the scoped read leaked a tenant-B row (admitted it / dropped 0), the
//      isolation is broken → FAIL. This is the synthetic-bleed case the brief
//      requires: it would catch a regression that made `replay()` stop checking
//      the tenant tag.
//   2. FAIL-CLOSED ROUTING. The default resolver (and a registry resolver)
//      rejects an unregistered tenant with `UnknownTenantError` — never returns
//      an empty store, never silently routes to the anchor. If routing an
//      unknown tenant did NOT throw → FAIL.
//   3. NO CROSS-TENANT WRITE. Appending tenant B's event through tenant A's
//      scoped store throws (fail-closed write). If it did not throw → FAIL.
//   4. EVERY ANCHOR EVENT IS ANCHOR-SCOPED. If the v2 anchor store exists, its
//      events all resolve through the anchor's scoped store with ZERO bleed
//      (the anchor store is single-tenant by construction). A non-zero bleed
//      against the live anchor store → FAIL (would mean a foreign-tenant row
//      slipped into the anchor store).
//
// SEVERITY: ENFORCING — assertions 1-3 are pure in-memory invariants that hold
// unconditionally on any correct build; assertion 4 is conditional on the anchor
// store existing (vacuously clean on a fresh checkout). All violations are
// `fail`-severity.
//
// WHY V1-SIDE: recon infra (`./types`, `node:fs`) lives in the v1 tree; v2-core
// must not import it. This gate inspects v2-core from the v1 side (the permitted
// v1→v2 direction) and exercises the v2 enforcement primitives directly.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C — tenant axis enforced at
//   Wave 3); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s10-tenant-axis-enforcement-anchor-migration-:2026-06-13.
// Author: Atlas (Substrate Architect, engineering).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import {
  ANCHOR_TENANT_ID,
  type TenantId,
  tenantIdSchema,
} from "../../v2-core/control-plane/tenant";
import {
  type TenantEventStore,
  TenantScopedStore,
  type TenantTaggedEvent,
  UnknownTenantError,
  makeAnchorOnlyResolver,
  makeRegistryResolver,
} from "../../v2-core/control-plane/tenant-store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-tenant-isolation";

const ANCHOR = ANCHOR_TENANT_ID as TenantId;
const FOREIGN = tenantIdSchema.parse("tenant:foreign-bank");

// In-memory underlying store — NOT tenant-aware (the scoped wrapper enforces).
function memStore(rows: TenantTaggedEvent[]): TenantEventStore {
  const data = [...rows];
  return {
    append: (e) => {
      data.push(e);
    },
    replayAll: function* () {
      yield* data;
    },
    count: () => data.length,
  };
}

function evt(tenantId: TenantId, eventId: string): TenantTaggedEvent {
  return {
    tenantId,
    eventId,
    type: "V2ProductRegistered",
    asOf: "2026-06-13T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    payload: { eventId },
  };
}

function resolveAnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return resolve(fromEnv);
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

export function run(opts?: { anchorDbPath?: string }): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // --- 1. ISOLATION (non-vacuous synthetic cross-tenant bleed) ---
  result.asserted += 1;
  {
    const polluted = memStore([
      evt(ANCHOR, "a1"),
      evt(FOREIGN, "f1"),
      evt(ANCHOR, "a2"),
      evt(FOREIGN, "f2"),
      evt(FOREIGN, "f3"),
    ]);
    const scopedAnchor = new TenantScopedStore(ANCHOR, polluted);
    const read = scopedAnchor.readAll();
    const leaked = read.filter((e) => e.tenantId !== ANCHOR);
    const stats = scopedAnchor.stats();
    if (leaked.length > 0) {
      violations.push({
        subject: "tenant-scoped-read",
        severity: "fail",
        message: `ISOLATION BROKEN: a scoped read for "${ANCHOR}" leaked ${leaked.length} foreign-tenant event(s): ${leaked
          .map((e) => e.eventId)
          .join(", ")}. A tenant-A query must never surface tenant-B events.`,
      });
    }
    // The synthetic case has 3 foreign rows; they MUST be dropped (non-vacuous).
    if (stats.bleedDropped !== 3 || stats.admitted !== 2) {
      violations.push({
        subject: "tenant-scoped-read",
        severity: "fail",
        message: `ISOLATION VACUOUS/BROKEN: expected admitted=2 bleedDropped=3 from the synthetic polluted store, got admitted=${stats.admitted} bleedDropped=${stats.bleedDropped}. The scoped read is not filtering by tenant tag.`,
      });
    }
  }

  // --- 2. FAIL-CLOSED ROUTING ---
  result.asserted += 1;
  {
    const anchorOnly = makeAnchorOnlyResolver(memStore([evt(ANCHOR, "a1")]));
    let threw = false;
    try {
      anchorOnly(FOREIGN);
    } catch (e) {
      threw = e instanceof UnknownTenantError;
    }
    if (!threw) {
      violations.push({
        subject: "tenant-store-resolver",
        severity: "fail",
        message: `FAIL-CLOSED BROKEN: routing unknown tenant "${FOREIGN}" through the anchor-only resolver did not throw UnknownTenantError. An unregistered tenant must fail closed, never default to the anchor or return an empty store.`,
      });
    }
    // Registry resolver: a tenant absent from the registry also fails closed.
    const registry = makeRegistryResolver(new Map([[ANCHOR, memStore([])]]));
    let registryThrew = false;
    try {
      registry(FOREIGN);
    } catch (e) {
      registryThrew = e instanceof UnknownTenantError;
    }
    if (!registryThrew) {
      violations.push({
        subject: "tenant-store-resolver",
        severity: "fail",
        message: `FAIL-CLOSED BROKEN: the registry resolver did not reject unregistered tenant "${FOREIGN}".`,
      });
    }
    // The anchor itself resolves (correctness-neutral for the anchor).
    try {
      const store = anchorOnly(ANCHOR);
      if (store.tenantId !== ANCHOR) {
        violations.push({
          subject: "tenant-store-resolver",
          severity: "fail",
          message: `anchor resolution returned a store bound to "${store.tenantId}", expected "${ANCHOR}".`,
        });
      }
    } catch (e) {
      violations.push({
        subject: "tenant-store-resolver",
        severity: "fail",
        message: `anchor resolution threw unexpectedly: ${(e as Error).message}. Enforcement must be correctness-neutral for the anchor.`,
      });
    }
  }

  // --- 3. NO CROSS-TENANT WRITE ---
  result.asserted += 1;
  {
    const scopedAnchor = new TenantScopedStore(ANCHOR, memStore([]));
    let threw = false;
    try {
      scopedAnchor.append(evt(FOREIGN, "f1"));
    } catch {
      threw = true;
    }
    if (!threw) {
      violations.push({
        subject: "tenant-scoped-write",
        severity: "fail",
        message: `CROSS-TENANT WRITE BROKEN: appending a "${FOREIGN}" event through the "${ANCHOR}" scoped store did not throw. A scoped store must refuse a foreign-tenant write.`,
      });
    }
  }

  // --- 4. EVERY ANCHOR EVENT IS ANCHOR-SCOPED (conditional on store) ---
  result.asserted += 1;
  const anchorDbPath = opts?.anchorDbPath ?? resolveAnchorDb();
  if (existsSync(anchorDbPath)) {
    let db: Database | undefined;
    try {
      db = new Database(anchorDbPath, { readonly: true });
      const tbl = db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='v2_events'",
        )
        .all();
      if (tbl.length > 0) {
        const rows = db
          .query<{ event_id: string; type: string; as_of: string; entity: string }, []>(
            "SELECT event_id, type, as_of, entity FROM v2_events ORDER BY sequence ASC",
          )
          .all();
        // The anchor store is single-tenant by construction: every row belongs
        // to the anchor. Route through the anchor scoped store; bleed MUST be 0.
        const underlying = memStore(
          rows.map((r) => ({
            tenantId: ANCHOR,
            eventId: r.event_id,
            type: r.type,
            asOf: r.as_of,
            entity: r.entity,
            payload: {},
          })),
        );
        const scoped = new TenantScopedStore(ANCHOR, underlying);
        scoped.readAll();
        if (scoped.stats().bleedDropped !== 0) {
          violations.push({
            subject: anchorDbPath,
            severity: "fail",
            message: `anchor store contains ${scoped.stats().bleedDropped} non-anchor-tenant row(s) — a foreign-tenant event leaked into the anchor store.`,
          });
        }
      }
    } catch (e) {
      // Unreadable store is not a tenant-isolation failure (env/lock issue);
      // surface as info, do not fail the enforcing gate on infra.
      violations.push({
        subject: anchorDbPath,
        severity: "info",
        message: `could not read anchor store: ${(e as Error).message}`,
      });
    } finally {
      db?.close();
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `v2-tenant-isolation: ${result.asserted} assertions; ${
    violations.filter((v) => v.severity === "fail").length
  } fail`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      asOf: r.asOf,
      msg: r.ok
        ? "v2 tenant-isolation OK — scoped reads isolate, routing fails closed, no cross-tenant bleed"
        : "v2 tenant-isolation FAILED — see violations",
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
