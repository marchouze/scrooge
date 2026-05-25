// dashboard/config-view.ts
//
// Thin view adapter for the platform configuration API.
// The loader does the heavy lifting; this module provides a named export
// for use in server.ts route handlers.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
// Author: Atlas (Core banking platform architect, engineering)

import { getResolvedConfig } from "../platform/config/loader";
import type { ResolvedConfig } from "../platform/config/schema";

export function buildConfigView(): ResolvedConfig {
  return getResolvedConfig();
}
