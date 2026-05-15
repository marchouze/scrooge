// runtime/agents/callables/scrooge.ts
// Per-agent callable map for Scrooge (Chief of Staff / Orchestrator).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.
//
// Note: scrooge:follow-on-router is NOT included here because it requires a
// two-phase init (circular dependency break with handler-callables.ts). It is
// inserted directly in handler-callables.ts after createHandler() is called.

import scroogeCeoDecisionRecord from "../scrooge-ceo-decision-record";
import scroogeEventTriage from "../scrooge-event-triage";
import scroogeInboxHygiene from "../scrooge-inbox-hygiene";
import scroogeOwnerInboxArchiver from "../scrooge-owner-inbox-archiver";
import type { AgentRunHandler } from "../../types";

export const SCROOGE_CALLABLES: Record<string, AgentRunHandler> = {
  "scrooge:inbox-hygiene": scroogeInboxHygiene,
  "scrooge:ceo-decision-record": scroogeCeoDecisionRecord,
  // "scrooge:follow-on-router" inserted in handler-callables.ts (two-phase init)
  "scrooge:owner-inbox-archiver": scroogeOwnerInboxArchiver,
  "scrooge:event-triage": scroogeEventTriage,
};
