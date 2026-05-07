# `@platform/identity`

The identity seam. Issues and verifies short-lived bearer tokens that bind a `Principal` (typed actor) to a request.

## Interface

```ts
interface Authenticator {
  issue(principal: Principal, opts?: IssueOpts): Promise<string>;
  verify(token: string): Promise<Principal>;
}
```

A `Principal` matches the shape of an Event's `actor` field — the same identity flows from authentication through to the event log.

## Substrate-replacement seam (P6 — upward chain)

| Element | Local (M1) | Cloud (M8) |
|---|---|---|
| Workload identity | `LocalAuthenticator` (HMAC-SHA256, software-backed key under `.local/keys/idp.key`) | Azure Entra ID Workload Identity Federation |
| Human auth | (later) local mock SSO | Azure Entra ID + WebAuthn / FIDO2 |
| Token format | Compact JWT-shaped (`header.payload.sig`) with `env: "LOCAL_ONLY"` in the header | Entra-issued JWT |
| Key storage | `.local/keys/idp.key`, mode 0600 | Azure Key Vault Managed HSM |
| Key extractability | `extractable: false` on import — closer to M8 HSM posture | Hardware-bound; never extractable |

## What it does *not* do (yet)

- **No revocation list.** Short token TTLs are the M1 control. Revocation infrastructure is M2+.
- **No refresh tokens.** Re-issue against the underlying credential.
- **No human-SSO endpoint.** Local mock SSO (Keycloak or hand-rolled) is a follow-up.
- **No WebAuthn registration ceremony.** Customer-side WebAuthn arrives with the customer-onboarding capability.

## Local-only labelling

All local-issued tokens carry `env: "LOCAL_ONLY"` in their header. Anything that ever sees a `LOCAL_ONLY` token in a non-dev environment is a defect — Senna's threat-model gate flags this.

## Principles

- **P4** — every request authenticates; tokens are short-lived; the local key shape mirrors the M8 HSM posture.
- **P6 (upward chain)** — capability code imports `Authenticator`; substrate is wired at the composition root.
