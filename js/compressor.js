// compressor.js
// Line-level transformations. Heuristic, deterministic. Each variant is
// labeled so the user understands the trade. Language-pack-driven so
// fillers, articles, and elevated→plain diction are language-appropriate.

import { LANG_EN } from "./lang-en.js";

function tokens(line) {
  // Keep punctuation attached to words for re-assembly. Includes accented
  // French letters and apostrophe variants so "d'or" / "qu'elle" parse cleanly.
  return line.match(/[A-Za-zÀ-ÖØ-öø-ÿ'']+|[.,;:!?—–-]/g) || [];
}

function detok(toks) {
  return toks
    .filter(Boolean)
    .reduce((acc, t, i) => {
      if (i === 0) return t;
      if (/^[.,;:!?—–-]$/.test(t)) return acc + t;
      // Don't pad after a French elision article like d' / l' / qu' / n' / m' / t' / s' / j'.
      if (/[A-Za-zÀ-ÖØ-öø-ÿ]+'$/.test(acc) && acc.length <= 3) return acc + t;
      return acc + " " + t;
    }, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 1. Shorter for melody — drops fillers, articles, and one trailing modifier.
function shorter(line, lang) {
  const toks = tokens(line);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    const lw = w.toLowerCase();
    if (lang.fillers.has(lw)) continue;
    if (lang.articles.has(lw) && i !== 0) continue;
    out.push(w);
  }
  let s = detok(out);
  // English: squeeze "is/was {-ing}" → "{-ing}"
  if (lang.code === "en") {
    s = s.replace(/\b(is|was|are|were)\s+(\w+ing)\b/gi, "$2");
  } else if (lang.code === "fr") {
    // French: collapse "est en train de + inf" → "+ inf" (uncommon but possible)
    s = s.replace(/\b(est|étais|était|sont)\s+en\s+train\s+de\s+(\w+)\b/gi, "$2");
  }
  return capFirst(s);
}

// 2. Simpler syntax — language-aware syntactic flattening.
function simpler(line, lang) {
  let s = line;
  if (lang.code === "fr") {
    // "qui s'X-ait lentement" → "lentement, qui s'X" — keep meaning, easier flow
    // Drop trailing parenthetical asides
    s = s.replace(/\s*[—–-]\s*[^—–-]+$/, "");
    // "j'ai appris" → "j'apprends" (present)? — too aggressive. Skip.
    // Plus simple: turn "qui ne X pas" → "ne X pas" when fronted... skip too risky.
    // Compound past with avoir/être + participe → kept as is, French already concise.
  } else {
    // doing its slow undressing → slowly undressing
    s = s.replace(/\bdoing its (slow|quick|quiet|long|brief)\s+(\w+ing)\b/i,
                  (_, adj, verb) => `${adj}ly ${verb}`);
    s = s.replace(/\s*[—–-]\s*[^—–-]+$/, "");
    s = s.replace(/\bI have (\w+ed|\w+t|\w+n)\b/gi, "I $1");
    s = s.replace(/\bI am going to\b/gi, "I will");
  }
  return capFirst(s.trim());
}

// 3. Keep image, cut words — preserve concrete nouns/verbs, drop scaffolding.
function keepImage(line, lang) {
  const toks = tokens(line);
  const content = toks.filter(t => /^[A-Za-zÀ-ÖØ-öø-ÿ'']+$/.test(t) && t.length >= 4
    && !lang.fillers.has(t.toLowerCase()) && !lang.articles.has(t.toLowerCase()));
  if (content.length <= 3) return shorter(line, lang);
  const target = Math.max(4, Math.ceil(content.length * 0.6));
  const keep = new Set(content.slice(0, target));
  const out = [];
  for (const t of toks) {
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ'']+$/.test(t)) {
      if (keep.has(t)) out.push(t);
    }
  }
  if (out.length < 4) return shorter(line, lang);
  return capFirst(detok(out));
}

// 4. Easier to sing — replace elevated diction, smooth consonant clusters.
function singable(line, lang) {
  let s = line;
  for (const [hi, lo] of Object.entries(lang.elevatedToPlain || {})) {
    s = s.replace(new RegExp(`\\b${hi}\\b`, "gi"), lo);
  }
  // Drop semicolons (hard to sing past) — universal.
  s = s.replace(/;\s*/g, ", ");
  return capFirst(s);
}

// 5. More rhythmic — target ~8 syllables by trimming filler/articles.
function rhythmic(line, lang) {
  const target = 8;
  const words = line.split(/\s+/);
  const sylsPer = words.map(w => approxSyllables(w));
  let total = sylsPer.reduce((a, b) => a + b, 0);
  const out = words.slice();
  while (total > target + 1 && out.length > 3) {
    const idx = findDroppable(out, lang);
    if (idx === -1) break;
    total -= sylsPer[idx];
    out.splice(idx, 1);
    sylsPer.splice(idx, 1);
  }
  return capFirst(out.join(" ").replace(/\s+([.,;:!?])/g, "$1"));
}

function approxSyllables(w) {
  w = w.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿç]/gi, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouyàâäéèêëîïôöùûüÿ]es|ed|[^laeiouyàâäéèêëîïôöùûüÿ]e)$/, "");
  const m = w.match(/[aeiouyàâäéèêëîïôöùûüÿ]{1,2}/g);
  return m ? m.length : 1;
}

function findDroppable(words, lang) {
  for (let i = words.length - 1; i >= 0; i--) {
    const lw = words[i].toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿç']/gi, "");
    if (lang.fillers.has(lw) || lang.articles.has(lw)) return i;
  }
  return -1;
}

function capFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Localized variant labels — fall back to English if missing.
const LABELS = {
  en: {
    shorter:    "shorter for melody",
    simpler:    "simpler syntax",
    keepImage:  "keep image, cut words",
    singable:   "easier to sing",
    rhythmic:   "more rhythmic"
  },
  fr: {
    shorter:    "plus court pour la mélodie",
    simpler:    "syntaxe plus simple",
    keepImage:  "garder l'image, couper les mots",
    singable:   "plus facile à chanter",
    rhythmic:   "plus rythmique"
  }
};

export function variantsFor(line, lang = LANG_EN) {
  const labels = LABELS[lang.code] || LABELS.en;
  const original = line.trim();
  const out = [
    { label: labels.shorter,   text: shorter(original, lang) },
    { label: labels.simpler,   text: simpler(original, lang) },
    { label: labels.keepImage, text: keepImage(original, lang) },
    { label: labels.singable,  text: singable(original, lang) },
    { label: labels.rhythmic,  text: rhythmic(original, lang) }
  ];
  return out.filter(v => v.text && v.text.toLowerCase().trim() !== original.toLowerCase().trim());
}

// Single-shot compression used by the shaper for "shorter lines" dial.
export function compressLine(line, mode = "shorter", lang = LANG_EN) {
  switch (mode) {
    case "simpler":   return simpler(line, lang);
    case "keep":      return keepImage(line, lang);
    case "singable":  return singable(line, lang);
    case "rhythmic":  return rhythmic(line, lang);
    default:          return shorter(line, lang);
  }
}

export function classifyChange(original, transformed) {
  const a = original.trim().toLowerCase();
  const b = transformed.trim().toLowerCase();
  if (a === b) return "original";
  const ta = new Set(a.split(/\s+/));
  const tb = new Set(b.split(/\s+/));
  let overlap = 0;
  for (const w of tb) if (ta.has(w)) overlap++;
  const ratio = overlap / Math.max(1, tb.size);
  if (ratio >= 0.85) return "adapted";
  if (ratio >= 0.45) return "heavy";
  return "new";
}
