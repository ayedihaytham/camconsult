import "dotenv/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { ensureSchema } from "./ensureSchema.js";
import { authRouter } from "./routes/auth.js";
import { societesRouter } from "./routes/societes.js";
import { employesRouter } from "./routes/employes.js";
import { noeudsRouter } from "./routes/noeuds.js";
import { messagesRouter } from "./routes/messages.js";
import { conversationsRouter } from "./routes/conversations.js";
import { journalRouter } from "./routes/journal.js";
import { tachesRouter } from "./routes/taches.js";
import { notificationsRouter } from "./routes/notifications.js";
import { collectesRouter } from "./routes/collectes.js";
import { bordereauxRouter } from "./routes/bordereaux.js";
import { stockRouter } from "./routes/stock.js";
import { honorairesRouter } from "./routes/honoraires.js";
import { balancesRouter } from "./routes/balances.js";
import { grilleAffectatRouter } from "./routes/grilleAffectat.js";
import { notesRouter } from "./routes/notes.js";
import { immobilisationsRouter } from "./routes/immobilisations.js";
import { dataRouter } from "./routes/data.js";
import { eventsRouter } from "./routes/events.js";
import { startRelancesScheduler } from "./relances.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Passenger / cPanel fournit PORT ; en dev on utilise API_PORT (défaut 5181).
const PORT = process.env.PORT || process.env.API_PORT || 5181;
const isProd = process.env.NODE_ENV === "production";

// Derrière le proxy Apache/cPanel : IP client et https corrects
app.set("trust proxy", 1);

// CORS : en prod, restreindre à l'origine du site si CORS_ORIGIN est défini
app.use(
  cors({ origin: process.env.CORS_ORIGIN || (isProd ? false : true) }),
);
// 24 Mo : suffisant pour joindre jusqu'à 3 pièces PDF (achat/vente/douane) à un mouvement de stock.
app.use(express.json({ limit: "24mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/societes", societesRouter);
app.use("/api/employes", employesRouter);
app.use("/api/noeuds", noeudsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/journal", journalRouter);
app.use("/api/taches", tachesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/collectes", collectesRouter);
app.use("/api/bordereaux", bordereauxRouter);
app.use("/api/stock", stockRouter);
app.use("/api/honoraires", honorairesRouter);
app.use("/api/balances", balancesRouter);
app.use("/api/grille-affectat", grilleAffectatRouter);
app.use("/api/notes", notesRouter);
app.use("/api/immobilisations", immobilisationsRouter);
app.use("/api/data", dataRouter);
app.use("/api/events", eventsRouter);

// En production : sert le build Vite.
// index.html ne doit jamais être mis en cache (sinon, après un redéploiement,
// le navigateur réclame d'anciens chunks JS qui n'existent plus) ; les assets
// sont hashés → cache long.
const dist = join(__dirname, "..", "dist");
if (existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(join(dist, "index.html"));
  });
}

// Gestion d'erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[api] erreur non gérée:", err);
  res.status(500).json({ error: "Erreur serveur" });
});

process.on("unhandledRejection", (reason) => {
  console.error("[api] promesse rejetée non gérée:", reason);
});

async function start() {
  try {
    await ensureSchema();
  } catch (err) {
    console.error(
      "\n[api] ⛔ Impossible de préparer la base de données.\n" +
        `      ${err.message}\n` +
        "      Vérifiez que PostgreSQL tourne :  npm run db:up\n" +
        `      DATABASE_URL = ${maskUrl()}\n`,
    );
    process.exit(1);
  }
  const server = app.listen(PORT, () => {
    console.log(
      `[api] écoute sur le port ${PORT} — NODE_ENV=${process.env.NODE_ENV || "development"} — DB ${maskUrl()}` +
        (existsSync(dist) ? " — sert dist/" : ""),
    );
  });
  startRelancesScheduler();
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n[api] ⛔ Le port ${PORT} est déjà utilisé.\n` +
          "      Fermez l'autre processus, ou changez le port " +
          "(API_PORT en dev, la plateforme le fixe en prod).\n",
      );
    } else {
      console.error("[api] erreur serveur:", err);
    }
    process.exit(1);
  });
}

function maskUrl() {
  const u =
    process.env.DATABASE_URL ||
    "postgres://cabinet:cabinet@localhost:5439/cabinet";
  return u.replace(/:\/\/[^@]+@/, "://***@");
}

start();
