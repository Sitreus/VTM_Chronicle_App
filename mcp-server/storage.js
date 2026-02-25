/**
 * File-based storage for VTM Chronicle MCP server.
 *
 * Data layout:
 *   <dataDir>/
 *     chronicles.json          — array of chronicle metadata
 *     chronicles/<id>.json     — full data for each chronicle
 *
 * The JSON format is identical to the web app's export format
 * (wod-chronicle-v1), so files can be copied between the two.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const EMPTY_CHRONICLE_DATA = {
  sessions: [],
  npcs: [],
  characters: [],
  storyBeats: [],
  plotThreads: [],
  clocks: [],
  factions: [],
  locationDossiers: [],
  rumors: [],
};

export default class ChronicleStorage {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.chroniclesDir = join(dataDir, "chronicles");
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await mkdir(this.chroniclesDir, { recursive: true });

    const indexPath = join(this.dataDir, "chronicles.json");
    if (!existsSync(indexPath)) {
      await this._writeJSON(indexPath, []);
    }

    // Auto-import any wod-chronicle-v1 exports dropped into the data dir
    await this._autoImport();
  }

  // ─── Chronicle list ────────────────────────────────────────

  async listChronicles() {
    return this._readJSON(join(this.dataDir, "chronicles.json"), []);
  }

  async getChronicle(id) {
    const meta = (await this.listChronicles()).find((c) => c.id === id);
    if (!meta) return null;
    const data = await this._readJSON(
      join(this.chroniclesDir, `${id}.json`),
      null
    );
    return data ? { ...meta, data } : null;
  }

  async createChronicle(name, gameType = "vtm", description = "") {
    const id = `chr-${Date.now()}`;
    const meta = {
      id,
      name,
      gameType,
      description,
      createdAt: new Date().toISOString(),
    };
    const list = await this.listChronicles();
    list.push(meta);
    await this._writeJSON(join(this.dataDir, "chronicles.json"), list);
    await this._writeJSON(
      join(this.chroniclesDir, `${id}.json`),
      { ...EMPTY_CHRONICLE_DATA }
    );
    return meta;
  }

  async deleteChronicle(id) {
    const list = (await this.listChronicles()).filter((c) => c.id !== id);
    await this._writeJSON(join(this.dataDir, "chronicles.json"), list);
    const filePath = join(this.chroniclesDir, `${id}.json`);
    if (existsSync(filePath)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(filePath);
    }
  }

  // ─── Chronicle data read helpers ───────────────────────────

  async getData(chronicleId) {
    return this._readJSON(
      join(this.chroniclesDir, `${chronicleId}.json`),
      null
    );
  }

  async saveData(chronicleId, data) {
    await this._writeJSON(join(this.chroniclesDir, `${chronicleId}.json`), data);
  }

  // ─── Entity helpers ────────────────────────────────────────

  async getNPCs(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.npcs || [];
  }

  async getSessions(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.sessions || [];
  }

  async getCharacters(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.characters || [];
  }

  async getFactions(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.factions || [];
  }

  async getLocations(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.locationDossiers || [];
  }

  async getPlotThreads(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.plotThreads || [];
  }

  async getClocks(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.clocks || [];
  }

  async getTimeline(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.storyBeats || [];
  }

  async getRumors(chronicleId) {
    const d = await this.getData(chronicleId);
    return d?.rumors || [];
  }

  // ─── Entity write helpers ──────────────────────────────────

  async addNPC(chronicleId, npc) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const newNPC = {
      id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: npc.name,
      description: npc.description || "",
      relationship: npc.relationship || "Unknown",
      faction: npc.faction || "",
      notes: npc.notes || "",
      avatar: null,
      personality: npc.personality || "",
      backstory: npc.backstory || "",
      appearance: npc.appearance || "",
      motivations: npc.motivations || "",
      firstSeen: npc.firstSeen || null,
      lastSeen: npc.lastSeen || null,
      history: npc.history || [],
      ...npc,
      id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    d.npcs = [...(d.npcs || []), newNPC];
    await this.saveData(chronicleId, d);
    return newNPC;
  }

  async updateNPC(chronicleId, npcNameOrId, updates) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const idx = d.npcs.findIndex(
      (n) =>
        n.id === npcNameOrId ||
        n.name.toLowerCase() === npcNameOrId.toLowerCase()
    );
    if (idx < 0) return null;
    d.npcs[idx] = { ...d.npcs[idx], ...updates };
    await this.saveData(chronicleId, d);
    return d.npcs[idx];
  }

  async addSession(chronicleId, session) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const sessionNum = (d.sessions?.length || 0) + 1;
    const newSession = {
      id: `ses-${Date.now()}`,
      number: sessionNum,
      title: session.title || "",
      date:
        session.date ||
        new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      logText: session.logText || "",
      summary: session.summary || "",
      storyBeats: session.storyBeats || [],
      mood: session.mood || "",
      locations: session.locations || [],
    };
    d.sessions = [...(d.sessions || []), newSession];

    // Add story beats to timeline
    if (session.storyBeats?.length) {
      const newBeats = session.storyBeats.map((b) => ({
        id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        session: sessionNum,
        text: typeof b === "string" ? b : b.text,
        date: newSession.date,
      }));
      d.storyBeats = [...(d.storyBeats || []), ...newBeats];
    }

    await this.saveData(chronicleId, d);
    return newSession;
  }

  async addStoryBeat(chronicleId, beat) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const newBeat = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      session: beat.session || (d.sessions?.length || 0),
      text: beat.text,
      date:
        beat.date ||
        new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    };
    d.storyBeats = [...(d.storyBeats || []), newBeat];
    await this.saveData(chronicleId, d);
    return newBeat;
  }

  async updateThread(chronicleId, threadTitleOrId, updates) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const idx = (d.plotThreads || []).findIndex(
      (t) =>
        t.id === threadTitleOrId ||
        t.title.toLowerCase() === threadTitleOrId.toLowerCase()
    );
    if (idx < 0) return null;
    if (updates.newClue) {
      const sessionNum = d.sessions?.length || 0;
      d.plotThreads[idx].clues = [
        ...(d.plotThreads[idx].clues || []),
        { session: sessionNum, text: updates.newClue },
      ];
    }
    if (updates.status) d.plotThreads[idx].status = updates.status;
    if (updates.description)
      d.plotThreads[idx].description = updates.description;
    await this.saveData(chronicleId, d);
    return d.plotThreads[idx];
  }

  async addThread(chronicleId, thread) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const sessionNum = d.sessions?.length || 0;
    const newThread = {
      id: `thr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: thread.title,
      description: thread.description || "",
      type: thread.type || "mystery",
      status: "active",
      session: sessionNum,
      clues: thread.initialClue
        ? [{ session: sessionNum, text: thread.initialClue }]
        : [],
    };
    d.plotThreads = [...(d.plotThreads || []), newThread];
    await this.saveData(chronicleId, d);
    return newThread;
  }

  async advanceClock(chronicleId, clockNameOrId, amount = 1) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const idx = (d.clocks || []).findIndex(
      (c) =>
        c.id === clockNameOrId ||
        c.name.toLowerCase() === clockNameOrId.toLowerCase()
    );
    if (idx < 0) return null;
    const clock = d.clocks[idx];
    clock.filled = Math.max(
      0,
      Math.min(clock.filled + amount, clock.segments)
    );
    await this.saveData(chronicleId, d);
    return clock;
  }

  async addClock(chronicleId, clock) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const newClock = {
      id: `clk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: clock.name,
      segments: Math.min(Math.max(clock.segments || 6, 3), 12),
      filled: clock.filled || 0,
      type: clock.type || "threat",
    };
    d.clocks = [...(d.clocks || []), newClock];
    await this.saveData(chronicleId, d);
    return newClock;
  }

  async addRumor(chronicleId, text) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const rumor = {
      id: `rum-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      addedAt: new Date().toISOString(),
    };
    d.rumors = [...(d.rumors || []), rumor];
    await this.saveData(chronicleId, d);
    return rumor;
  }

  async addFaction(chronicleId, faction) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const newFaction = {
      id: `fac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: faction.name,
      description: faction.description || "",
      attitude: faction.attitude || "Neutral",
      influence: faction.influence || "Notable",
      goals: faction.goals || "",
      territory: faction.territory || "",
      members: faction.members || [],
    };
    d.factions = [...(d.factions || []), newFaction];
    await this.saveData(chronicleId, d);
    return newFaction;
  }

  async addLocation(chronicleId, location) {
    const d = await this.getData(chronicleId);
    if (!d) return null;
    const newLoc = {
      id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: location.name,
      type: location.type || "other",
      description: location.description || "",
      atmosphere: location.atmosphere || "",
      controlledBy: location.controlledBy || "",
      secrets: location.secrets || "",
      notes: location.notes || "",
      sessions: location.sessions || [],
    };
    d.locationDossiers = [...(d.locationDossiers || []), newLoc];
    await this.saveData(chronicleId, d);
    return newLoc;
  }

  // ─── Search ────────────────────────────────────────────────

  async search(chronicleId, query) {
    const d = await this.getData(chronicleId);
    if (!d) return { results: [] };
    const q = query.toLowerCase();
    const results = [];

    const match = (text) => text && text.toLowerCase().includes(q);

    for (const npc of d.npcs || []) {
      if (
        match(npc.name) ||
        match(npc.description) ||
        match(npc.faction) ||
        match(npc.personality) ||
        match(npc.backstory) ||
        match(npc.notes)
      ) {
        results.push({
          type: "npc",
          name: npc.name,
          summary: `${npc.relationship} — ${npc.description || ""}`.trim(),
          id: npc.id,
        });
      }
    }

    for (const ch of d.characters || []) {
      if (
        match(ch.name) ||
        match(ch.concept) ||
        match(ch.backstory) ||
        match(ch.notes)
      ) {
        results.push({
          type: "character",
          name: ch.name,
          summary: ch.concept || "",
          id: ch.id,
        });
      }
    }

    for (const s of d.sessions || []) {
      if (match(s.title) || match(s.summary) || match(s.logText)) {
        results.push({
          type: "session",
          name: `Session ${s.number}${s.title ? ` — ${s.title}` : ""}`,
          summary: s.summary || "",
          id: s.id,
        });
      }
    }

    for (const f of d.factions || []) {
      if (
        match(f.name) ||
        match(f.description) ||
        match(f.goals) ||
        match(f.territory)
      ) {
        results.push({
          type: "faction",
          name: f.name,
          summary: `${f.attitude} — ${f.description || ""}`.trim(),
          id: f.id,
        });
      }
    }

    for (const l of d.locationDossiers || []) {
      if (
        match(l.name) ||
        match(l.description) ||
        match(l.atmosphere) ||
        match(l.secrets)
      ) {
        results.push({
          type: "location",
          name: l.name,
          summary: l.description || "",
          id: l.id,
        });
      }
    }

    for (const t of d.plotThreads || []) {
      if (match(t.title) || match(t.description)) {
        results.push({
          type: "thread",
          name: t.title,
          summary: `[${t.status}] ${t.description || ""}`.trim(),
          id: t.id,
        });
      }
    }

    return { results, count: results.length };
  }

  // ─── Import: accept wod-chronicle-v1 exports ──────────────

  async importChronicleExport(exportData) {
    if (exportData._format !== "wod-chronicle-v1" || !exportData.chronicle || !exportData.data) {
      throw new Error("Invalid format — expected wod-chronicle-v1 export");
    }
    const id = `chr-${Date.now()}`;
    const meta = {
      ...exportData.chronicle,
      id,
      createdAt: exportData.chronicle.createdAt || new Date().toISOString(),
    };
    const list = await this.listChronicles();
    // Don't import if a chronicle with the same name already exists
    if (list.some((c) => c.name === meta.name)) {
      return { skipped: true, name: meta.name };
    }
    list.push(meta);
    await this._writeJSON(join(this.dataDir, "chronicles.json"), list);
    await this._writeJSON(join(this.chroniclesDir, `${id}.json`), exportData.data);
    return meta;
  }

  // ─── Internal ──────────────────────────────────────────────

  async _autoImport() {
    // Look for any *.json files in the data dir that look like exports
    try {
      const files = await readdir(this.dataDir);
      for (const file of files) {
        if (file === "chronicles.json" || !file.endsWith(".json")) continue;
        const filePath = join(this.dataDir, file);
        try {
          const raw = await readFile(filePath, "utf-8");
          const data = JSON.parse(raw);
          if (data._format === "wod-chronicle-v1") {
            const result = await this.importChronicleExport(data);
            if (result.skipped) {
              // Already imported
            } else {
              console.error(`[storage] Auto-imported chronicle: ${result.name}`);
            }
          }
        } catch {
          // Not a valid export file, skip
        }
      }
    } catch {
      // readdir failed, skip
    }
  }

  async _readJSON(filePath, fallback) {
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async _writeJSON(filePath, data) {
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
