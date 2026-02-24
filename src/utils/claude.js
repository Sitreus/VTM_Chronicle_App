const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_PROXY = "/api/claude/v1/messages";

export const callClaude = async (apiKey, messages, { maxTokens = 4096, model = "claude-sonnet-4-20250514", proxyUrl } = {}) => {
  if (!apiKey) throw new Error("API key not set. Open Settings (\u2699) to add your Anthropic API key.");
  const url = proxyUrl || DEFAULT_PROXY;
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const apiMsg = body?.error?.message || "";
    if (res.status === 401) throw new Error(`Authentication failed (401): ${apiMsg || "Invalid API key. Check your key in Settings (\u2699)."}`);
    if (res.status === 403) throw new Error(`Access forbidden (403): ${apiMsg || "Your key may lack permissions."}`);
    if (res.status === 429) throw new Error(`Rate limited (429): ${apiMsg || "Please wait a moment and try again."}`);
    if (res.status === 529) throw new Error(`API overloaded (529): ${apiMsg || "Please try again later."}`);
    throw new Error(apiMsg || `API error ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Unknown API error");
  return (data.content || []).map(i => i.text || "").join("\n");
};

export const repairJSON = (text) => {
  let s = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(s); } catch {}

  let inString = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;
  let lastGoodIdx = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    if (ch === '}') { braces--; lastGoodIdx = i; }
    if (ch === '[') brackets++;
    if (ch === ']') { brackets--; lastGoodIdx = i; }
  }

  if (inString) s += '"';

  const lastComma = s.lastIndexOf(',');
  const lastColon = s.lastIndexOf(':');
  const lastCloseBrace = s.lastIndexOf('}');
  const lastCloseBracket = s.lastIndexOf(']');
  const lastComplete = Math.max(lastCloseBrace, lastCloseBracket);

  if (lastComma > lastComplete) {
    s = s.substring(0, lastComma);
  }

  inString = false;
  escape = false;
  braces = 0;
  brackets = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
  }
  if (inString) s += '"';
  while (brackets > 0) { s += ']'; brackets--; }
  while (braces > 0) { s += '}'; braces--; }

  try { return JSON.parse(s); } catch {}

  try {
    const summaryMatch = s.match(/"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    const moodMatch = s.match(/"mood"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    const beatsMatch = s.match(/"storyBeats"\s*:\s*(\[[^\]]*\])/);
    const npcsMatch = s.match(/"newNPCs"\s*:\s*(\[[\s\S]*?\])\s*(?:,\s*"(?:updated|character|location|mood))/);

    return {
      summary: summaryMatch?.[1] || "",
      mood: moodMatch?.[1] || "",
      storyBeats: beatsMatch ? JSON.parse(beatsMatch[1]) : [],
      newNPCs: npcsMatch ? JSON.parse(npcsMatch[1]) : [],
      updatedNPCs: [],
      characterUpdates: [],
      locations: [],
    };
  } catch {}

  return null;
};

export const parseCharacterMarkdown = async (mdText, gameType, apiKey, proxyUrl) => {
  try {
    const text = await callClaude(apiKey, [{
      role: "user",
      content: `You are a World of Darkness character sheet parser. Extract character data from this markdown document for a ${gameType} game.

Markdown content:
${mdText}

Respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "name": "character's full name",
  "concept": "character concept/archetype if found",
  "clan": "clan, tradition, tribe, guild, or creed if found",
  "nature": "Nature archetype if found",
  "demeanor": "Demeanor archetype if found",
  "backstory": "full backstory/background text compiled from the document, preserve detail and narrative, output as plain text without any markdown formatting",
  "notes": "any additional notes, current status, goals, or other relevant info not fitting above categories, as plain text",
  "faction": "sect, convention, camp, or other faction affiliation if found",
  "generation": "generation/rank/arete level if found",
  "sire": "sire/mentor name if found",
  "haven": "haven/sanctum/territory location if found",
  "allies": ["names of known allies mentioned"],
  "enemies": ["names of known enemies mentioned"],
  "attributes": "any attribute scores found, as a readable string",
  "abilities": "any ability/skill scores found, as a readable string",
  "disciplines": "any disciplines/spheres/gifts found, as a readable string",
  "meritsFlaws": "any merits and flaws found, as a readable string",
  "mentionedNPCs": [{"name": "NPC name", "description": "brief description based on context", "relationship": "one of: Ally/Enemy/Rival/Contact/Mentor/Lover/Patron/Sire/Childe/Coterie/Cabal/Pack/Unknown/Neutral/Suspicious/Feared/Respected", "faction": "clan/tradition/group if known", "notes": "any details about this NPC from the document"}]
}

IMPORTANT: For mentionedNPCs, extract ALL named NPCs referenced in the document — sires, mentors, allies, enemies, contacts, lovers, rivals, anyone with a name who is not the main character themselves.
Only include fields where you find actual data. Leave empty string "" for missing text fields and empty array [] for missing array fields.`
    }], { proxyUrl });
    return repairJSON(text);
  } catch (e) {
    console.error("Character parse error:", e);
    return null;
  }
};

export const stripMarkdown = (text) => {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "\u2022 ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
