import nodemailer from "nodemailer";

/**
 * Envoi d'emails réel (SMTP) — facultatif : sans les variables d'env
 * SMTP_HOST/SMTP_USER/SMTP_PASSWORD, `mailerAvailable()` renvoie false et
 * les appelants (routes) sautent l'envoi silencieusement, sans faire
 * échouer l'action métier (créer une société ne doit jamais planter à
 * cause d'un email qui ne part pas).
 */
export function mailerAvailable() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

let transport = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      // 465 = SSL implicite ; 587 = STARTTLS (secure: false, upgrade en TLS après connexion).
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transport;
}

const BRAND = {
  primary: "#0f2c4c", // marine — voir --primary du design system
  primaryDeep: "#0a1f36",
  accent: "#c9a24b", // or — voir --accent
  warning: "#b45309", // rappel avant échéance — pas encore urgent
  danger: "#b3261e", // relance — échéance dépassée
  bg: "#eef1f5",
  text: "#1f2937",
  muted: "#6b7280",
};

/** Bloc d'infos clé/valeur avec liseré de couleur à gauche (accent de statut
 * par défaut — surchargé en rouge pour une relance en retard, par ex). */
function infoCard(rows, accent = BRAND.accent) {
  const rowsHtml = rows
    .filter(Boolean)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:7px 0;font-size:11px;font-weight:700;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.06em;width:42%;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:7px 0;font-size:14px;color:${BRAND.text};font-weight:600;vertical-align:top;">${value}</td>
        </tr>`,
    )
    .join("");
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;background:#f8f9fb;border-left:3px solid ${accent};border-radius:0 8px 8px 0;">
      <tr>
        <td style="padding:14px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rowsHtml}</table>
        </td>
      </tr>
    </table>`;
}

/** Bouton d'action — toujours le même style (or sur marine), quel que soit
 * l'accent de statut utilisé ailleurs dans l'email. */
function ctaButton(label, href) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
      <tr>
        <td style="border-radius:8px;background:${BRAND.accent};">
          <a href="${href}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:${BRAND.primary};text-decoration:none;border-radius:8px;">${escapeHtml(label)} &rarr;</a>
        </td>
      </tr>
    </table>`;
}

function paragraph(html) {
  return `<p style="margin:0 0 14px;font-size:14px;color:${BRAND.text};line-height:1.6;">${html}</p>`;
}

/**
 * `eyebrow` = petit repère de statut au-dessus du titre (ex: "NOUVELLE
 * SOCIÉTÉ", "ACTION REQUISE"), coloré avec `accent` — c'est ce qui donne le
 * ton (informatif / urgent) au premier coup d'œil, avant même de lire.
 */
function emailShell({ eyebrow, title, bodyHtml, accent = BRAND.accent }) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,Segoe UI,Roboto,Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,44,76,0.10);">
            <tr>
              <td style="background-color:${BRAND.primary};background-image:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDeep});padding:22px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px;vertical-align:middle;">
                      <img src="https://camconsult.com.tn/brand/logo-mark-dark.png" width="30" height="30" alt="CAMCONSULT" style="display:block;border-radius:7px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:${BRAND.accent};font-size:20px;font-weight:800;letter-spacing:0.5px;">CAMCONSULT</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="height:3px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                ${eyebrow ? `<p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.09em;color:${accent};text-transform:uppercase;">${escapeHtml(eyebrow)}</p>` : ""}
                <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:${BRAND.primary};">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 26px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef0f2;padding-top:18px;">
                  <tr>
                    <td style="font-size:12px;color:${BRAND.muted};line-height:1.6;">
                      Cabinet CAMCONSULT — Expertise comptable<br/>
                      <a href="https://camconsult.com.tn" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">camconsult.com.tn</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#9aa3af;max-width:540px;">
            Vous recevez cet email en tant que client ou collaborateur du cabinet CAMCONSULT.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Email de bienvenue envoyé à l'adresse de contact d'une société, dès sa
 * création dans le cabinet (voir server/routes/societes.js). */
