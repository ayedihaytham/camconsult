import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { chiffrer, dechiffrer, secretConfigure } from "../signature/coffre.js";
import { deverrouiller, etat, memoriser, verrouiller } from "../signature/deverrouillage.js";
import { ErreurSignature } from "../signature/erreur.js";
import { lirePkcs12 } from "../signature/pkcs12.js";

/**
 * Certificat de signature électronique du cabinet (facture électronique El Fatoora). Administrateur seulement.
 * Le fichier .p12/.pfx est chiffré avant d'être enregistré ; le mot de passe n'est ni enregistré, ni journalisé, ni renvoyé.
 * Les erreurs sont renvoyées en français (ErreurSignature) ; tout le reste part en 500 sans détail.
 */

export const signatureRouter = Router();
signatureRouter.use(requireAuth, requireAdmin);

const BASE64 = /^[A-Za-z0-9+/=\r\n]+$/;
const TAILLE_MAX = 200_000; // octets : un .p12 de cabinet fait quelques ko

const chargerSchema = z.object({
  fichier: z.string().min(1, "Choisissez le fichier du certificat (.p12 ou .pfx)").max(Math.ceil((TAILLE_MAX * 4) / 3) + 8, "Fichier trop volumineux"),
  motDePasse: z.string().min(1, "Saisissez le mot de passe du certificat").max(200),
});
const motDePasseSchema = z.object({ motDePasse: z.string().min(1, "Saisissez le mot de passe du certificat").max(200) });

const iso = (d) => (d instanceof Date ? d.toISOString() : d ? new Date(d).toISOString() : null);

function certificatDto(r) {
  return r
    ? {
        sujet: r.sujet,
        emetteur: r.emetteur,
        serie: r.serie,
        validDu: iso(r.valide_du),
        validAu: iso(r.valide_au),
        empreinte: r.empreinte,
        chargeLe: iso(r.charge_le),
        chargePar: r.charge_par,
        expire: new Date(r.valide_au) < new Date(),
      }
    : null;
}

async function etatSignature() {
  const r = (await query("select sujet, emetteur, serie, valide_du, valide_au, empreinte, charge_le, charge_par from signature_certificat where id = 1")).rows[0];
  // Le déverrouillage ne vaut que pour le certificat enregistré : sans certificat en base, rien n'est déverrouillé.
  if (!r) verrouiller();
  return { configuree: Boolean(secretConfigure()), certificat: certificatDto(r), ...etat() };
}

/** Renvoie les ErreurSignature au client (message français, jamais de détail interne) ; le reste est une panne serveur. */
function route(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof ErreurSignature) return res.status(e.statut).json({ error: e.message, code: e.code });
      console.error("[signature]", e?.name, e?.message);
      res.status(500).json({ error: "Erreur interne lors de l'opération de signature" });
    }
  };
}

const exigerSecret = () => {
  const secret = secretConfigure();
  if (!secret) throw new ErreurSignature("NON_CONFIGUREE", "La signature électronique n'est pas activée sur ce serveur (SIGNATURE_CLE_SECRET absent ou trop court). Contactez l'administrateur technique.", 503);
  return secret;
};

signatureRouter.get("/", route(async (_req, res) => res.json(await etatSignature())));

// Chargement (ou remplacement) du certificat : validé, chiffré, enregistré ; la signature est déverrouillée ensuite, puisque le mot de passe vient d'être saisi.
signatureRouter.put("/certificat", route(async (req, res) => {
  const parsed = chargerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const secret = exigerSecret();
  if (!BASE64.test(parsed.data.fichier)) return res.status(400).json({ error: "Le fichier n'a pas été transmis correctement." });
  const fichier = Buffer.from(parsed.data.fichier, "base64");
  if (fichier.length === 0 || fichier.length > TAILLE_MAX) return res.status(400).json({ error: "Fichier de certificat invalide ou trop volumineux." });

  const lu = lirePkcs12(fichier, parsed.data.motDePasse);
  const enveloppe = chiffrer(fichier, secret);
  const { infos } = lu;
  const existait = (await query("select 1 from signature_certificat where id = 1")).rowCount > 0;
  await query(
    `insert into signature_certificat (id, p12_chiffre, sujet, emetteur, serie, valide_du, valide_au, empreinte, charge_le, charge_par)
     values (1, $1, $2, $3, $4, $5, $6, $7, now(), $8)
     on conflict (id) do update set p12_chiffre = excluded.p12_chiffre, sujet = excluded.sujet, emetteur = excluded.emetteur, serie = excluded.serie,
       valide_du = excluded.valide_du, valide_au = excluded.valide_au, empreinte = excluded.empreinte, charge_le = now(), charge_par = excluded.charge_par`,
    [enveloppe, infos.sujet, infos.emetteur, infos.serie, infos.validDu, infos.validAu, infos.empreinte, req.session.nom ?? ""],
  );
  memoriser(lu);
  logAction(req.session.nom, existait ? "modification" : "creation", "facture", `Certificat de signature électronique ${existait ? "remplacé" : "chargé"} (empreinte ${infos.empreinte.slice(0, 16)}…)`);
  res.json({ ...(await etatSignature()), avertissements: lu.avertissements });
}));

signatureRouter.delete("/certificat", route(async (req, res) => {
  const { rowCount } = await query("delete from signature_certificat where id = 1");
  verrouiller();
  if (rowCount) logAction(req.session.nom, "suppression", "facture", "Certificat de signature électronique supprimé");
  res.json(await etatSignature());
}));

// Déverrouillage : le mot de passe ouvre le fichier chiffré en mémoire pendant 15 minutes ; il n'est jamais conservé.
signatureRouter.post("/deverrouiller", route(async (req, res) => {
  const parsed = motDePasseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const secret = exigerSecret();
  const r = (await query("select p12_chiffre from signature_certificat where id = 1")).rows[0];
  if (!r) return res.status(409).json({ error: "Aucun certificat n'est enregistré : chargez d'abord le fichier .p12 / .pfx.", code: "SANS_CERTIFICAT" });
  deverrouiller(dechiffrer(r.p12_chiffre, secret), parsed.data.motDePasse);
  logAction(req.session.nom, "modification", "facture", "Signature électronique déverrouillée (15 minutes)");
  res.json(await etatSignature());
}));

signatureRouter.post("/verrouiller", route(async (req, res) => {
  verrouiller();
  logAction(req.session.nom, "modification", "facture", "Signature électronique verrouillée");
  res.json(await etatSignature());
}));
