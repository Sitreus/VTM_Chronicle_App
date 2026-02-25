import { memo, useState } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";
import SessionCard from "../components/SessionCard.jsx";
import SessionDiff from "../components/SessionDiff.jsx";

export default memo(function SessionsTab() {
  const { chronicleData, accent, setModalData, setShowModal, sessionFileRef } = useChronicle();
  const { deleteSession } = useChronicleActions();
  const [showDiff, setShowDiff] = useState(false);

  const cd = chronicleData || { sessions: [] };
  const hasSessions = (cd.sessions?.length || 0) > 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Session Logs</div>
          {hasSessions && cd.sessions.length >= 2 && (
            <button
              onClick={() => setShowDiff(v => !v)}
              style={{
                ...S.btn(accent), padding: "5px 12px", fontSize: 12,
                background: showDiff ? `${accent}15` : "transparent",
              }}>
              {showDiff ? "Hide Compare" : "📊 Compare"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn(accent)} onClick={() => { setModalData({}); setShowModal("newSession"); setTimeout(() => sessionFileRef.current?.click(), 300); }}>
            📄 Upload .md
          </button>
          <button style={S.btnFilled(accent)} onClick={() => { setModalData({}); setShowModal("newSession"); }}>
            + New Session
          </button>
        </div>
      </div>

      {/* Session Comparison */}
      {showDiff && cd.sessions?.length >= 2 && (
        <SessionDiff sessions={cd.sessions} accent={accent} />
      )}

      {cd.sessions?.length === 0 ? (
        <EmptyState text="No sessions recorded yet. The chronicle awaits." />
      ) : (
        [...cd.sessions].reverse().map((s, i) => (
          <SessionCard key={s.id} session={s} accent={accent} index={i}
            onView={(ses) => { setModalData(ses); setShowModal("viewLog"); }}
            onDelete={deleteSession} />
        ))
      )}
    </div>
  );
});
