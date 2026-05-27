import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { eventStore } from "../platform/composition";

const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
console.log("open:", reg.open.length);
for (const d of reg.open) console.log(" -", d.decisionId, "|", d.title?.slice(0, 60));
