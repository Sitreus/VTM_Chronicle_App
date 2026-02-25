import { useState } from "react";
import { GAME_TYPES, RELATIONSHIP_TYPES, THREAD_STATUSES, ATTITUDE_LEVELS, INFLUENCE_LEVELS } from "../constants.js";
import { S } from "../styles.js";
import { callClaude, diagnoseConnection } from "../utils/claude.js";
import { stripMarkdown } from "../utils/claude.js";
import { storageSet } from "../utils/storage.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import Modal from "../components/Modal.jsx";
import ProgressClock from "../components/ProgressClock.jsx";
import PrintView from "../components/PrintView.jsx";

export default function ChronicleModals() {
  const ctx = useChronicle();
  const {
    showModal, modalData, setShowModal, setModalData,
    accent, parsing, activeChronicle, activeGameType, activeChronicleId,
    modalEntrance, setModalEntrance, recapText, setRecapText,
    chronicleData, apiKey, setApiKey, proxyUrl, setProxyUrl,
    fileInputRef, sessionFileRef, characterFileRef,
  } = ctx;
  const actions = useChronicleActions();

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
        <button style={S.btnFilled(accent)} onClick={actions.createChronicle}>Create Chronicle</button>
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
          <div style={{
            border: `2px dashed ${accent}30`, borderRadius: 6, padding: 20, textAlign: "center",
            cursor: "pointer", transition: "all 0.3s", background: modalData.logText ? `${accent}08` : "transparent",
          }} onClick={() => sessionFileRef.current?.click()}>
            <input ref={sessionFileRef} type="file" accept=".md,.txt,.markdown" hidden onChange={actions.handleSessionFileUpload} />
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
          <button style={S.btnFilled(accent)} onClick={actions.addSession}>Submit Session</button>
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
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={actions.handleAvatarUpload} />
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
          <button style={S.btnFilled(accent)} onClick={actions.saveNPC}>
            {modalData.id ? "Update NPC" : "Add NPC"}
          </button>
        </div>
      </Modal>
    );
  }

  if (showModal === "viewLog") {
    const isEditing = modalData._editing;
    return (
      <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ ...S.cardHeader, color: accent }}>
              Session {modalData.number}{modalData.title ? ` — ${modalData.title}` : ""}
            </div>
            <div style={{ ...S.muted, marginBottom: 12 }}>{modalData.date}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={S.btn(accent)}
              onClick={() => {
                if (isEditing) {
                  // Save edits
                  actions.updateSessionNotes(modalData.id, {
                    title: modalData.title,
                    summary: modalData.summary,
                  });
                  setModalData(d => ({ ...d, _editing: false }));
                } else {
                  setModalData(d => ({ ...d, _editing: true }));
                }
              }}>
              {isEditing ? "💾 Save" : "✎ Edit"}
            </button>
            <button style={S.btn("#6a3333")} onClick={() => actions.deleteSession(modalData.id)}>Delete</button>
          </div>
        </div>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={S.input} placeholder="Session Title" value={modalData.title || ""}
              onChange={e => setModalData(d => ({ ...d, title: e.target.value }))} />
            <textarea style={{ ...S.textarea, minHeight: 80 }} placeholder="Summary"
              value={modalData.summary || ""}
              onChange={e => setModalData(d => ({ ...d, summary: e.target.value }))} />
          </div>
        ) : (
          <>
            {modalData.summary && (
              <div style={{ ...S.card, background: `${accent}08`, border: `1px solid ${accent}20` }}>
                <div style={{ fontSize: 15, fontFamily: "'Cinzel', serif", letterSpacing: 2, color: accent, marginBottom: 6, textTransform: "uppercase" }}>Summary</div>
                <div style={{ fontSize: 18, lineHeight: 1.6, color: "#c4b599" }}>{modalData.summary}</div>
              </div>
            )}
          </>
        )}
        {modalData.storyBeats?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 14, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: accent, marginBottom: 4 }}>STORY BEATS</div>
            {modalData.storyBeats.map((b, i) => (
              <div key={i} style={{ fontSize: 16, color: "#c4b49e", marginBottom: 3 }}>
                <span style={{ color: accent, marginRight: 6 }}>▸</span>{b}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 18, lineHeight: 1.7, color: "#ddd0b8", whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}>
          {stripMarkdown(modalData.logText)}
        </div>
      </Modal>
    );
  }

  if (showModal === "printView") return (
    <Modal onClose={() => { setShowModal(null); setModalData({}); }}>
      <PrintView
        chronicle={activeChronicle}
        chronicleData={chronicleData}
        accent={accent}
        onClose={() => { setShowModal(null); setModalData({}); }}
      />
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
          <div style={{
            border: `2px dashed ${accent}30`, borderRadius: 6, padding: 16, textAlign: "center",
            cursor: "pointer", transition: "all 0.3s", background: modalData._rawMarkdown ? `${accent}08` : "transparent",
          }} onClick={() => characterFileRef.current?.click()}>
            <input ref={characterFileRef} type="file" accept=".md,.txt,.markdown" hidden
              onChange={modalData.id ? actions.handleCharacterMarkdownUpdate : actions.handleCharacterFileUpload} />
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
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={actions.handleAvatarUpload} />
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
          <button style={S.btnFilled(accent)} onClick={actions.saveCharacter}>
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
        <button style={S.btnFilled(accent)} onClick={actions.saveThread}>
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
        <button style={{ ...S.btnFilled(accent), width: "100%" }} onClick={actions.saveClock}>
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
        <button style={S.btnFilled(accent)} onClick={actions.saveFaction}>
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
        <button style={S.btnFilled(accent)} onClick={actions.saveLocation}>
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
        {modalData._diagSteps && modalData._diagSteps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {modalData._diagSteps.map((s, i) => (
              <div key={i} style={{
                padding: "6px 10px", borderRadius: 4, fontSize: 12,
                fontFamily: "'Fira Code', monospace",
                background: s.ok ? "rgba(74,140,63,0.1)" : "rgba(196,30,58,0.1)",
                border: `1px solid ${s.ok ? "rgba(74,140,63,0.2)" : "rgba(196,30,58,0.2)"}`,
                color: s.ok ? "#6aaa5a" : "#d06060",
              }}>
                {s.ok ? "\u2713" : "\u2717"} <strong>{s.step}</strong>: {s.detail}
              </div>
            ))}
          </div>
        )}
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
            setModalData(d => ({ ...d, _testResult: { ok: true, msg: "Diagnosing connection..." }, _diagSteps: [] }));
            const result = await diagnoseConnection(key, proxy || undefined);
            setModalData(d => ({
              ...d,
              _diagSteps: result.steps,
              _testResult: { ok: result.ok, msg: result.summary },
            }));
          }}>Diagnose Connection</button>
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
}
