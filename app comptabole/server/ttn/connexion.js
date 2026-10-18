import { query } from "../db.js";
import { normaliserMatriculeFiscal } from "../../shared/mf.js";
import { chiffrer, dechiffrer, secretConfigure } from "../signature/coffre.js";
import { ErreurSignature } from "../signature/erreur.js";
import { ErreurTtn } from "./erreur.js";
import { verifierUrl } from "./soap.js";

/**
 * Accès au service web TTN, saisis dans l'application : adresse, identifiant, mot de passe, matricule, environnement (test / réel).
 * Le mot de passe est chiffré comme le certificat de signature (coffre.js, clé SIGNATURE_CLE_SECRET) et n'est jamais renvoyé ni journalisé.
 */

/** Seuls les tests d'intégration (faux serveur sur la machine) définissent cette variable ; jamais en production. */
export const autoriserLocal = () => process.env.TTN_AUTORISER_LOCAL === "true";

const exigerSecret = () => {
  const secret = secretConfigure();
  if (!secret) throw new ErreurTtn("NON_CONFIGUREE", "L'accès à TTN n'est pas activé sur ce serveur (SIGNATURE_CLE_SECRET absent ou trop court).", 503);
  return secret;
};

export async function etatConnexion() {
  const r = (await query("select url, login, matricule, environnement, maj_le, maj_par from ttn_connexion where id = 1")).rows[0];
  return {
    configuree: Boolean(secretConfigure()),
    connexion: r
      ? {
          url: r.url,
          login: r.login,
          matricule: r.matricule,
          environnement: r.environnement,
          motDePasseDefini: true,
          majLe: r.maj_le instanceof Date ? r.maj_le.toISOString() : r.maj_le,
          majPar: r.maj_par,
        }
      : null,
  };
}

/** Accès complets (mot de passe en clair, en mémoire seulement) pour un appel au service ; null si rien n'est enregistré. */
export async function lireConnexion() {
  const r = (await query("select url, login, mdp_chiffre, matricule, environnement from ttn_connexion where id = 1")).rows[0];
  if (!r) return null;
  const secret = exigerSecret();
  let motDePasse;
  try {
    motDePasse = dechiffrer(r.mdp_chiffre, secret).toString("utf8");
  } catch (e) {
    if (e instanceof ErreurSignature) throw new ErreurTtn("COFFRE", e.message.replace("le certificat", "les accès TTN").replace("Rechargez le certificat", "Saisissez de nouveau les accès TTN"), 409);
    throw e;
  }
  let matricule = r.matricule;
  if (!matricule) {
    const mf = (await query("select cabinet_mf from app_meta where id = 1")).rows[0]?.cabinet_mf ?? "";
    matricule = normaliserMatriculeFiscal(mf);
  }
  return { url: r.url, login: r.login, motDePasse, matricule, environnement: r.environnement };
}

export async function enregistrerConnexion({ url, login, motDePasse, matricule, environnement }, par) {
  const secret = exigerSecret();
  const adresse = verifierUrl(url, { autoriserLocal: autoriserLocal() });
  const existe = (await query("select 1 from ttn_connexion where id = 1")).rowCount > 0;
  if (!existe && !motDePasse) throw new ErreurTtn("MOT_DE_PASSE", "Saisissez le mot de passe El Fatoora.", 400);
  const mf = String(matricule ?? "").trim();
  if (motDePasse) {
    await query(
      `insert into ttn_connexion (id, url, login, mdp_chiffre, matricule, environnement, maj_le, maj_par)
       values (1, $1, $2, $3, $4, $5, now(), $6)
       on conflict (id) do update set url = excluded.url, login = excluded.login, mdp_chiffre = excluded.mdp_chiffre,
         matricule = excluded.matricule, environnement = excluded.environnement, maj_le = now(), maj_par = excluded.maj_par`,
      [adresse, login, chiffrer(Buffer.from(motDePasse, "utf8"), secret), mf, environnement, par ?? ""],
    );
  } else {
    await query("update ttn_connexion set url = $1, login = $2, matricule = $3, environnement = $4, maj_le = now(), maj_par = $5 where id = 1", [
      adresse,
      login,
      mf,
      environnement,
      par ?? "",
    ]);
  }
}

export async function supprimerConnexion() {
  return (await query("delete from ttn_connexion where id = 1")).rowCount > 0;
}
