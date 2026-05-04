// shaper.js
// Produces three shaping directions from an analysis:
//   0 — Minimal intervention   (preserves cadence; light refrain)
//   1 — Balanced adaptation    (reorders, compresses, builds chorus)
//   2 — Bold restructuring     (rewrites around the central image)
//
// Each direction respects the chosen target form and the songability dials.
// All deterministic given the same input, so results are stable while
// the user experiments.

import { getForm } from "./forms.js";
import { compressLine, classifyChange } from "./compressor.js";

// Active dials are passed in as a Set of strings.
function dialOn(dials, name) { return dials && dials.has(name); }

// Pick best lines by score, preserving original ordering by default.
function topByScore(scored, n) {
  return scored.slice().sort((a, b) => b.score - a.score).slice(0, n);
}

function chooseHook(analysis, dials) {
  const candidates = analysis.hooks.slice();
  if (dialOn(dials, "hook")) {
    const fabricated = candidates.find(h => !h.fromText);
    if (fabricated) return fabricated;
  }
  // Prefer hooks that are actually refrain-shaped (3–8 words). The top-scored
  // hook may be a long, gorgeous-but-unsingable line; better to pick a short
  // strong line for the actual chorus tag.
  const wc = t => t.split(/\s+/).filter(Boolean).length;
  const refrainShaped = candidates.filter(h => wc(h.text) >= 3 && wc(h.text) <= 8);
  return refrainShaped[0]
    || candidates[0]
    || { text: analysis.titles[0] || "Every room remembers", score: 0, fromText: false };
}

