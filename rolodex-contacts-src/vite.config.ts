import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname),
  base: "./",
  plugins: [react()],
  build: { outDir: resolve(__dirname, "../rolodex-contacts"), emptyOutDir: true },
});
