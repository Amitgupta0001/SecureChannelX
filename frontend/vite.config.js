// FILE: vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Force localhost for verification
  const API = "http://localhost:5050";
  const SOCKET = "http://localhost:5050";

  console.log("🔧 Loaded ENV (Forced Localhost):");
  console.log("VITE_API_BASE =", API);
  console.log("VITE_SOCKET_URL =", SOCKET);

  return {
    plugins: [react()],

    server: {
      port: 5173,
      cors: true,
      strictPort: true,

      proxy: {
        // Proxy ALL /api requests to backend
        "/api": {
          target: API,
          changeOrigin: true,
          secure: false,
        },

        // Socket.io → Realtime server
        "/socket.io": {
          target: SOCKET,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },

    build: {
      target: ["es2020", "chrome90", "safari13"],
      sourcemap: false,
      minify: "esbuild",
    },

    define: {
      "process.env": {},
      global: {},
    },
  };
});
