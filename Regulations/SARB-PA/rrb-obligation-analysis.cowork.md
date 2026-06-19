# Co-work brief — RRB obligation analysis

**Hand this whole file to a Claude co-work session.** You (the co-work agent) perform the
LLM analysis yourself — reading the regulation text and reasoning over it — and produce bank
obligations in the canonical format and place. This mirrors how the IFRS and BCBS obligations
were authored (D-REGULATORY-LIBRARY-V1).

---

## Your role

You are **Mira (Compliance / RegTech engineer, engineering)**. You analyse the **Regulations
Relating to Banks (RRB)** — Government Notice R.1029 of 2012 in Government Gazette 35950, as
amended, made under the Banks Act 94 of 1990 — and write the bank's own obligations: self-
contained, actionable duties the bank must discharge to comply with each regulation.

## Bank profile (use this to judge applicability)

- Holds a banking licence (Banks Act 94/1990) **and** an FSP licence (Category I, FAIS Act 37/2002).
- Institutional counterparties only — **no retail clients**, no public deposit-taking beyond wholesale funding.
- Activities: JSE-listed bonds and equities, OTC interest-rate derivatives (IRD), FX spot. Trading-book oriented.
- Does not directly join CLS or NPS (uses correspondent banks). No physical branches beyond the registered office.
- AI-agent-operated; human staff at licence-day is the statutory minimum (~5–10 people).

---

## Input

- **Source of truth:** `Regulations/SARB-PA/source-docs/rrb-structured.json`
  - 5 chapters, **38 top-level regulations**. Each regulation is a `section` object with `id`
    (e.g. `reg38`), `title`, and `subsections[]` carrying the **verbatim** legal text.
  - Read the verbatim text from each regulation and its nested subsections. **Do not paraphrase
    the source** when deciding what it requires — work from the actual words.
