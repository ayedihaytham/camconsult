/// <reference lib="webworker" />
// Travailleur de lecture de classeur. Reçoit un tampon transféré, répond par des données simples ou par un code d'erreur sans contenu.
import { DepassementLimite, extraireFeuilles } from "./extraireClasseur";

export type ReponseClasseur = { ok: true; feuilles: ReturnType<typeof extraireFeuilles> } | { ok: false; code: "limite" | "illisible" };

self.onmessage = async (e: MessageEvent<{ donnees: ArrayBuffer; cellDates?: boolean }>) => {
  let reponse: ReponseClasseur;
  try {
    const XLSX = await import("xlsx");
    reponse = { ok: true, feuilles: extraireFeuilles(XLSX, e.data.donnees, { cellDates: e.data.cellDates }) };
  } catch (err) {
    reponse = { ok: false, code: err instanceof DepassementLimite ? "limite" : "illisible" };
  }
  (self as unknown as Worker).postMessage(reponse);
};
