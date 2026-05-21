// dashboard/public/decision.js
//
// Decision drill-down view (A3.2 — read-only). Reads /api/decisions/:id from
// the URL path (`/decisions/<encoded-id>`) and renders the originating
// escalation, the CeoDecision (if landed), the lifecycle event timeline, the
// citation chain, and the comments thread.
//
// Author: Atlas + Anya

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

// Split a recommendation stance into an intro paragraph + bullet list when the
// stance contains an inline slice list like "...: (A) X; (B) Y; (C) Z; (D) W. Trailer."
// The slice markers `(A)` / `(B)` etc. (or bare `A.` / `1.` lists if we later add
// them) are converted into <li> children; anything before the first marker is the
// intro paragraph and anything after the last marker's terminating `.` is a trailer
// paragraph. If no slice list is detected, the whole string is rendered as one <p>.
function renderStanceWithSliceList(text) {
  const sliceMarker = /\s*[;:.]?\s*\(([A-Z])\)\s+/g;
  const matches = [...text.matchAll(sliceMarker)];
  if (matches.length < 2) {
    return el("p", { class: "action-recommendation-body" }, text);
  }
  const firstIdx = matches[0].index;
  const intro = `${text
    .slice(0, firstIdx)
    .trim()
    .replace(/[:;,.]+$/, "")}:`;
  const items = [];
  let trailer = "";
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const startBody = m.index + m[0].length;
    const endBody = i + 1 < matches.length ? matches[i + 1].index : text.length;
    let body = text.slice(startBody, endBody).trim();
    // Last slice: peel off any trailing sentences (text after the first
    // sentence-ending `.` followed by a capital letter) into the trailer.
    if (i === matches.length - 1) {
      const split = body.match(/^(.+?\.)\s+([A-Z].*)$/s);
      if (split) {
        body = split[1];
        trailer = split[2];
      }
    }
    body = body.replace(/[.;]\s*$/, "");
    items.push(
      el("li", {}, [
        el("span", { class: "action-slice-marker" }, `${m[1].toLowerCase()})`),
        el("span", { class: "action-slice-body" }, body),
      ]),
    );
  }
  const children = [el("p", {}, intro), el("ul", { class: "action-slice-list" }, items)];
  if (trailer) {
    children.push(el("p", { class: "action-slice-trailer" }, trailer));
  }
  return el("div", { class: "action-recommendation-body" }, children);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function fmtTimestamp(iso) {
  if (!iso) return "—";
  return iso.slice(0, 19).replace("T", " ");
}

function decisionIdFromPath() {
  // /decisions/<encoded-id>
  const m = window.location.pathname.match(/^\/decisions\/(.+)$/);
  if (!m || !m[1]) return null;
  return decodeURIComponent(m[1]);
}

// ---------------------------------------------------------------------------
// Breadcrumbs

function renderBreadcrumbs(decisionId, title) {
  const nav = $("decisionBreadcrumbs");
  if (!nav) return;
  nav.innerHTML = "";
  const home = el("a", { href: "/" }, "Home");
  const sep1 = el("span", { class: "sep" }, "›");
  const register = el("a", { href: "/decisions" }, "Decisions");
  const sep2 = el("span", { class: "sep" }, "›");
  const leafText = title ? `${decisionId} — ${title}` : (decisionId ?? "(unknown)");
  const leaf = el("span", { class: "leaf" }, leafText);
  nav.appendChild(home);
  nav.appendChild(sep1);
  nav.appendChild(register);
  nav.appendChild(sep2);
  nav.appendChild(leaf);
}

// ---------------------------------------------------------------------------
// Header band — title + authority + status badges, replacing the legacy
// "Decision · <id>" header. Uses the rich registerRow when available.

