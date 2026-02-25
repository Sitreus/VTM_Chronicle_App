import { useState, useCallback, useEffect, useRef } from "react";
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

// All known stat names (lowercase) for fuzzy matching
const ALL_ATTRIBUTE_NAMES = [
  ...V20_ATTRIBUTES.Physical, ...V20_ATTRIBUTES.Social, ...V20_ATTRIBUTES.Mental,
  ...V5_ATTRIBUTES.Social, ...V5_ATTRIBUTES.Mental, // adds Composure, Resolve
].map(a => a.toLowerCase());

const ALL_ABILITY_NAMES = [
  ...new Set([
    ...Object.values(V20_ABILITIES).flat(),
    ...Object.values(V5_SKILLS).flat(),
  ])
].map(a => a.toLowerCase());

// ─── Parse notes/text into structured stats ─────
function parseNotesIntoStats(character) {
  const stats = { attributes: {}, abilities: {}, disciplines: [], virtues: {} };
  const notes = character.notes || "";
  const backstory = character.backstory || "";
  const allText = notes + "\n" + backstory;

  // Helper: extract "Name N" or "Name: N" patterns from a comma-separated string
  function extractDotPairs(text) {
    const pairs = {};
    // Match patterns like "Strength 3", "Strength: 3", "Strength (3)", "Strength ●●●"
    const dotPattern = /([A-Z][a-z][a-z\s-]*?)[\s:]+(\d+|[●○•]+)/g;
    let match;
    while ((match = dotPattern.exec(text)) !== null) {
      const name = match[1].trim().toLowerCase().replace(/\s+/g, "_");
      let val;
      if (/[●•]/.test(match[2])) {
        val = (match[2].match(/[●•]/g) || []).length;
      } else {
        val = parseInt(match[2], 10);
      }
      if (val > 0 && val <= 10) {
        pairs[name] = val;
      }
    }
    return pairs;
  }

  // Find the "Attributes:" line in notes
  const attrLine = notes.match(/Attributes:\s*(.+)/i);
  if (attrLine) {
    const pairs = extractDotPairs(attrLine[1]);
    for (const [key, val] of Object.entries(pairs)) {
      if (ALL_ATTRIBUTE_NAMES.includes(key)) {
        stats.attributes[key] = val;
      }
    }
  }

  // Also try to find attributes scattered in the full text
  if (Object.keys(stats.attributes).length === 0) {
    const pairs = extractDotPairs(allText);
    for (const [key, val] of Object.entries(pairs)) {
      if (ALL_ATTRIBUTE_NAMES.includes(key)) {
        stats.attributes[key] = val;
      }
    }
  }

  // Find "Abilities:" line
  const abilLine = notes.match(/Abilities:\s*(.+)/i);
  if (abilLine) {
    const pairs = extractDotPairs(abilLine[1]);
    for (const [key, val] of Object.entries(pairs)) {
      if (ALL_ABILITY_NAMES.includes(key) || ALL_ABILITY_NAMES.includes(key.replace(/_/g, " "))) {
        stats.abilities[key] = val;
      }
    }
  }

  // Also try abilities from full text if none found
  if (Object.keys(stats.abilities).length === 0) {
    const pairs = extractDotPairs(allText);
    for (const [key, val] of Object.entries(pairs)) {
      const normalized = key.replace(/_/g, " ");
      if (ALL_ABILITY_NAMES.includes(normalized) || ALL_ABILITY_NAMES.includes(key)) {
        stats.abilities[key] = val;
      }
    }
  }

  // Find "Disciplines/Spheres:" line
  const discLine = notes.match(/Disciplines\/Spheres:\s*(.+)/i) || notes.match(/Disciplines:\s*(.+)/i);
  if (discLine) {
    const pairs = extractDotPairs(discLine[1]);
    // Also handle "Auspex 3, Dominate 2" without the regex catching them
    const commaParts = discLine[1].split(/,/).map(s => s.trim()).filter(Boolean);
    for (const part of commaParts) {
      const m = part.match(/^([A-Za-z][A-Za-z\s-]+?)[\s:]+(\d+|[●○•]+)$/);
      if (m) {
        const name = m[1].trim();
        let val;
        if (/[●•]/.test(m[2])) {
          val = (m[2].match(/[●•]/g) || []).length;
        } else {
          val = parseInt(m[2], 10);
        }
        if (val > 0 && val <= 5 && !stats.disciplines.find(d => d.name.toLowerCase() === name.toLowerCase())) {
          stats.disciplines.push({ name, value: val });
        }
      }
    }
    // Fallback from extractDotPairs
    if (stats.disciplines.length === 0) {
      for (const [key, val] of Object.entries(pairs)) {
        const name = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        if (!stats.disciplines.find(d => d.name.toLowerCase() === name.toLowerCase())) {
          stats.disciplines.push({ name, value: val });
        }
      }
    }
  }

  // Find "Merits & Flaws:" line
  const mfLine = notes.match(/Merits & Flaws:\s*(.+)/i);
  if (mfLine) stats.meritsFlaws = mfLine[1].trim();

  // Find "Generation/Rank:"
  const genLine = notes.match(/Generation\/Rank:\s*(\d+)/i) || notes.match(/Generation:\s*(\d+)/i);
  if (genLine) stats.generation = parseInt(genLine[1], 10);

  // Virtues
  const virtueNames = ["conscience", "self-control", "self_control", "courage", "conviction", "instinct"];
  const allPairs = extractDotPairs(allText);
  for (const [key, val] of Object.entries(allPairs)) {
    if (virtueNames.includes(key) || virtueNames.includes(key.replace(/_/g, "-"))) {
      stats.virtues[key.replace(/-/g, "_")] = val;
    }
  }

  // Willpower, Humanity, Blood Pool
  const wpMatch = allText.match(/Willpower[\s:]+(\d+)/i);
  if (wpMatch) stats.willpower = parseInt(wpMatch[1], 10);
  const humMatch = allText.match(/Humanity[\s:]+(\d+)/i);
  if (humMatch) stats.humanity = parseInt(humMatch[1], 10);
  const bpMatch = allText.match(/Blood\s*Pool[\s:]+(\d+)/i);
  if (bpMatch) stats.bloodPool = parseInt(bpMatch[1], 10);
  const hungerMatch = allText.match(/Hunger[\s:]+(\d+)/i);
  if (hungerMatch) stats.hunger = parseInt(hungerMatch[1], 10);
  const potencyMatch = allText.match(/Blood\s*Potency[\s:]+(\d+)/i);
  if (potencyMatch) stats.bloodPotency = parseInt(potencyMatch[1], 10);

  // Backgrounds
  const bgLine = notes.match(/Backgrounds?:\s*(.+)/i);
  if (bgLine) stats.backgrounds = bgLine[1].trim();

  return stats;
}

