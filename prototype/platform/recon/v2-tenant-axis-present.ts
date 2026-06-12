// platform/recon/v2-tenant-axis-present.ts
//
// `recon:v2-tenant-axis-present` — advisory gate for V2 S2.
//
// WHAT IT ASSERTS
// ---------------
// 1. The `v2-core/control-plane/tenant.ts` file exists and exports
//    `ANCHOR_TENANT_ID` with the canonical value `"tenant:za-bank"`.
// 2. The `v2-core/control-plane/envelope.ts` file exists and exports
//    `createV2Envelope` and `V2Envelope` (the factory + type names are
//    present as identifiers in the source text).
// 3. The `v2-core/index.ts` barrel re-exports both control-plane modules
//    (`./control-plane/tenant` and `./control-plane/envelope`).
//
// ADVISORY (not enforcing) in S2 — this gate documents the structural
// contract rather than blocking CI. It becomes enforcing when the first
// live-bus envelope consumer lands (S3+). Advisory severity: `"warn"`.
//
// WHY V1-SIDE
// -----------
// Recon infrastructure (`./types`, `node:fs`) lives in the v1 tree; the
// v2-core package must not import it (no-v1-import boundary). This gate
// inspects v2-core from the v1 side — the permitted v1→v2 direction.
//
// Authority: D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS (S2).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PROTO_DIR = resolve(import.meta.dir, "..", "..");
const V2_CORE_DIR = resolve(PROTO_DIR, "v2-core");

function readV2File(rel: string): string | null {
  const abs = resolve(V2_CORE_DIR, rel);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}

export function run(): ReconResult {
  const result = emptyResult("v2-tenant-axis-present");
  const violations: ReconViolation[] = [];

  // Assertion 1 — tenant.ts exists and contains the anchor-tenant constant.
  result.asserted += 1;
  const tenantSrc = readV2File("control-plane/tenant.ts");
  if (!tenantSrc) {
    violations.push({
      subject: "v2-core/control-plane/tenant.ts",
      message: "file does not exist — ANCHOR_TENANT_ID not established (S2 missing)",
      severity: "warn",
    });
  } else {
    // Check the canonical constant value is present.
    result.asserted += 1;
    if (!tenantSrc.includes('"tenant:za-bank"')) {
      violations.push({
        subject: "v2-core/control-plane/tenant.ts",
        message:
          'ANCHOR_TENANT_ID value "tenant:za-bank" not found — the anchor-tenant constant has drifted or is absent',
        severity: "warn",
      });
    }
    // Check isAnchorTenantEvent predicate is exported.
    result.asserted += 1;
    if (!tenantSrc.includes("isAnchorTenantEvent")) {
      violations.push({
        subject: "v2-core/control-plane/tenant.ts",
        message: "isAnchorTenantEvent predicate export not found",
        severity: "warn",
      });
    }
  }

  // Assertion 2 — envelope.ts exists and exports createV2Envelope.
  result.asserted += 1;
  const envelopeSrc = readV2File("control-plane/envelope.ts");
  if (!envelopeSrc) {
    violations.push({
      subject: "v2-core/control-plane/envelope.ts",
      message:
        "file does not exist — V2Envelope type + createV2Envelope factory missing (S2 missing)",
      severity: "warn",
    });
  } else {
    result.asserted += 1;
    if (!envelopeSrc.includes("createV2Envelope")) {
      violations.push({
        subject: "v2-core/control-plane/envelope.ts",
        message: "createV2Envelope factory export not found",
        severity: "warn",
      });
    }
    result.asserted += 1;
    if (!envelopeSrc.includes("V2Envelope")) {
      violations.push({
        subject: "v2-core/control-plane/envelope.ts",
        message: "V2Envelope type not found",
        severity: "warn",
      });
    }
  }

  // Assertion 3 — index.ts barrel re-exports both control-plane modules.
  result.asserted += 1;
  const indexSrc = readV2File("index.ts");
  if (!indexSrc) {
    violations.push({
      subject: "v2-core/index.ts",
      message: "barrel file does not exist",
      severity: "warn",
    });
  } else {
    result.asserted += 1;
    if (!indexSrc.includes("./control-plane/tenant")) {
      violations.push({
        subject: "v2-core/index.ts",
        message: 'barrel does not re-export "./control-plane/tenant"',
        severity: "warn",
      });
    }
    result.asserted += 1;
    if (!indexSrc.includes("./control-plane/envelope")) {
      violations.push({
        subject: "v2-core/index.ts",
        message: 'barrel does not re-export "./control-plane/envelope"',
        severity: "warn",
      });
    }
  }

  // Advisory: warn violations do NOT fail CI in S2.
  result.violations = violations;
  return { ...result, ok: true }; // advisory — always exits 0
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  process.stdout.write(
    `recon:v2-tenant-axis-present (advisory, S2) — asserted ${r.asserted}; ${warnCount} warning(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