function renderHeaderBand(data) {
  const reg = data.registerRow;
  const title = reg?.title || data.open?.title || data.resolution?.title || data.decisionId;
  const status = reg?.status || (data.resolution ? "resolved" : data.open ? "open" : "unknown");
  const authority = reg?.forActor || data.open?.authority || "—";
  const category = reg?.category || data.open?.category || "";
  const requestedAt = reg?.requestedAt || data.open?.requestedAt;
  const resolvedAt = reg?.resolvedAt;
  const deadline = reg?.deadline || data.open?.deadline;
  const owner = reg?.owner;

  const strip = el("div", { class: "decision-meta-strip" });
  strip.appendChild(el("span", { class: "status-badge", "data-status": status }, status));
  strip.appendChild(el("span", { class: "pill" }, `Authority: ${authority}`));
  if (category) strip.appendChild(el("span", { class: "pill" }, `Category: ${category}`));
  if (owner?.name && owner.name !== "unknown") {
    const ownerLabel = owner.position
      ? `Owner: ${owner.name} (${owner.position})`
      : `Owner: ${owner.name}`;
    strip.appendChild(el("span", { class: "pill" }, ownerLabel));
  }
  if (requestedAt) strip.appendChild(el("span", {}, `Requested ${fmtDate(requestedAt)}`));
  if (resolvedAt) strip.appendChild(el("span", {}, `Resolved ${fmtDate(resolvedAt)}`));
  if (deadline) strip.appendChild(el("span", {}, `Deadline ${fmtDate(deadline)}`));

  return el("section", { class: "band" }, [
    el("h1", { class: "decision-title" }, title),
    el(
      "div",
      { class: "muted small mono", style: "margin-bottom:var(--space-2)" },
      data.decisionId,
    ),
    strip,
  ]);
}

// ---------------------------------------------------------------------------
// Recommendation panel from the register row (open decisions and historical
// decisions both carry a recommendation stance + reasoning).

function renderRecommendationBand(reg) {
  if (!reg) return null;
  const stance = reg.recommendation?.stance;
  const reasoning = reg.recommendation?.reasoning;
  if (!stance && !reasoning) return null;
  const children = [];
  if (stance) {
    children.push(el("div", { class: "reco-label" }, "Recommendation"));
    children.push(renderStanceWithSliceList(stance));
  }
  if (reasoning) {
    children.push(el("div", { class: "reco-label" }, "Reasoning"));
    children.push(el("p", { class: "reco-body" }, reasoning));
  }
  if (reg.decisionForActor) {
    children.push(el("div", { class: "reco-label" }, `Decision for ${reg.forActor ?? "actor"}`));
    children.push(el("p", { class: "reco-body" }, reg.decisionForActor));
  }
  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Brief")]),
    el("div", { class: "drill-card" }, [el("div", { class: "reco-panel" }, children)]),
  ]);
}

// ---------------------------------------------------------------------------
// Options the decider had to choose between.

function renderOptionsBand(reg) {
  if (!reg || !Array.isArray(reg.options) || reg.options.length === 0) return null;
  const ol = el("ol", { class: "options-list" });
  for (const o of reg.options) {
    // Options may be strings or { label, description } objects.
    if (typeof o === "string") {
      ol.appendChild(el("li", {}, o));
    } else if (o && typeof o === "object") {
      const label = o.label ?? o.option ?? "";
      const desc = o.description ?? o.reasoning ?? "";
      ol.appendChild(
        el(
          "li",
          {},
          [el("strong", {}, label), desc ? el("span", {}, ` — ${desc}`) : null].filter(Boolean),
        ),
      );
    }
  }
  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Options considered")]),
    el("div", { class: "drill-card" }, [ol]),
  ]);
}

// ---------------------------------------------------------------------------
// Citations — merged from the escalation envelope (data.citations) AND the
// register row (reg.decisionCitations). Each chip is clickable: if the
// citation looks like a decision id (D-…), link to /decisions/<id>; if it
// looks like a file path, link relatively; otherwise plain text.

function citationChip(c) {
  const isDecisionId = /^D-[A-Z0-9-]+$/.test(c);
  const isPath = c.includes("/") || c.endsWith(".md");
  if (isDecisionId) {
    return el(
      "a",
      { class: "cite-chip is-decision", href: `/decisions/${encodeURIComponent(c)}` },
      c,
    );
  }
  if (isPath) {
    return el("a", { class: "cite-chip", href: `/${c}`, target: "_blank" }, c);
  }
  return el("span", { class: "cite-chip" }, c);
}