// Check if stats object has any meaningful data
function hasAnyStats(stats) {
  if (!stats) return false;
  return (
    Object.keys(stats.attributes || {}).length > 0 ||
    Object.keys(stats.abilities || {}).length > 0 ||
    (stats.disciplines || []).length > 0 ||
    stats.willpower || stats.humanity || stats.generation ||
    stats.bloodPool || stats.hunger || stats.bloodPotency
  );
}

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
      <span style={{ fontSize: 15, color: value > 0 ? "#e8dcc6" : "#c4b899", minWidth: 110,
        fontWeight: value > 0 ? 600 : 400 }}>{label}</span>
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
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
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
  const hasAutoPopulated = useRef(false);

  // Auto-populate stats from notes/backstory on first open if sheet is empty
  useEffect(() => {
    if (hasAutoPopulated.current) return;
    if (hasAnyStats(stats)) return; // already has data, don't overwrite

    const parsed = parseNotesIntoStats(character);
    if (!hasAnyStats(parsed)) return; // nothing found in notes either

    hasAutoPopulated.current = true;

    // Detect V5 vs V20 from parsed data
    let detectedEdition = edition;
    if (parsed.hunger || parsed.bloodPotency) detectedEdition = "v5";
    else if (parsed.generation || parsed.bloodPool || Object.keys(parsed.virtues || {}).length > 0) detectedEdition = "v20";
    // Also check attribute names: Composure/Resolve = V5, Appearance/Perception = V20
    if (parsed.attributes?.composure || parsed.attributes?.resolve) detectedEdition = "v5";
    if (parsed.attributes?.appearance || parsed.attributes?.perception) detectedEdition = "v20";

    const newStats = {
      ...parsed,
      edition: detectedEdition,
    };
    setEdition(detectedEdition);
    onStatsChange(newStats);
  }, [character.notes, character.backstory]);

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

  // Re-parse from notes (manual trigger)
  const reParseFromNotes = useCallback(() => {
    const parsed = parseNotesIntoStats(character);
    if (!hasAnyStats(parsed)) return;
    // Merge: parsed values fill in where stats are 0/empty, but don't overwrite existing nonzero
    const merged = { ...stats };
    // Attributes
    merged.attributes = { ...(merged.attributes || {}) };
    for (const [k, v] of Object.entries(parsed.attributes || {})) {
      if (!merged.attributes[k]) merged.attributes[k] = v;
    }
    // Abilities
    merged.abilities = { ...(merged.abilities || {}) };
    for (const [k, v] of Object.entries(parsed.abilities || {})) {
      if (!merged.abilities[k]) merged.abilities[k] = v;
    }
    // Disciplines
    const existingDiscNames = (merged.disciplines || []).map(d => d.name.toLowerCase());
    const newDiscs = (parsed.disciplines || []).filter(d => !existingDiscNames.includes(d.name.toLowerCase()));
    merged.disciplines = [...(merged.disciplines || []), ...newDiscs];
    // Virtues
    merged.virtues = { ...(merged.virtues || {}) };
    for (const [k, v] of Object.entries(parsed.virtues || {})) {
      if (!merged.virtues[k]) merged.virtues[k] = v;
    }
    // Scalars
    if (!merged.willpower && parsed.willpower) merged.willpower = parsed.willpower;
    if (!merged.humanity && parsed.humanity) merged.humanity = parsed.humanity;
    if (!merged.generation && parsed.generation) merged.generation = parsed.generation;
    if (!merged.bloodPool && parsed.bloodPool) merged.bloodPool = parsed.bloodPool;
    if (!merged.hunger && parsed.hunger) merged.hunger = parsed.hunger;
    if (!merged.bloodPotency && parsed.bloodPotency) merged.bloodPotency = parsed.bloodPotency;
    if (!merged.meritsFlaws && parsed.meritsFlaws) merged.meritsFlaws = parsed.meritsFlaws;
    if (!merged.backgrounds && parsed.backgrounds) merged.backgrounds = parsed.backgrounds;

    onStatsChange(merged);
  }, [character, stats, onStatsChange]);

  const ATTRIBUTES = edition === "v5" ? V5_ATTRIBUTES : V20_ATTRIBUTES;
  const SKILLS = edition === "v5" ? V5_SKILLS : V20_ABILITIES;
  const skillLabel = edition === "v5" ? "Skills" : "Abilities";

  // Count filled stats for the badge
  const filledCount = Object.values(stats.attributes || {}).filter(v => v > 0).length
    + Object.values(stats.abilities || {}).filter(v => v > 0).length
    + (stats.disciplines || []).filter(d => d.value > 0).length;

  return (
    <div style={{ ...S.card, padding: 20 }} onClick={e => e.stopPropagation()}>
      {/* Edition Toggle + Re-parse button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, letterSpacing: 2, color: accent }}>
            Character Sheet
          </div>
          {filledCount > 0 && (
            <span style={{ fontSize: 12, color: "#6a8a4a", fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
              {filledCount} stats
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={(e) => { e.stopPropagation(); reParseFromNotes(); }}
            style={{ ...S.btn(accent), padding: "4px 10px", fontSize: 11 }}
            title="Re-read stats from character notes and fill missing values">
            ↻ Auto-fill from notes
          </button>
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
