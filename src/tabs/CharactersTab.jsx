import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";

export default function CharactersTab() {
  const { chronicleData, accent, setModalData, setShowModal, characterFileRef } = useChronicle();
  const { deleteCharacter } = useChronicleActions();

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
}