function renderCitationsBand(data) {
  const fromEnvelope = Array.isArray(data.citations) ? data.citations : [];
  const fromRegister = Array.isArray(data.registerRow?.decisionCitations)
    ? data.registerRow.decisionCitations
    : [];
  const all = [...new Set([...fromEnvelope, ...fromRegister])];
  if (all.length === 0) return null;
  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Citations")]),
    el("div", { class: "drill-card" }, [
      el(
        "p",
        { class: "muted small" },
        "Principle 2 — citation chain anchoring this decision to policy / regulation / prior decisions.",
      ),
      el("div", {}, all.map(citationChip)),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// Source documents — BLAKE3-addressed content from the document store.
// Each entry exposes a "Preview" toggle that fetches the raw text from
// /api/rms/document-content?hash=<blake3:...>.

function sourceDocItem(hash) {
  const previewBtn = el(
    "a",
    { href: "#", class: "cite-chip", "data-action": "preview" },
    "Preview",
  );
  const downloadLink = el(
    "a",
    {
      href: `/api/rms/document-content?hash=${encodeURIComponent(hash)}`,
      target: "_blank",
      class: "cite-chip",
    },
    "Open raw",
  );
  const previewPane = el("div", { class: "src-doc-preview", style: "display:none" });
  previewBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (previewPane.style.display === "none") {
      previewPane.textContent = "Loading…";
      previewPane.style.display = "";
      try {
        const r = await fetch(`/api/rms/document-content?hash=${encodeURIComponent(hash)}`);
        if (!r.ok) {
          previewPane.textContent = `Document not found (HTTP ${r.status})`;
          return;
        }
        previewPane.textContent = await r.text();
      } catch (err) {
        previewPane.textContent = `Error: ${err.message}`;
      }
    } else {
      previewPane.style.display = "none";
    }
  });
  return el("div", { class: "src-doc-wrap" }, [
    el("div", { class: "src-doc" }, [
      el("code", {}, hash),
      el("span", { style: "margin-left:auto;display:flex;gap:var(--space-1);" }, [
        previewBtn,
        downloadLink,
      ]),
    ]),
    previewPane,
  ]);
}

function renderSourceDocsBand(reg) {
  if (!reg || !Array.isArray(reg.sourceDocumentHashes) || reg.sourceDocumentHashes.length === 0) {
    return null;
  }
  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Source documents")]),
    el("div", { class: "drill-card" }, reg.sourceDocumentHashes.map(sourceDocItem)),
  ]);
}

function renderEscalation(esc) {
  const sealedTag = esc.sealedReason
    ? el("span", { class: "pill esc-sealed" }, `sealed · ${esc.sealedReason}`)
    : null;
  const overdueTag = esc.overdue ? el("span", { class: "pill esc-overdue" }, "overdue") : null;
  const sevCls =
    esc.severity === "blocking"
      ? "esc-sev-blocking"
      : esc.severity === "high"
        ? "esc-sev-high"
        : esc.severity === "medium"
          ? "esc-sev-medium"
          : "esc-sev-low";
  const wrap = el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Originating escalation")]),
    el("div", { class: "drill-card" }, [
      el("div", { class: "drill-id-row" }, [
        el("span", { class: "esc-id" }, esc.escalationId),
        el("span", { class: `pill esc-stat stat-${esc.status}` }, esc.status),
        overdueTag,
        sealedTag,
        el("span", { class: `pill ${sevCls}` }, esc.severity),
      ]),
      el("h3", { class: "drill-question" }, esc.question),
      el("dl", { class: "drill-dl" }, [
        el("dt", {}, "Raised by"),
        el("dd", {}, esc.raisedBy),
        el("dt", {}, "Raised at"),
        el("dd", {}, fmtTimestamp(esc.raisedAt)),
        el("dt", {}, "Routed to"),
        el("dd", {}, esc.routedTo),
        el("dt", {}, "Current responsible"),
        el("dd", {}, esc.currentResponsible),
        ...(esc.deadline
          ? [el("dt", {}, "Deadline"), el("dd", {}, fmtTimestamp(esc.deadline))]
          : []),
        ...(esc.blockedBy ? [el("dt", {}, "Blocked by"), el("dd", {}, esc.blockedBy)] : []),
        el("dt", {}, "Acknowledgements"),
        el("dd", {}, String(esc.acknowledgementCount)),
        el("dt", {}, "Delegations"),
        el("dd", {}, String(esc.delegationCount)),
      ]),
      el("h4", {}, "Options considered"),
      esc.options && esc.options.length > 0
        ? (() => {
            const ul = el("ul", { class: "esc-options" });
            for (const o of esc.options) ul.appendChild(el("li", {}, o));
            return ul;
          })()
        : el("p", { class: "muted small" }, "No options enumerated."),
    ]),
  ]);
  return wrap;
}