export async function sendSocieteWelcomeEmail(societe) {
  if (!mailerAvailable()) {
    console.log("[mailer] envoi sauté (SMTP non configuré)");
    return;
  }
  if (!societe.email) {
    console.log(`[mailer] envoi sauté : société « ${societe.raisonSociale} » sans email`);
    return;
  }

  const bodyHtml = `
    ${paragraph("Bonjour,")}
    ${paragraph(`La société <strong>${escapeHtml(societe.raisonSociale)}</strong> vient d'être enregistrée auprès du cabinet CAMCONSULT.`)}
    ${infoCard([
      ["Code interne", escapeHtml(societe.code)],
      ["Statut", escapeHtml(societe.statut)],
    ])}
    ${paragraph("Pour toute question, notre équipe reste à votre disposition.")}
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: societe.email,
    subject: `Bienvenue chez CAMCONSULT — ${societe.raisonSociale}`,
    html: emailShell({
      eyebrow: "Nouvelle société",
      title: "Bienvenue au cabinet CAMCONSULT",
      bodyHtml,
    }),
  });
  console.log(`[mailer] bienvenue société envoyée à ${societe.email}`);
}

/** Email envoyé à un collaborateur (ou employé de société) dès la création
 * de son compte, avec ses identifiants de connexion — le mot de passe est
 * stocké en clair côté appli (comparaison directe en base, voir
 * server/routes/auth.js) et déjà visible en clair par l'admin dans l'écran
 * Collaborateurs, donc l'inclure ici n'ouvre pas de nouvelle surface — mais
 * c'est un choix assumé de l'utilisateur (email en clair = un canal moins
 * sûr qu'une remise en main propre), pas une bonne pratique par défaut. */
export async function sendCollaborateurWelcomeEmail(employe) {
  if (!mailerAvailable()) {
    console.log("[mailer] envoi sauté (SMTP non configuré)");
    return;
  }
  if (!employe.email) {
    console.log(`[mailer] envoi sauté : collaborateur « ${employe.prenom} ${employe.nom} » sans email`);
    return;
  }

  const bodyHtml = `
    ${paragraph(`Bonjour ${escapeHtml(employe.prenom)},`)}
    ${paragraph("Votre compte a été créé sur l'espace du cabinet CAMCONSULT. Voici vos identifiants de connexion :")}
    ${infoCard([
      ["Identifiant", escapeHtml(employe.identifiant)],
      ["Mot de passe", `<span style="font-family:'Courier New',monospace;">${escapeHtml(employe.motDePasse)}</span>`],
    ])}
    ${ctaButton("Accéder à mon espace", "https://cabinet.camconsult.com.tn")}
    ${paragraph(`<span style="font-size:13px;color:${BRAND.muted};">Pour votre sécurité, pensez à changer ce mot de passe après votre première connexion.</span>`)}
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: employe.email,
    subject: "Bienvenue chez CAMCONSULT — vos identifiants",
    html: emailShell({
      eyebrow: "Accès créé",
      title: `Bienvenue, ${escapeHtml(employe.prenom)}`,
      bodyHtml,
    }),
  });
  console.log(`[mailer] identifiants collaborateur envoyés à ${employe.email}`);
}

/** Email envoyé quand l'admin (ou le responsable des collaborateurs)
 * réinitialise le mot de passe d'un compte — voir server/routes/employes.js
 * (déclenché dès que motDePasse change dans un PATCH). Même choix assumé
 * qu'à la création (mot de passe en clair, voir sendCollaborateurWelcomeEmail) ;
 * ce mot de passe n'est qu'un sas de passage, le compte doit en choisir un
 * autre à la prochaine connexion (voir doitChangerMotDePasse). */
export async function sendPasswordResetEmail(employe) {
  if (!mailerAvailable()) {
    console.log("[mailer] envoi sauté (SMTP non configuré)");
    return;
  }
  if (!employe.email) {
    console.log(`[mailer] envoi sauté : « ${employe.prenom} ${employe.nom} » sans email`);
    return;
  }

  const bodyHtml = `
    ${paragraph(`Bonjour ${escapeHtml(employe.prenom)},`)}
    ${paragraph("Votre mot de passe vient d'être réinitialisé par le cabinet CAMCONSULT. Voici votre nouveau mot de passe :")}
    ${infoCard(
      [
        ["Identifiant", escapeHtml(employe.identifiant)],
        ["Nouveau mot de passe", `<span style="font-family:'Courier New',monospace;">${escapeHtml(employe.motDePasse)}</span>`],
      ],
      BRAND.warning,
    )}
    ${ctaButton("Accéder à mon espace", "https://cabinet.camconsult.com.tn")}
    ${paragraph(`<span style="font-size:13px;color:${BRAND.muted};">Il vous sera demandé d'en choisir un autre, connu de vous seul, dès votre prochaine connexion.</span>`)}
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: employe.email,
    subject: "CAMCONSULT — votre mot de passe a été réinitialisé",
    html: emailShell({
      eyebrow: "Mot de passe réinitialisé",
      title: `Bonjour ${escapeHtml(employe.prenom)}`,
      bodyHtml,
      accent: BRAND.warning,
    }),
  });
  console.log(`[mailer] réinitialisation de mot de passe envoyée à ${employe.email}`);
}

