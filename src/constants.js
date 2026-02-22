export const FONTS_URL = "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Fira+Code:wght@400&display=swap";

export const GAME_TYPES = [
  { id: "vtm", label: "Vampire: The Masquerade", accent: "#c41e3a", icon: "🩸" },
  { id: "mta", label: "Mage: The Ascension", accent: "#7b2fbe", icon: "✦" },
  { id: "wta", label: "Werewolf: The Apocalypse", accent: "#4a8c3f", icon: "🐺" },
  { id: "wto", label: "Wraith: The Oblivion", accent: "#4a6fa5", icon: "👻" },
  { id: "htr", label: "Hunter: The Reckoning", accent: "#8b8000", icon: "⚔" },
  { id: "ctd", label: "Changeling: The Dreaming", accent: "#6a4fb8", icon: "🦋" },
  { id: "mixed", label: "Mixed Chronicle", accent: "#9a6b4c", icon: "◈" },
];

export const RELATIONSHIP_TYPES = [
  "Ally", "Enemy", "Rival", "Contact", "Mentor", "Lover", "Patron",
  "Sire", "Childe", "Coterie", "Cabal", "Pack", "Unknown", "Neutral",
  "Suspicious", "Feared", "Respected", "Manipulated", "Debt Owed", "Owes Debt"
];

export const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "sessions", label: "Sessions", icon: "📜" },
  { id: "npcs", label: "NPCs", icon: "🎭" },
  { id: "characters", label: "Characters", icon: "⚜" },
  { id: "factions", label: "Factions", icon: "🏛" },
  { id: "locations", label: "Locations", icon: "🗺" },
  { id: "threads", label: "Plot Threads", icon: "🕸" },
  { id: "timeline", label: "Timeline", icon: "📅" },
];

export const THREAD_STATUSES = ["active", "cold", "resolved"];
export const ATTITUDE_LEVELS = ["Hostile", "Unfriendly", "Wary", "Neutral", "Curious", "Friendly", "Allied"];
export const INFLUENCE_LEVELS = ["None", "Minor", "Notable", "Significant", "Dominant"];