function renderResolution(res, registerRow) {
  // Prefer the RMS register's resolution (richer + canonical) when available;
  // fall back to the legacy projection shape (res).
  const reg = registerRow?.resolution;
  const action = reg?.action ?? res.action ?? "—";
  const outcome = reg?.outcome ?? res.outcome ?? "—";
  const comment = reg?.comment ?? res.comment ?? "";
  const actionedAt = reg?.resolvedAt ?? res.actionedAt;
  const actionedBy = reg?.actorId ?? res.actionedBy ?? "—";
  const recordedVia = reg?.recordedVia;

  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Resolution")]),
    el("div", { class: "drill-card" }, [
      el("div", { class: "outcome-panel" }, [
        el("div", {}, [el("span", { class: "outcome-action" }, action)]),
        el("p", { class: "reco-body", style: "margin-top:var(--space-2)" }, outcome),
      ]),
      el("dl", { class: "drill-dl", style: "margin-top:var(--space-3)" }, [
        el("dt", {}, "Actioned at"),
        el("dd", {}, fmtTimestamp(actionedAt)),
        el("dt", {}, "Actioned by"),
        el("dd", {}, actionedBy),
        ...(recordedVia ? [el("dt", {}, "Recorded via"), el("dd", {}, recordedVia)] : []),
        ...(comment && comment !== outcome ? [el("dt", {}, "Comment"), el("dd", {}, comment)] : []),
      ]),
    ]),
  ]);
}

function renderOpen(open) {
  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Decision (currently open)")]),
    el("div", { class: "drill-card" }, [
      el("h3", {}, open.title),
      el("dl", { class: "drill-dl" }, [
        el("dt", {}, "Owner"),
        el("dd", {}, open.owner),
        el("dt", {}, "Category"),
        el("dd", {}, open.category),
        el("dt", {}, "Decision for CEO"),
        el("dd", {}, open.decisionForCEO ?? "—"),
        ...(open.recommendation?.stance
          ? [
              el("dt", {}, "Recommendation"),
              el(
                "dd",
                {},
                open.recommendation.reasoning
                  ? `${open.recommendation.stance} ${open.recommendation.reasoning}`
                  : open.recommendation.stance,
              ),
            ]
          : []),
        ...(open.note ? [el("dt", {}, "Note"), el("dd", {}, open.note)] : []),
      ]),
    ]),
  ]);
}

function renderLifecycle(lifecycle) {
  if (!lifecycle || lifecycle.length === 0) return null;
  const ul = el("ul", { class: "lifecycle-list" });
  for (const ev of lifecycle) {
    const cls =
      ev.type === "AgentEscalation"
        ? "lc-open"
        : ev.type === "AgentEscalationDecided"
          ? "lc-decided"
          : ev.type === "AgentEscalationDelegated"
            ? "lc-delegated"
            : ev.type === "AgentEscalationOverdue"
              ? "lc-overdue"
              : "lc-ack";
    ul.appendChild(
      el("li", { class: `lifecycle-item ${cls}` }, [
        el("div", { class: "lc-head" }, [
          el("span", { class: "lc-type" }, ev.type),
          el("span", { class: "lc-when muted small" }, fmtTimestamp(ev.asOf)),
        ]),
        el("div", { class: "lc-summary" }, ev.summary),
        el("div", { class: "lc-actor muted small mono" }, `actor: ${ev.actor}`),
      ]),
    );
  }
  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Lifecycle timeline")]),
    ul,
  ]);
}

