// platform/recon/v2-multi-version-type-upcaster.ts
//
// ENFORCING GATE (HARDEN-ONLY) — every multi-version event type has a declared,
// version-keyed upcaster (D-EVENT-ENVELOPE-SCHEMA-VERSION).
//
// WHAT IT ASSERTS
// ---------------
// For every event type whose registry `schemaVersion > 1`:
//   1. it has an entry in the version-keyed UPCASTER_REGISTRY;
//   2. the declaration's `currentVersion` equals the registry `schemaVersion`;
//   3. the version-step chain is COMPLETE — a step exists for every version from
//      1 to currentVersion-1 (no gap that would force a silent shape-sniff).
// And, symmetrically, every UPCASTER_REGISTRY entry references a real registered
// event type whose `schemaVersion` matches its `currentVersion` (no orphan /
// stale declaration).
//
// WHY: the old practice inferred version from incidental payload shape
// (`typeof payload.ead === "number"`), which is fragile and crashed dashboard
// boot (#1352). A new payload version with no declared upcaster is a silent
// shape-sniff waiting to break. This gate makes that fail CI.
//
// HARDEN-ONLY CONTRACT: this ratchet may only ever require MORE upcaster
// coverage, never less. The set of multi-version types and their required chains
// is derived purely from the registry + upcaster declarations — there is no
// snapshot to loosen. Adding a version without an upcaster fails; that is the
// intended, permanent direction. Do not weaken the assertions without a
// CEO-approved Decision. Authority: D-EVENT-ENVELOPE-SCHEMA-VERSION;
// D-ENGINEERING-INTEGRITY-CHARTER (#3 no green by concealment).
//
// Author: Atlas (Substrate Architect, engineering).

import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { UPCASTER_REGISTRY } from "../event-store/upcaster-registry";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

export function run(): ReconResult {
  const result = emptyResult("v2-multi-version-type-upcaster");
  const violations: ReconViolation[] = [];

  // Build the registry version map, defaulting an absent schemaVersion to 1.
  const registryVersion = new Map<string, number>();
  for (const meta of EVENT_TYPE_REGISTRY) {
    registryVersion.set(meta.type, meta.schemaVersion ?? 1);
  }

  // 1–3: every multi-version registry type has a complete, matching declaration.
  for (const [type, version] of registryVersion) {
    if (version <= 1) continue;
    result.asserted += 1;
    const decl = UPCASTER_REGISTRY.get(type);
    if (!decl) {
      violations.push({
        subject: type,
        message: `event type declares schemaVersion ${version} (>1) but has NO entry in the version-keyed UPCASTER_REGISTRY. A new payload version MUST ship a declared upcaster — silent shape-sniffing for new versions is banned.`,
        severity: "fail",
      });
      continue;
    }
    if (decl.currentVersion !== version) {
      violations.push({
        subject: type,
        message: `upcaster declaration currentVersion ${decl.currentVersion} != registry schemaVersion ${version}; they must agree.`,
        severity: "fail",
      });
    }
    for (let from = 1; from < version; from += 1) {
      if (!decl.steps.has(from)) {
        violations.push({
          subject: type,
          message: `upcaster chain is incomplete: missing a version-step for ${from} → ${from + 1} (chain must cover every version from 1 to ${version - 1}).`,
          severity: "fail",
        });
      }
    }
  }

  // 4: no orphan / stale upcaster declarations.
  for (const [type, decl] of UPCASTER_REGISTRY) {
    result.asserted += 1;
    const version = registryVersion.get(type);
    if (version === undefined) {
      violations.push({
        subject: type,
        message: `UPCASTER_REGISTRY declares an upcaster for "${type}" but no such event type is registered in EVENT_TYPE_REGISTRY (orphan declaration).`,
        severity: "fail",
      });
      continue;
    }
    if (version !== decl.currentVersion) {
      violations.push({
        subject: type,
        message: `UPCASTER_REGISTRY currentVersion ${decl.currentVersion} != registry schemaVersion ${version} (stale declaration).`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  return { ...result, ok: violations.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(
    `recon:v2-multi-version-type-upcaster — asserted ${r.asserted} type(s); ${r.violations.length} violation(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
