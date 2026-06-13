// scripts/file-owen-v2-s11-functional-seats.ts
//
// One-shot RMS Phase 3 filing for Owen's V2 S11 functional-seat-model design
// note. Emits a RecordFiled event so the Documents register holds the canonical
// record. Idempotent — skips if already filed.
//
// Authority: D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3 (active).
// Brief: brief:owen:v2-s11-tenant-scoped-functional-seat-model-roste:2026-06-13
// Author: Owen (Company Secretary, governance) with Sade (AgentOps, operations).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:owen:v2-s11-functional-seats:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-owen-v2-s11-functional-seats] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S11: Tenant-scoped functional-seat model — seat/persona/tenant split + roster-derived anchor occupancy

**Author:** Owen (Company Secretary, governance) with Sade (AgentOps, operations)
**Date:** 2026-06-13
**Authority:** D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Brief:** brief:owen:v2-s11-tenant-scoped-functional-seat-model-roste:2026-06-13
**Workstream:** WS-V2-BBAAS (the last Wave-3 slice)

---

## 1. The problem S11 solves

In a multi-tenant platform you cannot have "Helena the CRO" as a global
singleton. Every tenant needs its OWN functional seats — a CRO seat, a
Risk-Engineer seat, a Company-Secretary seat — each filled by that tenant's own
agent. S11 introduces the **seat / persona / tenant** split:

