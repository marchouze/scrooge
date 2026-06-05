---
title: "Rules-as-Data Sub-Ledger Accounting (SLA) Engine — Design Spec (Phase 0)"
recordId: "record:documents:bea:sla-engine-rules-as-data-design-spec-phase-0:2026-06-05"
author: "Bea (Accounting & financial reporting engineer, engineering)"
reviewers:
  - "Camille (CFO, finance) — accounting-policy review"
  - "Owen (Company Secretary, governance) — approval-workflow / governance review"
workstream: "WS-SLA-ENGINE"
authority: "D-SLA-ENGINE-RULES-AS-DATA"
phase: "Phase 0 — design spec (review-only; no engine code changes)"
date: "2026-06-05"
status: "draft-for-sign-off"
citations:
  - "D-SLA-ENGINE-RULES-AS-DATA"
  - "Principles/1-events-are-truth.md"
  - "Principles/2-single-graph-discipline.md"
  - "Principles/5-multi-currency-entity-country.md"
  - "D-MARKETS-SCHEMA-FOUNDATION"
  - "D-TRADE-LIFECYCLE-IFRS-CHAIN"
  - "D-REGULATORY-ARCHITECTURE-TWO-PLANE"
---

# Rules-as-Data Sub-Ledger Accounting (SLA) Engine — Design Spec (Phase 0)

**Authority:** `D-SLA-ENGINE-RULES-AS-DATA` (CEO-approved, session-delegation, 2026-06-05).
**Author:** Bea (Accounting & financial reporting engineer, engineering).
**Reviewers (sign-off):** Camille (CFO, finance) for accounting policy; Owen (Company Secretary, governance) for the approval-workflow design.
**Scope of this deliverable:** the **design spec only**. No posting-rule rewrites, no interpreter code. Phase-1+ engine work waits until Marc (CEO) signs off this document.

> This is **completing the declarative turn of an engine that already exists**, not a greenfield build. The four-layer SLA model (Event → Rule → Entry-generation → Posting) is ~70% live in `platform/accounting/`. This spec closes the three structural gaps: (1) the rule is metadata, not the executable artefact; (2) accounts are hard-coded inside rule functions (no resolver); (3) no rule versioning, preview/approval, or runtime reject-loudly.

---

## 0. Context, motivation, and what already exists

### 0.1 Why rules-as-data

Posting logic — the mapping from a business event to its debits and credits — is the single thing an auditor reviews in a regulated sub-ledger. The established SLA pattern (Oracle Fusion Accounting Hub, SAP) makes the **posting rule a versioned, human-readable data artefact**, the engine a pure interpreter, and every posted entry traceable to the exact rule version that produced it. Today our posting logic is buried in code: two hard-coded dispatchers plus a declarative registry (`posting-rule-registry.ts`) that only *describes* the mapping without *executing* it. The artefact the auditor would inspect (the registry) is **not** what runs — they can drift, and the recon guard (`recon:gl-ledger-coverage`) only covers FX.

Marc's two binding choices (this session, CEO authority, recorded as `D-SLA-ENGINE-RULES-AS-DATA`):

1. **Full rules-as-data (YAML/JSON).** Posting rules become declarative templates, not TypeScript functions. We accept the rewrite cost and the loss of hand-written compile-time type-safety — mitigated in §11 via codegen of TS types from the rule JSON-Schema.
2. **Circumstance-conditional generation is a first-class pillar** (§2). The *same* business event must resolve to *different* accounting consequences by context (jurisdiction, entity, accounting framework, regulatory regime, product variant), and must generate entries for **multiple bases simultaneously** (IFRS book + SARB regulatory basis + tax basis).

### 0.2 The four-layer SLA model and its current status

| Layer | Status today | Where it lives |
|---|---|---|
| **Event** (fact; no accounts; minor units + ISO-4217 currency) | ✅ complete | `platform/event-store/types.ts`, `platform/markets/cdm/fx.ts` |
| **Rule** (declarative, keyed `eventType × lifecycle × stage`, + IFRS cite + condition) | ⚠️ metadata only — does not execute | `platform/accounting/posting-rule-registry.ts` (70 entries) |
| **Entry generation** (pure fns → balanced `SubLedgerLeg[]`; balance asserted) | ✅ but **accounts hard-coded** inside the functions | `platform/accounting/posting-rules/*.ts` (6 modules) |
| **Posting** (`SubLedgerPostingEmitted`; lineage via deterministic `event_id`) | ✅ but **no rule version** | `platform/event-store/event-types/fx-accounting.ts` |

### 0.3 The three gaps this spec closes

