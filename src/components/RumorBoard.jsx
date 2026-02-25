import { useState } from "react";
import { S } from "../styles.js";

const RUMOR_ICONS = ["📌", "🗣", "👁", "🔮", "🗝", "⚠", "💀", "🕯"];

export default function RumorBoard({ rumors = [], accent, onAdd, onRemove, onUpdate }) {
  const [newText, setNewText] = useState("");
  const [newIcon, setNewIcon] = useState("📌");

  const handleAdd = () => {
    if (!newText.trim()) return;
    onAdd({ id: `rum-${Date.now()}`, text: newText.trim(), icon: newIcon, pinned: false, createdAt: new Date().toISOString() });
    setNewText("");
    setNewIcon("📌");
  };

  return (
    <div>
      <div style={{ ...S.cardHeader, color: accent, marginTop: 12, marginBottom: 8 }}>
        Rumor Board
      </div>
      <div style={{ ...S.card, padding: 16 }}>
        {/* Existing rumors */}
        {rumors.length === 0 ? (
          <div style={{ textAlign: "center", color: "#5a5a65", fontFamily: "'Cinzel', serif", fontSize: 15, letterSpacing: 1, padding: "12px 0" }}>
            No whispers in the dark... yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {rumors.map(r => (
              <div key={r.id} style={{
                background: r.pinned ? `${accent}15` : "rgba(20,20,30,0.8)",
                border: `1px solid ${r.pinned ? accent + "40" : "#2a2a35"}`,
                borderRadius: 6, padding: "10px 14px", maxWidth: 260, minWidth: 180,
                position: "relative", cursor: "default",
                transform: `rotate(${(parseInt(r.id.slice(-3), 36) % 5) - 2}deg)`,
                transition: "all 0.3s",
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{r.icon}</div>
                <div style={{ fontSize: 17, color: "#d4c8ae", lineHeight: 1.5 }}>{r.text}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => onUpdate({ ...r, pinned: !r.pinned })}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: r.pinned ? accent : "#5a5a65" }}
                    title={r.pinned ? "Unpin" : "Pin"}>
                    📌
                  </button>
                  <button
                    onClick={() => onRemove(r.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#4a4a58" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new rumor */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {RUMOR_ICONS.map(icon => (
              <button key={icon}
                onClick={() => setNewIcon(icon)}
                style={{
                  background: newIcon === icon ? `${accent}20` : "transparent",
                  border: newIcon === icon ? `1px solid ${accent}50` : "1px solid #2a2a35",
                  borderRadius: 4, padding: "4px 6px", cursor: "pointer", fontSize: 16,
                }}>
                {icon}
              </button>
            ))}
          </div>
          <input
            style={{ ...S.input, flex: 1, fontSize: 16 }}
            placeholder="Add a rumor, clue, or note..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <button style={{ ...S.btnFilled(accent), padding: "10px 16px", whiteSpace: "nowrap" }} onClick={handleAdd}>
            + Pin
          </button>
        </div>
      </div>
    </div>
  );
}
