import { FONTS_URL, GAME_TYPES, TABS, CARD_AUDIO_FILES } from "./constants.js";
import { S } from "./styles.js";
import { ChronicleProvider, useChronicle } from "./context/ChronicleContext.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import AudioControl from "./components/AudioControl.jsx";
import DynamicBackground from "./components/DynamicBackground.jsx";
import DashboardTab from "./tabs/DashboardTab.jsx";
import SessionsTab from "./tabs/SessionsTab.jsx";
import NPCsTab from "./tabs/NPCsTab.jsx";
import CharactersTab from "./tabs/CharactersTab.jsx";
import FactionsTab from "./tabs/FactionsTab.jsx";
import LocationsTab from "./tabs/LocationsTab.jsx";
import ThreadsTab from "./tabs/ThreadsTab.jsx";
import TimelineTab from "./tabs/TimelineTab.jsx";
import ChronicleModals from "./modals/ChronicleModals.jsx";

function WorldOfDarknessInner() {
  const {
    chronicles, activeChronicleId, activeChronicle, activeTab, setActiveTab,
    loading, accent, bgImage, currentGameTypeId,
    showSplash, setShowSplash, splashPhase, setSplashPhase,
    selectedSplashCard, splashTransition, activeGameType,
    setShowModal, setModalData,
    apiKey, proxyUrl, parseStatus, setParseStatus,
    confirmAction, setConfirmAction,
    saveBeforeSwitch, setActiveChronicleId,
    handleSplashSelect, audio,
  } = useChronicle();

  if (loading) return (
    <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('${FONTS_URL}'); @keyframes wod-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.loading} />
    </div>
  );

  const renderConfirmModal = () => {
    if (!confirmAction) return null;
    return (
      <div style={{ ...S.modal, zIndex: 1100 }} onClick={() => setConfirmAction(null)}>
        <div style={{ ...S.modalContent, maxWidth: 440, textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 18, lineHeight: 1.6, color: "#e8dcc6", marginBottom: 24 }}>
            {confirmAction.msg}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button style={S.btn("#6a6058")} onClick={() => setConfirmAction(null)}>Cancel</button>
            <button style={{ ...S.btnFilled("#c41e3a"), background: "rgba(196,30,58,0.25)" }}
              onClick={confirmAction.onConfirm}>Delete</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('${FONTS_URL}');
        @keyframes wod-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a12; }
        ::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 3px; }
        ::selection { background: ${accent}40; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: ${accent}60; }
        button:hover { opacity: 0.85; }
      `}</style>
      {!showSplash && <DynamicBackground gameTypeId={currentGameTypeId} bgImage={bgImage} />}
      {!showSplash && !bgImage && <div style={S.noiseOverlay} />}
      {showSplash && <SplashScreen
        splashPhase={splashPhase} setSplashPhase={setSplashPhase}
        selectedSplashCard={selectedSplashCard} splashTransition={splashTransition}
        activeGameType={activeGameType} chronicles={chronicles}
        setShowSplash={setShowSplash} setShowModal={setShowModal} setModalData={setModalData}
        apiKey={apiKey} proxyUrl={proxyUrl}
        onSplashSelect={handleSplashSelect}
        audio={audio}
        cardAudioFiles={CARD_AUDIO_FILES}
      />}
      <div style={S.content}>
        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>World of Darkness</h1>
          <div style={S.subtitle}>Chronicle Database</div>
          <div style={S.bgBar}>
            <button style={{ ...S.bgBtn(false), letterSpacing: 1.5, fontFamily: "'Cinzel', serif", fontSize: 11 }}
              onClick={() => { saveBeforeSwitch(); setShowSplash(true); setSplashPhase("select"); }}>
              ◈ Selection Menu
            </button>
            <AudioControl audio={audio} />
          </div>
        </div>

        {/* Chronicle Selector */}
        <div style={S.chronicleBar}>
          {(() => {
            const filtered = activeGameType ? chronicles.filter(c => c.gameType === activeGameType) : chronicles;
            return filtered.length > 0 && (
              <select style={S.select} value={activeChronicleId || ""}
                onChange={e => { saveBeforeSwitch(); setActiveChronicleId(e.target.value); setActiveTab("dashboard"); }}>
                {filtered.map(c => {
                  const gt = GAME_TYPES.find(g => g.id === c.gameType);
                  return <option key={c.id} value={c.id}>{gt?.icon} {c.name}</option>;
                })}
              </select>
            );
          })()}
          <button style={S.btnFilled(accent)} onClick={() => { setModalData({ gameType: activeGameType || "vtm" }); setShowModal("newChronicle"); }}>
            + New Chronicle
          </button>
        </div>

        {/* Tabs */}
        {activeChronicle && (
          <div style={S.tabs}>
            {TABS.map(t => (
              <div key={t.id} style={S.tab(activeTab === t.id, accent)}
                onClick={() => { setActiveTab(t.id); audio.onTabChange(); }}>
                <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
              </div>
            ))}
          </div>
        )}

        {/* Parse Status Banner */}
        {parseStatus && (
          <div style={{
            padding: "12px 18px", marginBottom: 16, borderRadius: 6,
            background: parseStatus.type === "success" ? "rgba(74,140,63,0.15)" : "rgba(196,30,58,0.15)",
            border: `1px solid ${parseStatus.type === "success" ? "#4a8c3f40" : "#c41e3a40"}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 16, color: parseStatus.type === "success" ? "#8bc47a" : "#e88080" }}>
              {parseStatus.type === "success" ? "✓ " : "⚠ "}{parseStatus.msg}
            </span>
            <button onClick={() => setParseStatus(null)} style={{
              background: "none", border: "none", color: "#6a6058", cursor: "pointer", fontSize: 16,
            }}>✕</button>
          </div>
        )}

        {/* Content — each tab is now its own component */}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "sessions" && <SessionsTab />}
        {activeTab === "npcs" && <NPCsTab />}
        {activeTab === "characters" && <CharactersTab />}
        {activeTab === "factions" && <FactionsTab />}
        {activeTab === "locations" && <LocationsTab />}
        {activeTab === "threads" && <ThreadsTab />}
        {activeTab === "timeline" && <TimelineTab />}
      </div>

      {/* Modals */}
      <ChronicleModals />
      {renderConfirmModal()}
    </div>
  );
}

export default function WorldOfDarkness() {
  return (
    <ChronicleProvider>
      <WorldOfDarknessInner />
    </ChronicleProvider>
  );
}
