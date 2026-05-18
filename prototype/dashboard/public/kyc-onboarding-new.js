// dashboard/public/kyc-onboarding-new.js
//
// 5-step KYC intake form — /kyc-onboarding/new
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001 s.21-21B (CDD).
// Author: Atlas (Core banking platform architect, engineering)

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// State

let _currentStep = 1;
const directors = []; // { name, idNumber, role }
const ubos = []; // { name, idNumber, nationality, ownershipPct, basisOfControl }
const fileHashes = []; // { name, hash, sha256 }

// ---------------------------------------------------------------------------
// Step navigation

function goStep(n) {
  if (n === 2 && !validateStep1()) return;
  if (n === 3 && !validateStep2()) return;
  if (n === 4 && !validateStep3()) return;
  if (n === 5) {
    if (!validateStep4()) return;
    renderReview();
  }

  for (let i = 1; i <= 5; i++) {
    const el = $(`step${i}`);
    if (el) el.hidden = i !== n;
    const nav = document.querySelector(`.step-item[data-step="${i}"]`);
    if (nav) {
      nav.className = `step-item${i === n ? " active" : i < n ? " done" : ""}`;
    }
  }
  _currentStep = n;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.goStep = goStep;

// ---------------------------------------------------------------------------
// Validation helpers

function showToast(msg, type = "error") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => {
    t.className = "toast";
  }, 4000);
}

function validateStep1() {
  const fields = [
    "entityName",
    "entityType",
    "jurisdiction",
    "registrationNumber",
    "registeredAddress",
  ];
  for (const f of fields) {
    const el = $(f);
    if (!el || !el.value.trim()) {
      showToast(`Please fill in "${el?.labels?.[0]?.textContent?.replace(" *", "") ?? f}"`);
      el?.focus();
      return false;
    }
  }
  return true;
}

function validateStep2() {
  if (directors.length === 0) {
    showToast("At least one director is required.");
    return false;
  }
  for (const d of directors) {
    if (!d.name || !d.idNumber || !d.role) {
      showToast("Please complete all director fields.");
      return false;
    }
  }
  return true;
}

function validateStep3() {
  if (ubos.length === 0) {
    showToast("At least one UBO is required (FIC Act s.21B).");
    return false;
  }
  for (const u of ubos) {
    if (!u.name || !u.idNumber || !u.nationality || !u.basisOfControl) {
      showToast("Please complete all UBO fields.");
      return false;
    }
    if (u.ownershipPct < 0 || u.ownershipPct > 100) {
      showToast("Ownership % must be between 0 and 100.");
      return false;
    }
  }
  return true;
}

function validateStep4() {
  // Documents are recommended but not blocking — emit warning only
  if (fileHashes.length === 0) {
    showToast(
      "No documents uploaded. At least one document is recommended (CIPC certificate).",
      "error",
    );
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Directors

function renderDirectors() {
  const c = $("directorsContainer");
  c.innerHTML = directors
    .map(
      (d, i) => `
    <div class="repeat-row" id="dir-${i}">
      <button class="remove-btn" onclick="removeDirector(${i})" title="Remove">×</button>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:8px">
          <label>Full name</label>
          <input type="text" value="${esc(d.name)}" onchange="directors[${i}].name=this.value" placeholder="As per ID document">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>SA ID number</label>
          <input type="text" value="${esc(d.idNumber)}" onchange="directors[${i}].idNumber=this.value" placeholder="13-digit number">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Role</label>
        <input type="text" value="${esc(d.role)}" onchange="directors[${i}].role=this.value" placeholder="e.g. Director, CEO, Trustee">
      </div>
    </div>
  `,
    )
    .join("");
}

function addDirector() {
  directors.push({ name: "", idNumber: "", role: "" });
  renderDirectors();
}
window.addDirector = addDirector;

function removeDirector(i) {
  directors.splice(i, 1);
  renderDirectors();
}
window.removeDirector = removeDirector;

// ---------------------------------------------------------------------------
// UBOs

function renderUBOs() {
  const c = $("ubosContainer");
  c.innerHTML = ubos
    .map(
      (u, i) => `
    <div class="repeat-row" id="ubo-${i}">
      <button class="remove-btn" onclick="removeUBO(${i})" title="Remove">×</button>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:8px">
          <label>Full name</label>
          <input type="text" value="${esc(u.name)}" onchange="ubos[${i}].name=this.value">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>SA ID number</label>
          <input type="text" value="${esc(u.idNumber)}" onchange="ubos[${i}].idNumber=this.value">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:8px">
          <label>Nationality (ISO code)</label>
          <input type="text" value="${esc(u.nationality)}" onchange="ubos[${i}].nationality=this.value" placeholder="e.g. ZA, NG, GB">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label>Ownership % (≥25% threshold)</label>
          <input type="number" min="0" max="100" value="${u.ownershipPct}" onchange="ubos[${i}].ownershipPct=Number(this.value)">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Basis of control</label>
        <input type="text" value="${esc(u.basisOfControl)}" onchange="ubos[${i}].basisOfControl=this.value" placeholder="e.g. direct-ownership, nominee arrangement">
      </div>
    </div>
  `,
    )
    .join("");
}

function addUBO() {
  ubos.push({ name: "", idNumber: "", nationality: "ZA", ownershipPct: 25, basisOfControl: "" });
  renderUBOs();
}
window.addUBO = addUBO;

function removeUBO(i) {
  ubos.splice(i, 1);
  renderUBOs();
}
window.removeUBO = removeUBO;

// ---------------------------------------------------------------------------
// File upload + SHA-256 hashing

async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const hashBuf = await window.crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

$("fileInput").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files ?? []);
  for (const file of files) {
    const hash = await hashFile(file);
    if (!fileHashes.find((f) => f.hash === hash)) {
      fileHashes.push({ name: file.name, hash });
    }
  }
  renderFileList();
  e.target.value = "";
});

