// prosody.js
// Light-touch prosodic analysis. Produces per-line syllable counts, end-words,
// and a coarse rhyme-scheme detection for the source and each section type.
// We pass this to the model as constraint, not as instruction — the model is
// better at honoring meter than we are at prescribing it.

// Mirror of the syllable approximation in analyzer.js, kept local so prosody
// can be imported standalone without circular deps.
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

// Last "rhyme-bearing" segment of a word: vowel cluster + remaining consonants.
// Coarse — works on most spelling-aligned rhymes (hill/still, lay/away,
// remembers/embers). For sound-aligned rhymes that diverge in spelling
// (skies/eyes, night/bright), the labeled scheme may be off, but the actual
// end-words are still passed to the model in the prompt — and the model is
// far better at hearing rhyme than this heuristic is.
export function rhymeKey(word) {
  if (!word) return "";
  let w = word.toLowerCase().replace(/[^a-z']/g, "");
  if (!w) return "";
  // Strip possessive 's only.
  w = w.replace(/'s$/, "");
  // Normalize a few common spelling variants of the same sound.
  // "skies" ↔ "eyes": both end in /aɪz/ — coerce final 'ies' / 'yes' to 'iz'.
  w = w.replace(/ies$/, "iz");
  w = w.replace(/yes$/, "iz");
  // Plural -s after a vowel: drop it ("rooms" → "room", "blooms" → "bloom"
  // both end with the same rhyme key).
  w = w.replace(/([aeiouy][a-z]{2,})s$/, "$1");
  // Find the last vowel cluster + remaining consonants — that's the rhyme.
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  if (!m) return w.slice(-3);
  return m[0];
}

function endWord(line) {
  // Last word, stripped of trailing punctuation.
  const t = (line || "").trim().replace(/[\s.,;:!?—–\-"')]+$/, "");
  const m = t.match(/(\S+)$/);
  return m ? m[1] : "";
}

// Detect the rhyme scheme of an array of lines.
// Returns a compact label: "ABAB", "AABB", "AABA", "AAAA", or "free".
function rhymeSchemeOf(lines) {
  const keys = lines.map(l => rhymeKey(endWord(l)));
  if (keys.length < 2) return "—";
  // Map each key to a letter
  const letterFor = {};
  let next = 65; // 'A'
  const labels = keys.map(k => {
    if (!k) return "?";
    if (letterFor[k] === undefined) {
      letterFor[k] = String.fromCharCode(next++);
    }
    return letterFor[k];
  });
  const scheme = labels.join("");
  // Count distinct letters that appear at least twice — that's evidence of rhyme.
  const counts = {};
  for (const ch of labels) counts[ch] = (counts[ch] || 0) + 1;
  const repeated = Object.values(counts).filter(c => c >= 2).length;
  if (repeated === 0) return "free";
  return scheme;
}

// Given a list of source lines (raw, with blanks), return per-stanza prosody
// and overall metrics.
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
    return {
      lines: stanza,
      syllableCounts: sylls,
      endWords: stanza.map(endWord),
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

  // Aggregate rhyme scheme tendency.
  const schemes = stanzaProsody.map(s => s.rhymeScheme);
  const rhymeTendency = describeRhymeTendency(schemes);

  return { stanzas: stanzaProsody, overall, rhymeTendency };
}

// Compact prosody constraint for a *target section*. Looks at all stanzas to
// infer what a verse / chorus / bridge should sound like, syllable-wise.
// We don't try to distinguish verse-meter from chorus-meter from the source
// alone (it usually doesn't exist yet); we report the source's typical line
// length and let the model interpret.
export function constraintFor(prosody, sectionLabel) {
  if (!prosody?.overall) return null;
  const o = prosody.overall;
  return {
    syllableTarget: o.typical,             // e.g., "7–11"
    avgSyllables:  o.avgSyllables,
    rhymeScheme:   prosody.rhymeTendency,  // string label
    label:         sectionLabel
  };
}

// ── helpers ─────────────────────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function round1(n) { return Math.round(n * 10) / 10; }

function pickTypicalRange(values) {
  // Drop top/bottom outliers, return min–max of the middle 80%.
  if (values.length <= 3) return `${Math.min(...values)}–${Math.max(...values)}`;
  const sorted = values.slice().sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.1)];
  const hi = sorted[Math.ceil(sorted.length * 0.9) - 1];
  return `${lo}–${hi}`;
}

function describeRhymeTendency(schemes) {
  if (!schemes.length) return "free verse";
  const free = schemes.filter(s => s === "free").length;
  if (free / schemes.length >= 0.7) return "free verse — no end rhyme";
  // Find the most common scheme
  const counts = {};
  for (const s of schemes) counts[s] = (counts[s] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "mixed";
  if (top[0] === "free") return "predominantly free verse with occasional rhyme";
  // Common patterns
  if (/^(ABAB|abab)/i.test(top[0])) return "ABAB (alternating end rhyme)";
  if (/^(AABB|aabb)/i.test(top[0])) return "AABB (couplet rhyme)";
  if (/^(AABA|aaba)/i.test(top[0])) return "AABA";
  return `loose end rhyme (observed: ${top[0]})`;
}
