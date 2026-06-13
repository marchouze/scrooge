// scripts/file-atlas-decimal-money-redenomination-design-spec.ts
//
// RMS Phase 3 filing — Atlas's design spec for the exact-decimal money
// redenomination + config-only event-store purge/re-seed under
// D-MONEY-DECIMAL-REDENOMINATION. DESIGN SPEC ONLY: this run files a
// RecordFiled document and returns to the CEO for manifest sign-off
// BEFORE any purge or redenomination code. Idempotent — skips if already
// filed.
//
// Authority: D-MONEY-DECIMAL-REDENOMINATION (CEO-approved 2026-06-13).
// Brief: brief:atlas:decimal-money-redenomination-config-only-purge-t:2026-06-13
// Author: Atlas (Core banking platform architect, engineering).
// Co-author: Bea (Accounting & financial reporting engineer, engineering)
//   — rounding-policy + retention-manifest sections.

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:decimal-money-redenomination-design-spec:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-decimal-money-redenomination] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# Decimal-money redenomination + config-only event-store purge/re-seed — design spec

**Author:** Atlas (Core banking platform architect, engineering)
**Co-author:** Bea (Accounting & financial reporting engineer, engineering) — rounding-policy + retention-manifest sections
**Date:** 2026-06-13
**Authority:** D-MONEY-DECIMAL-REDENOMINATION (CEO-approved 2026-06-13)
**Brief:** brief:atlas:decimal-money-redenomination-config-only-purge-t:2026-06-13
**Status:** DESIGN SPEC ONLY — returns to CEO for manifest sign-off BEFORE any purge or redenomination code. No Money type lands, no event schema is touched, no event is purged, in this run.
**Reviewer (audit-trail integrity):** Vera (Internal audit engineer, third line)

---

## 0. Executive summary

