// render.js — DOM rendering. Pure-ish: takes state, paints DOM.

import { Storage } from "./storage.js";

export function renderAnalysis(analysis) {
  const status = document.getElementById("analysis-status");
  const body   = document.getElementById("analysis-body");

  if (!analysis) {
    status.textContent = "awaiting text";
    body.innerHTML = `<p class="empty">The poem will be read for tone, recurring images, hookable lines, and whether it actually wants to become a song. Paste something on the left to begin.</p>`;
    return;
  }

  const { metrics, tone, recurring, refrains, tension, verdict, titles } = analysis;
  status.textContent = `${metrics.lineCount} lines · avg ${metrics.avgWords} words / ${metrics.avgSyllables} syl`;

  const toneStr = tone.length ? tone.join(" · ") : "neutral";
  const imagesStr = recurring.length
    ? recurring.map(r => `<em>${escape(r.word)}</em><span class="muted small"> ×${r.count}</span>`).join(", ")
    : `<span class="muted">none recurring</span>`;
  const refrainStr = refrains.length
    ? refrains.map(r => `"${escape(truncate(r.text, 60))}" <span class="muted small">×${r.occurrences}</span>`).join("<br>")
    : `<span class="muted">none yet — could plant one</span>`;
  const titlesStr = titles.length ? titles.slice(0, 3).map(t => escape(t)).join(" · ") : `<span class="muted">—</span>`;

  body.innerHTML = `
    <dl class="analysis-grid">
      <div><dt>Dominant tone</dt><dd>${escape(toneStr)}</dd></div>
      <div><dt>Central tension</dt><dd>${escape(tension)}</dd></div>
      <div><dt>Recurring images</dt><dd>${imagesStr}</dd></div>
      <div><dt>Natural refrain</dt><dd>${refrainStr}</dd></div>
      <div><dt>Title candidates</dt><dd>${titlesStr}</dd></div>
      <div><dt>Singable lines</dt><dd>${metrics.goodLines} of ${metrics.lineCount}</dd></div>
    </dl>
    <div class="analysis-verdict ${verdict.wantsSong ? "" : "warn"}">
      ${escape(verdict.verdict)}
    </div>
  `;
}

export function renderHooks(analysis) {
  const list = document.getElementById("hook-list");
  const status = document.getElementById("hooks-status");

  if (!analysis || !analysis.hooks.length) {
    status.textContent = "";
    list.innerHTML = `<li class="empty muted">Hook candidates will appear here once shaping begins.</li>`;
    return;
  }
  status.textContent = `${analysis.hooks.length} candidate${analysis.hooks.length === 1 ? "" : "s"}`;
  const saved = Storage.get().hooks.map(h => h.text.toLowerCase());
  list.innerHTML = analysis.hooks.map(h => {
    const on = saved.includes(h.text.toLowerCase());
    return `<li>
      <span class="hook-line" data-hook="${escape(h.text)}">${escape(h.text)}</span>
      <span class="hook-meta">${h.fromText ? "in source" : "fabricated"}</span>
      <button class="hook-save ${on ? "saved" : ""}" data-save-hook="${escape(h.text)}" title="Save hook">★</button>
    </li>`;
  }).join("");
}

export function renderDirectionTabs(directions, activeIdx) {
  const tabs = document.querySelectorAll(".dir-tab");
  tabs.forEach((tab, i) => {
    tab.classList.toggle("active", i === activeIdx);
    if (directions[i]) tab.textContent = directions[i].direction;
  });
}

export function renderDirection(direction) {
  const body = document.getElementById("direction-body");
  const foot = document.getElementById("direction-foot");

  if (!direction) {
    foot.hidden = true;
    body.innerHTML = `<div class="empty-pane"><p class="empty">Three shaping directions will appear here: <em>minimal</em>, <em>balanced</em>, and <em>bold</em>. Each will say what it preserves, what it adapts, and why.</p></div>`;
    return;
  }

  foot.hidden = false;

  const sectionHTML = direction.sections.map(sec => `
    <div class="section">
      <div class="section-label">${escape(sec.label)}</div>
      <div class="section-lines">
        ${sec.lines.map((l, i) => `
          <div class="line ${l.source_status}" data-section="${escape(sec.label)}" data-line-idx="${i}" data-line="${escape(l.text)}">
            <span class="marker"></span>
            <span class="text">${escape(l.text)}</span>
            <span class="tools">refine →</span>
          </div>`).join("")}
      </div>
    </div>
  `).join("");

  body.innerHTML = `
    <div class="dir-rationale">${escape(direction.rationale)}</div>

    <dl class="dir-meta">
      <div><dt>Possible title</dt><dd><strong>${escape(direction.possible_title || "—")}</strong></dd></div>
      <div><dt>Emotional core</dt><dd>${escape(direction.emotional_core || "—")}</dd></div>
    </dl>

    <div class="preserve-legend">
      <span><i style="background:var(--moss)"></i>original line</span>
      <span><i style="background:var(--rust)"></i>lightly adapted</span>
      <span><i style="background:var(--plum)"></i>heavily adapted</span>
      <span><i style="background:var(--gold)"></i>new connective</span>
      <span><i style="background:var(--ink-faint)"></i>repeat</span>
    </div>

    ${sectionHTML}

    <div class="dir-notes">
      <h4>Adaptation notes</h4>
      <ul>${(direction.adaptation_notes || []).map(n => `<li>${escape(n)}</li>`).join("")}</ul>
    </div>
  `;
}

export function renderControls(state) {
  // form chips
  document.querySelectorAll("#form-chips .chip").forEach(chip => {
    const on = chip.dataset.form === state.formId;
    chip.classList.toggle("active", on);
    chip.setAttribute("aria-checked", on ? "true" : "false");
  });
  // dial chips
  document.querySelectorAll("#dial-chips .chip").forEach(chip => {
    chip.classList.toggle("active", state.dials.has(chip.dataset.dial));
  });
  // re-shape button
  const btn = document.getElementById("btn-reshape");
  btn.disabled = !(state.analysis && state.dirty);
}

export function renderSourceCounts(text) {
  const counts = document.getElementById("source-counts");
  if (!text) { counts.textContent = ""; return; }
  const lines = text.split("\n").filter(l => l.trim()).length;
  const words = (text.match(/\S+/g) || []).length;
  const chars = text.length;
  counts.textContent = `${lines} lines · ${words} words · ${chars} chars`;
}

export function renderDrawer(store) {
  document.getElementById("drawer-count").textContent = String(store.hooks.length + store.versions.length);

  const hooks = document.getElementById("saved-hooks");
  hooks.innerHTML = store.hooks.length
    ? store.hooks.map(h => `<li><span>${escape(h.text)}</span><span class="saved-actions">
        <button data-copy-hook="${escape(h.text)}" title="Copy">copy</button>
        <button data-rm-hook="${escape(h.text)}" title="Remove">×</button>
      </span></li>`).join("")
    : `<li class="empty muted">No saved hooks yet.</li>`;

  const versions = document.getElementById("saved-versions");
  versions.innerHTML = store.versions.length
    ? store.versions.map(v => `<li>
        <span><strong>${escape(v.title || "Untitled")}</strong>
        <span class="muted small"> · ${escape(v.direction)}</span></span>
        <span class="saved-actions">
          <button data-copy-version="${v.id}" title="Copy lyric sheet">copy</button>
          <button data-rm-version="${v.id}" title="Remove">×</button>
        </span>
      </li>`).join("")
    : `<li class="empty muted">No saved versions yet.</li>`;
}

export function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => { t.hidden = true; }, 1700);
}

// helpers
function escape(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