1. **The rule is not the executable artefact.** Two dispatchers — `platform/accounting/gl-posting-engine.ts` (FX + bond, test-only) and the production `runtime/agents/bea-gl-posting-engine.ts` (all products, if/else chains) — plus the metadata registry. The auditor-facing artefact (registry) is not what runs; they can drift; recon guards FX only.
2. **No account resolver.** Accounts are hard-coded in the rule functions (`receivableAccountFor(currency)` switches in `posting-rules/fx-spot.ts`, with a documented `default → USD slot` fallback that is a Principle 5 blocker). There is no `(entity, product, currency, jurisdiction, representation) → account` localisation layer.
3. **No rule versioning, no preview/approval surface, no runtime reject-loudly.** Supersession is free-text `DEPRECATED` comments; `ctx.dryRun` exists but has no sign-off UI; the engine silently skips unrecognised events (recon catches after, FX-only).

### 0.4 Design tenets (binding on every section)

- **Principle 1 — events are truth.** The interpreter is pure: events in → proposed balanced entries out. Nothing is stored except the `SubLedgerPostingEmitted` events; balances, trial balance, and the GL are *queries*. The rule artefact is reference data (it is *not* an event — it is versioned config the posting events cite by version, mirroring the two-plane regulatory architecture, `D-REGULATORY-ARCHITECTURE-TWO-PLANE`).
- **Principle 2 — single-graph discipline.** Each rule carries a typed citation upward (`cites: [obligation URNs]`) and is itself citable; posted entries trace through `ruleVersion` to the rule, and through `cites` to the regulatory obligation.
- **Principle 5 — multi-currency / multi-entity / multi-country from day one.** Currency is a type-level field on every leg; entity, jurisdiction, and representation key the account resolver; the same logical rule serves SA today and another entity/framework later by resolving different physical accounts.
- **Reject loudly, never silently.** Zero-match → reject; equal-specificity ambiguity → flag; `intentional-no-impact` is the *only* legitimate skip and must be explicit.

---

## 1. Event contract

**No new event ingestion layer.** The SLA engine consumes the existing `Event` envelope (`platform/event-store/types.ts`) and the existing CDM payloads (`platform/markets/cdm/fx.ts` and siblings). This section confirms the contract the engine relies on; it changes nothing.

### 1.1 The fact-only event invariant

A business event is a **structured fact**: it records *what happened*, never *which accounts move*. The accounting consequence is derived by the engine, not carried on the event. Concretely:

- Amounts are in **minor units** (integer cents/equivalent) with an **explicit ISO-4217 currency** on the same object (e.g. `leg.notional.amountMinor` + `leg.payCurrency`). No floats for money; no implicit currency.
- The event carries no `accountId`. (Contrast: `SubLedgerPostingEmitted` — the *consequence* — carries `ACC-NNNN-NNN` leg account IDs. That is correct: the posting is the accounting fact; the trigger is the business fact.)
- The event carries the dimensions the engine needs to build a **context vector** (§2): `entity`, instrument/product identifiers, counterparty references, `as_of` (effective date), and the CDM payload's economic terms.

### 1.2 What the engine reads from an event

For each incoming event the engine extracts:

| Context input | Source on the event |
|---|---|
| `event_type` | `event.type` |
| `entity` | `event.entity` (e.g. `LE-ZA-HOZ-BANK`) |
| `effective_date` | `event.as_of` |
| `instrument_type` / `product_variant` | CDM payload (`productTaxonomy`, `instrumentId`) |
| `currency` (per leg) | CDM payload leg currencies (`payCurrency`, `receiveCurrency`, …) |
| `counterparty/customer classification` | CDM payload counterparty ref → party register lookup |
| economic amounts | CDM payload (`notional.amountMinor`, `realisedPnlDelta`, `unrealisedPnlZarMinor`, …) |

### 1.3 Confirmation

The existing envelope + CDM payloads are sufficient. The engine adds **no fields to trigger events**. The only schema change in the whole programme is to the *consequence* event (`SubLedgerPostingEmitted`, §8) — additive, optional fields for lineage. Trigger events are untouched, so no replay/backfill of the business event stream is required.

---

## 2. Circumstance-conditional rule resolution & parallel accounting representations *(the pillar)*

This is the load-bearing section Marc called out. It defines **two distinct mechanisms** that together let one event produce the right entries for the right basis under the right circumstances.

### 2.1 Mechanism A — context vector → which rule applies

Rule selection keys on a **context vector** assembled from the event (§1.2) plus resolved reference data:

```
context = {
  instrument_type,            // "FX-spot", "bond", "ird-swap", …
  event_type,                 // "FxTradeExecuted", …
  entity,                     // "LE-ZA-HOZ-BANK", …
  jurisdiction,               // "ZA", "GB", … (from entity → legal-entity tree)
  accounting_framework,       // "IFRS" | "SARB-BA-RETURN" | "ZA-TAX" | …  (== representation, see 2.2)
  regulatory_regime,          // "SARB-banks-act" | "PA-prudential" | …
  product_variant,            // "FX-spot-internal" | "FX-spot-client" | …
  counterparty_classification,// "bank" | "corporate" | "sovereign" | "internal-desk"
  effective_date,             // event.as_of (ISO date)
}
```

