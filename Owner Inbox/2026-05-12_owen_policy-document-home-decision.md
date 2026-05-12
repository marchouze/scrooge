---
decision-required: true
decisionId: D-POLICY-DOCUMENT-HOME
title: Canonical home for policy documents
author: Owen (Company Secretary)
date: 2026-05-12
riskTaxonomy: RT-LR.RC
---

# D-POLICY-DOCUMENT-HOME — Canonical home for policy documents

## Problem

Ten policies have been authored to `Owner Inbox/` (e.g. `Owner Inbox/2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md`). `Owner Inbox/` is a Phase-0 transient inbox for CEO-directed deliverables, not a document store. This creates two principle violations:

- **Principle 1 (events are truth):** no `DocumentRegistered` event has been emitted for any policy. The files exist only as filesystem artefacts; the event log — the sole durable source of truth — has no record of them.
- **Principle 2 (single-graph discipline):** procedures and obligations that cite these policies lack a stable, resolvable path. Citations to `Owner Inbox/` paths will rot as Phase 4 migration archives that directory.

This decision gates: all future policy authoring; migration of the 10 existing policies; and the citation convention used in procedures, the obligations register, and the RAS.

---

## Options

### Option A — `Policies/` directory as filesystem mirror

Create a `Policies/` directory at the repo root. Each policy is a `.md` file named `<PolicyID>-v<version>.md` (e.g. `Policies/liquidity-risk-management-policy-v1.md`). A `DocumentRegistered` event is emitted manually for each file, pointing to its repo-relative path. The RMS Document register projection surfaces these. Git history is the version log.

**Pros:** simple; stable file paths for citations; no doc-store dependency.  
**Cons:** event emission is a manual step — gaps are inevitable without enforcement tooling.

### Option B — RMS doc store inline

Policy content lives entirely in the RMS BLAKE3 content-addressed doc store. No flat file in git. The `DocumentRegistered` event carries the BLAKE3 content hash; the projection renders the document on demand from the event payload or store.

**Pros:** the most principled — Principle 1 is satisfied structurally, not by convention; no filesystem path to rot.  
**Cons:** requires full RMS Phase 1 doc store to be operational before any new policy can be authored. Blocks policy work today.

### Option C — Hybrid (recommended)

Create a `Policies/` directory for human-readable authoring and stable git-history citation. A `DocumentRegistered` event is emitted automatically on every `Policies/*.md` commit — wired via a recon pipeline trigger (analogous to the existing `recon:runtime-handler-sync` pattern) or a lightweight git hook. `Owner Inbox/` is retired for policy authoring; it continues only for transient CEO inbox items (briefs, decision cards, one-off deliverables). Existing 10 policies are migrated to `Policies/` and their `DocumentRegistered` events are back-emitted in a single backfill run.

**Pros:** stable citation paths; human-readable git history; Principle 1 satisfied via automated emission (not convention); unblocks policy authoring immediately; `Owner Inbox/` retirement is clean and scoped.  
**Cons:** the recon/hook wiring is a small engineering task for Atlas (platform engineering).

---

## Recommendation

**Option C — Hybrid.** It is the only option that satisfies Principle 1 structurally (not by convention) without blocking policy authoring on full doc-store readiness. Option A is next-best and acceptable if engineering bandwidth for the hook is deferred. Option B is the long-run target state; it should be revisited when RMS Phase 2 lands.

---

## Proposed action if approved

1. **Atlas (platform engineering)** creates `Policies/` at repo root with a `README.md` explaining the naming convention (`<PolicyID>-v<version>.md`) and the emit contract.
2. **Atlas** wires a `DocumentRegistered` event emitter triggered on `Policies/*.md` changes (recon pipeline or git hook).
3. **Atlas** migrates the 10 existing policies from `Owner Inbox/` to `Policies/` and runs the backfill to emit their `DocumentRegistered` events.
4. **Owen (Company Secretary, governance)** updates the policy register (`Owner Inbox/2026-05-06_policy-register.md`) to point to `Policies/` paths and notes the new citation convention.
5. All future procedures, obligations-register rows, and RAS citations use `Policies/<PolicyID>-v<version>.md` as the canonical reference.

---

*Decision required from: CEO (Marc)*
