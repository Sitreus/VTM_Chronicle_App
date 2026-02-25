import { memo, useState, useCallback } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";

const STAT_PREFIXES = [
  "Generation/Rank", "Sire/Mentor", "Haven", "Faction",
  "Attributes", "Abilities", "Disciplines/Spheres", "Merits & Flaws",
  "Known Allies", "Known Enemies",
];

function formatNotes(notes) {
  if (!notes) return { plainLines: [], statEntries: [] };
  const lines = notes.split("\n").filter(l => l.trim());
  const plainLines = [];
  const statEntries = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const matchedPrefix = STAT_PREFIXES.find(p => trimmed.startsWith(p + ":"));
    if (matchedPrefix) {
      const value = trimmed.slice(matchedPrefix.length + 1).trim();
      if (value) statEntries.push({ label: matchedPrefix, value });
    } else {
      plainLines.push(trimmed);
    }
  }
  return { plainLines, statEntries };
}

function formatStatValue(label, value) {
  // Stat lines with comma-separated items get sub-bullets
  const isListStat = ["Attributes", "Abilities", "Disciplines/Spheres", "Merits & Flaws", "Known Allies", "Known Enemies"].includes(label);
  if (!isListStat) return [value];
  return value.split(/,\s*/).filter(Boolean);
}

const BACKSTORY_TRUNCATE = 300;

function CharacterCard({ ch, accent, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const { plainLines, statEntries } = formatNotes(ch.notes);

  const toggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded(v => !v);
  }, []);

  const hasLongBackstory = ch.backstory && ch.backstory.length > BACKSTORY_TRUNCATE;

  return (
    <div style={{ ...S.card, position: "relative", cursor: "pointer" }}
      onClick={() => onEdit(ch)}>
      <div style={{ display: "flex", gap: 16 }}>
        {ch.avatar ? (
          <img src={ch.avatar} alt={ch.name} style={{ width: 80, height: 80, borderRadius: 6, objectFit: "cover", border: `2px solid ${accent}40` }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 6, background: `${accent}10`, border: `2px solid ${accent}20`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: `${accent}40` }}>⚜</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 700, letterSpacing: 1, color: "#f0e6d4" }}>{ch.name}</div>
          {ch.concept && <div style={{ color: accent, fontSize: 22, marginTop: 2 }}>{ch.concept}</div>}
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {ch.clan && <span style={S.tag(accent)}>{ch.clan}</span>}
            {ch.nature && <span style={S.tag("#7a7068")}>Nature: {ch.nature}</span>}
            {ch.demeanor && <span style={S.tag("#7a7068")}>Demeanor: {ch.demeanor}</span>}
          </div>
        </div>
      </div>

      {/* Backstory — collapsible */}
      {ch.backstory && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 22, lineHeight: 1.7, color: "#d4c8ae", whiteSpace: "pre-wrap" }}>
            {expanded || !hasLongBackstory
              ? ch.backstory
              : ch.backstory.slice(0, BACKSTORY_TRUNCATE) + "..."}
          </div>
          {hasLongBackstory && (
            <button onClick={toggleExpand} style={{
              background: "none", border: "none", color: accent, cursor: "pointer",
              fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: 1,
              padding: "4px 0", marginTop: 4, textTransform: "uppercase",
            }}>
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Plain notes (non-stat lines) */}
      {plainLines.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 21, fontStyle: "italic", color: "#b0a490", whiteSpace: "pre-wrap" }}>
          {plainLines.join("\n")}
        </div>
      )}

      {/* Stats — formatted as bullet points */}
      {statEntries.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={S.divider} />
          {statEntries.map(({ label, value }, i) => {
            const items = formatStatValue(label, value);
            const isList = items.length > 1;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{
                  fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 700,
                  letterSpacing: 1.5, color: accent, textTransform: "uppercase", marginBottom: 3,
                }}>
                  {label}
                </div>
                {isList ? (
                  <ul style={{ margin: 0, paddingLeft: 20, listStyleType: "none" }}>
                    {items.map((item, j) => (
                      <li key={j} style={{ fontSize: 20, lineHeight: 1.6, color: "#c4b899" }}>
                        <span style={{ color: `${accent}80`, marginRight: 6 }}>&#x25B8;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: 20, lineHeight: 1.6, color: "#c4b899", paddingLeft: 4 }}>
                    {value}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={e => { e.stopPropagation(); onDelete(ch.id); }}
        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
          color: "#4a4a58", cursor: "pointer", fontSize: 18 }}>✕</button>
    </div>
  );
}

export default memo(function CharactersTab() {
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
          <CharacterCard key={ch.id} ch={ch} accent={accent}
            onEdit={(c) => { setModalData(c); setShowModal("editCharacter"); }}
            onDelete={deleteCharacter} />
        ))
      )}
    </div>
  );
});
