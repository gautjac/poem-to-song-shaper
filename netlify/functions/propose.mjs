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

  return `${VOICE_RULES}

TASK — Propose THREE distinct alternative versions for the section labelled
"${sectionLabel}" (the section marked "← FILL THIS" below). Each version must:
  - sit naturally next to the surrounding sections (read them first)
  - honor the writer's voice and the analysis
  - be a different creative bet, not three variations of the same idea
  - be the right length for its label (verse: 3–5 lines; pre-chorus: 2–3 lines;
    chorus: 2–4 lines; bridge: 2–4 lines; outro: 1–3 lines)

VOICE & TONE
  Dominant tone: ${tone}
  Central tension: ${analysis.tension || "—"}
  Recurring images: ${recurring}
  Title under consideration: ${direction.possible_title || "—"}
  Target form notes: ${formNotes}
  Active songability dials: ${dialList}

ORIGINAL TEXT
\`\`\`
${source}
\`\`\`

CURRENT SONG STATE
\`\`\`
${songSoFar}
\`\`\`

OUTPUT
Return JSON only, in this exact shape — no prose around it:

{
  "options": [
    { "lines": ["line 1", "line 2", "line 3"], "note": "one short sentence on the creative choice" },
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

  return `${VOICE_RULES}

TASK — The sections below marked "← REWRITE THIS" are currently underwritten —
they have too few source lines or rely on placeholder connective lines. Rewrite
each one so it earns its slot in the song. Use the writer's voice, the
recurring imagery, and the surrounding sections as anchors. Do not duplicate
content already in other sections; do not introduce new pop tropes.

Sections to rewrite:
${targets}

VOICE & TONE
  Dominant tone: ${tone}
  Central tension: ${analysis.tension || "—"}
  Recurring images: ${recurring}
  Title under consideration: ${direction.possible_title || "—"}
  Target form notes: ${formNotes}
  Active songability dials: ${dialList}

ORIGINAL TEXT
\`\`\`
${source}
\`\`\`

CURRENT SONG STATE
\`\`\`
${songSoFar}
\`\`\`

OUTPUT
Return JSON only, no prose:

{
  "fills": [
    {
      "sectionIdx": <number>,
      "sectionLabel": "<label>",
      "lines": ["line 1", "line 2", "line 3"],
      "note": "one short sentence on the creative choice"
    },
    ...
  ]
}`;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

async function callAnthropic({ apiKey, model, prompt, maxTokens = 1500 }) {
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
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  // Concatenate all text content blocks, ignoring any thinking blocks.
  const text = (data.content || [])
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("");
  return { text, raw: data };
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
