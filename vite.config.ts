import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";
import { componentTagger } from "lovable-tagger";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const buildDate = new Date().toISOString().slice(0, 10);

const root = path.resolve(__dirname);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env / .env.local into process.env early (Docker injects VITE_* via compose env_file too).
  loadEnv(mode, root, "");

  return {
    envDir: root,
    server: {
      host: true,
      port: 8080,
      watch: {
        usePolling: process.env.VITE_DOCKER_WATCH_POLL === "true",
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
    resolve: {
      alias: {
        "@": path.join(root, "src"),
      },
    },
  };
});
