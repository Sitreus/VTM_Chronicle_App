import { useState, useRef, useEffect, useCallback } from "react";
import { GAME_TYPES, FONTS_URL } from "../constants.js";
import { GAME_SPLASH_DATA } from "../splashImages.js";
import AudioControl from "./AudioControl.jsx";
import SmokeCanvas from "./SmokeCanvas.jsx";

export default function SplashScreen({
  splashPhase, setSplashPhase,
  selectedSplashCard, splashTransition,
  activeGameType, chronicles,
  setShowSplash, setShowModal, setModalData,
  apiKey, proxyUrl,
  onSplashSelect,
  audio,
  cardAudioFiles,
}) {
  const splashGames = GAME_TYPES.filter(g => g.id !== "mixed");
  const [hoveredCard, setHoveredCard] = useState(null);
  const [cardsReady, setCardsReady] = useState(false);
  const idleTimerRef = useRef(null);
  const idleStageRef = useRef(0); // 0 = none, 1 = first audio played, 2 = second audio played
  const audioElementRef = useRef(null);

  // Idle audio: when a card is hovered (selected via hover) and not clicked for 10s/20s
  const clearIdleTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    idleStageRef.current = 0;
  }, []);

  const playCardAudio = useCallback((gameId, audioIndex) => {
    if (!cardAudioFiles?.[gameId]?.[audioIndex]) return;
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    const el = new Audio(cardAudioFiles[gameId][audioIndex]);
    el.volume = 0.6;
    el.play().catch(() => {});
    audioElementRef.current = el;
  }, [cardAudioFiles]);

  const startIdleTimer = useCallback((gameId) => {
    clearIdleTimers();
    // First audio after 10 seconds of no click
    idleTimerRef.current = setTimeout(() => {
      playCardAudio(gameId, 0);
      idleStageRef.current = 1;
      // Second audio after another 10 seconds
      idleTimerRef.current = setTimeout(() => {
        playCardAudio(gameId, 1);
        idleStageRef.current = 2;
        idleTimerRef.current = null;
      }, 10000);
    }, 10000);
  }, [clearIdleTimers, playCardAudio]);

  const handleCardHover = useCallback((gameId) => {
    setHoveredCard(gameId);
    startIdleTimer(gameId);
  }, [startIdleTimer]);

  const handleCardLeave = useCallback(() => {
    setHoveredCard(null);
    clearIdleTimers();
  }, [clearIdleTimers]);

  const handleCardClick = useCallback((gameId) => {
    clearIdleTimers();
    onSplashSelect(gameId);
  }, [clearIdleTimers, onSplashSelect]);

  // Mark cards as interactable after entrance animation finishes
  useEffect(() => {
    if (splashPhase === "select") {
      setCardsReady(false);
      const totalAnimTime = (splashGames.length - 1) * 180 + 1200; // last card delay + duration
      const timer = setTimeout(() => setCardsReady(true), totalAnimTime);
      return () => clearTimeout(timer);
    }
  }, [splashPhase, splashGames.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearIdleTimers();
  }, [clearIdleTimers]);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#08080d",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      overflowX: "hidden", overflowY: "auto",
    }}>
      <style>{`
        @import url('${FONTS_URL}');
        @keyframes splashFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes splashFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.08); pointer-events: none; }
        }
        @keyframes stingerFlash {
          0% { opacity: 0; }
          15% { opacity: 0.08; }
          50% { opacity: 0.03; }
          100% { opacity: 0; }
        }
        @keyframes splashSelectIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes splashTitleGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(196,30,58,0.3), 0 0 60px rgba(196,30,58,0.1); }
          50% { text-shadow: 0 0 40px rgba(196,30,58,0.5), 0 0 100px rgba(196,30,58,0.2); }
        }
        @keyframes splashLineExpand { from { width: 0; } to { width: 200px; } }
        @keyframes cardEmerge {
          0% { opacity: 0; transform: scale(0.7) translateY(60px); filter: blur(12px) brightness(0.2); }
          40% { opacity: 0.6; transform: scale(0.92) translateY(20px); filter: blur(4px) brightness(0.5); }
          70% { opacity: 0.9; transform: scale(1.03) translateY(-4px); filter: blur(1px) brightness(0.85); }
          85% { transform: scale(0.99) translateY(2px); filter: blur(0px) brightness(0.95); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px) brightness(1); }
        }
        @keyframes subtitleFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .splash-card {
          position: relative; cursor: pointer; border-radius: 12px;
          overflow: hidden;
          transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      border-color 0.4s ease, opacity 0.4s ease,
                      margin 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          border: 1px solid rgba(255,255,255,0.06);
          flex: 1 1 0; min-width: 0; max-width: 289px;
        }
        .splash-card.splash-card-locked {
          pointer-events: none;
        }
        .splash-card.splash-card-hovered {
          transform: scale(1.2);
          z-index: 10;
          border-color: rgba(255,255,255,0.2);
          margin: 0 15px;
        }
        .splash-card.splash-card-sibling-hovered {
          transform: scale(0.88);
          opacity: 0.75;
        }
        .splash-card.splash-card-hovered .splash-card-overlay { opacity: 0.4; }
        .splash-card.splash-card-hovered .splash-card-glow { opacity: 1; }
        .splash-card img {
          width: 100%; height: 425px; object-fit: cover; display: block;
          filter: brightness(0.5) saturate(0) contrast(0.9);
          transition: all 0.6s ease;
        }
        .splash-card.splash-card-hovered img { filter: brightness(0.8) saturate(0.7); }
        .splash-card.splash-card-selected img { filter: brightness(0.9) saturate(1.2); }
        .splash-card.splash-card-selected {
          transform: scale(1.18);
          border-color: rgba(255,255,255,0.25);
          z-index: 10;
        }
        .splash-card.splash-card-selected.splash-card-hovered {
          transform: scale(1.2);
          margin: 0 15px;
        }
        .splash-card.splash-card-selected .splash-card-glow { opacity: 1; }
        .splash-card.splash-card-selected .splash-card-overlay { opacity: 0.3; }
        .splash-skip {
          position: absolute; top: 24px; right: 32px;
          background: none; border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.4); padding: 8px 20px; border-radius: 20px;
          font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 2px;
          cursor: pointer; transition: all 0.3s ease; text-transform: uppercase;
          z-index: 10;
        }
        .splash-skip:hover {
          color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.03);
        }
        @keyframes transitionFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bloodDrip {
          0% { transform: translateY(-100%); }
          60% { transform: translateY(0%); }
          100% { transform: translateY(0%); }
        }
        @keyframes arcaneShatter {
          0% { transform: scale(0); opacity: 0; }
          40% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(3); opacity: 1; }
        }
        @keyframes clawTear {
          0% { transform: scaleX(0); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes ghostShroud {
          0% { opacity: 0; filter: blur(30px); }
          50% { opacity: 0.7; filter: blur(10px); }
          100% { opacity: 1; filter: blur(0px); }
        }
        @keyframes hunterFocus {
          0% { transform: scale(3); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes dreamShimmer {
          0% { opacity: 0; filter: hue-rotate(0deg) blur(20px); }
          50% { opacity: 0.8; filter: hue-rotate(60deg) blur(5px); }
          100% { opacity: 1; filter: hue-rotate(120deg) blur(0px); }
        }
      `}</style>

      {/* Ambient background noise */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.08,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />

      {/* Canvas smoke VFX */}
      <SmokeCanvas />

      {/* API Key setup button */}
      <button style={{
        position: "absolute", top: 24, left: 32,
        background: "none", border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.45)", padding: "8px 18px", borderRadius: 20,
        fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 2,
        cursor: "pointer", transition: "all 0.3s ease", textTransform: "uppercase",
        zIndex: 10, display: "flex", alignItems: "center", gap: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "none"; }}
      onClick={() => { setShowModal("settings"); setModalData({ apiKey, proxyUrl }); }}>
        <span style={{ fontSize: 16 }}>&#x2699;</span> Set API Key
      </button>

      {/* Audio mute control */}
      <div style={{ position: "absolute", top: 24, right: activeGameType ? 140 : 32, zIndex: 10 }}>
        <AudioControl audio={audio} />
      </div>

      {/* Skip button */}
      {activeGameType && (
        <button className="splash-skip" onClick={() => setShowSplash(false)}>
          Skip →
        </button>
      )}

      {splashPhase === "welcome" || splashPhase === "fading" ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          animation: splashPhase === "fading" ? "splashFadeOut 1.125s ease forwards" : "splashFadeIn 2s ease forwards",
        }}>
          <div style={{
            fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 400,
            letterSpacing: 8, textTransform: "uppercase",
            color: "rgba(196,168,132,0.5)", marginBottom: 16,
            animation: "subtitleFade 1.5s ease 0.3s both",
          }}>
            Welcome to the
          </div>
          <h1 style={{
            fontFamily: "'Cinzel', serif", fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 900, color: "#e8dcc6", letterSpacing: 6,
            margin: "0 0 24px 0", textAlign: "center",
            animation: "splashTitleGlow 4s ease-in-out infinite",
            lineHeight: 1.1,
          }}>
            World of Darkness
          </h1>
          <div style={{
            height: 1, background: "linear-gradient(90deg, transparent, rgba(196,30,58,0.5), transparent)",
            animation: "splashLineExpand 2s ease 0.8s both",
            marginBottom: 40,
          }} />
          <button onClick={() => { setSplashPhase("fading"); audio?.onEnterDarkness(); setTimeout(() => setSplashPhase("select"), 1125); }} style={{
            background: "none", border: "1px solid rgba(196,30,58,0.3)",
            color: "#c4a884", padding: "14px 40px", borderRadius: 4,
            fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: 4,
            cursor: "pointer", transition: "all 0.3s ease",
            textTransform: "uppercase", animation: "subtitleFade 1.5s ease 1.5s both",
          }}
          onMouseEnter={e => { e.target.style.borderColor = "rgba(196,30,58,0.6)"; e.target.style.color = "#e8dcc6"; e.target.style.background = "rgba(196,30,58,0.08)"; }}
          onMouseLeave={e => { e.target.style.borderColor = "rgba(196,30,58,0.3)"; e.target.style.color = "#c4a884"; e.target.style.background = "none"; }}
          >
            Enter the Darkness
          </button>
        </div>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          animation: "splashSelectIn 0.8s ease forwards",
          width: "100%", maxWidth: 1900, padding: "0 24px",
          overflow: "visible",
        }}>
          <h2 style={{
            fontFamily: "'Cinzel', serif", fontSize: "clamp(24px, 4vw, 40px)",
            fontWeight: 700, color: "#e8dcc6", letterSpacing: 4,
            margin: "0 0 40px 0", textAlign: "center",
          }}>
            <span style={{ color: "rgba(196,168,132,0.4)" }}>Choose your</span>{" "}Darkness
          </h2>

          <div className="splash-cards-row" style={{
            display: "flex", gap: 18, justifyContent: "center", alignItems: "center",
            flexWrap: "nowrap", width: "100%", overflow: "visible",
            padding: "20px 0",
          }}>
            {splashGames.map((game, i) => {
              const splash = GAME_SPLASH_DATA[game.id];
              const isHovered = hoveredCard === game.id;
              const isSiblingHovered = hoveredCard && hoveredCard !== game.id;
              const cardClasses = [
                "splash-card",
                !cardsReady ? "splash-card-locked" : "",
                selectedSplashCard === game.id ? "splash-card-selected" : "",
                isHovered ? "splash-card-hovered" : "",
                isSiblingHovered ? "splash-card-sibling-hovered" : "",
              ].filter(Boolean).join(" ");
              return (
                <div key={game.id} className={cardClasses}
                  style={{ animationName: "cardEmerge", animationDuration: "1.2s",
                    animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationDelay: `${i * 0.18}s`,
                    animationFillMode: "backwards",
                  }}
                  onMouseEnter={() => cardsReady && handleCardHover(game.id)}
                  onMouseLeave={handleCardLeave}
                  onClick={() => cardsReady && handleCardClick(game.id)}
                >
                  <div className="splash-card-glow" style={{
                    position: "absolute", inset: -2, borderRadius: 14,
                    background: `linear-gradient(135deg, ${splash.glow}, transparent)`,
                    opacity: 0, transition: "opacity 0.4s ease", zIndex: -1,
                  }} />
                  {splash?.img ? <img src={splash.img} alt={game.label} /> : (
                    <div style={{
                      width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: selectedSplashCard === game.id
                        ? `linear-gradient(135deg, ${game.accent}40 0%, ${game.accent}15 100%)`
                        : "linear-gradient(135deg, #333 0%, #1a1a1a 100%)",
                      fontSize: 82,
                      filter: selectedSplashCard === game.id ? "saturate(1)" : "saturate(0) brightness(0.6)",
                      transition: "all 0.6s ease",
                    }}>{game.icon}</div>
                  )}
                  <div className="splash-card-overlay" style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: "70%",
                    background: `linear-gradient(to top, ${splash.color}dd 0%, ${splash.color}88 30%, transparent 100%)`,
                    opacity: 0.6, transition: "opacity 0.4s ease",
                  }} />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    padding: "20px 15px", textAlign: "center",
                  }}>
                    <div style={{
                      fontFamily: "'Cinzel', serif", fontSize: 17, fontWeight: 700,
                      color: "#fff", letterSpacing: 1.7, marginBottom: 7,
                      textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                    }}>
                      {game.label}
                    </div>
                    <div style={{
                      fontFamily: "'Cormorant Garamond', serif", fontSize: 14,
                      color: "rgba(255,255,255,0.7)", fontStyle: "italic",
                      lineHeight: 1.4, textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    }}>
                      {splash.tagline}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {chronicles.length > 0 && (
            <button onClick={() => setShowSplash(false)} style={{
              background: "none", border: "none",
              color: "rgba(196,168,132,0.4)", padding: "16px 24px",
              fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 3,
              cursor: "pointer", transition: "color 0.3s ease",
              textTransform: "uppercase", marginTop: 32,
            }}
            onMouseEnter={e => e.target.style.color = "rgba(196,168,132,0.7)"}
            onMouseLeave={e => e.target.style.color = "rgba(196,168,132,0.4)"}
            >
              ← Return to Chronicles
            </button>
          )}
        </div>
      )}

      {/* Themed Transition Overlay */}
      {splashTransition && (() => {
        const transitions = {
          vtm: {
            bg: "linear-gradient(180deg, #8b0000 0%, #c41e3a 30%, #2a0000 100%)",
            animation: "bloodDrip 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards",
            label: "The Blood is the Life...",
            particles: Array.from({ length: 20 }, (_, i) => ({
              left: `${5 + i * 5}%`, animDelay: `${Math.random() * 0.4}s`,
              height: `${60 + Math.random() * 40}%`,
              bg: `rgba(${139 + Math.floor(Math.random() * 57)}, 0, 0, ${0.8 + Math.random() * 0.2})`,
            })),
          },
          mta: {
            bg: "radial-gradient(circle at center, #9b59b6 0%, #4a148c 40%, #1a0033 100%)",
            animation: "arcaneShatter 1.2s ease-out forwards",
            label: "Reality Bends...",
            particles: Array.from({ length: 16 }, (_, i) => ({
              left: `${50 + 30 * Math.cos(i * Math.PI / 8)}%`,
              top: `${50 + 30 * Math.sin(i * Math.PI / 8)}%`,
              size: 8 + Math.random() * 12,
            })),
          },
          wta: {
            bg: "linear-gradient(135deg, #1a3a1a 0%, #2d5a27 30%, #0a1f0a 100%)",
            animation: "clawTear 1.0s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
            label: "The Rage Awakens...",
            slashes: [
              { rotate: -25, top: "20%", delay: "0s" },
              { rotate: -20, top: "40%", delay: "0.1s" },
              { rotate: -30, top: "60%", delay: "0.2s" },
            ],
          },
          wto: {
            bg: "radial-gradient(ellipse at center, #2c3e6b 0%, #1a2744 40%, #0a0f1e 100%)",
            animation: "ghostShroud 1.3s ease-in-out forwards",
            label: "The Shroud Thins...",
          },
          htr: {
            bg: "radial-gradient(circle at center, #4a4200 0%, #2a2600 40%, #0f0e00 100%)",
            animation: "hunterFocus 1.1s ease-out forwards",
            label: "The Hunt Begins...",
          },
          ctd: {
            bg: "linear-gradient(135deg, #2a1f5e 0%, #4a3f8e 30%, #1a1040 100%)",
            animation: "dreamShimmer 1.3s ease-in-out forwards",
            label: "Dreams Unfold...",
          },
        };
        const t = transitions[splashTransition] || transitions.vtm;
        const splash = GAME_SPLASH_DATA[splashTransition];
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            animation: "transitionFadeIn 0.3s ease forwards",
            pointerEvents: "none",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: t.bg,
              animation: t.animation,
            }} />

            {splashTransition === "vtm" && t.particles.map((p, i) => (
              <div key={i} style={{
                position: "absolute", top: 0, left: p.left, width: "6px", height: p.height,
                background: p.bg, borderRadius: "0 0 3px 3px",
                animation: `bloodDrip 1s ease ${p.animDelay} forwards`,
                transformOrigin: "top center",
              }} />
            ))}

            {splashTransition === "mta" && t.particles.map((p, i) => (
              <div key={i} style={{
                position: "absolute", left: p.left, top: p.top,
                width: p.size, height: p.size, borderRadius: "50%",
                background: "#e0b0ff", boxShadow: "0 0 24px 8px rgba(155,89,182,0.8)",
                animation: `arcaneShatter 1.2s ease ${i * 0.1}s forwards`,
              }} />
            ))}

            {splashTransition === "wta" && t.slashes.map((s, i) => (
              <div key={i} style={{
                position: "absolute", left: "10%", right: "10%", top: s.top,
                height: 4, background: "linear-gradient(90deg, transparent, #4a8c3f, #8fbc8f, #4a8c3f, transparent)",
                transform: `rotate(${s.rotate}deg) scaleX(0)`, transformOrigin: "left center",
                animation: `clawTear 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${s.delay} forwards`,
                boxShadow: "0 0 15px rgba(74,140,63,0.5)",
              }} />
            ))}

            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              animation: "transitionFadeIn 0.6s ease 0.4s both",
            }}>
              <div style={{
                fontFamily: "'Cinzel', serif", fontSize: "clamp(20px, 3vw, 36px)",
                fontWeight: 700, color: "#fff", letterSpacing: 4,
                textShadow: `0 0 30px ${splash?.glow || "rgba(255,255,255,0.3)"}, 0 0 60px ${splash?.glow || "rgba(255,255,255,0.2)"}`,
                textTransform: "uppercase",
              }}>
                {t.label}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
