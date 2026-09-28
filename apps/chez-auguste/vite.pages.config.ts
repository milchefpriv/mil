import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pagesAssetsDirectory = fileURLToPath(new URL("../../chez-auguste/assets", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "clean-chez-auguste-pages-assets",
      buildStart() {
        // Only these fingerprinted assets belong to this build. The sibling
        // checklist directory is a separate deployed application.
        rmSync(pagesAssetsDirectory, { recursive: true, force: true });
      },
    },
    react(),
  ],
  build: {
    outDir: "../../chez-auguste",
    // The Pages directory also contains the separately deployed HACCP checklist.
    // Preserve it while the build-start hook refreshes only our hashed assets.
    emptyOutDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
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