- The **SEAT** is the functional role, **tenant-scoped**. Its key embeds the
  tenant: \`tenant:za-bank:seat:cro\`.
- The **PERSONA** (Helena, Rohan, …) is the **anchor tenant's OCCUPANT** of its
  seat. The persona NAME is occupancy, never seat identity.
- The **TENANT** scopes the seat key, so a second tenant's CRO seat is a
  DISTINCT key \`tenant:uk-bank:seat:cro\` that never collides with Helena.

## 2. Hard constraint — additive, derive from the roster, never rewrite it

\`Team/_team-roster.json\` is canonical: Vera's mandate-coverage recon, the
CLAUDE.md renders, persona-file headers, and the dashboard direct-reports tile
all derive from it. S11 is **purely additive** — it introduces the
functional-seat abstraction in v2-core and DERIVES the anchor seat map FROM the
roster's existing fields:

| Roster field | Derives to |
|---|---|
| \`name\` | seat \`occupant\` |
| \`role\` | \`functionalRole\` + (slugified) seat key segment |
| \`type\` | \`seatType\` (governance \\| engineering) |
| \`reportsTo\` | \`reportsToSeat\` (the reports-to persona's seat key; \`CEO\`/\`marc\` → \`null\`, the top-of-house CEO line) |

No persona is renamed, no roster field is restructured, no persona file is
touched. The roster stays the single source of truth; the v2 seat register
*references* it. All existing roster-derived recons stay green.

If deriving the seat map surfaces a roster inconsistency (unknown \`type\`,
duplicate role slug, dangling \`reportsTo\`), S11 **REPORTS it as a finding** —
it does not silently fix the roster.

## 3. What S11 delivers

### 3.1 New / changed files

| File | Purpose |
|---|---|
| \`v2-core/control-plane/events.ts\` | + \`FunctionalSeatRegistered\` event type + Zod schema + \`SeatType\` |
| \`v2-core/control-plane/functional-seats.ts\` | Seat-key construction, roster load/parse, \`deriveSeatMap\`, \`deriveAndAppendAnchorSeats\`, \`FunctionalSeatProjection\`, pure \`assertSeatRosterParity\` |
| \`v2-core/control-plane/index.ts\` / \`v2-core/index.ts\` | Barrel re-exports |
| \`v2-core/control-plane/functional-seats.test.ts\` | Anchor occupancy, multi-tenant property, idempotency, sabotage-proof parity |
| \`platform/recon/v2-functional-seat-roster-parity.ts\` | Recon gate (advisory → enforcing) |
| \`scripts/run-recon-suite.ts\` / \`package.json\` | Recon-suite wiring |

### 3.2 The event — \`FunctionalSeatRegistered\`

\`seatId\` is \`tenant:<tenantId-segment>:seat:<role-slug>\` (e.g.
\`tenant:za-bank:seat:chief-risk-officer\`). Because the key embeds the tenant,
seats are tenant-isolated by construction. Payload:
\`{ seatId, tenantId, functionalRole, seatType, reportsToSeat, occupant, registeredAt }\`.
The event lives in the v2-core control-plane store (same store as
\`TenantRegistered\` et al.), NOT the v1 event registry — exactly the established
control-plane pattern.

### 3.3 Anchor occupancy (derived from the roster)

\`deriveAndAppendAnchorSeats(store)\` reads the canonical roster, derives one
seat per persona for \`tenant:za-bank\`, and appends \`FunctionalSeatRegistered\`
events with **deterministic event_ids** (\`seat-registered:<seatId>\`) so the
store's \`INSERT OR IGNORE\` makes re-derivation idempotent. Against the live
roster this maps **31 personas → 31 anchor seats, 0 findings** (verified).

### 3.4 The multi-tenant property (the point)

The unit test registers the anchor seats AND a HYPOTHETICAL second tenant
(\`tenant:uk-bank\`, NOT onboarded — derived in-test only) with its own CRO
occupant "Fiona". It proves:
- \`tenant:za-bank:seat:chief-risk-officer\` and
  \`tenant:uk-bank:seat:chief-risk-officer\` are **distinct, non-colliding keys**;
- same \`functionalRole\`, but distinct occupancy (Helena vs Fiona);
- each tenant's seat list is isolated to that tenant.

This is what lets a second tenant get its own seats without colliding with the
anchor's persona names — the deliverable's whole purpose.

### 3.5 Recon — \`recon:v2-functional-seat-roster-parity\`

The v2 analogue of Vera's roster-derived recons. Pure assertion
(\`assertSeatRosterParity\`) checks: (1) every roster persona maps to exactly one
anchor seat; (2) each seat's role/type/reportsTo/occupant match the roster;
(3) no orphan anchor seat; (4) no derivation finding. **Drift from the roster is
a finding — the roster is the source.** The deterministic core is exercised
sabotage-proof in the test (missing / drifted-type / orphan seats are caught,
non-vacuously). Posture: ADVISORY → ENFORCING — empty register (clean CI, seed
not yet in \`ci:migrate\`) is an advisory note, not a failure; a
populated-but-drifted register is enforceable by flipping the \`ENFORCING\` flag
once the anchor seat-seed lands in \`ci:migrate\` (mirrors the S14
fleet-integrity posture).

## 4. Findings

None. The live roster derives cleanly to 31 anchor seats with zero
inconsistencies (no unknown seat types, no duplicate role slugs, no dangling
\`reportsTo\`). All \`reportsTo\` values resolve either to a roster persona's seat
or to the CEO line (\`CEO\`/\`marc\` → \`reportsToSeat: null\`).

## 5. Substrate gap

The anchor seat-seed is not yet in the CI \`ci:migrate\` chain, so the recon
runs advisory on a clean runner (empty register). The follow-on is to add an
idempotent \`seed:v2-anchor-seats\` step to \`ci:migrate\` (re-deriving from the
roster on every run) and flip \`ENFORCING\` to \`true\` — at which point any
roster↔register drift becomes a blocking gate, the same as Vera's
mandate-coverage. This is the natural S11→steady-state hardening step.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-V2-TENANCY-ARCHITECTURE",
      "D-V2-BBAAS-TIER-STRUCTURE",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-RMS-PHASE-3",
    ],
    actor: {
      type: "service",
      id: "agent:owen:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 S11: Tenant-scoped functional-seat model — seat/persona/tenant split + roster-derived anchor occupancy",
      path: "2026-06-13_owen_v2-s11-functional-seats.md",
      category: "governance-design",
      author: "Owen (Company Secretary, governance)",
    },
  },
  clock.now(),
);

console.log(`[file-owen-v2-s11-functional-seats] RecordFiled: ${result.event.event_id}`);
console.log(`  recordId: ${RECORD_ID}`);
