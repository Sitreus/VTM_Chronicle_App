import { memo } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";
import ProgressClock from "../components/ProgressClock.jsx";

export default memo(function ThreadsTab() {
  const { chronicleData, accent, setModalData, setShowModal } = useChronicle();
  const { advanceClock, deleteClock, cycleThreadStatus, deleteThread } = useChronicleActions();

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
});
