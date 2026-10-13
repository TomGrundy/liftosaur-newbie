import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: webRoot,
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  server: { fs: { allow: [projectRoot] } },
  build: { outDir: fileURLToPath(new URL("../dist", import.meta.url)), emptyOutDir: true },
});
