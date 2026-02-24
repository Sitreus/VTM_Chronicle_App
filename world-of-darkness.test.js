/**
 * Tests for world-of-darkness.jsx
 *
 * These tests verify bugs found during code analysis and confirm fixes.
 * Since the source file is a single non-exported JSX component, we extract
 * the pure utility logic inline here and test it directly.
 */
import { describe, it, expect } from "vitest";

// ─── Extracted: repairJSON (lines 75-159) ───
const repairJSON = (text) => {
  let s = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(s); } catch {}

  let inString = false;
  let escape = false;
  let braces = 0;
  let brackets = 0;

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

  const lastComma = s.lastIndexOf(',');
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

// ─── Extracted: stripMarkdown — BUGGY version (images after links) ───
const stripMarkdownBuggy = (text) => {
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
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links first — BUG
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")  // images second — too late
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// ─── Extracted: stripMarkdown — FIXED version (images before links) ───
const stripMarkdownFixed = (text) => {
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
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")  // images FIRST — fixed
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links second
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// ─── Extracted: cycleThreadStatus — BUGGY version ───
function cycleThreadStatusBuggy(threads, id) {
  const idx = threads.findIndex((t) => t.id === id);
  if (idx < 0) return threads;
  const order = ["active", "cold", "resolved"];
  const cur = order.indexOf(threads[idx].status);
  // BUG: when status is not in order, cur = -1, (cur+1)%3 = 0 → always "active"
  threads[idx] = { ...threads[idx], status: order[(cur + 1) % 3] };
  return threads;
}

// ─── Extracted: cycleThreadStatus — FIXED version ───
function cycleThreadStatusFixed(threads, id) {
  const idx = threads.findIndex((t) => t.id === id);
  if (idx < 0) return threads;
  const order = ["active", "cold", "resolved"];
  const cur = order.indexOf(threads[idx].status);
  if (cur < 0) return threads; // FIX: guard against unknown status
  threads[idx] = { ...threads[idx], status: order[(cur + 1) % 3] };
  return threads;
}

// ─── Extracted: API response text — BUGGY (no null guard) ───
function extractTextBuggy(data) {
  const text = data.content.map((i) => i.text || "").join("\n");
  return text;
}

// ─── Extracted: API response text — FIXED ───
function extractTextFixed(data) {
  const text = (data.content || []).map((i) => i.text || "").join("\n");
  return text;
}

// ═══════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════

describe("repairJSON", () => {
  it("parses valid JSON directly", () => {
    const result = repairJSON('{"name":"test","value":42}');
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("strips markdown code fences before parsing", () => {
    const result = repairJSON('```json\n{"a":1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it("repairs truncated JSON with unclosed braces", () => {
    const result = repairJSON('{"summary":"A dark night","mood":"tense"');
    expect(result).not.toBeNull();
    expect(result.summary).toBe("A dark night");
  });

  it("repairs truncated JSON with trailing comma", () => {
    const result = repairJSON('{"summary":"test","mood":"grim",');
    expect(result).not.toBeNull();
    expect(result.summary).toBe("test");
  });

  it("returns fallback object with empty fields for non-JSON input", () => {
    // repairJSON's last-resort regex fallback returns an empty-fields object
    // rather than null — this is acceptable behavior for graceful degradation
    const result = repairJSON("not json at all");
    expect(result).toBeDefined();
    expect(result.summary).toBe("");
    expect(result.mood).toBe("");
  });

  it("falls back to regex extraction when repair fails", () => {
    const result = repairJSON('{"summary": "dark events", "mood": "tense", "storyBeats": ["beat1"], broken!!!');
    expect(result).not.toBeNull();
    expect(result.summary).toBe("dark events");
    expect(result.mood).toBe("tense");
  });
});

describe("BUG: stripMarkdown image stripping (regex ordering)", () => {
  it("BUGGY: images leave behind '!' when link regex runs first", () => {
    // The link regex matches [alt](url) inside ![alt](url), leaving "!"
    expect(stripMarkdownBuggy("![alt](http://img.png)")).toBe("!alt");
  });

  it("FIXED: images are fully stripped when image regex runs first", () => {
    expect(stripMarkdownFixed("![alt](http://img.png)")).toBe("");
  });

  it("FIXED: links still work correctly", () => {
    expect(stripMarkdownFixed("[click here](http://example.com)")).toBe("click here");
  });

  it("FIXED: mixed images and links in same text", () => {
    const input = "See ![logo](http://img.png) and [docs](http://docs.com)";
    const result = stripMarkdownFixed(input);
    expect(result).toBe("See  and docs");
    expect(result).not.toContain("!");
  });

  it("FIXED: returns empty string for falsy input", () => {
    expect(stripMarkdownFixed(null)).toBe("");
    expect(stripMarkdownFixed(undefined)).toBe("");
    expect(stripMarkdownFixed("")).toBe("");
  });

  it("FIXED: strips headers", () => {
    expect(stripMarkdownFixed("## Title")).toBe("Title");
  });

  it("FIXED: strips bold and italic", () => {
    expect(stripMarkdownFixed("**bold**")).toBe("bold");
    expect(stripMarkdownFixed("*italic*")).toBe("italic");
  });

  it("FIXED: collapses excess newlines", () => {
    expect(stripMarkdownFixed("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("BUG: cycleThreadStatus — invalid status handling", () => {
  const threads = [
    { id: "t1", status: "active", title: "Thread 1" },
    { id: "t2", status: "unknown_status", title: "Thread 2" },
    { id: "t3", status: undefined, title: "Thread 3" },
  ];

  it("BUGGY: unknown status silently forced to 'active'", () => {
    const result = cycleThreadStatusBuggy([...threads.map((t) => ({ ...t }))], "t2");
    const t2 = result.find((t) => t.id === "t2");
    expect(t2.status).toBe("active"); // unexpected forced reset
  });

  it("BUGGY: undefined status also forced to 'active'", () => {
    const result = cycleThreadStatusBuggy([...threads.map((t) => ({ ...t }))], "t3");
    const t3 = result.find((t) => t.id === "t3");
    expect(t3.status).toBe("active");
  });

  it("FIXED: unknown status is left unchanged", () => {
    const input = [...threads.map((t) => ({ ...t }))];
    const result = cycleThreadStatusFixed(input, "t2");
    const t2 = result.find((t) => t.id === "t2");
    expect(t2.status).toBe("unknown_status");
  });

  it("FIXED: normal cycling still works", () => {
    const input = [{ id: "t1", status: "active", title: "A" }];
    const result = cycleThreadStatusFixed(input, "t1");
    expect(result[0].status).toBe("cold");
  });

  it("FIXED: full cycle active -> cold -> resolved -> active", () => {
    let input = [{ id: "t1", status: "active", title: "A" }];
    input = cycleThreadStatusFixed(input, "t1");
    expect(input[0].status).toBe("cold");
    input = cycleThreadStatusFixed([{ ...input[0] }], "t1");
    expect(input[0].status).toBe("resolved");
    input = cycleThreadStatusFixed([{ ...input[0] }], "t1");
    expect(input[0].status).toBe("active");
  });
});

describe("BUG: Missing optional chaining on API response", () => {
  it("BUGGY: throws when data.content is undefined", () => {
    expect(() => extractTextBuggy({})).toThrow();
    expect(() => extractTextBuggy({ content: undefined })).toThrow();
  });

  it("BUGGY: throws when data.content is null", () => {
    expect(() => extractTextBuggy({ content: null })).toThrow();
  });

  it("FIXED: returns empty string when data.content is undefined", () => {
    expect(extractTextFixed({})).toBe("");
    expect(extractTextFixed({ content: undefined })).toBe("");
  });

  it("FIXED: returns empty string when data.content is null", () => {
    expect(extractTextFixed({ content: null })).toBe("");
  });

  it("FIXED: still works normally with valid data", () => {
    const data = { content: [{ text: "Hello" }, { text: " World" }] };
    expect(extractTextFixed(data)).toBe("Hello\n World");
  });
});

describe("Source file verification: all fixes and API integration", () => {
  let mainSource;
  let claudeSource;
  let splashSource;
  let actionsSource;
  let modalsSource;
  let contextSource;
  beforeAll(async () => {
    const fs = await import("fs");
    mainSource = fs.readFileSync("/home/user/VTM_Chronicle_App/src/WorldOfDarkness.jsx", "utf-8");
    claudeSource = fs.readFileSync("/home/user/VTM_Chronicle_App/src/utils/claude.js", "utf-8");
    splashSource = fs.readFileSync("/home/user/VTM_Chronicle_App/src/components/SplashScreen.jsx", "utf-8");
    actionsSource = fs.readFileSync("/home/user/VTM_Chronicle_App/src/hooks/useChronicleActions.js", "utf-8");
    modalsSource = fs.readFileSync("/home/user/VTM_Chronicle_App/src/modals/ChronicleModals.jsx", "utf-8");
    contextSource = fs.readFileSync("/home/user/VTM_Chronicle_App/src/context/ChronicleContext.jsx", "utf-8");
  });

  it("has centralized callClaude helper with auth headers", () => {
    expect(claudeSource).toContain("const callClaude = async (apiKey, messages");
    expect(claudeSource).toContain('"x-api-key": apiKey');
    expect(claudeSource).toContain('"anthropic-version": "2023-06-01"');
  });

  it("all API calls go through callClaude (no raw fetch to anthropic)", () => {
    expect(claudeSource).toContain('const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"');
    expect(claudeSource).toContain("const res = await fetch(url,");
    const rawFetches = claudeSource.match(/fetch\("https:\/\/api\.anthropic\.com/g);
    expect(rawFetches).toBeNull();
    // callClaude usages: session parse + recap in actions hook, parseCharacter in claude.js
    const actionsUsages = actionsSource.match(/await callClaude\(apiKey/g);
    expect(actionsUsages).toHaveLength(2);
    const claudeUsages = claudeSource.match(/await callClaude\(apiKey/g);
    expect(claudeUsages).toHaveLength(1);
  });

  it("callClaude handles error status codes with clear messages", () => {
    expect(claudeSource).toContain("res.status === 401");
    expect(claudeSource).toContain("res.status === 429");
    expect(claudeSource).toContain("Invalid API key");
  });

  it("has null-safe response handling in callClaude", () => {
    expect(claudeSource).toContain("(data.content || []).map(i => i.text");
  });

  it("has guard for invalid status in cycle thread", () => {
    expect(actionsSource).toContain("if (cur < 0) return;");
  });

  it("has image regex before link regex in stripMarkdown", () => {
    const imageIdx = claudeSource.indexOf('.replace(/!\\[([^\\]]*)\\]\\([^)]+\\)/g, "")');
    const linkIdx = claudeSource.indexOf('.replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, "$1")');
    expect(imageIdx).toBeGreaterThan(0);
    expect(linkIdx).toBeGreaterThan(0);
    expect(imageIdx).toBeLessThan(linkIdx);
  });

  it("has apiKey and proxyUrl state and storage management", () => {
    // State is now in the context provider
    expect(contextSource).toContain('const [apiKey, setApiKey] = useState("")');
    expect(contextSource).toContain('const [proxyUrl, setProxyUrl] = useState("")');
    expect(contextSource).toContain('storageGet("wod-api-key")');
    // storageSet for api key/proxy is in modals (settings save)
    expect(modalsSource).toContain('storageSet("wod-api-key"');
    expect(contextSource).toContain('storageGet("wod-proxy-url")');
    expect(modalsSource).toContain('storageSet("wod-proxy-url"');
  });

  it("has API key validation before API calls", () => {
    // API key checks are now in the actions hook + claude.js
    const actionsChecks = actionsSource.match(/if \(!apiKey\)/g) || [];
    const claudeChecks = claudeSource.match(/if \(!apiKey\)/g) || [];
    expect(actionsChecks.length + claudeChecks.length).toBeGreaterThanOrEqual(4);
  });

  it("has settings modal with test connection and proxy URL", () => {
    // Settings modal is now in ChronicleModals
    expect(modalsSource).toContain('showModal === "settings"');
    expect(modalsSource).toContain("Test Connection");
    expect(modalsSource).toContain("CORS Proxy URL");
    expect(modalsSource).toContain("Save Settings");
  });

  it("has API key setup button on splash screen", () => {
    expect(splashSource).toContain("Set API Key");
    expect(splashSource).toContain('setShowModal("settings")');
  });

  it("passes proxyUrl through to all API calls", () => {
    // proxyUrl is now passed through in the actions hook + claude.js
    const actionsPasses = actionsSource.match(/\{ *(?:maxTokens: \d+, *)?proxyUrl *\}/g) || [];
    const claudePasses = claudeSource.match(/\{ *(?:maxTokens: \d+, *)?proxyUrl *\}/g) || [];
    expect(actionsPasses.length + claudePasses.length).toBeGreaterThanOrEqual(3);
  });
});
