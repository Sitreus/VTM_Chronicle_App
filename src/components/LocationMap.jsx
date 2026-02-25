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

export default function LocationMap({ locations, accent, onSelectLocation, mapData, onMapDataChange }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [positions, setPositions] = useState(mapData?.positions || {});
  const [bgImage, setBgImage] = useState(mapData?.bgImage || null);
  const [bgOpacity, setBgOpacity] = useState(mapData?.bgOpacity ?? 0.5);
  const svgRef = useRef(null);
  const fileRef = useRef(null);

  const W = 900, H = 600;
  const NODE_R = 28;
  const NODE_R_HOVER = 34;

  // Sync positions from saved mapData on load
  useEffect(() => {
    if (mapData?.positions) setPositions(mapData.positions);
    if (mapData?.bgImage) setBgImage(mapData.bgImage);
    if (mapData?.bgOpacity != null) setBgOpacity(mapData.bgOpacity);
  }, [mapData?.bgImage]);

  // Save to chronicle whenever positions or bg change (debounced)
  const saveTimeout = useRef(null);
  const persistMapData = useCallback((newPositions, newBg, newOpacity) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onMapDataChange({
        positions: newPositions ?? positions,
        bgImage: newBg !== undefined ? newBg : bgImage,
        bgOpacity: newOpacity !== undefined ? newOpacity : bgOpacity,
      });
    }, 500);
  }, [onMapDataChange, positions, bgImage, bgOpacity]);

  // Initialize positions in a spread layout
  const computedPositions = useMemo(() => {
    const pos = {};
    const cols = Math.ceil(Math.sqrt(locations.length));
    const cellW = (W - 140) / Math.max(cols, 1);
    const cellH = (H - 120) / Math.max(Math.ceil(locations.length / cols), 1);

    locations.forEach((loc, i) => {
      if (positions[loc.id]) {
        pos[loc.id] = positions[loc.id];
      } else {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const jitterX = ((parseInt(loc.id.slice(-4), 36) % 50) - 25);
        const jitterY = ((parseInt(loc.id.slice(-3), 36) % 40) - 20);
        pos[loc.id] = {
          x: 80 + col * cellW + cellW / 2 + jitterX,
          y: 70 + row * cellH + cellH / 2 + jitterY,
        };
      }
    });
    return pos;
  }, [locations, positions, W, H]);

  const handleMouseDown = useCallback((e, locId) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingId(locId);
  }, []);

  useEffect(() => {
    if (!draggingId) return;
    let didDrag = false;
    const handleMove = (e) => {
      didDrag = true;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.max(40, Math.min(W - 40, (e.clientX - rect.left) * (W / rect.width)));
      const y = Math.max(40, Math.min(H - 40, (e.clientY - rect.top) * (H / rect.height)));
      setPositions(prev => {
        const next = { ...prev, [draggingId]: { x, y } };
        return next;
      });
    };
    const handleUp = () => {
      if (didDrag) {
        // Save positions after drag
        setPositions(prev => {
          persistMapData(prev, undefined, undefined);
          return prev;
        });
      }
      setDraggingId(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [draggingId, W, H, persistMapData]);

  // Handle background map image upload
  const handleBgUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setBgImage(dataUrl);
      persistMapData(undefined, dataUrl, undefined);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [persistMapData]);

  const removeBg = useCallback(() => {
    setBgImage(null);
    persistMapData(undefined, null, undefined);
  }, [persistMapData]);

  const handleOpacityChange = useCallback((val) => {
    setBgOpacity(val);
    persistMapData(undefined, undefined, val);
  }, [persistMapData]);

  // Connection lines between same-controller locations
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
      {/* Map toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button style={{ ...S.btn(accent), padding: "6px 14px", fontSize: 13 }}
          onClick={() => fileRef.current?.click()}>
          🗺 Upload Map Image
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleBgUpload} />
        {bgImage && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#7a7068", fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>Opacity</span>
              <input type="range" min="0.1" max="1" step="0.05" value={bgOpacity}
                onChange={e => handleOpacityChange(parseFloat(e.target.value))}
                style={{ width: 80, accentColor: accent }} />
            </div>
            <button style={{ ...S.btn("#6a3333"), padding: "6px 12px", fontSize: 12 }}
              onClick={removeBg}>
              Remove Image
            </button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#3a3a45", fontFamily: "'Cinzel', serif", letterSpacing: 1 }}>
          Drag pins to reposition — Click to edit
        </span>
      </div>

      <svg ref={svgRef} width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", margin: "0 auto", cursor: draggingId ? "grabbing" : "default", borderRadius: 6, width: "100%", height: "auto" }}>
        {/* Background */}
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a25" strokeWidth="0.5" />
          </pattern>
          <clipPath id="mapClip">
            <rect width={W} height={H} rx="6" />
          </clipPath>
        </defs>
        <g clipPath="url(#mapClip)">
          <rect width={W} height={H} fill="#0a0a12" />
          {/* Uploaded background map */}
          {bgImage && (
            <image href={bgImage} x="0" y="0" width={W} height={H}
              preserveAspectRatio="xMidYMid slice" opacity={bgOpacity} />
          )}
          {/* Grid overlay (subtle, behind pins) */}
          {!bgImage && <rect width={W} height={H} fill="url(#mapgrid)" />}

          {/* City label (only when no bg image) */}
          {!bgImage && (
            <text x={W / 2} y={28} textAnchor="middle" fill={`${accent}40`}
              fontSize={14} fontFamily="'Cinzel', serif" letterSpacing="5">
              CITY MAP
            </text>
          )}

          {/* Connection lines */}
          {connections.map((conn, i) => {
            const from = computedPositions[conn.from];
            const to = computedPositions[conn.to];
            if (!from || !to) return null;
            return (
              <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={`${accent}35`} strokeWidth={2} strokeDasharray="8,5" />
            );
          })}

          {/* Location pin nodes */}
          {locations.map(loc => {
            const pos = computedPositions[loc.id];
            if (!pos) return null;
            const color = typeColors[loc.type] || typeColors.other;
            const isHovered = hoveredId === loc.id;
            const isDragging = draggingId === loc.id;
            const r = isHovered || isDragging ? NODE_R_HOVER : NODE_R;

            return (
              <g key={loc.id}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
                onMouseDown={e => handleMouseDown(e, loc.id)}
                onMouseEnter={() => !draggingId && setHoveredId(loc.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => !draggingId && onSelectLocation(loc)}>

                {/* Drop shadow */}
                <ellipse cx={pos.x + 2} cy={pos.y + r + 4} rx={r * 0.7} ry={4}
                  fill="rgba(0,0,0,0.3)" />

                {/* Glow on hover */}
                {(isHovered || isDragging) && (
                  <circle cx={pos.x} cy={pos.y} r={r + 10} fill={`${color}12`} />
                )}

                {/* Pin body — outer ring */}
                <circle cx={pos.x} cy={pos.y} r={r}
                  fill={`${color}30`} stroke={color}
                  strokeWidth={isHovered || isDragging ? 3.5 : 2.5} />

                {/* Inner darker circle */}
                <circle cx={pos.x} cy={pos.y} r={r * 0.65}
                  fill={bgImage ? "rgba(10,10,18,0.75)" : `${color}15`} />

                {/* Icon — bigger */}
                <text x={pos.x} y={pos.y + 7} textAnchor="middle" dominantBaseline="middle"
                  fontSize={22}>{typeIcons[loc.type] || "📍"}</text>

                {/* Label background for readability on map images */}
                {bgImage && (
                  <rect
                    x={pos.x - (Math.min(loc.name.length, 20) * 3.5 + 8)}
                    y={pos.y + r + 4}
                    width={Math.min(loc.name.length, 20) * 7 + 16}
                    height={18}
                    rx={4}
                    fill="rgba(8,8,13,0.85)"
                  />
                )}

                {/* Name label */}
                <text x={pos.x} y={pos.y + r + 17} textAnchor="middle"
                  fill="#e8dcc6" fontSize={13} fontWeight="600"
                  fontFamily="'Cinzel', serif" letterSpacing="0.5">
                  {loc.name.length > 20 ? loc.name.slice(0, 18) + "…" : loc.name}
                </text>

                {/* Controller sub-label */}
                {loc.controlledBy && (
                  <>
                    {bgImage && (
                      <rect
                        x={pos.x - (loc.controlledBy.length * 2.5 + 6)}
                        y={pos.y + r + 21}
                        width={loc.controlledBy.length * 5 + 12}
                        height={14}
                        rx={3}
                        fill="rgba(8,8,13,0.7)"
                      />
                    )}
                    <text x={pos.x} y={pos.y + r + 31} textAnchor="middle"
                      fill={`${accent}90`} fontSize={10} fontFamily="'Cinzel', serif">
                      {loc.controlledBy}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
        {Object.entries(typeColors).filter(([type]) =>
          locations.some(l => l.type === type)
        ).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#7a7068" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, border: `1.5px solid ${color}` }} />
            <span style={{ fontSize: 15 }}>{typeIcons[type]}</span> {type}
          </div>
        ))}
      </div>
    </div>
  );
}