**Matching.** A rule declares an `applies_to` match expression over a *subset* of the context dimensions (any dimension it does not constrain is a wildcard). Multiple rules may match a given context. Resolution is by **deterministic specificity precedence**:

1. **Specificity score.** Count the number of context dimensions a rule constrains *non-wildcard* (an exact-match constraint scores higher than a set-membership constraint, which scores higher than a wildcard). The rule with the **highest specificity score wins**.
2. **Tie-break order (fixed, declared once in the engine, audited by recon):** `entity` > `jurisdiction` > `product_variant` > `counterparty_classification` > `regulatory_regime` > `instrument_type` > `event_type`. A rule constraining a higher-priority dimension wins a specificity tie. (`accounting_framework` is *not* in the tie-break order because it is the representation selector — §2.2 — and partitions the rule set before matching; two rules competing for the same representation never differ only by framework.)
3. **Effective-date scoping.** Only rules whose `[effective_from, effective_to)` window contains `context.effective_date` are eligible (§6).

**Failure modes (reject loudly — §7):**

- **Zero eligible rules** for a `(representation, context)` pair where a posting is expected → **reject loudly**: emit no posting, raise a typed `SubLedgerPostingRejected` event (new, §7.3) + surface in recon. This replaces today's silent skip.
- **Equal-specificity ambiguity** — two or more eligible rules tie on specificity score *and* tie-break order → **flag, never silently pick**: raise `SubLedgerPostingAmbiguous` (§7.3), post nothing, require a rule-author fix (add a discriminating constraint or an explicit precedence override). Ambiguity is a config bug, not a runtime condition to paper over.
- **`intentional-no-impact`** — the matched rule declares `condition: intentional-no-impact` → explicit skip-with-reason (the memo path, e.g. `FxSettlementInstructed`). This is the *only* legitimate non-posting outcome.

### 2.2 Mechanism B — accounting representations (parallel ledgers)

One event fans out to **N representations**. A *representation* is a complete, independent accounting basis:

| Representation | Basis | Status |
|---|---|---|
| `IFRS` (primary) | IFRS 9 / IAS 21 — the bank's primary books | exists today (all current postings) |
| `SARB-BA-RETURN` (secondary) | SARB regulatory-reporting basis (BA-return classification) | added Phase 4 |
| `ZA-TAX` (secondary) | SA tax basis (timing/classification differences) | added Phase 4 |

Each representation has **its own rule set, its own balancing assertion, and its own posted entries**. The engine evaluates the active representation set for an event independently: for each representation it runs Mechanism A against that representation's rules, generates a balanced entry, and emits a `SubLedgerPostingEmitted` tagged with `representation` (§8). This mirrors Oracle FAH **primary/secondary ledgers** and the **Basel adoption layer** (shared baseline, localised at the edges per `D-BASEL-CATALOGUE-PILLAR-1`).

**Why representations, not branches inside one rule.** "Differing regulatory requirements" is satisfied *structurally* — by parallel rule sets — rather than by `if (basis === "tax")` branching inside a single rule. A tax-basis change touches only tax-representation rules; the IFRS rule is byte-for-byte unchanged. This is the same temporal/independence discipline the regulatory knowledge graph already uses.

**Additivity (critical migration guarantee).** Existing books **are** the IFRS primary representation. Additional representations are *additive*: turning on `SARB-BA-RETURN` adds new postings tagged with that representation; it does **not** change a single existing IFRS posting. (Recon enforces this — §10.)

### 2.3 Mechanism C — regulatory-graph linkage

Each rule carries `cites: [obligation URNs]` — the Plane-A reference-data obligations it implements (two-plane regulatory architecture, `D-REGULATORY-ARCHITECTURE-TWO-PLANE`, `d0430225`). Example: `PR-FX-001` cites `urn:obligation:...:ifrs9:3.1.1` (trade-date recognition). Because the rule is data and the citation is a typed edge, a change in a regulatory requirement **traces forward** to the exact rules — and, via `ruleVersion` on posted entries (§8), to the exact posted entries — it affects. This closes the single-graph loop (Principle 2): obligation → rule → posting → trial balance → regulatory cell.

---

## 3. Rule format (YAML/JSON)

A posting rule is a declarative template. Authored in YAML (human review) and compiled/validated to JSON (engine consumption); the JSON-Schema (§11) is the canonical contract from which TS types are generated.

### 3.1 Schema (fields)

