// FILE: vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

export default defineConfig({
  plugins: [react(), visualizer({ open: false })],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 3000, // ensure this matches the URL you open
    host: true,
  },
});
