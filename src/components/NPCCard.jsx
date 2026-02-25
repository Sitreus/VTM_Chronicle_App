import { S } from "../styles.js";

export default function NPCCard({ npc, accent, onEdit, onDelete }) {
  const profileField = (icon, label, value) => value ? (
    <div style={{ marginTop: 8, fontSize: 23, lineHeight: 1.5, color: "#b0a490" }}>
      <span style={{ color: accent, fontSize: 18, fontFamily: "'Cinzel', serif", letterSpacing: 1, textTransform: "uppercase" }}>
        {icon} {label}
      </span>
      <div style={{ color: "#d4c8ae", marginTop: 2 }}>{value}</div>
    </div>
  ) : null;

  return (
    <div style={{ ...S.card, position: "relative", cursor: "pointer" }} onClick={() => onEdit(npc)}>
      <div style={{ display: "flex", gap: 14 }}>
        {npc.avatar ? (
          <img src={npc.avatar} alt={npc.name} style={S.npcAvatar} />
        ) : (
          <div style={S.npcAvatarPlaceholder}>🎭</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 600, letterSpacing: 1, color: "#f0e6d4" }}>
            {npc.name}
          </div>
          {npc.faction && <div style={{ ...S.muted, fontSize: 22, marginTop: 2 }}>{npc.faction}</div>}
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            <span style={S.tag(accent)}>{npc.relationship || "Unknown"}</span>
          </div>
        </div>
      </div>
      {npc.description && (
        <div style={{ marginTop: 10, fontSize: 25, lineHeight: 1.5, color: "#d4c8ae" }}>
          {npc.description}
        </div>
      )}
      {profileField("\uD83D\uDC41", "Appearance", npc.appearance)}
      {profileField("\uD83C\uDFAD", "Personality", npc.personality)}
      {profileField("\uD83D\uDD6F", "Backstory", npc.backstory)}
      {profileField("\u269C", "Motivations", npc.motivations)}
      {npc.notes && (
        <div style={{ marginTop: 8, fontSize: 22, fontStyle: "italic", color: "#a09888" }}>
          ✦ {npc.notes}
        </div>
      )}
      {npc.lastSeen && (
        <div style={{ marginTop: 10, fontSize: 20, color: "#9a9aa5", fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
          Sessions {npc.firstSeen || "?"} — {npc.lastSeen}
        </div>
      )}
      <button onClick={e => { e.stopPropagation(); onDelete(npc.id); }}
        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
          color: "#4a4a58", cursor: "pointer", fontSize: 18 }}>✕</button>
    </div>
  );
}
