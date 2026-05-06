// app.js — controller. Wires the UI to the engine modules.

import * as State from "./state.js";
import { analyze } from "./analyzer.js";
import { shape }   from "./shaper.js";
import { variantsFor } from "./compressor.js";
import { examples } from "./examples.js";
import { Storage } from "./storage.js";
import {
  renderAnalysis, renderHooks, renderDirectionTabs, renderDirection,
  renderControls, renderSourceCounts, renderDrawer, showToast
} from "./render.js";
import { asLyricSheet, asMarkdown, asHooksOnly, copyToClipboard } from "./export.js";
import { proposeForSection, fillThinSections, thinSectionIndices, isAvailable as aiAvailable } from "./ai.js";

// ── boot ─────────────────────────────────────────────────────────────────
function boot() {
  State.loadTheme();

  // Restore last session if present.
  const last = Storage.get().last;
  if (last && last.source) {
    document.getElementById("source").value = last.source;
    State.set({
      source: last.source,
      formId: last.formId || "singer-songwriter",
      dials: new Set(last.dials || [])
    });
  }

  wireSource();
  wireControls();
  wireDirections();
  wireDrawer();
  wireExamples();
  wireExport();
  wireLineModal();
  wireProposeModal();
  wireTheme();

  // Initial render.
  State.subscribe(state => {
    renderControls(state);
    renderSourceCounts(state.source);
    renderAnalysis(state.analysis);
    renderHooks(state.analysis);
    renderDirectionTabs(state.directions, state.activeDir);
    renderDirection(state.directions[state.activeDir]);
  });

  Storage.subscribe(store => {
    renderDrawer(store);
    // re-render hooks panel for save-state changes
    const a = State.get().analysis;
    if (a) renderHooks(a);
  });

  // If we restored a source, run shape automatically.
  if (last && last.source) runShape();
}

// ── source ──────────────────────────────────────────────────────────────
function wireSource() {
  const ta = document.getElementById("source");
  ta.addEventListener("input", e => {
    State.set({ source: e.target.value, dirty: true });
  });
  document.getElementById("btn-clear").addEventListener("click", () => {
    ta.value = "";
    State.set({ source: "", analysis: null, directions: [], activeDir: 0, dirty: false });
    Storage.saveLast({ source: "", formId: State.get().formId, dials: [...State.get().dials] });
  });
  document.getElementById("btn-shape").addEventListener("click", runShape);
}

function runShape() {
  const s = State.get();
  if (!s.source.trim()) {
    showToast("Paste some text first.");
    return;
  }
  const analysis = analyze(s.source);
  const directions = shape(analysis, { form: s.formId, dials: [...s.dials] });
  State.set({ analysis, directions, dirty: false, activeDir: s.activeDir || 0 });
  Storage.saveLast({ source: s.source, formId: s.formId, dials: [...s.dials] });
}

// ── controls ────────────────────────────────────────────────────────────
function wireControls() {
  document.querySelectorAll("#form-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      State.setForm(chip.dataset.form);
    });
  });

  document.querySelectorAll("#dial-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const name = chip.dataset.dial;
      const on = !State.get().dials.has(name);
      State.setDial(name, on);
    });
  });

  document.getElementById("btn-reset-dials").addEventListener("click", () => {
    State.clearDials();
  });
  document.getElementById("btn-reshape").addEventListener("click", runShape);
}

// ── directions ──────────────────────────────────────────────────────────
function wireDirections() {
  document.querySelectorAll(".dir-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      State.setActiveDir(Number(tab.dataset.dir));
    });
  });

  // Click on a section's ✦ propose button → AI alternatives modal.
  // Click on a line → line tools modal.
  document.getElementById("direction-body").addEventListener("click", e => {
    const proposeBtn = e.target.closest("[data-propose-section]");
    if (proposeBtn) {
      e.stopPropagation();
      const idx = Number(proposeBtn.getAttribute("data-propose-section"));
      openProposeModal(idx);
      return;
    }
    const lineEl = e.target.closest(".line");
    if (!lineEl) return;
    openLineModal(lineEl.dataset.line, lineEl);
  });

  // Click on a hook to copy / save.
  document.getElementById("hook-list").addEventListener("click", e => {
    const save = e.target.closest("[data-save-hook]");
    if (save) {
      const text = save.getAttribute("data-save-hook");
      if (Storage.hasHook(text)) {
        Storage.removeHook(text);
        showToast("Hook removed.");
      } else {
        Storage.saveHook(text);
        showToast("Hook saved.");
      }
      return;
    }
    const line = e.target.closest("[data-hook]");
    if (line) {
      const text = line.getAttribute("data-hook");
      copyToClipboard(text).then(ok => showToast(ok ? "Hook copied." : "Copy failed."));
    }
  });
}

