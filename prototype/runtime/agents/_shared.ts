// runtime/agents/_shared.ts
//
// Tiny helpers shared across agent handlers. Kept deliberately thin —
// per-agent logic stays in the handler file. Anything that grows here
// gets promoted to platform/ when warranted.
//
// Author: Atlas

export function fmtDateUTC(iso: string): string {
  return iso.slice(0, 10);
}

export function frontmatter(agent: string, trigger: string, asOf: string): string {
  return [
    "---",
    `agent: ${agent}`,
    `trigger: ${trigger}`,
    `asOf: ${asOf}`,
    "decision-required: false",
    "---",
    "",
  ].join("\n");
}