function renderComments(comments) {
  if (!comments || comments.length === 0) {
    return el("section", { class: "band" }, [
      el("div", { class: "band-head" }, [el("h2", {}, "Comments")]),
      el("p", { class: "muted" }, "No comments on this decision yet."),
    ]);
  }
  const list = el("ul", { class: "comments-list" });
  for (const c of comments) {
    const cls =
      c.actorType === "human"
        ? "comment-human"
        : c.actorType === "agent"
          ? "comment-agent"
          : "comment-system";
    list.appendChild(
      el("li", { class: `comment ${cls}` }, [
        el("div", { class: "comment-head" }, [
          el("span", { class: "comment-author" }, c.author),
          el("span", { class: "comment-actor" }, c.actorId),
          el("span", { class: "comment-time muted small" }, fmtTimestamp(c.asOf)),
        ]),
        el("div", { class: "comment-body" }, c.body),
      ]),
    );
  }
  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Comments")]),
    list,
  ]);
}

function renderPopiaNotice(notice) {
  if (!notice) return null;
  return el("section", { class: "band popia-band" }, [
    el("div", { class: "popia-card" }, [
      el("h2", { class: "popia-heading" }, notice.heading),
      el("p", { class: "popia-body" }, notice.body),
      el(
        "ul",
        { class: "citation-list" },
        notice.citations.map((c) => el("li", { class: "citation-item" }, [el("code", {}, c)])),
      ),
      el(
        "p",
        { class: "muted small" },
        "Standing template — Iris is the canonical owner; this surface refines per Iris's spec §11.",
      ),
    ]),
  ]);
}

