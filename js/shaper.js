// shaper.js
// Produces three shaping directions from an analysis:
//   0 — Minimal intervention   (preserves cadence; light refrain)
//   1 — Balanced adaptation    (reorders, compresses, builds chorus)
//   2 — Bold restructuring     (rewrites around the central image)
//
// Each direction respects the chosen target form, the songability dials,
// and the active language pack (en / fr) — all UI-facing strings come from
// lang.shaper.

import { getForm } from "./forms.js";
import { compressLine, classifyChange } from "./compressor.js";
import { LANG_EN } from "./lang-en.js";

function dialOn(dials, name) { return dials && dials.has(name); }

function topByScore(scored, n) {
  return scored.slice().sort((a, b) => b.score - a.score).slice(0, n);
}

function chooseHook(analysis, dials, lang) {
  const candidates = analysis.hooks.slice();
  if (dialOn(dials, "hook")) {
    const fabricated = candidates.find(h => !h.fromText);
    if (fabricated) return fabricated;
  }
  const wc = t => t.split(/\s+/).filter(Boolean).length;
  const refrainShaped = candidates.filter(h => wc(h.text) >= 3 && wc(h.text) <= 8);
  return refrainShaped[0]
    || candidates[0]
    || { text: analysis.titles[0] || lang.shaper.chorusFallback, score: 0, fromText: false };
}

