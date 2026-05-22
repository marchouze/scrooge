# URN vocabulary — canonical register

**Curator:** Owen (Company Secretary, governance) · **Date:** 2026-05-22 · **Version:** 1.0

> v1.0 — **Initial register.** Owen (Company Secretary, governance) lands the canonical URN-class vocabulary under CEO decision `D-URN-CANONICAL-VOCABULARY` (CEO-approved 2026-05-22 via session delegation; event `3a3deae9-4274-46b0-9d0b-5208fbdb84a1`). The eleven classes below cover every URN form currently used (or proposed for near-term use) across the bank's substrate. Source seeds: `feedback_canonical_source_registry.md` (memory; Owen-authored 2026-05-07); existing `urn:obligation:bank:...` callsites; existing `urn:party:natural-person|legal-entity:...` callsites in `Regulations/_party-register.md`; Atlas's GAP-CAPABILITY-PATH-VS-TS-PATH brief (resolved by `urn:capability:bank:<canonical-path-slug>` in this register). Companion executable artefact: `prototype/platform/citation/urn.ts` (Zod-schema-encoded slug rules + `parseUrn`). Companion advisory recon: `recon:urn-shape` (`prototype/platform/recon/urn-shape.ts`).

## How to read

Every URN follows the shape `urn:<class>:<scope>:<slug>` where:

- `urn:` — fixed RFC-8141 prefix.
- `<class>` — one of the eleven values in the table below.
- `<scope>` — typically `bank` for bank-authored artefacts; for shared registers the scope identifies the sub-namespace (e.g. `natural-person` under `urn:party:`).
- `<slug>` — the class-specific identifier; the **slug-rule** column below specifies the precise grammar (a regex anchored at both ends).

Authority for each class is either (a) a CEO decision that introduced the class, (b) an antecedent register that already used the form, or (c) an external standard the bank inherits (e.g. RFC 8141). `status` is one of `in-force` / `proposed` / `deprecated`. Anything marked `proposed` carries enough vocabulary to start using; consumers should expect minor slug-rule tightening before promotion to `in-force`.

The executable schemas in `prototype/platform/citation/urn.ts` are the **operational source of truth** for slug-rule enforcement; the table below is the human-readable expression of those schemas. Drift between the two is a Vera (Internal audit / continuous-assurance engineer) finding (the `recon:urn-shape` pipeline asserts shape conformance and surfaces violations against this register).

## Canonical URN classes

