// Netlify Function: propose.mjs
// Proxies a call to Anthropic's Claude API. The browser never sees the key.
//
// POST body:
//   {
//     mode:        "section" | "fill-thin",
//     source:      string         (the original poem)
//     analysis:    object         (output of analyzer.analyze)
//     direction:   object         (current shaping direction)
//     formNotes:   string         (target form notes)
//     dials:       string[]
//     // for "section":
//     sectionLabel:  string,
//     sectionIdx:    number,
//     // for "fill-thin":
//     thinSectionIndices: number[]
//   }
//
// Returns:
//   {
//     ok: true,
//     mode: ...,
//     // section mode
//     options: [{ lines: string[], note: string }, ...],
//     // fill-thin mode
//     fills: [{ sectionIdx, sectionLabel, lines, note }, ...]
//   }

const ANTHROPIC_URL  = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VER  = "2023-06-01";
const DEFAULT_MODEL  = "claude-sonnet-4-6";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";

const VOICE_RULES = `
You shape text into song. Follow these rules without exception:
- Preserve the writer's voice. Do NOT sterilize unusual phrasing or syntax.
- Do not impose neat commercial symmetry on a piece that resists it.
- Repetition must feel earned, never decorative.
- Hooks may emerge from image, rhythm, contradiction, or emotional statement —
  not from generic pop language.
- Keep ambiguity when it is artistically valuable.
- Match the speaker's diction. If they write plainly, write plainly. If they
  write with elevated diction, match it.
- Avoid the words heart, fire, broken, forever, soul, free, fly, alive, burn,
  dream, soar, shine, light up — UNLESS they already appear in the source.
- Do not introduce new pop tropes (no "stars in the sky," "tears in the rain,"
  "this love is endless," etc.).
- The lines you write must sit naturally next to the writer's existing lines.
  Read what comes before and after. Match their breath.

PROSODY — line length, meter, and rhyme:
- Match the source's typical syllables per line within ±2. If the source's
  lines run 8–11 syllables, your new lines run 8–11 syllables. Do not write
  a 16-syllable line into an 8-syllable poem.
- If the source has a rhyme scheme (ABAB, AABB, AABA, etc.), HONOR it. The
  end-words you produce must rhyme on the pattern that's already established.
- If the source is free verse with no end rhyme, do NOT introduce end rhyme.
  Resist the urge — false rhyme is the most common way to wreck a free-verse
  piece. Internal sonic echoes (assonance, consonance) are fine.
- Listen for the meter the source already has — if it leans iambic, lean
  iambic; if it lopes irregular, stay irregular.
- Count your syllables before you submit. Re-read the source's end-words
  before you choose yours.
`.trim();

function buildSectionPrompt(body) {
  const { source, analysis, direction, formNotes, dials, sectionLabel, sectionIdx } = body;
  const dialList = (dials && dials.length) ? dials.join(", ") : "none";

  // Slim copy of the direction with each section enumerated.
  const songSoFar = direction.sections.map((sec, i) => {
    const marker = i === sectionIdx ? "  ← FILL THIS" : "";
    const lines = sec.lines.map(l => `    ${l.text}  [${l.source_status}]`).join("\n");
    return `[${sec.label}]${marker}\n${lines}`;
  }).join("\n\n");

  const recurring = (analysis.recurring || []).map(r => `${r.word} (×${r.count})`).join(", ") || "none";
  const tone = (analysis.tone || []).join(" + ") || "neutral";
  const prosodyBlock = formatProsody(analysis.prosody);

  return `${VOICE_RULES}

TASK — Propose THREE distinct alternative versions for the section labelled
"${sectionLabel}" (the section marked "← FILL THIS" below). Each version must:
  - sit naturally next to the surrounding sections (read them first)
  - honor the writer's voice, the analysis, and the prosody constraints
  - be a different creative bet, not three variations of the same idea
  - be the right length for its label (verse: 3–5 lines; pre-chorus: 2–3 lines;
    chorus: 2–4 lines; bridge: 2–4 lines; outro: 1–3 lines)
  - match the source's syllables-per-line within ±2
  - honor the source's rhyme behavior (rhyme if it rhymes, free if it's free)

VOICE & TONE
  Dominant tone: ${tone}
  Central tension: ${analysis.tension || "—"}
  Recurring images: ${recurring}
  Title under consideration: ${direction.possible_title || "—"}
  Target form notes: ${formNotes}
  Active songability dials: ${dialList}

METER & RHYME
${prosodyBlock}

ORIGINAL TEXT
\`\`\`
${source}
\`\`\`

CURRENT SONG STATE
\`\`\`
${songSoFar}
\`\`\`

OUTPUT
Return JSON only, in this exact shape — no prose around it. In each option's
note, briefly mention syllable count and any rhyme honored.

{
  "options": [
    { "lines": ["line 1", "line 2", "line 3"], "note": "one short sentence on the creative choice (incl. syllables/rhyme)" },
    { "lines": ["..."], "note": "..." },
    { "lines": ["..."], "note": "..." }
  ]
}`;
}

