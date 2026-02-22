import { useState, useEffect, useCallback, useRef } from "react";
import { FONTS_URL, GAME_TYPES, RELATIONSHIP_TYPES, TABS, THREAD_STATUSES, ATTITUDE_LEVELS, INFLUENCE_LEVELS } from "./constants.js";
import { GAME_SPLASH_DATA, GAME_BACKGROUNDS, DEFAULT_BG } from "./splashImages.js";
import { S } from "./styles.js";
import { storageGet, storageSet } from "./utils/storage.js";
import { callClaude, repairJSON, parseCharacterMarkdown, stripMarkdown } from "./utils/claude.js";
import Modal from "./components/Modal.jsx";
import EmptyState from "./components/EmptyState.jsx";
import ProgressClock from "./components/ProgressClock.jsx";
import NPCCard from "./components/NPCCard.jsx";
import SessionCard from "./components/SessionCard.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import AudioControl from "./components/AudioControl.jsx";
import useAudio from "./audio/useAudio.js";

export default function WorldOfDarkness() {
  const [chronicles, setChronicles] = useState([]);
  const [activeChronicleId, setActiveChronicleId] = useState(null);
  const [chronicleData, setChronicleData] = useState(null); // {sessions, npcs, characters, storyBeats}
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [showModal, setShowModal] = useState(null); // 'newChronicle' | 'newSession' | 'editNPC' | 'viewLog' | 'newCharacter' | 'editCharacter'
  const [modalData, setModalData] = useState({});
  const [searchFilter, setSearchFilter] = useState("");
  const [npcRelFilter, setNpcRelFilter] = useState("");
  const [npcFactionFilter, setNpcFactionFilter] = useState("");
  const [parseStatus, setParseStatus] = useState(null);
  const [recapText, setRecapText] = useState(null);
  const [npcViewMode, setNpcViewMode] = useState("cards"); // "cards" | "web"
  const [confirmAction, setConfirmAction] = useState(null); // {msg, onConfirm}
  const [showSplash, setShowSplash] = useState(true);
  const [splashPhase, setSplashPhase] = useState("welcome"); // "welcome" | "fading" | "select"
  const [activeGameType, setActiveGameType] = useState(null); // Selected game line (e.g. "vtm", "mta")
  const [selectedSplashCard, setSelectedSplashCard] = useState(null); // Card selected before transition
  const [splashTransition, setSplashTransition] = useState(null); // Active transition effect (e.g. "vtm")
  const [modalEntrance, setModalEntrance] = useState(false); // Smooth entrance animation for post-splash modal
  const [apiKey, setApiKey] = useState(""); // Anthropic API key
  const [proxyUrl, setProxyUrl] = useState(""); // Optional CORS proxy URL
  const fileInputRef = useRef(null);
  const sessionFileRef = useRef(null);
  const characterFileRef = useRef(null);
  const activeChronicleIdRef = useRef(activeChronicleId);
  activeChronicleIdRef.current = activeChronicleId;
  const chronicleDataRef = useRef(chronicleData);
  chronicleDataRef.current = chronicleData;

  // Audio engine
  const audio = useAudio();

  // Flush current chronicle data to storage before switching away
  const saveBeforeSwitch = async () => {
    const curId = activeChronicleIdRef.current;
    const curData = chronicleDataRef.current;
    if (curId && curData) {
      await storageSet(`wod-chr-${curId}`, curData);
    }
  };

  const activeChronicle = chronicles.find(c => c.id === activeChronicleId);
  const gameType = activeChronicle ? GAME_TYPES.find(g => g.id === activeChronicle.gameType) : null;
  const accent = gameType?.accent || "#c41e3a";
  const gameBg = activeGameType ? GAME_BACKGROUNDS[activeGameType] : (gameType ? GAME_BACKGROUNDS[gameType.id] : null);
  const bgImage = gameBg || DEFAULT_BG;

  // Load chronicles list and background
  useEffect(() => {
    (async () => {
      const data = await storageGet("wod-chronicles");
      if (data?.chronicles) {
        // Migrate old "htv" (Hunter: The Vigil) to "htr" (Hunter: The Reckoning)
        let migrated = false;
        const updated = data.chronicles.map(c => {
          if (c.gameType === "htv") { migrated = true; return { ...c, gameType: "htr" }; }
          return c;
        });
        if (migrated) await storageSet("wod-chronicles", { ...data, chronicles: updated });
        setChronicles(updated);
      }
      // Restore last active game type
      const savedGameType = await storageGet("wod-active-game-type");
      if (savedGameType) setActiveGameType(savedGameType);
      const savedKey = await storageGet("wod-api-key");
      if (savedKey) setApiKey(savedKey);
      const savedProxy = await storageGet("wod-proxy-url");
      if (savedProxy) setProxyUrl(savedProxy);
      setLoading(false);
    })();
  }, []);

  // Audio: track splash state when card selection screen appears.
  // Intro music now starts from onEnterDarkness (welcome screen button click).
  // This just ensures the splash-active flag is set for state tracking.
  useEffect(() => {
    if (showSplash && splashPhase === "select") {
      audio.onSplashEnter();
    }
  }, [showSplash, splashPhase, audio.isReady]);

  // When game type changes, select first matching chronicle
  useEffect(() => {
    if (!activeGameType || chronicles.length === 0) return;
    const matching = chronicles.filter(c => c.gameType === activeGameType);
    if (matching.length > 0) {
      if (!activeChronicleId || !matching.find(c => c.id === activeChronicleId)) {
        saveBeforeSwitch();
        setActiveChronicleId(matching[0].id);
      }
    } else {
      setActiveChronicleId(null);
    }
  }, [activeGameType, chronicles.length]);

  // Load chronicle data when selection changes
  useEffect(() => {
    if (!activeChronicleId) { setChronicleData(null); return; }
    let cancelled = false;
    (async () => {
      const data = await storageGet(`wod-chr-${activeChronicleId}`);
      if (!cancelled) {
        setChronicleData(data || { sessions: [], npcs: [], characters: [], storyBeats: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [activeChronicleId]);

  // Save helpers
  const saveChronicles = async (newList) => {
    setChronicles(newList);
    await storageSet("wod-chronicles", { chronicles: newList });
  };
  const saveChronicleData = async (newData) => {
    const chrId = activeChronicleIdRef.current;
    if (!chrId) return;
    setChronicleData(newData);
    await storageSet(`wod-chr-${chrId}`, newData);
  };

  // ─── Chronicle CRUD ─────
  const createChronicle = async () => {
    const { name, gameType: gt, description } = modalData;
    if (!name?.trim()) return;
    const id = `chr-${Date.now()}`;
    const newChr = { id, name: name.trim(), gameType: gt || "vtm", description: description || "", createdAt: new Date().toISOString() };
    await storageSet(`wod-chr-${id}`, { sessions: [], npcs: [], characters: [], storyBeats: [] });
    const newList = [...chronicles, newChr];
    await saveChronicles(newList);
    await saveBeforeSwitch();
    setActiveChronicleId(id);
    setShowModal(null);
    setModalData({});
  };

  const deleteChronicle = async () => {
    if (!activeChronicleId || !activeChronicle) return;
    const idToDelete = activeChronicleId;
    const nameToDelete = activeChronicle.name;
    setConfirmAction({
      msg: `Delete chronicle "${nameToDelete}" and ALL its sessions, NPCs, characters, and story beats? This cannot be undone.`,
      onConfirm: async () => {
        try { await window.storage.delete(`wod-chr-${idToDelete}`); } catch {}
        const newList = chronicles.filter(c => c.id !== idToDelete);
        await saveChronicles(newList);
        // Select next chronicle matching the same game type, not just any chronicle
        const sameType = activeGameType ? newList.filter(c => c.gameType === activeGameType) : newList;
        setActiveChronicleId(sameType.length > 0 ? sameType[0].id : null);
        setConfirmAction(null);
      }
    });
  };

  const deleteSession = async (sessionId) => {
    if (!chronicleData) return;
    const session = chronicleData.sessions?.find(s => s.id === sessionId);
    if (!session) return;
    const deletedNum = session.number;
    setConfirmAction({
      msg: `Delete Session ${session.number}${session.title ? ` — ${session.title}` : ""}? This will not remove NPCs created from this session.`,
      onConfirm: async () => {
        const currentData = chronicleDataRef.current;
        if (!currentData) return;
        const newSessions = currentData.sessions.filter(s => s.id !== sessionId);
        const renumbered = newSessions.map((s, i) => ({ ...s, number: i + 1 }));
        // Remove beats from deleted session and adjust session numbers for remaining
        const newBeats = (currentData.storyBeats || [])
          .filter(b => b.session !== deletedNum)
          .map(b => b.session > deletedNum ? { ...b, session: b.session - 1 } : b);
        // Adjust thread and clue session references
        const newThreads = (currentData.plotThreads || []).map(t => ({
          ...t,
          session: t.session > deletedNum ? t.session - 1 : (t.session === deletedNum ? null : t.session),
          clues: (t.clues || []).map(c => ({
            ...c, session: c.session > deletedNum ? c.session - 1 : c.session,
          })),
        }));
        // Adjust clock references
        const newClocks = (currentData.clocks || []).map(c => ({ ...c }));
        await saveChronicleData({ ...currentData, sessions: renumbered, storyBeats: newBeats, plotThreads: newThreads, clocks: newClocks });
        setConfirmAction(null);
        if (showModal === "viewLog") { setShowModal(null); setModalData({}); }
      }
    });
  };

  // ─── Session Management ─────
  const addSession = async () => {
    const { title, logText } = modalData;
    if (!logText?.trim() || !chronicleData) return;
    if (!apiKey) { setParseStatus({ type: "error", msg: "API key required. Open Settings (⚙) to add your Anthropic API key." }); return; }
    setParsing(true);
    setParseStatus(null);

    const sessionNum = (chronicleData.sessions?.length || 0) + 1;
    const cleanLogText = stripMarkdown(logText.trim());
    const newSession = {
      id: `ses-${Date.now()}`, number: sessionNum, title: title || "",
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      logText: cleanLogText, summary: "", storyBeats: [], mood: "", locations: [],
    };

    // Parse with Claude — send ORIGINAL markdown (more context for AI), store stripped version
    let parsed = null;
    let parseError = null;
    try {
      const npcProfiles = (chronicleData.npcs || []).map(n => 
        `${n.name} [${n.relationship}]${n.faction ? ` (${n.faction})` : ""}${n.personality ? ` — Personality: ${n.personality}` : ""}${n.backstory ? ` — Known backstory: ${n.backstory.slice(0, 100)}` : ""}`
      ).join("\n") || "none yet";
      const charNames = (chronicleData.characters || []).map(c => c.name).join(", ");
      const existingThreads = (chronicleData.plotThreads || []).filter(t => t.status !== "resolved").map(t =>
        `"${t.title}" [${t.status}]${t.description ? `: ${t.description.slice(0, 80)}` : ""}`
      ).join("\n") || "none yet";
      const existingClocks = (chronicleData.clocks || []).map(c =>
        `"${c.name}" [${c.filled}/${c.segments} — ${c.type}]`
      ).join(", ") || "none";
      const text = await callClaude(apiKey, [{
            role: "user",
            content: `You are a World of Darkness chronicle keeper. Parse this session log from a ${activeChronicle?.gameType || "vtm"} chronicle called "${activeChronicle?.name || ""}".

Existing NPCs already tracked:
${npcProfiles}

Player Characters: ${charNames || "none yet"}

Active plot threads:
${existingThreads}

Active clocks: ${existingClocks}

SESSION LOG:
${logText}

You MUST respond ONLY with a valid JSON object. No markdown, no backticks, no preamble, no explanation. Just the JSON:
{
  "summary": "2-3 sentence session summary, plain text",
  "storyBeats": ["key plot point 1", "key plot point 2"],
  "newNPCs": [{"name": "NPC Name", "description": "who they are, max 20 words", "relationship": "Ally", "faction": "group", "personality": "personality traits observed, max 25 words", "backstory": "any backstory elements revealed, max 40 words", "appearance": "physical description if mentioned, max 20 words", "motivations": "goals or desires hinted at, max 20 words", "notes": "other details, max 15 words"}],
  "updatedNPCs": [{"name": "existing NPC name", "update": "what changed this session, max 20 words", "newPersonality": "NEW personality traits revealed (not already known), max 25 words", "newBackstory": "NEW backstory elements revealed, max 40 words", "newAppearance": "NEW appearance details, max 20 words", "newMotivations": "NEW goals/desires revealed, max 20 words", "relationshipChange": "new relationship type if changed, or empty"}],
  "characterUpdates": [{"name": "PC name", "backstoryAddition": "new info", "statusUpdate": "status change"}],
  "newThreads": [{"title": "short thread name", "description": "what the hook/mystery/danger is, max 30 words", "type": "mystery|danger|political|personal|quest"}],
  "threadUpdates": [{"title": "exact existing thread title", "clue": "new development this session, max 20 words", "resolved": false}],
  "clockUpdates": [{"name": "exact existing clock name", "advance": 1, "reason": "why it ticked, max 15 words"}],
  "suggestedClocks": [{"name": "clock name", "segments": 6, "type": "threat|scheme|countdown|ritual", "reason": "why this deserves tracking, max 15 words"}],
  "locationDetails": [{"name": "Location Name", "type": "haven|elysium|bar|street|leyNode|other", "description": "what this place is, max 20 words", "atmosphere": "mood/feel, max 15 words", "controlledBy": "faction or NPC or empty"}],
  "factionMentions": [{"name": "Faction Name", "description": "what they are, max 20 words", "attitude": "Hostile|Unfriendly|Wary|Neutral|Curious|Friendly|Allied", "goals": "what they want, max 20 words", "territory": "where they operate, max 15 words"}],
  "locations": ["location1"],
  "mood": "tense"
}

CRITICAL RULES:
- For newNPCs: Build a RICH profile. Infer personality from dialogue and actions. Note appearance details. Identify motivations from context.
- For updatedNPCs: Only include fields where genuinely NEW information was revealed. Leave fields empty "" if nothing new.
- For "relationship" use ONLY one of: Ally, Enemy, Rival, Contact, Mentor, Lover, Patron, Sire, Childe, Coterie, Cabal, Pack, Unknown, Neutral, Suspicious, Feared, Respected, Manipulated, Debt Owed, Owes Debt
- newNPCs: ANY named character NOT in the existing NPCs list. Be thorough.
- updatedNPCs: ONLY characters already in the existing NPCs list.
- newThreads: Unresolved hooks, mysteries, unanswered questions, looming dangers introduced THIS session that aren't already tracked.
- threadUpdates: Developments on EXISTING threads. Set resolved=true if the thread was conclusively resolved.
- suggestedClocks: Suggest progress clocks for ongoing threats or schemes. 4-8 segments. Only suggest if something would genuinely benefit from tracking.
- locationDetails: Named locations that appear in the session. Build atmosphere and ownership details. Only significant locations, not every street corner.
- factionMentions: Factions, clans, organizations mentioned. Include their attitude toward the player characters if discernible.
- Do NOT put player characters in newNPCs.
- If no items for an array, use [].`
          }], { proxyUrl });
      parsed = repairJSON(text);
      if (!parsed) parseError = "Could not parse AI response";
    } catch (e) {
      parseError = e.message || "Unknown error";
    }

    if (parsed) {
      newSession.summary = parsed.summary || "";
      newSession.storyBeats = parsed.storyBeats || [];
      newSession.mood = parsed.mood || "";
      newSession.locations = parsed.locations || [];

      // Add new NPCs with rich profiles
      const newNPCs = (parsed.newNPCs || []).map(n => ({
        id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: n.name, description: n.description || "", relationship: n.relationship || "Unknown",
        faction: n.faction || "", notes: n.notes || "", avatar: null,
        personality: n.personality || "", backstory: n.backstory || "",
        appearance: n.appearance || "", motivations: n.motivations || "",
        firstSeen: sessionNum, lastSeen: sessionNum,
        history: [{ session: sessionNum, event: `First encountered. ${n.notes || ""}` }],
      }));

      // Update existing NPCs — deepen profiles with new info
      const updatedNpcs = [...(chronicleData.npcs || [])];
      (parsed.updatedNPCs || []).forEach(upd => {
        const idx = updatedNpcs.findIndex(n => n.name.toLowerCase() === upd.name.toLowerCase());
        if (idx >= 0) {
          const existing = updatedNpcs[idx];
          // Helper: append new info to existing field, avoiding duplicates
          const deepen = (existing, addition, sep = ". ") => {
            if (!addition) return existing || "";
            if (!existing) return addition;
            // Don't append if the new text is already contained
            if (existing.toLowerCase().includes(addition.toLowerCase())) return existing;
            return existing + sep + addition;
          };
          updatedNpcs[idx] = {
            ...existing, lastSeen: sessionNum,
            personality: deepen(existing.personality, upd.newPersonality),
            backstory: deepen(existing.backstory, upd.newBackstory),
            appearance: deepen(existing.appearance, upd.newAppearance),
            motivations: deepen(existing.motivations, upd.newMotivations),
            relationship: upd.relationshipChange || existing.relationship,
            history: [...(existing.history || []), { session: sessionNum, event: upd.update }],
          };
        }
      });

      // Update existing characters from session
      const updatedChars = [...(chronicleData.characters || [])];
      (parsed.characterUpdates || []).forEach(upd => {
        const idx = updatedChars.findIndex(c => c.name.toLowerCase() === upd.name.toLowerCase());
        if (idx >= 0) {
          const ch = updatedChars[idx];
          const newBackstory = upd.backstoryAddition
            ? (ch.backstory ? ch.backstory + "\n\n[Session " + sessionNum + "] " + upd.backstoryAddition : upd.backstoryAddition)
            : ch.backstory;
          const newNotes = upd.statusUpdate
            ? (ch.notes ? ch.notes + "\n[Session " + sessionNum + "] " + upd.statusUpdate : "[Session " + sessionNum + "] " + upd.statusUpdate)
            : ch.notes;
          updatedChars[idx] = {
            ...ch, backstory: newBackstory, notes: newNotes,
            updatedAt: new Date().toISOString(),
          };
        }
      });

      // Merge story beats into timeline
      const newBeats = (parsed.storyBeats || []).map(b => ({
        id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        session: sessionNum, text: b, date: newSession.date,
      }));

      // Process plot threads
      const updatedThreads = [...(chronicleData.plotThreads || [])];
      (parsed.newThreads || []).forEach(t => {
        updatedThreads.push({
          id: `thr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: t.title, description: t.description || "", type: t.type || "mystery",
          status: "active", session: sessionNum,
          clues: [{ session: sessionNum, text: t.description || "Introduced" }],
        });
      });
      (parsed.threadUpdates || []).forEach(upd => {
        const idx = updatedThreads.findIndex(t => t.title.toLowerCase() === upd.title.toLowerCase());
        if (idx >= 0) {
          updatedThreads[idx] = {
            ...updatedThreads[idx],
            ...(upd.clue ? { clues: [...(updatedThreads[idx].clues || []), { session: sessionNum, text: upd.clue }] } : {}),
            ...(upd.resolved ? { status: "resolved" } : {}),
          };
        }
      });

      // Process clocks
      const updatedClocks = [...(chronicleData.clocks || [])];
      (parsed.clockUpdates || []).forEach(upd => {
        const idx = updatedClocks.findIndex(c => c.name.toLowerCase() === upd.name.toLowerCase());
        if (idx >= 0) {
          updatedClocks[idx] = { ...updatedClocks[idx], filled: Math.min(updatedClocks[idx].filled + (upd.advance || 1), updatedClocks[idx].segments) };
        }
      });
      const suggestedClocks = (parsed.suggestedClocks || []).map(c => ({
        id: `clk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: c.name, segments: Math.min(Math.max(c.segments || 6, 3), 12), filled: 0,
        type: c.type || "threat",
      }));

      // Process factions — merge or create
      const updatedFactions = [...(chronicleData.factions || [])];
      (parsed.factionMentions || []).forEach(fm => {
        const idx = updatedFactions.findIndex(f => f.name.toLowerCase() === fm.name.toLowerCase());
        if (idx >= 0) {
          // Update existing faction
          const ex = updatedFactions[idx];
          updatedFactions[idx] = {
            ...ex,
            ...(fm.attitude && fm.attitude !== ex.attitude ? { attitude: fm.attitude } : {}),
            ...(fm.goals && !ex.goals ? { goals: fm.goals } : {}),
          };
        } else {
          // New faction
          updatedFactions.push({
            id: `fac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: fm.name, description: fm.description || "", attitude: fm.attitude || "Neutral",
            goals: fm.goals || "", territory: fm.territory || "", influence: "Notable", members: [],
          });
        }
      });

      // Process location dossiers — merge or create
      const updatedLocs = [...(chronicleData.locationDossiers || [])];
      (parsed.locationDetails || []).forEach(ld => {
        const idx = updatedLocs.findIndex(l => l.name.toLowerCase() === ld.name.toLowerCase());
        if (idx >= 0) {
          const ex = updatedLocs[idx];
          updatedLocs[idx] = {
            ...ex,
            ...(ld.atmosphere && !ex.atmosphere ? { atmosphere: ld.atmosphere } : {}),
            ...(ld.controlledBy && !ex.controlledBy ? { controlledBy: ld.controlledBy } : {}),
            sessions: [...new Set([...(ex.sessions || []), sessionNum])],
          };
        } else {
          updatedLocs.push({
            id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: ld.name, type: ld.type || "other", description: ld.description || "",
            atmosphere: ld.atmosphere || "", controlledBy: ld.controlledBy || "",
            secrets: "", notes: "", sessions: [sessionNum],
          });
        }
      });

      const newData = {
        ...chronicleData,
        sessions: [...(chronicleData.sessions || []), newSession],
        npcs: [...updatedNpcs, ...newNPCs],
        characters: updatedChars,
        storyBeats: [...(chronicleData.storyBeats || []), ...newBeats],
        plotThreads: updatedThreads,
        clocks: [...updatedClocks, ...suggestedClocks],
        factions: updatedFactions,
        locationDossiers: updatedLocs,
      };
      await saveChronicleData(newData);

      const npcCount = newNPCs.length;
      const updCount = (parsed.updatedNPCs || []).length;
      const beatCount = (parsed.storyBeats || []).length;
      const threadCount = (parsed.newThreads || []).length;
      setParseStatus({ type: "success", msg: `Session ${sessionNum} saved — ${npcCount} new NPC${npcCount !== 1 ? "s" : ""}, ${updCount} updated, ${beatCount} beat${beatCount !== 1 ? "s" : ""}${threadCount ? `, ${threadCount} new thread${threadCount !== 1 ? "s" : ""}` : ""}` });
    } else {
      // Fallback: save session without parsing
      const newData = {
        ...chronicleData,
        sessions: [...(chronicleData.sessions || []), newSession],
      };
      await saveChronicleData(newData);
      setParseStatus({ type: "error", msg: `Session saved but parsing failed: ${parseError || "could not parse AI response"}. NPCs need manual entry.` });
    }

    setParsing(false);
    setShowModal(null);
    setModalData({});
  };

  // ─── NPC Management ─────
  const saveNPC = async () => {
    const npc = modalData;
    if (!npc?.name?.trim() || !chronicleData) return;
    const existing = (chronicleData.npcs || []).findIndex(n => n.id === npc.id);
    let newNpcs;
    if (existing >= 0) {
      newNpcs = [...chronicleData.npcs];
      newNpcs[existing] = { ...newNpcs[existing], ...npc };
    } else {
      newNpcs = [...(chronicleData.npcs || []), {
        ...npc, id: `npc-${Date.now()}`, firstSeen: null, lastSeen: null, history: [],
      }];
    }
    await saveChronicleData({ ...chronicleData, npcs: newNpcs });
    setShowModal(null);
    setModalData({});
  };

  const deleteNPC = async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, npcs: (chronicleData.npcs || []).filter(n => n.id !== id) });
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setModalData(d => ({ ...d, avatar: reader.result }));
    reader.readAsDataURL(file);
  };



  // ─── "Previously on..." Recap ─────
  const generateRecap = async () => {
    if (!chronicleData?.sessions?.length) return;
    if (!apiKey) { setParseStatus({ type: "error", msg: "API key required. Open Settings (⚙) to add your Anthropic API key." }); return; }
    setParsing(true);
    setRecapText(null);
    try {
      const lastSessions = chronicleData.sessions.slice(-3);
      const summaries = lastSessions.map(s => `Session ${s.number}${s.title ? ` — ${s.title}` : ""}: ${s.summary || s.logText?.slice(0, 300) || "no summary"}`).join("\n\n");
      const threads = (chronicleData.plotThreads || []).filter(t => t.status === "active").map(t => t.title).join(", ");
      const text = await callClaude(apiKey, [{ role: "user", content: `You are a dramatic narrator for a ${activeChronicle?.gameType || "vtm"} World of Darkness chronicle called "${activeChronicle?.name || ""}".

Write a "Previously on..." TV-style recap based on these recent sessions. Make it atmospheric, ominous, and dramatic — like the intro to a gothic TV show. Use present tense. 3-5 short paragraphs. No headers. No quotes around the text.

Recent sessions:
${summaries}

Active plot threads: ${threads || "none tracked"}

Write the recap now:` }], { maxTokens: 1024, proxyUrl });
      setRecapText(text);
      setShowModal("recap");
    } catch (e) {
      setParseStatus({ type: "error", msg: e.message || "Failed to generate recap." });
    }
    setParsing(false);
  };

  // ─── Thread Management ─────
  const saveThread = async () => {
    const { _newClue, ...t } = modalData;
    if (!t?.title?.trim() || !chronicleData) return;
    const existing = (chronicleData.plotThreads || []).findIndex(th => th.id === t.id);
    let threads;
    if (existing >= 0) {
      threads = [...chronicleData.plotThreads];
      threads[existing] = { ...threads[existing], ...t };
    } else {
      threads = [...(chronicleData.plotThreads || []), {
        ...t, id: `thr-${Date.now()}`, status: t.status || "active",
        session: (chronicleData.sessions?.length || 0), clues: t.clues || [],
      }];
    }
    await saveChronicleData({ ...chronicleData, plotThreads: threads });
    setShowModal(null); setModalData({});
  };

  const deleteThread = async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, plotThreads: (chronicleData.plotThreads || []).filter(t => t.id !== id) });
  };

  const cycleThreadStatus = async (id) => {
    if (!chronicleData) return;
    const threads = [...(chronicleData.plotThreads || [])];
    const idx = threads.findIndex(t => t.id === id);
    if (idx < 0) return;
    const order = ["active", "cold", "resolved"];
    const cur = order.indexOf(threads[idx].status);
    if (cur < 0) return;
    threads[idx] = { ...threads[idx], status: order[(cur + 1) % 3] };
    await saveChronicleData({ ...chronicleData, plotThreads: threads });
  };

  // ─── Clock Management ─────
  const saveClock = async () => {
    const c = modalData;
    if (!c?.name?.trim() || !chronicleData) return;
    const existing = (chronicleData.clocks || []).findIndex(cl => cl.id === c.id);
    let clocks;
    if (existing >= 0) {
      clocks = [...chronicleData.clocks];
      clocks[existing] = { ...clocks[existing], ...c };
    } else {
      clocks = [...(chronicleData.clocks || []), {
        ...c, id: `clk-${Date.now()}`, segments: Math.min(Math.max(c.segments || 6, 3), 12), filled: c.filled || 0,
      }];
    }
    await saveChronicleData({ ...chronicleData, clocks });
    setShowModal(null); setModalData({});
  };

  const advanceClock = async (id, amount = 1) => {
    if (!chronicleData) return;
    const clocks = [...(chronicleData.clocks || [])];
    const idx = clocks.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newFilled = Math.max(0, Math.min(clocks[idx].filled + amount, clocks[idx].segments));
    clocks[idx] = { ...clocks[idx], filled: newFilled };
    await saveChronicleData({ ...chronicleData, clocks });
  };

  const deleteClock = async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, clocks: (chronicleData.clocks || []).filter(c => c.id !== id) });
  };

  // ─── Faction Management ─────
  const saveFaction = async () => {
    const f = modalData;
    if (!f?.name?.trim() || !chronicleData) return;
    const existing = (chronicleData.factions || []).findIndex(fc => fc.id === f.id);
    let factions;
    if (existing >= 0) {
      factions = [...chronicleData.factions];
      factions[existing] = { ...factions[existing], ...f };
    } else {
      factions = [...(chronicleData.factions || []), {
        ...f, id: `fac-${Date.now()}`, members: f.members || [],
      }];
    }
    await saveChronicleData({ ...chronicleData, factions });
    setShowModal(null); setModalData({});
  };

  const deleteFaction = async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, factions: (chronicleData.factions || []).filter(f => f.id !== id) });
  };

  // ─── Location Management ─────
  const saveLocation = async () => {
    const loc = modalData;
    if (!loc?.name?.trim() || !chronicleData) return;
    const existing = (chronicleData.locationDossiers || []).findIndex(l => l.id === loc.id);
    let locs;
    if (existing >= 0) {
      locs = [...chronicleData.locationDossiers];
      locs[existing] = { ...locs[existing], ...loc };
    } else {
      locs = [...(chronicleData.locationDossiers || []), {
        ...loc, id: `loc-${Date.now()}`, sessions: loc.sessions || [],
      }];
    }
    await saveChronicleData({ ...chronicleData, locationDossiers: locs });
    setShowModal(null); setModalData({});
  };

  const deleteLocation = async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, locationDossiers: (chronicleData.locationDossiers || []).filter(l => l.id !== id) });
  };

  // ─── Export Chronicle ─────
  const exportChronicle = () => {
    if (!chronicleData || !activeChronicle) return;
    const cd = chronicleData;
    const lines = [];
    lines.push(`# ${activeChronicle.name}`);
    lines.push(`*${GAME_TYPES.find(g => g.id === activeChronicle.gameType)?.label || activeChronicle.gameType}*\n`);
    if (activeChronicle.description) lines.push(`> ${activeChronicle.description}\n`);

    // Characters
    if (cd.characters?.length) {
      lines.push(`## Player Characters\n`);
      cd.characters.forEach(c => {
        lines.push(`### ${c.name}`);
        if (c.concept) lines.push(`**Concept:** ${c.concept}`);
        if (c.clan) lines.push(`**Clan/Tradition:** ${c.clan}`);
        if (c.backstory) lines.push(`\n${c.backstory}`);
        if (c.notes) lines.push(`\n*Notes:* ${c.notes}`);
        lines.push("");
      });
    }

    // NPCs
    if (cd.npcs?.length) {
      lines.push(`## NPCs\n`);
      cd.npcs.forEach(n => {
        lines.push(`### ${n.name} [${n.relationship}]`);
        if (n.faction) lines.push(`**Faction:** ${n.faction}`);
        if (n.description) lines.push(n.description);
        if (n.appearance) lines.push(`**Appearance:** ${n.appearance}`);
        if (n.personality) lines.push(`**Personality:** ${n.personality}`);
        if (n.backstory) lines.push(`**Backstory:** ${n.backstory}`);
        if (n.motivations) lines.push(`**Motivations:** ${n.motivations}`);
        if (n.notes) lines.push(`*Notes:* ${n.notes}`);
        if (n.history?.length) {
          n.history.forEach(h => lines.push(`- Session ${h.session}: ${h.event}`));
        }
        lines.push("");
      });
    }

    // Factions
    if (cd.factions?.length) {
      lines.push(`## Factions\n`);
      cd.factions.forEach(f => {
        lines.push(`### ${f.name}`);
        if (f.influence) lines.push(`**Influence:** ${f.influence}`);
        if (f.attitude) lines.push(`**Attitude:** ${f.attitude}`);
        if (f.territory) lines.push(`**Territory:** ${f.territory}`);
        if (f.goals) lines.push(`**Goals:** ${f.goals}`);
        if (f.description) lines.push(f.description);
        if (f.members?.length) lines.push(`**Key Members:** ${f.members.join(", ")}`);
        lines.push("");
      });
    }

    // Locations
    if (cd.locationDossiers?.length) {
      lines.push(`## Locations\n`);
      cd.locationDossiers.forEach(l => {
        lines.push(`### ${l.name}`);
        if (l.type) lines.push(`**Type:** ${l.type}`);
        if (l.controlledBy) lines.push(`**Controlled by:** ${l.controlledBy}`);
        if (l.description) lines.push(l.description);
        if (l.atmosphere) lines.push(`**Atmosphere:** ${l.atmosphere}`);
        if (l.secrets) lines.push(`**Secrets:** ${l.secrets}`);
        if (l.notes) lines.push(`*Notes:* ${l.notes}`);
        lines.push("");
      });
    }

    // Plot Threads
    if (cd.plotThreads?.length) {
      lines.push(`## Plot Threads\n`);
      ["active", "cold", "resolved"].forEach(status => {
        const group = cd.plotThreads.filter(t => t.status === status);
        if (!group.length) return;
        lines.push(`### ${status.charAt(0).toUpperCase() + status.slice(1)}\n`);
        group.forEach(t => {
          lines.push(`**${t.title}** (${t.type})`);
          if (t.description) lines.push(t.description);
          t.clues?.forEach(c => lines.push(`- Session ${c.session}: ${c.text}`));
          lines.push("");
        });
      });
    }

    // Sessions
    if (cd.sessions?.length) {
      lines.push(`## Session Logs\n`);
      cd.sessions.forEach(s => {
        lines.push(`### Session ${s.number}${s.title ? ` — ${s.title}` : ""} (${s.date})`);
        if (s.summary) lines.push(`*${s.summary}*\n`);
        if (s.storyBeats?.length) s.storyBeats.forEach(b => lines.push(`- ${b}`));
        if (s.logText) lines.push(`\n${s.logText}`);
        lines.push("\n---\n");
      });
    }

    // Timeline
    if (cd.storyBeats?.length) {
      lines.push(`## Story Timeline\n`);
      cd.storyBeats.forEach(b => lines.push(`- **Session ${b.session}:** ${b.text}`));
    }

    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeChronicle.name.replace(/[^a-zA-Z0-9]/g, "_")}_chronicle.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Read text file helper
  const readTextFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });

  // Session markdown upload
  const handleSessionFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readTextFile(file);
    const title = file.name.replace(/\.(md|txt|markdown)$/i, "").replace(/[-_]/g, " ");
    setModalData(d => ({ ...d, logText: text, title: d.title || title }));
    e.target.value = "";
  };

  // Character markdown upload — parse with Claude, extract NPCs
  const handleCharacterFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readTextFile(file);
    if (!apiKey) { setParseStatus({ type: "error", msg: "API key required. Open Settings (⚙) to add your Anthropic API key." }); setParsing(false); return; }
    setParsing(true);
    setModalData(d => ({ ...d, _rawMarkdown: text }));
    
    const parsed = await parseCharacterMarkdown(text, activeChronicle?.gameType || "vtm", apiKey, proxyUrl);
    
    if (parsed) {
      // Build extended notes from extra parsed fields
      const extraParts = [];
      if (parsed.generation) extraParts.push(`Generation/Rank: ${parsed.generation}`);
      if (parsed.sire) extraParts.push(`Sire/Mentor: ${parsed.sire}`);
      if (parsed.haven) extraParts.push(`Haven: ${parsed.haven}`);
      if (parsed.faction) extraParts.push(`Faction: ${parsed.faction}`);
      if (parsed.attributes) extraParts.push(`\nAttributes: ${parsed.attributes}`);
      if (parsed.abilities) extraParts.push(`Abilities: ${parsed.abilities}`);
      if (parsed.disciplines) extraParts.push(`Disciplines/Spheres: ${parsed.disciplines}`);
      if (parsed.meritsFlaws) extraParts.push(`Merits & Flaws: ${parsed.meritsFlaws}`);
      if (parsed.allies?.length) extraParts.push(`Known Allies: ${parsed.allies.join(", ")}`);
      if (parsed.enemies?.length) extraParts.push(`Known Enemies: ${parsed.enemies.join(", ")}`);
      
      const combinedNotes = [parsed.notes || "", ...extraParts].filter(Boolean).join("\n");

      setModalData(d => ({
        ...d,
        name: parsed.name || d.name || "",
        concept: parsed.concept || d.concept || "",
        clan: parsed.clan || d.clan || "",
        nature: parsed.nature || d.nature || "",
        demeanor: parsed.demeanor || d.demeanor || "",
        backstory: parsed.backstory || d.backstory || "",
        notes: combinedNotes || d.notes || "",
        _rawMarkdown: text,
        _pendingNPCs: parsed.mentionedNPCs || [],
      }));
    } else {
      // Fallback: dump raw markdown into backstory
      setModalData(d => ({ ...d, backstory: stripMarkdown(text), _rawMarkdown: text }));
    }
    setParsing(false);
    e.target.value = "";
  };

  // Re-parse character from updated markdown
  const handleCharacterMarkdownUpdate = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chronicleData) return;
    const text = await readTextFile(file);
    if (!apiKey) { setParseStatus({ type: "error", msg: "API key required. Open Settings (⚙) to add your Anthropic API key." }); setParsing(false); return; }
    setParsing(true);

    const parsed = await parseCharacterMarkdown(text, activeChronicle?.gameType || "vtm", apiKey, proxyUrl);

    if (parsed) {
      const extraParts = [];
      if (parsed.generation) extraParts.push(`Generation/Rank: ${parsed.generation}`);
      if (parsed.sire) extraParts.push(`Sire/Mentor: ${parsed.sire}`);
      if (parsed.haven) extraParts.push(`Haven: ${parsed.haven}`);
      if (parsed.faction) extraParts.push(`Faction: ${parsed.faction}`);
      if (parsed.attributes) extraParts.push(`\nAttributes: ${parsed.attributes}`);
      if (parsed.abilities) extraParts.push(`Abilities: ${parsed.abilities}`);
      if (parsed.disciplines) extraParts.push(`Disciplines/Spheres: ${parsed.disciplines}`);
      if (parsed.meritsFlaws) extraParts.push(`Merits & Flaws: ${parsed.meritsFlaws}`);
      if (parsed.allies?.length) extraParts.push(`Known Allies: ${parsed.allies.join(", ")}`);
      if (parsed.enemies?.length) extraParts.push(`Known Enemies: ${parsed.enemies.join(", ")}`);
      const combinedNotes = [parsed.notes || "", ...extraParts].filter(Boolean).join("\n");

      setModalData(d => ({
        ...d,
        name: parsed.name || d.name,
        concept: parsed.concept || d.concept,
        clan: parsed.clan || d.clan,
        nature: parsed.nature || d.nature,
        demeanor: parsed.demeanor || d.demeanor,
        backstory: parsed.backstory || d.backstory,
        notes: combinedNotes || d.notes,
        _rawMarkdown: text,
        _pendingNPCs: parsed.mentionedNPCs || [],
      }));
    }
    setParsing(false);
    e.target.value = "";
  };

  // ─── Character Management ─────
  const saveCharacter = async () => {
    const ch = modalData;
    if (!ch?.name?.trim() || !chronicleData) return;
    // Strip internal fields before saving
    const { _rawMarkdown, _pendingNPCs, ...charData } = ch;
    const existing = (chronicleData.characters || []).findIndex(c => c.id === charData.id);
    let newChars;
    if (existing >= 0) {
      newChars = [...chronicleData.characters];
      newChars[existing] = { ...newChars[existing], ...charData, updatedAt: new Date().toISOString() };
    } else {
      newChars = [...(chronicleData.characters || []), {
        ...charData, id: `char-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }];
    }

    // Auto-create NPCs from character markdown
    let newNpcs = [...(chronicleData.npcs || [])];
    if (_pendingNPCs?.length > 0) {
      _pendingNPCs.forEach(n => {
        // Check if NPC already exists (case-insensitive)
        const exists = newNpcs.some(existing => existing.name.toLowerCase() === n.name.toLowerCase());
        if (!exists) {
          newNpcs.push({
            id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: n.name,
            description: n.description || "",
            relationship: n.relationship || "Unknown",
            faction: n.faction || "",
            notes: n.notes ? `[From ${charData.name}'s backstory] ${n.notes}` : `Mentioned in ${charData.name}'s backstory`,
            avatar: null,
            firstSeen: null,
            lastSeen: null,
            history: [{ session: 0, event: `Referenced in ${charData.name}'s character profile` }],
          });
        }
      });
    }

    await saveChronicleData({ ...chronicleData, characters: newChars, npcs: newNpcs });
    setShowModal(null);
    setModalData({});
  };

  const deleteCharacter = async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, characters: (chronicleData.characters || []).filter(c => c.id !== id) });
  };

  // ─── Render ─────────────────────────────────────────

  if (loading) return (
    <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('${FONTS_URL}'); @keyframes wod-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.loading} />
    </div>
  );

  const renderDashboard = () => {
    if (!activeChronicle) return <EmptyState text="Create a chronicle to begin" />;
    const cd = chronicleData || { sessions: [], npcs: [], characters: [], storyBeats: [], plotThreads: [], clocks: [] };
    const activeThreads = (cd.plotThreads || []).filter(t => t.status === "active").length;
    return (
      <div>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 700, letterSpacing: 2, color: accent }}>
                {gameType?.icon} {activeChronicle.name}
              </div>
              <div style={{ ...S.muted, marginTop: 4 }}>{gameType?.label}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {cd.sessions?.length > 0 && (
                <button style={S.btn(accent)} onClick={generateRecap} disabled={parsing}>
                  {parsing ? "Generating..." : "📺 Previously on..."}
                </button>
              )}
              <button style={S.btn(accent)} onClick={exportChronicle}>📥 Export .md</button>
              <button style={S.btn("#6a3333")} onClick={deleteChronicle}>Delete Chronicle</button>
            </div>
          </div>
          {activeChronicle.description && (
            <div style={{ marginTop: 12, fontSize: 22, lineHeight: 1.6, color: "#d4c8ae", fontStyle: "italic" }}>
              {activeChronicle.description}
            </div>
          )}
          <div style={S.divider} />
          <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
            {[
              { label: "Sessions", val: cd.sessions?.length || 0 },
              { label: "NPCs", val: cd.npcs?.length || 0 },
              { label: "Characters", val: cd.characters?.length || 0 },
              { label: "Factions", val: (cd.factions || []).length },
              { label: "Locations", val: (cd.locationDossiers || []).length },
              { label: "Threads", val: activeThreads },
              { label: "Story Beats", val: cd.storyBeats?.length || 0 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 36, fontWeight: 700, color: accent }}>{s.val}</div>
                <div style={{ fontSize: 15, fontFamily: "'Cinzel', serif", letterSpacing: 2, color: "#a09888", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Recent session */}
        {cd.sessions?.length > 0 && (
          <div>
            <div style={{ ...S.cardHeader, color: accent, marginTop: 12 }}>Latest Session</div>
            <SessionCard session={cd.sessions[cd.sessions.length - 1]} accent={accent}
              index={cd.sessions.length - 1}
              onView={(s) => { setModalData(s); setShowModal("viewLog"); }}
              onDelete={deleteSession} />
          </div>
        )}
        {/* Recent NPCs */}
        {cd.npcs?.length > 0 && (
          <div>
            <div style={{ ...S.cardHeader, color: accent, marginTop: 12 }}>Recent NPCs</div>
            <div style={S.grid2}>
              {cd.npcs.slice(-4).reverse().map(npc => (
                <NPCCard key={npc.id} npc={npc} accent={accent}
                  onEdit={(n) => { setModalData(n); setShowModal("editNPC"); }}
                  onDelete={deleteNPC} />
              ))}
            </div>
          </div>
        )}
        {/* Active Clocks */}
        {(cd.clocks || []).length > 0 && (
          <div>
            <div style={{ ...S.cardHeader, color: accent, marginTop: 12 }}>Progress Clocks</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(cd.clocks || []).map(c => (
                <div key={c.id} style={{ ...S.card, flex: "0 0 auto", textAlign: "center", padding: 16, minWidth: 120 }}>
                  <ProgressClock segments={c.segments} filled={c.filled} accent={accent} size={70}
                    onClick={() => advanceClock(c.id, 1)} />
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: 1, color: "#e8dcc6", marginTop: 8 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#7a7068", textTransform: "uppercase", letterSpacing: 1 }}>{c.type || "threat"}</div>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 6 }}>
                    <button style={{ ...S.btn(accent), padding: "2px 8px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); advanceClock(c.id, -1); }}>−</button>
                    <button style={{ ...S.btn(accent), padding: "2px 8px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setModalData(c); setShowModal("editClock"); }}>✎</button>
                    <button style={{ ...S.btn("#6a3333"), padding: "2px 8px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); deleteClock(c.id); }}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{ ...S.card, flex: "0 0 auto", textAlign: "center", padding: 16, minWidth: 120, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: 0.6 }}
                onClick={() => { setModalData({ name: "", segments: 6, filled: 0, type: "threat" }); setShowModal("editClock"); }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: 1, color: accent }}>+ New Clock</div>
              </div>
            </div>
          </div>
        )}
        {/* Active Threads preview */}
        {(cd.plotThreads || []).filter(t => t.status === "active").length > 0 && (
          <div>
            <div style={{ ...S.cardHeader, color: accent, marginTop: 12 }}>Active Threads</div>
            {(cd.plotThreads || []).filter(t => t.status === "active").slice(0, 4).map(t => (
              <div key={t.id} style={{ ...S.card, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: "#f0e6d4" }}>{t.title}</span>
                  {t.description && <div style={{ fontSize: 17, color: "#b0a490", marginTop: 2 }}>{t.description}</div>}
                </div>
                <span style={{ ...S.tag(accent), fontSize: 11 }}>{t.type || "mystery"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSessions = () => {
    const cd = chronicleData || { sessions: [] };
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Session Logs</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={S.btn(accent)} onClick={() => { setModalData({}); setShowModal("newSession"); setTimeout(() => sessionFileRef.current?.click(), 300); }}>
              📄 Upload .md
            </button>
            <button style={S.btnFilled(accent)} onClick={() => { setModalData({}); setShowModal("newSession"); }}>
              + New Session
            </button>
          </div>
        </div>
        {cd.sessions?.length === 0 ? (
          <EmptyState text="No sessions recorded yet. The chronicle awaits." />
        ) : (
          [...cd.sessions].reverse().map((s, i) => (
            <SessionCard key={s.id} session={s} accent={accent} index={i}
              onView={(ses) => { setModalData(ses); setShowModal("viewLog"); }}
              onDelete={deleteSession} />
          ))
        )}
      </div>
    );
  };

  const renderNPCs = () => {
    const cd = chronicleData || { npcs: [] };
    const allNpcs = cd.npcs || [];
    const factions = [...new Set(allNpcs.map(n => n.faction).filter(Boolean))].sort();
    const relationships = [...new Set(allNpcs.map(n => n.relationship).filter(Boolean))].sort();
    
    let filtered = allNpcs;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter(n => 
        n.name.toLowerCase().includes(q) || n.faction?.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q) || n.personality?.toLowerCase().includes(q) ||
        n.backstory?.toLowerCase().includes(q) || n.notes?.toLowerCase().includes(q)
      );
    }
    if (npcRelFilter) filtered = filtered.filter(n => n.relationship === npcRelFilter);
    if (npcFactionFilter) filtered = filtered.filter(n => n.faction === npcFactionFilter);

    // Relationship Web rendering
    const renderWeb = () => {
      if (allNpcs.length < 2) return <EmptyState text="Need at least 2 NPCs for the relationship web." />;
      const W = 700, H = 500;
      const cx = W / 2, cy = H / 2;
      const relColors = {
        Ally: "#4a8c3f", Enemy: "#c41e3a", Rival: "#c47a1e", Contact: "#4a6a8a",
        Mentor: "#8a4ac4", Lover: "#c44a6a", Patron: "#6a8a4a", Sire: "#8a3a3a",
        Childe: "#3a8a6a", Neutral: "#6a6a6a", Suspicious: "#8a6a2a", Feared: "#6a2a2a",
        Respected: "#2a6a8a", Unknown: "#5a5a5a",
      };
      const factionGroups = {};
      allNpcs.forEach((n, i) => {
        const fk = n.faction || "_none";
        if (!factionGroups[fk]) factionGroups[fk] = [];
        factionGroups[fk].push({ ...n, _idx: i });
      });
      const factionKeys = Object.keys(factionGroups);
      const positions = new Array(allNpcs.length);
      factionKeys.forEach((fk, fi) => {
        const members = factionGroups[fk];
        const factionAngle = (fi / factionKeys.length) * 2 * Math.PI - Math.PI / 2;
        const baseR = Math.min(W, H) * 0.35;
        members.forEach((m, mi) => {
          const spread = members.length > 1 ? (mi - (members.length - 1) / 2) * 0.3 : 0;
          const angle = factionAngle + spread;
          const r = baseR + (mi % 2 === 0 ? 0 : 25);
          positions[m._idx] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
        });
      });
      const webLines = [];
      factionKeys.forEach(fk => {
        if (fk === "_none") return;
        const members = factionGroups[fk];
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            webLines.push({ from: members[i]._idx, to: members[j]._idx, color: "#4a4a5830", dashed: true });
          }
        }
      });
      const factionColorMap = {};
      const palette = ["#c41e3a", "#4a8c3f", "#4a6a8a", "#c47a1e", "#8a4ac4", "#c44a6a", "#6a8a4a", "#8a6a2a"];
      factionKeys.filter(f => f !== "_none").forEach((f, i) => { factionColorMap[f] = palette[i % palette.length]; });

      return (
        <div style={{ ...S.card, padding: 16, overflow: "auto" }}>
          <svg width={W} height={H} style={{ display: "block", margin: "0 auto" }}>
            {factionKeys.filter(f => f !== "_none").map((fk, fi) => {
              const angle = (fi / factionKeys.length) * 2 * Math.PI - Math.PI / 2;
              const lx = cx + (Math.min(W, H) * 0.48) * Math.cos(angle);
              const ly = cy + (Math.min(W, H) * 0.48) * Math.sin(angle);
              return (
                <text key={fk} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                  fill={factionColorMap[fk] || "#6a6a6a"} fontSize={11} fontFamily="'Cinzel', serif"
                  letterSpacing="1" opacity={0.7}>{fk}</text>
              );
            })}
            {webLines.map((l, i) => {
              const pFrom = positions[l.from];
              const pTo = positions[l.to];
              if (!pFrom || !pTo) return null;
              return (
                <line key={i} x1={pFrom.x} y1={pFrom.y}
                  x2={pTo.x} y2={pTo.y}
                  stroke={l.color} strokeWidth={1} strokeDasharray={l.dashed ? "4,4" : "none"} />
              );
            })}
            {allNpcs.map((npc, i) => {
              const p = positions[i] || { x: 0, y: 0 };
              const rc = relColors[npc.relationship] || "#5a5a5a";
              return (
                <g key={npc.id} style={{ cursor: "pointer" }}
                  onClick={() => { setModalData(npc); setShowModal("editNPC"); }}>
                  <circle cx={p.x} cy={p.y} r={20} fill={`${rc}30`} stroke={rc} strokeWidth={2} />
                  {!npc.avatar && (
                    <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle"
                      fill={rc} fontSize={16}>🎭</text>
                  )}
                  <text x={p.x} y={p.y + 28} textAnchor="middle" fill="#e8dcc6"
                    fontSize={11} fontFamily="'Cinzel', serif" letterSpacing="0.5">{npc.name}</text>
                  <text x={p.x} y={p.y + 40} textAnchor="middle" fill={rc}
                    fontSize={9} fontFamily="'Cinzel', serif" letterSpacing="0.5">{npc.relationship}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
            {Object.entries(relColors).filter(([r]) => relationships.includes(r)).map(([r, c]) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#7a7068" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                {r}
              </div>
            ))}
          </div>
        </div>
      );
    };
    
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...S.cardHeader, margin: 0, color: accent }}>NPCs ({allNpcs.length})</div>
            <div style={{ display: "flex", gap: 2, background: "#1a1a22", borderRadius: 6, padding: 2 }}>
              {[{ id: "cards", icon: "▤" }, { id: "web", icon: "◎" }].map(m => (
                <button key={m.id} onClick={() => setNpcViewMode(m.id)}
                  style={{ background: npcViewMode === m.id ? `${accent}20` : "transparent",
                    border: "none", color: npcViewMode === m.id ? "#e8dcc6" : "#5a5a65",
                    padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 15 }}>
                  {m.icon}
                </button>
              ))}
            </div>
          </div>
          <button style={S.btnFilled(accent)}
            onClick={() => { setModalData({ name: "", description: "", relationship: "Unknown", faction: "", notes: "", avatar: null }); setShowModal("editNPC"); }}>
            + Add NPC
          </button>
        </div>
        {npcViewMode === "web" ? renderWeb() : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input style={{ ...S.input, flex: "1 1 180px" }} placeholder="Search NPCs..."
                value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
              <select style={{ ...S.select, flex: "0 0 auto", minWidth: 140 }} value={npcRelFilter}
                onChange={e => setNpcRelFilter(e.target.value)}>
                <option value="">All relationships</option>
                {relationships.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select style={{ ...S.select, flex: "0 0 auto", minWidth: 140 }} value={npcFactionFilter}
                onChange={e => setNpcFactionFilter(e.target.value)}>
                <option value="">All factions</option>
                {factions.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {(searchFilter || npcRelFilter || npcFactionFilter) && (
                <button style={{ ...S.btn(accent), padding: "6px 12px", fontSize: 13 }}
                  onClick={() => { setSearchFilter(""); setNpcRelFilter(""); setNpcFactionFilter(""); }}>
                  Clear
                </button>
              )}
            </div>
            {filtered.length === 0 ? (
              <EmptyState text={allNpcs.length === 0 ? "No NPCs encountered yet. The night is young." : "No NPCs match your filters."} />
            ) : (
              <div style={S.grid2}>
                {filtered.map(npc => (
                  <NPCCard key={npc.id} npc={npc} accent={accent}
                    onEdit={(n) => { setModalData(n); setShowModal("editNPC"); }}
                    onDelete={deleteNPC} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };


  const renderCharacters = () => {
    const cd = chronicleData || { characters: [] };
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Player Characters</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={S.btn(accent)}
              onClick={() => { setModalData({ name: "", concept: "", clan: "", nature: "", demeanor: "", backstory: "", notes: "", avatar: null }); setShowModal("editCharacter"); setTimeout(() => characterFileRef.current?.click(), 300); }}>
              📜 Import from .md
            </button>
            <button style={S.btnFilled(accent)}
              onClick={() => { setModalData({ name: "", concept: "", clan: "", nature: "", demeanor: "", backstory: "", notes: "", avatar: null }); setShowModal("editCharacter"); }}>
              + Add Character
            </button>
          </div>
        </div>
        {cd.characters?.length === 0 ? (
          <EmptyState text="No characters created yet. Who will you become?" />
        ) : (
          cd.characters.map(ch => (
            <div key={ch.id} style={{ ...S.card, position: "relative", cursor: "pointer" }}
              onClick={() => { setModalData(ch); setShowModal("editCharacter"); }}>
              <div style={{ display: "flex", gap: 16 }}>
                {ch.avatar ? (
                  <img src={ch.avatar} alt={ch.name} style={{ width: 80, height: 80, borderRadius: 6, objectFit: "cover", border: `2px solid ${accent}40` }} />
                ) : (
                  <div style={{ width: 80, height: 80, borderRadius: 6, background: `${accent}10`, border: `2px solid ${accent}20`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: `${accent}40` }}>⚜</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 700, letterSpacing: 1, color: "#f0e6d4" }}>{ch.name}</div>
                  {ch.concept && <div style={{ color: accent, fontSize: 19, marginTop: 2 }}>{ch.concept}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {ch.clan && <span style={S.tag(accent)}>{ch.clan}</span>}
                    {ch.nature && <span style={S.tag("#7a7068")}>Nature: {ch.nature}</span>}
                    {ch.demeanor && <span style={S.tag("#7a7068")}>Demeanor: {ch.demeanor}</span>}
                  </div>
                </div>
              </div>
              {ch.backstory && (
                <div style={{ marginTop: 12, fontSize: 19, lineHeight: 1.7, color: "#d4c8ae", whiteSpace: "pre-wrap" }}>
                  {ch.backstory.length > 400 ? ch.backstory.slice(0, 400) + "..." : ch.backstory}
                </div>
              )}
              {ch.notes && (
                <div style={{ marginTop: 8, fontSize: 18, fontStyle: "italic", color: "#b0a490" }}>
                  {ch.notes}
                </div>
              )}
              <button onClick={e => { e.stopPropagation(); deleteCharacter(ch.id); }}
                style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
                  color: "#4a4a58", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderFactions = () => {
    const cd = chronicleData || { factions: [] };
    const allFactions = cd.factions || [];
    const attitudeColor = {
      Hostile: "#c41e3a", Unfriendly: "#a04030", Wary: "#8a6a2a",
      Neutral: "#6a6a6a", Curious: "#4a6a8a", Friendly: "#4a8c3f", Allied: "#2a8a6a",
    };
    const influenceBar = (level) => {
      const levels = INFLUENCE_LEVELS;
      const idx = levels.indexOf(level);
      return (
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {levels.map((l, i) => (
            <div key={l} style={{
              width: 16, height: 6, borderRadius: 2,
              background: i <= idx ? `${accent}${i <= idx ? "cc" : "20"}` : "#2a2a35",
            }} />
          ))}
          <span style={{ fontSize: 13, color: "#a09888", marginLeft: 4 }}>{level}</span>
        </div>
      );
    };

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Factions ({allFactions.length})</div>
          <button style={S.btnFilled(accent)}
            onClick={() => { setModalData({ name: "", description: "", attitude: "Neutral", influence: "Notable", territory: "", goals: "", members: [] }); setShowModal("editFaction"); }}>
            + Add Faction
          </button>
        </div>
        {allFactions.length === 0 ? (
          <EmptyState text="No factions tracked. The political landscape is unmapped." />
        ) : (
          <div style={S.grid2}>
            {allFactions.map(f => (
              <div key={f.id} style={{ ...S.card, cursor: "pointer", position: "relative" }}
                onClick={() => { setModalData(f); setShowModal("editFaction"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 600, letterSpacing: 1, color: "#e8dcc6" }}>
                      🏛 {f.name}
                    </div>
                    {f.territory && <div style={{ fontSize: 16, color: "#a09888", marginTop: 2 }}>📍 {f.territory}</div>}
                  </div>
                  <span style={{ ...S.tag(attitudeColor[f.attitude] || "#6a6a6a"), fontSize: 12 }}>{f.attitude}</span>
                </div>
                {f.description && <div style={{ marginTop: 8, fontSize: 18, color: "#d4c8ae", lineHeight: 1.5 }}>{f.description}</div>}
                <div style={{ marginTop: 8 }}>{influenceBar(f.influence || "None")}</div>
                {f.goals && (
                  <div style={{ marginTop: 8, fontSize: 16, color: "#b0a490" }}>
                    <span style={{ color: accent, fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 1 }}>GOALS </span>
                    {f.goals}
                  </div>
                )}
                {f.members?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 15, color: "#a09888" }}>
                    Members: {f.members.join(", ")}
                  </div>
                )}
                <button onClick={e => { e.stopPropagation(); deleteFaction(f.id); }}
                  style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
                    color: "#4a4a58", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderLocations = () => {
    const cd = chronicleData || { locationDossiers: [] };
    const allLocs = cd.locationDossiers || [];
    const typeIcons = {
      haven: "🏚", elysium: "🏛", bar: "🍷", street: "🌃", leyNode: "✨",
      church: "⛪", graveyard: "⚰", warehouse: "🏭", mansion: "🏰", other: "📍",
    };

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Locations ({allLocs.length})</div>
          <button style={S.btnFilled(accent)}
            onClick={() => { setModalData({ name: "", type: "other", description: "", atmosphere: "", controlledBy: "", secrets: "", notes: "", sessions: [] }); setShowModal("editLocation"); }}>
            + Add Location
          </button>
        </div>
        {allLocs.length === 0 ? (
          <EmptyState text="No locations mapped. The city is still a mystery." />
        ) : (
          <div style={S.grid2}>
            {allLocs.map(loc => (
              <div key={loc.id} style={{ ...S.card, cursor: "pointer", position: "relative" }}
                onClick={() => { setModalData(loc); setShowModal("editLocation"); }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 600, letterSpacing: 1, color: "#e8dcc6" }}>
                  {typeIcons[loc.type] || "📍"} {loc.name}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <span style={{ ...S.tag(accent), fontSize: 11 }}>{loc.type}</span>
                  {loc.controlledBy && <span style={{ ...S.tag("#4a6a8a"), fontSize: 11 }}>{loc.controlledBy}</span>}
                </div>
                {loc.description && <div style={{ marginTop: 8, fontSize: 18, color: "#d4c8ae", lineHeight: 1.5 }}>{loc.description}</div>}
                {loc.atmosphere && (
                  <div style={{ marginTop: 6, fontSize: 16, fontStyle: "italic", color: "#a89d8d" }}>
                    ✦ {loc.atmosphere}
                  </div>
                )}
                {loc.secrets && (
                  <div style={{ marginTop: 6, fontSize: 16, color: "#d4962e" }}>
                    🔒 {loc.secrets}
                  </div>
                )}
                {loc.sessions?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#5a5a65", fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
                    Visited: Session{loc.sessions.length > 1 ? "s" : ""} {loc.sessions.join(", ")}
                  </div>
                )}
                <button onClick={e => { e.stopPropagation(); deleteLocation(loc.id); }}
                  style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
                    color: "#4a4a58", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderThreads = () => {
    const cd = chronicleData || { plotThreads: [], clocks: [] };
    const threads = cd.plotThreads || [];
    const clocks = cd.clocks || [];
    const statusColor = { active: "#c41e3a", cold: "#4a6a8a", resolved: "#3a6a3a" };
    const statusIcon = { active: "🔥", cold: "❄", resolved: "✓" };
    const typeIcon = { mystery: "❓", danger: "⚠", political: "👑", personal: "💔", quest: "⚔" };

    return (
      <div>
        {/* Progress Clocks Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Progress Clocks</div>
          <button style={S.btnFilled(accent)} onClick={() => { setModalData({ name: "", segments: 6, filled: 0, type: "threat" }); setShowModal("editClock"); }}>
            + New Clock
          </button>
        </div>
        {clocks.length === 0 ? (
          <EmptyState text="No clocks ticking. For now." />
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            {clocks.map(c => (
              <div key={c.id} style={{ ...S.card, flex: "0 0 auto", textAlign: "center", padding: 16, minWidth: 130,
                border: c.filled >= c.segments ? `1px solid #ff6b6b60` : undefined,
                background: c.filled >= c.segments ? "rgba(255,107,107,0.05)" : undefined }}>
                <ProgressClock segments={c.segments} filled={c.filled} accent={accent} size={80}
                  onClick={() => advanceClock(c.id, 1)} />
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, letterSpacing: 1, color: "#e8dcc6", marginTop: 8 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#7a7068", textTransform: "uppercase", letterSpacing: 1 }}>{c.type || "threat"}</div>
                {c.filled >= c.segments && (
                  <div style={{ fontSize: 12, color: "#ff6b6b", fontFamily: "'Cinzel', serif", letterSpacing: 1, marginTop: 4 }}>⚡ COMPLETE</div>
                )}
                <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 8 }}>
                  <button style={{ ...S.btn(accent), padding: "3px 10px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); advanceClock(c.id, -1); }}>−</button>
                  <button style={{ ...S.btn(accent), padding: "3px 10px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); advanceClock(c.id, 1); }}>+</button>
                  <button style={{ ...S.btn(accent), padding: "3px 10px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setModalData(c); setShowModal("editClock"); }}>✎</button>
                  <button style={{ ...S.btn("#6a3333"), padding: "3px 10px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); deleteClock(c.id); }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plot Threads Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 8 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Plot Threads</div>
          <button style={S.btnFilled(accent)} onClick={() => { setModalData({ title: "", description: "", type: "mystery", status: "active", clues: [] }); setShowModal("editThread"); }}>
            + New Thread
          </button>
        </div>
        {threads.length === 0 ? (
          <EmptyState text="No threads woven. The tapestry is blank." />
        ) : (
          ["active", "cold", "resolved"].map(status => {
            const group = threads.filter(t => t.status === status);
            if (group.length === 0) return null;
            return (
              <div key={status} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontFamily: "'Cinzel', serif", letterSpacing: 2, color: statusColor[status], textTransform: "uppercase", marginBottom: 8 }}>
                  {statusIcon[status]} {status} ({group.length})
                </div>
                {group.map(t => (
                  <div key={t.id} style={{ ...S.card, marginBottom: 8, position: "relative", borderLeft: `3px solid ${statusColor[t.status]}`,
                    cursor: "pointer", opacity: t.status === "resolved" ? 0.6 : 1 }}
                    onClick={() => { setModalData(t); setShowModal("editThread"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{typeIcon[t.type] || "❓"}</span>
                          <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: "#e8dcc6", letterSpacing: 1 }}>{t.title}</span>
                          <span style={{ ...S.tag(statusColor[t.status]), fontSize: 11 }}>{t.type}</span>
                        </div>
                        {t.description && <div style={{ fontSize: 17, color: "#b0a490", marginTop: 4 }}>{t.description}</div>}
                        {t.clues?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {t.clues.map((c, i) => (
                              <div key={i} style={{ fontSize: 16, color: "#c4b49e", marginBottom: 2 }}>
                                <span style={{ color: accent, fontSize: 14 }}>S{c.session}</span> {c.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={{ ...S.btn(statusColor[t.status]), padding: "3px 10px", fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); cycleThreadStatus(t.id); }}
                          title="Cycle status">
                          {statusIcon[t.status]}
                        </button>
                        <button style={{ ...S.btn("#6a3333"), padding: "3px 10px", fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); deleteThread(t.id); }}>✕</button>
                      </div>
                    </div>
                    {t.session && (
                      <div style={{ fontSize: 12, color: "#5a5a65", marginTop: 6, fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
                        Introduced: Session {t.session}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderTimeline = () => {
    const cd = chronicleData || { storyBeats: [] };
    const beats = cd.storyBeats || [];
    // Group by session
    const grouped = {};
    beats.forEach(b => {
      const key = b.session || 0;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    });
    const sortedKeys = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

    return (
      <div>
        <div style={{ ...S.cardHeader, color: accent, marginBottom: 16 }}>Story Timeline</div>
        {sortedKeys.length === 0 ? (
          <EmptyState text="No story beats recorded. The pages are blank." />
        ) : (
          <div style={{ borderLeft: `2px solid ${accent}30`, marginLeft: 20, paddingLeft: 24 }}>
            {sortedKeys.map(key => (
              <div key={key} style={{ marginBottom: 24, position: "relative" }}>
                <div style={{
                  position: "absolute", left: -33, top: 4, width: 16, height: 16, borderRadius: "50%",
                  background: `${accent}30`, border: `2px solid ${accent}`, boxSizing: "border-box",
                }} />
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: 2, color: accent, marginBottom: 8 }}>
                  Session {key}
                  {grouped[key][0]?.date && <span style={{ color: "#7a7068", marginLeft: 10 }}>{grouped[key][0].date}</span>}
                </div>
                {grouped[key].map(beat => (
                  <div key={beat.id} style={{ fontSize: 19, lineHeight: 1.6, color: "#d4c8ae", marginBottom: 4 }}>
                    <span style={{ color: "#a09888", marginRight: 8 }}>▸</span>{beat.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderModals = () => {
    if (!showModal) return null;

    if (showModal === "newChronicle") return (
      <Modal onClose={() => { setShowModal(null); setModalEntrance(false); }} smoothEntrance={modalEntrance}>
        <div style={{ ...S.cardHeader, color: accent }}>New Chronicle</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input style={S.input} placeholder="Chronicle Name" value={modalData.name || ""}
            onChange={e => setModalData(d => ({ ...d, name: e.target.value }))} autoFocus />
          {activeGameType ? (
            <div style={{ ...S.input, background: "rgba(255,255,255,0.03)", color: "#8a7e70", display: "flex", alignItems: "center", gap: 8 }}>
              {GAME_TYPES.find(g => g.id === activeGameType)?.icon} {GAME_TYPES.find(g => g.id === activeGameType)?.label}
            </div>
          ) : (
            <select style={S.select} value={modalData.gameType || "vtm"}
              onChange={e => setModalData(d => ({ ...d, gameType: e.target.value }))}>
              {GAME_TYPES.map(g => <option key={g.id} value={g.id}>{g.icon} {g.label}</option>)}
            </select>
          )}
          <textarea style={{ ...S.textarea, minHeight: 80 }} placeholder="Chronicle description (optional)"
            value={modalData.description || ""} onChange={e => setModalData(d => ({ ...d, description: e.target.value }))} />
          <button style={S.btnFilled(accent)} onClick={createChronicle}>Create Chronicle</button>
        </div>
      </Modal>
    );

    if (showModal === "newSession") return (
      <Modal onClose={() => { if (!parsing) { setShowModal(null); setModalData({}); } }}>
        <div style={{ ...S.cardHeader, color: accent }}>
          {parsing ? "Parsing Session..." : "New Session Log"}
        </div>
        {parsing ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ ...S.loading, width: 24, height: 24 }} />
            <div style={{ marginTop: 16, color: "#7a7068", fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: 2 }}>
              The chronicle keeper reads your tale...
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input style={S.input} placeholder="Session Title (optional)" value={modalData.title || ""}
              onChange={e => setModalData(d => ({ ...d, title: e.target.value }))} autoFocus />
            
            {/* File upload zone */}
            <div style={{
              border: `2px dashed ${accent}30`, borderRadius: 6, padding: 20, textAlign: "center",
              cursor: "pointer", transition: "all 0.3s", background: modalData.logText ? `${accent}08` : "transparent",
            }} onClick={() => sessionFileRef.current?.click()}>
              <input ref={sessionFileRef} type="file" accept=".md,.txt,.markdown" hidden onChange={handleSessionFileUpload} />
              <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, letterSpacing: 1, color: accent }}>
                {modalData.logText ? "✓ Markdown loaded — click to replace" : "Upload Session Log (.md)"}
              </div>
              <div style={{ fontSize: 14, color: "#6a6058", marginTop: 4 }}>
                or paste text below
              </div>
            </div>

            <textarea style={{ ...S.textarea, minHeight: 180 }}
              placeholder="Paste session log here, or upload a markdown file above. Include NPC names, locations, events, and outcomes."
              value={modalData.logText || ""}
              onChange={e => setModalData(d => ({ ...d, logText: e.target.value }))} />
            <div style={{ fontSize: 16, color: "#7a7068", fontStyle: "italic" }}>
              The session log will be parsed by AI to extract NPCs, update characters, story beats, and a summary.
            </div>
            <button style={S.btnFilled(accent)} onClick={addSession}>Submit Session</button>
          </div>
        )}
      </Modal>
    );

    if (showModal === "editNPC") {
      const sectionLabel = (text) => (
        <div style={{ fontSize: 13, fontFamily: "'Cinzel', serif", letterSpacing: 2, color: accent, textTransform: "uppercase", marginTop: 4 }}>
          {text}
        </div>
      );
      return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ ...S.cardHeader, color: accent }}>
          {modalData.id ? "Edit NPC" : "New NPC"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
              {modalData.avatar ? (
                <img src={modalData.avatar} alt="" style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover", border: `2px solid ${accent}40` }} />
              ) : (
                <div style={{ ...S.npcAvatarPlaceholder, width: 70, height: 70, fontSize: 14, color: accent, flexDirection: "column" }}>
                  <span style={{ fontSize: 22 }}>📷</span>
                  <span style={{ fontSize: 11, fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>UPLOAD</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
            </div>
            <div style={{ flex: 1 }}>
              <input style={{ ...S.input, marginBottom: 10 }} placeholder="NPC Name" value={modalData.name || ""}
                onChange={e => setModalData(d => ({ ...d, name: e.target.value }))} autoFocus />
              <input style={S.input} placeholder="Faction / Clan / Tradition" value={modalData.faction || ""}
                onChange={e => setModalData(d => ({ ...d, faction: e.target.value }))} />
            </div>
          </div>
          <select style={S.select} value={modalData.relationship || "Unknown"}
            onChange={e => setModalData(d => ({ ...d, relationship: e.target.value }))}>
            {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea style={{ ...S.textarea, minHeight: 60 }} placeholder="Description — who they are"
            value={modalData.description || ""} onChange={e => setModalData(d => ({ ...d, description: e.target.value }))} />
          {sectionLabel("👁 Appearance")}
          <textarea style={{ ...S.textarea, minHeight: 50 }} placeholder="Physical description, clothing, distinguishing features..."
            value={modalData.appearance || ""} onChange={e => setModalData(d => ({ ...d, appearance: e.target.value }))} />
          {sectionLabel("🎭 Personality")}
          <textarea style={{ ...S.textarea, minHeight: 50 }} placeholder="Demeanor, temperament, behavioral traits..."
            value={modalData.personality || ""} onChange={e => setModalData(d => ({ ...d, personality: e.target.value }))} />
          {sectionLabel("🕯 Backstory")}
          <textarea style={{ ...S.textarea, minHeight: 60 }} placeholder="Known history, origins, past events..."
            value={modalData.backstory || ""} onChange={e => setModalData(d => ({ ...d, backstory: e.target.value }))} />
          {sectionLabel("⚜ Motivations")}
          <textarea style={{ ...S.textarea, minHeight: 50 }} placeholder="Goals, desires, fears, agendas..."
            value={modalData.motivations || ""} onChange={e => setModalData(d => ({ ...d, motivations: e.target.value }))} />
          {sectionLabel("✦ Notes")}
          <textarea style={{ ...S.textarea, minHeight: 50 }} placeholder="Other details, GM notes..."
            value={modalData.notes || ""} onChange={e => setModalData(d => ({ ...d, notes: e.target.value }))} />
          {modalData.history?.length > 0 && (
            <div>
              {sectionLabel("📜 Session History")}
              <div style={{ marginTop: 6 }}>
                {modalData.history.map((h, i) => (
                  <div key={i} style={{ fontSize: 16, color: "#a09888", marginBottom: 4 }}>
                    <span style={{ color: accent }}>Session {h.session}:</span> {h.event}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button style={S.btnFilled(accent)} onClick={saveNPC}>
            {modalData.id ? "Update NPC" : "Add NPC"}
          </button>
        </div>
      </Modal>
      );
    }

    if (showModal === "viewLog") return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ ...S.cardHeader, color: accent }}>
              Session {modalData.number}{modalData.title ? ` — ${modalData.title}` : ""}
            </div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{modalData.date}</div>
          </div>
          <button style={S.btn("#6a3333")} onClick={() => deleteSession(modalData.id)}>Delete Session</button>
        </div>
        {modalData.summary && (
          <div style={{ ...S.card, background: `${accent}08`, border: `1px solid ${accent}20` }}>
            <div style={{ fontSize: 15, fontFamily: "'Cinzel', serif", letterSpacing: 2, color: accent, marginBottom: 6, textTransform: "uppercase" }}>Summary</div>
            <div style={{ fontSize: 18, lineHeight: 1.6, color: "#c4b599" }}>{modalData.summary}</div>
          </div>
        )}
        <div style={{ fontSize: 18, lineHeight: 1.7, color: "#ddd0b8", whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}>
          {stripMarkdown(modalData.logText)}
        </div>
      </Modal>
    );

    if (showModal === "editCharacter") return (
      <Modal onClose={() => { if (!parsing) { setShowModal(null); setModalData({}); } }}>
        <div style={{ ...S.cardHeader, color: accent }}>
          {parsing ? "Parsing Character..." : (modalData.id ? "Edit Character" : "New Character")}
        </div>
        {parsing ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ ...S.loading, width: 24, height: 24 }} />
            <div style={{ marginTop: 16, color: "#7a7068", fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: 2 }}>
              Reading the character's fate...
            </div>
          </div>
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Markdown upload zone */}
          <div style={{
            border: `2px dashed ${accent}30`, borderRadius: 6, padding: 16, textAlign: "center",
            cursor: "pointer", transition: "all 0.3s", background: modalData._rawMarkdown ? `${accent}08` : "transparent",
          }} onClick={() => characterFileRef.current?.click()}>
            <input ref={characterFileRef} type="file" accept=".md,.txt,.markdown" hidden
              onChange={modalData.id ? handleCharacterMarkdownUpdate : handleCharacterFileUpload} />
            <div style={{ fontSize: 24, marginBottom: 4 }}>📜</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, letterSpacing: 1, color: accent }}>
              {modalData._rawMarkdown
                ? "✓ Parsed from markdown — click to re-upload"
                : (modalData.id ? "Upload updated markdown (.md)" : "Import from Markdown (.md)")}
            </div>
            <div style={{ fontSize: 14, color: "#6a6058", marginTop: 2 }}>
              AI will extract name, clan, backstory, stats and more
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
              {modalData.avatar ? (
                <img src={modalData.avatar} alt="" style={{ width: 80, height: 80, borderRadius: 6, objectFit: "cover", border: `2px solid ${accent}40` }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 6, background: `${accent}10`, border: `2px solid ${accent}20`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", cursor: "pointer" }}>
                  <span style={{ fontSize: 24 }}>📷</span>
                  <span style={{ fontSize: 11, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: accent }}>PORTRAIT</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
            </div>
            <div style={{ flex: 1 }}>
              <input style={{ ...S.input, marginBottom: 10 }} placeholder="Character Name" value={modalData.name || ""}
                onChange={e => setModalData(d => ({ ...d, name: e.target.value }))} autoFocus />
              <input style={S.input} placeholder="Concept (e.g., Jaded Antiquarian)" value={modalData.concept || ""}
                onChange={e => setModalData(d => ({ ...d, concept: e.target.value }))} />
            </div>
          </div>
          <div style={S.grid2}>
            <input style={S.input} placeholder="Clan / Tradition" value={modalData.clan || ""}
              onChange={e => setModalData(d => ({ ...d, clan: e.target.value }))} />
            <input style={S.input} placeholder="Nature" value={modalData.nature || ""}
              onChange={e => setModalData(d => ({ ...d, nature: e.target.value }))} />
          </div>
          <input style={S.input} placeholder="Demeanor" value={modalData.demeanor || ""}
            onChange={e => setModalData(d => ({ ...d, demeanor: e.target.value }))} />
          <textarea style={{ ...S.textarea, minHeight: 150 }} placeholder="Backstory / Background (update anytime as more is revealed)"
            value={modalData.backstory || ""} onChange={e => setModalData(d => ({ ...d, backstory: e.target.value }))} />
          <textarea style={{ ...S.textarea, minHeight: 80 }} placeholder="Notes / Current status / Stats"
            value={modalData.notes || ""} onChange={e => setModalData(d => ({ ...d, notes: e.target.value }))} />
          {modalData._pendingNPCs?.length > 0 && (
            <div style={{ ...S.card, background: `${accent}08`, border: `1px solid ${accent}25`, padding: 14 }}>
              <div style={{ fontSize: 14, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: accent, marginBottom: 8, textTransform: "uppercase" }}>
                NPCs to be auto-created ({modalData._pendingNPCs.length})
              </div>
              {modalData._pendingNPCs.map((n, i) => (
                <div key={i} style={{ fontSize: 16, color: "#b0a090", marginBottom: 3 }}>
                  <span style={{ color: accent, marginRight: 6 }}>▸</span>
                  <strong style={{ color: "#e8dcc6" }}>{n.name}</strong>
                  {n.relationship && <span style={{ ...S.tag(accent), marginLeft: 8 }}>{n.relationship}</span>}
                </div>
              ))}
            </div>
          )}
          <button style={S.btnFilled(accent)} onClick={saveCharacter}>
            {modalData.id ? "Update Character" : "Create Character"}
          </button>
        </div>
        )}
      </Modal>
    );

    if (showModal === "recap") return (
      <Modal onClose={() => { setShowModal(null); setRecapText(null); }}>
        <div style={{ ...S.cardHeader, color: accent, textAlign: "center" }}>
          📺 Previously on "{activeChronicle?.name}"...
        </div>
        <div style={{ fontSize: 18, lineHeight: 1.8, color: "#c4b599", fontStyle: "italic", whiteSpace: "pre-wrap", padding: "8px 0" }}>
          {recapText}
        </div>
        <button style={S.btn(accent)} onClick={() => { setShowModal(null); setRecapText(null); }}>
          Close
        </button>
      </Modal>
    );

    if (showModal === "editThread") return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ ...S.cardHeader, color: accent }}>
          {modalData.id ? "Edit Thread" : "New Plot Thread"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={S.input} placeholder="Thread title — the hook or mystery" value={modalData.title || ""}
            onChange={e => setModalData(d => ({ ...d, title: e.target.value }))} autoFocus />
          <textarea style={{ ...S.textarea, minHeight: 60 }} placeholder="What's unresolved? What's the danger or question?"
            value={modalData.description || ""} onChange={e => setModalData(d => ({ ...d, description: e.target.value }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <select style={{ ...S.select, flex: 1 }} value={modalData.type || "mystery"}
              onChange={e => setModalData(d => ({ ...d, type: e.target.value }))}>
              <option value="mystery">❓ Mystery</option>
              <option value="danger">⚠ Danger</option>
              <option value="political">👑 Political</option>
              <option value="personal">💔 Personal</option>
              <option value="quest">⚔ Quest</option>
            </select>
            <select style={{ ...S.select, flex: 1 }} value={modalData.status || "active"}
              onChange={e => setModalData(d => ({ ...d, status: e.target.value }))}>
              {THREAD_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          {modalData.clues?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontFamily: "'Cinzel', serif", letterSpacing: 2, color: accent, textTransform: "uppercase", marginBottom: 4 }}>Clues & Developments</div>
              {modalData.clues.map((c, i) => (
                <div key={i} style={{ fontSize: 15, color: "#a09888", marginBottom: 3 }}>
                  <span style={{ color: accent }}>Session {c.session}:</span> {c.text}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea style={{ ...S.textarea, minHeight: 40, flex: 1 }} placeholder="Add a new clue or development..."
              value={modalData._newClue || ""} onChange={e => setModalData(d => ({ ...d, _newClue: e.target.value }))} />
            {modalData._newClue?.trim() && (
              <button style={{ ...S.btn(accent), whiteSpace: "nowrap", alignSelf: "flex-end" }} onClick={() => {
                const session = chronicleData?.sessions?.length || 0;
                setModalData(d => ({ ...d, clues: [...(d.clues || []), { session, text: d._newClue.trim() }], _newClue: "" }));
              }}>+ Clue</button>
            )}
          </div>
          <button style={S.btnFilled(accent)} onClick={saveThread}>
            {modalData.id ? "Update Thread" : "Create Thread"}
          </button>
        </div>
      </Modal>
    );

    if (showModal === "editClock") return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ ...S.cardHeader, color: accent }}>
          {modalData.id ? "Edit Clock" : "New Progress Clock"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <ProgressClock segments={modalData.segments || 6} filled={modalData.filled || 0} accent={accent} size={100} />
          <input style={{ ...S.input, width: "100%" }} placeholder="Clock name — what's ticking?" value={modalData.name || ""}
            onChange={e => setModalData(d => ({ ...d, name: e.target.value }))} autoFocus />
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: "#7a7068" }}>Segments</label>
              <input type="number" min={3} max={12} style={S.input} value={modalData.segments || 6}
                onChange={e => setModalData(d => ({ ...d, segments: Math.min(12, Math.max(3, parseInt(e.target.value) || 6)) }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: "#7a7068" }}>Filled</label>
              <input type="number" min={0} max={modalData.segments || 6} style={S.input} value={modalData.filled || 0}
                onChange={e => setModalData(d => ({ ...d, filled: Math.min(d.segments || 6, Math.max(0, parseInt(e.target.value) || 0)) }))} />
            </div>
          </div>
          <select style={{ ...S.select, width: "100%" }} value={modalData.type || "threat"}
            onChange={e => setModalData(d => ({ ...d, type: e.target.value }))}>
            <option value="threat">🔥 Threat</option>
            <option value="scheme">🕸 Scheme</option>
            <option value="countdown">⏰ Countdown</option>
            <option value="ritual">🕯 Ritual</option>
          </select>
          <button style={{ ...S.btnFilled(accent), width: "100%" }} onClick={saveClock}>
            {modalData.id ? "Update Clock" : "Create Clock"}
          </button>
        </div>
      </Modal>
    );

    if (showModal === "editFaction") return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ ...S.cardHeader, color: accent }}>
          {modalData.id ? "Edit Faction" : "New Faction"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={S.input} placeholder="Faction name" value={modalData.name || ""}
            onChange={e => setModalData(d => ({ ...d, name: e.target.value }))} autoFocus />
          <textarea style={{ ...S.textarea, minHeight: 60 }} placeholder="Description — who they are, what they represent"
            value={modalData.description || ""} onChange={e => setModalData(d => ({ ...d, description: e.target.value }))} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: "#7a7068" }}>Attitude to Coterie</label>
              <select style={S.select} value={modalData.attitude || "Neutral"}
                onChange={e => setModalData(d => ({ ...d, attitude: e.target.value }))}>
                {ATTITUDE_LEVELS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: "#7a7068" }}>Influence</label>
              <select style={S.select} value={modalData.influence || "Notable"}
                onChange={e => setModalData(d => ({ ...d, influence: e.target.value }))}>
                {INFLUENCE_LEVELS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <input style={S.input} placeholder="Territory — where they operate" value={modalData.territory || ""}
            onChange={e => setModalData(d => ({ ...d, territory: e.target.value }))} />
          <textarea style={{ ...S.textarea, minHeight: 50 }} placeholder="Goals — what they want, their agenda"
            value={modalData.goals || ""} onChange={e => setModalData(d => ({ ...d, goals: e.target.value }))} />
          <input style={S.input} placeholder="Key members (comma-separated)" value={(modalData.members || []).join(", ")}
            onChange={e => setModalData(d => ({ ...d, members: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))} />
          <button style={S.btnFilled(accent)} onClick={saveFaction}>
            {modalData.id ? "Update Faction" : "Create Faction"}
          </button>
        </div>
      </Modal>
    );

    if (showModal === "editLocation") return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ ...S.cardHeader, color: accent }}>
          {modalData.id ? "Edit Location" : "New Location"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={S.input} placeholder="Location name" value={modalData.name || ""}
            onChange={e => setModalData(d => ({ ...d, name: e.target.value }))} autoFocus />
          <select style={S.select} value={modalData.type || "other"}
            onChange={e => setModalData(d => ({ ...d, type: e.target.value }))}>
            <option value="haven">🏚 Haven</option>
            <option value="elysium">🏛 Elysium</option>
            <option value="bar">🍷 Bar / Club</option>
            <option value="street">🌃 Street / District</option>
            <option value="leyNode">✨ Ley Node / Sanctum</option>
            <option value="church">⛪ Church / Temple</option>
            <option value="graveyard">⚰ Graveyard / Crypt</option>
            <option value="warehouse">🏭 Warehouse / Industrial</option>
            <option value="mansion">🏰 Mansion / Estate</option>
            <option value="other">📍 Other</option>
          </select>
          <textarea style={{ ...S.textarea, minHeight: 60 }} placeholder="Description — what this place is"
            value={modalData.description || ""} onChange={e => setModalData(d => ({ ...d, description: e.target.value }))} />
          <input style={S.input} placeholder="Controlled by — faction or NPC" value={modalData.controlledBy || ""}
            onChange={e => setModalData(d => ({ ...d, controlledBy: e.target.value }))} />
          <textarea style={{ ...S.textarea, minHeight: 40 }} placeholder="Atmosphere — mood, feel, sensory details"
            value={modalData.atmosphere || ""} onChange={e => setModalData(d => ({ ...d, atmosphere: e.target.value }))} />
          <textarea style={{ ...S.textarea, minHeight: 40 }} placeholder="🔒 Secrets — hidden info, GM notes"
            value={modalData.secrets || ""} onChange={e => setModalData(d => ({ ...d, secrets: e.target.value }))} />
          <textarea style={{ ...S.textarea, minHeight: 40 }} placeholder="Notes"
            value={modalData.notes || ""} onChange={e => setModalData(d => ({ ...d, notes: e.target.value }))} />
          <button style={S.btnFilled(accent)} onClick={saveLocation}>
            {modalData.id ? "Update Location" : "Create Location"}
          </button>
        </div>
      </Modal>
    );

    if (showModal === "settings") return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ ...S.cardHeader, color: accent }}>API Settings</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: "#b0a890", fontSize: 13, display: "block", marginBottom: 4 }}>Anthropic API Key</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...S.input, flex: 1, fontFamily: "'Fira Code', monospace", fontSize: 13 }}
                type={modalData._showKey ? "text" : "password"} placeholder="sk-ant-api03-..."
                value={modalData.apiKey || ""}
                onChange={e => setModalData(d => ({ ...d, apiKey: e.target.value, _testResult: null }))} autoFocus />
              <button style={{ ...S.bgBtn(false), padding: "6px 10px", fontSize: 16, cursor: "pointer" }}
                title={modalData._showKey ? "Hide key" : "Show key"}
                onClick={() => setModalData(d => ({ ...d, _showKey: !d._showKey }))}>
                {modalData._showKey ? "\u{1F441}" : "\u{1F512}"}
              </button>
            </div>
            <p style={{ color: "#8a8070", fontSize: 11, margin: "4px 0 0" }}>
              Get your key at <span style={{ color: accent }}>console.anthropic.com/settings/keys</span>
            </p>
          </div>
          <div>
            <label style={{ color: "#b0a890", fontSize: 13, display: "block", marginBottom: 4 }}>CORS Proxy URL <span style={{ color: "#6a6050", fontSize: 11 }}>(optional override)</span></label>
            <input style={{ ...S.input, fontFamily: "'Fira Code', monospace", fontSize: 12 }}
              type="text" placeholder="/api/claude/v1/messages"
              value={modalData.proxyUrl || ""}
              onChange={e => setModalData(d => ({ ...d, proxyUrl: e.target.value, _testResult: null }))} />
            <p style={{ color: "#8a8070", fontSize: 11, margin: "4px 0 0" }}>
              The built-in proxy handles CORS automatically. Leave blank — it just works. Only change this if you deploy the app elsewhere.
            </p>
          </div>
          {modalData._testResult && (
            <div style={{
              padding: "8px 12px", borderRadius: 6, fontSize: 13,
              background: modalData._testResult.ok ? "rgba(74,140,63,0.15)" : "rgba(196,30,58,0.15)",
              color: modalData._testResult.ok ? "#4a8c3f" : "#c41e3a",
              border: `1px solid ${modalData._testResult.ok ? "rgba(74,140,63,0.3)" : "rgba(196,30,58,0.3)"}`,
            }}>
              {modalData._testResult.ok ? "\u2713 " : "\u2717 "}{modalData._testResult.msg}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btnFilled(accent), flex: 1 }} onClick={async () => {
              const key = (modalData.apiKey || "").trim();
              const proxy = (modalData.proxyUrl || "").trim();
              if (!key) { setModalData(d => ({ ...d, _testResult: { ok: false, msg: "Please enter an API key." } })); return; }
              setModalData(d => ({ ...d, _testResult: { ok: true, msg: "Testing connection..." } }));
              try {
                await callClaude(key, [{ role: "user", content: "Say OK" }], { maxTokens: 8, proxyUrl: proxy || undefined });
                setModalData(d => ({ ...d, _testResult: { ok: true, msg: "Connection successful! API key is valid." } }));
              } catch (e) {
                setModalData(d => ({ ...d, _testResult: { ok: false, msg: e.message } }));
              }
            }}>Test Connection</button>
            <button style={{ ...S.btnFilled(accent), flex: 1 }} onClick={async () => {
              const key = (modalData.apiKey || "").trim();
              const proxy = (modalData.proxyUrl || "").trim();
              setApiKey(key);
              setProxyUrl(proxy);
              await storageSet("wod-api-key", key);
              await storageSet("wod-proxy-url", proxy);
              setShowModal(null); setModalData({});
            }}>Save Settings</button>
          </div>
        </div>
      </Modal>
    );
    return null;
  };

  const handleSplashSelect = async (gameId) => {
    if (selectedSplashCard) return; // Prevent double-click during transition
    // Step 1: Select the card (colors it)
    setSelectedSplashCard(gameId);
    // Audio: trigger game-line transition sting
    audio.onGameLineSelect(gameId);
    // Step 2: After a brief pause, trigger the themed transition overlay
    setTimeout(() => {
      setSplashTransition(gameId);
      // Step 3: After the transition animation plays (1.125s), navigate
      setTimeout(async () => {
        setActiveGameType(gameId);
        await storageSet("wod-active-game-type", gameId);
        setShowSplash(false);
        audio.onSplashExit();
        setSplashTransition(null);
        setSelectedSplashCard(null);
        // Filter chronicles for this game type
        const matching = chronicles.filter(c => c.gameType === gameId);
        if (matching.length === 0 && chronicles.length === 0) {
          // Smooth delayed entrance — let the database screen settle first
          setTimeout(() => {
            setModalData({ gameType: gameId });
            setModalEntrance(true);
            setShowModal("newChronicle");
          }, 500);
        } else if (matching.length > 0) {
          saveBeforeSwitch();
          setActiveChronicleId(matching[0].id);
        }
      }, 1125);
    }, 600);
  };


  const renderConfirmModal = () => {
    if (!confirmAction) return null;
    return (
      <div style={{ ...S.modal, zIndex: 1100 }} onClick={() => setConfirmAction(null)}>
        <div style={{ ...S.modalContent, maxWidth: 440, textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 18, lineHeight: 1.6, color: "#e8dcc6", marginBottom: 24 }}>
            {confirmAction.msg}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button style={S.btn("#6a6058")} onClick={() => setConfirmAction(null)}>Cancel</button>
            <button style={{ ...S.btnFilled("#c41e3a"), background: "rgba(196,30,58,0.25)" }}
              onClick={confirmAction.onConfirm}>Delete</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      ...S.app,
      ...(bgImage ? {
        backgroundImage: `linear-gradient(180deg, rgba(8,8,13,0.72) 0%, rgba(13,13,20,0.78) 40%, rgba(10,10,18,0.84) 100%), url("${bgImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      } : {}),
    }}>
      <style>{`
        @import url('${FONTS_URL}');
        @keyframes wod-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a12; }
        ::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 3px; }
        ::selection { background: ${accent}40; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: ${accent}60; }
        button:hover { opacity: 0.85; }
      `}</style>
      {showSplash && <SplashScreen
        splashPhase={splashPhase} setSplashPhase={setSplashPhase}
        selectedSplashCard={selectedSplashCard} splashTransition={splashTransition}
        activeGameType={activeGameType} chronicles={chronicles}
        setShowSplash={setShowSplash} setShowModal={setShowModal} setModalData={setModalData}
        apiKey={apiKey} proxyUrl={proxyUrl}
        onSplashSelect={handleSplashSelect}
        audio={audio}
      />}
      {!bgImage && <div style={S.noiseOverlay} />}
      <div style={S.content}>
        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>World of Darkness</h1>
          <div style={S.subtitle}>Chronicle Database</div>
          {/* Background controls */}
          <div style={S.bgBar}>
            <button style={{ ...S.bgBtn(false), letterSpacing: 1.5, fontFamily: "'Cinzel', serif", fontSize: 11 }}
              onClick={() => { saveBeforeSwitch(); setShowSplash(true); setSplashPhase("select"); }}>
              ◈ Selection Menu
            </button>
            <AudioControl audio={audio} />
          </div>
        </div>

        {/* Chronicle Selector — filtered by active game type */}
        <div style={S.chronicleBar}>
          {(() => {
            const filtered = activeGameType ? chronicles.filter(c => c.gameType === activeGameType) : chronicles;
            return filtered.length > 0 && (
              <select style={S.select} value={activeChronicleId || ""}
                onChange={e => { saveBeforeSwitch(); setActiveChronicleId(e.target.value); setActiveTab("dashboard"); }}>
                {filtered.map(c => {
                  const gt = GAME_TYPES.find(g => g.id === c.gameType);
                  return <option key={c.id} value={c.id}>{gt?.icon} {c.name}</option>;
                })}
              </select>
            );
          })()}
          <button style={S.btnFilled(accent)} onClick={() => { setModalData({ gameType: activeGameType || "vtm" }); setShowModal("newChronicle"); }}>
            + New Chronicle
          </button>
        </div>

        {/* Tabs */}
        {activeChronicle && (
          <div style={S.tabs}>
            {TABS.map(t => (
              <div key={t.id} style={S.tab(activeTab === t.id, accent)}
                onClick={() => { setActiveTab(t.id); audio.onTabChange(); }}>
                <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
              </div>
            ))}
          </div>
        )}

        {/* Parse Status Banner */}
        {parseStatus && (
          <div style={{
            padding: "12px 18px", marginBottom: 16, borderRadius: 6,
            background: parseStatus.type === "success" ? "rgba(74,140,63,0.15)" : "rgba(196,30,58,0.15)",
            border: `1px solid ${parseStatus.type === "success" ? "#4a8c3f40" : "#c41e3a40"}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 16, color: parseStatus.type === "success" ? "#8bc47a" : "#e88080" }}>
              {parseStatus.type === "success" ? "✓ " : "⚠ "}{parseStatus.msg}
            </span>
            <button onClick={() => setParseStatus(null)} style={{
              background: "none", border: "none", color: "#6a6058", cursor: "pointer", fontSize: 16,
            }}>✕</button>
          </div>
        )}

        {/* Content */}
        {activeTab === "dashboard" && renderDashboard()}
        {activeTab === "sessions" && renderSessions()}
        {activeTab === "npcs" && renderNPCs()}
        {activeTab === "characters" && renderCharacters()}
        {activeTab === "factions" && renderFactions()}
        {activeTab === "locations" && renderLocations()}
        {activeTab === "threads" && renderThreads()}
        {activeTab === "timeline" && renderTimeline()}
      </div>

      {/* Modals — rendered outside S.content so they aren't trapped in its stacking context */}
      {renderModals()}
      {renderConfirmModal()}
    </div>
  );
}
