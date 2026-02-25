import { S } from "../styles.js";
import { GAME_TYPES } from "../constants.js";

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function PrintView({ chronicle, chronicleData, accent, onClose }) {
  const cd = chronicleData || {};
  const gameType = GAME_TYPES.find(g => g.id === chronicle?.gameType);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(generatePrintHTML());
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const generatePrintHTML = () => {
    const sessions = cd.sessions || [];
    const npcs = cd.npcs || [];
    const characters = cd.characters || [];
    const factions = cd.factions || [];
    const locations = cd.locationDossiers || [];
    const threads = cd.plotThreads || [];
    const beats = cd.storyBeats || [];

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
  @page { margin: 1.5cm; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Cormorant Garamond', Georgia, serif;
    background: #0d0d12; color: #d4c8ae;
    font-size: 14px; line-height: 1.6;
    max-width: 800px; margin: 0 auto; padding: 40px;
  }
  h1 { font-family: 'Cinzel', serif; font-size: 32px; color: ${accent};
    letter-spacing: 4px; text-transform: uppercase; text-align: center;
    border-bottom: 2px solid ${accent}40; padding-bottom: 12px; margin-bottom: 6px; }
  h2 { font-family: 'Cinzel', serif; font-size: 20px; color: ${accent};
    letter-spacing: 3px; text-transform: uppercase; margin-top: 30px;
    border-bottom: 1px solid ${accent}30; padding-bottom: 6px; }
  h3 { font-family: 'Cinzel', serif; font-size: 16px; color: #e8dcc6;
    letter-spacing: 1px; margin-bottom: 4px; }
  .subtitle { text-align: center; font-family: 'Cinzel', serif; font-size: 14px;
    letter-spacing: 3px; color: #8a7e70; text-transform: uppercase; margin-bottom: 20px; }
  .description { font-style: italic; color: #b0a490; text-align: center; margin-bottom: 24px; }
  .card { background: rgba(20,20,30,0.6); border: 1px solid #2a2a35;
    border-radius: 6px; padding: 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 10px;
    font-size: 12px; font-family: 'Cinzel', serif; letter-spacing: 1px;
    background: ${accent}15; border: 1px solid ${accent}40; color: ${accent}; margin-right: 4px; }
  .stat-label { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 1px;
    color: ${accent}; text-transform: uppercase; }
  .muted { color: #8a7e70; font-size: 13px; }
  .divider { height: 1px; background: linear-gradient(90deg, transparent, #2a2a35, transparent); margin: 16px 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media print {
    body { background: white; color: #2a2a2a; }
    .card { background: #f5f0e8; border-color: #c4b899; }
    h1, h2, .stat-label, .tag { color: #4a2020; }
    h3 { color: #2a2a2a; }
    .muted, .description { color: #6a6058; }
  }
</style></head><body>
<h1>${esc(gameType?.icon) || "◈"} ${esc(chronicle?.name) || "Chronicle"}</h1>
<div class="subtitle">${esc(gameType?.label) || "World of Darkness"}</div>
${chronicle?.description ? `<div class="description">${esc(chronicle.description)}</div>` : ""}

${characters.length > 0 ? `
<h2>⚜ Player Characters</h2>
${characters.map(c => `
<div class="card">
  <h3>${esc(c.name)}</h3>
  ${c.concept ? `<div style="color:${accent};margin-bottom:4px">${esc(c.concept)}</div>` : ""}
  <div style="margin-bottom:6px">
    ${c.clan ? `<span class="tag">${esc(c.clan)}</span>` : ""}
    ${c.nature ? `<span class="tag">Nature: ${esc(c.nature)}</span>` : ""}
    ${c.demeanor ? `<span class="tag">Demeanor: ${esc(c.demeanor)}</span>` : ""}
  </div>
  ${c.backstory ? `<div>${esc(c.backstory)}</div>` : ""}
</div>`).join("")}` : ""}

${npcs.length > 0 ? `
<h2>🎭 NPCs</h2>
<div class="grid">
${npcs.map(n => `
<div class="card">
  <h3>${esc(n.name)}</h3>
  <div><span class="tag">${esc(n.relationship) || "Unknown"}</span>${n.faction ? `<span class="muted"> ${esc(n.faction)}</span>` : ""}</div>
  ${n.description ? `<div style="margin-top:6px">${esc(n.description)}</div>` : ""}
  ${n.personality ? `<div class="muted" style="margin-top:4px">Personality: ${esc(n.personality)}</div>` : ""}
</div>`).join("")}
</div>` : ""}

${factions.length > 0 ? `
<h2>🏛 Factions</h2>
<div class="grid">
${factions.map(f => `
<div class="card">
  <h3>${esc(f.name)}</h3>
  <div><span class="tag">${esc(f.attitude) || "Neutral"}</span> <span class="muted">${esc(f.influence)}</span></div>
  ${f.description ? `<div style="margin-top:6px">${esc(f.description)}</div>` : ""}
  ${f.goals ? `<div class="muted" style="margin-top:4px">Goals: ${esc(f.goals)}</div>` : ""}
</div>`).join("")}
</div>` : ""}

${locations.length > 0 ? `
<h2>🗺 Locations</h2>
<div class="grid">
${locations.map(l => `
<div class="card">
  <h3>${esc(l.name)}</h3>
  <div><span class="tag">${esc(l.type) || "other"}</span>${l.controlledBy ? `<span class="muted"> ${esc(l.controlledBy)}</span>` : ""}</div>
  ${l.description ? `<div style="margin-top:6px">${esc(l.description)}</div>` : ""}
  ${l.atmosphere ? `<div class="muted" style="font-style:italic;margin-top:4px">✦ ${esc(l.atmosphere)}</div>` : ""}
</div>`).join("")}
</div>` : ""}

${threads.length > 0 ? `
<h2>🕸 Plot Threads</h2>
${threads.map(t => `
<div class="card" style="border-left:3px solid ${t.status === "active" ? "#c41e3a" : t.status === "cold" ? "#4a6a8a" : "#3a6a3a"}">
  <h3>${esc(t.title)} <span class="tag">${esc(t.status)}</span> <span class="tag">${esc(t.type) || "mystery"}</span></h3>
  ${t.description ? `<div>${esc(t.description)}</div>` : ""}
  ${(t.clues || []).map(c => `<div class="muted">S${esc(String(c.session))}: ${esc(c.text)}</div>`).join("")}
</div>`).join("")}` : ""}

${sessions.length > 0 ? `
<h2>📜 Session Logs</h2>
${sessions.map(s => `
<div class="card">
  <h3>Session ${esc(String(s.number))}${s.title ? ` — ${esc(s.title)}` : ""}</h3>
  <div class="muted">${esc(s.date)} ${s.mood ? `| ${esc(s.mood)}` : ""}</div>
  ${s.summary ? `<div style="margin-top:8px;font-style:italic">${esc(s.summary)}</div>` : ""}
  ${(s.storyBeats || []).map(b => `<div style="margin-top:4px">▸ ${esc(b)}</div>`).join("")}
</div>`).join("")}` : ""}

${beats.length > 0 ? `
<h2>📅 Timeline</h2>
${beats.map(b => `<div style="margin-bottom:4px"><span class="stat-label">Session ${esc(String(b.session))}</span> ${esc(b.text)}</div>`).join("")}` : ""}

<div class="divider"></div>
<div style="text-align:center;color:#5a5a65;font-family:'Cinzel',serif;font-size:11px;letter-spacing:2px">
  World of Darkness Chronicle Database — Printed ${new Date().toLocaleDateString()}
</div>
</body></html>`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...S.cardHeader, color: accent, textAlign: "center" }}>
        Dark Parchment Export
      </div>
      <div style={{ textAlign: "center", color: "#b0a490", fontSize: 17, lineHeight: 1.6 }}>
        Generate a gothic-styled printable chronicle summary. Opens in a new window with print dialog.
      </div>

      {/* Preview stats */}
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: 1, color: accent, marginBottom: 8 }}>CONTENTS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "Characters", count: (cd.characters || []).length },
            { label: "NPCs", count: (cd.npcs || []).length },
            { label: "Factions", count: (cd.factions || []).length },
            { label: "Locations", count: (cd.locationDossiers || []).length },
            { label: "Threads", count: (cd.plotThreads || []).length },
            { label: "Sessions", count: (cd.sessions || []).length },
          ].map(s => (
            <div key={s.label} style={{ fontSize: 14, color: s.count > 0 ? "#c4b899" : "#4a4a58" }}>
              {s.count > 0 ? "✓" : "○"} {s.count} {s.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button style={{ ...S.btnFilled(accent), flex: 1 }} onClick={handlePrint}>
          🖨 Print / Save as PDF
        </button>
        <button style={S.btn(accent)} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