function renderActionPanel(open, decisionId) {
  // Build the action panel for an open decision.
  const statusEl = el("div", { class: "action-error", style: "display:none" });
  const successEl = el("div", { class: "action-success", style: "display:none" });

  // Authority
  const authority = open.authority ?? "CEO";
  const authorityEl = el("div", { class: "action-authority" }, `Authority required: ${authority}`);

  // Decision prompt — suppressed when it duplicates the recommendation stance
  // (the projection populates both `decisionForCEO` and `recommendation.stance`
  // from the same source field; on this surface the recommendation block
  // already carries the content, so the standalone prompt would be a wall of
  // duplicate text).
  const stance = open.recommendation?.stance ?? "";
  const promptText = open.decisionForCEO ?? "";
  const promptIsDuplicate = promptText && stance && promptText.trim() === stance.trim();
  const promptEl =
    promptText && !promptIsDuplicate ? el("div", { class: "action-prompt" }, promptText) : null;

  // Recommendation (optional). Render stance and reasoning as separate
  // paragraphs, and split an inline slice list like
  //   "Approve a 4-slice programme: (A) X; (B) Y; (C) Z; (D) W. Each ..."
  // into a bulleted list so the page does not become a single wall of text.
  let recoEl = null;
  if (stance) {
    const stanceNode = renderStanceWithSliceList(stance);
    const children = [
      el("div", { class: "action-recommendation-label" }, "Recommendation"),
      stanceNode,
    ];
    if (open.recommendation?.reasoning) {
      children.push(el("div", { class: "action-recommendation-label" }, "Reasoning"));
      children.push(
        el("p", { class: "action-recommendation-body" }, open.recommendation.reasoning),
      );
    }
    recoEl = el("div", { class: "action-recommendation" }, children);
  }

  // Source docs (optional)
  let sourceDocsEl = null;
  if (open.sourceDocs && open.sourceDocs.length > 0) {
    const items = open.sourceDocs.map((doc) => {
      // If it looks like a path, make it a relative link; otherwise show as text.
      const isPath = doc.startsWith("/") || doc.includes(".md") || doc.includes("/");
      return isPath
        ? el("li", {}, el("a", { href: doc, target: "_blank" }, doc))
        : el("li", {}, doc);
    });
    const ul = el("ul", {}, items);
    sourceDocsEl = el("div", { class: "action-source-docs" }, [
      el("span", { class: "action-form-label" }, "Source documents"),
      ul,
    ]);
  }

  // Outcome textarea (required)
  const outcomeId = `action-outcome-${decisionId}`;
  const outcomeTextarea = el("textarea", {
    id: outcomeId,
    class: "action-textarea",
    placeholder: "Outcome — describe what was decided…",
    rows: "4",
  });
  const outcomeField = el("div", {}, [
    el("label", { class: "action-form-label", for: outcomeId }, "Outcome (required)"),
    outcomeTextarea,
  ]);

  // Comment textarea (optional)
  const commentId = `action-comment-${decisionId}`;
  const commentTextarea = el("textarea", {
    id: commentId,
    class: "action-textarea",
    placeholder: "Comment (optional)",
    rows: "3",
  });
  const commentField = el("div", {}, [
    el("label", { class: "action-form-label", for: commentId }, "Comment (optional)"),
    commentTextarea,
  ]);

  // Action buttons
  const btnApprove = el("button", { class: "btn-approve", type: "button" }, "Approve");
  const btnDefer = el("button", { class: "btn-defer", type: "button" }, "Defer");
  const btnModify = el("button", { class: "btn-modify", type: "button" }, "Modify");
  const btnRevision = el("button", { class: "btn-revision", type: "button" }, "Request Revision");
  const allButtons = [btnApprove, btnDefer, btnModify, btnRevision];

  const buttonsEl = el("div", { class: "action-buttons" }, allButtons);

  async function submit(action) {
    const outcome = outcomeTextarea.value.trim();
    if (!outcome) {
      statusEl.textContent = "Outcome is required — describe what was decided.";
      statusEl.style.display = "";
      successEl.style.display = "none";
      return;
    }
    statusEl.style.display = "none";
    successEl.style.display = "none";
    for (const b of allButtons) b.disabled = true;
    try {
      const body = {
        actor: "marc@tgv.co.za",
        decisionId,
        action,
        outcome,
        comment: commentTextarea.value.trim() || undefined,
      };
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      successEl.textContent = `Decision recorded (${action}). Refreshing…`;
      successEl.style.display = "";
      setTimeout(() => location.reload(), 1500);
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
      statusEl.style.display = "";
      for (const b of allButtons) b.disabled = false;
    }
  }

  btnApprove.addEventListener("click", () => submit("approve"));
  btnDefer.addEventListener("click", () => submit("defer"));
  btnModify.addEventListener("click", () => submit("modify"));
  btnRevision.addEventListener("click", () => submit("request-revision"));

  const formGroup = el("div", { class: "action-form-group" }, [
    el("div", { class: "action-form-heading" }, "Take an action"),
    outcomeField,
    commentField,
    buttonsEl,
    statusEl,
    successEl,
  ]);

  const panel = el(
    "div",
    { class: "decision-action-panel" },
    [el("h3", {}, open.title), authorityEl, promptEl, recoEl, sourceDocsEl, formGroup].filter(
      Boolean,
    ),
  );

  return el("section", { class: "band" }, [
    el("div", { class: "band-head" }, [el("h2", {}, "Act on this decision")]),
    panel,
  ]);
}

function renderNotFound(decisionId) {
  renderBreadcrumbs(decisionId ?? "(unknown)", null);
  const wrap = $("decisionContent");
  wrap.innerHTML = "";
  wrap.appendChild(
    el("section", { class: "band" }, [
      el("div", { class: "band-head" }, [el("h1", {}, "Decision not found")]),
      el("p", {}, [
        "No matching record for ",
        el("code", {}, decisionId ?? "(no id)"),
        ". This ID may be referenced as a citation but has not yet been recorded as a Decision event. Browse the ",
        el("a", { href: "/decisions" }, "Decisions register"),
        " or try the ",
        el("a", { href: "/escalations" }, "escalation inbox"),
        ".",
      ]),
    ]),
  );
}

