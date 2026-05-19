// platform/alm/__tests__/test-utils.ts
//
// Shared test utilities for ALM engine tests.
//
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { EventStore } from "../../event-store/store";

/**
 * Create a fresh in-memory EventStore with no events.
 * Used in all ALM engine zero-position baseline tests.
 */
export function makeTestEventStore(): EventStore {
  return new EventStore(":memory:");
}
