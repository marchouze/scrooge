---
title: "WS-RETURNS-SUBMISSION-WIRING — Workstream Scoping & Sequencing"
author: "Scrooge (Chief of Staff / Orchestrator) — coordinating Mira (Compliance / RegTech engineer) + Bea (Accounting & financial reporting engineer)"
date: 2026-06-10
workstream: WS-RETURNS-SUBMISSION-WIRING
authority: D-RETURNS-SUBMISSION-WIRING-WORKSTREAM
status: scoping
citations:
  - D-RETURNS-SUBMISSION-WIRING-WORKSTREAM
  - D-COMPLETENESS-AUDIT-WORKSTREAM
  - D-RWA-ENGINE-W2-SLICE-3
  - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL
---

# WS-RETURNS-SUBMISSION-WIRING — Scoping & Sequencing

## 1. Why this workstream exists

The regulatory-return **submission** layer is dark. Seven period-close
subscribers (`platform/returns/<form>/period-close-subscriber.ts`) are built and
unit-tested, but only **one** (BA 320, market risk) has a runtime importer that
actually invokes it on the `AccountingPeriodClosed` stream. The other **six** are
*inert*: built, tested, never executed. An unimported module emits no failure, so
without a dedicated gate nothing would notice.

That gate exists — `recon:inert-module-detection`
(`platform/recon/completeness/inert-module-detection.ts`, the T1 "built-but-inert"
taxon of `D-COMPLETENESS-AUDIT-WORKSTREAM`). It asserts every watched
period-close subscriber has a runtime/dashboard importer, FAILs on any that does
not unless it carries an **explicit allowlist entry** with an owner + closing
workstream, and — critically — is **self-cleaning**: it also FAILs on an
allowlisted module that has *gained* an importer (a stale entry). That forces
every wiring to de-allowlist in the same change, so the allowlist can never
silently lie about coverage.

This document is the scoping + sequencing plan to retire the six allowlist
entries — i.e. to make each return genuinely submittable — and the explicit
statement of what is build-phase-blocked vs licence-day-blocked.

## 2. Current state (one wired, six inert)

| Return | Subscriber | Status | Generator is event-sourced? | What blocks wiring |
|---|---|---|---|---|
| **BA 320** — Market risk | `returns/ba320/period-close-subscriber.ts` | ✅ **WIRED** (`runtime/agents/bea-ba310-period-close.ts`) | Yes | — (the proven pattern) |
| **BA 700** — Capital adequacy | `returns/ba700/period-close-subscriber.ts` | Inert (allowlisted) | Credit + market RWA event-sourced; **operational RWA placeholder (0)** | Op-RWA (BIA/OPE25) needs 3y audited gross income — **gross-income-blocked until licence-day**. Submitting now understates total RWA → flatters CET1/T1/Total ratios. |
| **BA 300** — LCR (liquidity) | `returns/ba300/period-close-subscriber.ts` | Inert (allowlisted) | Yes (cash flows + HQLA event-sourced) | `formVersion = v0.1-rehearsal`; **foreign-currency settlement legs excluded** from the denominator pending the Slice-6 FX-rate enrichment; per-currency LCR (Reg 26(13)) not built. |
| **BA 400** — Operational risk | `returns/ba400/period-close-subscriber.ts` | Inert (allowlisted) | Stub-fed | Gross-income rows are caller-supplied placeholder zeros — **post-commencement-of-trading**; needs a `RevenueRecognitionEmitted`-style feed. |
| **Conduct** (FSCA/TCF) | `returns/conduct/period-close-subscriber.ts` | Inert (allowlisted) | Rehearsal | `status: 'rehearsal'`; no production conduct-event emitter; **no SARB XML envelope** (FSCA disclosure, not a SARB BA-form). |
| **CMS** (FSCA/TCF) | `returns/cms/period-close-subscriber.ts` | Inert (allowlisted) | Rehearsal | Placeholder-zero TCF metrics over AlertOpened/ConflictDeclared proxies; no submission envelope. Earliest-stage of the three disclosures. |
| **Climate** (TCFD / SARB GN 5) | `returns/climate/period-close-subscriber.ts` | Inert (allowlisted) | Rehearsal | Placeholder transition/physical scores (0) + placeholder Pillar-2 add-on (0); needs a climate-data feed + channel. |

Form numbering follows `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` (Excel tab A1 is
definitive): capital = BA 700, LCR = BA 300, market risk = BA 320, op-risk =
BA 400.

## 3. The proven wiring pattern (BA 320)

`runtime/agents/bea-ba310-period-close.ts` is the reference. The shape every
wiring follows:

1. A runtime handler subscribes to `AccountingPeriodClosed`.
2. On close, it calls the return's `period-close-subscriber` generator (which
   reads the event store — RWA via the `RwaComputed` event of record, cash flows
   via settlement/maturity events, etc.).
