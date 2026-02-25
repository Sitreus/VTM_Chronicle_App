#!/usr/bin/env node

/**
 * VTM Chronicle MCP Server
 *
 * Exposes your World of Darkness chronicle data to Claude Desktop
 * so it can read and update your chronicles during RP sessions.
 *
 * Usage:
 *   node index.js [--data-dir ./data]
 *
 * Add to Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "vtm-chronicle": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/mcp-server/index.js"],
 *         "env": { "VTM_DATA_DIR": "/absolute/path/to/data" }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ChronicleStorage from "./storage.js";

// ─── Resolve data directory ──────────────────────────────────
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const dataDir = resolve(
  process.env.VTM_DATA_DIR ||
    process.argv.find((a, i) => process.argv[i - 1] === "--data-dir") ||
    join(__dirname, "data")
);

const storage = new ChronicleStorage(dataDir);

// ─── Create MCP Server ──────────────────────────────────────
const server = new McpServer({
  name: "vtm-chronicle",
  version: "1.0.0",
  capabilities: { tools: {} },
});

// ═══════════════════════════════════════════════════════════════
// READ TOOLS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "list_chronicles",
  "List all chronicles in the database with their metadata (id, name, game type, description)",
  {},
  async () => {
    const list = await storage.listChronicles();
    if (list.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No chronicles found. Export a chronicle from the web app as JSON and place it in the data directory, or use create_chronicle to make a new one.",
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: list
            .map(
              (c) =>
                `**${c.name}** (${c.gameType}) — id: ${c.id}\n  ${c.description || "No description"}`
            )
            .join("\n\n"),
        },
      ],
    };
  }
);

server.tool(
  "get_chronicle_overview",
  "Get an overview of a chronicle — stats, entity counts, recent sessions, active threads, and clocks",
  { chronicle_id: z.string().describe("The chronicle ID") },
  async ({ chronicle_id }) => {
    const chr = await storage.getChronicle(chronicle_id);
    if (!chr) return err("Chronicle not found");
    const d = chr.data;
    const lastSession = d.sessions?.[d.sessions.length - 1];
    const activeThreads = (d.plotThreads || []).filter(
      (t) => t.status === "active"
    );
    const activeClocks = (d.clocks || []).filter(
      (c) => c.filled < c.segments
    );

    const lines = [
      `# ${chr.name}`,
      `*${chr.gameType}* — ${chr.description || ""}`,
      "",
      `## Stats`,
      `- Sessions: ${d.sessions?.length || 0}`,
      `- NPCs: ${d.npcs?.length || 0}`,
      `- Player Characters: ${d.characters?.length || 0}`,
      `- Factions: ${d.factions?.length || 0}`,
      `- Locations: ${d.locationDossiers?.length || 0}`,
      `- Plot Threads: ${d.plotThreads?.length || 0} (${activeThreads.length} active)`,
      `- Clocks: ${d.clocks?.length || 0}`,
      `- Rumors: ${d.rumors?.length || 0}`,
    ];

    if (lastSession) {
      lines.push(
        "",
        `## Most Recent Session`,
        `**Session ${lastSession.number}${lastSession.title ? ` — ${lastSession.title}` : ""}** (${lastSession.date})`,
        lastSession.summary || "(no summary)"
      );
    }

    if (activeThreads.length) {
      lines.push("", `## Active Plot Threads`);
      activeThreads.forEach((t) => {
        lines.push(
          `- **${t.title}** [${t.type}]: ${t.description || "no description"}`
        );
      });
    }

    if (activeClocks.length) {
      lines.push("", `## Active Clocks`);
      activeClocks.forEach((c) => {
        const bar = "█".repeat(c.filled) + "░".repeat(c.segments - c.filled);
        lines.push(`- **${c.name}** [${bar}] ${c.filled}/${c.segments} (${c.type})`);
      });
    }

    return text(lines.join("\n"));
  }
);

server.tool(
  "get_npcs",
  "Get all NPCs in a chronicle, optionally filtered by relationship type, faction, or name search",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    relationship: z
      .string()
      .optional()
      .describe("Filter by relationship type (e.g. Ally, Enemy, Rival)"),
    faction: z.string().optional().describe("Filter by faction name"),
    search: z.string().optional().describe("Search NPCs by name or description"),
  },
  async ({ chronicle_id, relationship, faction, search }) => {
    let npcs = await storage.getNPCs(chronicle_id);
    if (relationship)
      npcs = npcs.filter(
        (n) => n.relationship?.toLowerCase() === relationship.toLowerCase()
      );
    if (faction)
      npcs = npcs.filter((n) =>
        n.faction?.toLowerCase().includes(faction.toLowerCase())
      );
    if (search) {
      const q = search.toLowerCase();
      npcs = npcs.filter(
        (n) =>
          n.name?.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q) ||
          n.personality?.toLowerCase().includes(q)
      );
    }
    if (npcs.length === 0) return text("No NPCs found matching the criteria.");

    const lines = npcs.map((n) => {
      const parts = [`## ${n.name} [${n.relationship || "Unknown"}]`];
      if (n.faction) parts.push(`**Faction:** ${n.faction}`);
      if (n.description) parts.push(n.description);
      if (n.appearance) parts.push(`**Appearance:** ${n.appearance}`);
      if (n.personality) parts.push(`**Personality:** ${n.personality}`);
      if (n.backstory) parts.push(`**Backstory:** ${n.backstory}`);
      if (n.motivations) parts.push(`**Motivations:** ${n.motivations}`);
      if (n.notes) parts.push(`*Notes:* ${n.notes}`);
      if (n.firstSeen) parts.push(`First seen: Session ${n.firstSeen}`);
      if (n.lastSeen) parts.push(`Last seen: Session ${n.lastSeen}`);
      if (n.history?.length) {
        parts.push("**History:**");
        n.history.forEach((h) => parts.push(`- Session ${h.session}: ${h.event}`));
      }
      return parts.join("\n");
    });

    return text(lines.join("\n\n---\n\n"));
  }
);

server.tool(
  "get_npc",
  "Get detailed info about a specific NPC by name",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    name: z.string().describe("The NPC name (case-insensitive)"),
  },
  async ({ chronicle_id, name }) => {
    const npcs = await storage.getNPCs(chronicle_id);
    const npc = npcs.find(
      (n) => n.name.toLowerCase() === name.toLowerCase()
    );
    if (!npc) return err(`NPC "${name}" not found`);

    const lines = [`# ${npc.name}`];
    lines.push(`**Relationship:** ${npc.relationship || "Unknown"}`);
    if (npc.faction) lines.push(`**Faction:** ${npc.faction}`);
    if (npc.description) lines.push(`\n${npc.description}`);
    if (npc.appearance) lines.push(`\n**Appearance:** ${npc.appearance}`);
    if (npc.personality) lines.push(`**Personality:** ${npc.personality}`);
    if (npc.backstory) lines.push(`**Backstory:** ${npc.backstory}`);
    if (npc.motivations) lines.push(`**Motivations:** ${npc.motivations}`);
    if (npc.notes) lines.push(`\n*Notes:* ${npc.notes}`);
    if (npc.firstSeen) lines.push(`\nFirst seen: Session ${npc.firstSeen}`);
    if (npc.lastSeen) lines.push(`Last seen: Session ${npc.lastSeen}`);
    if (npc.history?.length) {
      lines.push("\n**Event History:**");
      npc.history.forEach((h) =>
        lines.push(`- Session ${h.session}: ${h.event}`)
      );
    }
    return text(lines.join("\n"));
  }
);

server.tool(
  "get_sessions",
  "Get session list with summaries, or a specific session's full details",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    session_number: z
      .number()
      .optional()
      .describe("Get a specific session by number (1-indexed)"),
    last_n: z
      .number()
      .optional()
      .describe("Get only the last N sessions"),
  },
  async ({ chronicle_id, session_number, last_n }) => {
    let sessions = await storage.getSessions(chronicle_id);
    if (sessions.length === 0) return text("No sessions recorded yet.");

    if (session_number) {
      const s = sessions.find((s) => s.number === session_number);
      if (!s) return err(`Session ${session_number} not found`);
      const lines = [
        `# Session ${s.number}${s.title ? ` — ${s.title}` : ""}`,
        `**Date:** ${s.date}`,
        `**Mood:** ${s.mood || "—"}`,
        `**Locations:** ${s.locations?.join(", ") || "—"}`,
        "",
        `## Summary`,
        s.summary || "(no summary)",
      ];
      if (s.storyBeats?.length) {
        lines.push("", `## Key Beats`);
        s.storyBeats.forEach((b) => lines.push(`- ${b}`));
      }
      if (s.logText) {
        lines.push("", `## Full Log`, s.logText);
      }
      return text(lines.join("\n"));
    }

    if (last_n) sessions = sessions.slice(-last_n);

    const lines = sessions.map(
      (s) =>
        `**Session ${s.number}${s.title ? ` — ${s.title}` : ""}** (${s.date})\n${s.summary || "(no summary)"}`
    );
    return text(lines.join("\n\n"));
  }
);

server.tool(
  "get_characters",
  "Get player characters in a chronicle",
  { chronicle_id: z.string().describe("The chronicle ID") },
  async ({ chronicle_id }) => {
    const chars = await storage.getCharacters(chronicle_id);
    if (chars.length === 0) return text("No player characters yet.");
    const lines = chars.map((c) => {
      const parts = [`## ${c.name}`];
      if (c.concept) parts.push(`**Concept:** ${c.concept}`);
      if (c.clan) parts.push(`**Clan/Tradition:** ${c.clan}`);
      if (c.nature) parts.push(`**Nature:** ${c.nature}`);
      if (c.demeanor) parts.push(`**Demeanor:** ${c.demeanor}`);
      if (c.backstory) parts.push(`\n${c.backstory}`);
      if (c.notes) parts.push(`\n*Notes:* ${c.notes}`);
      return parts.join("\n");
    });
    return text(lines.join("\n\n---\n\n"));
  }
);

server.tool(
  "get_factions",
  "Get all factions in a chronicle",
  { chronicle_id: z.string().describe("The chronicle ID") },
  async ({ chronicle_id }) => {
    const factions = await storage.getFactions(chronicle_id);
    if (factions.length === 0) return text("No factions tracked yet.");
    const lines = factions.map((f) => {
      const parts = [`## ${f.name} [${f.attitude || "Neutral"}]`];
      if (f.influence) parts.push(`**Influence:** ${f.influence}`);
      if (f.territory) parts.push(`**Territory:** ${f.territory}`);
      if (f.goals) parts.push(`**Goals:** ${f.goals}`);
      if (f.description) parts.push(f.description);
      if (f.members?.length)
        parts.push(`**Members:** ${f.members.join(", ")}`);
      return parts.join("\n");
    });
    return text(lines.join("\n\n"));
  }
);

server.tool(
  "get_locations",
  "Get all locations in a chronicle",
  { chronicle_id: z.string().describe("The chronicle ID") },
  async ({ chronicle_id }) => {
    const locs = await storage.getLocations(chronicle_id);
    if (locs.length === 0) return text("No locations tracked yet.");
    const lines = locs.map((l) => {
      const parts = [`## ${l.name} (${l.type || "other"})`];
      if (l.controlledBy) parts.push(`**Controlled by:** ${l.controlledBy}`);
      if (l.description) parts.push(l.description);
      if (l.atmosphere) parts.push(`**Atmosphere:** ${l.atmosphere}`);
      if (l.secrets) parts.push(`**Secrets:** ${l.secrets}`);
      if (l.notes) parts.push(`*Notes:* ${l.notes}`);
      if (l.sessions?.length)
        parts.push(`**Visited in sessions:** ${l.sessions.join(", ")}`);
      return parts.join("\n");
    });
    return text(lines.join("\n\n"));
  }
);

server.tool(
  "get_plot_threads",
  "Get plot threads, optionally filtered by status (active, cold, resolved)",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    status: z
      .enum(["active", "cold", "resolved", "all"])
      .default("all")
      .describe("Filter by status"),
  },
  async ({ chronicle_id, status }) => {
    let threads = await storage.getPlotThreads(chronicle_id);
    if (status !== "all")
      threads = threads.filter((t) => t.status === status);
    if (threads.length === 0) return text("No plot threads found.");

    const lines = threads.map((t) => {
      const parts = [
        `## ${t.title} [${t.status}] (${t.type || "mystery"})`,
      ];
      if (t.description) parts.push(t.description);
      if (t.clues?.length) {
        parts.push("**Clues:**");
        t.clues.forEach((c) =>
          parts.push(`- Session ${c.session}: ${c.text}`)
        );
      }
      return parts.join("\n");
    });
    return text(lines.join("\n\n"));
  }
);

server.tool(
  "get_clocks",
  "Get all progress clocks in a chronicle",
  { chronicle_id: z.string().describe("The chronicle ID") },
  async ({ chronicle_id }) => {
    const clocks = await storage.getClocks(chronicle_id);
    if (clocks.length === 0) return text("No clocks tracked yet.");
    const lines = clocks.map((c) => {
      const bar = "█".repeat(c.filled) + "░".repeat(c.segments - c.filled);
      const full = c.filled >= c.segments ? " ✦ COMPLETE" : "";
      return `**${c.name}** [${bar}] ${c.filled}/${c.segments} (${c.type})${full}`;
    });
    return text(lines.join("\n"));
  }
);

server.tool(
  "get_timeline",
  "Get the story timeline (story beats grouped by session)",
  { chronicle_id: z.string().describe("The chronicle ID") },
  async ({ chronicle_id }) => {
    const beats = await storage.getTimeline(chronicle_id);
    if (beats.length === 0) return text("No story beats recorded yet.");

    const grouped = {};
    for (const b of beats) {
      const key = b.session || 0;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    }

    const lines = Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(
        ([session, beats]) =>
          `### Session ${session}\n${beats.map((b) => `- ${b.text}`).join("\n")}`
      );
    return text(lines.join("\n\n"));
  }
);

server.tool(
  "get_rumors",
  "Get the rumor board for a chronicle",
  { chronicle_id: z.string().describe("The chronicle ID") },
  async ({ chronicle_id }) => {
    const rumors = await storage.getRumors(chronicle_id);
    if (rumors.length === 0) return text("No rumors on the board.");
    const lines = rumors.map(
      (r) =>
        `- "${r.text}" *(added ${r.addedAt ? new Date(r.addedAt).toLocaleDateString() : "unknown"})*`
    );
    return text("## Rumor Board\n" + lines.join("\n"));
  }
);

server.tool(
  "search_chronicle",
  "Full-text search across all entities in a chronicle (NPCs, sessions, locations, threads, factions, characters)",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    query: z.string().describe("Search query"),
  },
  async ({ chronicle_id, query }) => {
    const { results, count } = await storage.search(chronicle_id, query);
    if (count === 0) return text(`No results found for "${query}".`);
    const lines = results.map(
      (r) => `**[${r.type}] ${r.name}**\n${r.summary}`
    );
    return text(
      `Found ${count} result${count !== 1 ? "s" : ""} for "${query}":\n\n${lines.join("\n\n")}`
    );
  }
);

// ═══════════════════════════════════════════════════════════════
// WRITE TOOLS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "create_chronicle",
  "Create a new empty chronicle",
  {
    name: z.string().describe("Chronicle name"),
    game_type: z
      .enum(["vtm", "mta", "wta", "wto", "htr", "ctd", "mixed"])
      .default("vtm")
      .describe("World of Darkness game type"),
    description: z.string().optional().describe("Chronicle description"),
  },
  async ({ name, game_type, description }) => {
    const meta = await storage.createChronicle(name, game_type, description || "");
    return text(
      `Created chronicle **${meta.name}** (${meta.gameType})\nID: ${meta.id}`
    );
  }
);

server.tool(
  "add_npc",
  "Add a new NPC to a chronicle",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    name: z.string().describe("NPC name"),
    description: z.string().optional().describe("Brief description (who they are)"),
    relationship: z
      .string()
      .optional()
      .describe(
        "Relationship type: Ally, Enemy, Rival, Contact, Mentor, Lover, Patron, Sire, Childe, Coterie, Unknown, etc."
      ),
    faction: z.string().optional().describe("Faction or clan affiliation"),
    personality: z.string().optional().describe("Personality traits"),
    appearance: z.string().optional().describe("Physical description"),
    backstory: z.string().optional().describe("Known backstory"),
    motivations: z.string().optional().describe("Goals and motivations"),
    notes: z.string().optional().describe("Additional notes"),
  },
  async ({
    chronicle_id,
    name,
    description,
    relationship,
    faction,
    personality,
    appearance,
    backstory,
    motivations,
    notes,
  }) => {
    const npc = await storage.addNPC(chronicle_id, {
      name,
      description,
      relationship,
      faction,
      personality,
      appearance,
      backstory,
      motivations,
      notes,
    });
    if (!npc) return err("Chronicle not found");
    return text(`Added NPC **${npc.name}** [${npc.relationship}] to the chronicle.`);
  }
);

server.tool(
  "update_npc",
  "Update an existing NPC's details (only the fields you provide will change)",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    name: z.string().describe("NPC name to update (case-insensitive match)"),
    description: z.string().optional(),
    relationship: z.string().optional(),
    faction: z.string().optional(),
    personality: z.string().optional().describe("Additional personality observations"),
    appearance: z.string().optional().describe("Additional appearance details"),
    backstory: z.string().optional().describe("Additional backstory revelations"),
    motivations: z.string().optional().describe("Newly discovered motivations"),
    notes: z.string().optional(),
    history_event: z
      .string()
      .optional()
      .describe("A new event to add to the NPC's history log"),
  },
  async ({ chronicle_id, name, history_event, ...updates }) => {
    // Build the update — for personality/backstory/appearance/motivations,
    // append rather than replace
    const d = await storage.getData(chronicle_id);
    if (!d) return err("Chronicle not found");
    const existing = d.npcs.find(
      (n) => n.name.toLowerCase() === name.toLowerCase()
    );
    if (!existing) return err(`NPC "${name}" not found`);

    const deepenFields = ["personality", "backstory", "appearance", "motivations"];
    const finalUpdates = {};
    for (const [key, val] of Object.entries(updates)) {
      if (!val) continue;
      if (deepenFields.includes(key) && existing[key]) {
        if (!existing[key].toLowerCase().includes(val.toLowerCase())) {
          finalUpdates[key] = existing[key] + ". " + val;
        }
      } else {
        finalUpdates[key] = val;
      }
    }

    if (history_event) {
      const sessionNum = d.sessions?.length || 0;
      finalUpdates.history = [
        ...(existing.history || []),
        { session: sessionNum, event: history_event },
      ];
      finalUpdates.lastSeen = sessionNum;
    }

    const updated = await storage.updateNPC(chronicle_id, name, finalUpdates);
    if (!updated) return err(`Failed to update NPC "${name}"`);
    return text(`Updated NPC **${updated.name}**.`);
  }
);

server.tool(
  "add_session",
  "Add a new session log to a chronicle (with summary and story beats)",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    title: z.string().optional().describe("Session title"),
    log_text: z.string().describe("The full session log/notes text"),
    summary: z.string().optional().describe("Brief session summary"),
    story_beats: z
      .array(z.string())
      .optional()
      .describe("Key plot points from the session"),
    mood: z.string().optional().describe("Session mood (e.g. tense, triumphant)"),
    locations: z
      .array(z.string())
      .optional()
      .describe("Locations visited this session"),
  },
  async ({
    chronicle_id,
    title,
    log_text,
    summary,
    story_beats,
    mood,
    locations,
  }) => {
    const session = await storage.addSession(chronicle_id, {
      title,
      logText: log_text,
      summary,
      storyBeats: story_beats,
      mood,
      locations,
    });
    if (!session) return err("Chronicle not found");
    return text(
      `Added **Session ${session.number}${session.title ? ` — ${session.title}` : ""}** to the chronicle.`
    );
  }
);

server.tool(
  "add_story_beat",
  "Add a story beat to the chronicle timeline",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    text: z.string().describe("The story beat text"),
    session: z.number().optional().describe("Session number (defaults to current)"),
  },
  async ({ chronicle_id, text: beatText, session }) => {
    const beat = await storage.addStoryBeat(chronicle_id, {
      text: beatText,
      session,
    });
    if (!beat) return err("Chronicle not found");
    return text(`Added story beat to Session ${beat.session}.`);
  }
);

server.tool(
  "add_plot_thread",
  "Add a new plot thread to track mysteries, dangers, or hooks",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    title: z.string().describe("Thread title"),
    description: z.string().optional().describe("What the hook/mystery/danger is"),
    type: z
      .enum(["mystery", "danger", "political", "personal", "quest"])
      .default("mystery")
      .describe("Thread type"),
    initial_clue: z.string().optional().describe("First clue or hook"),
  },
  async ({ chronicle_id, title, description, type, initial_clue }) => {
    const thread = await storage.addThread(chronicle_id, {
      title,
      description,
      type,
      initialClue: initial_clue,
    });
    if (!thread) return err("Chronicle not found");
    return text(`Added plot thread **${thread.title}** [${thread.type}].`);
  }
);

server.tool(
  "update_plot_thread",
  "Update a plot thread — add a clue, change status, or update description",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    title: z
      .string()
      .describe("Thread title to update (case-insensitive match)"),
    new_clue: z.string().optional().describe("A new clue or development"),
    status: z
      .enum(["active", "cold", "resolved"])
      .optional()
      .describe("New thread status"),
    description: z.string().optional().describe("Updated description"),
  },
  async ({ chronicle_id, title, new_clue, status, description }) => {
    const thread = await storage.updateThread(chronicle_id, title, {
      newClue: new_clue,
      status,
      description,
    });
    if (!thread) return err(`Thread "${title}" not found`);
    return text(
      `Updated thread **${thread.title}** [${thread.status}]${new_clue ? " — new clue added" : ""}.`
    );
  }
);

server.tool(
  "advance_clock",
  "Advance (or retreat) a progress clock",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    clock_name: z
      .string()
      .describe("Clock name to advance (case-insensitive match)"),
    amount: z
      .number()
      .default(1)
      .describe("Segments to advance (positive) or retreat (negative)"),
  },
  async ({ chronicle_id, clock_name, amount }) => {
    const clock = await storage.advanceClock(chronicle_id, clock_name, amount);
    if (!clock) return err(`Clock "${clock_name}" not found`);
    const bar = "█".repeat(clock.filled) + "░".repeat(clock.segments - clock.filled);
    const complete = clock.filled >= clock.segments ? " — COMPLETE!" : "";
    return text(
      `**${clock.name}** [${bar}] ${clock.filled}/${clock.segments}${complete}`
    );
  }
);

server.tool(
  "add_clock",
  "Create a new progress clock to track threats, schemes, or countdowns",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    name: z.string().describe("Clock name"),
    segments: z
      .number()
      .min(3)
      .max(12)
      .default(6)
      .describe("Number of segments (3-12)"),
    type: z
      .enum(["threat", "scheme", "countdown", "ritual"])
      .default("threat")
      .describe("Clock type"),
  },
  async ({ chronicle_id, name, segments, type }) => {
    const clock = await storage.addClock(chronicle_id, {
      name,
      segments,
      type,
    });
    if (!clock) return err("Chronicle not found");
    const bar = "░".repeat(clock.segments);
    return text(
      `Created clock **${clock.name}** [${bar}] 0/${clock.segments} (${clock.type})`
    );
  }
);

server.tool(
  "add_rumor",
  "Add a rumor to the chronicle's rumor board",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    rumor_text: z.string().describe("The rumor text"),
  },
  async ({ chronicle_id, rumor_text }) => {
    const rumor = await storage.addRumor(chronicle_id, rumor_text);
    if (!rumor) return err("Chronicle not found");
    return text(`Added rumor to the board.`);
  }
);

server.tool(
  "add_faction",
  "Add a new faction to the chronicle",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    name: z.string().describe("Faction name"),
    description: z.string().optional(),
    attitude: z
      .enum(["Hostile", "Unfriendly", "Wary", "Neutral", "Curious", "Friendly", "Allied"])
      .default("Neutral")
      .describe("Attitude toward the players"),
    influence: z
      .enum(["None", "Minor", "Notable", "Significant", "Dominant"])
      .default("Notable")
      .describe("Faction influence level"),
    goals: z.string().optional(),
    territory: z.string().optional(),
    members: z.array(z.string()).optional().describe("Key member names"),
  },
  async ({ chronicle_id, name, description, attitude, influence, goals, territory, members }) => {
    const faction = await storage.addFaction(chronicle_id, {
      name,
      description,
      attitude,
      influence,
      goals,
      territory,
      members,
    });
    if (!faction) return err("Chronicle not found");
    return text(`Added faction **${faction.name}** [${faction.attitude}].`);
  }
);

server.tool(
  "add_location",
  "Add a new location to the chronicle",
  {
    chronicle_id: z.string().describe("The chronicle ID"),
    name: z.string().describe("Location name"),
    type: z
      .enum([
        "haven",
        "elysium",
        "bar",
        "street",
        "leyNode",
        "church",
        "graveyard",
        "warehouse",
        "mansion",
        "other",
      ])
      .default("other")
      .describe("Location type"),
    description: z.string().optional(),
    atmosphere: z.string().optional().describe("Mood/feel of the place"),
    controlled_by: z.string().optional().describe("Faction or NPC who controls this place"),
    secrets: z.string().optional(),
    notes: z.string().optional(),
  },
  async ({
    chronicle_id,
    name,
    type,
    description,
    atmosphere,
    controlled_by,
    secrets,
    notes,
  }) => {
    const loc = await storage.addLocation(chronicle_id, {
      name,
      type,
      description,
      atmosphere,
      controlledBy: controlled_by,
      secrets,
      notes,
    });
    if (!loc) return err("Chronicle not found");
    return text(`Added location **${loc.name}** (${loc.type}).`);
  }
);

server.tool(
  "import_chronicle_json",
  "Import a chronicle from a WoD Chronicle App JSON export file",
  {
    file_path: z
      .string()
      .describe("Absolute path to the JSON export file"),
  },
  async ({ file_path }) => {
    try {
      const { readFile } = await import("node:fs/promises");
      const raw = await readFile(file_path, "utf-8");
      const data = JSON.parse(raw);
      const result = await storage.importChronicleExport(data);
      if (result.skipped) {
        return text(`Chronicle "${result.name}" already exists — skipped.`);
      }
      return text(
        `Imported chronicle **${result.name}** (${result.gameType})\nID: ${result.id}`
      );
    } catch (e) {
      return err(`Import failed: ${e.message}`);
    }
  }
);

// ─── Helpers ─────────────────────────────────────────────────

function text(t) {
  return { content: [{ type: "text", text: t }] };
}

function err(msg) {
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

// ─── Start ───────────────────────────────────────────────────

async function main() {
  await storage.init();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[vtm-chronicle-mcp] Started. Data dir: ${dataDir}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
