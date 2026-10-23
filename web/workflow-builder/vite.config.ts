import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  resolve: { dedupe: ["react", "react-dom"] },
  build: { rollupOptions: { output: { inlineDynamicImports: true } } },
  server: { fs: { allow: ["../..", "../../integrations"] } },
});