function renderFileList() {
  $("fileList").innerHTML = fileHashes
    .map(
      (f, i) => `
    <div class="upload-file-item">
      <span>${esc(f.name)}</span>
      <span class="file-hash">${f.hash.slice(0, 20)}…</span>
      <button class="file-remove" onclick="removeFile(${i})" title="Remove">×</button>
    </div>
  `,
    )
    .join("");
}

function removeFile(i) {
  fileHashes.splice(i, 1);
  renderFileList();
}
window.removeFile = removeFile;

// ---------------------------------------------------------------------------
// Review

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReview() {
  const html = `
    <div class="review-section">
      <h3>Entity</h3>
      <dl class="review-dl">
        <dt>Name</dt><dd>${esc($("entityName").value)}</dd>
        <dt>Type</dt><dd>${esc($("entityType").value)}</dd>
        <dt>Reg. number</dt><dd>${esc($("registrationNumber").value)}</dd>
        <dt>Jurisdiction</dt><dd>${esc($("jurisdiction").value)}</dd>
        <dt>Reg. address</dt><dd>${esc($("registeredAddress").value)}</dd>
      </dl>
    </div>
    <div class="review-section">
      <h3>Directors (${directors.length})</h3>
      ${directors
        .map(
          (d) => `<dl class="review-dl">
        <dt>Name</dt><dd>${esc(d.name)}</dd>
        <dt>ID number</dt><dd>${esc(d.idNumber)}</dd>
        <dt>Role</dt><dd>${esc(d.role)}</dd>
      </dl>`,
        )
        .join("<hr style='border:none;border-top:1px solid #eee;margin:8px 0'>")}
    </div>
    <div class="review-section">
      <h3>UBOs (${ubos.length})</h3>
      ${ubos
        .map(
          (u) => `<dl class="review-dl">
        <dt>Name</dt><dd>${esc(u.name)}</dd>
        <dt>ID number</dt><dd>${esc(u.idNumber)}</dd>
        <dt>Nationality</dt><dd>${esc(u.nationality)}</dd>
        <dt>Ownership</dt><dd>${u.ownershipPct}%</dd>
        <dt>Basis</dt><dd>${esc(u.basisOfControl)}</dd>
      </dl>`,
        )
        .join("<hr style='border:none;border-top:1px solid #eee;margin:8px 0'>")}
    </div>
    <div class="review-section">
      <h3>Documents (${fileHashes.length})</h3>
      ${fileHashes
        .map(
          (f) => `<div style="font-size:12.5px;margin-bottom:4px">
        <strong>${esc(f.name)}</strong>
        <span style="font-family:var(--mono);font-size:11px;color:#666;margin-left:8px">${esc(f.hash.slice(0, 30))}…</span>
      </div>`,
        )
        .join("")}
    </div>
  `;
  $("reviewContent").innerHTML = html;
}

// ---------------------------------------------------------------------------
// Submit

async function submitForm() {
  const btn = $("submitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  const payload = {
    entityName: $("entityName").value.trim(),
    entityType: $("entityType").value,
    registrationNumber: $("registrationNumber").value.trim(),
    jurisdiction: $("jurisdiction").value.trim(),
    registeredAddress: $("registeredAddress").value.trim(),
    directors: directors.map((d) => ({ name: d.name, idNumber: d.idNumber, role: d.role })),
    ubos: ubos.map((u) => ({
      name: u.name,
      idNumber: u.idNumber,
      nationality: u.nationality,
      ownershipPct: u.ownershipPct,
      basisOfControl: u.basisOfControl,
    })),
    documentHashes: fileHashes.map((f) => f.hash),
    submittedBy: window.bankShell?.user?.id ?? "marc@tgv.co.za",
  };

  try {
    const res = await fetch("/api/kyc/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `Server error ${res.status}`);
    }
    showToast(`Candidate registered: ${data.candidateId.slice(0, 12)}…`, "success");
    setTimeout(() => {
      window.location.href = `/kyc-onboarding/${encodeURIComponent(data.candidateId)}`;
    }, 800);
  } catch (e) {
    showToast(`Submit failed: ${e.message}`);
    btn.disabled = false;
    btn.textContent = "Submit for KYC →";
  }
}
window.submitForm = submitForm;

// ---------------------------------------------------------------------------
// Init — seed one director + one UBO to avoid empty form

addDirector();
addUBO();
