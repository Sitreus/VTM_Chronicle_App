export const storageGet = async (key) => {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
};

export const storageSet = async (key, val) => {
  try {
    await window.storage.set(key, JSON.stringify(val));
  } catch (e) { console.error("Storage error:", e); }
};

export const storageDelete = async (key) => {
  try {
    await window.storage.delete(key);
  } catch (e) { console.error("Storage delete error:", e); }
};

// Canonical empty chronicle data shape
export const EMPTY_CHRONICLE_DATA = {
  sessions: [], npcs: [], characters: [], storyBeats: [],
  plotThreads: [], clocks: [], factions: [], locationDossiers: [], rumors: [],
};
