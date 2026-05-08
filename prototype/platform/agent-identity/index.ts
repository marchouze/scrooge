// platform/agent-identity/index.ts
//
// Barrel export for the A1.2 agent-identity primitives.

export {
  type AgentIdentityIssuer,
  type AgentIdentityIssuerConfig,
  type IssueResult,
  type RotateResult,
  type SignedToken,
  type VerifyResult,
  LocalAgentIdentityIssuer,
} from "./issuer";

export {
  type PermissionPolicy,
  type PermissionPolicyPublisher,
  type PermissionPolicyPublisherConfig,
  type PermissionPolicyResolver,
  type PublishResult,
  derivePermissionPolicy,
  LocalPermissionPolicyPublisher,
} from "./permission-policy";
