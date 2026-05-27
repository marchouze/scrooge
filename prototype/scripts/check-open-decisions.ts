import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";

const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
console.log("open:", reg.open.length);
for (const d of reg.open) console.log(" -", d.decisionId, "|", d.title?.slice(0, 60));
