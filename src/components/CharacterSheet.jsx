import { useState, useCallback } from "react";
import { S } from "../styles.js";

// ─── V20 Stat Definitions ─────
const V20_ATTRIBUTES = {
  Physical: ["Strength", "Dexterity", "Stamina"],
  Social: ["Charisma", "Manipulation", "Appearance"],
  Mental: ["Perception", "Intelligence", "Wits"],
};

const V20_ABILITIES = {
  Talents: ["Alertness", "Athletics", "Awareness", "Brawl", "Empathy", "Expression", "Intimidation", "Leadership", "Streetwise", "Subterfuge"],
  Skills: ["Animal Ken", "Crafts", "Drive", "Etiquette", "Firearms", "Larceny", "Melee", "Performance", "Stealth", "Survival"],
  Knowledges: ["Academics", "Computer", "Finance", "Investigation", "Law", "Medicine", "Occult", "Politics", "Science", "Technology"],
};

const V20_VIRTUES = ["Conscience", "Self-Control", "Courage"];

// ─── V5 Stat Definitions ─────
const V5_ATTRIBUTES = {
  Physical: ["Strength", "Dexterity", "Stamina"],
  Social: ["Charisma", "Manipulation", "Composure"],
  Mental: ["Intelligence", "Wits", "Resolve"],
};

const V5_SKILLS = {
  Physical: ["Athletics", "Brawl", "Craft", "Drive", "Firearms", "Larceny", "Melee", "Stealth", "Survival"],
  Social: ["Animal Ken", "Etiquette", "Insight", "Intimidation", "Leadership", "Performance", "Persuasion", "Streetwise", "Subterfuge"],
  Mental: ["Academics", "Awareness", "Finance", "Investigation", "Medicine", "Occult", "Politics", "Science", "Technology"],
};

// Dot rating component
function DotRating({ value = 0, max = 5, accent, onChange, size = 14 }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i}
          onClick={(e) => { e.stopPropagation(); onChange(i + 1 === value ? i : i + 1); }}
          style={{
            width: size, height: size, borderRadius: "50%",
            border: `2px solid ${accent}80`,
            background: i < value ? accent : "transparent",
            cursor: "pointer", transition: "all 0.2s",
          }}
        />
      ))}
    </div>
  );
}

// Stat row component
function StatRow({ label, value, accent, onChange, maxDots = 5 }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 15, color: "#c4b899", minWidth: 110 }}>{label}</span>
      <DotRating value={value} max={maxDots} accent={accent} onChange={onChange} />
    </div>
  );
}

// Section header
function SectionHeader({ text, accent }) {
  return (
    <div style={{
      fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 2,
      color: accent, textTransform: "uppercase", marginBottom: 6, marginTop: 12,
      borderBottom: `1px solid ${accent}30`, paddingBottom: 4,
    }}>{text}</div>
  );
}

// Discipline entry with editable name and dots
function DisciplineRow({ name, value, accent, onNameChange, onValueChange, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
      <input
        style={{ background: "transparent", border: "none", borderBottom: `1px solid #2a2a35`, color: "#c4b899", fontSize: 15, width: 130, fontFamily: "'Cormorant Garamond', serif" }}
        value={name} onChange={e => onNameChange(e.target.value)}
        placeholder="Discipline" onClick={e => e.stopPropagation()} />
      <DotRating value={value} max={5} accent={accent} onChange={onValueChange} />
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{ background: "none", border: "none", color: "#4a4a58", cursor: "pointer", fontSize: 14 }}>✕</button>
    </div>
  );
}

