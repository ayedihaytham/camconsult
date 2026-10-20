import { Router } from "express";
import { requireAuth } from "../auth.js";
import { notifKey } from "../notifications.js";
import { addClient, clesEnLigne, removeClient } from "../sse.js";

/**
 * Flux "push" léger : le serveur pousse juste un signal (message /
 * notification), jamais le contenu — le client relance le fetch REST
 * habituel (voir src/lib/liveEvents.ts). Évite de dupliquer la logique de
 * ciblage/permissions déjà correcte dans notify()/notifyMany().
 */
export const eventsRouter = Router();
eventsRouter.use(requireAuth);

/** Qui est en ligne : l'admin voit tous les employés connectés ; un employé ne voit que la présence du cabinet (« admin »). */
eventsRouter.get("/presence", (req, res) => {
  const cles = clesEnLigne();
  const adminEnLigne = cles.some((cle) => cle.startsWith("admin:"));
  res.json({ ids: req.session.role === "admin" ? cles.filter((cle) => !cle.startsWith("admin:")) : adminEnLigne ? ["admin"] : [] });
});

eventsRouter.get("/", (req, res) => {
  const userKey = notifKey(req.session);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // nginx : ne jamais bufferiser ce flux (sinon les événements
    // n'arrivent qu'en rafale, à la fermeture de la connexion).
    "X-Accel-Buffering": "no",
  });
  res.write(": ok\n\n");
  addClient(userKey, res);
  // Un client qui part brutalement (réseau coupé, onglet fermé) ne doit jamais produire d'erreur non gérée côté serveur.
  res.on("error", () => {});

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(userKey, res);
  });
});
