// platform/identity/types.ts
//
// Identity primitives. A Principal is the typed actor on whose behalf an
// event or API call is made. The `Authenticator` interface is the seam
// between local mock identity (M1) and Azure Entra ID workload identity +
// SSO (M8). Capability code depends only on this interface.
//
// P4 — zero trust by default; every request authenticates.
// P6 — substrate-replacement seam (upward chain).
//
// Author: Atlas · Senna (security primitives review)

import type { ActorType } from "../core/types";

/**
 * A Principal represents the verified identity of the caller — the human,
 * service, or system component on whose behalf the action runs. It maps
 * directly onto an Event's `actor` field.
 */
export interface Principal {
  readonly type: ActorType;
  readonly id: string;
  /** Free-form attributes (role, department, mandate-id, scopes). */
  readonly attributes?: Record<string, string>;
}

export interface IssueOpts {
  /** Token lifetime in seconds. Defaults to 900 (15 minutes). */
  ttlSeconds?: number;
  /** Free-form additional claims merged into the token payload. */
  claims?: Record<string, string>;
}

/**
 * The Authenticator issues short-lived bearer tokens for a Principal and
 * verifies them on receipt. The local mock implementation signs with a
 * software-backed HMAC key persisted under `.local/keys/`. The cloud
 * implementation (M8) is Azure Entra ID — Workload Identity Federation
 * for services and SSO + WebAuthn for humans.
 */
export interface Authenticator {
  issue(principal: Principal, opts?: IssueOpts): Promise<string>;
  verify(token: string): Promise<Principal>;
}

export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

export class TokenInvalidError extends Error {
  constructor(reason: string) {
    super(`Token invalid: ${reason}`);
    this.name = "TokenInvalidError";
  }
}