// ── drawer ──────────────────────────────────────────────────────────────
function wireDrawer() {
  const drawer = document.getElementById("drawer");
  document.getElementById("drawer-tab").addEventListener("click", () => {
    const open = drawer.dataset.open === "true";
    drawer.dataset.open = open ? "false" : "true";
    document.getElementById("drawer-tab").setAttribute("aria-expanded", open ? "false" : "true");
  });

  drawer.addEventListener("click", e => {
    const cp = e.target.closest("[data-copy-hook]");
    if (cp) {
      copyToClipboard(cp.getAttribute("data-copy-hook")).then(ok =>
        showToast(ok ? "Copied." : "Copy failed."));
      return;
    }
    const rm = e.target.closest("[data-rm-hook]");
    if (rm) { Storage.removeHook(rm.getAttribute("data-rm-hook")); return; }

    const cv = e.target.closest("[data-copy-version]");
    if (cv) {
      const v = Storage.get().versions.find(x => x.id === cv.getAttribute("data-copy-version"));
      if (v) copyToClipboard(asLyricSheet(v)).then(ok => showToast(ok ? "Lyric sheet copied." : "Copy failed."));
      return;
    }
    const rv = e.target.closest("[data-rm-version]");
    if (rv) Storage.removeVersion(rv.getAttribute("data-rm-version"));
  });
}

// ── examples ────────────────────────────────────────────────────────────
function wireExamples() {
  const modal = document.getElementById("modal-examples");
  const grid  = document.getElementById("example-grid");
  document.getElementById("btn-examples").addEventListener("click", () => {
    grid.innerHTML = examples.map(ex => `
      <button class="example-card" data-ex="${ex.id}">
        <h4>${escapeAttr(ex.title)}</h4>
        <p>${escapeAttr(ex.blurb)}</p>
        <div class="ex-meta">${escapeAttr(ex.register)}</div>
      </button>
    `).join("");
    modal.hidden = false;
  });

  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.matches("[data-close]")) {
      modal.hidden = true; return;
    }
    const card = e.target.closest("[data-ex]");
    if (!card) return;
    const ex = examples.find(x => x.id === card.dataset.ex);
    if (!ex) return;
    document.getElementById("source").value = ex.text;
    State.set({ source: ex.text, dirty: true });
    modal.hidden = true;
    runShape();
  });
}

// ── export ──────────────────────────────────────────────────────────────
function wireExport() {
  document.getElementById("btn-save").addEventListener("click", () => {
    const s = State.get();
    const dir = s.directions[s.activeDir];
    if (!dir) return;
    Storage.saveVersion({
      title: dir.possible_title || "Untitled",
      direction: dir.direction,
      sections: dir.sections,
      possible_title: dir.possible_title,
      hook_candidates: dir.hook_candidates
    });
    showToast("Saved to drawer.");
    document.getElementById("drawer").dataset.open = "true";
  });

  document.getElementById("btn-copy-lyric").addEventListener("click", () => {
    const dir = currentDir(); if (!dir) return;
    copyToClipboard(asLyricSheet(dir)).then(ok => showToast(ok ? "Lyric sheet copied." : "Copy failed."));
  });
  document.getElementById("btn-copy-md").addEventListener("click", () => {
    const dir = currentDir(); if (!dir) return;
    copyToClipboard(asMarkdown(dir)).then(ok => showToast(ok ? "Markdown copied." : "Copy failed."));
  });
  document.getElementById("btn-copy-hooks").addEventListener("click", () => {
    const dir = currentDir(); if (!dir) return;
    copyToClipboard(asHooksOnly(dir)).then(ok => showToast(ok ? "Hooks copied." : "Copy failed."));
  });

  document.getElementById("btn-fill-thin").addEventListener("click", runFillThin);
}

function currentDir() {
  const s = State.get();
  return s.directions[s.activeDir];
}

// ── line modal ──────────────────────────────────────────────────────────
let lineCtx = null;