```yaml
rule_id: string                 # stable, e.g. "PR-FX-001"
representation: string          # which basis: "IFRS" | "SARB-BA-RETURN" | "ZA-TAX" | …
version: integer                # monotonic; supersede-never-edit (§6)
effective_from: date            # ISO date inclusive
effective_to: date | null       # ISO date exclusive; null = open-ended
applies_to:                     # context-vector match expression (Mechanism A)
  event_type: string            # required exact-match
  instrument_type?: string | string[]
  entity?: string | string[]
  jurisdiction?: string | string[]
  regulatory_regime?: string | string[]
  product_variant?: string | string[]
  counterparty_classification?: string | string[]
  conditions?: [Predicate]      # extra boolean predicates over event payload (§4)
condition:                      # WHEN a posting is expected (ported from registry)
  kind: "always" | "non-zero-delta" | "non-zero-pnl" | "intentional-no-impact"
  detail?: string               # IFRS citation / plain-text reason
lines:                          # the journal template
  - account: AccountResolverRef # logical account ref → resolver (§5)
    side: "debit" | "credit"
    amount: AmountExpression    # sandboxed expression (§4)
    when?: Predicate            # optional per-line predicate (line fires only if true)
balancing: "assert_zero"        # DR == CR per currency, asserted by engine (§7)
cites: [string]                 # obligation URNs (Mechanism C)
supersedes?: string             # rule_id@version this replaces (§6)
notes?: string
```

**Notes on key fields:**

- `representation` partitions the rule set (§2.2). Matching (§2.1) runs *within* a representation.
- `condition.kind` ports the four registry conditions verbatim, preserving today's semantics: `always`, `non-zero-delta`, `non-zero-pnl`, `intentional-no-impact`.
- `lines[].when` is the **per-line predicate** — a line fires only when its condition holds. This expresses, in data, the branching that today lives in TS `if` blocks: e.g. the ECL line that fires only at stage ≥ 2, or the OCI-vs-P&L split by IFRS-9 classification. A rule with conditional lines must still satisfy `balancing: assert_zero` for *whichever* lines actually fire (the engine asserts post-predicate-evaluation).
- `account` is a **logical** reference (e.g. `fx.receivable`, `fx.unrealised_pnl`), resolved to a physical `ACC-NNNN-NNN` by the resolver (§5) keyed on the context vector + representation. Logical refs are what keeps one rule portable across entities/currencies.

### 3.2 Worked example — live FX trade-booking, one event → two representations

The proving ground is the **most-exercised live path**: `FxTradeExecuted` (FX spot). (FX, not loans — the bank has no loans until licence-day; FX is the path with real production volume.) This worked example shows **one event producing IFRS-basis entries *and* a differing regulatory-basis entry**.

**Source event (fact only):** `FxTradeExecuted` for an internal FX-spot trade, near leg, bank buys USD / sells ZAR: `payCurrency=ZAR`, `receiveCurrency=USD`, `notional.amountMinor` (ZAR) and `counterNotional.amountMinor` (USD).

#### IFRS primary representation — `PR-FX-001@v1` (ports today's `fxTradeBookingJournals`)

```yaml
rule_id: PR-FX-001
representation: IFRS
version: 1
effective_from: 2026-01-01
effective_to: null
applies_to:
  event_type: FxTradeExecuted
  instrument_type: FX-spot
  entity: LE-ZA-HOZ-BANK
  jurisdiction: ZA
condition: { kind: always, detail: "IFRS 9 §3.1.1 — recognition on trade date" }
lines:
  # pay-leg sub-entry (natural-side convention): Dr Receivable[payCcy] / Cr Payable[payCcy]
  - { account: fx.receivable, side: debit,  amount: "abs(event.near.notional.amountMinor)" }   # currency = payCurrency
  - { account: fx.payable,    side: credit, amount: "abs(event.near.notional.amountMinor)" }
  # receive-leg sub-entry: Dr Receivable[recvCcy] / Cr Payable[recvCcy]
  - { account: fx.receivable, side: debit,  amount: "abs(event.near.counterNotional.amountMinor)" } # currency = receiveCurrency
  - { account: fx.payable,    side: credit, amount: "abs(event.near.counterNotional.amountMinor)" }
balancing: assert_zero
cites: ["urn:obligation:...:ifrs9:3.1.1", "urn:obligation:...:ias21:21"]
```

Resolver (§5) maps `fx.receivable` for `(LE-ZA-HOZ-BANK, FX-spot, ZAR, ZA, IFRS)` → `ACC-2100-001`, for USD → `ACC-2100-002`; `fx.payable` ZAR → `ACC-2100-003`, USD → `ACC-2100-004`. **This reproduces today's postings exactly** (the byte-for-byte regression target, §11). The leg currency is taken from the resolved payCurrency/receiveCurrency of the matched leg; the amount-expression yields the minor-unit integer; the engine asserts DR == CR within ZAR and within USD.

#### Regulatory secondary representation — `PR-FX-001-BA@v1` (a *differing* basis)

The SARB BA-return regulatory basis classifies an internal FX-spot booking differently from the IFRS trading-receivable/payable split — it lands the gross open position into the regulatory **net-open-position memorandum** classification rather than the IFRS trading sub-ledger. The *same source event* produces a *different* entry:

