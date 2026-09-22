import { getToken } from "./api";

interface LiveEventHandlers {
  onMessage?: () => void;
  onNotification?: () => void;
}

/**
 * Connexion "push" légère (Server-Sent Events côté serveur) pour ne plus
 * dépendre d'un rechargement manuel : le serveur envoie juste un signal
 * quand un message ou une notification arrive, et on relance le fetch REST
 * habituel (refreshMessages / refreshNotifications) — jamais de payload
 * métier dupliqué dans ce flux, la source de vérité reste l'API REST.
 *
 * `EventSource` natif ne permet pas d'envoyer l'en-tête Authorization (auth
 * de l'appli = JWT en Bearer, pas un cookie de session) — on lit donc le
 * flux nous-même via fetch + ReadableStream, en ne reprenant du format SSE
 * que ce qui sert ici (lignes "data: ...", trame séparée par une ligne vide).
 */
export function startLiveEvents(handlers: LiveEventHandlers): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  // Incrémenté à chaque reconnexion forcée, pour que la boucle de lecture
  // d'une connexion abandonnée (ex. mobile qui revient au premier plan)
  // sache qu'elle est périmée et ne reprogramme pas sa propre relance.
  let generation = 0;

  async function connect(myGeneration: number) {
    if (stopped || myGeneration !== generation) return;
    const token = getToken();
    if (!token) return;
    controller = new AbortController();
    try {
      const res = await fetch("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`live-events ${res.status}`);
      retryDelay = 1000;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!stopped && myGeneration === generation) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          handleFrame(frame, handlers);
        }
      }
    } catch {
      // connexion coupée/refusée — on retente ci-dessous
    }
    if (!stopped && myGeneration === generation) {
      retryTimer = setTimeout(() => connect(generation), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    }
  }

  function reconnectNow() {
    generation++;
    if (retryTimer) clearTimeout(retryTimer);
    controller?.abort();
    retryDelay = 1000;
    connect(generation);
  }

  connect(generation);

  // Les mobiles suspendent souvent les connexions longues (verrouillage
  // d'écran, onglet en arrière-plan) sans prévenir la boucle de lecture —
  // au retour au premier plan, on force une reconnexion et un rattrapage
  // immédiat plutôt que d'attendre un signal qui ne viendra jamais.
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    reconnectNow();
    handlers.onMessage?.();
    handlers.onNotification?.();
  };
  document.addEventListener("visibilitychange", onVisible);

  // Filet de sécurité pour les messages (les notifications ont déjà leur
  // propre sondage 20s dans Topbar.tsx) — au cas où la connexion SSE serait
  // silencieusement morte sans que le navigateur ne le signale.
  const fallbackInterval = setInterval(() => {
    if (document.visibilityState === "visible") handlers.onMessage?.();
  }, 20_000);

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    controller?.abort();
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(fallbackInterval);
  };
}

function handleFrame(frame: string, handlers: LiveEventHandlers) {
  const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) return; // commentaire/heartbeat (": ...")
  try {
    const payload = JSON.parse(dataLine.slice(6));
    if (payload.type === "message") handlers.onMessage?.();
    else if (payload.type === "notification") handlers.onNotification?.();
  } catch {
    // trame malformée — ignorée
  }
}
