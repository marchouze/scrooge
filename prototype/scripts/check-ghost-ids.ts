import { eventStore } from "../platform/composition";

const allEvents = [...eventStore.replay({})];
const types = new Set(allEvents.map((e) => (e as { type: string }).type));
console.log("Event types:", [...types].sort().join(", "));

const topKeys = new Set<string>();
for (const e of allEvents) {
  for (const k of Object.keys(e as object)) {
    topKeys.add(k);
  }
}
console.log("Top-level keys:", [...topKeys].sort().join(", "));

process.stdout.write(JSON.stringify(allEvents));