```yaml
rule_id: PR-FX-001-BA
representation: SARB-BA-RETURN
version: 1
effective_from: 2026-01-01
effective_to: null
applies_to:
  event_type: FxTradeExecuted
  instrument_type: FX-spot
  entity: LE-ZA-HOZ-BANK
  jurisdiction: ZA
  regulatory_regime: SARB-banks-act
condition: { kind: always, detail: "SARB BA-return — FX net open position memorandum classification" }
lines:
  - { account: reg.nop_long,  side: debit,  amount: "abs(event.near.counterNotional.amountMinor)" } # USD long
  - { account: reg.nop_short, side: credit, amount: "abs(event.near.counterNotional.amountMinor)" }
balancing: assert_zero
cites: ["urn:obligation:...:sarb:ba350:nop", "urn:obligation:...:reg:banks-act:exposure"]
```

Here the resolver maps `reg.nop_long` / `reg.nop_short` under the `SARB-BA-RETURN` representation to a **different physical account range** (the BA-350 NOP memorandum accounts) than the IFRS trading accounts. One `FxTradeExecuted` event therefore yields **two** `SubLedgerPostingEmitted` events: one tagged `representation: IFRS` (the trading-book recognition), one tagged `representation: SARB-BA-RETURN` (the regulatory NOP memo). Each balances independently. This is "differing regulatory requirements" satisfied structurally.

> A tax-basis (`ZA-TAX`) rule would be authored the same way — e.g. recognising the spread component on a different timing basis — and would emit a third, independently-balanced posting. The mechanism scales to N bases without touching the IFRS rule.

---

## 4. Amount-expression language

`amount` (and `when` predicates and `conditions`) are written in a **restricted, sandboxed expression language** over the event payload and the context vector. This is where rules-as-data earns its auditability: **no arbitrary code execution.**

### 4.1 Grammar (EBNF sketch)

```
expr      := term (("+" | "-") term)*
term      := factor (("*" | "/") factor)*
factor    := number | path | func "(" args ")" | "(" expr ")" | "-" factor
path      := "event" ("." ident | "[" string "]")+    -- payload access, read-only
           | "context" "." ident                       -- context-vector access, read-only
args      := expr ("," expr)*
func      := "abs" | "min" | "max" | "neg" | "if"      -- closed allow-list
predicate := expr cmp expr | predicate ("&&" | "||") predicate | "!" predicate
cmp       := "==" | "!=" | ">" | ">=" | "<" | "<="
```

### 4.2 Evaluation semantics

