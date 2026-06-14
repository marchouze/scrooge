# Engineering Charter — Correctness before convenience

> **Authority:** `D-ENGINEERING-INTEGRITY-CHARTER` (CEO-approved, recorded via Scrooge session-delegation, `marc@tgv.co.za`).
> **Binds:** every agent and every dispatch, in-session or autonomous. Cited by dispatch prompts alongside the Dispatch-discipline section of `CLAUDE.md`.
> **Status:** standing. Supersedes nothing; complements the six Architectural Principles (`/Principles/`) and the mechanical gates in `prototype/` (`bun run ci`).

## Why this exists

The bank's functionality must withstand increasing **complexity, volume, and scrutiny**. Under that pressure the cheap move is always available: patch the symptom, silence the type-checker, skip the failing test, widen the allowlist, hardcode the value, defer the gap and forget it. Each shortcut is locally rational and globally corrosive — it trades a minute now for an incident later, in a regulated institution where the later incident is a finding, a restatement, or a breach.

This Charter makes the *proper-first* bias **durable** — not dependent on any one session's discipline. It is the human-readable index over enforcement that already exists (Principles 1 & 2, strict `tsconfig`, biome, the citation gate, the wall-clock and append-only ratchets) plus the five gates this Charter introduces. Where a command has teeth, the enforcing gate is named. Where it does not yet, the command still binds — and closing the gap is itself tracked work (command #5).

**The default is the correct thing. The fast thing is allowed only when it *is* the correct thing, or when its cost is recorded and tracked.**

---

## The ten commands

### 1. Root-cause before remedy
Diagnose the underlying cause and fix *that*. A symptom patch (a workaround, a guard that hides a deeper defect) is permitted only when it carries a recorded reason **and** a tracked follow-up (a `SubstrateAlert`, a Vera finding, or a registered gap). No silent band-aids. Verify the premise before fixing: disk presence ≠ git-tracked; a local repro ≠ the CI conclusion. *(Cross-ref: Principle 1; `recon:tracked-todo`.)*