function openLineModal(text, lineEl) {
  if (!text) return;
  lineCtx = { text, el: lineEl, picked: null };
  const modal = document.getElementById("modal-line");
  document.getElementById("line-original").textContent = text;
  const variants = variantsFor(text);
  const list = document.getElementById("line-variants");
  if (!variants.length) {
    list.innerHTML = `<p class="muted" style="padding:8px 16px;">This line is already tight. Nothing to compress without losing it.</p>`;
  } else {
    list.innerHTML = variants.map((v, i) => `
      <div class="variant" data-variant-idx="${i}">
        <span>${escapeText(v.text)}</span>
        <span class="label">${escapeText(v.label)}</span>
      </div>
    `).join("");
  }
  // store variants on the modal for picking
  list.dataset.variants = JSON.stringify(variants);
  document.getElementById("line-replace").disabled = true;
  modal.hidden = false;
}

function wireLineModal() {
  const modal = document.getElementById("modal-line");
  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.matches("[data-close]")) {
      modal.hidden = true;
      return;
    }
    const v = e.target.closest("[data-variant-idx]");
    if (!v) return;
    document.querySelectorAll("#line-variants .variant").forEach(x => x.classList.remove("selected"));
    v.classList.add("selected");
    const list = document.getElementById("line-variants");
    const variants = JSON.parse(list.dataset.variants || "[]");
    lineCtx.picked = variants[Number(v.dataset.variantIdx)];
    document.getElementById("line-replace").disabled = false;
  });

  document.getElementById("line-replace").addEventListener("click", () => {
    if (!lineCtx || !lineCtx.picked) return;
    // Mutate the active direction in state and re-render.
    const s = State.get();
    const dir = s.directions[s.activeDir];
    const target = lineCtx.text;
    const newText = lineCtx.picked.text;
    let replaced = 0;
    for (const sec of dir.sections) {
      for (const line of sec.lines) {
        if (line.text === target) {
          line.text = newText;
          line.source_status = classify(target, newText);
          replaced++;
        }
      }
    }
    State.set({ directions: s.directions });
    document.getElementById("modal-line").hidden = true;
    showToast(replaced ? `Replaced in ${replaced} place${replaced === 1 ? "" : "s"}.` : "Line not found.");
  });
}

// Lightweight version of classifier for runtime line edits.
function classify(orig, next) {
  if (orig.trim() === next.trim()) return "original";
  const a = new Set(orig.toLowerCase().split(/\s+/));
  const b = next.toLowerCase().split(/\s+/);
  const overlap = b.filter(w => a.has(w)).length / Math.max(1, b.length);
  if (overlap >= 0.85) return "adapted";
  if (overlap >= 0.45) return "heavy";
  return "new";
}

// ── AI propose modal ────────────────────────────────────────────────────
let proposeCtx = null; // { sectionIdx, options, picked }

async function openProposeModal(sectionIdx) {
  const s = State.get();
  const dir = s.directions[s.activeDir];
  if (!dir) return;
  const section = dir.sections[sectionIdx];
  if (!section) return;

  proposeCtx = { sectionIdx, options: [], picked: null, regenerating: false };

  document.getElementById("propose-title").textContent =
    `Propose alternatives — ${section.label}`;
  document.getElementById("propose-subtitle").textContent =
    `3 takes from Claude, in your voice.`;

  const body = document.getElementById("propose-body");
  body.innerHTML = `
    <div class="propose-loading">
      <div class="spinner"></div>
      <p class="muted">Reading the poem and writing alternatives…</p>
    </div>`;
  document.getElementById("propose-apply").disabled = true;
  document.getElementById("propose-regen").hidden = true;
  document.getElementById("modal-propose").hidden = false;

  await runProposeForSection(sectionIdx);
}

async function runProposeForSection(sectionIdx) {
  const s = State.get();
  const dir = s.directions[s.activeDir];
  const body = document.getElementById("propose-body");
  try {
    const res = await proposeForSection({
      source: s.source,
      analysis: s.analysis,
      direction: dir,
      formId: s.formId,
      dials: [...s.dials],
      sectionIdx
    });
    if (!res.options || !res.options.length) throw new Error("No options returned.");
    proposeCtx.options = res.options;
    renderProposeOptions(res.options);
    document.getElementById("propose-regen").hidden = false;
  } catch (err) {
    body.innerHTML = `
      <div class="propose-error">
        <strong>Couldn't reach the AI.</strong><br>
        ${escapeText(err.message || String(err))}<br><br>
        Make sure <code>ANTHROPIC_API_KEY</code> is set as a Netlify environment
        variable, then redeploy. If you're running locally, use
        <code>netlify dev</code> instead of <code>python3 -m http.server</code>.
      </div>`;
    document.getElementById("propose-regen").hidden = false;
  }
}

