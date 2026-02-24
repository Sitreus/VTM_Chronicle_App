import { memo } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";

const typeIcons = {
  haven: "🏚", elysium: "🏛", bar: "🍷", street: "🌃", leyNode: "✨",
  church: "⛪", graveyard: "⚰", warehouse: "🏭", mansion: "🏰", other: "📍",
};

export default memo(function LocationsTab() {
  const { chronicleData, accent, setModalData, setShowModal } = useChronicle();
  const { deleteLocation } = useChronicleActions();

  const cd = chronicleData || { locationDossiers: [] };
  const allLocs = cd.locationDossiers || [];

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
});
