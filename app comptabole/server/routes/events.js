import { Router } from "express";
import { requireAuth } from "../auth.js";
import { notifKey } from "../notifications.js";
import { addClient, removeClient } from "../sse.js";

/**
 * Flux "push" léger : le serveur pousse juste un signal (message /
 * notification), jamais le contenu — le client relance le fetch REST
 * habituel (voir src/lib/liveEvents.ts). Évite de dupliquer la logique de
 * ciblage/permissions déjà correcte dans notify()/notifyMany().
 */
export const eventsRouter = Router();
eventsRouter.use(requireAuth);

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
