# Poem to Song Shaper

A workbench for turning a poem, lyrical fragment, monologue, or freeform passage
into a song-ready structure — without flattening its originality.

The goal is not to "rewrite a poem as a pop song." The goal is to help reveal
what is already there: the natural refrain, the strongest images, the
emotional turn, the lines that should never be touched.

## What it does

Paste text on the left. The app:

1. **Reads the piece** — dominant tone, central tension, recurring images,
   natural refrains, title candidates, and an honest verdict on whether the
   piece even wants to become a song. (If it doesn't, it says so.)
2. **Proposes three directions** — the same source shaped three ways:
   - **Minimal intervention** — preserves cadence; introduces a soft refrain.
   - **Balanced adaptation** — reorders into the target form, compresses long
     lines, builds a true returning chorus.
   - **Bold restructuring** — pulls the dominant image forward and rebuilds
     the song around its gravity.
3. **Shows what changed** — every line is colour-coded:
   - 🟢 original line · 🟠 lightly adapted · 🟣 heavily adapted · 🟡 new
     connective · ◌ repeat
4. **Refines per-line** — click any line for compression variants
   (shorter, simpler, keep-image, easier to sing, more rhythmic).
5. **Switches target form** — singer-songwriter, folk ballad, indie art song,
   musical theatre, pop-adjacent, or spoken-word with refrain.
6. **Tunes songability** — toggle dials for repetition, clarity, density,
   conversational tone, melodic phrasing, shorter lines, stronger hook.
7. **Saves & exports** — favorite hooks, saved versions, lyric-sheet copy,
   markdown export, hooks-only copy.

## Stack

- Vanilla HTML / CSS / JS, ES modules, no build step.
- Mock shaping engine runs entirely in the browser using heuristics over the
  pasted text — deterministic, instant, free, no key required.
- Optional AI proposals (per-section ✦ button and "fill thin sections") use
  Claude via a small Netlify Function (`netlify/functions/propose.mjs`) so the
  API key stays server-side.

## AI features

Once an API key is configured, two features become available on each shaping
direction:

- **Per-section ✦ propose** — hover a section header in the directions pane,
  click the ✦ button, and Claude returns three distinct alternative versions of
  that section in your voice. Pick one to replace it.
- **✦ Fill thin sections** — auto-detects sections that lean on placeholder
  content (mostly `new connective` or `repeat` lines, or fewer than two lines
  total), then asks Claude to rewrite all of them in a single batched call.

Both calls receive the original poem, the analysis, the current direction's
state, the target form, and the active songability dials — so generated lines
sit naturally next to what's already there.

### Setting the API key

You need an [Anthropic API key](https://console.anthropic.com/).

**Production (Netlify):**
```bash
netlify env:set ANTHROPIC_API_KEY sk-ant-...
netlify deploy --prod
```

**Local dev with the function:**
```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
netlify dev   # serves the static site + /api/propose locally
```

Without a key, the rest of the app works fine; only the ✦ buttons go inert.

## Run locally

```bash
# any static server works
python3 -m http.server 5577
# then open http://localhost:5577/
```

Or just open `index.html` directly in a modern browser (the file uses ES
modules, which most browsers serve fine over `file://` but a localhost server
is preferred).

## File map

```
index.html          — single-page shell
styles.css          — editorial dark/light theme

js/app.js           — controller, event wiring
js/state.js         — minimal reactive state
js/analyzer.js      — line scoring, imagery, recurrence, tone, verdict
js/shaper.js        — produces the three shaping directions
js/compressor.js    — line-level transformations
js/forms.js         — target form blueprints
js/prompts.js       — LLM prompt templates
js/ai.js            — browser-side client for the propose function
js/examples.js      — three demo texts
js/render.js        — DOM rendering
js/storage.js       — localStorage layer
js/export.js        — lyric-sheet, markdown, hooks-only formats

netlify/functions/propose.mjs  — proxies AI calls to Claude
```

## Output schema

Each shaping direction returns:

```json
{
  "direction": "Minimal intervention",
  "rationale": "...",
  "emotional_core": "...",
  "possible_title": "Borrowing Time",
  "hook_candidates": ["...", "..."],
  "preserve_verbatim": ["...", "..."],
  "adaptation_notes": ["...", "..."],
  "sections": [
    {
      "label": "Verse 1",
      "lines": [
        { "text": "...", "source_status": "original" },
        { "text": "...", "source_status": "adapted" }
      ]
    }
  ]
}
```

`source_status` is one of `original`, `adapted`, `heavy`, `new`, `repeat`.

## Voice rules

The shaper follows these rules without exception:

- Preserve the writer's voice. Do not sterilize unusual phrasing.
- Do not impose neat commercial symmetry.
- Repetition must feel earned.
- Hooks may emerge from image, rhythm, contradiction, or emotional statement —
  not from generic pop language.
- Avoid `heart`, `fire`, `broken`, `forever`, `soul`, `free`, `fly`, `alive`,
  `burn` unless they already appear in the source.
- If the piece does not want to be a song, say so honestly.

## License

MIT.
