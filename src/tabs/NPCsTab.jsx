import { memo, useMemo } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";
import NPCCard from "../components/NPCCard.jsx";

export default memo(function NPCsTab() {
  const {
    chronicleData, accent,
    searchFilter, setSearchFilter, npcRelFilter, setNpcRelFilter,
    npcFactionFilter, setNpcFactionFilter, npcViewMode, setNpcViewMode,
    setModalData, setShowModal,
  } = useChronicle();
  const { deleteNPC } = useChronicleActions();

  const allNpcs = useMemo(() => chronicleData?.npcs || [], [chronicleData?.npcs]);

  const factions = useMemo(
    () => [...new Set(allNpcs.map(n => n.faction).filter(Boolean))].sort(),
    [allNpcs]
  );
  const relationships = useMemo(
    () => [...new Set(allNpcs.map(n => n.relationship).filter(Boolean))].sort(),
    [allNpcs]
  );

  const filtered = useMemo(() => {
    let result = allNpcs;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      result = result.filter(n =>
        n.name.toLowerCase().includes(q) || n.faction?.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q) || n.personality?.toLowerCase().includes(q) ||
        n.backstory?.toLowerCase().includes(q) || n.notes?.toLowerCase().includes(q)
      );
    }
    if (npcRelFilter) result = result.filter(n => n.relationship === npcRelFilter);
    if (npcFactionFilter) result = result.filter(n => n.faction === npcFactionFilter);
    return result;
  }, [allNpcs, searchFilter, npcRelFilter, npcFactionFilter]);

  // Relationship Web rendering
  const renderWeb = () => {
    if (allNpcs.length < 2) return <EmptyState text="Need at least 2 NPCs for the relationship web." />;
    const W = 700, H = 500;
    const cx = W / 2, cy = H / 2;
    const relColors = {
      Ally: "#4a8c3f", Enemy: "#c41e3a", Rival: "#c47a1e", Contact: "#4a6a8a",
      Mentor: "#8a4ac4", Lover: "#c44a6a", Patron: "#6a8a4a", Sire: "#8a3a3a",
      Childe: "#3a8a6a", Neutral: "#6a6a6a", Suspicious: "#8a6a2a", Feared: "#6a2a2a",
      Respected: "#2a6a8a", Unknown: "#5a5a5a",
    };
    const factionGroups = {};
    allNpcs.forEach((n, i) => {
      const fk = n.faction || "_none";
      if (!factionGroups[fk]) factionGroups[fk] = [];
      factionGroups[fk].push({ ...n, _idx: i });
    });
    const factionKeys = Object.keys(factionGroups);
    const positions = new Array(allNpcs.length);
    factionKeys.forEach((fk, fi) => {
      const members = factionGroups[fk];
      const factionAngle = (fi / factionKeys.length) * 2 * Math.PI - Math.PI / 2;
      const baseR = Math.min(W, H) * 0.35;
      members.forEach((m, mi) => {
        const spread = members.length > 1 ? (mi - (members.length - 1) / 2) * 0.3 : 0;
        const angle = factionAngle + spread;
        const r = baseR + (mi % 2 === 0 ? 0 : 25);
        positions[m._idx] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      });
    });
    const webLines = [];
    factionKeys.forEach(fk => {
      if (fk === "_none") return;
      const members = factionGroups[fk];
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          webLines.push({ from: members[i]._idx, to: members[j]._idx, color: "#4a4a5830", dashed: true });
        }
      }
    });
    const factionColorMap = {};
    const palette = ["#c41e3a", "#4a8c3f", "#4a6a8a", "#c47a1e", "#8a4ac4", "#c44a6a", "#6a8a4a", "#8a6a2a"];
    factionKeys.filter(f => f !== "_none").forEach((f, i) => { factionColorMap[f] = palette[i % palette.length]; });

    return (
      <div style={{ ...S.card, padding: 16, overflow: "auto" }}>
        <svg width={W} height={H} style={{ display: "block", margin: "0 auto" }}>
          {factionKeys.filter(f => f !== "_none").map((fk, fi) => {
            const angle = (fi / factionKeys.length) * 2 * Math.PI - Math.PI / 2;
            const lx = cx + (Math.min(W, H) * 0.48) * Math.cos(angle);
            const ly = cy + (Math.min(W, H) * 0.48) * Math.sin(angle);
            return (
              <text key={fk} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fill={factionColorMap[fk] || "#6a6a6a"} fontSize={11} fontFamily="'Cinzel', serif"
                letterSpacing="1" opacity={0.7}>{fk}</text>
            );
          })}
          {webLines.map((l, i) => {
            const pFrom = positions[l.from];
            const pTo = positions[l.to];
            if (!pFrom || !pTo) return null;
            return (
              <line key={i} x1={pFrom.x} y1={pFrom.y}
                x2={pTo.x} y2={pTo.y}
                stroke={l.color} strokeWidth={1} strokeDasharray={l.dashed ? "4,4" : "none"} />
            );
          })}
          {allNpcs.map((npc, i) => {
            const p = positions[i] || { x: 0, y: 0 };
            const rc = relColors[npc.relationship] || "#5a5a5a";
            return (
              <g key={npc.id} style={{ cursor: "pointer" }}
                onClick={() => { setModalData(npc); setShowModal("editNPC"); }}>
                <circle cx={p.x} cy={p.y} r={20} fill={`${rc}30`} stroke={rc} strokeWidth={2} />
                {!npc.avatar && (
                  <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fill={rc} fontSize={16}>🎭</text>
                )}
                <text x={p.x} y={p.y + 28} textAnchor="middle" fill="#e8dcc6"
                  fontSize={11} fontFamily="'Cinzel', serif" letterSpacing="0.5">{npc.name}</text>
                <text x={p.x} y={p.y + 40} textAnchor="middle" fill={rc}
                  fontSize={9} fontFamily="'Cinzel', serif" letterSpacing="0.5">{npc.relationship}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
          {Object.entries(relColors).filter(([r]) => relationships.includes(r)).map(([r, c]) => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#7a7068" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              {r}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>NPCs ({allNpcs.length})</div>
          <div style={{ display: "flex", gap: 2, background: "#1a1a22", borderRadius: 6, padding: 2 }}>
            {[{ id: "cards", icon: "▤" }, { id: "web", icon: "◎" }].map(m => (
              <button key={m.id} onClick={() => setNpcViewMode(m.id)}
                style={{ background: npcViewMode === m.id ? `${accent}20` : "transparent",
                  border: "none", color: npcViewMode === m.id ? "#e8dcc6" : "#5a5a65",
                  padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 15 }}>
                {m.icon}
              </button>
            ))}
          </div>
        </div>
        <button style={S.btnFilled(accent)}
          onClick={() => { setModalData({ name: "", description: "", relationship: "Unknown", faction: "", notes: "", avatar: null }); setShowModal("editNPC"); }}>
          + Add NPC
        </button>
      </div>
      {npcViewMode === "web" ? renderWeb() : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input style={{ ...S.input, flex: "1 1 180px" }} placeholder="Search NPCs..."
              value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
            <select style={{ ...S.select, flex: "0 0 auto", minWidth: 140 }} value={npcRelFilter}
              onChange={e => setNpcRelFilter(e.target.value)}>
              <option value="">All relationships</option>
              {relationships.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select style={{ ...S.select, flex: "0 0 auto", minWidth: 140 }} value={npcFactionFilter}
              onChange={e => setNpcFactionFilter(e.target.value)}>
              <option value="">All factions</option>
              {factions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {(searchFilter || npcRelFilter || npcFactionFilter) && (
              <button style={{ ...S.btn(accent), padding: "6px 12px", fontSize: 13 }}
                onClick={() => { setSearchFilter(""); setNpcRelFilter(""); setNpcFactionFilter(""); }}>
                Clear
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <EmptyState text={allNpcs.length === 0 ? "No NPCs encountered yet. The night is young." : "No NPCs match your filters."} />
          ) : (
            <div style={S.grid2}>
              {filtered.map(npc => (
                <NPCCard key={npc.id} npc={npc} accent={accent}
                  onEdit={(n) => { setModalData(n); setShowModal("editNPC"); }}
                  onDelete={deleteNPC} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});
