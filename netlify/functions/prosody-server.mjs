// prosody-server.mjs
// Server-side prosody analysis using the CMU phoneme dictionary. More
// accurate than the spelling-based heuristic in js/prosody.js — and
// because it lives on the server, the dict's bulk doesn't enter the
// browser bundle.
//
// Falls back to the spelling-based key for words not in the dict, so
// archaic or invented words still get *some* signal.

import { rhymeKey as phonemeRhymeKey } from "./rhyme-dict.js";

// Approximate syllable count for a word (same heuristic as the browser side).
function syllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

export function lineSyllables(line) {
  return (line || "").split(/\s+/).filter(Boolean).reduce((n, w) => n + syllables(w), 0);
}

// Spelling-based fallback for words missing from the phoneme dict.
function spellingRhymeKey(word) {
  if (!word) return "";
  let w = word.toLowerCase().replace(/[^a-z']/g, "");
  if (!w) return "";
  w = w.replace(/'s$/, "");
  w = w.replace(/ies$/, "iz").replace(/yes$/, "iz");
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  if (!m) return w.slice(-3);
  return "spelling:" + m[0]; // namespace so it never collides with phoneme keys
}

function endWord(line) {
  const t = (line || "").trim().replace(/[\s.,;:!?—–\-"')]+$/, "");
  const m = t.match(/(\S+)$/);
  return m ? m[1] : "";
}

export function rhymeKey(word) {
  if (!word) return "";
  const phon = phonemeRhymeKey(word);
  if (phon) return "phon:" + phon;
  return spellingRhymeKey(word);
}

function rhymeSchemeOf(lines) {
  const keys = lines.map(l => rhymeKey(endWord(l)));
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

function describeRhymeTendency(schemes) {
  if (!schemes.length) return "free verse";
  const free = schemes.filter(s => s === "free").length;
  if (free / schemes.length >= 0.7) return "free verse — no end rhyme";
  const counts = {};
  for (const s of schemes) counts[s] = (counts[s] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "mixed";
  if (top[0] === "free") return "predominantly free verse with occasional rhyme";
  if (/^ABAB/i.test(top[0]))      return "ABAB (alternating end rhyme)";
  if (/^AABB/i.test(top[0]))      return "AABB (couplet rhyme)";
  if (/^AABA/i.test(top[0]))      return "AABA";
  if (/^AAAA/i.test(top[0]))      return "AAAA (mono-rhyme)";
  if (/^ABBA/i.test(top[0]))      return "ABBA (envelope rhyme)";
  return `loose end rhyme (observed: ${top[0]})`;
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

export function analyzeProsody(rawText) {
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
    const known = ends.map(w => phonemeRhymeKey(w) ? true : false);
    return {
      lines: stanza,
      syllableCounts: sylls,
      endWords: ends,
      endWordsInDict: known,
      rhymeScheme: rhymeSchemeOf(stanza),
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
  const rhymeTendency = describeRhymeTendency(schemes);

  // Coverage statistic — what fraction of end-words were resolved phonetically.
  const allEnds = stanzaProsody.flatMap(s => s.endWordsInDict);
  const phoneticCoverage = allEnds.length ? allEnds.filter(Boolean).length / allEnds.length : 0;

  return { stanzas: stanzaProsody, overall, rhymeTendency, phoneticCoverage };
}
