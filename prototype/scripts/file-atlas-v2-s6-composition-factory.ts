// scripts/file-atlas-v2-s6-composition-factory.ts
//
// RecordFiled — V2 S6 composition-factory design note (RMS Phase 3, WS-V2-BBAAS).
// The deliverable design note for the composition factory behind an alias: the
// factory contract, the alias mechanism, and how the seam supports future
// construction-path swaps.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION. Brief
//   `brief:atlas:v2-s6-composition-factory-behind-an-alias-prove-:2026-06-13`.
//
// Idempotent — skips if the record is already filed.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/file-atlas-v2-s6-composition-factory.ts
//
// Author: Atlas (Substrate Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-s6-composition-factory:2026-06-13";
const ENTITY = String(BANK_ZA_001);
const ACTOR = { type: "service" as const, id: "agent:atlas:substrate-architect" };
const CITATIONS = [
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
];

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (alreadyFiled) {
  console.log(`[file-atlas-v2-s6-composition-factory] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S6 — composition factory behind an alias (the construction seam)

**Author:** Atlas (Substrate Architect, engineering).
**Date:** 2026-06-13.
**Brief:** \`brief:atlas:v2-s6-composition-factory-behind-an-alias-prove-:2026-06-13\` (WS-V2-BBAAS).
**Authority:** D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1; D-FIL-FRAMEWORK-UNIFICATION.
**PR:** #1301.

---

## What S6 adds

S0 landed the composition **algebra** (\`v2-core/fil-core/composition.ts\`: \`FilLeg\`, \`FilComponent\`, \`FilWrapper\` and the \`legsOf\` / \`componentsOf\` / \`wrapping\` constructors). S6 adds the construction **seam** on top of it: a factory that builds composite FIL instruments from typed specs, exposed behind a swappable alias.

## The factory contract

\`v2-core/fil-core/composition-factory.ts\` exposes a \`CompositionFactory\` interface — \`{ implId, build(spec): BuiltComposite }\` — and a default implementation. \`build\` takes a **discriminated \`CompositeSpec\`**:

| Spec \`kind\` | Built composition |
|---|---|
| \`irs\` | \`legs: [fixedLeg, floatLeg]\` (each a typed \`FilLeg\`) |
| \`fx-swap\` | \`legs: [nearLeg, farLeg]\` |
| \`structured\` | \`components: [...]\` (containment) |

It **validates leg/component typing against the taxonomy**: every \`legType\`, \`componentType\`, and the composite's own \`compositeType\` must be a valid \`fil:type:…@maj.min\` URN (a registered FIL type — never a free object / untyped leg); leg & component ids must be unique within the composite; a structured composite must carry ≥1 component. Rejections throw a \`CompositionFactoryError\` carrying a **stable \`code\`** (\`composite-type-not-a-fil-type-urn\`, \`leg-type-not-a-fil-type-urn\`, \`component-type-not-a-fil-type-urn\`, \`empty-components\`, \`duplicate-leg-id\`, \`duplicate-component-id\`, \`unknown-composite-kind\`) so callers and the recon gate can assert *which* rule fired.

The factory builds via the S0 constructors (\`legsOf\` / \`componentsOf\`) — never a hand-assembled \`FilComposition\` literal — and returns a \`BuiltComposite\` keyed to the composite's own \`fil:type:\` URN. **No valuation / lifecycle / risk** — pure construction (brief out-of-scope).

## The alias mechanism

\`v2-core/fil-core/composition-factory-alias.ts\` is the swappable seam:

- \`COMPOSITION_FACTORY_ALIAS\` = \`"fil-core:composition-factory"\` — the stable, addressable identity of the seam.
- \`buildComposite(spec)\` — the one-call construction surface every consumer uses; it resolves the alias and delegates, so it always honours the current implementation.
- \`resolveCompositionFactory()\` — the implementation live *now*. The default is registered eagerly at module load, so the alias is never dangling (no boot step).
- \`registerCompositionFactory(impl)\` — swap the implementation behind the alias (the cutover primitive); returns a \`restore()\` handle so a swap can be unwound (rollback / test isolation).

## Why the seam exists (and what it supports)

Composite construction is going to **move**: later waves widen it (more instrument kinds, tenant-composed types per W9 §6, CDM economic-terms leaves). Rather than have every call-site \`import\` the concrete factory — a wide, coordinated rewrite each time the construction path changes — consumers resolve it through one stable indirection. The implementation behind the alias can be **swapped without touching any call-site** — the strangler/cutover pattern, the **same seam shape as the SA-CCR alias-flip** (where v2 became the sole live CCR emitter behind one resolution boundary; here the boundary is composite *construction* rather than CCR *emission*).

The swap is proven, not cosmetic: \`composition-factory.test.ts\` registers a sentinel factory behind the alias, asserts \`buildComposite\` honours its (deliberately different) output, then restores the default and re-asserts.

## Recon

\`recon:v2-composition-factory\` (advisory; \`platform/recon/v2-composition-factory.ts\`, wired into the infra recon suite + package.json) asserts (1) the alias resolves to a live factory (non-empty \`implId\`), and (2) no \`v2-core\` module bypasses the seam by importing the concrete factory's \`build\` / \`defaultCompositionFactory\` directly. Advisory because S6 proves the seam in isolation — the factory is **not yet wired into the FIL-instance backfill** (a later wave) — so there are no in-tree consumers yet; the gate ships ready to catch the **first** bypass when construction is wired in. Its test fires the bypass detector on a synthetic positive so the gate is not vacuously green.

## Proof

- 17 factory/alias tests pass (canonical builds, every rejection class with its code, the swap-behind-alias proof).
- \`recon:v2-composition-factory\`: PASS (alias implId=\`fil-core/default\`; 0 seam-bypass).
- \`bun run ci\`: GREEN on clean GH CI (PR #1301 — Core, Recon-Infrastructure, Recon-Domain all pass). Locally only \`recon:event-store-append-only\` fails on the pre-existing home-store archive-partition gap (D-EVENT-STORE-SCALING-PHASE-5) — env-only.

## Out of scope (named, not done)

Wiring the factory into the FIL-instance materialisation backfill; instrument kinds beyond IRS / FX-swap / one structured exemplar; valuation / lifecycle / risk; any v1 import (\`recon:v2-no-v1-import\` holds).
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    supersedes: undefined,
    citations: CITATIONS,
    actor: ACTOR,
    entity: ENTITY,
    metadata: {
      title: "V2 S6 — composition factory behind an alias (the construction seam)",
      path: "2026-06-13_atlas_v2-s6-composition-factory.md",
      category: "engineering-design-note",
      author: "Atlas (Substrate Architect, engineering)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      recordId: RECORD_ID,
      recordFiledEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
