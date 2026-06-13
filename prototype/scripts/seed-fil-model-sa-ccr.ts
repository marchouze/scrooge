// scripts/seed-fil-model-sa-ccr.ts
//
// Emit the FIRST FIL-Model declaration: SA-CCR (V2 S7-FIL).
//
// Appends a single `FilModelImplementationDeclared` event carrying the v2-core
// SA-CCR declaration (`SA_CCR_MODEL_DECLARATION`) into the canonical event
// store, so the FIL-Models register (folded by `recon:fil-conformance`) holds
// SA-CCR as its first row (Principle 1: the event is canonical; the register is
// a query). Idempotent on (modelId, version, methodologyHash).
//
// `validationStatus: "submitted"` — engineering parity is proven
// (`recon:v2-saccr-parity`), but the independent model-validation sign-off
// (Nadia) is a gated follow-on (brief §"Out of scope"). The v1 engine stays
// LIVE; no alias-flip / consumer repoint here.
//
// Authority: D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Rohan (Risk Engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { makeFilModelImplementationDeclared } from "../platform/event-store/event-types/fil-models";
import {
  SA_CCR_METHODOLOGY_HASH,
  SA_CCR_MODEL_DECLARATION,
  SA_CCR_MODEL_VERSION,
} from "../v2-core/fil-models/sa-ccr";

const AS_OF = process.env.SA_CCR_DECL_AS_OF ?? "2026-06-13T09:00:00.000Z";

const already = [...eventStore.replay({ type: "FilModelImplementationDeclared" })].some((e) => {
  const p = e.payload as {
    modelId?: string;
    version?: { major: number; minor: number };
    methodologyHash?: string;
  };
  return (
    p.modelId === SA_CCR_MODEL_DECLARATION.modelId &&
    p.version?.major === SA_CCR_MODEL_VERSION.major &&
    p.version?.minor === SA_CCR_MODEL_VERSION.minor &&
    p.methodologyHash === SA_CCR_METHODOLOGY_HASH
  );
});

if (already) {
  console.log(
    `[seed-fil-model-sa-ccr] SA-CCR ${SA_CCR_MODEL_VERSION.major}.${SA_CCR_MODEL_VERSION.minor} (${SA_CCR_METHODOLOGY_HASH}) already declared — skipping.`,
  );
  process.exit(0);
}

const event = makeFilModelImplementationDeclared({
  asOf: AS_OF,
  entity: "LE-ZA-HOZ-BANK",
  actor: { type: "service", id: "agent:rohan:risk-engineer" },
  citations: [
    "D-W4-MODEL-LIBRARY-PILOT",
    "D-MODEL-BINDING-CONTRACT-V1",
    "D-FIL-FRAMEWORK-UNIFICATION",
    "BCBS-SA-CCR-CRE52",
    "P1-EVENTS-AS-TRUTH",
    "P2-SINGLE-GRAPH-DISCIPLINE",
  ],
  payload: SA_CCR_MODEL_DECLARATION,
});

eventStore.append(event);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: event.event_id,
      modelId: SA_CCR_MODEL_DECLARATION.modelId,
      implementsFacets: SA_CCR_MODEL_DECLARATION.implementsFacets,
      scope: SA_CCR_MODEL_DECLARATION.scope,
      emits: SA_CCR_MODEL_DECLARATION.emits,
      methodologyHash: SA_CCR_METHODOLOGY_HASH,
    },
    null,
    2,
  ),
);
