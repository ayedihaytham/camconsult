/**
 * Contrôle de configuration avant mise en production. Lecture seule : ne modifie rien et n'affiche JAMAIS la valeur d'un secret
 * (seulement présent / longueur / conforme ou non). Les niveaux : "echec" bloque la mise en ligne, "alerte" demande une décision,
 * "ok" et "info" sont informatifs.
 */
const SECRET_PAR_DEFAUT = "dev-secret-change-me";

export function evaluerConfiguration(env = process.env) {
  const resultats = [];
  const ajouter = (niveau, code, message) => resultats.push({ niveau, code, message });
  const prod = env.NODE_ENV === "production";

  ajouter(prod ? "ok" : "alerte", "NODE_ENV", prod ? "NODE_ENV=production" : "NODE_ENV n'est pas « production » : les protections de production ne sont pas actives.");

  const secret = env.JWT_SECRET ?? "";
  if (!secret) ajouter("echec", "JWT_SECRET", "JWT_SECRET est absent : le serveur utiliserait un secret connu.");
  else if (secret === SECRET_PAR_DEFAUT) ajouter("echec", "JWT_SECRET", "JWT_SECRET est la valeur de développement.");
  else if (secret.length < 24) ajouter("echec", "JWT_SECRET", `JWT_SECRET est trop court (${secret.length} caractères, 24 au moins).`);
  else if (new Set(secret).size < 10) ajouter("alerte", "JWT_SECRET", "JWT_SECRET contient très peu de caractères différents : utilisez un secret aléatoire (openssl rand -hex 48).");
  else ajouter("ok", "JWT_SECRET", `JWT_SECRET défini (${secret.length} caractères).`);

  const adminMdp = env.ADMIN_PASSWORD ?? "";
  if (!adminMdp) ajouter("info", "ADMIN_PASSWORD", "ADMIN_PASSWORD absent : acceptable seulement si le compte administrateur existe déjà (il n'est lu qu'à la première initialisation).");
  else if (adminMdp === "Cabinet2026!") ajouter("echec", "ADMIN_PASSWORD", "ADMIN_PASSWORD est la valeur par défaut connue.");
  else if (adminMdp.length < 12) ajouter("alerte", "ADMIN_PASSWORD", "ADMIN_PASSWORD est court (12 caractères conseillés).");
  else ajouter("ok", "ADMIN_PASSWORD", "ADMIN_PASSWORD défini.");

  const dbUrl = env.DATABASE_URL ?? "";
  if (!dbUrl) ajouter("echec", "DATABASE_URL", "DATABASE_URL est absent.");
  else {
    try {
      const u = new URL(dbUrl);
      const faible = decodeURIComponent(u.password) === decodeURIComponent(u.username) || ["cabinet", "postgres", "password", "123456"].includes(decodeURIComponent(u.password));
      ajouter(faible ? "echec" : "ok", "DATABASE_URL", faible ? "Le mot de passe de la base est faible ou identique à l'utilisateur." : "DATABASE_URL défini, mot de passe non trivial.");
    } catch {
      ajouter("echec", "DATABASE_URL", "DATABASE_URL n'est pas une adresse valide.");
    }
  }

  ajouter(env.CORS_ORIGIN ? "ok" : prod ? "info" : "info", "CORS_ORIGIN", env.CORS_ORIGIN ? "CORS_ORIGIN défini." : "CORS_ORIGIN absent : en production les requêtes d'autres origines sont refusées (comportement voulu pour un site servi par le même serveur).");

  ajouter(env.APP_URL ? "ok" : "alerte", "APP_URL", env.APP_URL ? "APP_URL défini : les liens d'accès pointent vers la bonne adresse." : "APP_URL absent : les liens d'accès utilisent l'adresse par défaut du cabinet.");

  const smtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  ajouter(smtp ? "ok" : "info", "SMTP", smtp ? "Envoi d'emails configuré." : "Envoi d'emails non configuré : les liens d'accès doivent être transmis à la main.");

  ajouter(
    env.MIGRATE_LEGACY_PASSWORDS === "false" ? "alerte" : "ok",
    "MIGRATE_LEGACY_PASSWORDS",
    env.MIGRATE_LEGACY_PASSWORDS === "false"
      ? "Conversion des anciens mots de passe SUSPENDUE (période de validation) : les comptes hérités restent en clair tant que ce réglage n'est pas retiré. À lever après validation de la version."
      : "Les anciens mots de passe sont convertis à la première connexion.",
  );

  const cleSignature = env.SIGNATURE_CLE_SECRET ?? "";
  if (!cleSignature) ajouter("info", "SIGNATURE_CLE_SECRET", "SIGNATURE_CLE_SECRET absent : la signature électronique des factures El Fatoora est désactivée (aucun certificat ne peut être enregistré).");
  else if (cleSignature.length < 32 || new Set(cleSignature).size < 10) ajouter("alerte", "SIGNATURE_CLE_SECRET", "SIGNATURE_CLE_SECRET est trop court ou trop répétitif (32 caractères aléatoires au moins : openssl rand -hex 32) : la signature restera désactivée.");
  else ajouter("ok", "SIGNATURE_CLE_SECRET", `SIGNATURE_CLE_SECRET défini (${cleSignature.length} caractères) : le certificat de signature est chiffré en base.`);

  ajouter(env.ALLOW_DATA_RESET === "true" ? "alerte" : "ok", "ALLOW_DATA_RESET", env.ALLOW_DATA_RESET === "true" ? "ALLOW_DATA_RESET=true : la réinitialisation totale des données est permise. À retirer en production." : "La réinitialisation totale est désactivée.");

  ajouter(env.CLIENT_IP_HEADER ? "info" : "alerte", "CLIENT_IP_HEADER", env.CLIENT_IP_HEADER ? `Adresse du visiteur lue dans « ${env.CLIENT_IP_HEADER} » (à ne laisser que si le serveur n'est joignable que par ce proxy).` : "CLIENT_IP_HEADER absent : si un proxy masque l'adresse des visiteurs, la limite de tentatives de connexion les traite comme une seule adresse. Vérifiez avec un test réel.");

  return resultats;
}

export const aEchec = (resultats) => resultats.some((r) => r.niveau === "echec");
