import { memo, useMemo } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";
import SessionCard from "../components/SessionCard.jsx";
import NPCCard from "../components/NPCCard.jsx";
import ProgressClock from "../components/ProgressClock.jsx";

export default memo(function DashboardTab() {
  const { activeChronicle, chronicleData, accent, gameType, parsing, setModalData, setShowModal } = useChronicle();
  const { generateRecap, exportChronicle, deleteChronicle, deleteSession, deleteNPC, advanceClock, deleteClock } = useChronicleActions();

  const cd = chronicleData || { sessions: [], npcs: [], characters: [], storyBeats: [], plotThreads: [], clocks: [] };
  const activeThreads = useMemo(() => (cd.plotThreads || []).filter(t => t.status === "active").length, [cd.plotThreads]);
  const activeThreadsList = useMemo(() => (cd.plotThreads || []).filter(t => t.status === "active").slice(0, 4), [cd.plotThreads]);

  if (!activeChronicle) return <EmptyState text="Create a chronicle to begin" />;

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
              <div style={{ fontSize: 20, fontFamily: "'Cinzel', serif", letterSpacing: 2, color: "#a09888", textTransform: "uppercase" }}>{s.label}</div>
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
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: 1, color: "#e8dcc6", marginTop: 8 }}>{c.name}</div>
                <div style={{ fontSize: 16, color: "#7a7068", textTransform: "uppercase", letterSpacing: 1 }}>{c.type || "threat"}</div>
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
      {activeThreadsList.length > 0 && (
        <div>
          <div style={{ ...S.cardHeader, color: accent, marginTop: 12 }}>Active Threads</div>
          {activeThreadsList.map(t => (
            <div key={t.id} style={{ ...S.card, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 23, color: "#f0e6d4" }}>{t.title}</span>
                {t.description && <div style={{ fontSize: 22, color: "#b0a490", marginTop: 2 }}>{t.description}</div>}
              </div>
              <span style={{ ...S.tag(accent), fontSize: 14 }}>{t.type || "mystery"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