| prefix | slug-rule | example | authority | status |
|---|---|---|---|---|
| `urn:reg:` | `urn:reg:<jurisdiction>:<instrument-slug>[:<provision-slug>]` — jurisdiction is a lowercase ISO-3166 alpha-2 or short jurisdictional code (`za`, `bcbs`, `iosco`); instrument and optional provision are lowercase slugs permitting digits, dot, slash, underscore, hyphen. Used to cite regulatory instruments and specific provisions inside them. | `urn:reg:za:banks-act-94-1990:s.60` · `urn:reg:bcbs:bcbs-239` · `urn:reg:za:fic-act-38-2001:s.42` | D-URN-CANONICAL-VOCABULARY (this register); seed: SARB / FSCA / FIC instrument-naming convention already used in `Regulations/` subfolders | in-force |
| `urn:obligation:` | `urn:obligation:bank:<tranche>:<instrument-slug>(:<...>)*:v<n>` — tranche is a register-defined cluster (`m1`, `risk`, `prudential`, `fx`, `fais`, etc.); instrument and optional sub-slugs lowercase; trailing `v<n>` version. | `urn:obligation:bank:m1:operational-cyber:joint-standard-2-2024-cyber:v1` · `urn:obligation:bank:risk:b-cluster-fx-settlement-concentration:v1` | Pre-existing — formalised here; live since obligations-register v1.0 (Mira (Compliance / RegTech engineer) curated; Zara (Chief Compliance Officer, governance) accountable) | in-force |
| `urn:policy:` | `urn:policy:bank:<slug>:v<n>` — slug is lowercase, hyphen-separated, optional dot-segments for sub-policy. Version suffix mandatory. | `urn:policy:bank:capital-management:v1` · `urn:policy:bank:valuation:v1` · `urn:policy:bank:fx.market-conduct:v1` | D-URN-CANONICAL-VOCABULARY; seed: `Policies/_index.md` filename convention already enforced via `feedback_canonical_source_registry.md` | in-force |
| `urn:procedure:` | `urn:procedure:bank:<slug>` — slug is lowercase; permits hyphen, dot, slash, underscore for sub-procedure hierarchies. No version suffix (procedures are mutable working documents; the immutable artefact is the executed run, captured as `AgentRunStarted` / `AgentRunCompleted` events). | `urn:procedure:bank:proc-mk-plg-01` · `urn:procedure:bank:proc-npa-gate-01` · `urn:procedure:bank:proc-risk-clm-01` | D-URN-CANONICAL-VOCABULARY; seed: `Procedures/_index.md` filename convention | in-force |
| `urn:decision:` | `urn:decision:bank:D-<SLUG>` — slug begins with `D-`, followed by alphanumeric (any case), dot, underscore, or hyphen. Maps 1:1 to `Decision.decisionId`. | `urn:decision:bank:D-RMS-PHASE-1` · `urn:decision:bank:D-URN-CANONICAL-VOCABULARY` · `urn:decision:bank:D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22` | D-URN-CANONICAL-VOCABULARY; seed: `Decision` event `decisionId` convention live since `runtime/decisions/record.ts` Slice A | in-force |
| `urn:capability:` | `urn:capability:bank:<canonical-path-slug>` — slug is lowercase, hyphen + dot + slash + underscore permitted, encoding the capability's canonical position in the platform/runtime tree. Resolves Atlas (Core banking platform architect, engineering) GAP-CAPABILITY-PATH-VS-TS-PATH. | `urn:capability:bank:platform/gl/post-journal` · `urn:capability:bank:platform/valuation/mtm-engine` · `urn:capability:bank:runtime/agents/rohan/daily-mtm` | D-URN-CANONICAL-VOCABULARY; seed: Atlas brief `GAP-CAPABILITY-PATH-VS-TS-PATH` | in-force |
| `urn:party:` | `urn:party:<kind>:<slug>` — `<kind>` is one of `natural-person`, `legal-entity`, `counterparty`, `agent`; slug is lowercase, alphanumeric with dot/underscore/hyphen. | `urn:party:natural-person:marc-houze` · `urn:party:legal-entity:hoz-bank-limited` · `urn:party:counterparty:standard-bank-johannesburg` · `urn:party:agent:owen` | Pre-existing — formalised here; live since `Regulations/_party-register.md` v1.0 (`D-PARTY-REGISTER`, CEO-approved 2026-05-11) | in-force |
| `urn:activity:` | `urn:activity:bank:ACT-<CODE>` — `<CODE>` uppercase, hyphen-permitted, matching a row in `Regulations/_activity-taxonomy.md`. | `urn:activity:bank:ACT-TRADE-OTC-IRD` · `urn:activity:bank:ACT-REPORT-PRUDENTIAL` · `urn:activity:bank:ACT-BANK-DEPOSIT` | D-URN-CANONICAL-VOCABULARY; seed: existing `ACT-*` codes in `Regulations/_activity-taxonomy.md` and `Regulations/_obligations-register.md` Activity-scope column | in-force |
| `urn:product:` | `urn:product:bank:<product-code>` — slug lowercase, hyphen-separated, optional dot-segments for sub-product. | `urn:product:bank:fx-spot` · `urn:product:bank:listed-bond` · `urn:product:bank:otc-ird.irs` · `urn:product:bank:repo` | D-URN-CANONICAL-VOCABULARY; seed: product family taxonomy in obligations-register Product-scope column (live since v1.25) | in-force |
| `urn:risk:` | `urn:risk:bank:RT-<CODE>` — `<CODE>` uppercase, hyphen + dot permitted, matching a row in `Regulations/_risk-taxonomy.md`. | `urn:risk:bank:RT-CR.CC` · `urn:risk:bank:RT-LQ.FN` · `urn:risk:bank:RT-OP` · `urn:risk:bank:RT-IRRBB` | D-URN-CANONICAL-VOCABULARY; seed: 94-code risk taxonomy authored 2026-05-11 (`Regulations/_risk-taxonomy.md`) | in-force |
| `urn:event:` | `urn:event:bank:<TypeName>` — `<TypeName>` is the PascalCase TypeScript event-class symbol as registered in `prototype/platform/event-store/registry.ts`. | `urn:event:bank:AgentBriefIssued` · `urn:event:bank:FxTradeBooked` · `urn:event:bank:PositionRevalued` · `urn:event:bank:Decision` | D-URN-CANONICAL-VOCABULARY; seed: event-type registry already keyed by PascalCase TypeName | in-force |

