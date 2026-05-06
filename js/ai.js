// ai.js — browser-side client for the propose Netlify Function.
//
// Falls back gracefully when running on `python3 -m http.server` (no
// functions runtime). In that case the UI shows a friendly message instead
// of trying to call /api/propose.

import { getForm } from "./forms.js";

const ENDPOINT = "/api/propose";

// Heuristic: do we appear to have an API available?
// We assume yes when served from anything other than a bare static localhost
// without netlify dev.
let _availableCache = null;
export async function isAvailable() {
  if (_availableCache !== null) return _availableCache;
  try {
    // OPTIONS not always supported by Netlify Functions; we use a HEAD-like
    // check by issuing a no-op POST and reading the error.
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: true })
    });
    // 400 (validation error) means the function is alive.
    // 404 means no function deployed.
    // 500 with "missing ANTHROPIC_API_KEY" also means alive but unconfigured.
    _availableCache = res.status !== 404;
    if (_availableCache) {
      try {
        const j = await res.json();
        if (j && j.error && /ANTHROPIC_API_KEY/i.test(j.error)) {
          _availableCache = "no-key";
        }
      } catch {}
    }
  } catch {
    _availableCache = false;
  }
  return _availableCache;
}

export function resetAvailabilityCache() { _availableCache = null; }

async function postJSON(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  let body;
  try { body = await res.json(); }
  catch { throw new Error(`Server returned non-JSON (status ${res.status}).`); }
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

export async function proposeForSection({ source, analysis, direction, formId, dials, sectionIdx }) {
  const section = direction.sections[sectionIdx];
  if (!section) throw new Error("invalid sectionIdx");
  const form = getForm(formId);
  return postJSON({
    mode: "section",
    source,
    analysis: slimAnalysis(analysis),
    direction,
    formNotes: form.notes,
    dials,
    sectionLabel: section.label,
    sectionIdx
  });
}

export async function fillThinSections({ source, analysis, direction, formId, dials, thinSectionIndices }) {
  const form = getForm(formId);
  return postJSON({
    mode: "fill-thin",
    source,
    analysis: slimAnalysis(analysis),
    direction,
    formNotes: form.notes,
    dials,
    thinSectionIndices
  });
}

// Identify sections that lean heavily on placeholder content.
// "Thin" = >50% of lines are `new` or `repeat`, or fewer than 2 lines total.
export function thinSectionIndices(direction) {
  const out = [];
  direction.sections.forEach((sec, i) => {
    const total = sec.lines.length;
    if (total < 2) { out.push(i); return; }
    const placeholder = sec.lines.filter(l =>
      l.source_status === "new" || l.source_status === "repeat"
    ).length;
    if (placeholder / total > 0.5) out.push(i);
  });
  return out;
}

// Trim the analysis object before sending — drop the noisy `scored` array.
function slimAnalysis(a) {
  if (!a) return null;
  return {
    tone: a.tone,
    tension: a.tension,
    recurring: a.recurring,
    refrains: a.refrains?.map(r => ({ text: r.text, occurrences: r.occurrences })),
    titles: a.titles,
    hooks: a.hooks?.slice(0, 5),
    verdict: a.verdict,
    metrics: a.metrics
  };
}
