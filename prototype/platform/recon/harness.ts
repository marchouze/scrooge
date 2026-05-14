// platform/recon/harness.ts
//
// DEPRECATED: renamed to recon-self-test.ts (F-004 fix, 2026-05-14).
// This shim re-runs the new file so any caller still pointing here continues
// to work. The `recon` npm script in package.json now points to
// recon-self-test.ts directly.
//
// DO NOT add new code here. Update recon-self-test.ts instead.

import "./recon-self-test";