## Notes on near-term extensions

The register lands the eleven classes the substrate actively cites today (or proposes to cite next dispatch). Two adjacent forms are explicitly **not** in this v1.0 register and will be added in subsequent versions if-and-when needed:

- `urn:document:` — RMS document register (`Document` event family) currently uses BLAKE3 content-addressed hashes as identifiers; introducing a `urn:document:bank:<blake3-prefix>` form is a Phase-5 RMS consideration and routed as a substrate-gap candidate to Atlas (Core banking platform architect, engineering).
- `urn:control:` — control register is presently embedded inside policies / procedures (controls are not first-class register rows). Promotion to a first-class URN class waits on a `D-CONTROL-REGISTER` decision (not yet routed).

Both are deliberately deferred; nothing in the current corpus cites them, so adding placeholder rows would create dead vocabulary.

## Substrate gaps surfaced

- **GAP-URN-PROSE-VS-SHAPE.** The `recon:urn-shape` pipeline (advisory) reports the % of citation fields across `Policies/`, `Procedures/`, `Regulations/`, and the event store that are in canonical URN shape vs prose. The expectation under Principle 2 is that every citation eventually resolves to a typed URN; the gap is the journey from prose to URN. Closure surface: Mira (Compliance / RegTech engineer) extracts URNs from prose citations under `WS-INSTRUMENT-ANALYSES`; Owen ratifies; the recon pipeline tracks progress.
- **GAP-URN-VOCABULARY-COVERAGE.** Eleven classes are landed; the register is open to extension. New classes require a `D-URN-VOCABULARY-EXTEND-<NAME>` decision (CEO authority) so the register and the executable schemas evolve together. The recon pipeline asserts that every URN-shaped citation parses against one of the registered classes; an unknown class is a finding, not a silent acceptance.
- **GAP-URN-CITATION-COUNT-PARITY.** The `recon:urn-shape` pipeline counts URN-shaped vs prose citations across artefacts but does not yet count citations *inside* event payloads beyond the top-level `citations` array. Sub-payload citations (e.g. embedded in `Decision.recommendation` prose) are reportable enhancements queued under `GAP-URN-EMBEDDED-CITATIONS` (Vera Wave-5 candidate).

## Authority chain

- CEO decision `D-URN-CANONICAL-VOCABULARY` (approved 2026-05-22 via session delegation; event `3a3deae9-4274-46b0-9d0b-5208fbdb84a1`).
- Backing brief: `brief:owen:canonical-urn-vocabulary-obligations-register-sc:2026-05-22`.
- Authoring run: `run:owen:2026-05-22T07-28-16-178Z`.
- Principle 2 — single-graph discipline (every artefact has one typed citation upward; URN shape is the operational form of that citation).
- Principle 1 — events are truth (the executable URN schemas in `prototype/platform/citation/urn.ts` are the canonical-shape oracle; this markdown register renders the same information for humans).
