import { memo, useMemo } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default memo(function TimelineTab() {
  const { chronicleData, accent } = useChronicle();

  const beats = chronicleData?.storyBeats || [];

  // Group by session — memoized so it only recomputes when beats change
  const { grouped, sortedKeys } = useMemo(() => {
    const g = {};
    beats.forEach(b => {
      const key = b.session || 0;
      if (!g[key]) g[key] = [];
      g[key].push(b);
    });
    const keys = Object.keys(g).sort((a, b) => Number(b) - Number(a));
    return { grouped: g, sortedKeys: keys };
  }, [beats]);

  return (
    <div>
      <div style={{ ...S.cardHeader, color: accent, marginBottom: 16 }}>Story Timeline</div>
      {sortedKeys.length === 0 ? (
        <EmptyState text="No story beats recorded. The pages are blank." />
      ) : (
        <div style={{ borderLeft: `2px solid ${accent}30`, marginLeft: 20, paddingLeft: 24 }}>
          {sortedKeys.map(key => (
            <div key={key} style={{ marginBottom: 24, position: "relative" }}>
              <div style={{
                position: "absolute", left: -33, top: 4, width: 16, height: 16, borderRadius: "50%",
                background: `${accent}30`, border: `2px solid ${accent}`, boxSizing: "border-box",
              }} />
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 23, letterSpacing: 2, color: accent, marginBottom: 8 }}>
                Session {key}
                {grouped[key][0]?.date && <span style={{ color: "#7a7068", marginLeft: 10 }}>{grouped[key][0].date}</span>}
              </div>
              {grouped[key].map(beat => (
                <div key={beat.id} style={{ fontSize: 25, lineHeight: 1.6, color: "#d4c8ae", marginBottom: 4 }}>
                  <span style={{ color: "#a09888", marginRight: 8 }}>▸</span>{beat.text}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
