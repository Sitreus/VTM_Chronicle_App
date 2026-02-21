import React from "react";
import { createRoot } from "react-dom/client";
import WorldOfDarkness from "../world-of-darkness.jsx";

// Polyfill window.storage using localStorage
// The app expects an async key-value store with get/set/delete
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const value = localStorage.getItem(key);
      return value !== null ? { value } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
    },
    delete: async (key) => {
      localStorage.removeItem(key);
    },
  };
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WorldOfDarkness />
  </React.StrictMode>
);
