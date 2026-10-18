import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { ErreurSignature } from "../signature/erreur.js";
import { autoriserLocal, enregistrerConnexion, enregistrerEssai, etatConnexion, lireConnexion, supprimerConnexion } from "../ttn/connexion.js";
import { ErreurTtn } from "../ttn/erreur.js";
import { actualiserToutes } from "../ttn/suivi.js";
import { consulterFacture } from "../ttn/soap.js";

/**
 * Accès au service web TTN (El Fatoora). Administrateur seulement. Le mot de passe est chiffré avant d'être enregistré et n'est jamais
 * renvoyé, journalisé ni répété dans une erreur. Voir docs/facturation-electronique.md (étape 3).
 */

export const ttnRouter = Router();
ttnRouter.use(requireAuth, requireAdmin);

const connexionSchema = z.object({
  url: z.string().trim().min(1, "Saisissez l'adresse du service TTN").max(300),
  login: z.string().trim().min(1, "Saisissez l'identifiant El Fatoora").max(120),
  motDePasse: z.string().max(200).optional().default(""),
  matricule: z.string().trim().max(30).optional().default(""),
  environnement: z.enum(["test", "reel"]).default("test"),
});

/** Les erreurs de la chaîne TTN/signature sont renvoyées en français ; tout le reste part en 500 sans détail. */
export function route(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof ErreurTtn || e instanceof ErreurSignature) return res.status(e.statut ?? 422).json({ error: e.message, code: e.code });
      console.error("[ttn]", e?.name, e?.message);
      res.status(500).json({ error: "Erreur interne lors de l'opération TTN" });
    }
  };
}

ttnRouter.get("/", route(async (_req, res) => res.json(await etatConnexion())));

ttnRouter.put("/", route(async (req, res) => {
  const parsed = connexionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const existait = (await etatConnexion()).connexion !== null;
  await enregistrerConnexion(parsed.data, req.session.nom);
  logAction(req.session.nom, existait ? "modification" : "creation", "facture", `Accès TTN ${existait ? "modifiés" : "enregistrés"} (environnement ${parsed.data.environnement})`);
  res.json(await etatConnexion());
}));

ttnRouter.delete("/", route(async (req, res) => {
  if (await supprimerConnexion()) logAction(req.session.nom, "suppression", "facture", "Accès TTN supprimés");
  res.json(await etatConnexion());
}));

// Essai de connexion : un seul appel de consultation sur un numéro qui n'existe pas ; rien n'est déposé.
ttnRouter.post("/tester", route(async (req, res) => {
  const config = await lireConnexion();
  if (!config) return res.status(409).json({ error: "Enregistrez d'abord les accès TTN.", code: "SANS_CONNEXION" });
  let resultats;
  try {
    resultats = await consulterFacture(config, "ESSAI-CONNEXION-INEXISTANT", { autoriserLocal: autoriserLocal() });
  } catch (e) {
    await enregistrerEssai(false).catch(() => undefined);
    throw e;
  }
  await enregistrerEssai(true);
  logAction(req.session.nom, "modification", "facture", `Essai de connexion TTN réussi (environnement ${config.environnement})`);
  res.json({ ok: true, environnement: config.environnement, message: `Le service TTN a répondu (${resultats.length} résultat pour le numéro d'essai).` });
}));

// Vérification immédiate de toutes les factures déposées (le suivi automatique fait la même chose toutes les 5 minutes).
ttnRouter.post("/actualiser", route(async (req, res) => {
  const config = await lireConnexion();
  if (!config) return res.status(409).json({ error: "Enregistrez d'abord les accès TTN.", code: "SANS_CONNEXION" });
  const bilan = await actualiserToutes({}, req.session.nom);
  res.json(bilan);
}));
