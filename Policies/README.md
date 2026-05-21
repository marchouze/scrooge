# Policies — canonical policy document store

> **Authority:** D-POLICY-DOCUMENT-HOME Option C, CEO-approved 2026-05-12.
> **Owner:** Owen (Company Secretary, governance)

This directory is the canonical home for all bank policy documents.

## What belongs here

Every finalised, versioned policy document — policies, charters, mandates, and frameworks approved by the CEO or Board. Draft working documents should remain in `Owner Inbox/` until approved.

## Naming convention

```
<PolicyID>-v<version>.md
```

Examples:
- `liquidity-risk-management-policy-v1.md`
- `aml-cft-policy-v2.md`
- `internal-audit-charter-v1.md`

Drop the date prefix and author that `Owner Inbox/` filenames carry — those are inbox-routing artefacts, not canonical names.

## Required YAML frontmatter

Every `Policies/*.md` document must carry the following YAML frontmatter fields:

```yaml
---
policy-id: <kebab-case-policy-id>           # e.g. liquidity-risk-management-policy
title: <Human-readable title>                # e.g. Liquidity Risk Management Policy v1
version: "<n>"                               # e.g. "1"
status: IN FORCE | DRAFT | ACTIVE | SUPERSEDED  # lifecycle status
owner: <Name (Role, seat)>                   # e.g. Helena (Chief Risk Officer, governance)
effective-from: "YYYY-MM-DD"                 # ISO date the policy takes effect
next-review: "YYYY-MM-DD"                    # ISO date the next scheduled review is due
citations:                                   # one or more regulatory or decision citations
  - <citation 1>
  - D-POLICY-DOCUMENT-HOME                  # always include the authorising decision
---
```

### `next-review` — mandatory review-cadence field

Every policy carries an explicit `next-review` date so review cadence is a typed property of the policy itself, not a sidecar tracker. Authority: `D-POLICY-NEXT-REVIEW-CONVENTION` (CoSec — Owen — 2026-05-21; recorded via CEO session-delegation).

Default cadences (override only with documented rationale in the body):

- **`status: IN FORCE`** — `next-review = effective-from + 12 months`.
- **`status: DRAFT`** or **`status: ACTIVE`** (pre-IN FORCE working state) — `next-review = date + 6 months` (tighter cadence while the policy beds in).
- **`status: SUPERSEDED`** — `next-review` is retained as the historical scheduled date; superseded policies are exempt from past-due enforcement.

Recon enforcement: `recon:policy-next-review` (CI gate) asserts (a) every `Policies/*.md` has a `next-review` field, (b) the value parses as ISO date, and (c) raises a Vera finding when an IN FORCE policy's `next-review` is in the past relative to `clock.now()`. Past-due IN FORCE policies are `fail`-severity; past-due DRAFT / ACTIVE policies are `warn`-severity.

## Event binding

Every file in this directory has a corresponding `DocumentRegistered` event in the event store (Principle 1 — events are the only source of truth). The `document-registration` recon pipeline (`bun run recon:document-registration` from `prototype/`) enforces this:

- CI fails if a `Policies/*.md` file exists without a matching `DocumentRegistered` event.
- The event carries a BLAKE3 content hash — any change to a file produces a hash mismatch, requiring a new event.

## Do NOT author policies here

Do not author new policy documents by creating files here directly. The correct workflow is:

1. Author in `Owner Inbox/` (inbox-pattern, per pre-Phase-1 operating procedure).
2. CEO/Board approves.
3. Copy the approved file to `Policies/` with the simplified naming convention.
4. Run `bun run scripts/backfill-document-registered-<date>.ts` to emit the `DocumentRegistered` event for the new file.
5. `bun run ci` must pass (the `document-registration` recon checks hash coverage).

The `Owner Inbox/` original is retained as the historical inbox record. It is not deleted.

## Policy register

The master policy register lives at `Owner Inbox/2026-05-06_policy-register.md`. Each row's status cell now references the canonical `Policies/` path for approved policies.

## Event schema

```typescript
DocumentRegisteredPayload {
  documentId: string      // e.g. "policy:liquidity-risk-management:v1"
  title: string
  kind: "policy" | "charter" | "procedure" | "report" | "other"
  filePath: string        // canonical path e.g. "Policies/liquidity-risk-management-policy-v1.md"
  contentHash: string     // "blake3:<hex>"
  version: string         // "1.0.0"
  authors: string[]       // agent URNs or email
  registeredAt: string    // ISO timestamp
  supersedes?: string     // documentId of prior version
}
```
