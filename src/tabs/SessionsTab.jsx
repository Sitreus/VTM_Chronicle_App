import { memo } from "react";
import { S } from "../styles.js";
import { useChronicle } from "../context/ChronicleContext.jsx";
import useChronicleActions from "../hooks/useChronicleActions.js";
import EmptyState from "../components/EmptyState.jsx";
import SessionCard from "../components/SessionCard.jsx";

export default memo(function SessionsTab() {
  const { chronicleData, accent, setModalData, setShowModal, sessionFileRef } = useChronicle();
  const { deleteSession } = useChronicleActions();

  const cd = chronicleData || { sessions: [] };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ ...S.cardHeader, margin: 0, color: accent }}>Session Logs</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn(accent)} onClick={() => { setModalData({}); setShowModal("newSession"); setTimeout(() => sessionFileRef.current?.click(), 300); }}>
            📄 Upload .md
          </button>
          <button style={S.btnFilled(accent)} onClick={() => { setModalData({}); setShowModal("newSession"); }}>
            + New Session
          </button>
        </div>
      </div>
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