3. It emits the **computed** event of record (e.g. `RwaComputed` already lands
   for capital/market per `D-RWA-ENGINE-W2-SLICE-3`) and threads the computation
   event id for chain-of-custody.
4. It emits `SarbSubmissionAttempted{ formId, reportingPeriod, accepted,
   referenceNumber? , mode: "simulator" }` against the SARB submission simulator
   (build-phase), carrying validation errors on failure.
5. The wiring **removes the module's `KNOWN_INERT_PENDING_WIRING` entry** in the
   same PR — `recon:inert-module-detection` FAILs otherwise (self-cleaning).

### Event-chain gap to close

Today there is a `RwaComputed` (computed) and a `SarbSubmissionAttempted`
(submission), but **no uniform "return computed → rendered → submitted" chain**
wired to period-close for most returns. Part of this workstream is to make that
chain uniform: a `<Return>Computed`/`ReportGenerated` step → `SarbSubmissionAttempted`,
so every return has the same evidence trail (`SarbSubmissionAttempted` is the
canonical submission record; `TradeReportSubmitted` is the analogue for the
cross-border FX / OTC trade-reporting path, not BA-forms).

## 4. Sequencing

The binding axis is **data readiness**, not engineering effort. Grouped:

**Wave A — wireable in build-phase now (no new external feed):**
- **BA 300 (LCR)** once the **Slice-6 FX-rate enrichment** lands. The generator
  is already event-sourced; the only blocker is non-ZAR settlement legs excluded
  from the denominator. The FX-rate substrate this needs is the same canonical
  `buildRateMap`/`convertMinor` machinery just used for the SA-CCR EAD conversion
  (`D-FX-EAD-FX-CONVERSION`) — a contained step, not a licence-day dependency.
  After enrichment + promotion past `v0.1-rehearsal`, wire it. **Highest-value,
  lowest-dependency first move.**

**Wave B — blocked on the gross-income feed (licence-day-adjacent):**
- **BA 400 (operational risk, BIA)** and the **operational-RWA component of
  BA 700** share one blocker: three fiscal years of audited gross income, which
  cannot exist pre-commencement. Both unblock together once a
  `RevenueRecognitionEmitted` feed lands post-commencement. Until then, wiring
  either would record a hollow return. **Do not wire in build-phase.** (BA 700's
  credit + market RWA *are* event-sourced today via `RwaComputed`; only the op-RWA
  denominator is held at zero.)

**Wave C — FSCA/TCF disclosures (not SARB BA-forms; need a different channel):**
- **Conduct, CMS, Climate** are FSCA/TCF/GN-5 disclosures, not SARB prudential
  BA-forms, so they do not submit via the SARB simulator. Each needs (a) promotion
  past `status: 'rehearsal'` with real RAS-tolerance / TCF-metric / climate-data
  feeds, and (b) a defined FSCA submission envelope/channel. Sequence after the
  feeds exist; CMS is the earliest-stage (most placeholder) of the three.

## 5. Per-return definition of done

A return is "wired" (allowlist entry removed) only when **all** hold:
1. A runtime handler invokes the subscriber on `AccountingPeriodClosed`.
2. Inputs are genuinely event-sourced (no placeholder/stub rows in the submitted
   figures) — or any residual placeholder is **immaterial and shown** with the
   numbers.
3. `formVersion` is past `*-rehearsal`.
4. A `SarbSubmissionAttempted` (or the FSCA-channel analogue) event is emitted
   with the computed event id threaded for chain-of-custody.
5. The `KNOWN_INERT_PENDING_WIRING` entry is removed in the same PR and
   `recon:inert-module-detection` is green.

## 6. Honest non-goals / dependencies

- **No wired-but-hollow returns.** The workstream's standing rule (and the reason
  the allowlist exists) is that an honest "inert, tracked, owner-named" entry is
  better than a return submitted from placeholder inputs. A hollow capital return
  that flatters CET1 is worse than no return.
- **Op-RWA / gross income is licence-day-blocked** — not in scope to fake.
- **CRO/Treasury thresholds** (where a return embeds an appetite/limit) and the
  **FSCA channel** for the three disclosures are seat-owned inputs, not
  engineering choices.
- The SARB submission target is the **simulator** (`mode: "simulator"`) in
  build-phase; the live channel is a licence-day swap (Principle 3 — file path →
  endpoint), not a code rewrite.

## 7. Recommended first dispatch

**Wave A / BA 300 LCR FX-rate enrichment + wiring** (owner: Mira + Bea). It is
the single return that is event-sourced, build-phase-completable, and gated only
on an FX-rate step whose machinery already exists. Closing it converts the
"submission layer is dark" headline into "five of six remaining are
data-blocked, with named owners and triggers" — a materially more honest posture
and a live, submitted (simulator) BA 300 to show.