function makeTitle(analysis, hook) {
  if (analysis.titles && analysis.titles.length) return analysis.titles[0];
  const words = hook.text.split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function asLine(text, status) { return { text, source_status: status }; }

// ── Direction 0: minimal intervention ─────────────────────────────────────
function buildMinimal(analysis, formId, dials, lang) {
  const form = getForm(formId, lang);
  const lines = analysis.scored.map(s => s.text);
  const hook  = chooseHook(analysis, dials, lang);
  const title = makeTitle(analysis, hook);

  const stanzas = splitStanzas(analysis);
  const refrainLines = pickRefrain(analysis, dials, 2);

  const sections = [];
  let stanzaIx = 0;

  for (let _bi = 0; _bi < form.blueprint.length; _bi++) {
    const label = form.blueprint[_bi];
    const displayLabel = form.displayLabels[_bi];
    const isHookSection = /chorus|refrain/i.test(label);
    if (isHookSection) {
      sections.push({
        label: displayLabel,
        lines: refrainLines.map(t => asLine(t, isFromSource(t, lines) ? "original" : "adapted"))
      });
      continue;
    }
    const stanza = stanzas[stanzaIx % stanzas.length] || [lines[stanzaIx % lines.length]];
    stanzaIx++;
    const adapted = stanza.map(l => {
      if (dialOn(dials, "shorter") && l.split(/\s+/).length > 11) {
        const c = compressLine(l, "shorter", lang);
        return asLine(c, classifyChange(l, c));
      }
      return asLine(l, "original");
    });
    sections.push({ label: displayLabel, lines: adapted });
  }

  const preserveVerbatim = stanzas.flat().slice(0, 8);
  const notes = [
    lang.shaper.notes.keepsOrder,
    lang.shaper.notes.softRefrain(refrainLines.length)
  ];
  if (dialOn(dials, "shorter")) notes.push(lang.shaper.notes.trimsLong);

  return {
    direction: lang.shaper.direction.minimal,
    rationale: lang.shaper.rationale.minimal,
    emotional_core: emotionalCore(analysis, lang),
    possible_title: title,
    hook_candidates: analysis.hooks.slice(0, 4).map(h => h.text),
    preserve_verbatim: preserveVerbatim,
    adaptation_notes: notes,
    sections
  };
}

// ── Direction 1: balanced adaptation ─────────────────────────────────────
function buildBalanced(analysis, formId, dials, lang) {
  const form = getForm(formId, lang);
  const allLines = analysis.scored.map(s => s.text);
  const hook = chooseHook(analysis, dials, lang);
  const title = makeTitle(analysis, hook);
  const refrain = buildChorusFromHook(hook, analysis, dials);

  const singable = analysis.scored.filter(s => s.score >= 2 && s.words <= 11);
  const dense    = analysis.scored.filter(s => s.score < 2 || s.words > 11);
  const versePool = singable.length >= 6 ? singable : analysis.scored;
  const usedIdx = new Set();
  const sections = [];

  for (let _bi = 0; _bi < form.blueprint.length; _bi++) {
    const label = form.blueprint[_bi];
    const displayLabel = form.displayLabels[_bi];
    if (/chorus(?!.*pre)|^Chorus|refrain|button/i.test(label)) {
      sections.push({
        label: displayLabel,
        lines: refrain.map(t => asLine(t, isFromSource(t, allLines) ? "original" : "adapted"))
      });
      continue;
    }
    if (/pre-?chorus/i.test(label)) {
      const pre = pickN(versePool, 2, usedIdx).map(s => {
        if (s.words > 9 || dialOn(dials, "shorter")) {
          const c = compressLine(s.text, "shorter", lang);
          return asLine(c, classifyChange(s.text, c));
        }
        return asLine(s.text, "original");
      });
      if (pre.length < 2) pre.push(asLine(lang.shaper.connective.preChorusFallback, "new"));
      sections.push({ label: displayLabel, lines: pre });
      continue;
    }
    if (/bridge/i.test(label)) {
      const lines = [];
      const turn = (dense[0] && !usedIdx.has(dense[0].idx))
        ? dense[0]
        : versePool.find(s => !usedIdx.has(s.idx) && s.score >= 2);
      if (turn) {
        const t = compressLine(turn.text, "simpler", lang);
        lines.push(asLine(t, classifyChange(turn.text, t)));
        usedIdx.add(turn.idx);
      }
      lines.push(asLine(bridgeFromTension(analysis, lang), "new"));
      lines.push(asLine(hook.text + (/[.?!]$/.test(hook.text) ? "" : "."), "repeat"));
      sections.push({ label: displayLabel, lines });
      continue;
    }
    if (/outro/i.test(label)) {
      sections.push({
        label: displayLabel,
        lines: [
          asLine(refrain[0], "adapted"),
          asLine(refrain[0], "repeat")
        ]
      });
      continue;
    }
    const verseLines = pickN(versePool, 4, usedIdx).map(s => {
      const tooLong = s.words > 11;
      const wantShort = tooLong || dialOn(dials, "shorter");
      if (wantShort) {
        const c = compressLine(s.text, dialOn(dials, "conversational") ? "singable" : "shorter", lang);
        return asLine(c, classifyChange(s.text, c));
      }
      return asLine(s.text, "original");
    });
    if (verseLines.length < 4) {
      while (verseLines.length < 4) verseLines.push(asLine(lang.shaper.connective.continueStub, "new"));
    }
    sections.push({ label: displayLabel, lines: verseLines });
  }

  const preserve = analysis.scored
    .filter(s => s.score >= 3.5)
    .slice(0, 6)
    .map(s => s.text);

  const notes = [
    lang.shaper.notes.buildsChorus(hook.text),
    lang.shaper.notes.compressesLong,
    lang.shaper.notes.formIs(form.name, form.notes)
  ];
  if (dialOn(dials, "repetition")) notes.push(lang.shaper.notes.repetitionEcho);
  if (dialOn(dials, "conversational")) notes.push(lang.shaper.notes.conversational);
  if (dialOn(dials, "density")) notes.push(lang.shaper.notes.keepsDensity);

  return {
    direction: lang.shaper.direction.balanced,
    rationale: lang.shaper.rationale.balanced,
    emotional_core: emotionalCore(analysis, lang),
    possible_title: title,
    hook_candidates: analysis.hooks.slice(0, 5).map(h => h.text),
    preserve_verbatim: preserve,
    adaptation_notes: notes,
    sections
  };
}

// ── Direction 2: bold restructuring ─────────────────────────────────────
function buildBold(analysis, formId, dials, lang) {
  const form = getForm(formId, lang);
  const allLines = analysis.scored.map(s => s.text);
  const hook = chooseHook(analysis, dials, lang);
  const altHook = analysis.hooks[1] ? analysis.hooks[1].text : null;
  const title = makeTitle(analysis, hook);

  const dominantImage = analysis.recurring[0]?.word || (lang.code === "fr" ? "lumière" : "light");
  const chorus = boldChorus(hook, dominantImage, analysis, dials, lang);

  const stanzas = splitStanzas(analysis);
  const verseBlocks = stanzas.map(stanza => condenseStanza(stanza, dials, lang));

  let usedStanza = 0;
  const sections = [];

  const imageRefrain = (lang.imageRefrainPatterns?.[0] || (img => `every ${img} remembers`));

  for (let _bi = 0; _bi < form.blueprint.length; _bi++) {
    const label = form.blueprint[_bi];
    const displayLabel = form.displayLabels[_bi];
    if (/chorus(?!.*pre)|^Chorus|refrain|button/i.test(label)) {
      sections.push({
        label: displayLabel,
        lines: chorus.map(t => asLine(t, isFromSource(t, allLines) ? "original" : "new"))
      });
      continue;
    }
    if (/pre-?chorus/i.test(label)) {
      const a = dialOn(dials, "melodic")
        ? lang.shaper.connective.preChorusBoldB(dominantImage)
        : lang.shaper.connective.preChorusBoldA(dominantImage);
      const b = lang.shaper.connective.iCanAlmost(analysis.tone.includes("longing"));
      sections.push({
        label: displayLabel,
        lines: [ asLine(a, "new"), asLine(b, "new") ]
      });
      continue;
    }
    if (/bridge/i.test(label)) {
      sections.push({
        label: displayLabel,
        lines: [
          asLine(bridgeFromTension(analysis, lang), "new"),
          asLine(altHook || (chorus[1] || chorus[0]), "adapted"),
          asLine(lang.shaper.connective.bridgeQuiet, "new")
        ]
      });
      continue;
    }
    if (/outro/i.test(label)) {
      sections.push({
        label: displayLabel,
        lines: [
          asLine(chorus[0], "repeat"),
          asLine(chorus[0], "repeat"),
          asLine(imageRefrain(dominantImage), "new")
        ]
      });
      continue;
    }
    const block = verseBlocks[usedStanza % verseBlocks.length] || [];
    usedStanza++;
    sections.push({ label: displayLabel, lines: block });
  }

  const preserve = analysis.scored
    .filter(s => s.score >= 4)
    .slice(0, 3)
    .map(s => s.text);

  const notes = [
    lang.shaper.notes.restructures(dominantImage),
    lang.shaper.notes.condenses,
    lang.shaper.notes.invents
  ];
  if (dialOn(dials, "repetition")) notes.push(lang.shaper.notes.doublesChorus);
  if (dialOn(dials, "hook")) notes.push(lang.shaper.notes.sharpensHook);

  return {
    direction: lang.shaper.direction.bold,
    rationale: lang.shaper.rationale.bold,
    emotional_core: emotionalCore(analysis, lang),
    possible_title: title,
    hook_candidates: analysis.hooks.slice(0, 5).map(h => h.text),
    preserve_verbatim: preserve,
    adaptation_notes: notes,
    sections
  };
}

// ── helpers ──────────────────────────────────────────────────────────────

function splitStanzas(analysis) {
  const stanzas = [];
  let cur = [];
  for (const line of analysis.lines) {
    if (line.trim() === "") {
      if (cur.length) { stanzas.push(cur); cur = []; }
    } else {
      cur.push(line);
    }
  }
  if (cur.length) stanzas.push(cur);
  if (stanzas.length === 0 && analysis.lines.length) stanzas.push(analysis.lines.filter(Boolean));
  return stanzas;
}

function pickRefrain(analysis, dials, maxLines = 2) {
  if (analysis.refrains.length >= maxLines) {
    return analysis.refrains.slice(0, maxLines).map(r => r.text);
  }
  const refrainShape = analysis.scored
    .filter(s => s.words >= 3 && s.words <= 8 && s.syllables <= 14 && s.score >= 2)
    .sort((a, b) => b.score - a.score);
  const out = analysis.refrains.map(r => r.text);
  for (const s of refrainShape) {
    if (out.length >= maxLines) break;
    if (!out.includes(s.text)) out.push(s.text);
  }
  if (out.length) return out.slice(0, maxLines);
  return topByScore(analysis.scored, maxLines).map(s => s.text);
}

function buildChorusFromHook(hook, analysis, dials) {
  const lines = [];
  lines.push(hook.text);
  const second = analysis.scored
    .filter(s => s.text !== hook.text && s.score >= 2 && s.words >= 3 && s.words <= 8 && s.syllables <= 14)
    .sort((a, b) => b.score - a.score)[0];
  if (second) lines.push(second.text);
  if (dialOn(dials, "repetition") || analysis.refrains.length) {
    lines.push(hook.text);
  }
  return lines;
}

function boldChorus(hook, image, analysis, dials, lang) {
  const lines = [];
  const imageRefrain = (lang.imageRefrainPatterns?.[0] || (img => `every ${img} remembers`));
  lines.push(hook.text);
  lines.push(imageRefrain(image));
  lines.push(imageRefrain(image));
  if (dialOn(dials, "hook")) lines.push(hook.text);
  return lines;
}

function bridgeFromTension(analysis, lang) {
  if (!analysis.tension) return lang.shaper.connective.bridgeFallback;
  return analysis.tension
    .replace(/\.$/, "")
    .replace(/^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ]/, c => c.toLowerCase());
}