function buildThinFillPrompt(body) {
  const { source, analysis, direction, formNotes, dials, thinSectionIndices } = body;
  const dialList = (dials && dials.length) ? dials.join(", ") : "none";
  const thinSet = new Set(thinSectionIndices);

  const songSoFar = direction.sections.map((sec, i) => {
    const marker = thinSet.has(i) ? "  ← REWRITE THIS" : "";
    const lines = sec.lines.map(l => `    ${l.text}  [${l.source_status}]`).join("\n");
    return `[${i}: ${sec.label}]${marker}\n${lines}`;
  }).join("\n\n");

  const targets = thinSectionIndices.map(i => `  - section ${i}: ${direction.sections[i].label}`).join("\n");
  const recurring = (analysis.recurring || []).map(r => `${r.word} (×${r.count})`).join(", ") || "none";
  const tone = (analysis.tone || []).join(" + ") || "neutral";
  const prosodyBlock = formatProsody(analysis.prosody);

  return `${VOICE_RULES}

TASK — The sections below marked "← REWRITE THIS" are currently underwritten —
they have too few source lines or rely on placeholder connective lines. Rewrite
each one so it earns its slot in the song. Use the writer's voice, the
recurring imagery, the prosody constraints, and the surrounding sections as
anchors. Do not duplicate content already in other sections; do not introduce
new pop tropes. Match the source's syllables-per-line within ±2 and honor its
rhyme behavior (rhyme if it rhymes, free if it's free).

Sections to rewrite:
${targets}

VOICE & TONE
  Dominant tone: ${tone}
  Central tension: ${analysis.tension || "—"}
  Recurring images: ${recurring}
  Title under consideration: ${direction.possible_title || "—"}
  Target form notes: ${formNotes}
  Active songability dials: ${dialList}

METER & RHYME
${prosodyBlock}

ORIGINAL TEXT
\`\`\`
${source}
\`\`\`

CURRENT SONG STATE
\`\`\`
${songSoFar}
\`\`\`

OUTPUT
Return JSON only, no prose. In each fill's note, briefly mention syllable
count and any rhyme honored.

{
  "fills": [
    {
      "sectionIdx": <number>,
      "sectionLabel": "<label>",
      "lines": ["line 1", "line 2", "line 3"],
      "note": "one short sentence on the creative choice (incl. syllables/rhyme)"
    },
    ...
  ]
}`;
}