function makeTitle(analysis, hook) {
  if (analysis.titles && analysis.titles.length) return analysis.titles[0];
  // Fall back to a noun-phrase from the hook.
  const words = hook.text.split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Wrap a raw text line in a section-line object with source-status.
function asLine(text, status) { return { text, source_status: status }; }

// ── Direction 0: minimal intervention ─────────────────────────────────────
function buildMinimal(analysis, formId, dials) {
  const form = getForm(formId);
  const lines = analysis.scored.map(s => s.text);
  const hook  = chooseHook(analysis, dials);
  const title = makeTitle(analysis, hook);

  // Group original lines into stanzas using blank-line breaks in the source.
  const stanzas = splitStanzas(analysis);

  // Map stanzas to the target blueprint, prefer keeping originals verbatim.
  // Refrain = the strongest 1–2 lines repeated; not a chorus rewrite.
  const refrainLines = pickRefrain(analysis, dials, /* maxLines */ 2);

  const sections = [];
  let stanzaIx = 0;

  for (const label of form.blueprint) {
    const isHookSection = /chorus|refrain/i.test(label);
    if (isHookSection) {
      sections.push({
        label,
        lines: refrainLines.map(t => asLine(t, isFromSource(t, lines) ? "original" : "adapted"))
      });
      continue;
    }
    const stanza = stanzas[stanzaIx % stanzas.length] || [lines[stanzaIx % lines.length]];
    stanzaIx++;
    // Apply only the gentlest dial: shorter lines if requested.
    const adapted = stanza.map(l => {
      if (dialOn(dials, "shorter") && l.split(/\s+/).length > 11) {
        const c = compressLine(l, "shorter");
        return asLine(c, classifyChange(l, c));
      }
      return asLine(l, "original");
    });
    sections.push({ label, lines: adapted });
  }

  // Identify preserve_verbatim and adaptation_notes
  const preserveVerbatim = stanzas.flat().slice(0, 8);
  const notes = [
    "Keeps your line order and cadence.",
    `Returns ${refrainLines.length === 1 ? "a single line" : "two lines"} as a soft refrain rather than building a new chorus.`
  ];
  if (dialOn(dials, "shorter")) notes.push("Trims your longest lines for melodic phrasing.");

  return {
    direction: "Minimal intervention",
    rationale: "Preserves the poem's cadence almost intact and only introduces a light returning refrain. The piece stays mostly itself; it just learns how to come back.",
    emotional_core: emotionalCore(analysis),
    possible_title: title,
    hook_candidates: analysis.hooks.slice(0, 4).map(h => h.text),
    preserve_verbatim: preserveVerbatim,
    adaptation_notes: notes,
    sections
  };
}

// ── Direction 1: balanced adaptation ─────────────────────────────────────
function buildBalanced(analysis, formId, dials) {
  const form = getForm(formId);
  const allLines = analysis.scored.map(s => s.text);
  const hook = chooseHook(analysis, dials);
  const title = makeTitle(analysis, hook);
  const refrain = buildChorusFromHook(hook, analysis, dials);

  // Split originals into singable / poetic-but-unsingable groups.
  const singable = analysis.scored.filter(s => s.score >= 2 && s.words <= 11);
  const dense    = analysis.scored.filter(s => s.score < 2 || s.words > 11);

  // Compose verse/pre-chorus from singable lines, lightly compress dense ones if used.
  const versePool = singable.length >= 6 ? singable : analysis.scored;
  const usedIdx = new Set();

  const sections = [];

  for (const label of form.blueprint) {
    if (/chorus(?!.*pre)|^Chorus|refrain|button/i.test(label)) {
      sections.push({
        label,
        lines: refrain.map(t => asLine(t, isFromSource(t, allLines) ? "original" : "adapted"))
      });
      continue;
    }
    if (/pre-?chorus/i.test(label)) {
      // Pre-chorus: 2 lines of building tension, prefer compressed mid-pool lines
      const pre = pickN(versePool, 2, usedIdx).map(s => {
        if (s.words > 9 || dialOn(dials, "shorter")) {
          const c = compressLine(s.text, "shorter");
          return asLine(c, classifyChange(s.text, c));
        }
        return asLine(s.text, "original");
      });
      // Add a connective if needed
      if (pre.length < 2) pre.push(asLine("and I can feel it coming —", "new"));
      sections.push({ label, lines: pre });
      continue;
    }
    if (/bridge/i.test(label)) {
      // Bridge: a true pivot. Pick a "turning" line — usually mid-text — and
      // pair it with the central tension. Always at least two lines.
      const lines = [];
      // Prefer a long-ish source line that hasn't been used in verses; if no
      // dense lines exist, fall back to the highest-scoring unused line.
      const turn = (dense[0] && !usedIdx.has(dense[0].idx))
        ? dense[0]
        : versePool.find(s => !usedIdx.has(s.idx) && s.score >= 2);
      if (turn) {
        const t = compressLine(turn.text, "simpler");
        lines.push(asLine(t, classifyChange(turn.text, t)));
        usedIdx.add(turn.idx);
      }
      const tensionLine = bridgeFromTension(analysis);
      lines.push(asLine(tensionLine, "new"));
      // One more — a quiet question or echo of the hook.
      lines.push(asLine(hook.text + (/[.?!]$/.test(hook.text) ? "" : "."), "repeat"));
      sections.push({ label, lines });
      continue;
    }
    if (/outro/i.test(label)) {
      // Outro: tail off using a quieter version of the refrain (echo).
      sections.push({
        label,
        lines: [
          asLine(refrain[0], "adapted"),
          asLine(refrain[0], "repeat")
        ]
      });
      continue;
    }
    // Verses: pick 4 lines, lightly compress if long.
    const verseLines = pickN(versePool, 4, usedIdx).map(s => {
      const tooLong = s.words > 11;
      const wantShort = tooLong || dialOn(dials, "shorter");
      if (wantShort) {
        const c = compressLine(s.text, dialOn(dials, "conversational") ? "singable" : "shorter");
        return asLine(c, classifyChange(s.text, c));
      }
      return asLine(s.text, "original");
    });
    if (verseLines.length < 4) {
      while (verseLines.length < 4) verseLines.push(asLine("(continue)", "new"));
    }
    sections.push({ label, lines: verseLines });
  }

  const preserve = analysis.scored
    .filter(s => s.score >= 3.5)
    .slice(0, 6)
    .map(s => s.text);

  const notes = [
    `Builds a chorus around: "${hook.text}".`,
    "Compresses your longer lines so a melody can land on them.",
    `Form: ${form.name} — ${form.notes}`
  ];
  if (dialOn(dials, "repetition")) notes.push("Repeats the chorus tag in the outro for an echo effect.");
  if (dialOn(dials, "conversational")) notes.push("Plain-language pass on adapted lines.");
  if (dialOn(dials, "density")) notes.push("Keeps your denser images intact in the verses.");

  return {
    direction: "Balanced adaptation",
    rationale: "Keeps the imagery and the speaker's voice but introduces a true returning chorus. Long lines are compressed for melodic phrasing; the verse-chorus contrast is intentional.",
    emotional_core: emotionalCore(analysis),
    possible_title: title,
    hook_candidates: analysis.hooks.slice(0, 5).map(h => h.text),
    preserve_verbatim: preserve,
    adaptation_notes: notes,
    sections
  };
}

// ── Direction 2: bold restructuring ─────────────────────────────────────
function buildBold(analysis, formId, dials) {
  const form = getForm(formId);
  const allLines = analysis.scored.map(s => s.text);
  const hook = chooseHook(analysis, dials);
  const altHook = analysis.hooks[1] ? analysis.hooks[1].text : null;
  const title = makeTitle(analysis, hook);

  // Build a tighter, more declarative chorus around the central image.
  const dominantImage = analysis.recurring[0]?.word || "light";
  const chorus = boldChorus(hook, dominantImage, analysis, dials);

  // Verses: invent a tighter line that compresses each stanza into 2–3 lines.
  const stanzas = splitStanzas(analysis);
  const verseBlocks = stanzas.map(stanza => condenseStanza(stanza, dials));

  let usedStanza = 0;
  const sections = [];

  for (const label of form.blueprint) {
    if (/chorus(?!.*pre)|^Chorus|refrain|button/i.test(label)) {
      sections.push({
        label,
        lines: chorus.map(t => asLine(t, isFromSource(t, allLines) ? "original" : "new"))
      });
      continue;
    }
    if (/pre-?chorus/i.test(label)) {
      // Pre-chorus: a single rising line, often invented.
      sections.push({
        label,
        lines: [
          asLine(`and ${dominantImage} is starting to ${dialOn(dials, "melodic") ? "answer" : "speak"}`, "new"),
          asLine(`I can almost ${analysis.tone.includes("longing") ? "hear it" : "say it"}`, "new")
        ]
      });
      continue;
    }
    if (/bridge/i.test(label)) {
      sections.push({
        label,
        lines: [
          asLine(bridgeFromTension(analysis), "new"),
          asLine(altHook || (chorus[1] || chorus[0]), "adapted"),
          asLine(`(quiet)`, "new")
        ]
      });
      continue;
    }
    if (/outro/i.test(label)) {
      sections.push({
        label,
        lines: [
          asLine(chorus[0], "repeat"),
          asLine(chorus[0], "repeat"),
          asLine(`every ${dominantImage} remembers`, "new")
        ]
      });
      continue;
    }
    const block = verseBlocks[usedStanza % verseBlocks.length] || [];
    usedStanza++;
    sections.push({ label, lines: block });
  }

  const preserve = analysis.scored
    .filter(s => s.score >= 4)
    .slice(0, 3)
    .map(s => s.text);

  const notes = [
    `Restructures the piece around the recurring image: "${dominantImage}".`,
    "Compresses each stanza to 2–3 declarative lines so the chorus can carry the song's weight.",
    `Invents a chorus and connective lines; uses your strongest images verbatim.`
  ];
  if (dialOn(dials, "repetition")) notes.push("Doubles the chorus tag and lets the outro repeat.");
  if (dialOn(dials, "hook")) notes.push("Hook is sharpened to a title-grade line.");

  return {
    direction: "Bold restructuring",
    rationale: "Treats the poem as a quarry rather than a script. Pulls the strongest images forward, builds a chorus around the dominant figure, and lets the rest of the song serve that gravity.",
    emotional_core: emotionalCore(analysis),
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
  // Prefer existing refrains in the text — these literally repeat themselves.
  if (analysis.refrains.length >= maxLines) {
    return analysis.refrains.slice(0, maxLines).map(r => r.text);
  }
  // A real refrain is short. 4–8 words, ≤ 14 syllables. The strongest line in
  // the source is often beautiful and 12+ words long — that line belongs in a
  // verse, not a chorus.
  const refrainShape = analysis.scored
    .filter(s => s.words >= 3 && s.words <= 8 && s.syllables <= 14 && s.score >= 2)
    .sort((a, b) => b.score - a.score);
  const out = analysis.refrains.map(r => r.text);   // any natural ones first
  for (const s of refrainShape) {
    if (out.length >= maxLines) break;
    if (!out.includes(s.text)) out.push(s.text);
  }
  if (out.length) return out.slice(0, maxLines);
  // Fall back to the highest-scoring overall (clipped to maxLines).
  return topByScore(analysis.scored, maxLines).map(s => s.text);
}

function buildChorusFromHook(hook, analysis, dials) {
  const lines = [];
  lines.push(hook.text);
  // Complementary line: prefer a short, strong, refrain-shaped line that isn't the hook.
  const second = analysis.scored
    .filter(s => s.text !== hook.text && s.score >= 2 && s.words >= 3 && s.words <= 8 && s.syllables <= 14)
    .sort((a, b) => b.score - a.score)[0];
  if (second) lines.push(second.text);
  // Repetition tag if requested or if the source already had a refrain.
  if (dialOn(dials, "repetition") || analysis.refrains.length) {
    lines.push(hook.text);
  }
  return lines;
}

function boldChorus(hook, image, analysis, dials) {
  const tone = analysis.tone[0];
  const opener =
    tone === "defiance" ? "I am going to" :
    tone === "longing"  ? "every" :
    tone === "tender"   ? "hold the" :
                          "every";

  const lines = [];
  lines.push(hook.text);
  lines.push(`every ${image} remembers`);
  lines.push(`every ${image} remembers`);
  if (dialOn(dials, "hook")) lines.push(hook.text);
  return lines;
}

function bridgeFromTension(analysis) {
  if (!analysis.tension) return "and I am still here";
  // Lower-case the tension and trim the period for a sung line.
  return analysis.tension
    .replace(/\.$/, "")
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

function condenseStanza(stanza, dials) {
  // Bold strategy: keep the strongest *original* line of each stanza and
  // compress one supporting line. We avoid "keep image" because it can reduce
  // a line to fragments. Better to lose detail than meaning.
  if (!stanza || !stanza.length) return [];
  const lines = stanza.slice();
  const block = [];
  const first = lines[0];
  const last  = lines[lines.length - 1];

  // Anchor: the first line, lightly compressed only if long.
  const firstWords = first.split(/\s+/).length;
  if (firstWords > 9 || dialOn(dials, "shorter")) {
    const c = compressLine(first, dialOn(dials, "conversational") ? "singable" : "shorter");
    block.push(asLine(c, classifyChange(first, c)));
  } else {
    block.push(asLine(first, "original"));
  }

  // Support: the closing line of the stanza, kept original where possible.
  if (last && last !== first) {
    const lastWords = last.split(/\s+/).length;
    if (lastWords > 11) {
      const c = compressLine(last, "shorter");
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

function emotionalCore(analysis) {
  const t = analysis.tone.join(" + ");
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
  if (!analysis) return [];

  return [
    buildMinimal(analysis, formId, dials),
    buildBalanced(analysis, formId, dials),
    buildBold(analysis, formId, dials)
  ];
}
