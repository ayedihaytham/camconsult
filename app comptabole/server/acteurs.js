import { query } from "./db.js";

/**
 * Identité d'un auteur dans les traces d'audit métier (apurement : historique, approbation, vérification…).
 * Un employé est identifié par son identifiant ; un administrateur par « admin:<id> » (un compte par administrateur). L'ancienne valeur
 * « admin » (écrite quand il n'y avait qu'un administrateur) reste lisible : elle se lit comme l'administrateur principal. Les anciennes
 * lignes ne sont jamais réécrites (certaines sont couvertes par l'empreinte d'une déclaration approuvée).
 */
export const acteurSession = (session) => (session.role === "admin" ? `admin:${session.adminId}` : session.employeId);

/** Noms lisibles d'une liste d'identifiants d'auteur : Map identifiant → nom (absent si le compte n'existe plus). */
export async function nomsActeurs(ids) {
  const noms = new Map();
  const liste = [...new Set((ids ?? []).filter(Boolean).map(String))];
  if (!liste.length) return noms;
  const admins = (await query("select id, nom, principal from administrateurs")).rows;
  const adminParCle = new Map(admins.map((a) => [`admin:${a.id}`, a.nom]));
  const principal = admins.find((a) => a.principal);
  const employes = liste.filter((i) => !i.startsWith("admin") && /^[0-9a-f-]{36}$/i.test(i));
  const emps = employes.length ? (await query("select id, prenom, nom from employes where id = any($1::uuid[])", [employes])).rows : [];
  const empParId = new Map(emps.map((e) => [e.id, `${e.prenom} ${e.nom}`]));
  for (const i of liste) {
    if (i === "admin") noms.set(i, principal ? principal.nom : "Administrateur");
    else if (adminParCle.has(i)) noms.set(i, adminParCle.get(i));
    else if (empParId.has(i)) noms.set(i, empParId.get(i));
  }
  return noms;
}
