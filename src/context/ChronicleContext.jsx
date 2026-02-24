import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { GAME_TYPES, CARD_AUDIO_FILES } from "../constants.js";
import { GAME_BACKGROUNDS, DEFAULT_BG } from "../splashImages.js";
import { storageGet, storageSet } from "../utils/storage.js";
import useAudio from "../audio/useAudio.js";

const ChronicleContext = createContext(null);

export function ChronicleProvider({ children }) {
  const [chronicles, setChronicles] = useState([]);
  const [activeChronicleId, setActiveChronicleId] = useState(null);
  const [chronicleData, setChronicleData] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [showModal, setShowModal] = useState(null);
  const [modalData, setModalData] = useState({});
  const [searchFilter, setSearchFilter] = useState("");
  const [npcRelFilter, setNpcRelFilter] = useState("");
  const [npcFactionFilter, setNpcFactionFilter] = useState("");
  const [parseStatus, setParseStatus] = useState(null);
  const [recapText, setRecapText] = useState(null);
  const [npcViewMode, setNpcViewMode] = useState("cards");
  const [confirmAction, setConfirmAction] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashPhase, setSplashPhase] = useState("welcome");
  const [activeGameType, setActiveGameType] = useState(null);
  const [selectedSplashCard, setSelectedSplashCard] = useState(null);
  const [splashTransition, setSplashTransition] = useState(null);
  const [modalEntrance, setModalEntrance] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");

  const fileInputRef = useRef(null);
  const sessionFileRef = useRef(null);
  const characterFileRef = useRef(null);
  const activeChronicleIdRef = useRef(activeChronicleId);
  activeChronicleIdRef.current = activeChronicleId;
  const chronicleDataRef = useRef(chronicleData);
  chronicleDataRef.current = chronicleData;

  const audio = useAudio();

  // Derived values
  const activeChronicle = chronicles.find(c => c.id === activeChronicleId);
  const gameType = activeChronicle ? GAME_TYPES.find(g => g.id === activeChronicle.gameType) : null;
  const accent = gameType?.accent || "#c41e3a";
  const gameBg = activeGameType ? GAME_BACKGROUNDS[activeGameType] : (gameType ? GAME_BACKGROUNDS[gameType.id] : null);
  const bgImage = gameBg || DEFAULT_BG;
  const currentGameTypeId = activeGameType || (gameType ? gameType.id : null);

  // Flush current chronicle data to storage before switching away
  const saveBeforeSwitch = useCallback(async () => {
    const curId = activeChronicleIdRef.current;
    const curData = chronicleDataRef.current;
    if (curId && curData) {
      await storageSet(`wod-chr-${curId}`, curData);
    }
  }, []);

  // Save helpers
  const saveChronicles = useCallback(async (newList) => {
    setChronicles(newList);
    await storageSet("wod-chronicles", { chronicles: newList });
  }, []);

  const saveChronicleData = useCallback(async (newData) => {
    const chrId = activeChronicleIdRef.current;
    if (!chrId) return;
    setChronicleData(newData);
    await storageSet(`wod-chr-${chrId}`, newData);
  }, []);

  // Load chronicles list
  useEffect(() => {
    (async () => {
      const data = await storageGet("wod-chronicles");
      if (data?.chronicles) {
        let migrated = false;
        const updated = data.chronicles.map(c => {
          if (c.gameType === "htv") { migrated = true; return { ...c, gameType: "htr" }; }
          return c;
        });
        if (migrated) await storageSet("wod-chronicles", { ...data, chronicles: updated });
        setChronicles(updated);
      }
      const savedGameType = await storageGet("wod-active-game-type");
      if (savedGameType) setActiveGameType(savedGameType);
      const savedKey = await storageGet("wod-api-key");
      if (savedKey) setApiKey(savedKey);
      const savedProxy = await storageGet("wod-proxy-url");
      if (savedProxy) setProxyUrl(savedProxy);
      setLoading(false);
    })();
  }, []);

  // Audio: welcome music
  useEffect(() => {
    if (showSplash && (splashPhase === "welcome" || splashPhase === "fading")) {
      audio.onWelcomeScreenReady();
    }
  }, [showSplash, splashPhase]);

  // Audio: splash state
  useEffect(() => {
    if (showSplash && splashPhase === "select") {
      audio.onSplashEnter();
    }
  }, [showSplash, splashPhase, audio.isReady]);

  // When game type changes, select first matching chronicle
  useEffect(() => {
    if (!activeGameType || chronicles.length === 0) return;
    const curId = activeChronicleIdRef.current;
    const matching = chronicles.filter(c => c.gameType === activeGameType);
    if (matching.length > 0) {
      if (!curId || !matching.find(c => c.id === curId)) {
        saveBeforeSwitch();
        setActiveChronicleId(matching[0].id);
      }
    } else {
      setActiveChronicleId(null);
    }
  }, [activeGameType, chronicles.length, saveBeforeSwitch]);

  // Load chronicle data when selection changes
  useEffect(() => {
    if (!activeChronicleId) { setChronicleData(null); return; }
    let cancelled = false;
    (async () => {
      const data = await storageGet(`wod-chr-${activeChronicleId}`);
      if (!cancelled) {
        setChronicleData(data || { sessions: [], npcs: [], characters: [], storyBeats: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [activeChronicleId]);

  const handleSplashSelect = useCallback(async (gameId) => {
    if (selectedSplashCard) return;
    setSelectedSplashCard(gameId);
    audio.onGameLineSelect(gameId);
    setTimeout(() => {
      setSplashTransition(gameId);
      setTimeout(async () => {
        setActiveGameType(gameId);
        await storageSet("wod-active-game-type", gameId);
        setShowSplash(false);
        audio.onSplashExit();
        setSplashTransition(null);
        setSelectedSplashCard(null);
        const matching = chronicles.filter(c => c.gameType === gameId);
        if (matching.length > 0) {
          saveBeforeSwitch();
          setActiveChronicleId(matching[0].id);
        }
      }, 1125);
    }, 600);
  }, [selectedSplashCard, chronicles, audio, saveBeforeSwitch]);

  const value = {
    // State
    chronicles, setChronicles,
    activeChronicleId, setActiveChronicleId,
    chronicleData, setChronicleData,
    activeTab, setActiveTab,
    loading,
    parsing, setParsing,
    showModal, setShowModal,
    modalData, setModalData,
    searchFilter, setSearchFilter,
    npcRelFilter, setNpcRelFilter,
    npcFactionFilter, setNpcFactionFilter,
    parseStatus, setParseStatus,
    recapText, setRecapText,
    npcViewMode, setNpcViewMode,
    confirmAction, setConfirmAction,
    showSplash, setShowSplash,
    splashPhase, setSplashPhase,
    activeGameType, setActiveGameType,
    selectedSplashCard,
    splashTransition,
    modalEntrance, setModalEntrance,
    apiKey, setApiKey,
    proxyUrl, setProxyUrl,

    // Refs
    fileInputRef, sessionFileRef, characterFileRef,
    activeChronicleIdRef, chronicleDataRef,

    // Audio
    audio,

    // Derived
    activeChronicle, gameType, accent, gameBg, bgImage, currentGameTypeId,

    // Core actions
    saveBeforeSwitch, saveChronicles, saveChronicleData,
    handleSplashSelect,
  };

  return (
    <ChronicleContext.Provider value={value}>
      {children}
    </ChronicleContext.Provider>
  );
}

export function useChronicle() {
  const ctx = useContext(ChronicleContext);
  if (!ctx) throw new Error("useChronicle must be used within ChronicleProvider");
  return ctx;
}
