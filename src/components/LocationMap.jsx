import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { S } from "../styles.js";

const typeIcons = {
  haven: "🏚", elysium: "🏛", bar: "🍷", street: "🌃", leyNode: "✨",
  church: "⛪", graveyard: "⚰", warehouse: "🏭", mansion: "🏰", other: "📍",
};

const typeColors = {
  haven: "#8a4ac4", elysium: "#c4a01e", bar: "#c44a6a", street: "#6a8a9a",
  leyNode: "#4ac48a", church: "#c4c44a", graveyard: "#6a6a8a", warehouse: "#8a6a4a",
  mansion: "#c41e3a", other: "#5a5a5a",
};

export default function LocationMap({ locations, accent, onSelectLocation }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [positions, setPositions] = useState({});
  const svgRef = useRef(null);

  const W = 800, H = 500;

  // Initialize positions in a city-like grid layout
  const computedPositions = useMemo(() => {
    const pos = {};
    const cols = Math.ceil(Math.sqrt(locations.length));
    const cellW = (W - 100) / Math.max(cols, 1);
    const cellH = (H - 80) / Math.max(Math.ceil(locations.length / cols), 1);

    locations.forEach((loc, i) => {
      if (positions[loc.id]) {
        pos[loc.id] = positions[loc.id];
      } else {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Add some natural variation
        const jitterX = ((parseInt(loc.id.slice(-4), 36) % 40) - 20);
        const jitterY = ((parseInt(loc.id.slice(-3), 36) % 30) - 15);
        pos[loc.id] = {
          x: 60 + col * cellW + cellW / 2 + jitterX,
          y: 50 + row * cellH + cellH / 2 + jitterY,
        };
      }
    });
    return pos;
  }, [locations, positions, W, H]);

  const handleMouseDown = useCallback((e, locId) => {
    e.stopPropagation();
    setDraggingId(locId);
  }, []);

  useEffect(() => {
    if (!draggingId) return;
    const handleMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.max(30, Math.min(W - 30, (e.clientX - rect.left) * (W / rect.width)));
      const y = Math.max(30, Math.min(H - 30, (e.clientY - rect.top) * (H / rect.height)));
      setPositions(prev => ({ ...prev, [draggingId]: { x, y } }));
    };
    const handleUp = () => setDraggingId(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [draggingId, W, H]);

  // Draw connections between locations controlled by same entity
  const connections = useMemo(() => {
    const lines = [];
    const controllerMap = {};
    locations.forEach(loc => {
      if (loc.controlledBy) {
        const key = loc.controlledBy.toLowerCase();
        if (!controllerMap[key]) controllerMap[key] = [];
        controllerMap[key].push(loc.id);
      }
    });
    Object.values(controllerMap).forEach(ids => {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          lines.push({ from: ids[i], to: ids[j] });
        }
      }
    });
    return lines;
  }, [locations]);

  return (
    <div style={{ ...S.card, padding: 16, overflow: "auto" }}>
      <svg ref={svgRef} width={W} height={H} style={{ display: "block", margin: "0 auto", cursor: draggingId ? "grabbing" : "default" }}>
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a25" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#0a0a12" rx="6" />
        <rect width={W} height={H} fill="url(#grid)" rx="6" />

        {/* City label */}
        <text x={W / 2} y={24} textAnchor="middle" fill={`${accent}40`}
          fontSize={12} fontFamily="'Cinzel', serif" letterSpacing="4">
          CITY MAP
        </text>

        {/* Connection lines */}
        {connections.map((conn, i) => {
          const from = computedPositions[conn.from];
          const to = computedPositions[conn.to];
          if (!from || !to) return null;
          return (
            <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={`${accent}25`} strokeWidth={1.5} strokeDasharray="6,4" />
          );
        })}

        {/* Location nodes */}
        {locations.map(loc => {
          const pos = computedPositions[loc.id];
          if (!pos) return null;
          const color = typeColors[loc.type] || typeColors.other;
          const isHovered = hoveredId === loc.id;
          const r = isHovered ? 24 : 20;

          return (
            <g key={loc.id}
              style={{ cursor: draggingId === loc.id ? "grabbing" : "grab" }}
              onMouseDown={e => handleMouseDown(e, loc.id)}
              onMouseEnter={() => setHoveredId(loc.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => !draggingId && onSelectLocation(loc)}>
              {/* Glow effect */}
              {isHovered && <circle cx={pos.x} cy={pos.y} r={r + 8} fill={`${color}15`} />}
              {/* Main circle */}
              <circle cx={pos.x} cy={pos.y} r={r}
                fill={`${color}20`} stroke={color} strokeWidth={isHovered ? 3 : 2} />
              {/* Icon */}
              <text x={pos.x} y={pos.y + 5} textAnchor="middle" dominantBaseline="middle"
                fontSize={16}>{typeIcons[loc.type] || "📍"}</text>
              {/* Name */}
              <text x={pos.x} y={pos.y + r + 14} textAnchor="middle"
                fill="#e8dcc6" fontSize={11} fontFamily="'Cinzel', serif" letterSpacing="0.5">
                {loc.name.length > 18 ? loc.name.slice(0, 16) + "…" : loc.name}
              </text>
              {/* Controller tag */}
              {loc.controlledBy && (
                <text x={pos.x} y={pos.y + r + 26} textAnchor="middle"
                  fill={`${accent}80`} fontSize={9} fontFamily="'Cinzel', serif">
                  {loc.controlledBy}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
        {Object.entries(typeColors).filter(([type]) =>
          locations.some(l => l.type === type)
        ).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#7a7068" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            {typeIcons[type]} {type}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#3a3a45", marginTop: 6, fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
        Drag to reposition — Click to edit
      </div>
    </div>
  );
}
