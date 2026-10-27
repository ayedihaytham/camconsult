import { defineConfig, type Plugin, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";


// Reconnaissance de caractères (PDF sans texte) : le moteur, sa langue et son worker sont servis par l'application elle-même sous /ocr, depuis node_modules.
// Aucun site tiers n'est contacté : le PDF de l'utilisateur ne quitte jamais son appareil.
const racineModules = path.resolve(__dirname, "node_modules");
function fichiersOcr(): Record<string, string> {
  const fichiers: Record<string, string> = {
    "ocr/worker.min.js": path.join(racineModules, "tesseract.js/dist/worker.min.js"),
    "ocr/lang/fra.traineddata.gz": path.join(racineModules, "@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz"),
  };
  const coeur = path.join(racineModules, "tesseract.js-core");
  if (fs.existsSync(coeur)) for (const nom of fs.readdirSync(coeur)) if (/-lstm\.wasm\.js$/.test(nom) || nom === "tesseract-core-lstm.wasm.js") fichiers[`ocr/core/${nom}`] = path.join(coeur, nom);
  return fichiers;
}
const moteurOcr = (): Plugin => ({
  name: "moteur-ocr",
  configureServer(serveur) {
    serveur.middlewares.use((req, res, suite) => {
      const cible = fichiersOcr()[(req.url ?? "").split("?")[0].replace(/^\//, "")];
      if (!cible) return suite();
      res.setHeader("Content-Type", cible.endsWith(".gz") ? "application/gzip" : "text/javascript");
      fs.createReadStream(cible).pipe(res);
    });
  },
  generateBundle() {
    for (const [nom, source] of Object.entries(fichiersOcr())) if (fs.existsSync(source)) this.emitFile({ type: "asset", fileName: nom, source: fs.readFileSync(source) });
  },
});

// Le bloc `test` est lu par Vitest ; il est passé par une variable car le type de Vite ne le connaît pas.
const config: UserConfig & { test: Record<string, unknown> } = {
  plugins: [react(), moteurOcr()],
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
