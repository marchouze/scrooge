// scripts/file-atlas-v2-bbaas-w3-tenancy-architecture.ts
//
// One-shot RMS Phase 3 filing for Atlas's W3 tenancy-architecture analysis
// for the v2 "Bank Backbone as a Service" (BBaaS) repositioning. Emits a
// RecordFiled event so the Documents register holds the canonical paper.
// The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-W2-W3-DISPATCH (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-bbaas-w3-tenancy-architecture:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-atlas-v2-bbaas-w3-tenancy-architecture] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 BBaaS — W3 tenancy architecture: options stress-test, envelope schema, anchor-tenant migration

**Author:** Atlas (Core banking platform architect, engineering) — Substrate Architect seat
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W2-W3-DISPATCH (CEO-approved 2026-06-12); builds on the session-1
initial ideas paper (record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12, §7)
**Audience:** Marc (CEO)
**Status:** Analysis only. Nothing here changes platform code, envelope fields, or stores.
The recommendation in §6 is a recommendation; the named decision it proposes
(D-V2-TENANCY-ARCHITECTURE) is Marc's to take or refuse.

---

## 1. Scope, method, and the real numbers

The session-1 ideas paper sketched three tenancy options in one paragraph each. This W3
paper stress-tests them against the *actual* v1 substrate — every claim below is grounded
in code read on main at 2026-06-12, and every store figure was measured read-only against
the canonical shared store at \`$HOME/.local/share/bank/event.db\`.

**The anchor tenant's log, measured (2026-06-12, read-only sqlite3):**

| Measure | Value |
|---|---|
| Hot-store events (\`SELECT COUNT(*) FROM events\`) | **102,400** |
| Hot-store sequence range | 222,996 – **472,054** (\`MAX(sequence)\`) |
| Cold archive partitions (\`archive_partitions\` rows) | **17**, every file SHA-256-registered |
| Events held in cold partitions (\`SUM(event_count)\`) | **78,873**, spanning sequence 1 – 402,688 |
| Total events across hot + cold | **≈ 181,273** |
| Distinct \`entity\` values in the hot store | exactly one: \`LE-ZA-HOZ-BANK\` (102,400/102,400) |

Two facts in that table do most of the work in this paper. First, the cold partitions are
**SHA-256-sealed**: \`archive_partitions\` stores a hash per file and
\`PartitionedEventStore.verifyArchiveIntegrity()\` (\`platform/event-store/partitioned-store.ts\`)
re-hashes the bytes on every check — the cold opens are deliberately
\`new EventStore(partition.path, { readonly: true })\` because a read-write open was
empirically shown (2026-06-11) to flip a journal-mode header byte and permanently break the
registered hash. Any tenancy design that requires *rewriting historical events to add a
tenant field* is therefore dead on arrival: 78,873 events spanning sequence 1–402,688
cannot be touched without re-sealing 17 partitions and destroying the integrity chain the
recon harness asserts today. Second, the entire log is single-entity in practice
(\`LE-ZA-HOZ-BANK\`), which makes the entity-vs-tenant disentanglement (§3) cheap *now* and
expensive later.

**What the envelope actually carries today** (\`platform/event-store/types.ts\`,
\`eventSchema\`): \`event_id\`, \`type\`, \`as_of\`, \`entity\` ("legal-entity identifier
(e.g. LE-ZA-HOZ-BANK)"), typed \`actor\` ({type: system|human|service, id}), \`citations\`
(min 1 — the P2 gate), \`payload\`, optional \`provenance\` (ProvenanceTag), optional
\`aggregateId\` / \`aggregateLabel\`. There is **no tenant axis anywhere in the envelope or
the DDL** — the \`events\` table (\`platform/event-store/store.ts\`, exported \`DDL\` const)
indexes \`type\`, \`entity\`, \`as_of\`, \`aggregate_id\`, and the snapshot substrate keys
projection caches on \`(stream_key, as_of, upto_sequence)\` with stream keys like
\`\${entity}|accounting-period\` (\`periodCloseStreamKey\` in
\`platform/accounting/period-close.ts\`) and projection-runtime keys like
\`dashboard:decisionsRegister#prov=<fingerprint>\` (\`effectiveStreamKey\` in
\`platform/projections/runtime.ts\` appends a provenance-filter fingerprint).

**How a process finds its store today** (\`platform/event-store/resolve-event-db.ts\`):
a five-tier pure resolver — (1) explicit \`--event-db\` flag, (2) \`BANK_EVENT_DB\` env,
(3) \`BANK_HOME_EVENT_DB\` env, (4) home-default \`$HOME/.local/share/bank/event.db\` via
\`getBankConfig().eventDb\` (\`platform/config/loader.ts\`, XDG config at
\`$HOME/.config/bank/platform.json\`, per-key precedence env → file → default), (5)
per-worktree \`.local/event.db\` fallback. The composition root
(\`platform/composition.ts\`) calls \`resolveEventDbPath({ excludeHomeDefault: true })\` at
module-load time and wires a singleton: \`new EventStore(dbPath)\` wrapped by
\`gateEventStore\` (permission gate), plus \`LocalProjector\`, \`LocalAuthenticator\`,
\`resolveCompositionClock()\`. Surfaces that want the shared store opt in *before* importing
composition via the boot shim (\`resolve-event-db-boot.ts\`), which also chains the shared
document store — the two stores travel together (PR #1194 dangling-record lesson).

This machinery is the raw material. The question is what shape it takes at N tenants.

## 2. Options A / B / C under stress

Recap of the three candidates from §7 of the ideas paper:

- **Option A — tenant axis in the envelope, one shared store.** Every event carries
  \`tenantBankId\`; all tenants' events interleave in one physical log.
- **Option B — per-tenant physical stores, shared platform code.** Each tenant gets its own
  SQLite file / Postgres database / region; the platform binary is identical everywhere.
- **Option C — per-tenant stores + composition-factory-per-tenant.** B's physical isolation,
  plus \`composition.ts\` generalised into a factory that assembles each tenant's runtime
  from that tenant's subscription/config events, with a platform control-plane store that is
  itself an event store.

Stress-test, criterion by criterion.

### 2.1 Hard isolation / blast radius of a filtering bug

**A fails this criterion structurally, not incidentally.** Under A, isolation is a property
of *every query ever written*. The v1 codebase replays with optional filters —
\`replay({ type })\`, \`replay({ entity })\`, and very often \`replay()\` unfiltered (the recon
pipelines, the projection folds, the dashboard registers). Under A every one of those call
sites becomes a place where forgetting a \`tenant\` predicate leaks bank A's positions into
bank B's projection. The v1 history already contains the shape of this failure at far lower
stakes: the 2026-06-10 designated-currency contamination (GBP bookings in USD accounts)
arose from exactly one missing dimension check, and it took a standing recon gate
(\`recon:account-designated-currency\`) to hold the fix. With tenants, the equivalent defect
is not a mis-booked nostro; it is one regulated bank reading another regulated bank's client
data — a reportable confidentiality breach at both banks' regulators. A recon gate that
*detects* cross-tenant leakage after the fact is not an acceptable control posture for that
class of harm; the control must be structural.

**B and C make the blast radius zero by construction.** A filtering bug inside tenant A's
runtime can corrupt tenant A's projections; it physically cannot read tenant B's events,
because no connection to B's store exists in A's process. This is the same argument the
read-only cold-partition open makes for archive integrity: don't police the hazard, remove
the capability.

### 2.2 Data residency and subscriber-regulator demands

Subscriber banks will arrive with outsourcing and cloud/offshoring obligations of their own
(for SA subscribers, the PA's directives on material outsourcing and cloud adoption; other
jurisdictions have stricter localisation). Under A, "your data stays in your jurisdiction"
is unanswerable — the log is one file/database in one place. Under B/C, residency is a
*deployment parameter per tenant*: tenant A's store in azure-southafrica-north, tenant B's
in eu-west, an on-prem option for the bank that demands it. The existing resolution ladder
already proves the platform code is location-indifferent — the store is "whatever path the
resolver returns", and the M8 comment in \`composition.ts\` is explicit that the cloud lift
"swaps the resolved path for a Cosmos/Postgres URL without touching capability code". B/C
inherit that for free, per tenant. A forfeits it.

### 2.3 Ops cost at N = 1 / 10 / 100

This is the one criterion where A genuinely wins, so it deserves honest accounting.

- **N=1 (today):** A ≅ B ≅ C. One store, one runtime. C's control-plane store is the only
  addition, and it is small (registry + config events).
- **N=10:** A is one store to back up, vacuum, and upgrade; B/C are ten, plus a fleet
  question: when the platform ships a DDL migration (the v1 store upgrades in place via
  \`CREATE TABLE IF NOT EXISTS\` — Slice-2 snapshots and Phase-5 \`archive_partitions\` both
  landed additively), ten stores must converge. Recon fan-out: v1 runs ~218 pipelines
  against one store; B/C run the tenant-scoped subset against each tenant store (≈ linear
  cost in N) plus a small platform-level set against the control plane. At N=10 this is a
  scheduling problem, not an architecture problem — the launchd/scheduler substrate already
  runs per-surface jobs.
- **N=100:** B/C's fan-out costs are linear and parallelisable; A's single store is now a
  contention and size problem *in addition to* its isolation problem — 100 banks × the
  anchor tenant's ≈181k events in three years is tens of millions of rows in one SQLite
  file, which the Phase-1 scaling indexes and Phase-5 partitioning were designed to avoid
  *for one bank*. A does not even keep its ops win at scale.

Verdict: A's ops advantage is real at N≤10 and evaporates at N=100. B and C pay a
fleet-orchestration tax that is engineering-tractable (and that C's control-plane events
make *auditable*: a \`TenantStoreMigrated\` event per tenant per DDL version is itself the
fleet-upgrade ledger).

### 2.4 Clean-core discipline (the SAP lesson)

Under A, tenant-specific behaviour tempts tenant-specific *code paths* — \`if (tenant ===
...)\` branches in shared projections, because everything is in one process anyway. Under B
alone, the temptation moves to per-tenant forks of the deployment. **C is the only option
with a structural answer:** the per-tenant factory consumes *configuration events* (which
domains, which handlers active, which models bound), so tenant variation has exactly one
sanctioned channel — events — and the core stays one codebase. This is the
Salesforce-metadata insight with v1's own twist: the metadata is an append-only, citable
event stream, strictly stronger than mutable metadata. V1 already has the embryo: the
handler registry (\`runtime/handlers-metadata.ts\`, the flat \`HANDLERS_METADATA\` list) is
global today and was already a parallel-dispatch collision point for *one* tenant; C turns
"which handlers are active" into per-tenant config events and dissolves that file's
god-object status.

### 2.5 Cross-tenant learning boundary

Section 3.1 of the ideas paper splits seat memory into shared core memory and tenant
memory, with a reviewable generalisation gate between them. Under A there *is* no physical
boundary for the gate to sit on — tenant data and would-be-shared learnings cohabit one
store, and the "never crosses" guarantee is again query discipline. Under B/C the boundary
is the store boundary: tenant memory lives in the tenant store, seat core-memory lives in
the platform control-plane store, and the only path between them is an explicit distillation
step that emits *into* the control plane. C names where that step runs (a platform-side
process with read access granted per tenant contract) — under B-without-control-plane there
is no natural home for the shared half at all, which is the quiet reason B alone is
incomplete: B answers isolation but leaves the platform's own state (tenant registry,
subscriptions, platform decisions, seat core memory) homeless or in config files —
markdown-without-event at platform scale, a Principle 1 violation waiting to happen.

### 2.6 Platform-level recon

Some assurance must span tenants: "every tenant store passes append-only", "every tenant is
on DDL version ≥ v", "no tenant store contains another tenant's id" (§3's coherence gate).
Under A these are trivial queries — credit where due. Under B/C they are fan-out pipelines
reading each tenant store *read-only* plus the control plane. The mitigation is already in
the codebase pattern: recon cursors (\`recon_cursors\` table, Phase-1 scaling) make each
per-store pass O(delta), and results aggregate as events in the control plane
(\`PlatformReconCompleted { tenantId, pipelineId, status }\`), so platform recon over N
tenants is itself projection-derived. Fan-out is a cost, not a blocker — and it buys the
property that platform recon *cannot accidentally write* into a tenant store if the spans
are opened readonly, exactly as cold partitions are today.

### 2.7 The Azure M8 lift (Principle 3)

The shared-store model was designed so M8 swaps a file path for a Cosmos/Postgres URL.
Worry: does per-tenant-stores break that? No — it *multiplies* it. Under B/C, M8 becomes
"swap each tenant's resolved path for that tenant's database URL", and the per-tenant
resolution layer (§4) is precisely where the URL lives. The Postgres mirror that already
exists (\`BANK_EVENT_DB_URL\`, \`scripts/event-store-sync.ts\`, noted in the composition-root
comment) is the single-tenant rehearsal of exactly this. Under A, by contrast, M8 lands one
giant multi-tenant database and immediately re-confronts every isolation/residency question
at the cloud provider layer (row-level security, per-tenant encryption keys) — solvable,
but it means rebuilding B's isolation *inside* the database after having declined it in the
architecture. C is the honest version of where A ends up anyway.

### 2.8 Replay and archive integrity

Replay must stay deterministic per tenant. Under B/C each tenant's log keeps its own dense
local story (the anchor tenant's global-sequence spine — cold 1–402,688, hot
222,996–472,054 — stays exactly as it is). Archival is per-tenant: each tenant accrues its
own \`archive_partitions\` rows and SHA-sealed cold files, and
\`verifyArchiveIntegrity()\` runs per store unchanged. Under A, archival entangles tenants:
a cold partition cut at sequence S contains *every* tenant's events below S, so a single
tenant's exit (contractual termination, regulator-ordered data return, right-to-erasure
analogues) requires either rewriting sealed partitions (breaks hashes — see §1) or the
selective-extraction machinery (\`extractToArchivePartition\`,
D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION) run at tenant scale on every exit. Tenant
offboarding under B/C is "hand over the files, verify the hashes, delete" — an afternoon,
not a project.

### 2.9 Scorecard

| Criterion | A (shared store) | B (per-tenant stores) | C (B + per-tenant composition) |
|---|---|---|---|
| Hard isolation / blast radius | ✗ query-discipline only | ✓ structural | ✓ structural |
| Data residency | ✗ | ✓ per-tenant | ✓ per-tenant |
| Ops at N=1/10 | ✓ best | ○ fleet tax | ○ fleet tax (audited) |
| Ops at N=100 | ✗ contention + size | ✓ linear | ✓ linear |
| Clean core | ✗ invites branches | ○ invites deploy forks | ✓ config-as-events channel |
| Learning boundary | ✗ no physical seam | ○ no home for shared half | ✓ control-plane store |
| Platform recon | ✓ trivial | ○ fan-out | ○ fan-out, event-aggregated |
| Azure M8 | ○ re-derives B in-DB | ✓ URL per tenant | ✓ URL per tenant |
| Replay/archive/offboarding | ✗ entangled partitions | ✓ per-tenant | ✓ per-tenant |

A is eliminated by the isolation, residency, and archive-entanglement rows — each alone is
disqualifying for a product whose customers are regulated banks. B is C minus the
control plane and minus the config channel; everything B lacks, the platform would be
forced to invent ad hoc. **C is the working architecture**, with one critical import *from*
A: the tenant axis still belongs in the envelope (§3), because events outlive the store
they were written in.

## 3. Envelope schema proposal — tenant and entity as orthogonal axes

### 3.1 Why the envelope needs a tenant field even with per-tenant stores

Events move: into SHA-sealed cold partitions, into regulator extracts, into support
bundles, across the distillation gate, through fleet tooling that touches many stores. The
moment an event is read outside the store that wrote it, "which tenant" must be answerable
from the event alone — self-describing events are the difference between an archive file
that is evidence and one that is just bytes whose meaning depends on which directory it was
found in. The store boundary provides *isolation*; the envelope field provides *identity*.
C needs both.

\`entity\` does not do this job and must not be bent to it. \`entity\` is the Principle 5
legal-structure axis — a tenant bank may run several legal entities in a versioned tree
(today: \`LE-ZA-HOZ-BANK\`; at licence-day plausibly siblings). Tenant is the subscription
and isolation axis. One tenant, many entities; never one entity, many tenants. Overloading
\`entity\` with tenant semantics (e.g. prefixing) would break the first multi-entity
subscriber and poison every \`idx_events_entity\` query.

### 3.2 Proposed envelope (typed sketch — no code change in this paper)

\`\`\`ts
// platform/event-store/types.ts — v2 sketch (W3 proposal, NOT implemented)

export const tenantIdSchema = z
  .string()
  .regex(/^tenant:[a-z0-9-]+$/); // e.g. "tenant:hoz-bank-za"

export const eventSchemaV2 = z.object({
  event_id: z.string().min(1),
  type: z.string().min(1),
  as_of: z.string().min(1),

  // NEW — tenancy axis. Optional at the schema level for exactly the
  // reason provenance is optional today (types.ts): legacy events and
  // transition-period appenders must still parse. The store's append()
  // enforces presence once the tenant substrate flag is active — the
  // proven ProvenanceTag rollout pattern, reused.
  tenant: tenantIdSchema.optional(),

  // UNCHANGED — legal-structure axis within a tenant (Principle 5).
  entity: z.string().min(1),

  actor: actorSchema,
  citations: z.array(z.string().min(1)).min(1),
  payload: z.record(z.unknown()),
  provenance: provenanceTagSchema.optional(),
  aggregateId: z.string().uuid().optional(),
  aggregateLabel: z.string().min(1).optional(),
});
\`\`\`

DDL counterpart: one additive nullable column \`tenant TEXT\` plus
\`CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant)\` — the same in-place
additive-migration shape every prior store evolution used (snapshots, provenance,
aggregate_id, archive_partitions all landed via \`CREATE ... IF NOT EXISTS\` /
nullable-column adds).

Field name: \`tenant\`, not \`tenantBankId\` — the envelope already uses bare axis names
(\`entity\`, \`actor\`), the value is a typed URN-ish id (\`tenant:hoz-bank-za\`) matching
the house id style (\`agent:atlas:engineering\`, \`record:documents:...\`), and not every
tenant is a bank (the knowledge-tier subscriber might be an auditor or a consultancy).

### 3.3 Constraints and invariants

1. **Store homogeneity (the C invariant).** Within one tenant store, every non-null
   \`tenant\` value MUST equal the store's bound tenant. This is not a filter — it is a
   recon-gated integrity invariant (\`recon:tenant-store-coherence\`, advisory → enforcing),
   the structural proof that no cross-tenant write ever happened. Under C this gate should
   never fire; that is the point.
2. **Defaulting rule for legacy events.** Events with \`tenant\` null in a bound store are
   *defined* to belong to the store's bound tenant (binding declared in the control plane,
   §4). This makes the rule total without rewriting a single historical byte — load-bearing
   for the 17 sealed partitions.
3. **Tenant ≠ entity, enforced.** \`tenant\` values and \`entity\` values live in disjoint
   namespaces (\`tenant:*\` vs \`LE-*\`); a recon assertion keeps them from ever being
   confused in either column.
4. **Append-time enforcement is flag-gated**, mirroring provenance Slice 1: schema-optional,
   \`append()\`-rejects-when-active. Tests and scenarios that build tmpdir stores via
   \`BANK_EVENT_DB\` get the flag off by default, exactly as today.

### 3.4 Snapshot stream keys

Today's convention is per-store and entity-prefixed where entity matters:
\`\${entity}|accounting-period\` (period close), \`dashboard:decisionsRegister#prov=…\`
(projection runtime, provenance-fingerprinted via \`effectiveStreamKey\`). **Proposal: leave
stream keys tenant-unqualified.** Snapshots live inside the tenant store (\`snapshots\`
table travels with the file); prefixing every key with the tenant would be redundant within
the store and would invalidate every existing snapshot row for zero information gain. The
control-plane store's own snapshots use control-plane keys (\`platform:tenantRegistry\`,
…). Only *cross-store aggregation tooling* (platform recon result caches) needs qualified
keys, and those live in the control plane where the convention extends naturally to
\`<tenant>|<stream>\`. The UNIQUE(stream_key, as_of, upto_sequence) constraint and both
snapshot indexes are untouched.

### 3.5 Self-describing archives and regulator extracts

Cold partitions cut *after* the tenant flag activates carry \`tenant\` on every row —
fully self-describing. The 17 existing anchor partitions stay null-tenant + sealed; their
identity is supplied by a one-time control-plane attestation
(\`ArchivePartitionTenantAttested { partitionId, sha256, tenant }\` — 17 events) rather
than by rewriting. A regulator extract bundle then always contains: the event rows, the
partition hashes, and the attestation events — provenance without mutation.

## 4. Composition-factory sketch

### 4.1 From singleton to factory

\`platform/composition.ts\` today is a module-body singleton: resolve path → mkdir → \`new
EventStore(dbPath)\` → permission-gate wrap → export \`eventStore\`, \`projector\`,
\`authenticator\`, \`clock\`. Its own header already promises that "the cloud lift (M8)
replaces this file's contents — it does not touch capability code". The v2 move keeps that
contract: capability code keeps importing the same interface; what changes is who builds it.

\`\`\`ts
// platform/tenancy/composition-factory.ts — v2 sketch (W3 proposal)

export interface TenantRuntime {
  readonly tenant: string;             // "tenant:hoz-bank-za"
  readonly eventStore: GatedEventStore; // permission-gated, as today
  readonly projector: LocalProjector;
  readonly clock: Clock;
  readonly activeHandlers: readonly HandlerMetadata[]; // subscription-filtered
}

export function composeTenantRuntime(tenantId: string): TenantRuntime {
  const cp = openControlPlane();                    // platform's own event store
  const reg = foldTenantRegistry(cp);               // projection over config events
  const binding = reg.storeBinding(tenantId);       // path | URL, region, DDL version
  const store = gateEventStore({ store: new EventStore(binding.path), ... });
  const subs = reg.subscriptions(tenantId);         // domains, models, handlers
  return { tenant: tenantId, eventStore: store, ... };
}
\`\`\`

The single-bank \`composition.ts\` becomes a thin alias:
\`composeTenantRuntime(DEFAULT_TENANT)\` with the anchor tenant as default — existing
imports keep working through the entire transition.

### 4.2 What the control-plane store holds

The control plane is **just another event store** (same \`EventStore\` class, same DDL, same
append-only recon), holding platform-scope events only:

- **Tenant registry:** \`TenantRegistered\`, \`TenantStoreBound { tenant, path|url, region }\`,
  \`TenantStoreMigrated { tenant, ddlVersion }\`, \`ArchivePartitionTenantAttested\`.
- **Subscriptions:** \`DomainSubscribed { tenant, domain, tier }\`,
  \`ModelBound { tenant, model, version }\`, \`HandlerActivated { tenant, handlerKey }\` —
  the per-tenant activation that dissolves the global-flat-list problem of
  \`runtime/handlers-metadata.ts\` (the catalogue of what *exists* stays code; what is
  *active* per tenant becomes events).
- **Seat core-memory:** the shared half of §3.1's learning split — distilled playbooks and
  precedent, entering only through the generalisation gate.
- **Platform decisions:** \`Decision\` events whose scope is the backbone itself (the W2
  distillation pass's "foundational" class is, in effect, the control plane's seed corpus).

### 4.3 How dispatch CLIs and recon resolve "which store"

Extend the proven five-tier ladder with a tenant tier at the top, preserving every existing
behaviour when no tenant is named:

1. \`--event-db <path>\` (unchanged — explicit always wins)
2. **NEW:** \`--tenant <id>\` / \`BANK_TENANT\` → control-plane lookup of the bound store
3. \`BANK_EVENT_DB\` (unchanged — tests, scenarios, CI keep tmpdir isolation)
4. \`BANK_HOME_EVENT_DB\` (unchanged)
5. home-default via \`getBankConfig().eventDb\` — becomes *defined as* the anchor tenant's
   bound store (one config-file line; no behaviour change on any existing machine)
6. \`.local/event.db\` fallback (unchanged)

Dispatch CLIs (\`open-brief\` / \`start-run\` / \`close-run\`) gain \`--tenant\` and default to
the anchor; per-tenant recon runs with tier 2; platform recon iterates the registry and
opens each bound store readonly. \`getBankConfig()\` (\`platform/config/loader.ts\`) is
untouched — it keeps resolving the *platform host's* defaults, while tenant bindings live
in control-plane events where they are versioned and auditable rather than in a mutable
JSON file.

## 5. Anchor-tenant migration sketch

Design constraints: zero licence-track disruption; zero rewrites of sealed history; every
stage independently rollback-able; the anchor uses the same channels any tenant would
(the §6 anti-temptation rule from the ideas paper).

**Stage 0 — declare (pure addition, no platform code).** Stand up the control-plane store
(a new SQLite file, e.g. \`$HOME/.local/share/bank/platform.db\`). Emit
\`TenantRegistered { tenant: "tenant:hoz-bank-za" }\` and \`TenantStoreBound\` pointing at
the existing \`$HOME/.local/share/bank/event.db\`, plus the 17
\`ArchivePartitionTenantAttested\` events (hashes copied from \`archive_partitions\`).
Nothing reads any of this yet. *Rollback: delete the file.*

**Stage 1 — envelope field lands dark.** Add optional \`tenant\` to \`eventSchema\` + the
additive nullable column/index; enforcement flag OFF. All 102,400 hot events and all
appends continue exactly as-is (null tenant = bound tenant by the defaulting rule).
Ship \`recon:tenant-store-coherence\` advisory. *Rollback: the column is nullable and
unread; revert the schema commit.*

**Stage 2 — composition factory behind the alias.** Land \`composeTenantRuntime\` with
\`composition.ts\` delegating for the default tenant; dispatch CLIs gain \`--tenant\`
defaulting to anchor. Byte-equivalence is assertable: every projection and recon output
must be identical pre/post (same store, same events, same code path modulo the alias).
*Rollback: re-inline the old composition body.*

**Stage 3 — new appends carry tenant.** Flip the append-enforcement flag (the provenance
Slice-1 playbook: flag on at composition root, off in tests). From this sequence forward
the log is self-describing; before it, the defaulting rule + attestations govern —
**no backfill of historical rows, ever** (the sealed-partition argument in §1; the same
choice already made for \`aggregateId\`, which backfills *derivations*, and provenance,
which soft-tags — but tenant needs neither: the store binding makes null unambiguous).
*Rollback: flag off.*

**Stage 4 — second tenant (the real test).** A sandbox tenant (e.g.
\`tenant:rehearsal-bank\`) with its own store exercises registry, factory, per-tenant recon
fan-out, and offboarding end-to-end before any commercial subscriber exists.

**Rehearsal strategy.** The existing scenario machinery is sufficient and already proven:
tests/scenarios set \`BANK_EVENT_DB\` to a tmpdir (tier 3 beats everything below it) and
\`BANK_SCENARIO_CLOCK_MODE=simulated\` gives controlled time (\`resolveCompositionClock\`).
The migration rehearsal is: copy the real store + partitions to a tmpdir, run Stages 1–3
against the copy, assert (a) \`verifyArchiveIntegrity()\` still returns 17×ok, (b) a fixed
basket of projections (GL trial balance, decisions register, RAS register, briefs register)
produces byte-identical state pre/post, (c) \`recon:tenant-store-coherence\` is green. That
equivalence harness then *stays* as the standing gate for every future tenant migration.

## 6. Recommendation

**Adopt Option C — per-tenant physical stores + composition-factory-per-tenant — with the
tenant axis in the envelope (§3) from the first v2 event.** A is disqualified on isolation,
residency, and archive entanglement (§2.1, §2.2, §2.8); B is C without a home for the
platform's own state and without the config-as-events channel that keeps the core clean
(§2.4, §2.5).

**Three strongest reasons:**

1. **Isolation by construction, not by query discipline.** A tenant process holds no handle
   to any other tenant's store; the worst filtering bug in history cannot leak one bank's
   data to another. For customers who are regulated banks, this is the difference between
   a sellable control posture and a permanent objection.
2. **The clean-core channel is structural.** Per-tenant runtimes assembled from
   subscription/config events give tenant variation exactly one sanctioned path — events —
   making the SAP clean-core doctrine enforceable by recon rather than pleadable by policy,
   and making Salesforce-style instant fleet upgrades possible because tenant behaviour is
   data.
3. **It is the only option the existing substrate already half-built.** The resolution
   ladder, the XDG config store, the Postgres-mirror seam, the readonly partition spans,
   the provenance-style flag-gated rollout, and the additive-DDL discipline all generalise
   to per-tenant with small, rehearsable steps (§5) — and the M8 Azure lift becomes
   "one URL per tenant", which is what \`composition.ts\` promised all along.

**Top three residual risks:**

1. **Fleet drift at N tenants** — stores on divergent DDL/code versions producing subtly
   different projections; mitigated by \`TenantStoreMigrated\` events + a platform recon
   gate asserting version convergence, but the operational muscle does not exist yet.
2. **Control-plane as new single point of failure and of trust** — tenant bindings, seat
   core-memory, and the learning gate concentrate there; it needs the same append-only,
   permission-gated, recon-covered treatment as tenant stores from day one, plus a
   governance answer (W7) for what the platform operator may see.
3. **Cross-tenant recon and learning costs are linear in N and easy to under-invest in** —
   if fan-out scheduling lags tenant growth, platform-level assurance quietly thins out;
   the scorecard's "fan-out is tractable" claim has only been demonstrated at N=1.

**What would falsify C:** (a) a subscriber-regulator or data-residency regime that demands
*physical co-mingling prohibition AND platform-blind operation* so strict that even the
control-plane attestations are impermissible — pushing toward on-prem-only B-minus;
(b) evidence at the Stage-4 rehearsal that per-tenant composition overhead (process-per-
tenant, store-per-tenant memory) is unaffordable at target price points, pushing back
toward A-with-row-level-security inside one Postgres; (c) the W2 distillation pass
revealing that far more of the decision corpus is tenant-entangled than believed, implying
the shared/tenant seam is in the wrong place entirely.

**Named decisions for Marc (recommend, not decide):**

- **D-V2-TENANCY-ARCHITECTURE** — adopt Option C + the §3 envelope (tenant axis optional →
  flag-enforced; \`entity\` unchanged; no historical rewrites; sealed partitions attested
  not rewritten) as the binding v2 tenancy architecture.
- **D-V2-CONTROL-PLANE-STORE** — authorise the platform control-plane event store and its
  event vocabulary (\`TenantRegistered\`, \`TenantStoreBound\`, \`DomainSubscribed\`, …),
  Stage 0 of §5.
- **D-V2-ANCHOR-TENANT-MIGRATION** — authorise Stages 1–4 of §5 with the byte-equivalence
  rehearsal harness as the gate between stages.

The first is the load-bearing one; the other two are its first two executable slices and
could be folded into it if Marc prefers one decision.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). W3 deliverable of the
v2 structural analysis under D-V2-BBAAS-W2-W3-DISPATCH.*
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
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W2-W3-DISPATCH"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — W3 tenancy architecture: options stress-test, envelope schema, anchor-tenant migration",
      path: "2026-06-12_atlas_v2-bbaas-w3-tenancy-architecture.md",
      category: "strategy-analysis",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-12",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
