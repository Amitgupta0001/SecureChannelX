// FILE: vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Load .env variables
const API = process.env.VITE_API_BASE || "http://localhost:5050";
const SOCKET = process.env.VITE_SOCKET_URL || API;

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5050,
    cors: true, // needed for dev API access
    strictPort: true,

    proxy: {
      // REST API proxy
      "/api": {
        target: API,
        changeOrigin: true,
        secure: false,
      },

      // Socket.io WebSocket proxy
      "/socket.io": {
        target: SOCKET,
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },

  // Ensures broad browser support
  build: {
    target: ["es2020", "chrome90", "safari13"],
    sourcemap: false,
    minify: "esbuild",
  },

  // Fix some Node polyfill issues
  define: {
    "process.env": {},
    global: {},
  },
});