function renderProposeOptions(options) {
  const body = document.getElementById("propose-body");
  body.innerHTML = options.map((o, i) => `
    <div class="propose-option" data-opt-idx="${i}">
      <div class="propose-option-meta">
        <span class="propose-option-num">option ${i + 1}</span>
        <span class="propose-option-note">${escapeText(o.note || "")}</span>
      </div>
      <div class="propose-option-lines">
        ${o.lines.map(l => `<span class="l">${escapeText(l)}</span>`).join("")}
      </div>
    </div>
  `).join("");
}

function wireProposeModal() {
  const modal = document.getElementById("modal-propose");
  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.matches("[data-close]")) {
      modal.hidden = true; proposeCtx = null; return;
    }
    const opt = e.target.closest("[data-opt-idx]");
    if (!opt) return;
    document.querySelectorAll("#propose-body .propose-option").forEach(x => x.classList.remove("selected"));
    opt.classList.add("selected");
    proposeCtx.picked = Number(opt.getAttribute("data-opt-idx"));
    document.getElementById("propose-apply").disabled = false;
  });

  document.getElementById("propose-regen").addEventListener("click", async () => {
    if (!proposeCtx || proposeCtx.regenerating) return;
    proposeCtx.regenerating = true;
    document.getElementById("propose-body").innerHTML = `
      <div class="propose-loading"><div class="spinner"></div>
      <p class="muted">Writing fresh alternatives…</p></div>`;
    document.getElementById("propose-apply").disabled = true;
    await runProposeForSection(proposeCtx.sectionIdx);
    proposeCtx.regenerating = false;
  });

  document.getElementById("propose-apply").addEventListener("click", () => {
    if (!proposeCtx || proposeCtx.picked == null) return;
    const s = State.get();
    const dir = s.directions[s.activeDir];
    const section = dir.sections[proposeCtx.sectionIdx];
    const option = proposeCtx.options[proposeCtx.picked];
    if (!section || !option) return;
    section.lines = option.lines.map(text => ({ text, source_status: "new" }));
    State.set({ directions: s.directions });
    document.getElementById("modal-propose").hidden = true;
    proposeCtx = null;
    showToast(`Replaced ${section.label}.`);
  });
}

// Fill all underwritten sections in one batch call.
async function runFillThin() {
  const s = State.get();
  const dir = s.directions[s.activeDir];
  if (!dir) return;
  const thin = thinSectionIndices(dir);
  if (!thin.length) {
    showToast("No thin sections — every slot has body.");
    return;
  }

  const banner = document.createElement("div");
  banner.className = "fill-banner";
  banner.id = "fill-banner";
  banner.innerHTML = `<span class="spinner"></span><span>Filling ${thin.length} thin section${thin.length === 1 ? "" : "s"}…</span>`;
  const body = document.getElementById("direction-body");
  body.prepend(banner);

  try {
    const res = await fillThinSections({
      source: s.source,
      analysis: s.analysis,
      direction: dir,
      formId: s.formId,
      dials: [...s.dials],
      thinSectionIndices: thin
    });
    if (!res.fills || !res.fills.length) throw new Error("No fills returned.");

    // Apply each fill — match by sectionIdx, but tolerate index drift via label.
    let applied = 0;
    for (const fill of res.fills) {
      let target = dir.sections[fill.sectionIdx];
      if (!target || target.label !== fill.sectionLabel) {
        target = dir.sections.find(sec => sec.label === fill.sectionLabel);
      }
      if (!target) continue;
      target.lines = fill.lines.map(text => ({ text, source_status: "new" }));
      applied++;
    }
    State.set({ directions: s.directions });
    showToast(`Filled ${applied} section${applied === 1 ? "" : "s"}.`);
  } catch (err) {
    showToast(err.message || "AI request failed.");
  } finally {
    document.getElementById("fill-banner")?.remove();
  }
}

// ── theme ───────────────────────────────────────────────────────────────
function wireTheme() {
  document.getElementById("btn-theme").addEventListener("click", () => {
    const s = State.get();
    State.setTheme(s.theme === "dark" ? "light" : "dark");
  });
}

// ── helpers ─────────────────────────────────────────────────────────────
function escapeAttr(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeText(s) { return escapeAttr(s); }

document.addEventListener("DOMContentLoaded", boot);
