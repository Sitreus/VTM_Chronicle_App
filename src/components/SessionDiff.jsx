import { useState, useMemo } from "react";
import { S } from "../styles.js";

export default function SessionDiff({ sessions, accent }) {
  const sorted = useMemo(() => [...sessions].sort((a, b) => a.number - b.number), [sessions]);
  const [fromIdx, setFromIdx] = useState(sorted.length >= 2 ? sorted.length - 2 : 0);
  const [toIdx, setToIdx] = useState(sorted.length - 1);

  if (sorted.length < 2) return null;

  const fromSession = sorted[fromIdx];
  const toSession = sorted[toIdx];

  // Compare what changed between sessions
  const fromBeats = new Set(fromSession?.storyBeats || []);
  const toBeats = new Set(toSession?.storyBeats || []);
  const newBeats = (toSession?.storyBeats || []).filter(b => !fromBeats.has(b));

  const fromLocs = new Set(fromSession?.locations || []);
  const toLocs = new Set(toSession?.locations || []);
  const newLocs = (toSession?.locations || []).filter(l => !fromLocs.has(l));

  return (
    <div style={{ ...S.card, padding: 20, marginTop: 16 }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, letterSpacing: 2, color: accent, marginBottom: 12 }}>
        Session Comparison
      </div>

      {/* Session selectors */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 12, fontFamily: "'Cinzel', serif", color: "#7a7068", letterSpacing: 1, display: "block", marginBottom: 4 }}>FROM</label>
          <select style={{ ...S.select, minWidth: 180 }} value={fromIdx}
            onChange={e => setFromIdx(parseInt(e.target.value))}>
            {sorted.map((s, i) => (
              <option key={s.id} value={i}>Session {s.number}{s.title ? ` — ${s.title}` : ""}</option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: 20, color: accent, marginTop: 18 }}>→</span>
        <div>
          <label style={{ fontSize: 12, fontFamily: "'Cinzel', serif", color: "#7a7068", letterSpacing: 1, display: "block", marginBottom: 4 }}>TO</label>
          <select style={{ ...S.select, minWidth: 180 }} value={toIdx}
            onChange={e => setToIdx(parseInt(e.target.value))}>
            {sorted.map((s, i) => (
              <option key={s.id} value={i}>Session {s.number}{s.title ? ` — ${s.title}` : ""}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Results */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* From session */}
        <div style={{ padding: 14, background: "rgba(196,30,58,0.05)", borderRadius: 6, border: "1px solid rgba(196,30,58,0.15)" }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, letterSpacing: 1, color: "#c41e3a", marginBottom: 8 }}>
            Session {fromSession?.number}
          </div>
          {fromSession?.mood && <div style={{ ...S.tag("#6a6a6a"), fontSize: 12, marginBottom: 8 }}>{fromSession.mood}</div>}
          <div style={{ fontSize: 16, color: "#b0a490", lineHeight: 1.5 }}>
            {fromSession?.summary || "No summary"}
          </div>
          {fromSession?.storyBeats?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {fromSession.storyBeats.map((b, i) => (
                <div key={i} style={{ fontSize: 14, color: "#a09888", marginBottom: 2 }}>
                  <span style={{ color: "#6a6058", marginRight: 4 }}>▸</span>{b}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* To session */}
        <div style={{ padding: 14, background: "rgba(74,140,63,0.05)", borderRadius: 6, border: "1px solid rgba(74,140,63,0.15)" }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, letterSpacing: 1, color: "#4a8c3f", marginBottom: 8 }}>
            Session {toSession?.number}
          </div>
          {toSession?.mood && <div style={{ ...S.tag("#6a6a6a"), fontSize: 12, marginBottom: 8 }}>{toSession.mood}</div>}
          <div style={{ fontSize: 16, color: "#b0a490", lineHeight: 1.5 }}>
            {toSession?.summary || "No summary"}
          </div>
          {toSession?.storyBeats?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {toSession.storyBeats.map((b, i) => (
                <div key={i} style={{
                  fontSize: 14, marginBottom: 2,
                  color: newBeats.includes(b) ? "#4a8c3f" : "#a09888",
                  fontWeight: newBeats.includes(b) ? 600 : 400,
                }}>
                  <span style={{ color: newBeats.includes(b) ? "#4a8c3f" : "#6a6058", marginRight: 4 }}>
                    {newBeats.includes(b) ? "+" : "▸"}
                  </span>{b}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Changes Summary */}
      {(newBeats.length > 0 || newLocs.length > 0) && (
        <div style={{ marginTop: 14, padding: 12, background: `${accent}08`, borderRadius: 6, border: `1px solid ${accent}20` }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 1, color: accent, marginBottom: 6 }}>
            WHAT CHANGED
          </div>
          {newBeats.length > 0 && (
            <div style={{ fontSize: 14, color: "#4a8c3f", marginBottom: 4 }}>
              + {newBeats.length} new story beat{newBeats.length !== 1 ? "s" : ""}
            </div>
          )}
          {newLocs.length > 0 && (
            <div style={{ fontSize: 14, color: "#4a6a8a" }}>
              + {newLocs.length} new location{newLocs.length !== 1 ? "s" : ""}: {newLocs.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
