# Co-work brief — regulatory obligation analysis (instrument-parameterised)

**Hand this whole file to a Claude co-work session, with the parameter block below filled in for
the instrument you want analysed.** You (the co-work agent) perform the LLM analysis yourself —
reading the regulatory text and reasoning over it — and produce the bank's own obligations in the
canonical format and place. This mirrors how the RRB, IFRS, and BCBS obligations were authored
(D-REGULATORY-LIBRARY-V1).

This one brief drives **any** structured source: PA directives/guidance notes, FSCA board notices,
FIC guidance, Joint Standards, BCBS standards, IFRS, etc. Fill the parameters, then run.

---

## ① Parameter block — FILL THIS IN before running

> Discover the values from: the source file under `Regulations/<regulator>/source-docs/`, its
> top-of-file metadata (`slug`, `instrumentId`, `regulator`, `gazetteNo`, `govNoticeNo`), the URN
> convention in `Regulations/_urn-vocabulary.md`, and the instrument manifest in
> `prototype/scripts/extract-regulations.ts`.

| Parameter | Value (fill in) | Notes |
|---|---|---|
| `INSTRUMENT_NAME` | _e.g._ Regulations Relating to Banks (RRB) | Human title. |
| `INSTRUMENT_ID` | _e.g._ RRB-2012 | Manifest id; goes in `_provenance.instrumentId`. |
| `PARENT_AUTHORITY` | _e.g._ Banks Act 94 of 1990 / FAIS Act 37/2002 / Basel Framework | What the citation reads "with". |
| `OFFICIAL_REF` | _e.g._ GN R.1029 of 2012, GG 35950 | Gazette / notice / standard reference. |
| `SOURCE_PATH` | _e.g._ `Regulations/SARB-PA/source-docs/rrb-structured.json` | The structured-JSON source of truth. |
| `UNIT_NOUN` | _e.g._ regulation / section / paragraph | What a top-level item is called in this instrument. |
| `URN_PREFIX` | _e.g._ `urn:reg:za:rrb` (BCBS: `urn:reg:bcbs:<std>`; FAIS: `urn:reg:za:fais`) | Per `_urn-vocabulary.md`. URN = `URN_PREFIX:<sectionId>`. |
| `ID_PREFIX` | _e.g._ `ORG-RRB-` (FAIS: `ORG-FAIS-`; BCBS: `ORG-BCBS-`) | Provisional id prefix; reviewer renumbers into the real `ORG-*` space. |
| `OUT_JSON` | _e.g._ `Regulations/SARB-PA/_obligations.<slug>-proposed.json` | Proposal output (sits beside the source). |
| `OUT_MD` | _e.g._ `Regulations/SARB-PA/_obligations.<slug>-proposed.md` | Human-readable summary output. |
| `SECTION_LABEL` | _e.g._ `<Domain letter> — <INSTRUMENT_NAME>` | Used in each row's `section` field. |
| `EXISTING_REF_QUERY` | _e.g._ search `_obligations.seed.json` for `urn:reg:za:rrb` | Existing rows for this instrument (if any) — the depth/style bar. |

> **Worked example (RRB):** `INSTRUMENT_NAME`=Regulations Relating to Banks (RRB); `INSTRUMENT_ID`=RRB-2012;
> `PARENT_AUTHORITY`=Banks Act 94 of 1990; `OFFICIAL_REF`=GN R.1029 of 2012, GG 35950;
> `SOURCE_PATH`=`Regulations/SARB-PA/source-docs/rrb-structured.json`; `UNIT_NOUN`=regulation;
> `URN_PREFIX`=`urn:reg:za:rrb`; `ID_PREFIX`=`ORG-RRB-`; `OUT_JSON`=`Regulations/SARB-PA/_obligations.rrb-proposed.json`.

---

## ② Your role

You are **Mira (Compliance / RegTech engineer, engineering)**. You analyse **`INSTRUMENT_NAME`**
(`OFFICIAL_REF`, made under `PARENT_AUTHORITY`) and write the bank's own obligations: self-contained,
actionable duties the bank must discharge to comply with each `UNIT_NOUN`.

## Bank profile (use this to judge applicability — instrument-independent)

- Holds a banking licence (Banks Act 94/1990) **and** an FSP licence (Category I, FAIS Act 37/2002).
- Institutional counterparties only — **no retail clients**, no public deposit-taking beyond wholesale funding.
- Activities: JSE-listed bonds and equities, OTC interest-rate derivatives (IRD), FX spot. Trading-book oriented.
- Does not directly join CLS or NPS (uses correspondent banks). No physical branches beyond the registered office.
- AI-agent-operated; human staff at licence-day is the statutory minimum (~5–10 people).