function condenseStanza(stanza, dials, lang) {
  if (!stanza || !stanza.length) return [];
  const lines = stanza.slice();
  const block = [];
  const first = lines[0];
  const last  = lines[lines.length - 1];

  const firstWords = first.split(/\s+/).length;
  if (firstWords > 9 || dialOn(dials, "shorter")) {
    const c = compressLine(first, dialOn(dials, "conversational") ? "singable" : "shorter", lang);
    block.push(asLine(c, classifyChange(first, c)));
  } else {
    block.push(asLine(first, "original"));
  }

  if (last && last !== first) {
    const lastWords = last.split(/\s+/).length;
    if (lastWords > 11) {
      const c = compressLine(last, "shorter", lang);
      block.push(asLine(c, classifyChange(last, c)));
    } else {
      block.push(asLine(last, "original"));
    }
  }
  return block.slice(0, 3);
}

function pickN(pool, n, usedIdx) {
  const out = [];
  for (const s of pool) {
    if (out.length >= n) break;
    if (usedIdx.has(s.idx)) continue;
    out.push(s);
    usedIdx.add(s.idx);
  }
  return out;
}

function isFromSource(text, allLines) {
  return allLines.some(l => l.trim().toLowerCase() === text.trim().toLowerCase());
}

function emotionalCore(analysis, lang) {
  const tones = analysis.tone || [];
  const display = tones.map(name => (lang.toneNames?.[name] || name));
  const t = display.join(" + ");
  const tension = analysis.tension || "";
  if (!t) return tension;
  return `${capFirst(t)} — ${tension.replace(/\.$/, "")}`;
}

function capFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── public ───────────────────────────────────────────────────────────────

export function shape(analysis, opts = {}) {
  const formId = opts.form || "singer-songwriter";
  const dials  = new Set(opts.dials || []);
  const lang   = opts.lang || LANG_EN;
  if (!analysis) return [];

  return [
    buildMinimal(analysis, formId, dials, lang),
    buildBalanced(analysis, formId, dials, lang),
    buildBold(analysis, formId, dials, lang)
  ];
}
