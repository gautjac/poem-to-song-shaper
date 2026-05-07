// prosody-server.mjs
// Server-side prosody analysis using phoneme dictionaries — CMU for English
// (~18K words from the CMU Pronouncing Dictionary) and Lexique 3.83 for
// French (~98K words). More accurate than the spelling-based heuristic in
// js/prosody.js — and because the dicts live on the server, their bulk
// doesn't enter the browser bundle.
//
// Falls back to a spelling-based key for words not in the dict, so
// archaic / invented words still get *some* signal.

import { rhymeKey as rhymeKeyEn } from "./rhyme-dict.js";
import { rhymeKey as rhymeKeyFr } from "./rhyme-dict-fr.js";

// ── syllables ─────────────────────────────────────────────────────────────
// Tuned for English, performs reasonably on French (vowel-cluster regex
// includes the French accented letters and treats trailing 'e' as silent).
function syllables(word) {
  word = word.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿç]/gi, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouyàâäéèêëîïôöùûüÿ]es|ed|[^laeiouyàâäéèêëîïôöùûüÿ]e)$/, "");
  word = word.replace(/^y/, "");
  const m = word.match(/[aeiouyàâäéèêëîïôöùûüÿ]{1,3}/g);
  return m ? m.length : 1;
}

export function lineSyllables(line) {
  return (line || "").split(/\s+/).filter(Boolean).reduce((n, w) => n + syllables(w), 0);
}

// ── rhyme keys ─────────────────────────────────────────────────────────────

