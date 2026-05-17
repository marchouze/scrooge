// platform/recon/zod-schema-coverage.ts
//
// Continuous-controls pipeline: Zod payload-schema coverage (F-032 gap-2).
//
// Every event type in EVENT_TYPE_REGISTRY should eventually carry a Zod
// `payloadSchema` so that malformed payloads are rejected at emit-site (inside
// EventStore.append()) rather than discovered only in downstream projections.
//
// This pipeline audits the registry and surfaces types whose payload is still
// validated only at the envelope level (no `payloadSchema`). These are
// classified as `medium` severity — they are not immediately breaking but
// represent a substrate gap where bad data can silently enter the event store.
//
// Tally rules:
//   - **medium (info in this run).** Registry row with no `payloadSchema`.
//     The type's payload passes only the envelope-level Zod check
//     (`eventSchema` in `platform/event-store/types.ts` — validates
//     event_id, type, as_of, entity, actor, citations, payload-as-Record).
//     This is the build-phase tolerance per `registry.ts` header.
//   - **info.** Deprecated registry rows without a schema — these types
//     should no longer be emitted; surfaced as info not medium to avoid
//     noise on the already-tracked migration path.
//
// Coverage baseline:
//   When all 302 registered types have schemas this pipeline should
//   report 0 findings. Until then, findings are expected and the count
//   shrinks over time as schemas are authored.
//
// Authority: brief:atlas:zod-schemas-at-emit-site-substrate-gap-2-f-032:2026-05-17
// Citations: P1-EVENTS-AS-TRUTH, F-032
//
// Author: Atlas (Core banking platform architect, engineering)

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const CITATIONS = [
  "P1-EVENTS-AS-TRUTH",
  "F-032",
  "brief:atlas:zod-schemas-at-emit-site-substrate-gap-2-f-032:2026-05-17",
];

export interface RunOpts {
  /**
   * Override the registry for tests. Each entry is the shape the pipeline
   * inspects: `type`, optional `payloadSchema`, optional `status`.
   */
  registry?: ReadonlyArray<{
    type: string;
    payloadSchema?: unknown;
    status?: string;
  }>;
}

function gatherRegistry(): ReadonlyArray<{
  type: string;
  payloadSchema?: unknown;
  status?: string;
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reg = require("../event-store/registry") as {
    EVENT_TYPE_REGISTRY?: ReadonlyArray<{
      type: string;
      payloadSchema?: unknown;
      status?: string;
    }>;
  };
  return reg.EVENT_TYPE_REGISTRY ?? [];
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("zod-schema-coverage");
  const violations: ReconViolation[] = [];

  const registry = opts.registry ?? gatherRegistry();

  for (const meta of registry) {
    result.asserted++;
    if (!meta.payloadSchema) {
      const isDeprecated = meta.status === "deprecated";
      violations.push({
        subject: `event-type:${meta.type}`,
        message: isDeprecated
          ? `Registry row for \`${meta.type}\` (deprecated) has no Zod \`payloadSchema\`. Deprecated types that may still appear in the event log for replay should carry a schema so downstream projections can parse them safely. Surfaced as info because the migration path is already tracked via \`supersededBy\`. Citations: ${CITATIONS.join(", ")}.`
          : `Registry row for \`${meta.type}\` has no Zod \`payloadSchema\`. Payloads for this type are validated only at the envelope level — a malformed payload enters the event store unchecked and is discovered only in downstream projections. Author a \`z.object({...}).passthrough()\` schema in the appropriate \`platform/event-store/event-types/\` domain module and wire it into the registry row. Citations: ${CITATIONS.join(", ")}.`,
        severity: isDeprecated ? "info" : "warn",
      });
    }
  }

  result.violations = violations;
  // This pipeline never fails CI — coverage is a ratchet that must be
  // driven to zero over time, not a hard gate on today's build. When all
  // types have schemas, violations will be empty and ok will be true.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  const withSchema = r.asserted - r.violations.filter((v) => v.severity !== "info").length;
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  const infoCount = r.violations.filter((v) => v.severity === "info").length;
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      withSchema,
      missingSchema: warnCount,
      deprecatedMissingSchema: infoCount,
      ok: r.ok,
      coveragePct: r.asserted > 0 ? Math.round((withSchema / r.asserted) * 100) : 100,
      msg: r.ok
        ? `Zod schema coverage: ${withSchema}/${r.asserted} types covered (${warnCount} without schema, ${infoCount} deprecated without schema)`
        : "Zod schema coverage FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