- **Money is integer minor units.** All arithmetic is integer (BigInt-backed to survive deep-EM notionals beyond 2^53 — the same concern `MissedExpectedReceipt.expectedAmountMinor` already handles by storing minor amounts as strings). Division is integer division with an explicit rounding mode (`half-even`, banker's rounding) declared at engine level; any non-exact division in a money context must be flagged at rule-validation time unless a rounding mode is specified.
- **Currency-safe.** Each `line` resolves to exactly one currency (from the resolved leg or an explicit `currency` ref); the engine refuses to add amounts across currencies inside one expression. Cross-currency translation is *not* done in the expression language — it is an explicit `context`-supplied rate input (e.g. `context.zarRate`) multiplied by a same-currency amount, mirroring how `FxPositionRevalued` already carries `zarRateBase`/`zarRateQuote`.
- **Pure & total.** No side effects, no I/O, no loops, no user-defined functions. `if(cond, a, b)` is the only conditional. Every expression terminates. Unknown paths (`event.foo` where `foo` is absent) → **rule-validation error** (caught at authoring/CI, not runtime) where the path is statically required; a genuinely-optional path must use `if(exists(event.foo), …, …)`.
- **Sandbox boundary.** The evaluator is a hand-written tree-walker over the parsed AST. It never `eval`s, never touches the filesystem, network, clock, or `Math.random`. This is auditable line-by-line and is the security boundary (Principle 4): a malicious or buggy rule can at worst produce a wrong (but balanced, or loudly-rejected) number — never execute code.

---

## 5. Account resolver

The resolver is the **localisation layer** (Principle 5): it maps a *logical* account reference to a *physical* `ACC-NNNN-NNN`, keyed on the context.

### 5.1 Key and table format

```
key   = (entity, product, currency, jurisdiction, representation, logical_account)
value = ACC-NNNN-NNN
```

Resolver entries are data (YAML/JSON), sourced from and validated against `platform/accounting/coa-registry.ts` (which already carries `entityScope`, `currency`, and per-account metadata). Example rows:

| entity | product | currency | jurisdiction | representation | logical | → physical |
|---|---|---|---|---|---|---|
| LE-ZA-HOZ-BANK | FX-spot | ZAR | ZA | IFRS | `fx.receivable` | ACC-2100-001 |
| LE-ZA-HOZ-BANK | FX-spot | USD | ZA | IFRS | `fx.receivable` | ACC-2100-002 |
| LE-ZA-HOZ-BANK | FX-spot | ZAR | ZA | IFRS | `fx.payable` | ACC-2100-003 |
| LE-ZA-HOZ-BANK | FX-spot | USD | ZA | IFRS | `fx.unrealised_pnl` | ACC-2100-005 |
| LE-ZA-HOZ-BANK | FX-spot | USD | ZA | SARB-BA-RETURN | `reg.nop_long` | ACC-7xxx-xxx |

### 5.2 Lookup precedence

Resolution walks from most-specific to least-specific, **falling back only along declared axes**:

1. Exact `(entity, product, currency, jurisdiction, representation, logical)`.
2. Currency wildcard within the same `(entity, product, jurisdiction, representation, logical)` — for genuinely multi-currency pool accounts only.
3. **No silent default.** If no row resolves, the resolver **rejects loudly** (`SubLedgerPostingRejected`, §7.3) — it does **not** fall back to a "USD slot" stub. This directly retires the `default → RECEIVABLE_USD` fallbacks in `fx-spot.ts`, which are documented Principle-5 blockers (they silently mis-book any non-ZAR/USD currency to the USD account).

### 5.3 Per-representation physical mapping

The same logical account maps to **different physical accounts per representation**: `fx.receivable` under `IFRS` → `ACC-2100-001` (trading sub-ledger); the regulatory representation maps its own logical accounts to the BA-return memorandum range. This is what lets one rule set serve the IFRS book while a parallel set serves the regulatory return, both from the same event.

---

## 6. Versioning & temporal reproducibility

### 6.1 Supersede, never edit

A rule is immutable once effective. A change is a **new version**: `version: n+1` with its own `effective_from`, and `supersedes: PR-FX-001@v1`. The prior version's `effective_to` is set to the new version's `effective_from` (left-closed, right-open intervals — no gaps, no overlaps; recon asserts this, §10). The rule registry is therefore an append-only, version-stamped artefact — the same discipline the regulatory knowledge graph and the decisions register already follow.

### 6.2 Effective periods scoped per representation

Effective windows are **per representation**. A `SARB-BA-RETURN` rule can change on a regulator's effective date (e.g. a BA-return reclassification) **without touching the IFRS rule**. The two bases evolve on independent timelines — which is exactly why representations are parallel rule sets, not branches.

### 6.3 Temporal reproducibility

An entry posted last period must be **reproducible from the rule version in force then**. Because (a) rules are version-stamped and effective-date-scoped, (b) the posting carries `ruleVersion` (§8), and (c) the event store is append-only, replaying the original event through the rule version cited on its posting reproduces the original entry byte-for-byte. This is the audit guarantee: "show me why this entry was booked" resolves to a specific rule version + a specific event + a specific resolver state, all reproducible.

---

## 7. Entry-generation engine (interpreter)

### 7.1 Contract

```
interpret(event, activeRepresentations, asOf) -> ProposedPosting[]
```

Pure function. Events in → **proposed balanced entries out, per representation**. No side effects, no event emission — proposal only. The post step (§8) is explicit and separate. One source event yields **zero or more** `ProposedPosting`s (one per representation that matched a posting-producing rule).

### 7.2 Algorithm (per event, per active representation)

1. Build the context vector (§1.2).
2. Filter the representation's rules to those eligible by `applies_to` match + effective-date window (§2.1).
3. Resolve by specificity precedence (§2.1). Zero → reject (§7.3); ambiguous → flag (§7.3); `intentional-no-impact` → explicit skip-with-reason.
4. For the winning rule: evaluate `condition.kind` (skip if `non-zero-delta`/`non-zero-pnl` and the relevant amount is zero); evaluate each `lines[].when` predicate; for firing lines, resolve `account` (§5) and evaluate `amount` (§4).
5. **Assert balance** (`balancing: assert_zero`): DR == CR **per currency**, computed over the lines that actually fired. A non-balancing result is an **engine-level hard error** (rule bug) — reject loudly, never post an unbalanced entry.
6. Emit a `ProposedPosting` carrying `{ representation, ruleId, ruleVersion, legs, resolverDecisions, cites }`.

### 7.3 Reject-loudly (replaces today's silent skip)

Three new typed outcomes make non-posting first-class and visible (consumed by recon §10 and the preview surface §9):

- `SubLedgerPostingRejected` — zero eligible rules, or a resolver miss, where a posting was expected. Payload: source event id, representation, context vector, reason. **No** GL movement; surfaced as a recon finding.
- `SubLedgerPostingAmbiguous` — equal-specificity tie. Payload: candidate rule ids + the tie detail. **No** GL movement; requires a rule-author fix.
- `intentional-no-impact` skips are recorded with their `condition.detail` (the existing memo path, e.g. `FxSettlementInstructed`) so they read as "intentionally zero", not "missing — substrate gap". This preserves the current `PR-FX-INSTRUCT` / `PR-FX-REGREPORT` semantics in data.

---

## 8. Posting + lineage

### 8.1 Extend `SubLedgerPostingEmitted` (additive, optional)

The post step turns each approved `ProposedPosting` into a `SubLedgerPostingEmitted` event. The schema (`platform/event-store/event-types/fx-accounting.ts`) gains **additive, optional** fields (the `.passthrough()` schema already tolerates extras; we formalise them):

| New field | Type | Meaning |
|---|---|---|
| `representation` | `"IFRS" \| "SARB-BA-RETURN" \| "ZA-TAX" \| …` | which basis this posting serves (defaults to `IFRS` for legacy/back-compat) |
| `ruleId` | string | the rule that produced it (e.g. `PR-FX-001`) |
| `ruleVersion` | integer | the exact version (temporal reproducibility, §6) |
| `resolverDecisions` | `{ logical, key, physical }[]` | which context inputs picked which physical account |
| `cites` | string[] | obligation URNs from the rule (regulatory-graph linkage, §2.3) |

All optional → **no replay/backfill of existing postings required**; existing events read as `representation: IFRS` (the additivity guarantee, §2.2). The `sourceEventId` + deterministic `event_id` lineage stays exactly as today.

### 8.2 One event → several postings

One source event may yield **several** `SubLedgerPostingEmitted` events — one per representation. The `sourceEventId` is shared; `representation` + `ruleId` disambiguate. Idempotency keys extend from today's `${sourceEventId}:${postingType}` to `${sourceEventId}:${representation}:${ruleId}:${ruleVersion}` so re-runs across representations don't collide or double-post.

### 8.3 Immutability

Postings are immutable (Principle 1). A correction is a new posting (the existing `*-correction` posting types), never an edit. Lineage is the audit trail.

---

## 9. Dry-run / preview / approval

### 9.1 Dry-run (already partially present)

The interpreter is pure (§7), so dry-run is its default mode: `interpret(...)` returns `ProposedPosting[]` and emits nothing. This generalises the existing internal `ctx.dryRun`.

### 9.2 Preview surface

A read API route + dashboard surface shows the **proposed journal for every representation** for a given event (or batch), side-by-side: IFRS entry, regulatory entry, tax entry — each with its rule id/version, resolved accounts, `resolverDecisions`, balance check, and `cites`. This is the auditor/CFO inspection point. It reuses the existing `ProductProposal`/`ProductApproval` pattern in `dashboard/products-view.ts` (`ProductProposalRegistered` events; `ProductApprovalStatus = pending | approved | withheld`).

### 9.3 Approval before commit

For rule *activation* (a new rule or version going live), an explicit **approval event** is required before the rule is eligible in the live interpreter — mirroring `ProductApproval`. Proposed flow: rule authored → `SlaRulePublished` (pending) → preview reviewed by CFO seat (accounting policy) / Owen (governance) → `SlaRuleApproved` (or `withheld`) → rule eligible from its `effective_from`. (Posting of *individual entries* under an already-approved rule does not require per-entry approval — that would defeat autonomy, Principle 6; approval gates the *rule*, not every booking.)

> **Flagged for CFO/Owen at sign-off (§9.3):** who approves a *rule* vs a *representation activation*. Recommendation: rule-version activation → CFO seat (accounting policy, per the decision-authority routing table: "IFRS accounting policy → CFO"); new *representation* activation (e.g. turning on the SARB regulatory basis) → CFO + Owen jointly (it spans accounting policy and the governance/approval workflow). This is a sign-off decision, not an engineering one.

---

## 10. Recon

### 10.1 Extend `gl-ledger-coverage` to all products and all representations

Today `platform/recon/gl-ledger-coverage.ts` covers FX only. The rewrite extends it to **all product families and all representations**:

- **Per-representation balancing.** Every `SubLedgerPostingEmitted` balances DR == CR per currency *within its representation*.
- **Coverage.** Every mandatory rule (condition ≠ `intentional-no-impact`) that *should* fire for the observed event stream produced a posting (or a loud `SubLedgerPostingRejected`/`SubLedgerPostingAmbiguous` with a tracked reason) — for each active representation.
- **Additivity invariant.** Turning on a secondary representation did not change any `representation: IFRS` posting (regression of the byte-for-byte guarantee, §2.2).

### 10.2 Drift becomes structurally impossible

Because **the registry *is* the engine** (the interpreter executes the rule data directly), registry↔engine drift cannot occur — there is no second hard-coded dispatcher to drift from. The recon's job shifts from "does the engine match the registry?" (a class of bug we delete) to "is the rule data internally consistent and fully covering?".

### 10.3 Rule-version coverage + keep the stub audit

- Add **rule-version coverage**: every posted `ruleVersion` exists in the rule registry; every effective-window is gap-free and overlap-free per representation (§6.1).
- **Keep** `recon-posting-rule-stub-audit.ts` — the stub classification (Category A/B/C) remains the live-vs-deferred audit for trigger event types not yet wired.

---

## 11. Migration path + type-safety mitigation

### 11.1 How the 6 typed-function modules port to data templates

Each function in `posting-rules/*.ts` becomes one or more rule templates (one per `representation`). The hard-coded account constants (`FX_ACCOUNTS`, the `receivableAccountFor` switches) become **resolver rows** (§5). The `if (delta === 0) return []` guards become `condition.kind` (`non-zero-delta`); the in-function branches (gain vs loss, stage-2 ECL, OCI-vs-P&L) become `lines[].when` per-line predicates (§3.1). The `default → USD slot` fallbacks are *deleted* — replaced by loud resolver rejection (§5.2).

### 11.2 The two dispatchers collapse into one interpreter

`platform/accounting/gl-posting-engine.ts` (FX+bond, test-only) and `runtime/agents/bea-gl-posting-engine.ts` (production, if/else chains) both retire. One interpreter (§7) executes the rule registry. The production agent keeps its subscription + idempotency-guard shell, but its `if/else` body is replaced by a call to `interpret(...)`.

### 11.3 Parallel-run regression (the safety net)

FX first. The interpreter runs **in parallel** with the existing engine and the IFRS-representation output is reconciled **byte-for-byte** against the existing FX postings on the same event stream (fixtures: event → asserted entries). No dispatcher is retired until parallel-run is green for that family. This is the non-negotiable gate.

### 11.4 Type-safety mitigation — codegen TS types from the rule JSON-Schema

This directly answers the downside Marc accepted (loss of compile-time type-safety when rules leave TS). The rule JSON-Schema (§3) is the canonical contract; a codegen step **generates TS types** from it (`SlaRule`, `AccountResolverRef`, `AccountId` as a string-literal union of the COA leaf IDs, leg shapes). Leg construction and account IDs stay **statically checked** despite rules living as data: a rule referencing a non-existent logical account, or a malformed leg, fails at compile/CI time, not in production. The codegen runs in CI (full `tsc --noEmit` gate); a rule-schema change that breaks a downstream type is caught in the same PR.

### 11.5 Additivity

Existing books are the IFRS primary representation; additional representations are *additive* (no change to current postings — §2.2). Phase 4 adds the first secondary representation to prove circumstance-conditional fan-out end-to-end.

---

## 12. Phased build sequence (governs Phase 1+; not part of this deliverable)

- **Phase 0 — Spec + sign-off.** *(this document)*. Reviewable design doc; CFO + Owen review recorded; the eventual engine build logged as the already-recorded `Decision` `D-SLA-ENGINE-RULES-AS-DATA` (engineering build → CEO authority, build phase).
- **Phase 1 — Schema + interpreter core + resolver + dry-run.** Rule JSON-Schema (incl. `representation` + context-vector match) + interpreter core + account resolver + dry-run. Pure, no behaviour change; runs **in parallel** with the existing engine, generating only the **IFRS primary representation** at first.
- **Phase 2 — Port FX + byte-for-byte regression.** Port FX rules to data templates; reconcile the IFRS-representation output **byte-for-byte** against the existing FX postings on the same event stream (regression suite: event fixtures → asserted entries).
- **Phase 3 — Remaining families; retire dispatchers.** Port bond, equity, IRS, repo, deposit, funding, interbank; retire both hard-coded dispatchers; registry-as-engine.
- **Phase 4 — Versioning + preview/approval UI + recon-all + reject-loudly + first additional representation.** Structured versioning + preview/approval UI + extend recon to all products + runtime reject-loudly + **add the first additional representation** (SARB regulatory or tax basis) to prove circumstance-conditional fan-out end-to-end.

---

## 13. Open items flagged for CFO / Owen sign-off

1. **Rule vs representation approval authority (§9.3).** Rule-version activation → CFO seat (IFRS accounting policy). New *representation* activation → CFO + Owen jointly. Confirm.
2. **First secondary representation (§2.2, Phase 4).** Which goes first — `SARB-BA-RETURN` (regulatory) or `ZA-TAX`? Recommendation: `SARB-BA-RETURN`, because the FX NOP worked example (§3.2) already grounds it and it exercises a different physical account range most cleanly.
3. **Rounding mode for money division (§4.2).** Recommendation: banker's rounding (`half-even`) engine-wide, with any non-exact division flagged at rule-validation. Confirm the accounting-policy default.
4. **Retention/classification of the rule registry artefact.** As a governance-significant artefact (it *is* the posting policy), recommend Companies-Act-71-2008-§24 7-year retention, same as decisions. Confirm with Owen.

---

*Render of RMS `RecordFiled` event `record:documents:bea:sla-engine-rules-as-data-design-spec-phase-0:2026-06-05`. The event is canonical (Principle 1); this markdown is the derived render.*
