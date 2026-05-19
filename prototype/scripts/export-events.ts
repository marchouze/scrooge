import { writeFileSync } from "node:fs";
import { eventStore } from "../platform/composition";

const allEvents = [...eventStore.replay({})];
writeFileSync("/tmp/bank-events.json", JSON.stringify(allEvents));
console.log("Wrote", allEvents.length, "events to /tmp/bank-events.json");
