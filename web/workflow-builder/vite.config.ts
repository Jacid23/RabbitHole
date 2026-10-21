import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: { rollupOptions: { output: { inlineDynamicImports: true } } },
  server: { fs: { allow: ["../..", "../../integrations"] } },
});
