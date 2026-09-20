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
  accent: "#c9a24b", // or — voir --accent
  bg: "#f4f5f7",
};

function emailShell({ title, bodyHtml }) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,44,76,0.08);">
            <tr>
              <td style="background:${BRAND.primary};padding:24px 32px;">
                <span style="color:${BRAND.accent};font-size:20px;font-weight:bold;letter-spacing:0.5px;">CAMCONSULT</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:18px;color:${BRAND.primary};">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#888;">
                  Cabinet CAMCONSULT — <a href="https://camconsult.com.tn" style="color:${BRAND.primary};">camconsult.com.tn</a>
                </p>
              </td>
            </tr>
          </table>
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
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">Bonjour,</p>
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">
      La société <strong>${escapeHtml(societe.raisonSociale)}</strong> vient d'être enregistrée
      auprès du cabinet CAMCONSULT.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;background:${BRAND.bg};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;font-size:13px;color:#555;">
          <strong>Code interne :</strong> ${escapeHtml(societe.code)}<br/>
          <strong>Statut :</strong> ${escapeHtml(societe.statut)}
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#333;line-height:1.5;">
      Pour toute question, notre équipe reste à votre disposition.
    </p>
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: societe.email,
    subject: `Bienvenue chez CAMCONSULT — ${societe.raisonSociale}`,
    html: emailShell({ title: "Bienvenue au cabinet CAMCONSULT", bodyHtml }),
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
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">Bonjour ${escapeHtml(employe.prenom)},</p>
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">
      Votre compte a été créé sur l'espace du cabinet CAMCONSULT. Voici vos identifiants de connexion :
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;background:${BRAND.bg};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;font-size:13px;color:#555;">
          <strong>Identifiant :</strong> ${escapeHtml(employe.identifiant)}<br/>
          <strong>Mot de passe :</strong> ${escapeHtml(employe.motDePasse)}
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.5;">
      Connectez-vous sur
      <a href="https://cabinet.camconsult.com.tn" style="color:${BRAND.primary};">cabinet.camconsult.com.tn</a>.
    </p>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">
      Pour votre sécurité, pensez à changer ce mot de passe après votre première connexion.
    </p>
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: employe.email,
    subject: "Bienvenue chez CAMCONSULT — vos identifiants",
    html: emailShell({ title: "Bienvenue au cabinet CAMCONSULT", bodyHtml }),
  });
  console.log(`[mailer] identifiants collaborateur envoyés à ${employe.email}`);
}

/** Relance envoyée à la société cliente pour une collecte en attente
 * (échéance dépassée, pas encore transmise) — voir server/relances.js. */
export async function sendCollecteRelanceEmail({ email, raisonSociale, periode, echeance }) {
  if (!mailerAvailable()) {
    console.log("[mailer] relance sautée (SMTP non configuré)");
    return;
  }
  if (!email) {
    console.log(`[mailer] relance sautée : société « ${raisonSociale} » sans email`);
    return;
  }

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">Bonjour,</p>
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">
      La collecte de pièces <strong>${escapeHtml(periode)}</strong> est toujours en attente
      de votre part${echeance ? ` — échéance dépassée depuis le ${escapeHtml(echeance)}` : ""}.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.5;">
      Merci de vous connecter à votre espace pour la compléter et la transmettre au cabinet.
    </p>
    <p style="margin:0;font-size:14px;color:#333;line-height:1.5;">
      Connectez-vous sur
      <a href="https://cabinet.camconsult.com.tn" style="color:${BRAND.primary};">cabinet.camconsult.com.tn</a>.
    </p>
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Rappel — collecte de pièces en attente (${periode})`,
    html: emailShell({ title: "Collecte de pièces en attente", bodyHtml }),
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
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">Bonjour,</p>
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.5;">
      La collecte de pièces <strong>${escapeHtml(periode)}</strong> approche de son échéance
      ${echeance ? ` — à transmettre avant le ${escapeHtml(echeance)}` : ""}.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.5;">
      Merci de vous connecter à votre espace pour la compléter et la transmettre au cabinet.
    </p>
    <p style="margin:0;font-size:14px;color:#333;line-height:1.5;">
      Connectez-vous sur
      <a href="https://cabinet.camconsult.com.tn" style="color:${BRAND.primary};">cabinet.camconsult.com.tn</a>.
    </p>
  `;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Échéance proche — collecte de pièces (${periode})`,
    html: emailShell({ title: "Échéance de collecte proche", bodyHtml }),
  });
  console.log(`[mailer] rappel avant échéance envoyé à ${email}`);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