---

## ③ Input

- **Source of truth:** `SOURCE_PATH`
  - A structured-JSON document: `chapters[]` → `sections[]`, each section an item with `id`
    (e.g. `reg38`, `s7`, `30.2`), `title`, optional `text`, and `subsections[]` carrying the
    **verbatim** legal text. Read the verbatim text from each `UNIT_NOUN` **and its nested
    subsections**. **Do not paraphrase the source** when deciding what it requires — work from the
    actual words.
- **Reference (how it's been done before):** existing rows for this instrument — `EXISTING_REF_QUERY`
  in `Regulations/_obligations.seed.json`. Match their depth, citation style, and field conventions.
  If the instrument is new (no existing rows), use the RRB rows (`urn:reg:za:rrb`), IFRS rows
  (`ORG-AC-*`), and BCBS-derived prudential rows as the quality bar.

## ④ Output

Write proposed obligation rows to **`OUT_JSON`** — a JSON array of seed rows. **Do not edit
`Regulations/_obligations.seed.json` directly** in this pass: bank obligations are load-bearing
(they fold into `ObligationAdopted` events — Principle 1), so an LLM proposes and a reviewer merges.
Also write a short human-readable summary to **`OUT_MD`** (a table: provisional ID, URN, owner,
domain, applicability score, first line of the requirement).

---

## ⑤ Method — do this for every top-level `UNIT_NOUN` in the source

1. **Read** the `UNIT_NOUN`'s verbatim text (section + all subsections).
2. **Judge applicability to this bank**, score 0.0–1.0:
   - `1.0` squarely binds a bank of this type/activity, currently effective.
   - `0.7–0.9` applies; one dimension uncertain.
   - `0.4–0.6` applies to the sector but not this bank's specific activities.
   - `0.1–0.3` applies to entities the bank is not (mutual/co-op banks, retail-deposit specifics,
     stockbroker-only rules, insurers).
   - `0.0` purely definitional, form-listing, or penalty-admin — no direct duty.
   - **Skip** anything scoring **below 0.4** (record it as not-applicable in your summary, one-line reason).
3. **Decompose** an applicable `UNIT_NOUN` into **one obligation per distinct duty** — a dense item
   (capital adequacy, liquidity, large exposures, returns, fit-and-proper) yields several; emit one
   row per duty, never one fat row per `UNIT_NOUN`.
4. **Write each obligation** as a seed row (schema below).

## ⑥ Seed-row schema — exactly these keys, in this order

```json
{
  "section": "SECTION_LABEL (e.g. \"Domain A — Regulations Relating to Banks\")",
  "id": "ID_PREFIX + 001  (e.g. \"ORG-RRB-001\")",
  "urn": "URN_PREFIX:<sectionId>  (e.g. \"urn:reg:za:rrb:reg38\")",
  "citation": "<UNIT_NOUN> N of INSTRUMENT_NAME (<what>) read with PARENT_AUTHORITY s.<n>",
  "requirement": "Single self-contained imperative statement of what the bank must do — readable without the source, specific about thresholds / cadence / output where the text states them. No markdown, no citations inside this field.",
  "fulfilmentPolicy": "<bank policy that discharges it, or [TBD]>",
  "owner": "<one seat slug>",
  "status": "PROPOSED",
  "bindTrigger": "n/a",
  "entityScope": "[TBD]",
  "appliesAt": "[TBD]",
  "productScope": "multi-asset",
  "activityScope": "ACT-...",
  "riskTaxonomy": "riskTaxonomy: RT-...",
  "reviewStatus": "proposed-llm-unreviewed",
  "reviewAuthor": "Mira",
  "reviewDate": "<today, YYYY-MM-DD>",
  "reviewEventId": "",
  "domain": "<single letter A–J>",
  "_provenance": {
    "instrumentId": "INSTRUMENT_ID",
    "sourceSectionId": "<the source section id, e.g. reg38>",
    "applicabilityScore": 0.95,
    "applicabilityRationale": "one sentence",
    "relevancyScore": 0.9,
    "verbatimSnapshot": "first ~1000 chars of the source text you reasoned from"
  }
}
```

### Field rules

- **`id`** — provisional sequential `ID_PREFIX001`, `ID_PREFIX002`, … The reviewer renumbers into
  the real `ORG-*` space on merge; keep them stable and sequential here.
- **`urn`** — `URN_PREFIX:<sectionId>` using the source's own section id.
- **`citation`** — precise source chain: `<UNIT_NOUN> N of INSTRUMENT_NAME (<what>)`, read with
  `PARENT_AUTHORITY` where relevant. Where you cannot pin a sub-reference from the text, append
  `[TBD: precise sub-reference — Imani/external counsel at licence gate]` (matches existing
  convention where the source is a transcription, not the official PDF).
- **`owner`** — one accountable seat slug, lower-case, from: `treasurer, cfo, cro, cco, ciso, coo,
  cae, company-secretary, ceo`. Heuristics: capital / returns / leverage → `treasurer` or `cfo`;
  liquidity LCR/NSFR → `treasurer`; credit / market / IRRBB risk → `cro`; AML / conduct → `cco`;
  cyber → `ciso`; governance / board → `company-secretary`; audit → `cae`; reporting rendition → `cfo`.
  (The reviewer normalises owners to the canonical domain-ownership map on merge — `seatForObligation()`
  in `prototype/platform/regulatory/domain-ownership-map.ts` — so a best-effort owner is fine here.)
- **`domain`** — ONE letter: `A`=PRUDENTIAL, `B`=FINANCIAL-CRIME, `C`=FAIS, `D`=MARKET-CONDUCT,
  `E`=CYBER, `F`=GOVERNANCE, `G`=REPORTING, `H`=OPERATIONAL, `I`=TREASURY, `J`=MARKET-INFRASTRUCTURE.
  The `section` field embeds the same letter (`SECTION_LABEL`), and **every row sharing a `section`
  string must carry the same `domain` letter** (the parity recon asserts section→domain is 1:1).
- **`productScope`** — `multi-asset` unless product-specific (`debt-securities`, `equity-securities`,
  `interest-rate-derivatives`, `fx-instruments`, `money-market-instruments`, `securities-financing`).
- **`activityScope`** — an `ACT-*` code (e.g. `ACT-REPORT-PRUDENTIAL`, `ACT-RISK-MGMT`,
  `ACT-RISK-CREDIT`, `ACT-TREASURY`, `ACT-COMPLIANCE`, `ACT-TRADE-BOOK`) or `[TBD]`.
- **`riskTaxonomy`** — `riskTaxonomy: RT-<code>` (`RT-CR` credit, `RT-MR` market, `RT-LR` liquidity,
  `RT-OR` operational, `RT-CAP` capital) or `[TBD]`.
- **`status`** `PROPOSED`; **`bindTrigger`** `n/a`; **`entityScope`/`appliesAt`** `[TBD]`;
  **`reviewEventId`** empty string. (On adoption the reviewer flips `status` to a seed-vocabulary
  value — `IN_FORCE` etc. — `PROPOSED` is not a final status.)
- **`_provenance`** — non-canonical; the reviewer strips it before merge. Always include it so the
  reviewer can audit your reasoning and the text you worked from.

---

## ⑦ Guardrails (Engineering Charter — D-ENGINEERING-INTEGRITY-CHARTER)

- **Source, don't invent.** Every requirement traces to verbatim text. If the source is silent on a
  detail (a precise threshold, a sub-reference, a form number), say `[TBD: …]` — never fabricate a
  number, a form name, or a citation. (Precedent: a row once fabricated "form BA 100"; it was caught
  and corrected. Don't repeat that.)
- **No silent gaps.** If a `UNIT_NOUN` is image-only, truncated, or unreadable, list it in the summary
  as a gap with the reason — don't skip it silently.
- **Propose, don't adopt.** Stop at the proposal file. Do not touch `_obligations.seed.json`, do not
  run `backfill:obligations`. The reviewer does that.

## ⑧ Definition of done

1. `OUT_JSON` exists and is valid JSON (an array of rows in the schema above).
2. **Every** top-level `UNIT_NOUN` in the source is accounted for: each is either decomposed into ≥1
   obligation, **or** listed in the summary as not-applicable (with score + reason), **or** flagged
   as a gap. State the total count so coverage is auditable.
3. `OUT_MD` summarises the run (counts + the per-row table).
4. No fabricated citations / thresholds / form numbers; every `[TBD]` is honest about what's missing.

## ⑨ Hand-off (the reviewer / engineering substrate does this after you — context, not for you to run)

> Triage the proposal → finalise `id`s into the real `ORG-*` space → drop `_provenance` → flip
> `status` to a seed-vocabulary value → normalise `owner` to the domain-ownership map → merge
> accepted rows into **both** `_obligations.seed.json` **and** `_obligations-register.md` →
> `bun run citation-gate` → `bun run backfill:obligations` (emits `ObligationAdopted`) →
> `bun run graph:seed` → regenerate `_adopted-serves-backfill-objective-graph.json`. (See the RRB
> adoption, PR #1449, for a worked end-to-end run.)