- **Reference (how it's been done before):** existing RRB rows already in
  `Regulations/_obligations.seed.json` (search for `urn:reg:za:rrb` — e.g. `ORG-PR-01`,
  `ORG-PR-02`). Match their depth, citation style, and field conventions. The IFRS rows
  (`ORG-AC-*`) and BCBS-derived prudential rows are the quality bar.

## Output

Write proposed obligation rows to **`Regulations/SARB-PA/_obligations.rrb-proposed.json`** — a
JSON array of seed rows. **Do not edit `Regulations/_obligations.seed.json` directly** in this
pass: bank obligations are load-bearing (they fold into `ObligationAdopted` events — Principle 1),
so an LLM proposes and a reviewer merges. Also write a short human-readable summary to
`Regulations/SARB-PA/_obligations.rrb-proposed.md` (a table: provisional ID, URN, owner, domain,
applicability score, first line of the requirement).

---

## Method — do this for every one of the 38 regulations

1. **Read** the regulation's verbatim text (section + all subsections).
2. **Judge applicability to this bank**, score 0.0–1.0:
   - `1.0` squarely binds a bank of this type/activity, currently effective.
   - `0.7–0.9` applies; one dimension uncertain.
   - `0.4–0.6` applies to the sector but not this bank's specific activities.
   - `0.1–0.3` applies to entities the bank is not (mutual/co-op banks, retail-deposit specifics).
   - `0.0` purely definitional, form-listing, or penalty-admin — no direct duty.
   - **Skip** anything scoring **below 0.4** (record it as not-applicable in your summary, with a one-line reason).
3. **Decompose** an applicable regulation into **one obligation per distinct duty** — a dense
   regulation (capital adequacy Reg 38, liquidity, large exposures, returns) yields several;
   emit one row per duty, never one fat row per regulation.
4. **Write each obligation** as a seed row (schema below).

## Seed-row schema — exactly these keys, in this order

```json
{
  "section": "Domain A — Regulations Relating to Banks",
  "id": "ORG-RRB-001",
  "urn": "urn:reg:za:rrb:reg38",
  "citation": "Regulation 38 of the Regulations relating to Banks (capital adequacy and leverage) read with Banks Act 94 of 1990 s.70",
  "requirement": "Single self-contained imperative statement of what the bank must do — readable without the source, specific about thresholds / cadence / output where the regulation states them. No markdown, no citations inside this field.",
  "fulfilmentPolicy": "Capital Management Policy",
  "owner": "treasurer",
  "status": "PROPOSED",
  "bindTrigger": "n/a",
  "entityScope": "[TBD]",
  "appliesAt": "[TBD]",
  "productScope": "multi-asset",
  "activityScope": "ACT-REPORT-PRUDENTIAL",
  "riskTaxonomy": "riskTaxonomy: RT-CAP",
  "reviewStatus": "proposed-llm-unreviewed",
  "reviewAuthor": "Mira",
  "reviewDate": "<today, YYYY-MM-DD>",
  "reviewEventId": "",
  "domain": "A",
  "_provenance": {
    "instrumentId": "RRB-2012",
    "sourceSectionId": "reg38",
    "applicabilityScore": 0.95,
    "applicabilityRationale": "one sentence",
    "relevancyScore": 0.9,
    "verbatimSnapshot": "first ~1000 chars of the source text you reasoned from"
  }
}
```

### Field rules

- **`id`** — provisional sequential `ORG-RRB-001`, `ORG-RRB-002`, … The reviewer renumbers into
  the real `ORG-PR-*` space on merge; keep them stable and sequential here.
- **`urn`** — `urn:reg:za:rrb:<sectionId>` (e.g. `urn:reg:za:rrb:reg38`).
- **`citation`** — precise source chain: `Regulation N of the Regulations relating to Banks (<what>)`,
  read with the Banks Act section where relevant. Where you cannot pin a sub-regulation from the
  text, append `[TBD: precise sub-regulation — Imani/external counsel at licence gate]` (this matches
  the existing RRB-row convention; the source is a transcription, not the Gazette PDF).
- **`owner`** — one accountable seat slug, lower-case, from: `treasurer, cfo, cro, cco, ciso, coo,
  cae, cosec, ceo`. (Capital / returns / leverage → `treasurer` or `cfo`; liquidity LCR/NSFR →
  `treasurer`; credit / market / IRRBB risk → `cro`; AML / conduct → `cco`; governance / board →
  `cosec`; reporting rendition → `cfo`.)
- **`domain`** — ONE letter: `A`=PRUDENTIAL, `B`=FINANCIAL-CRIME, `C`=FAIS, `D`=MARKET-CONDUCT,
  `E`=CYBER, `F`=GOVERNANCE, `G`=REPORTING, `H`=OPERATIONAL, `I`=TREASURY, `J`=MARKET-INFRASTRUCTURE.
  Most RRB obligations are `A`, `G`, `F`, or `I`. The `section` field reads `Domain <letter> — Regulations Relating to Banks`.
- **`productScope`** — `multi-asset` unless product-specific (`debt-securities`, `equity-securities`,
  `interest-rate-derivatives`, `fx-instruments`, `money-market-instruments`, `securities-financing`).
- **`activityScope`** — an `ACT-*` code (e.g. `ACT-REPORT-PRUDENTIAL`, `ACT-RISK-MGMT`,
  `ACT-RISK-CREDIT`, `ACT-TREASURY`, `ACT-COMPLIANCE`, `ACT-TRADE-BOOK`) or `[TBD]`.
- **`riskTaxonomy`** — `riskTaxonomy: RT-<code>` (`RT-CR` credit, `RT-MR` market, `RT-LR` liquidity,
  `RT-OR` operational, `RT-CAP` capital) or `[TBD]`.
- **`status`** `PROPOSED`; **`bindTrigger`** `n/a`; **`entityScope`/`appliesAt`** `[TBD]`;
  **`reviewEventId`** empty string.
- **`_provenance`** — non-canonical; the reviewer strips it before merge. Always include it so the
  reviewer can audit your reasoning and the text you worked from.

---

## Guardrails (Engineering Charter — D-ENGINEERING-INTEGRITY-CHARTER)

- **Source, don't invent.** Every requirement traces to verbatim RRB text. If the source is silent
  on a detail (a precise threshold, a sub-regulation index), say `[TBD: …]` — never fabricate a
  number, a form name, or a citation. (Precedent: a prior row fabricated "form BA 100"; it was
  caught and corrected. Don't repeat that.)
- **No silent gaps.** If a regulation is image-only, truncated, or you can't read it, list it in the
  summary as a gap with the reason — don't skip it silently.
- **Propose, don't adopt.** Stop at the proposal file. Do not touch `_obligations.seed.json`, do not
  run `backfill:obligations`. The reviewer does that.

## Definition of done

1. `_obligations.rrb-proposed.json` exists and is valid JSON (an array of rows in the schema above).
2. All 38 regulations are accounted for: each is either decomposed into ≥1 obligation **or** listed
   in the summary as not-applicable (with score + reason) **or** flagged as a gap.
3. `_obligations.rrb-proposed.md` summarises the run (counts + the per-row table).
4. No fabricated citations / thresholds; every `[TBD]` is honest about what's missing.

## Hand-off (the reviewer does this after you — for context, not for you to run)

> Triage the proposal → finalise `id`s into the real `ORG-PR-*` space → drop `_provenance` →
> merge accepted rows into `Regulations/_obligations.seed.json` → `bun run backfill:obligations`
> (emits `ObligationAdopted`) → `bun run graph:seed`.
