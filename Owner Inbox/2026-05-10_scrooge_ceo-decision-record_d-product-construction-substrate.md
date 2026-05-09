---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T00:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-PRODUCT-CONSTRUCTION-SUBSTRATE, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-PRODUCT-CONSTRUCTION-SUBSTRATE`
- **Title:** Product-construction substrate — typed Product layer + 12-event lifecycle family + policy-attestation seam
- **Action:** approve
- **Source proposal:** [Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md](Owner%20Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md)
- **Outcome:** Atlas (Core banking platform architect) + Kai (Trading systems engineer) + Saskia (Head of Global Markets)'s product-construction substrate is adopted: the typed Product layer that composes the CDM primitives in `prototype/platform/markets/cdm/` into a single canonical Product object per family (M1 listed equities, M2 bonds + repo, M3 OTC IRS, M4 FX swaps); the 12-event product-lifecycle family registered against D-EVENT-STORE-SCALING retention metadata; and the policy-attestation seam against which the New Product Approval Policy v1.0 (D-NEW-PRODUCT-APPROVAL-POLICY) attests. Slices 1–3 (Product type, lifecycle event family, composition runtime) authorised pre-M2 under the Targeted budget. Slices 4–8 sequence after both this decision and D-NEW-PRODUCT-APPROVAL-POLICY land, paced by M-phase exits. The five open questions are resolved as the authors recommend.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve all 3" — chat-intake 2026-05-10.
- **Authority chain:** Substrate / standard layer of Principle 6's downward chain. Operational counterpart of D-NEW-PRODUCT-APPROVAL-POLICY (the policy says *what*; this substrate is *how*). Implements Principle 1 (events as truth — the 12-event family is canonical, projections derive), Principle 2 (every attestation carries a citation chain into the obligations register), Principle 5 (multi-X — every Product object carries `legalEntityId`, `currency`, `jurisdiction` at the type level), Principle 6 (single-graph discipline — one canonical Product schema; no orphan capabilities), Principle 7 (per-dimension attestation events emitted by the responsible agent, not a central orchestrator).

## Open questions resolved

| # | Question | Resolution |
|---|---|---|
| **Q1** | One canonical `Product` type discriminated by `family`, or one type per family? | **One canonical type with `family` discriminator.** Cleanest single-graph (Vera (Internal audit engineer) recon walks one schema); per-family additions land as discriminated-union branches; matches CDM posture of "one schema, many compositions". |
| **Q2** | `ProductDimensionAttested` emitted by responsible agent or by central orchestrator? | **Per-dimension agent emits its own attestation.** Matches Principle 7 (the agent owns the decision in scope of its mandate); orchestrator only sequences and assembles into `ProductDueDiligenceCompleted`. Avoids a single orchestrator with read-into-every-agent's-mandate. |
| **Q3** | M2–M4 design-attestations as typed events, or only as Owner Inbox briefs? | **Typed `ProductDimensionAttested` events with `result: "design-attested"`** (vs `"implementation-attested"`). Preserves single-graph discipline; surfaces in Vera's recon today; design→implementation transition becomes a typed event-pair under one `productId`. |
| **Q4** | When `ProductDueDiligenceCompleted` shows gates failed, auto-progress to `ProductWithheld` or wait for explicit decision? | **Explicit decision.** Matches CEO-decision-record pattern; auto-progress would bypass governance. Substrate emits `ProductDueDiligenceCompleted { gatesFailed[] }`, lifts a Decisions-for-CEO card, and waits. |
| **Q5** | Material change to a product — `ProductVersionPublished` on same `productId`, or new `productId`? | **Same `productId` with version increment.** Preserves continuity (position projections, sub-ledger postings, conditions) under a stable URN; a new `productId` is reserved for genuinely new products. |

## Authorised work — Targeted budget, pre-M2

- **Slice 1 — Product type definition** (Atlas + Kai). Author `prototype/platform/markets/products/types.ts` per §2; Zod-validated; tested with M1 listed-equity fixture. Exit: type compiles; M1 fixture round-trips through Zod parse; substrate-state surfaces `productId` count.
- **Slice 2 — Product-lifecycle event family** (Atlas). Register the 12 event types from §4 of the proposal in `event-types.ts` + `registry.ts`; subscribers + replay-fold + retention metadata per D-EVENT-STORE-SCALING Slice 1. Exit: all 12 land in registry; Vera's `runtime-handler-sync` recon green; 12 entries surface in dashboard substrate-state.
- **Slice 3 — Composition runtime** (Kai). Implement `composeProduct(primitives, extensions): ProductTemplate` in `prototype/platform/markets/products/`; M1 listed-equity + M2 SAGB-bond fixtures compose deterministically. Exit: unit tests green; both fixtures compose through one path.

Slices 4–8 sequence after D-NEW-PRODUCT-APPROVAL-POLICY procedures land (Slice 4 policy-attestation runtime; Slice 5 M1 end-to-end attestation; Slice 6 M2–M4 design-attestations; Slice 7 per-dimension agent extensions where substrate gaps remain; Slice 8 Vera attestation-integrity recon). Each requires a fresh authorisation card at its sequencing point.

## Follow-on routes recorded

- `agent:Atlas (Core banking platform architect) + agent:Kai (Trading systems engineer)` — execute Slices 1–2 in sequence; the 12 lifecycle events register against D-EVENT-STORE-SCALING Slice 1's retention-metadata field per Principle 6 single-graph.
- `agent:Kai (Trading systems engineer)` — execute Slice 3 (composition runtime) once Slices 1–2 land; M1 + M2 fixtures compose deterministically.
- `agent:Saskia (Head of Global Markets)` — Slice 5 lead: schedule M1 first-product attestation (`prd:bank:equity:jse-equity-cash`) once Slices 1–4 land; this is the substrate's first end-to-end policy run.
- `agent:Vera (Internal audit engineer)` — author the attestation-integrity recon in `@platform/recon/` (Slice 8): every `ProductApproved` is preceded by 14 `ProductDimensionAttested` for the same `productId @ version`; orphan attestations and missing dimensions are findings; lifecycle-stage transitions match the event sequence.
- `agent:Owen (Company Secretary, governance)` — register the five planned procedures cited in §9 of the brief into the procedures index: `new-product-due-diligence.md`, `product-controlled-launch.md`, `product-post-implementation-review.md`, `product-retirement-migration.md`, `event-schema-evolution.md`. Each cites D-NEW-PRODUCT-APPROVAL-POLICY parent and, where relevant, the obligations-register URN.
- `agent:Mira (Compliance / RegTech engineer)` — bind `[register: route to Mira]` items: confirm Banks Act Reg 39 sub-clauses bind on product approval; populate Domain N (M1 markets-foundation citation URNs) and Domain J (markets/trading) URN slugs; cross-link into `_obligations-register.md`. **[done in this PR — `Regulations/_obligations-register.md` v1.11; 3 Domain A Reg-39 rows added (`ORG-PR-24..26`); 6 Domain J URN-slug rows added (`ORG-MK-09..14`); URN-slug column populated for all 26 Domain N entries; sequencing-gap surfaced for Owen's parallel /Procedures/by-policy/ PR.]**
- `agent:Anya (Data / analytics engineer)` — semantic-layer entries for `productId`, `productFamily`, `productVersion`, `productLifecycleStage`, and the per-dimension attestation surface so the Product Register projection (D-NEW-PRODUCT-APPROVAL-POLICY) reads cleanly.

## Substrate gaps surfaced (not solved by this decision)

1. **Pricing-model registration** (Nadia (Independent-validation engineer) methodology) — orthogonal; the policy's *model-risk* gate references it, but the registration substrate is Nadia's deliverable. Slice 7 manual-attestation falls back here until Nadia ships.
2. **Counterparty onboarding** (Niko, paused per `project_ai_driven_bank.md`) — products land before customer lifecycle activates. AML and conduct gates run on synthetic counterparty fixtures pre-licence-day.
3. **Cross-product portfolio composition** (e.g. structured products combining IRS + option) — out of scope; M5 territory per `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §3.
4. **Real-time product-level position projection** — Anya's projection runtime per-M-phase; the projection that folds the 12 lifecycle events into per-product positions is a downstream Slice item not in this authorisation.
5. **RWA-delta engine** for the *capital* gate — pending Rohan substrate; capital-impact attestation is design-attested only until built.
6. **Trade-confirmation generators** for M3 — pending Imani (Legal-as-code engineer) clause library M3 deliverable.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; this markdown mirrors. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