function formatProsody(prosody) {
  if (!prosody?.overall) return "  (no prosody data — write naturally)";
  const o = prosody.overall;
  const out = [];
  out.push(`  Source typical syllables per line: ${o.typical} (full range ${o.range}, avg ${o.avgSyllables})`);
  out.push(`  → Your new lines should be ${o.typical} syllables. Hard ceiling: do not exceed ${o.maxSyllables + 1}.`);
  out.push(`  Rhyme behavior: ${prosody.rhymeTendency}`);
  if ((prosody.stanzas || []).length) {
    out.push(`  Per-stanza end-words and patterns:`);
    prosody.stanzas.forEach((s, i) => {
      const sylls = s.syllableCounts.join(", ");
      const ends  = (s.endWords || []).join(" / ");
      out.push(`    stanza ${i + 1}: scheme=${s.rhymeScheme}  syll=[${sylls}]  ends=[${ends}]`);
    });
  }
  return out.join("\n");
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function callAnthropicOnce({ apiKey, model, prompt, maxTokens }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": ANTHROPIC_VER,
      "Content-Type":      "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    const e = new Error(`Anthropic API ${res.status}: ${errText}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("");
  return { text, raw: data };
}

// Retry on transient errors (5xx, including 529 overloaded). Falls back to a
// faster, smaller model after the primary keeps failing — better to deliver
// haiku output than nothing.
async function callAnthropic({ apiKey, model, prompt, maxTokens = 1500 }) {
  const attempts = [
    { model, delay: 0 },
    { model, delay: 600 },
    { model: FALLBACK_MODEL, delay: 0 },
    { model: FALLBACK_MODEL, delay: 800 }
  ];
  let lastErr;
  for (const a of attempts) {
    if (a.delay) await new Promise(r => setTimeout(r, a.delay));
    try {
      return await callAnthropicOnce({ apiKey, model: a.model, prompt, maxTokens });
    } catch (err) {
      lastErr = err;
      // Don't retry on 4xx (auth, bad request) — those won't get better.
      if (err.status && err.status >= 400 && err.status < 500) throw err;
    }
  }
  throw lastErr;
}

// Pull out the first JSON object/array from a model response.
function extractJSON(text) {
  if (!text) throw new Error("empty model response");
  // Strip markdown fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  // Find the first { ... } block balanced
  const start = body.indexOf("{");
  if (start === -1) throw new Error("no JSON object in response");
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") {
      depth--;
      if (depth === 0) {
        const slice = body.slice(start, i + 1);
        return JSON.parse(slice);
      }
    }
  }
  throw new Error("unbalanced JSON in response");
}

export default async (req, _context) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "POST only" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, {
      ok: false,
      error: "Server is missing ANTHROPIC_API_KEY. Set it in Netlify env vars."
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return jsonResponse(400, { ok: false, error: "invalid JSON body" }); }

  if (!body || !body.mode) {
    return jsonResponse(400, { ok: false, error: "missing mode" });
  }
  if (!body.source || typeof body.source !== "string") {
    return jsonResponse(400, { ok: false, error: "missing source text" });
  }
  if (!body.direction || !Array.isArray(body.direction.sections)) {
    return jsonResponse(400, { ok: false, error: "missing direction.sections" });
  }

  const model = body.model || DEFAULT_MODEL;

  try {
    if (body.mode === "section") {
      if (!body.sectionLabel || typeof body.sectionIdx !== "number") {
        return jsonResponse(400, { ok: false, error: "section mode requires sectionLabel + sectionIdx" });
      }
      const prompt = buildSectionPrompt(body);
      const { text } = await callAnthropic({ apiKey, model, prompt, maxTokens: 1200 });
      const json = extractJSON(text);
      if (!Array.isArray(json.options)) throw new Error("response missing options[]");
      // Basic schema clean-up
      const options = json.options.slice(0, 3).map(o => ({
        lines: Array.isArray(o.lines) ? o.lines.map(String) : [],
        note:  typeof o.note === "string" ? o.note : ""
      })).filter(o => o.lines.length);
      return jsonResponse(200, { ok: true, mode: "section", options });
    }

    if (body.mode === "fill-thin") {
      if (!Array.isArray(body.thinSectionIndices) || !body.thinSectionIndices.length) {
        return jsonResponse(400, { ok: false, error: "fill-thin requires thinSectionIndices[]" });
      }
      const prompt = buildThinFillPrompt(body);
      const { text } = await callAnthropic({ apiKey, model, prompt, maxTokens: 2000 });
      const json = extractJSON(text);
      if (!Array.isArray(json.fills)) throw new Error("response missing fills[]");
      const fills = json.fills.map(f => ({
        sectionIdx:   typeof f.sectionIdx === "number" ? f.sectionIdx : -1,
        sectionLabel: typeof f.sectionLabel === "string" ? f.sectionLabel : "",
        lines:        Array.isArray(f.lines) ? f.lines.map(String) : [],
        note:         typeof f.note === "string" ? f.note : ""
      })).filter(f => f.sectionIdx >= 0 && f.lines.length);
      return jsonResponse(200, { ok: true, mode: "fill-thin", fills });
    }

    return jsonResponse(400, { ok: false, error: "unknown mode" });
  } catch (e) {
    return jsonResponse(500, { ok: false, error: String(e.message || e) });
  }
};

export const config = { path: "/api/propose" };
