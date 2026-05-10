---
title: Retention-citation-coverage recon — close 78 pre-existing warnings via URN-form anchor recognition
author: Vera (Internal audit / continuous-assurance engineer)
date: 2026-05-10
summary: Extended the recon's prefix list to recognise urn:obligation:* / urn:policy:* citationRefs the substrate emits; warning count dropped from 78 to 3, with the residual 3 filed as a Mira (Compliance / RegTech engineer) follow-on.
decision-required: false
---

# Retention-citation-coverage — close pre-existing 78 warnings

**Author:** Vera (Internal audit / continuous-assurance engineer), reporting functionally to Thandiwe (Chief Audit Executive) and administratively via the CEO.
**Surfaced by:** Mira (Compliance / RegTech engineer) during PR #140 review (verified by stashing changes and re-running the recon clean against `main`).
**Closes:** Wave-4 #14 follow-on — URN-form anchor recognition gap that masked the substrate's Slice-3 follow-on URN-population work as recon "warnings".

## Finding

`bun run recon:retention-citation-coverage` reported **78 warnings** on `main` (pre-PR-#140). The warnings were not introduced by recent register changes; they were a **pre-existing gap** in the recon's anchor-prefix list, surfaced once Atlas (Core banking platform architect) landed the Slice-3 URN substitutions in `prototype/platform/event-store/registry.ts` (the `RETENTION_GOVERNANCE_7Y`, `RETENTION_JSE_TRADE_7Y`, and `RETENTION_RUNTIME_1Y` retention classes were migrated from `[register: route to Mira — …]` markers to URN-form citationRefs ahead of the recon's prefix list being extended to recognise the new namespaces).

### Breakdown of the 78 warnings, before fix

By citationRef value:

| Count | citationRef | Affected retention class | Root cause |
|---:|---|---|---|
| 59 | `urn:obligation:bank:org:gv:director-decision-retention:v1` | `RETENTION_GOVERNANCE_7Y` (`prototype/platform/event-store/registry.ts:182–192`) | Category (a) — URN registered in `Regulations/_obligations-register.md:236` (`ORG-GV-21` row, URN cited in prose) |
| 10 | `urn:policy:bank:records-management:operational-substrate-retention:v1` | `RETENTION_RUNTIME_1Y` (`prototype/platform/event-store/registry.ts:207–223`) | Category (a) — URN registered at `Regulations/_obligations-register.md:479` (`ORG-RM-01` row, URN in second cell) |
| 6 | `urn:obligation:bank:mk:jse-equities-rules-retention:v1` | `RETENTION_JSE_TRADE_7Y` (`prototype/platform/event-store/registry.ts:194–205`) | Category (a) — URN registered at `Regulations/_obligations-register.md:317` (`ORG-MK-15` row, URN in second cell) |
| 3 | `COMPANIES-ACT-71-2008-S24` | `RETENTION_ACCOUNTING_7Y` (`prototype/platform/event-store/registry.ts:176–180`) | Category (b) — looks like an external-anchor URN (matches the `COMPANIES-ACT-` prefix) but does not resolve to any `_obligations-register.md` row; Mira follow-on |

By category:

| Category | Count | Root cause | Disposition |
|---|---:|---|---|
| (a) URN-form citationRefs that should match an existing register anchor | 75 | Substrate emits `urn:obligation:` / `urn:policy:` URN-form anchors that the recon's prefix list (`BCBS-`, `JSE-`, …) did not recognise. Recon dropped them through to the malformed-citation branch. | **Fixed** by extending the recon — see "Recon code fix" below. |
| (b) Citation looks like a recognised form but does not resolve | 3 | `COMPANIES-ACT-71-2008-S24` matches the `COMPANIES-ACT-` external-anchor prefix but is not present as a Domain N first-cell anchor or as a URN handle in `_obligations-register.md`. | **Filed as Mira follow-on** — see "Category (b) follow-on" below. |
| (c) Anything genuinely broken | 0 | No category-(c) findings — all three substrate URNs resolve to register rows once recognition is extended. | None. |

## Recon code fix

Extended `prototype/platform/recon/retention-citation-coverage.ts` to recognise URN-form anchors as a fourth accepted citationRef shape (alongside `ORG-*` register IDs, `BCBS-/JSE-/…` external-anchor URN tokens, and `[register: route to Mira — …]` markers). Targeted by namespace — only the namespaces the substrate actually emits are recognised; the recon does **not** silently match arbitrary URN-shaped strings.

### Files changed

- `prototype/platform/recon/retention-citation-coverage.ts`
  - Header docstring (lines ~16–44): expanded the "What this pipeline asserts" list from three accepted citation forms to four (added the URN-form anchor entry, with explicit case-sensitivity note).
  - Lines ~127–144: added `URN_ANCHOR_PREFIXES = ["urn:obligation:", "urn:policy:"]` constant with discipline-note that the namespace is targeted (not "anything URN-shaped"), and case-sensitive (RFC 8141 lower-case convention; the substrate emits lower-case).
  - Lines ~157–217: extended `parseObligationsRegister` to also extract `urn:obligation:*` / `urn:policy:*` codespans from anywhere in the register (not only first-cell or second-cell), and to return a third `urnAnchors` set. The Slice-3 follow-on rows expose URN handles in the row's *Citation* cell or in prose, not at a fixed cell position; a single regex sweep over the document tolerates that.
  - Lines ~226–243: extended `loadObligationsRegisterFromDisk` return shape to include the new `urnAnchors` set.
  - Lines ~258–266: added `looksLikeUrnAnchor(cite)` exported helper — structural check matching the new URN namespaces.
  - Lines ~283–302: extended `AssertOpts` with optional `urnAnchors` field; default loader populates it.
  - Lines ~327–345: added a fourth resolution branch — `else if (looksLikeUrnAnchor(cite))` — that case-sensitively matches the URN against the `urnAnchors` set and emits a targeted unresolved-citation finding when it does not resolve.
  - Lines ~352–360: updated the malformed-citation message to mention the new URN-form anchor option.

- `prototype/tests/recon-retention-citation-coverage.test.ts`
  - Added `urnAnchors` set to the synthetic-resolution-cases common knobs (lines ~95–99) — three real substrate URNs.
  - Added `urnAnchors` to all nine existing synthetic `assertRetentionCitationCoverage({…})` calls to keep them hermetic (avoid the disk-loader fallback picking up real URNs from `_obligations-register.md`).
  - Added four new synthetic resolution-case tests (lines ~236–319): URN resolves (`urn:obligation:*` and `urn:policy:*` flavours); URN does not resolve; URN matched case-sensitively (uppercased URN does not resolve).
  - Added `looksLikeUrnAnchor` helper test (lines ~371–384): namespace-targeted match (only `urn:obligation:` / `urn:policy:`); rejects other URN namespaces (`urn:isbn:…`, `urn:other:…`); rejects upper-case form.
  - Added two new register-parser tests (lines ~410–445): URN extraction from anywhere in the register (Citation cell, prose); case-sensitive (upper-case URN ignored).

### Prefix-list extension delta

```diff
+/**
+ * Prefix list of recognised URN-form anchors. The Slice-3 follow-on
+ * register rows (`ORG-GV-21`, `ORG-MK-15`, `ORG-RM-01`) expose URN
+ * handles directly in the row's Citation cell — the recon resolves
+ * `urn:obligation:bank:…:v<n>` and `urn:policy:bank:…:v<n>` against
+ * those handles rather than against a Domain-N first-cell anchor.
+ *
+ * Targeted by namespace (not "anything URN-shaped"): only the
+ * namespaces the substrate actually emits as `retention.citationRef`
+ * values are recognised. New namespaces extend this list explicitly
+ * when the substrate begins to emit them.
+ *
+ * Case-sensitive — RFC 8141 URN convention is lower-case; the
+ * substrate emits lower-case; the register stores lower-case in
+ * backticks. Avoids the upper-case fold the ORG-* / external-anchor
+ * branches use (those are conventionally upper-case tokens).
+ */
+const URN_ANCHOR_PREFIXES: readonly string[] = ["urn:obligation:", "urn:policy:"];
```

The recon strictness threshold is **unchanged**. The fix teaches the prefix list about the substrate's URN namespace; it does **not** broaden the recon to "match anything URN-shaped" (that would silently swallow typos and ad-hoc tokens), nor lower the warn/fail threshold.

## Before / after warning count

| Metric | Before fix (on `main`) | After fix |
|---|---:|---:|
| `bun run recon:retention-citation-coverage` total warnings | **78** | **3** |
| of which: malformed-citation | 75 | 0 |
| of which: unresolved-citation | 3 | 3 |
| `assertedCount` over `EVENT_TYPE_REGISTRY` | 83 | 83 |
| `ok` | `true` (warn severity) | `true` (warn severity) |

The 75 malformed-citation warnings (the substrate's URN-form citationRefs) are now **resolved** — the recon recognises the URN namespace and confirms each URN handle is registered in `_obligations-register.md`. The 3 residual unresolved-citation warnings are category (b) — see follow-on below.

## Category (b) follow-on — `COMPANIES-ACT-71-2008-S24` not in register

Three event-type rows in `prototype/platform/event-store/registry.ts` use the `RETENTION_ACCOUNTING_7Y` retention class (`prototype/platform/event-store/registry.ts:176–180`), whose `citationRef` is the external-anchor token `COMPANIES-ACT-71-2008-S24`. The token matches the recon's `COMPANIES-ACT-` external-anchor prefix (so the recon recognises the form) but does not resolve to any first-cell or backtick-quoted handle in `Regulations/_obligations-register.md`.

Affected event-type rows:

| Event-type | Registry line | Class |
|---|---:|---|
| `IfrsClassificationApplied` | `prototype/platform/event-store/registry.ts:924–945` | `markets` |
| `SubLedgerPostingEmitted` | `prototype/platform/event-store/registry.ts:949–967` | `markets` |
| `IntraGroupArrangementSigned` | `prototype/platform/event-store/registry.ts:1275–1294` | `governance` |

Citation lineage in `_obligations-register.md`: Companies Act 71 of 2008 s.24 (accounting-records retention ≥7y) is **referenced in prose** in multiple rows (e.g. `ORG-GV-21` Citation cell, `ORG-RM-01` Citation cell, the v1.10 / v1.12 amendment banners), but **no register row exposes it as a first-cell external-anchor token (`\`COMPANIES-ACT-71-2008-S24\``) nor as a backtick-quoted URN handle (`\`urn:obligation:bank:…:companies-act-71-2008-s24:v1\``)**. The substrate's `RETENTION_ACCOUNTING_7Y.citationRef` is therefore not resolvable from the register today.

This is **not a Vera authoring scope** — extending the obligations register is Mira's authoring authority, exercised under Zara (Chief Compliance Officer). The recon correctly surfaces the gap; per the dispatch brief I do **not** silently extend the recon to swallow the warnings, and I do **not** touch the register itself.

### Recommended Mira follow-on

**Workstream:** likely a sub-tranche of `WS-INSTRUMENT-ANALYSES` (the markets accounting-anchor work) or a new compact workstream `WS-ACCOUNTING-ANCHOR-COMPLETION` (since the affected event-types span markets + governance, the accounting-anchor scope reads broader than the instrument-analyses scope). Mira to elect.

**Scope:** add a register row (or extend an existing row) that exposes Companies Act 71 of 2008 s.24 as a resolvable handle. Two implementation paths Mira may choose between:

- **Path 1 — Domain-N external-anchor row.** Add a `\`COMPANIES-ACT-71-2008-S24\`` first-cell row to the Domain N URN-table section of the register (the section the recon parses for `EXTERNAL_ANCHOR_PREFIXES` resolution). Cleanest fix; the existing `RETENTION_ACCOUNTING_7Y.citationRef` value resolves immediately without substrate change.
- **Path 2 — URN-form anchor row.** Add (or extend) a register row whose Citation cell exposes a backtick-quoted URN like `\`urn:obligation:bank:org:ac:companies-act-71-2008-s24-accounting-records:v1\``, then update `RETENTION_ACCOUNTING_7Y.citationRef` in `prototype/platform/event-store/registry.ts:179` to that URN. Aligns with the Slice-3 URN-population direction the other three retention classes have already taken.

Either path closes the residual 3 warnings to 0. Path 2 has the side benefit of unifying all four retention classes on the URN-form anchor convention (one substrate-citation idiom rather than two).

**Citation chain to populate (per Principle 2 — atomic citation):** Companies Act 71 of 2008 s.24 (accounting-records retention obligation) read with Banks Act 94 of 1990 s.60 (accounting records of bank), JSE Equities Rules trade-record retention sub-rules (post-trade obligation cross-reference for `IfrsClassificationApplied` and `SubLedgerPostingEmitted`), and the bank's IFRS posting + intra-group arrangement substrate consumers. `[citation: TBC — exact Companies Act s.24 sub-section indices for the 7-year accounting-record floor; Imani (Legal-as-code engineer) + external counsel ratify at the licence-application gate; Principle 2 — no invented sub-section]`.

## CI status

Full `bun run ci` is green:
- `typecheck`, `lint` (after biome auto-format), `test` (493 pass, 0 fail; +8 new tests in this PR).
- `citation-gate`: 0 violations.
- All 9 recon harnesses run; the retention-citation-coverage harness drops from 78 warnings to 3 (the residual category-(b) items filed above).

Other recon harnesses (`agent-spec-cross-link`, `decision-recommendation`, `parallel-dispatch-divergence`) carry their own pre-existing warn-severity findings that are unrelated to this fix and tracked under their respective workstreams.

## Reconciliation with the architectural principles

- **Principle 1 (events are truth).** The recon reads the registry as data, not as procedural state; the URN handles in `_obligations-register.md` and the substrate's citationRefs are the canonical sources, the recon is a query.
- **Principle 2 (citation discipline).** The fix preserves the Principle-2 reading of D-EVENT-STORE-SCALING — every retention floor traces to a register-resolvable citation. Category (b) items remain visible as findings rather than being silently swallowed.
- **Principle 6 (single-graph discipline, upward chain).** The recon asserts the upward chain `retention metadata → URN handle → register row`. Extending the recognition to URN-form anchors closes a gap in that chain; nothing about the chain itself is added or removed.

—Vera