We adopt **Option B**: money becomes an **exact major-unit decimal** —
arbitrary precision, serialised as **strings** (never float, never a fixed
\`bigint\` minor-unit count), with the ISO 4217 exponent applied **only at the
boundary** (rounding, settlement, display, validation), not in storage. The two
divergent \`Money\` types (\`platform/core/money.ts\` — an incomplete 4-currency
\`DECIMALS\` table that *throws* on JPY/KRW/BHD; \`platform/types/currency.ts\` —
scale-agnostic \`bigint\` with no rounding policy) collapse into one.

The enabler is a **config-only event-store purge + re-seed** that mimics how a
fresh BBaaS tenant starts. Transactional history (33 money-bearing event types,
438 \`*Minor\` fields, \`amountMinor\` ×1006 occurrences, ~227k immutable events)
is purged after a full backup; the governance/config spine (Decisions, RMS
documents, Party register, legal-entity tree, Chart of Accounts, RAS/posture
registers, obligations/policies/procedures, regulatory library, model- and
threat-model validation, the dispatch ledger) is **re-authored** — not byte-
copied — into the fresh store under the new encoding **and** under the correct
canonical legal-entity identity. Because no permanent dual-read codec survives,
this is a **clean re-seed, not a migration**.

**The single open CEO input** this manifest needs is the correct registered legal-
entity name (the token \`<CANONICAL_LE>\` throughout). Everything else is an
engineering plan gated behind manifest sign-off.

---

## 1. Decimal Money type + ISO 4217 boundary

### 1.1 The unified type (type sketch — does NOT land this run)

Currency stays at the type level (Principle 5). The amount becomes an exact
decimal serialised as a string.

\`\`\`ts
// platform/core/money.ts (proposed unified type — SKETCH ONLY)
import type { Currency } from "./types";

export interface Money<C extends Currency = Currency> {
  /**
   * EXACT major-unit decimal, serialised as a canonical string.
   * Examples: "1234.56" (ZAR), "1000" (JPY), "1.234" (BHD), "0.000000001".
   * NEVER a float. NEVER a fixed minor-unit integer. Arbitrary precision —
   * the value carries full unrounded precision through arithmetic; the ISO
   * 4217 exponent is applied only at boundaries (S1.3).
   */
  readonly amount: string;
  readonly currency: C;
}
\`\`\`

Internally arithmetic runs on an exact rational/big-decimal engine (a small
\`Decimal\` wrapper over \`bigint\` numerator/denominator, or a vetted big-decimal
dependency — decision deferred to the build slice; the *contract* is exactness,
not the library). The string is the **only** serialised form; the in-memory
representation is an implementation detail behind the \`Money\` API.

### 1.2 Arithmetic + cross-currency guard

\`add\` / \`sub\` / \`neg\` / \`eq\` preserve full precision and never round; the
same-currency guard (P5) stays — cross-currency arithmetic throws, FX is an
explicit \`FxConverted\`-style event with rate source + timestamp + citation.
\`mul\` / \`div\` (interest, pro-rata, FX, RWA) are the only operations that can
introduce more decimals than the value started with, so **every division is a
rounding site (S1.3)** — there is no implicit rounding anywhere else.

### 1.3 ISO 4217 exponent table as boundary authority

A complete ISO 4217 minor-unit table replaces the incomplete 4-entry
\`DECIMALS\`. It is the single authority for **where** rounding lands:

| Exponent | Examples | Boundary scale |
|---|---|---|
| 0 | JPY, KRW, CLP, ISK, VND, XOF, XAF | integer major units |
| 2 | ZAR, USD, EUR, GBP (the vast majority) | 2 dp |
| 3 | BHD, KWD, OMR, TND, IQD, JOD, LYD | 3 dp |
| 4 | UYW, CLF (funds/units) | 4 dp |
| n/a | XAU, XAG, XDR (no-minor-unit / metals) | exponent absent → policy default, never silent-throw |

The table also carries the **rounding-bearing context** so a "no minor unit"
currency degrades to an explicit policy default rather than the current
\`throw new Error("Unsupported currency")\`.

### 1.4 Explicit rounding policy at every division (Bea)

Rounding is **never implicit**. Every \`div\` / \`mul\`-then-round call site passes
an explicit \`RoundingContext = { mode, scale }\`:

- **scale** defaults to the currency's ISO 4217 exponent, but a call site may
  request a *higher* working scale (e.g. an interest accrual kept at 6 dp until
  the period-end settlement boundary rounds to 2 dp). Carrying-precision-then-
  rounding-once at the boundary is the rule; rounding mid-computation is a
  finding.
- **mode** is explicit per domain:
  - **Interest accrual / EIR amortisation** — \`HALF_EVEN\` (banker's rounding),
    rounded once at the posting boundary (IAS 39/IFRS 9 effective-interest).
  - **Settlement / payment instruction** — \`HALF_UP\` at the currency exponent;
    the residual sub-unit is the explicit rounding difference posted to a
    rounding-difference GL account (no value silently lost — Bea owns the CoA
    line).
  - **Pro-rata allocation** (fee splits, coupon-by-holding) — \`HALF_UP\` per
    slice **plus a largest-remainder reconciliation** so the slices sum exactly
    to the total (penny-allocation; the allocator is a shared utility, not
    per-call ad-hoc).
  - **FX conversion** — full-precision rate × full-precision amount, then
    \`HALF_UP\` to the *target* currency exponent at the conversion boundary.
  - **RWA / capital** — \`HALF_UP\` at the scale the relevant return cell
    publishes (mirrors the current SA-CCR half-up minor-unit scaling, now
    expressed against the decimal type rather than ad-hoc \`Math.round\`).

This makes the rounding policy **auditable**: a reviewer can point at any
posted residual and trace it to a declared \`RoundingContext\`.

### 1.5 JSON / event codec

The event codec serialises \`Money.amount\` as a **decimal string** (e.g.
\`"1234.56"\`), never a number (JSON numbers are IEEE-754 floats — banned for
money). On read, the codec parses the string into the exact decimal engine. A
\`recon:money-codec-no-float\` lint-style gate asserts no money-bearing payload
field is a JSON number. This replaces the current \`*Minor: bigint\`
serialisation; the \`*Minor\` field-name convention retires (S2 / build slice).

---

## 2. EXACT retention manifest (CEO signs off)

The purge is **config-only**: governance/config survives (re-authored), all
transactional history is purged. The blast radius if we did NOT purge is the
permanent dual-read codec across 33/99 money-bearing event types — which is
exactly the cost we avoid.

### 2.1 RETAIN allowlist (re-authored into the fresh store)

| Retained set | Event kinds / source | Money-bearing? |
|---|---|---|
| **Decisions** | \`Decision\` (+ deprecated \`CeoDecision\`) | rare typed thresholds (see 2.3) |
| **RMS documents** | \`RecordFiled\` + the content-addressed document store | bodies are prose; no typed money |
| **Correspondence / briefs / runs** | \`AgentBriefIssued\`, \`AgentRunStarted\`, \`AgentRunCompleted\` (dispatch ledger) | no typed money |
| **Party register** | natural-person / legal-entity / counterparty / agent Party events | no typed money |
| **Legal-entity tree** | entity-short-id + LE-tree events | no typed money |
| **Chart of Accounts** | CoA definition events | **account scaffolding only — no balances** |
| **RAS register** | risk-appetite-statement + threshold events | **typed money thresholds (2.3)** |
| **Posture register** | \`Posture*\` (APPLIES_WHEN) | **some typed money thresholds (2.3)** |
| **Obligations / policies / procedures** | obligation-adoption, policy-activation, procedure events | thresholds where a reg cites an amount (2.3) |
| **Regulatory library** | \`RegulatorySourceRecorded\`, regulator-mandate/objective events | no typed money (source text) |
| **Model validation** | \`FilModelImplementationDeclared\`, model-validation events | methodology constants, not balances |
| **Threat-model / governance** | threat-model-gate, key-ceremony, CISO/CAE governance | no typed money |
| **Obligation thresholds (IFRS policy)** | \`ifrs-policy-thresholds\` + similar config | **typed money (2.3)** |

Everything **not** on this allowlist is **transactional and is PURGED**:
ledger postings, FX trades/revaluations, IRS/bond revaluations, LCR/NSFR/VaR/
SA-CCR/RWA computations, BA-return cell events, settlement/suspense events,
collateral/repo events — the full \`*Minor\` population.

### 2.2 PURGE classification rule

A clean, mechanical rule (not a hand-curated list): **an event type is purged
iff it carries a transactional money amount** — a \`*Minor\` field, an
\`amount*\`, or any \`Money\`-typed payload field denoting a *position, posting,
valuation, or flow*. The 33 money-bearing transactional types qualify;
governance/config types do not. The manifest enumerates the 33 explicitly (from
the event-types registry) so the sign-off is exact, not heuristic.

### 2.3 Retained-money edge cases — re-seed in the new encoding

These RETAINED event families carry **typed money that is config, not a flow** —
so they survive, but they must be **re-seeded in the decimal encoding** so the
retained set is money-clean (no surviving \`*Minor\` integers):

1. **\`ifrs-policy-thresholds\`** — IFRS 9/IAS materiality + ECL staging
   thresholds (e.g. SICR absolute floors). Re-seeded as \`Money\` decimal strings.
2. **RAS thresholds** — risk-appetite limits (e.g. intraday-liquidity RAS line,
   bond-inventory cap, delta-EVE outlier amount). Re-seeded as decimals.
3. **Posture thresholds** — any \`Posture*\` row whose \`APPLIES_WHEN\` predicate
   compares a money amount. Re-seeded as decimals.
4. **Obligation/policy thresholds** — obligations that cite a regulatory
   monetary threshold (e.g. STR/CTR reporting floors, LEX large-exposure
   thresholds). Re-seeded as decimals.
5. **CoA opening config** — the CoA *definitions* are retained, but any seeded
   *opening balances* are transactional and are purged → regenerated by the
   re-seed book (S4).

**Edge-case principle:** a retained event that carries a \`*Minor\` integer is
NOT byte-copied; it is re-authored with a decimal-string amount. The fresh store
holds **zero** \`*Minor\` integer money fields — a \`recon:no-residual-minor-
encoding\` gate asserts this over the whole fresh population.

### 2.4 Dangling references (retained Decisions citing purged events)

A retained \`Decision\` may cite, in \`sourceDocHashes\` / \`citations\` /
free-text, an event that is purged (e.g. a Decision approving an FX hedge cites
the \`FxRevalued\` event that justified it). Handling:

- **Citations are provenance, not foreign keys.** A retained Decision's
  citation to a purged transactional event is preserved verbatim in the
  re-authored Decision body — it remains a true historical statement.
- **Resolvability is provided by the backup, not the live store.** The
  full pre-purge content-addressed export (S "Backup procedure") is the
  authoritative resolver for any purged citation. The Decision body gains an
  explicit note: *"transactional citations resolve against the pre-redenomination
  archive (export <hash>), not the live store."*
- **No dangling-pointer in live queries.** Because RMS document/decision
  registers are projections over retained events only, no live projection
  attempts to dereference a purged event. A \`recon:retained-decision-citation-
  resolvability\` gate asserts every retained Decision's *non-transactional*
  citations resolve in the fresh store, and every *transactional* citation
  resolves in the registered cold archive.

### 2.5 Vera review (audit-trail integrity)

Vera (Internal audit engineer, third line) reviews the manifest for audit-trail
integrity: (a) the purge classification rule does not over-reach into anything
with regulatory-retention obligations; (b) the full backup is taken and verified
*before* any destructive step; (c) the re-authored governance spine is
content-equivalent to the retained originals except for the two declared
transformations (decimal encoding + LE re-stamp, S3); (d) cold archive
partitions remain SHA-verifiable. Vera's sign-off is a precondition to the purge
slice landing.

---

## 3. Legal-entity identity correction (CEO requirement — NEW)

### 3.1 The defect

The \`entity\` field is **uniformly \`LE-ZA-HOZ-BANK\`** across all 107,003 events
— INCLUDING the retained immutable governance events. (Cross-check: the
\`entity-short-ids\` registry currently maps \`LE-ZA-HOZ-BANK\` →
\`urn:party:legal-entity:hoz-bank\`, legalName \`"Hoz Bank Limited"\`, status
\`active\`; the legacy \`BANK-ZA-001\` is already \`retired\`, and \`LE-BANK-SA\`
was backfilled in #1205.) Per the CEO, \`LE-ZA-HOZ-BANK\` / \`"Hoz Bank Limited"\`
is an incorrect/placeholder identity. A naive "retain governance" therefore
carries the **wrong LE name through the immutable spine** of the fresh store.

### 3.2 The mechanism — re-stamp as an explicit re-seed transformation

Because the re-seed **re-authors** retained content (it is NOT a byte-copy), the
LE correction is a first-class, explicit transformation, applied to **every**
re-issued retained event AND every newly authored seed:

- Transactional events carrying the legacy LE are purged anyway → no action.
- Retained events are re-authored with \`entity\` set to the correct canonical
  short-id (the \`<CANONICAL_LE>\` token), and the \`entity-short-ids\` registry +
  Party register + LE-tree seeds are authored under \`<CANONICAL_LE>\` from the
  first seed event onward.
- The transformation is **declared** in the re-seed manifest (transformation #2,
  alongside transformation #1 = decimal encoding) so it is auditable, not silent.

### 3.3 The recon gate (NEW)

A new gate — **\`recon:no-legacy-le-identity\`** — asserts **ZERO** events in the
fresh store carry a legacy LE name. It fails on any occurrence of
\`LE-ZA-HOZ-BANK\`, any spelling variant, the retired \`BANK-ZA-001\`, and
\`LE-BANK-SA\` (confirming the #1205 backfill leaves none behind). The only
\`entity\` value permitted in the fresh store is \`<CANONICAL_LE>\` (plus genuine
counterparty/other-LE values once multi-entity tenants exist — those are checked
against the active Party register, reusing the existing
\`entity-identity-coherence\` resolution). On a fresh store the gate's expected
result is \`asserted = (event count)\`, \`violations = 0\`.

Note the interaction with the existing \`entity-identity-coherence\` gate: that
gate's migration-boundary machinery (which tolerated pre-boundary
\`BANK-ZA-001\`) becomes moot in the fresh store — there are no pre-boundary
events. The new gate is **stricter** (zero legacy, full stop) and is the
cutover assertion; \`entity-identity-coherence\` continues as the steady-state
active-short-id gate.

### 3.4 Vera review — provenance implication of re-authoring under a corrected identity

Re-authoring retained **Decisions** (immutable governance) under a corrected
identity is acceptable **ONLY because the full pre-purge backup preserves the
true historical sequence** — the original \`LE-ZA-HOZ-BANK\`-stamped events,
their original \`event_id\`s, timestamps, and ordering remain forensically
recoverable from the cold archive. The fresh store is a **deliberately re-based
genesis** under the correct identity, not a falsification of history: the audit
trail is *backup (true history) + fresh store (corrected genesis) + the declared
transformation manifest linking them*. Vera reviews and signs this explicitly;
without the retained backup, re-stamping immutable governance would be a
Principle-1 violation.

### 3.5 OPEN CEO INPUT

\`<CANONICAL_LE>\` — **the correct registered legal-entity name + short-id** — is
the single required CEO input this manifest needs. Until provided, no re-seed
runs. (Secondary: confirm whether \`"Hoz Bank Limited"\` legalName is also
incorrect, or only the short-id form.)

---

## 4. Tenant-bootstrap re-seed plan

The anchor bank is re-seeded **fresh in the new encoding VIA the S15 onboarding
path** (\`v2-core/control-plane/onboarding.ts\`) so it bootstraps **identically to
any future BBaaS tenant** — no snowflake. The anchor bank becomes "tenant zero",
onboarded by the same code a paying tenant would use.

### 4.1 Seed config

- A tenant seed manifest names \`<CANONICAL_LE>\` as the anchor entity, the
  enabled product set, the CoA, the RAS/posture register, and the regulatory
  library scope — all authored as decimal-encoded, \`<CANONICAL_LE>\`-stamped
  seed events through the onboarding path.
- The retained governance spine (S2.1) is folded in as the tenant's starting
  governance state (re-authored, decimal, \`<CANONICAL_LE>\`).

### 4.2 Demo / test transactional book regeneration

The demo/test transactional book (FX trades, IRS, bonds, postings) is
**regenerated** in decimal under \`<CANONICAL_LE>\` by re-running the existing
scenario/seed generators against the decimal Money type. This replaces the
purged transactional history with a clean decimal book that exercises the same
flows. The FX-sim generator's wall-clock \`Date.now\` defect (noted historically)
is pinned to the scenario clock during regeneration so the book is reproducible.

---

## 5. Recon re-baseline plan

Gates that assert over the **event population** must be deliberately reset to the
fresh store as an explicit cutover step (not silently broken):

| Gate | Reset action |
|---|---|
| **\`recon:event-store-append-only\`** | Delete the persisted baseline JSON (\`$BANK_RECON_BASELINE_DIR/event-store-append-only.json\`); first run after re-seed re-initialises the ratchet from the fresh store (the documented seed behaviour, \`asserted=1\`). The pre-purge backup + cold archive partitions preserve the destroyed rows, so the row-count "regression" is sanctioned by the cutover, not a violation. |
| **Archive-span / partition integrity** | Register the full pre-purge export as a cold archive partition (S "Backup"), SHA-verified; the fresh hot store begins a new span. \`PartitionedEventStore.verifyArchiveIntegrity()\` must stay green over the retained cold copy. |
| **Parity counts** (\`v2-saccr-parity\`, \`var-nop-exposure-parity\`, \`rms-*-parity\`, seed-manifest-parity) | Re-baseline against the fresh decimal population; the regenerated decimal book is the new oracle. Parity gates that compare to recorded history are re-pinned to the fresh recorded events. |
| **\`recon:v2-decision-impact-sweep-coverage\`** | The re-authored Decisions need their impact-sweep coverage re-established; run the backfill (\`scripts/backfill-v2-decision-impact-sweeps.ts\` analogue) over the re-seeded Decision set so post-baseline coverage is green. |
| **\`entity-identity-coherence\`** | Continues unchanged (active-short-id gate); **\`recon:no-legacy-le-identity\`** (NEW, S3.3) is added as the stricter cutover assertion. |
| **\`recon:no-residual-minor-encoding\`** (NEW) | Asserts zero \`*Minor\` integer money fields survive (S2.3). |
| **\`recon:money-codec-no-float\`** (NEW) | Asserts no money payload field serialises as a JSON number (S1.5). |

The re-baseline is a **named cutover checklist** in the build slice, executed
once, with each gate's reset recorded as a deliberate step (and, where a gate
embeds a CEO/Decision authority, cited).

---

## 6. Backup procedure (precondition to ANY purge)

**No destructive step runs until the backup is taken AND verified.**

1. **Full content-addressed export** of the entire current event store
   (all ~227k events + the document blob store) to an immutable export file,
   hashed (BLAKE3/SHA-256). This is the authoritative resolver for all purged
   transactional citations (S2.4) and the forensic record of true history (S3.4).
2. **Retain existing archive partitions as a cold copy** — the already-registered
   cold partitions (the archive-gap-recovery + orphan-partition work, seq 1→227k)
   are kept and re-registered against the fresh hot store as read-only cold tiers;
   \`verifyArchiveIntegrity()\` must pass over them post-cutover.
3. **Verify** the export round-trips (re-open, integrity_check, event-count match)
   BEFORE the purge slice is permitted to run. Vera signs the backup verification.

---

## 7. Sequencing vs FX A4 (UPSTREAM)

This redenomination is **UPSTREAM of FX A4**:

- FX **A1–A3** (already merged, read-only over FX history) survive the purge as
  code; their *data* is regenerated in decimal by the re-seed book (S4.2). The
  read-only code reads the fresh decimal events.
- FX **A4 posts decimal** — A4 must be built/resumed **on the decimal Money
  type, after the cutover**, so it never writes a \`*Minor\` integer. Resuming A4
  before the cutover would re-introduce minor-unit postings into a store we are
  about to purge — wasted work and a re-contamination risk.

So A4 is explicitly **gated behind** the redenomination cutover.

---

## 8. Build slice sequence

A deliberate, gated order — each slice is its own PR; the destructive slices are
gated behind Vera sign-off + the verified backup + the \`<CANONICAL_LE>\` input:

1. **Decimal Money type** — land the unified \`Money\` (string-decimal, ISO 4217
   boundary table, explicit \`RoundingContext\` at every division, codec). Collapse
   \`platform/core/money.ts\` + \`platform/types/currency.ts\` into one. New gates
   (\`money-codec-no-float\`) authored but the store is not yet touched.
2. **Schema cutover** — repoint event payload schemas from \`*Minor: bigint\` to
   \`amount: Money\` (decimal string); update producers/projections. (No data
   change yet — this is the code that will *author* the fresh store.)
3. **Backup** (S6) — full export + cold-partition retention + Vera-verified.
4. **Purge + re-seed under \`<CANONICAL_LE>\`** — config-only purge per the
   manifest (S2); re-author the governance spine (decimal + LE re-stamp, S3) and
   re-seed the anchor tenant via the S15 onboarding path (S4); regenerate the
   demo/test book in decimal.
5. **Recon re-baseline** (S5) — execute the named cutover checklist; reset
   append-only baseline; add \`no-legacy-le-identity\` + \`no-residual-minor-
   encoding\`; re-pin parity gates; re-run impact-sweep backfill.
6. **Resume FX A4 on decimal** (S7) — build A4 to post decimal against the fresh
   store.

Slices 1–2 are non-destructive and can proceed on CEO go-ahead. Slices 3–6 are
gated behind: (a) \`<CANONICAL_LE>\` provided; (b) manifest boundary calls signed;
(c) Vera audit-trail + backup sign-off.

---

## 9. Open questions needing CEO input

1. **\`<CANONICAL_LE>\` — REQUIRED.** The correct registered legal-entity name +
   short-id to stamp on every re-authored/seed event. Also: is the
   \`"Hoz Bank Limited"\` legalName itself wrong, or only the short-id?
2. **Manifest boundary calls** — confirm the RETAIN allowlist (S2.1) and the
   retained-money edge cases (S2.3) are complete. In particular: are there
   regulatory-retention obligations on any *transactional* event class that
   would forbid purging it from the *live* store (we retain it in the cold
   archive regardless, but flag if any must stay hot)?
3. **Big-decimal engine choice** — vetted dependency vs in-house \`bigint\`
   rational wrapper (contract is exactness; this is an implementation pick that
   benefits from a steer, not a blocker).
4. **Go/no-go on slices 1–2 now** — the non-destructive decimal-type + schema
   slices can start ahead of the \`<CANONICAL_LE>\` input; confirm.

---

## 10. Substrate gaps surfaced

- **No tenant-purge primitive yet.** The config-only purge/re-seed is hand-built
  for this cutover; a future S-slice should promote it to a reusable
  tenant-reset operation (a paying tenant offboarding would need the same shape).
- **No \`recon:no-legacy-le-identity\` / \`no-residual-minor-encoding\` /
  \`money-codec-no-float\` gates exist yet** — authored in slices 1 and 5.
- **The S15 onboarding path has not yet seeded an anchor-scale governance spine**
  — this cutover is its first real exercise at full retained-governance volume;
  any onboarding-path gaps surface here and feed back to S15.
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
      "D-MONEY-DECIMAL-REDENOMINATION",
      "D-RMS-PHASE-3",
      "D-PARTY-REGISTER",
      "D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION",
      "D-CROSS-WORKTREE-EVENT-STORE-SYNC",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
      "P5-MULTI-CURRENCY-ENTITY-COUNTRY",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:core-banking-platform-architect",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Decimal-money redenomination + config-only event-store purge/re-seed — design spec",
      path: "2026-06-13_atlas_decimal-money-redenomination-design-spec.md",
      category: "design-spec",
      author: "Atlas (Core banking platform architect, engineering)",
      coAuthor: "Bea (Accounting & financial reporting engineer, engineering)",
      date: "2026-06-13",
    },
  },
  "2026-06-13T11:00:00.000Z",
);

console.log(JSON.stringify({ ok: true, recordId: RECORD_ID, eventId: result.eventId }, null, 2));