// Square tracker (for Willpower, Health, etc.)
function SquareTracker({ label, value = 0, max = 10, accent, onChange }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontFamily: "'Cinzel', serif", letterSpacing: 1, color: accent, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: max }, (_, i) => (
          <div key={i}
            onClick={(e) => { e.stopPropagation(); onChange(i + 1 === value ? i : i + 1); }}
            style={{
              width: 16, height: 16, borderRadius: 2,
              border: `2px solid ${accent}60`,
              background: i < value ? accent : "transparent",
              cursor: "pointer", transition: "all 0.2s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function CharacterSheet({ character, accent, onStatsChange }) {
  const stats = character.stats || {};
  const [edition, setEdition] = useState(stats.edition || "v20");

  const updateStat = useCallback((path, value) => {
    const newStats = { ...stats, edition };
    const parts = path.split(".");
    let ref = newStats;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!ref[parts[i]]) ref[parts[i]] = {};
      else ref[parts[i]] = { ...ref[parts[i]] };
      ref = ref[parts[i]];
    }
    ref[parts[parts.length - 1]] = value;
    onStatsChange(newStats);
  }, [stats, edition, onStatsChange]);

  const getVal = (path) => {
    const parts = path.split(".");
    let ref = stats;
    for (const p of parts) {
      if (!ref) return 0;
      ref = ref[p];
    }
    return ref || 0;
  };

  const disciplines = stats.disciplines || [];

  const addDiscipline = () => {
    updateStat("disciplines", [...disciplines, { name: "", value: 0 }]);
  };

  const updateDiscipline = (idx, field, val) => {
    const updated = [...disciplines];
    updated[idx] = { ...updated[idx], [field]: val };
    updateStat("disciplines", updated);
  };

  const removeDiscipline = (idx) => {
    updateStat("disciplines", disciplines.filter((_, i) => i !== idx));
  };

  const ATTRIBUTES = edition === "v5" ? V5_ATTRIBUTES : V20_ATTRIBUTES;
  const SKILLS = edition === "v5" ? V5_SKILLS : V20_ABILITIES;
  const skillLabel = edition === "v5" ? "Skills" : "Abilities";

  return (
    <div style={{ ...S.card, padding: 20 }} onClick={e => e.stopPropagation()}>
      {/* Edition Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, letterSpacing: 2, color: accent }}>
          Character Sheet
        </div>
        <div style={{ display: "flex", gap: 2, background: "#1a1a22", borderRadius: 6, padding: 2 }}>
          {[{ id: "v20", label: "V20" }, { id: "v5", label: "V5" }].map(ed => (
            <button key={ed.id}
              onClick={(e) => { e.stopPropagation(); setEdition(ed.id); updateStat("edition", ed.id); }}
              style={{
                background: edition === ed.id ? `${accent}25` : "transparent",
                border: edition === ed.id ? `1px solid ${accent}50` : "1px solid transparent",
                color: edition === ed.id ? "#e8dcc6" : "#5a5a65",
                padding: "5px 14px", borderRadius: 4, cursor: "pointer",
                fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 1,
              }}>
              {ed.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attributes - 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {Object.entries(ATTRIBUTES).map(([category, attrs]) => (
          <div key={category}>
            <SectionHeader text={category} accent={accent} />
            {attrs.map(attr => (
              <StatRow key={attr} label={attr} accent={accent}
                value={getVal(`attributes.${attr.toLowerCase()}`)}
                onChange={v => updateStat(`attributes.${attr.toLowerCase()}`, v)} />
            ))}
          </div>
        ))}
      </div>

      {/* Skills/Abilities - 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 8 }}>
        {Object.entries(SKILLS).map(([category, skills]) => (
          <div key={category}>
            <SectionHeader text={edition === "v5" ? `${category} ${skillLabel}` : category} accent={accent} />
            {skills.map(skill => (
              <StatRow key={skill} label={skill} accent={accent}
                value={getVal(`abilities.${skill.toLowerCase().replace(/\s/g, "_")}`)}
                onChange={v => updateStat(`abilities.${skill.toLowerCase().replace(/\s/g, "_")}`, v)} />
            ))}
          </div>
        ))}
      </div>

      {/* Disciplines */}
      <SectionHeader text="Disciplines" accent={accent} />
      {disciplines.map((d, i) => (
        <DisciplineRow key={i} name={d.name} value={d.value} accent={accent}
          onNameChange={v => updateDiscipline(i, "name", v)}
          onValueChange={v => updateDiscipline(i, "value", v)}
          onRemove={() => removeDiscipline(i)} />
      ))}
      <button style={{ ...S.btn(accent), padding: "4px 12px", fontSize: 12, marginTop: 4 }}
        onClick={(e) => { e.stopPropagation(); addDiscipline(); }}>+ Discipline</button>

      {/* Secondary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
        <div>
          {edition === "v20" ? (
            <>
              <SectionHeader text="Virtues" accent={accent} />
              {V20_VIRTUES.map(v => (
                <StatRow key={v} label={v} accent={accent}
                  value={getVal(`virtues.${v.toLowerCase().replace(/[-\s]/g, "_")}`)}
                  onChange={val => updateStat(`virtues.${v.toLowerCase().replace(/[-\s]/g, "_")}`, val)} />
              ))}
            </>
          ) : (
            <>
              <SectionHeader text="Hunger" accent={accent} />
              <SquareTracker label="" value={getVal("hunger")} max={5} accent="#c41e3a"
                onChange={v => updateStat("hunger", v)} />
            </>
          )}
        </div>
        <div>
          <SectionHeader text={edition === "v5" ? "Blood Potency" : "Generation"} accent={accent} />
          {edition === "v5" ? (
            <DotRating value={getVal("bloodPotency")} max={10} accent={accent} size={12}
              onChange={v => updateStat("bloodPotency", v)} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={3} max={15}
                style={{ ...S.input, width: 60, padding: "4px 8px", fontSize: 15, textAlign: "center" }}
                value={getVal("generation") || ""}
                onClick={e => e.stopPropagation()}
                onChange={e => updateStat("generation", parseInt(e.target.value) || 0)} />
              <span style={{ fontSize: 13, color: "#7a7068" }}>th</span>
            </div>
          )}
        </div>
      </div>

      {/* Health, Willpower, Humanity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 8 }}>
        <div>
          <SquareTracker label="Willpower" value={getVal("willpower")} max={10} accent={accent}
            onChange={v => updateStat("willpower", v)} />
        </div>
        <div>
          <SquareTracker label="Humanity" value={getVal("humanity")} max={10} accent="#6a8a4a"
            onChange={v => updateStat("humanity", v)} />
        </div>
        <div>
          <SquareTracker label={edition === "v20" ? "Blood Pool" : "Health"} value={getVal(edition === "v20" ? "bloodPool" : "health")} max={edition === "v20" ? 20 : 10} accent="#8a3a3a"
            onChange={v => updateStat(edition === "v20" ? "bloodPool" : "health", v)} />
        </div>
      </div>

      {/* Merits & Flaws freetext */}
      <SectionHeader text="Merits & Flaws" accent={accent} />
      <textarea
        style={{ ...S.textarea, minHeight: 50, fontSize: 15 }}
        placeholder="List merits and flaws..."
        value={getVal("meritsFlaws") || ""}
        onClick={e => e.stopPropagation()}
        onChange={e => updateStat("meritsFlaws", e.target.value)}
      />

      {/* Backgrounds */}
      <SectionHeader text="Backgrounds" accent={accent} />
      <textarea
        style={{ ...S.textarea, minHeight: 50, fontSize: 15 }}
        placeholder="List backgrounds (e.g., Resources 3, Contacts 2)..."
        value={getVal("backgrounds") || ""}
        onClick={e => e.stopPropagation()}
        onChange={e => updateStat("backgrounds", e.target.value)}
      />
    </div>
  );
}
