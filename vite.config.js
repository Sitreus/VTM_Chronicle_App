import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Proxy /api/claude requests to Anthropic to avoid CORS issues
    proxy: {
      "/api/claude": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, ""),
        secure: true,
      },
    },
  },
});
