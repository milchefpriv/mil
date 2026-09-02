import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    outDir: "../../factures",
    emptyOutDir: true,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      input: "index.html",
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) =>
          assetInfo.names?.some((name) => name.endsWith(".css"))
            ? "assets/app-[hash][extname]"
            : "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("pdfmake/build/vfs_fonts")) return "pdf-fonts";
          if (id.includes("jspdf")) return "pdf-engine";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("react") || id.includes("scheduler")) return "react";
          return undefined;
        },
      },
    },
  },
});
