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
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            // Strip browser-identifying headers so Anthropic doesn't flag as CORS
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
            console.log(`[proxy] → ${req.method} ${req.url} → https://api.anthropic.com${proxyReq.path}`);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(`[proxy] ← ${proxyRes.statusCode} for ${req.url}`);
          });
          proxy.on("error", (err, req) => {
            console.error(`[proxy] ERROR for ${req.url}:`, err.message);
          });
        },
      },
    },
  },
});