function renderStrategyBanner(state) {
  const banner = $("strategyBanner");
  if (!banner) return;
  const phase = state?.bank?.operatingPosture ?? "—";
  const openCount = (state?.decisionsOpen ?? []).length;
  const agentCount = (state?.agents ?? []).length;
  banner.innerHTML = "";
  banner.appendChild(el("span", { class: "banner-phase" }, `Phase: ${phase}`));
  banner.appendChild(el("span", { class: "banner-sep" }, " · "));
  banner.appendChild(el("span", {}, `${openCount} decision${openCount === 1 ? "" : "s"} open`));
  banner.appendChild(el("span", { class: "banner-sep" }, " · "));
  banner.appendChild(el("span", {}, `${agentCount} agent${agentCount === 1 ? "" : "s"} reporting`));
}

async function load() {
  const live = $("liveDot");
  const stamp = $("lastUpdated");
  const decisionId = decisionIdFromPath();
  if (!decisionId) {
    renderNotFound(null);
    return;
  }
  try {
    const [drillR, stateR] = await Promise.all([
      fetch(`/api/decisions/${encodeURIComponent(decisionId)}`, { cache: "no-store" }),
      fetch("/api/state", { cache: "no-store" }),
    ]);
    const state = stateR.ok ? await stateR.json() : null;
    renderStrategyBanner(state);
    if (drillR.status === 404) {
      renderNotFound(decisionId);
      live.classList.add("bad");
      stamp.textContent = "Decision not found";
      return;
    }
    if (!drillR.ok) throw new Error(`HTTP ${drillR.status}`);
    const data = await drillR.json();
    const wrap = $("decisionContent");
    wrap.innerHTML = "";
    // Breadcrumbs.
    const titleForCrumb = data.registerRow?.title || data.open?.title || data.resolution?.title;
    renderBreadcrumbs(data.decisionId, titleForCrumb);
    // Header band (title, status, authority, dates).
    wrap.appendChild(renderHeaderBand(data));
    if (data.popiaS71) {
      const notice = renderPopiaNotice(data.popiaNotice);
      if (notice) wrap.appendChild(notice);
    }
    // Brief — recommendation + reasoning + decision-for-actor prompt.
    const reco = renderRecommendationBand(data.registerRow);
    if (reco) wrap.appendChild(reco);
    // Options the decider had to choose between.
    const opts = renderOptionsBand(data.registerRow);
    if (opts) wrap.appendChild(opts);
    // Originating escalation (when present).
    if (data.escalation) wrap.appendChild(renderEscalation(data.escalation));
    // Resolution or open action panel.
    if (data.resolution) wrap.appendChild(renderResolution(data.resolution, data.registerRow));
    else if (data.open) {
      wrap.appendChild(renderOpen(data.open));
      wrap.appendChild(renderActionPanel(data.open, data.decisionId));
    }
    // Source documents (BLAKE3 hashes, with preview toggle).
    const srcDocs = renderSourceDocsBand(data.registerRow);
    if (srcDocs) wrap.appendChild(srcDocs);
    // Citations (envelope + register, deduped, clickable).
    const citations = renderCitationsBand(data);
    if (citations) wrap.appendChild(citations);
    // Lifecycle (escalation events).
    const lifecycle = renderLifecycle(data.lifecycle);
    if (lifecycle) wrap.appendChild(lifecycle);
    // Comments.
    wrap.appendChild(renderComments(data.comments));

    live.classList.add("ok");
    stamp.textContent = `Updated ${fmtDate(data.asOf)}`;
  } catch (e) {
    live.classList.add("bad");
    stamp.textContent = `Offline (${e.message})`;
  }
}

load();
if (typeof window.registerPagePoll === "function") {
  window.registerPagePoll(load, 30_000);
} else {
  setInterval(load, 30_000);
}
