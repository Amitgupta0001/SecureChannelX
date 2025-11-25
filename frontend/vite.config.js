// FILE: vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const API = env.VITE_API_BASE || "http://localhost:5050";
  const SOCKET = env.VITE_SOCKET_URL || "http://localhost:5050";

  console.log("🔧 Loaded ENV:");
  console.log("VITE_API_BASE =", API);
  console.log("VITE_SOCKET_URL =", SOCKET);

  return {
    plugins: [react()],

    server: {
      port: 5173,  // Vite default port (consistent with documentation)
      cors: true,
      strictPort: true,

      proxy: {
        // REST API → Backend (auth endpoints are at /api/auth/*)
        "/api/auth": {
          target: API,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path, // Keep /api/auth exactly
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