function spellingRhymeKeyEn(word) {
  if (!word) return "";
  let w = word.toLowerCase().replace(/[^a-z']/g, "");
  if (!w) return "";
  w = w.replace(/'s$/, "");
  w = w.replace(/ies$/, "iz").replace(/yes$/, "iz");
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  if (!m) return w.slice(-3);
  return "spelling:" + m[0];
}

function spellingRhymeKeyFr(word) {
  if (!word) return "";
  let w = word.toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/[^a-zàâäéèêëîïôöùûüÿç']/gi, "");
  if (!w) return "";
  // Drop trailing silent e in song endings ("rose" / "chose" / "morose"
  // all rhyme on /oz/ regardless of the optional final e).
  w = w.replace(/[^aeiouyàâäéèêëîïôöùûüÿ]e$/, m => m.slice(0, -1));
  // Also drop a trailing -s (often silent in song line endings).
  w = w.replace(/s$/, "");
  // Final 'ent' on verbs is silent.
  w = w.replace(/ent$/, "");
  // Find last vowel cluster + remaining consonants.
  const m = w.match(/[aeiouyàâäéèêëîïôöùûüÿ]+[^aeiouyàâäéèêëîïôöùûüÿ]*$/);
  if (!m) return w.slice(-3);
  return "spelling:" + m[0];
}

// French elision prefixes — strip them before dict lookup so "d'équipage"
// finds "équipage", "qu'on" finds "on", etc. Order matters: longer first.
const FR_ELISION_PREFIXES = [
  "qu'", "lorsqu'", "puisqu'", "presqu'", "jusqu'",
  "d'", "l'", "n'", "m'", "t'", "s'", "j'", "c'"
];

function stripFrenchElision(w) {
  const lw = w.toLowerCase();
  for (const p of FR_ELISION_PREFIXES) {
    if (lw.startsWith(p)) return w.slice(p.length);
  }
  return w;
}

// Returns a rhyme key for a single end-word in the active language.
// Phoneme dict wins; falls back to spelling-based heuristic for unknown
// words (archaic, names, neologisms). For French, retries the dict
// lookup after stripping a leading elision prefix (d' / l' / qu' / etc.).
export function rhymeKey(word, lang = "en") {
  if (!word) return "";
  if (lang === "fr") {
    let phon = rhymeKeyFr(word);
    if (!phon) phon = rhymeKeyFr(stripFrenchElision(word));
    if (phon) return "phon:" + phon;
    return spellingRhymeKeyFr(stripFrenchElision(word));
  }
  const phon = rhymeKeyEn(word);
  if (phon) return "phon:" + phon;
  return spellingRhymeKeyEn(word);
}

function isInPhonemeDict(word, lang) {
  if (!word) return false;
  if (lang === "fr") {
    return !!rhymeKeyFr(word) || !!rhymeKeyFr(stripFrenchElision(word));
  }
  return !!rhymeKeyEn(word);
}

// ── line / stanza extraction ──────────────────────────────────────────────

function endWord(line) {
  const t = (line || "").trim().replace(/[\s.,;:!?—–\-"')]+$/, "");
  const m = t.match(/(\S+)$/);
  return m ? m[1] : "";
}

function rhymeSchemeOf(lines, lang) {
  const keys = lines.map(l => rhymeKey(endWord(l), lang));
  if (keys.length < 2) return "—";
  const letterFor = {};
  let next = 65;
  const labels = keys.map(k => {
    if (!k) return "?";
    if (letterFor[k] === undefined) letterFor[k] = String.fromCharCode(next++);
    return letterFor[k];
  });
  const scheme = labels.join("");
  const counts = {};
  for (const ch of labels) counts[ch] = (counts[ch] || 0) + 1;
  const repeated = Object.values(counts).filter(c => c >= 2).length;
  if (repeated === 0) return "free";
  return scheme;
}

function describeRhymeTendency(schemes, lang) {
  if (!schemes.length) return lang === "fr" ? "vers libre" : "free verse";
  const free = schemes.filter(s => s === "free").length;
  if (free / schemes.length >= 0.7) {
    return lang === "fr"
      ? "vers libre — pas de rime finale"
      : "free verse — no end rhyme";
  }
  const counts = {};
  for (const s of schemes) counts[s] = (counts[s] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "mixed";
  const isFr = lang === "fr";
  if (top[0] === "free") {
    return isFr
      ? "majoritairement vers libre, avec rimes occasionnelles"
      : "predominantly free verse with occasional rhyme";
  }
  if (/^ABAB/i.test(top[0]))
    return isFr ? "ABAB (rimes croisées)" : "ABAB (alternating end rhyme)";
  if (/^AABB/i.test(top[0]))
    return isFr ? "AABB (rimes plates)" : "AABB (couplet rhyme)";
  if (/^AABA/i.test(top[0])) return "AABA";
  if (/^AAAA/i.test(top[0]))
    return isFr ? "AAAA (monorime)" : "AAAA (mono-rhyme)";
  if (/^ABBA/i.test(top[0]))
    return isFr ? "ABBA (rimes embrassées)" : "ABBA (envelope rhyme)";
  return isFr
    ? `rime finale lâche (observée : ${top[0]})`
    : `loose end rhyme (observed: ${top[0]})`;
}

function pickTypicalRange(values) {
  if (!values.length) return "—";
  if (values.length <= 3) return `${Math.min(...values)}–${Math.max(...values)}`;
  const sorted = values.slice().sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.1)];
  const hi = sorted[Math.ceil(sorted.length * 0.9) - 1];
  return `${lo}–${hi}`;
}

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function round1(n) { return Math.round(n * 10) / 10; }

// ── public ────────────────────────────────────────────────────────────────

export function analyzeProsody(rawText, lang = "en") {
  const lines = (rawText || "").replace(/\r/g, "").split("\n");
  const stanzas = [];
  let cur = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (cur.length) { stanzas.push(cur); cur = []; }
    } else {
      cur.push(line);
    }
  }
  if (cur.length) stanzas.push(cur);

  const stanzaProsody = stanzas.map(stanza => {
    const sylls = stanza.map(lineSyllables);
    const ends  = stanza.map(endWord);
    const known = ends.map(w => isInPhonemeDict(w, lang));
    return {
      lines: stanza,
      syllableCounts: sylls,
      endWords: ends,
      endWordsInDict: known,
      rhymeScheme: rhymeSchemeOf(stanza, lang),
      avgSyllables: round1(mean(sylls)),
      minSyllables: Math.min(...sylls),
      maxSyllables: Math.max(...sylls)
    };
  });

  const allSylls = stanzaProsody.flatMap(s => s.syllableCounts);
  const overall = allSylls.length ? {
    avgSyllables: round1(mean(allSylls)),
    minSyllables: Math.min(...allSylls),
    maxSyllables: Math.max(...allSylls),
    range: `${Math.min(...allSylls)}–${Math.max(...allSylls)}`,
    typical: pickTypicalRange(allSylls)
  } : null;

  const schemes = stanzaProsody.map(s => s.rhymeScheme);
  const rhymeTendency = describeRhymeTendency(schemes, lang);

  const allEnds = stanzaProsody.flatMap(s => s.endWordsInDict);
  const phoneticCoverage = allEnds.length ? allEnds.filter(Boolean).length / allEnds.length : 0;

  return { stanzas: stanzaProsody, overall, rhymeTendency, phoneticCoverage, lang };
}
