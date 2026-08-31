import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: ".build",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      input: "index.html",
      output: {
        codeSplitting: false,
        entryFileNames: "app.js",
        assetFileNames: "app[extname]",
      },
    },
  },
});
