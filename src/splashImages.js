// Splash card images — served from /public/splash/ instead of base64 to keep the JS bundle small

export const GAME_SPLASH_DATA = {
  vtm: { img: "/splash/vtm.jpg", tagline: "A Beast I am, lest a Beast I become", color: "#c41e3a", glow: "rgba(196,30,58,0.4)" },
  mta: { img: "/splash/mta.jpg", tagline: "Reality is a lie. Magick is the truth.", color: "#7b2fbe", glow: "rgba(123,47,190,0.4)" },
  wta: { img: "/splash/wta.jpg", tagline: "When will you Rage?", color: "#8b1a1a", glow: "rgba(139,26,26,0.4)" },
  wto: { img: "/splash/wto.jpg", tagline: "The mirror cracks. The dead remember.", color: "#4a6fa5", glow: "rgba(74,111,165,0.4)" },
  htr: { img: "/splash/htr.jpg", tagline: "We hunt those who hunt us.", color: "#8b8000", glow: "rgba(139,128,0,0.4)" },
  ctd: { img: "/splash/ctd.jpg", tagline: "Dreams are the only reality.", color: "#6a4fb8", glow: "rgba(106,79,184,0.4)" },
};

export const GAME_BACKGROUNDS = {
  vtm: "/backgrounds/vtm.png",
  mta: "/backgrounds/mta.png",
  wta: "/backgrounds/wta.png",
  wto: "/backgrounds/wto.png",
  htr: "/backgrounds/htr.png",
  ctd: "/backgrounds/ctd.png",
  mixed: null,
};

export const GAME_VIDEO_BACKGROUNDS = {
  vtm: "/backgrounds/vtm_video_background.mp4",
  mta: "/backgrounds/mta_video_background.mp4",
  wta: "/backgrounds/wta_video_background.mp4",
  wto: "/backgrounds/wto_video_background.mp4",
  htr: "/backgrounds/htr_video_background.mp4",
  ctd: "/backgrounds/ctd_video_background.mp4",
  mixed: null,
};

export const DEFAULT_BG = "/splash/default_bg.jpg";