### 2. Fail-closed by default
When a check, an input, an authority, or a precondition is missing or uncertain, **refuse** — do not pass through. A gate that cannot prove safety denies; a handler that cannot resolve identity rejects; a readiness check that finds half-provisioned state declines. Fallbacks that silently substitute a permissive default are a defect, not a convenience. *(This is already the bank's seat-sweep pattern — now a standing command.)*

### 3. No green by concealment
Never make CI or tests pass by hiding the failure. Specifically forbidden without a recorded `Decision` citing why:
- skipping or narrowing tests (`.skip` / `.only` / `.todo` / `xit` / `xdescribe`) — `recon:no-skipped-tests`;
- suppressing the type-checker (`@ts-ignore` / `@ts-expect-error`) — `recon:no-ts-suppression`;
- stubbing out real logic so a test goes green, or weakening an assertion to match wrong output;
- widening a recon allowlist or **loosening a ratchet** — `recon:ratchet-hardening-only`.

Ratchets move in **one** direction: hardening. A snapshot may decrease (cleanup locks in the lower floor); it may increase only with a Decision in the same change. Green must mean *correct*, never *concealed*. *(Cross-ref: F-003 ratchet; D-PROVENANCE-FILTER-ENFORCEMENT.)*

### 4. Source, don't hardcode
Any value with an authoritative source — a golden source, an event-of-record, a regulatory constant — is **read from that source**, not transcribed into a literal. A literal that shadows a sourced value is a divergence waiting to happen. Hardcoded maps require a recon-allowlisted justification. *(Cross-ref: Principle 1; `recon:golden-source-hardcoded-maps`, `recon:financial-constants-coverage`.)*

### 5. No silent deferral
Every gap, deferred scope, or known-incomplete path **materialises** as a typed event (`SubstrateAlert`, `ProductDeferredGap`, or a Vera finding) **and** a register entry. A `TODO`/`FIXME`/`HACK` without a tracked reference is a silent deferral and a finding. "We'll do it at licence-day" is a tracked gap with an owner, not a comment. *(Cross-ref: `recon:tracked-todo`, `recon:npa-deferred-gap-tracking`.)*

### 6. The type system is a tool, not an obstacle
The strict compiler (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) is a correctness instrument. Do not dodge it with `any`, non-null `!`, or suppression directives — model the type honestly instead. Errors are **handled, never swallowed**: no empty `catch`, no caught error discarded without logging, escalating, or re-throwing. *(Cross-ref: biome `noExplicitAny`/`noNonNullAssertion`; `recon:no-ts-suppression`, `recon:no-swallowed-errors`.)*

### 7. Whole-tree integrity
Correctness is proven against the **whole tree on a clean store**: full `tsc --noEmit` (no scope restriction), the full recon suite, the full test run — `bun run ci` from `prototype/`. Partial or scoped passes do not count; a change is not done until the entire gate is green on a clean store (the home store's archive gaps are not a pass). *(Cross-ref: `CLAUDE.md` Full-typecheck gate; `scripts/run-recon-suite.ts`.)*

### 8. Traceability before code
Every new capability cites upward to the policy or regulation it serves (Principle 2). No orphan code, no orphan event, no untraceable outcome. The citation is written **before or with** the code, not retrofitted. *(Cross-ref: Principle 2; `bun run citation-gate`.)*

### 9. Replay-safe & append-only
The event log is never mutated or deleted (Principle 1). Backfills, migrations, and repairs are **idempotent** and **replay-safe** — re-running them changes nothing the second time. New event types register in all required sites; decisions write to the shared store. *(Cross-ref: `recon:event-store-append-only`, `recon:event-store-no-delete-callsite`.)*

### 10. Definition of Done
A change is **done** only when *all* of the following hold:

- [ ] The canonical artefact is an **event** (markdown is a render, never the source — Principle 1).
- [ ] `bun run ci` is **green on a clean store** (full typecheck + lint + tests + citation gate + both recon suites).
- [ ] `bun run citation-gate` reports **zero** violations.
- [ ] No new type suppression, skipped test, swallowed error, or untracked `TODO` (the four gates pass at or below snapshot).
- [ ] No ratchet loosened and no allowlist widened **without** a `Decision` citing why.
- [ ] Every deferred gap is **registered** as a typed event with an owner (command #5).
- [ ] Branch **rebased on `origin/main`**; CI re-run if the rebase changed anything; then pushed.

If any box is unchecked, the work is *in progress*, not *done* — and saying otherwise is a Charter violation (report outcomes faithfully).

---

## Enforcement map

| # | Command | Gate(s) |
|---|---------|---------|
| 1 | Root-cause before remedy | `recon:tracked-todo` (partial); narrative |
| 2 | Fail-closed by default | narrative + per-domain gates (e.g. permission-gate-default) |
| 3 | No green by concealment | `recon:no-skipped-tests`, `recon:ratchet-hardening-only` |
| 4 | Source, don't hardcode | `recon:golden-source-hardcoded-maps`, `recon:financial-constants-coverage` |
| 5 | No silent deferral | `recon:tracked-todo`, `recon:npa-deferred-gap-tracking` |
| 6 | Type system is a tool | `recon:no-ts-suppression`, `recon:no-swallowed-errors`, biome rules |
| 7 | Whole-tree integrity | `bun run ci` orchestration, `scripts/run-recon-suite.ts` |
| 8 | Traceability before code | `bun run citation-gate`, Principle 2 gates |
| 9 | Replay-safe & append-only | `recon:event-store-append-only`, `recon:event-store-no-delete-callsite` |
| 10 | Definition of Done | the union of all gates above |

New gates introduced with this Charter: `recon:no-ts-suppression`, `recon:no-skipped-tests`, `recon:no-swallowed-errors`, `recon:tracked-todo` (all enforcing, harden-only ratchets), and `recon:ratchet-hardening-only` (advisory until soaked — promotion to enforcing is a tracked follow-on).

---

## Change log

- **2026-06-14** — Charter created and approved (`D-ENGINEERING-INTEGRITY-CHARTER`). Ten commands + Definition of Done; four enforcing gates + one advisory meta-gate. Author: Scrooge (Chief of Staff) as recording instrument; Marc (CEO) authorising principal.
