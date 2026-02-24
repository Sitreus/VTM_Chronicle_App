import { useCallback } from "react";
import { GAME_TYPES } from "../constants.js";
import { storageSet } from "../utils/storage.js";
import { callClaude, repairJSON, parseCharacterMarkdown, stripMarkdown } from "../utils/claude.js";
import { useChronicle } from "../context/ChronicleContext.jsx";

export default function useChronicleActions() {
  const ctx = useChronicle();
  const {
    chronicles, activeChronicleId, chronicleData, activeChronicle, activeGameType,
    apiKey, proxyUrl, accent,
    showModal, modalData,
    setChronicles, setActiveChronicleId, setChronicleData,
    setShowModal, setModalData, setParsing, setParseStatus, setRecapText,
    setConfirmAction,
    saveBeforeSwitch, saveChronicles, saveChronicleData,
    activeChronicleIdRef, chronicleDataRef,
    fileInputRef, sessionFileRef, characterFileRef,
  } = ctx;

  // ─── Chronicle CRUD ─────
  const createChronicle = useCallback(async () => {
    const { name, gameType: gt, description } = modalData;
    if (!name?.trim()) return;
    const id = `chr-${Date.now()}`;
    const newChr = { id, name: name.trim(), gameType: gt || "vtm", description: description || "", createdAt: new Date().toISOString() };
    const emptyData = { sessions: [], npcs: [], characters: [], storyBeats: [] };
    await storageSet(`wod-chr-${id}`, emptyData);
    await saveBeforeSwitch();
    const newList = [...chronicles, newChr];
    // Set all state together so React batches them in one render
    setChronicleData(emptyData);
    setActiveChronicleId(id);
    setShowModal(null);
    setModalData({});
    await saveChronicles(newList);
  }, [modalData, chronicles, saveChronicles, saveBeforeSwitch, setActiveChronicleId, setChronicleData, setShowModal, setModalData]);

  const deleteChronicle = useCallback(async () => {
    if (!activeChronicleId || !activeChronicle) return;
    const idToDelete = activeChronicleId;
    const nameToDelete = activeChronicle.name;
    setConfirmAction({
      msg: `Delete chronicle "${nameToDelete}" and ALL its sessions, NPCs, characters, and story beats? This cannot be undone.`,
      onConfirm: async () => {
        try { await window.storage.delete(`wod-chr-${idToDelete}`); } catch {}
        const newList = chronicles.filter(c => c.id !== idToDelete);
        await saveChronicles(newList);
        const sameType = activeGameType ? newList.filter(c => c.gameType === activeGameType) : newList;
        setActiveChronicleId(sameType.length > 0 ? sameType[0].id : null);
        setConfirmAction(null);
      }
    });
  }, [activeChronicleId, activeChronicle, activeGameType, chronicles, saveChronicles, setActiveChronicleId, setConfirmAction]);

  const deleteSession = useCallback(async (sessionId) => {
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
        const newBeats = (currentData.storyBeats || [])
          .filter(b => b.session !== deletedNum)
          .map(b => b.session > deletedNum ? { ...b, session: b.session - 1 } : b);
        const newThreads = (currentData.plotThreads || []).map(t => ({
          ...t,
          session: t.session > deletedNum ? t.session - 1 : (t.session === deletedNum ? null : t.session),
          clues: (t.clues || []).map(c => ({
            ...c, session: c.session > deletedNum ? c.session - 1 : c.session,
          })),
        }));
        const newClocks = (currentData.clocks || []).map(c => ({ ...c }));
        await saveChronicleData({ ...currentData, sessions: renumbered, storyBeats: newBeats, plotThreads: newThreads, clocks: newClocks });
        setConfirmAction(null);
        if (ctx.showModal === "viewLog") { setShowModal(null); setModalData({}); }
      }
    });
  }, [chronicleData, chronicleDataRef, saveChronicleData, setConfirmAction, setShowModal, setModalData, ctx.showModal]);

  // ─── Session Management ─────
  const addSession = useCallback(async () => {
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

      const newNPCs = (parsed.newNPCs || []).map(n => ({
        id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: n.name, description: n.description || "", relationship: n.relationship || "Unknown",
        faction: n.faction || "", notes: n.notes || "", avatar: null,
        personality: n.personality || "", backstory: n.backstory || "",
        appearance: n.appearance || "", motivations: n.motivations || "",
        firstSeen: sessionNum, lastSeen: sessionNum,
        history: [{ session: sessionNum, event: `First encountered. ${n.notes || ""}` }],
      }));

      const updatedNpcs = [...(chronicleData.npcs || [])];
      (parsed.updatedNPCs || []).forEach(upd => {
        const idx = updatedNpcs.findIndex(n => n.name.toLowerCase() === upd.name.toLowerCase());
        if (idx >= 0) {
          const existing = updatedNpcs[idx];
          const deepen = (existing, addition, sep = ". ") => {
            if (!addition) return existing || "";
            if (!existing) return addition;
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

      const newBeats = (parsed.storyBeats || []).map(b => ({
        id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        session: sessionNum, text: b, date: newSession.date,
      }));

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

      const updatedFactions = [...(chronicleData.factions || [])];
      (parsed.factionMentions || []).forEach(fm => {
        const idx = updatedFactions.findIndex(f => f.name.toLowerCase() === fm.name.toLowerCase());
        if (idx >= 0) {
          const ex = updatedFactions[idx];
          updatedFactions[idx] = {
            ...ex,
            ...(fm.attitude && fm.attitude !== ex.attitude ? { attitude: fm.attitude } : {}),
            ...(fm.goals && !ex.goals ? { goals: fm.goals } : {}),
          };
        } else {
          updatedFactions.push({
            id: `fac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: fm.name, description: fm.description || "", attitude: fm.attitude || "Neutral",
            goals: fm.goals || "", territory: fm.territory || "", influence: "Notable", members: [],
          });
        }
      });

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
  }, [modalData, chronicleData, apiKey, proxyUrl, activeChronicle, saveChronicleData, setParsing, setParseStatus, setShowModal, setModalData]);

  // ─── NPC Management ─────
  const saveNPC = useCallback(async () => {
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
  }, [modalData, chronicleData, saveChronicleData, setShowModal, setModalData]);

  const deleteNPC = useCallback(async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, npcs: (chronicleData.npcs || []).filter(n => n.id !== id) });
  }, [chronicleData, saveChronicleData]);

  const handleAvatarUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setModalData(d => ({ ...d, avatar: reader.result }));
    reader.readAsDataURL(file);
  }, [setModalData]);

  // ─── "Previously on..." Recap ─────
  const generateRecap = useCallback(async () => {
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
  }, [chronicleData, apiKey, proxyUrl, activeChronicle, setParsing, setRecapText, setShowModal, setParseStatus]);

  // ─── Thread Management ─────
  const saveThread = useCallback(async () => {
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
  }, [modalData, chronicleData, saveChronicleData, setShowModal, setModalData]);

  const deleteThread = useCallback(async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, plotThreads: (chronicleData.plotThreads || []).filter(t => t.id !== id) });
  }, [chronicleData, saveChronicleData]);

  const cycleThreadStatus = useCallback(async (id) => {
    if (!chronicleData) return;
    const threads = [...(chronicleData.plotThreads || [])];
    const idx = threads.findIndex(t => t.id === id);
    if (idx < 0) return;
    const order = ["active", "cold", "resolved"];
    const cur = order.indexOf(threads[idx].status);
    if (cur < 0) return;
    threads[idx] = { ...threads[idx], status: order[(cur + 1) % 3] };
    await saveChronicleData({ ...chronicleData, plotThreads: threads });
  }, [chronicleData, saveChronicleData]);

  // ─── Clock Management ─────
  const saveClock = useCallback(async () => {
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
  }, [modalData, chronicleData, saveChronicleData, setShowModal, setModalData]);

  const advanceClock = useCallback(async (id, amount = 1) => {
    if (!chronicleData) return;
    const clocks = [...(chronicleData.clocks || [])];
    const idx = clocks.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newFilled = Math.max(0, Math.min(clocks[idx].filled + amount, clocks[idx].segments));
    clocks[idx] = { ...clocks[idx], filled: newFilled };
    await saveChronicleData({ ...chronicleData, clocks });
  }, [chronicleData, saveChronicleData]);

  const deleteClock = useCallback(async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, clocks: (chronicleData.clocks || []).filter(c => c.id !== id) });
  }, [chronicleData, saveChronicleData]);

  // ─── Faction Management ─────
  const saveFaction = useCallback(async () => {
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
  }, [modalData, chronicleData, saveChronicleData, setShowModal, setModalData]);

  const deleteFaction = useCallback(async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, factions: (chronicleData.factions || []).filter(f => f.id !== id) });
  }, [chronicleData, saveChronicleData]);

  // ─── Location Management ─────
  const saveLocation = useCallback(async () => {
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
  }, [modalData, chronicleData, saveChronicleData, setShowModal, setModalData]);

  const deleteLocation = useCallback(async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, locationDossiers: (chronicleData.locationDossiers || []).filter(l => l.id !== id) });
  }, [chronicleData, saveChronicleData]);

  // ─── Export Chronicle ─────
  const exportChronicle = useCallback(() => {
    if (!chronicleData || !activeChronicle) return;
    const cd = chronicleData;
    const lines = [];
    lines.push(`# ${activeChronicle.name}`);
    lines.push(`*${GAME_TYPES.find(g => g.id === activeChronicle.gameType)?.label || activeChronicle.gameType}*\n`);
    if (activeChronicle.description) lines.push(`> ${activeChronicle.description}\n`);

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
  }, [chronicleData, activeChronicle]);

  // Read text file helper
  const readTextFile = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  }), []);

  // Session markdown upload
  const handleSessionFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readTextFile(file);
    const title = file.name.replace(/\.(md|txt|markdown)$/i, "").replace(/[-_]/g, " ");
    setModalData(d => ({ ...d, logText: text, title: d.title || title }));
    e.target.value = "";
  }, [readTextFile, setModalData]);

  // Character markdown upload
  const handleCharacterFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readTextFile(file);
    if (!apiKey) { setParseStatus({ type: "error", msg: "API key required. Open Settings (⚙) to add your Anthropic API key." }); setParsing(false); return; }
    setParsing(true);
    setModalData(d => ({ ...d, _rawMarkdown: text }));

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
      setModalData(d => ({ ...d, backstory: stripMarkdown(text), _rawMarkdown: text }));
    }
    setParsing(false);
    e.target.value = "";
  }, [readTextFile, apiKey, proxyUrl, activeChronicle, setModalData, setParsing, setParseStatus]);

  // Re-parse character from updated markdown
  const handleCharacterMarkdownUpdate = useCallback(async (e) => {
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
  }, [readTextFile, chronicleData, apiKey, proxyUrl, activeChronicle, setModalData, setParsing, setParseStatus]);

  // ─── Character Management ─────
  const saveCharacter = useCallback(async () => {
    const ch = modalData;
    if (!ch?.name?.trim() || !chronicleData) return;
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

    let newNpcs = [...(chronicleData.npcs || [])];
    if (_pendingNPCs?.length > 0) {
      _pendingNPCs.forEach(n => {
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
  }, [modalData, chronicleData, saveChronicleData, setShowModal, setModalData]);

  const deleteCharacter = useCallback(async (id) => {
    if (!chronicleData) return;
    await saveChronicleData({ ...chronicleData, characters: (chronicleData.characters || []).filter(c => c.id !== id) });
  }, [chronicleData, saveChronicleData]);

  return {
    createChronicle, deleteChronicle, deleteSession,
    addSession, saveNPC, deleteNPC,
    handleAvatarUpload, generateRecap,
    saveThread, deleteThread, cycleThreadStatus,
    saveClock, advanceClock, deleteClock,
    saveFaction, deleteFaction,
    saveLocation, deleteLocation,
    exportChronicle,
    handleSessionFileUpload, handleCharacterFileUpload, handleCharacterMarkdownUpdate,
    saveCharacter, deleteCharacter,
  };
}
