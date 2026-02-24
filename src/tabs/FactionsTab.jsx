import { S } from "../styles.js";
import { INFLUENCE_LEVELS } from "../constants.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";

export default function FactionsTab() {
  const { chronicleData, accent, setModalData, setShowModal } = useChronicle();
  const { deleteFaction } = useChronicleActions();

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
}
