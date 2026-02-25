import { useState, useMemo, useRef, useEffect } from "react";
import { S } from "../styles.js";

const CATEGORY_ICONS = {
  npc: "🎭", character: "⚜", faction: "🏛", location: "🗺",
  thread: "🕸", session: "📜", beat: "📅",
};

export default function SearchOverlay({ chronicleData, accent, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const cd = chronicleData || {};

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const items = [];

    // Search NPCs
    (cd.npcs || []).forEach(n => {
      const fields = [n.name, n.faction, n.description, n.personality, n.backstory, n.notes, n.motivations].filter(Boolean);
      if (fields.some(f => f.toLowerCase().includes(q))) {
        items.push({ type: "npc", id: n.id, title: n.name, subtitle: n.faction || n.relationship || "", tab: "npcs", data: n });
      }
    });

    // Search Characters
    (cd.characters || []).forEach(c => {
      const fields = [c.name, c.concept, c.clan, c.backstory, c.notes].filter(Boolean);
      if (fields.some(f => f.toLowerCase().includes(q))) {
        items.push({ type: "character", id: c.id, title: c.name, subtitle: c.concept || c.clan || "", tab: "characters", data: c });
      }
    });

    // Search Factions
    (cd.factions || []).forEach(f => {
      const fields = [f.name, f.description, f.goals, f.territory].filter(Boolean);
      if (fields.some(f2 => f2.toLowerCase().includes(q))) {
        items.push({ type: "faction", id: f.id, title: f.name, subtitle: f.attitude || "", tab: "factions", data: f });
      }
    });

    // Search Locations
    (cd.locationDossiers || []).forEach(l => {
      const fields = [l.name, l.description, l.atmosphere, l.controlledBy, l.secrets].filter(Boolean);
      if (fields.some(f => f.toLowerCase().includes(q))) {
        items.push({ type: "location", id: l.id, title: l.name, subtitle: l.type || "", tab: "locations", data: l });
      }
    });

    // Search Threads
    (cd.plotThreads || []).forEach(t => {
      const fields = [t.title, t.description, ...(t.clues || []).map(c => c.text)].filter(Boolean);
      if (fields.some(f => f.toLowerCase().includes(q))) {
        items.push({ type: "thread", id: t.id, title: t.title, subtitle: `${t.status} ${t.type}`, tab: "threads", data: t });
      }
    });

    // Search Sessions
    (cd.sessions || []).forEach(s => {
      const fields = [s.title, s.summary, ...(s.storyBeats || [])].filter(Boolean);
      if (fields.some(f => f.toLowerCase().includes(q))) {
        items.push({ type: "session", id: s.id, title: `Session ${s.number}${s.title ? ` — ${s.title}` : ""}`, subtitle: s.date || "", tab: "sessions", data: s });
      }
    });

    // Search Story Beats
    (cd.storyBeats || []).forEach(b => {
      if (b.text?.toLowerCase().includes(q)) {
        items.push({ type: "beat", id: b.id, title: b.text.slice(0, 80), subtitle: `Session ${b.session}`, tab: "timeline", data: b });
      }
    });

    return items.slice(0, 20);
  }, [query, cd]);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.85)", zIndex: 9999,
      display: "flex", justifyContent: "center", paddingTop: 80,
    }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div style={{
          background: "linear-gradient(135deg, #13131a, #16161f)",
          border: `2px solid ${accent}60`, borderRadius: 8, padding: "4px 8px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 20, opacity: 0.6 }}>🔍</span>
          <input ref={inputRef}
            style={{
              background: "transparent", border: "none", color: "#e8dcc6",
              fontSize: 20, fontFamily: "'Cormorant Garamond', serif",
              width: "100%", padding: "12px 4px", outline: "none",
            }}
            placeholder="Search chronicle..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#6a6058", cursor: "pointer", fontSize: 16, padding: 4 }}>
            ESC
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{
            marginTop: 8, background: "linear-gradient(135deg, #13131a, #16161f)",
            border: "1px solid #2a2a35", borderRadius: 8, maxHeight: 420,
            overflowY: "auto",
          }}>
            {results.map((r, i) => (
              <div key={`${r.type}-${r.id}`}
                onClick={() => { onNavigate(r.tab, r.data, r.type); onClose(); }}
                style={{
                  padding: "12px 18px", cursor: "pointer",
                  borderBottom: i < results.length - 1 ? "1px solid #1e1e28" : "none",
                  transition: "background 0.2s",
                  display: "flex", alignItems: "center", gap: 12,
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${accent}10`}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[r.type]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, color: "#e8dcc6", fontFamily: "'Cinzel', serif", letterSpacing: 0.5 }}>
                    {r.title}
                  </div>
                  {r.subtitle && (
                    <div style={{ fontSize: 14, color: "#7a7068", marginTop: 1 }}>{r.subtitle}</div>
                  )}
                </div>
                <span style={{ ...S.tag(accent), fontSize: 11 }}>{r.type}</span>
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && (
          <div style={{
            marginTop: 8, padding: 30, textAlign: "center",
            background: "linear-gradient(135deg, #13131a, #16161f)",
            border: "1px solid #2a2a35", borderRadius: 8,
            color: "#5a5a65", fontFamily: "'Cinzel', serif", fontSize: 15, letterSpacing: 1,
          }}>
            No results found in the chronicle.
          </div>
        )}
      </div>
    </div>
  );
}
