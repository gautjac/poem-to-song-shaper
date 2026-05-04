// export.js
// Lyric-sheet text, markdown, and hook-only output formats.

export function asLyricSheet(direction) {
  const lines = [];
  lines.push((direction.possible_title || "Untitled").toUpperCase());
  lines.push(`(${direction.direction})`);
  lines.push("");
  for (const section of direction.sections) {
    lines.push(`[${section.label}]`);
    for (const line of section.lines) {
      lines.push(line.text);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function asMarkdown(direction) {
  const out = [];
  out.push(`# ${direction.possible_title || "Untitled"}`);
  out.push("");
  out.push(`*${direction.direction}*`);
  out.push("");
  out.push(`> **Rationale.** ${direction.rationale}`);
  out.push("");
  out.push(`**Emotional core.** ${direction.emotional_core}`);
  out.push("");
  if (direction.hook_candidates?.length) {
    out.push(`**Hook candidates.**`);
    direction.hook_candidates.forEach(h => out.push(`- ${h}`));
    out.push("");
  }
  if (direction.preserve_verbatim?.length) {
    out.push(`**Preserve verbatim.**`);
    direction.preserve_verbatim.forEach(p => out.push(`- ${p}`));
    out.push("");
  }
  if (direction.adaptation_notes?.length) {
    out.push(`**Adaptation notes.**`);
    direction.adaptation_notes.forEach(n => out.push(`- ${n}`));
    out.push("");
  }
  out.push(`---`);
  out.push("");
  for (const section of direction.sections) {
    out.push(`### ${section.label}`);
    out.push("");
    for (const line of section.lines) {
      const tag =
        line.source_status === "original" ? "" :
        line.source_status === "adapted"  ? "  ⟂" :
        line.source_status === "heavy"    ? "  ⟂⟂" :
        line.source_status === "new"      ? "  ✦" :
        line.source_status === "repeat"   ? "  ↳" : "";
      out.push(line.text + tag);
    }
    out.push("");
  }
  return out.join("\n");
}

export function asHooksOnly(direction) {
  return (direction.hook_candidates || []).map(h => `• ${h}`).join("\n") + "\n";
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}
