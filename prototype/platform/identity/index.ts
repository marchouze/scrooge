// platform/identity/index.ts
//
// Public surface of the identity primitive.

export type { Authenticator, IssueOpts, Principal } from "./types";
export { TokenExpiredError, TokenInvalidError } from "./types";
export { LocalAuthenticator } from "./local";
export type { LocalAuthenticatorOpts } from "./local";
