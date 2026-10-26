import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";


// Le bloc `test` est lu par Vitest ; il est passé par une variable car le type de Vite ne le connaît pas.
const config: UserConfig & { test: Record<string, unknown> } = {
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Seuls ces dossiers contiennent des tests : pas de parcours de dist, samples, ocr-transfer…
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.js", "shared/**/*.test.js"],
    // Le CSS n'est pas évalué par les tests (jsdom n'en a pas besoin) : démarrage de chaque fichier plus court.
    css: false,
    reporters: process.env.GITHUB_ACTIONS ? ["default", "github-actions"] : ["default"],
  },
  server: {
    port: 5180,
    strictPort: true,
    open: true,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT || 5181}`,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            const msg =
              "API injoignable sur le port " +
              (process.env.API_PORT || 5181) +
              ". Lancez `npm run dev` (API + front), pas seulement le front.";
            console.error(
              "\x1b[33m[proxy]\x1b[0m",
              msg,
              `(${(err as NodeJS.ErrnoException).code ?? err.message})`,
            );
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: msg }));
            }
          });
        },
      },
    },
  },
};

export default defineConfig(config);
