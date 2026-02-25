import { S } from "../styles.js";

export default function SessionCard({ session, accent, index, onView, onDelete }) {
  return (
    <div style={{ ...S.card, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 600, letterSpacing: 1, color: "#f0e6d4" }}>
            Session {session.number}{session.title ? ` — ${session.title}` : ""}
          </div>
          <div style={{ ...S.muted, fontSize: 20, marginTop: 2 }}>{session.date}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {session.mood && <span style={S.tag(accent)}>{session.mood}</span>}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
              style={{ background: "none", border: "none", color: "#4a4a58", cursor: "pointer", fontSize: 18, padding: 4 }}
              title="Delete session">✕</button>
          )}
        </div>
      </div>
      {session.summary && (
        <div style={{ marginTop: 10, fontSize: 23, lineHeight: 1.6, color: "#d4c8ae" }}>
          {session.summary}
        </div>
      )}
      {session.storyBeats?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {session.storyBeats.map((b, i) => (
            <div key={i} style={{ fontSize: 21, color: "#c4b49e", marginBottom: 4 }}>
              <span style={{ color: accent, marginRight: 8 }}>▸</span>{b}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button style={S.btn(accent)} onClick={() => onView(session)}>View Full Log</button>
      </div>
    </div>
  );
}