/** Relance envoyée à la société cliente pour une collecte en attente
 * (échéance dépassée, pas encore transmise) — voir server/relances.js. */
/** Date d'échéance (Date renvoyée par pg pour une colonne `date`, ou texte
 * « AAAA-MM-JJ ») → « 24/09/2026 » ; null si absente. */
export function frDateEcheance(d) {
  if (!d) return null;
  if (d instanceof Date)
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
}

const periodeTexte = (p) => (p && String(p).trim()) || "période non précisée";

/**
 * Relance d'une collecte en attente du client — le texte suit la situation
 * réelle : échéance dépassée, échéance à venir, ou pas d'échéance du tout
 * (relance manuelle « Relancer maintenant »).
 */
export async function sendCollecteRelanceEmail({ email, raisonSociale, periode, echeance, depassee }) {
  if (!mailerAvailable()) {
    console.log("[mailer] relance sautée (SMTP non configuré)");
    return;
  }
  if (!email) {
    console.log(`[mailer] relance sautée : société « ${raisonSociale} » sans email`);
    return;
  }

  const date = frDateEcheance(echeance);
  const accent = date && depassee ? BRAND.danger : BRAND.warning;
  const bodyHtml = `
    ${paragraph("Bonjour,")}
    ${paragraph(`La collecte de pièces <strong>${escapeHtml(periodeTexte(periode))}</strong> est toujours en attente de votre part.`)}
    ${infoCard(
      [
        ["Période", escapeHtml(periodeTexte(periode))],
        date
          ? depassee
            ? ["Échéance dépassée depuis le", `<span style="color:${BRAND.danger};">${escapeHtml(date)}</span>`]
            : ["À transmettre avant le", escapeHtml(date)]
          : null,
      ],
      accent,
    )}
    ${paragraph("Merci de vous connecter à votre espace pour la compléter et la transmettre au cabinet.")}
    ${ctaButton("Compléter ma collecte", "https://cabinet.camconsult.com.tn")}
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Rappel — collecte de pièces en attente (${periodeTexte(periode)})`,
    html: emailShell({
      eyebrow: date && depassee ? "Action requise" : "Rappel",
      title: "Collecte de pièces en attente",
      bodyHtml,
      accent,
    }),
  });
  console.log(`[mailer] relance collecte envoyée à ${email}`);
}

/** Rappel envoyé une seule fois AVANT l'échéance (contrairement à
 * sendCollecteRelanceEmail, envoyé APRÈS) — voir server/relances.js. */
export async function sendCollecteRappelAvantEmail({ email, raisonSociale, periode, echeance }) {
  if (!mailerAvailable()) {
    console.log("[mailer] rappel sauté (SMTP non configuré)");
    return;
  }
  if (!email) {
    console.log(`[mailer] rappel sauté : société « ${raisonSociale} » sans email`);
    return;
  }

  const bodyHtml = `
    ${paragraph("Bonjour,")}
    ${paragraph(`La collecte de pièces <strong>${escapeHtml(periodeTexte(periode))}</strong> approche de son échéance.`)}
    ${infoCard(
      [
        ["Période", escapeHtml(periodeTexte(periode))],
        echeance ? ["À transmettre avant le", escapeHtml(frDateEcheance(echeance))] : null,
      ],
      BRAND.warning,
    )}
    ${paragraph("Merci de vous connecter à votre espace pour la compléter et la transmettre au cabinet.")}
    ${ctaButton("Compléter ma collecte", "https://cabinet.camconsult.com.tn")}
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Échéance proche — collecte de pièces (${periodeTexte(periode)})`,
    html: emailShell({
      eyebrow: "Rappel",
      title: "Échéance de collecte proche",
      bodyHtml,
      accent: BRAND.warning,
    }),
  });
  console.log(`[mailer] rappel avant échéance envoyé à ${email}`);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
