import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { factureDto, factureLigneDto } from "../mappers.js";
import { ErreurTeif, construireTeif, genererTeif, texteTeif } from "../teif/genererTeif.js";
import { obtenir as materielDeverrouille } from "../signature/deverrouillage.js";
import { ErreurSignature } from "../signature/erreur.js";
import { signerTeif } from "../signature/signerTeif.js";
import { signatureRouter } from "./signature.js";
import { ttnRouter } from "./ttn.js";
import { autoriserLocal, lireConnexion } from "../ttn/connexion.js";
import { ErreurTtn } from "../ttn/erreur.js";
import { consulterFacture, deposerFacture } from "../ttn/soap.js";
import { actualiserFacture } from "../ttn/suivi.js";
import { lireRefTtn } from "../ttn/refTtn.js";
import { aDesBloquants, controlerFactureTeif } from "../teif/validerTeif.js";
import { TEIF_VERSION } from "../teif/constantes.js";

export const facturationRouter = Router();
facturationRouter.use(requireAuth, requireAdmin);
// Certificat de signature électronique (déclaré avant les routes /:id).
facturationRouter.use("/signature", signatureRouter);
// Accès au service web TTN (adresse, identifiants chiffrés, essai de connexion, actualisation globale).
facturationRouter.use("/ttn", ttnRouter);

const STATUTS = ["emise", "payee", "annulee"];

const ligneSchema = z.object({
  description: z.string().trim().min(1, "Chaque ligne doit avoir une description"),
  quantite: z.coerce.number().positive("La quantité doit être positive").default(1),
  montantHt: z.coerce.number().min(0, "Le montant HT ne peut pas être négatif"),
});

const createSchema = z.object({
  societeId: z.string().uuid("Choisissez le client"),
  dateEmission: z.string().nullish(),
  echeance: z.string().nullish(),
  tvaTaux: z.coerce.number().min(0).max(100).default(19),
  timbre: z.coerce.number().min(0).default(1),
  note: z.string().default(""),
  lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne"),
});

const patchSchema = z.object({
  statut: z.enum(STATUTS).optional(),
  signee: z.boolean().optional(),
});

const SELECT = `select f.*, s.raison_sociale as societe_nom, s.adresse as societe_adresse,
                       s.tva as societe_tva, s.rne as societe_rne,
                       e.statut as ei_statut, e.genere_le as ei_genere_le, e.teif_sha256 as ei_sha256, e.signe_le as ei_signe_le, e.teif_signe_sha256 as ei_signe_sha,
                       e.depose_le as ei_depose_le, e.ttn_message as ei_ttn_message, e.ttn_ref as ei_ttn_ref, e.ttn_ref_date as ei_ttn_ref_date,
                       e.ttn_qr_png as ei_ttn_qr, e.ttn_acquittements as ei_ttn_acq, e.ttn_derniere_erreur as ei_ttn_erreur
                  from factures f join societes s on s.id = f.societe_id
                  left join facture_einvoice e on e.facture_id = f.id`;

async function charger(where, params) {
  const rows = (await query(`${SELECT} ${where} order by f.date_emission desc, f.numero desc`, params)).rows;
  if (rows.length === 0) return [];
  const lignes = (
    await query("select * from facture_lignes where facture_id = any($1::uuid[]) order by ordre", [
      rows.map((r) => r.id),
    ])
  ).rows;
  const parFacture = new Map();
  for (const l of lignes) parFacture.set(l.facture_id, [...(parFacture.get(l.facture_id) ?? []), factureLigneDto(l)]);
  return rows.map((r) => factureDto(r, parFacture.get(r.id) ?? []));
}

const cabinetSchema = z.object({
  adresse: z.string().trim().max(300).default(""),
  matriculeFiscal: z.string().trim().max(60).default(""),
  telephone: z.string().trim().max(60).default(""),
  email: z.string().trim().max(120).default(""),
  rib: z.string().trim().max(80).default(""),
  mentions: z.string().trim().max(600).default(""),
  // Identité structurée pour la facture électronique (TEIF)
  raisonSociale: z.string().trim().max(200).default(""),
  rue: z.string().trim().max(100).default(""),
  ville: z.string().trim().max(100).default(""),
  codePostal: z.string().trim().max(20).default(""),
  pays: z.string().trim().max(6).default("TN"),
  rc: z.string().trim().max(200).default(""),
});

const cabinetDto = (m) => ({
  // Nom imprimé en tête des factures : la raison sociale si elle est renseignée, sinon le nom de l'administrateur (comportement historique).
  nom: m?.cabinet_nom || m?.admin_nom || "",
  raisonSociale: m?.cabinet_nom ?? "",
  rue: m?.cabinet_rue ?? "",
  ville: m?.cabinet_ville ?? "",
  codePostal: m?.cabinet_code_postal ?? "",
  pays: m?.cabinet_pays || "TN",
  rc: m?.cabinet_rc ?? "",
  adresse: m?.cabinet_adresse ?? "",
  matriculeFiscal: m?.cabinet_mf ?? "",
  telephone: m?.cabinet_tel ?? "",
  email: m?.cabinet_email ?? "",
  rib: m?.cabinet_rib ?? "",
  mentions: m?.cabinet_mentions ?? "",
});

// Coordonnées du cabinet imprimées en en-tête et pied des factures.
facturationRouter.get("/cabinet", async (_req, res) => {
  res.json(cabinetDto((await query("select * from app_meta where id = 1")).rows[0]));
});

facturationRouter.put("/cabinet", async (req, res) => {
  const parsed = cabinetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rows } = await query(
    `update app_meta set cabinet_adresse = $1, cabinet_mf = $2, cabinet_tel = $3,
            cabinet_email = $4, cabinet_rib = $5, cabinet_mentions = $6,
            cabinet_nom = $7, cabinet_rue = $8, cabinet_ville = $9, cabinet_code_postal = $10, cabinet_pays = $11, cabinet_rc = $12
      where id = 1 returning *`,
    [v.adresse, v.matriculeFiscal, v.telephone, v.email, v.rib, v.mentions, v.raisonSociale, v.rue, v.ville, v.codePostal, v.pays || "TN", v.rc],
  );
  logAction(req.session.nom, "modification", "cabinet", "Coordonnées du cabinet (factures)");
  res.json(cabinetDto(rows[0]));
});

facturationRouter.get("/", async (_req, res) => {
  res.json(await charger("", []));
});

facturationRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (v.echeance && v.dateEmission && v.echeance < v.dateEmission) return res.status(400).json({ error: "L'échéance ne peut pas précéder la date d'émission" });
  const societe = (await query("select raison_sociale from societes where id = $1", [v.societeId])).rows[0];
  if (!societe) return res.status(404).json({ error: "Société introuvable" });

  const id = await withTransaction(async (client) => {
    // Numérotation séquentielle par année d'émission (AAAA-0001…), sans trou
    // ni doublon même avec deux créations simultanées.
    await client.query("select pg_advisory_xact_lock(hashtext('factures-numero'))");
    const emission = v.dateEmission || new Date().toISOString().slice(0, 10);
    const annee = emission.slice(0, 4);
    const { rows: suivant } = await client.query(
      `select coalesce(max(substring(numero from '[0-9]+$')::int), 0) + 1 as n
         from factures where numero like $1`,
      [`${annee}-%`],
    );
    const numero = `${annee}-${String(suivant[0].n).padStart(4, "0")}`;
    const { rows } = await client.query(
      `insert into factures (societe_id, numero, date_emission, echeance, tva_taux, timbre, note)
       values ($1,$2,$3::date,$4::date,$5,$6,$7) returning id`,
      [v.societeId, numero, emission, v.echeance || null, v.tvaTaux, v.timbre, v.note],
    );
    let i = 0;
    for (const l of v.lignes) {
      await client.query(
        "insert into facture_lignes (facture_id, ordre, description, quantite, montant_ht) values ($1,$2,$3,$4,$5)",
        [rows[0].id, i++, l.description, l.quantite, l.montantHt],
      );
    }
    return rows[0].id;
  });
  const [facture] = await charger("where f.id = $1", [id]);
  logAction(req.session.nom, "creation", "facture", `${facture.numero} — ${societe.raison_sociale}`, id);
  res.status(201).json(facture);
});

// Modification d'une facture émise : en-tête et lignes remplacés, numéro conservé. Refusée dès qu'elle est payée, annulée ou que sa
// facture électronique est signée ou déposée (il faut alors un avoir). Une facture électronique seulement préparée devra être régénérée.
facturationRouter.put("/:id", async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: "Identifiant de facture invalide" });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (v.echeance && v.dateEmission && v.echeance < v.dateEmission) return res.status(400).json({ error: "L'échéance ne peut pas précéder la date d'émission" });
  const existante = (
    await query(
      `select f.numero, f.statut, e.statut as ei_statut from factures f left join facture_einvoice e on e.facture_id = f.id where f.id = $1`,
      [req.params.id],
    )
  ).rows[0];
  if (!existante) return res.status(404).json({ error: "Facture introuvable" });
  if (existante.statut !== "emise") return res.status(409).json({ error: "Seule une facture émise et non payée peut être modifiée." });
  if (existante.ei_statut && existante.ei_statut !== "prete")
    return res.status(409).json({ error: "Cette facture électronique est signée ou déposée : elle ne peut plus être modifiée (avoir requis)." });
  const societe = (await query("select raison_sociale from societes where id = $1", [v.societeId])).rows[0];
  if (!societe) return res.status(404).json({ error: "Société introuvable" });

  await withTransaction(async (client) => {
    // Une signature ou un dépôt survenu entre-temps doit empêcher la modification : on relit le statut en verrouillant la ligne.
    const ei = (await client.query("select statut from facture_einvoice where facture_id = $1 for update", [req.params.id])).rows[0];
    if (ei && ei.statut !== "prete") throw Object.assign(new Error("fige"), { fige: true });
    await client.query(
      `update factures set societe_id = $2, date_emission = $3::date, echeance = $4::date, tva_taux = $5, timbre = $6, note = $7, maj_le = now()
        where id = $1 and statut = 'emise'`,
      [req.params.id, v.societeId, v.dateEmission || new Date().toISOString().slice(0, 10), v.echeance || null, v.tvaTaux, v.timbre, v.note],
    );
    await client.query("delete from facture_lignes where facture_id = $1", [req.params.id]);
    let i = 0;
    for (const l of v.lignes) {
      await client.query("insert into facture_lignes (facture_id, ordre, description, quantite, montant_ht) values ($1,$2,$3,$4,$5)", [
        req.params.id,
        i++,
        l.description,
        l.quantite,
        l.montantHt,
      ]);
    }
  }).catch((e) => {
    if (e?.fige) return res.status(409).json({ error: "Cette facture électronique est signée ou déposée : elle ne peut plus être modifiée (avoir requis)." });
    throw e;
  });
  if (res.headersSent) return;
  const [facture] = await charger("where f.id = $1", [req.params.id]);
  logAction(req.session.nom, "modification", "facture", `${existante.numero} — facture modifiée (${societe.raison_sociale})`, req.params.id);
  res.json(facture);
});

facturationRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const existante = (await query("select numero, statut from factures where id = $1", [req.params.id])).rows[0];
  if (!existante) return res.status(404).json({ error: "Facture introuvable" });
  if (existante.statut === "annulee") return res.status(409).json({ error: "Cette facture est annulée" });
  if (v.statut === "annulee") {
    // Une facture déjà signée ou déposée chez TTN ne s'annule pas d'un clic : il faudra un avoir (étape ultérieure).
    const ei = (await query("select statut from facture_einvoice where facture_id = $1", [req.params.id])).rows[0];
    // Une facture électronique REJETÉE par TTN n'a jamais été acceptée : elle peut être annulée.
    if (ei && ei.statut !== "prete" && ei.statut !== "rejetee")
      return res.status(409).json({ error: "Cette facture électronique est signée ou déposée : elle ne peut plus être annulée ici (avoir requis)." });
  }

  await query(
    `update factures set
       statut = coalesce($1, statut),
       paye_le = case when $1 = 'payee' then current_date when $1 = 'emise' then null else paye_le end,
       signee_le = case when $2::boolean is null then signee_le when $2 then coalesce(signee_le, now()) else null end,
       maj_le = now()
     where id = $3`,
    [v.statut ?? null, v.signee ?? null, req.params.id],
  );
  const [facture] = await charger("where f.id = $1", [req.params.id]);
  logAction(
    req.session.nom,
    "modification",
    "facture",
    `${existante.numero} — ${v.statut ?? (v.signee ? "signée" : "signature retirée")}`,
    req.params.id,
  );
  res.json(facture);
});

// ── Facture électronique (message TEIF) ───────────────────────────────────────────────────────────────────────
// Étape 1 : génération, contrôle et téléchargement du XML non signé. Ni signature ni dépôt chez TTN (voir docs/facturation-electronique.md).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Facture, cabinet et client sous la forme attendue par server/teif. */
async function contexteEinvoice(id) {
  const [facture] = await charger("where f.id = $1", [id]);
  if (!facture) return null;
  const soc = (
    await query("select raison_sociale, tva, adresse, adresse_rue, ville, code_postal, pays from societes where id = $1", [facture.societeId])
  ).rows[0];
  const meta = (await query("select * from app_meta where id = 1")).rows[0] ?? {};
  return {
    facture,
    cabinet: {
      nom: meta.cabinet_nom ?? "",
      matriculeFiscal: meta.cabinet_mf ?? "",
      adresse: meta.cabinet_adresse ?? "",
      rue: meta.cabinet_rue ?? "",
      ville: meta.cabinet_ville ?? "",
      codePostal: meta.cabinet_code_postal ?? "",
      pays: meta.cabinet_pays || "TN",
      rc: meta.cabinet_rc ?? "",
      rib: meta.cabinet_rib ?? "",
    },
    client: {
      nom: soc?.raison_sociale ?? "",
      matriculeFiscal: soc?.tva ?? "",
      adresse: soc?.adresse ?? "",
      rue: soc?.adresse_rue ?? "",
      ville: soc?.ville ?? "",
      codePostal: soc?.code_postal ?? "",
      pays: soc?.pays || "TN",
    },
  };
}

async function resumeEinvoice(id) {
  const ei = (
    await query(
      `select statut, teif_version, teif_sha256, genere_le, signe_le, teif_signe_sha256, depose_le, ttn_message, ttn_ref, ttn_ref_date, ttn_qr_png, ttn_acquittements, ttn_derniere_erreur
         from facture_einvoice where facture_id = $1`,
      [id],
    )
  ).rows[0];
  return ei
    ? {
        statut: ei.statut,
        version: ei.teif_version,
        sha256: ei.teif_sha256,
        genereLe: ei.genere_le?.toISOString?.() ?? null,
        signeLe: ei.signe_le?.toISOString?.() ?? null,
        shaSigne: ei.teif_signe_sha256 ?? null,
        deposeLe: ei.depose_le?.toISOString?.() ?? null,
        messageTtn: ei.ttn_message ?? null,
        refTtn: ei.ttn_ref ?? null,
        refTtnDate: ei.ttn_ref_date?.toISOString?.() ?? null,
        qrPng: ei.statut === "validee" ? (ei.ttn_qr_png ?? null) : null,
        acquittements: ei.ttn_acquittements ?? [],
        erreurTtn: ei.ttn_derniere_erreur ?? null,
      }
    : null;
}

facturationRouter.use("/:id/einvoice", (req, res, next) =>
  UUID.test(req.params.id) ? next() : res.status(400).json({ error: "Identifiant de facture invalide" }),
);

// Liste de conformité, sans rien enregistrer.
facturationRouter.get("/:id/einvoice", async (req, res) => {
  const ctx = await contexteEinvoice(req.params.id);
  if (!ctx) return res.status(404).json({ error: "Facture introuvable" });
  const problemes = controlerFactureTeif(ctx);
  res.json({ einvoice: await resumeEinvoice(req.params.id), version: TEIF_VERSION, problemes, pret: !aDesBloquants(problemes) });
});

async function preparer(req, res, regenerer) {
  const ctx = await contexteEinvoice(req.params.id);
  if (!ctx) return res.status(404).json({ error: "Facture introuvable" });
  let teif;
  try {
    teif = genererTeif(ctx);
  } catch (e) {
    if (e instanceof ErreurTeif)
      return res.status(422).json({ error: "La facture n'est pas conforme au format de la facture électronique.", problemes: e.problemes });
    throw e;
  }
  const erreurs = JSON.stringify(teif.avertissements);
  const { rowCount } = regenerer
    ? await query(
        `update facture_einvoice set teif_version = $2, teif_xml = $3, teif_sha256 = $4, erreurs = $5::jsonb, genere_le = now(), maj_le = now()
          where facture_id = $1 and statut = 'prete'`,
        [req.params.id, teif.version, teif.xml, teif.sha256, erreurs],
      )
    : await query(
        `insert into facture_einvoice (facture_id, statut, teif_version, teif_xml, teif_sha256, erreurs)
         values ($1, 'prete', $2, $3, $4, $5::jsonb) on conflict (facture_id) do nothing`,
        [req.params.id, teif.version, teif.xml, teif.sha256, erreurs],
      );
  if (!rowCount)
    return res.status(409).json({
      error: regenerer
        ? "Cette facture électronique n'est plus au stade « prête » : elle ne peut pas être régénérée."
        : "Cette facture électronique est déjà préparée : utilisez « Régénérer » pour la refaire.",
    });
  logAction(
    req.session.nom,
    regenerer ? "modification" : "creation",
    "facture",
    `${ctx.facture.numero} — facture électronique ${regenerer ? "régénérée" : "préparée"} (TEIF ${teif.version})`,
    req.params.id,
  );
  res
    .status(regenerer ? 200 : 201)
    .json({ einvoice: await resumeEinvoice(req.params.id), version: TEIF_VERSION, problemes: teif.avertissements, pret: true });
}

facturationRouter.post("/:id/einvoice/preparer", (req, res) => preparer(req, res, false));
facturationRouter.post("/:id/einvoice/regenerer", (req, res) => preparer(req, res, true));

// Téléchargement du XML ; le nom du fichier est le numéro de facture (règle du dépôt TTN : « <numéro>.xml »).
// Par défaut : le message SIGNÉ s'il existe, sinon le message préparé. `?version=non-signe` force le message sans signature, `?version=signe` exige le signé.
facturationRouter.get("/:id/einvoice/xml", async (req, res) => {
  const ligne = (
    await query(
      `select e.teif_xml, e.teif_signe_xml, e.ttn_xml, f.numero, f.statut
         from facture_einvoice e join factures f on f.id = e.facture_id where e.facture_id = $1`,
      [req.params.id],
    )
  ).rows[0];
  if (!ligne) return res.status(404).json({ error: "Aucune facture électronique préparée pour cette facture" });
  if (ligne.statut === "annulee") return res.status(409).json({ error: "Cette facture est annulée" });
  const version = req.query.version;
  if (version !== undefined && version !== "signe" && version !== "non-signe" && version !== "ttn") return res.status(400).json({ error: "Version inconnue" });
  if (version === "ttn" && !ligne.ttn_xml) return res.status(404).json({ error: "TTN n'a pas encore renvoyé le message validé" });
  if (version === "signe" && !ligne.teif_signe_xml) return res.status(404).json({ error: "Cette facture électronique n'est pas encore signée" });
  const signe = version !== "non-signe" && Boolean(ligne.teif_signe_xml);
  const nom = String(ligne.numero).replace(/[^A-Za-z0-9._-]/g, "_");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nom}${version === "non-signe" && ligne.teif_signe_xml ? "-non-signe" : ""}.xml"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(version === "ttn" ? ligne.ttn_xml : signe ? ligne.teif_signe_xml : ligne.teif_xml);
});

// Historique d'une facture : le journal d'activité filtré sur elle (création, modification, signature, dépôt, validation, rejet…).
facturationRouter.get("/:id/journal", async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: "Identifiant de facture invalide" });
  const { rows } = await query("select id, at, actor, action, label from journal where entity = 'facture' and entity_id = $1 order by at desc limit 100", [req.params.id]);
  res.json(rows.map((r) => ({ id: r.id, at: r.at instanceof Date ? r.at.toISOString() : r.at, actor: r.actor, action: r.action, label: r.label })));
});

// ── Dépôt chez TTN ───────────────────────────────────────────────────────────────────────────────────────────────
const repondreErreur = (res, e, journal) => {
  if (e instanceof ErreurTtn || e instanceof ErreurSignature) return res.status(e.statut ?? 502).json({ error: e.message, code: e.code });
  console.error(journal, e?.name, e?.message);
  return res.status(500).json({ error: "Erreur interne lors de l'opération TTN" });
};

// Dépôt de la facture SIGNÉE : les octets envoyés sont exactement ceux du fichier signé enregistré. Garde anti-doublon : on interroge
// TTN d'abord, et on ne redépose jamais un numéro qu'il connaît déjà. Une coupure réseau laisse la facture « signée » (rien n'est perdu).
facturationRouter.post("/:id/einvoice/deposer", async (req, res) => {
  try {
    const ctx = await contexteEinvoice(req.params.id);
    if (!ctx) return res.status(404).json({ error: "Facture introuvable" });
    if (ctx.facture.statut === "annulee") return res.status(409).json({ error: "Cette facture est annulée" });
    const ei = (await query("select statut, teif_signe_xml from facture_einvoice where facture_id = $1", [req.params.id])).rows[0];
    if (!ei) return res.status(409).json({ error: "Préparez et signez d'abord la facture électronique.", code: "NON_PREPAREE" });
    if (ei.statut === "prete") return res.status(409).json({ error: "Signez d'abord la facture électronique.", code: "NON_SIGNEE" });
    if (ei.statut === "rejetee") return res.status(409).json({ error: "TTN a rejeté cette facture : rouvrez-la pour la corriger.", code: "REJETEE" });
    if (ei.statut !== "signee") return res.status(409).json({ error: "Cette facture électronique est déjà déposée.", code: "DEJA_DEPOSEE" });
    const config = await lireConnexion();
    if (!config) return res.status(409).json({ error: "Enregistrez d'abord les accès TTN (bouton « TTN »).", code: "SANS_CONNEXION" });
    const options = { autoriserLocal: autoriserLocal() };
    const numero = ctx.facture.numero;

    let deja;
    let rejeteeAvant = false;
    try {
      const connue = (await consulterFacture(config, numero, options)).find((r) => r.documentNumber === numero || !r.documentNumber);
      // Un numéro que TTN a REJETÉ (acquittements, aucune référence) peut être redéposé après correction ; sinon on ne redépose jamais.
      rejeteeAvant = Boolean(connue) && !connue.generatedRef && !lireRefTtn(connue.xml) && connue.acquittements.length > 0;
      deja = rejeteeAvant ? undefined : connue;
    } catch (e) {
      await query("update facture_einvoice set ttn_derniere_erreur = $2 where facture_id = $1 and statut = 'signee'", [req.params.id, String(e.message).slice(0, 500)]);
      return repondreErreur(res, e, "[ttn] consultation avant dépôt");
    }
    let message = "";
    if (deja) {
      message = "Facture déjà connue de TTN : elle n'a pas été déposée une seconde fois.";
    } else {
      try {
        message = await deposerFacture(config, ei.teif_signe_xml, options);
      } catch (e) {
        await query("update facture_einvoice set ttn_derniere_erreur = $2 where facture_id = $1 and statut = 'signee'", [req.params.id, String(e.message).slice(0, 500)]);
        return repondreErreur(res, e, "[ttn] dépôt");
      }
    }
    const { rowCount } = await query(
      `update facture_einvoice set statut = 'deposee', depose_le = now(), ttn_message = $2, ttn_derniere_erreur = null, maj_le = now()
        where facture_id = $1 and statut = 'signee'`,
      [req.params.id, message],
    );
    if (!rowCount) return res.status(409).json({ error: "La facture électronique a changé pendant le dépôt : actualisez.", code: "CONFLIT" });
    logAction(req.session.nom, "modification", "facture", `${numero} — facture électronique déposée chez TTN (environnement ${config.environnement})`, req.params.id);
    // Vérification immédiate (TTN valide souvent en quelques secondes) ; un échec ici n'annule pas le dépôt.
    // (Sauf après un rejet antérieur : les anciens acquittements risqueraient d'être relus avant le nouveau traitement.)
    if (!rejeteeAvant) await actualiserFacture(req.params.id, config, options, req.session.nom).catch(() => undefined);
    res.json({ einvoice: await resumeEinvoice(req.params.id), version: TEIF_VERSION, problemes: [], pret: true });
  } catch (e) {
    repondreErreur(res, e, "[ttn] déposer");
  }
});

// Actualisation d'une facture déposée : interroge TTN et met à jour l'état (validée avec référence et QR, ou rejetée avec acquittements).
facturationRouter.post("/:id/einvoice/actualiser", async (req, res) => {
  try {
    const ei = (await query("select statut from facture_einvoice where facture_id = $1", [req.params.id])).rows[0];
    if (!ei) return res.status(404).json({ error: "Aucune facture électronique pour cette facture" });
    if (ei.statut === "deposee") {
      const config = await lireConnexion();
      if (!config) return res.status(409).json({ error: "Enregistrez d'abord les accès TTN (bouton « TTN »).", code: "SANS_CONNEXION" });
      try {
        await actualiserFacture(req.params.id, config, { autoriserLocal: autoriserLocal() }, req.session.nom);
      } catch (e) {
        await query("update facture_einvoice set ttn_derniere_erreur = $2, ttn_verifie_le = now() where facture_id = $1 and statut = 'deposee'", [req.params.id, String(e.message).slice(0, 500)]);
        return repondreErreur(res, e, "[ttn] actualiser");
      }
    }
    res.json({ einvoice: await resumeEinvoice(req.params.id), version: TEIF_VERSION, problemes: [], pret: true });
  } catch (e) {
    repondreErreur(res, e, "[ttn] actualiser");
  }
});

// Réouverture d'une facture REJETÉE : retour à « prête » (signature et dépôt effacés) pour corriger, régénérer, signer et redéposer.
facturationRouter.post("/:id/einvoice/rouvrir", async (req, res) => {
  const ligne = (await query("select e.statut, f.numero, e.ttn_acquittements from facture_einvoice e join factures f on f.id = e.facture_id where e.facture_id = $1", [req.params.id])).rows[0];
  if (!ligne) return res.status(404).json({ error: "Aucune facture électronique pour cette facture" });
  if (ligne.statut !== "rejetee") return res.status(409).json({ error: "Seule une facture rejetée par TTN peut être rouverte.", code: "NON_REJETEE" });
  await query(
    `update facture_einvoice set statut = 'prete', teif_signe_xml = null, teif_signe_sha256 = null, signe_le = null, signe_empreinte_certificat = null,
            depose_le = null, ttn_message = null, ttn_ref = null, ttn_ref_date = null, ttn_qr_png = null, ttn_xml = null,
            ttn_acquittements = null, ttn_derniere_erreur = null, ttn_verifie_le = null, maj_le = now()
      where facture_id = $1 and statut = 'rejetee'`,
    [req.params.id],
  );
  const motifs = (ligne.ttn_acquittements ?? []).map((a) => Object.values(a).join(" ")).join(" | ").slice(0, 300);
  logAction(req.session.nom, "modification", "facture", `${ligne.numero} — facture électronique rouverte après rejet TTN${motifs ? ` (${motifs})` : ""}`, req.params.id);
  res.json({ einvoice: await resumeEinvoice(req.params.id), version: TEIF_VERSION, problemes: [], pret: true });
});

// Signature XAdES du message préparé (certificat du cabinet, déverrouillé auparavant par son mot de passe). Voir server/signature.
facturationRouter.post("/:id/einvoice/signer", async (req, res) => {
  try {
    const ctx = await contexteEinvoice(req.params.id);
    if (!ctx) return res.status(404).json({ error: "Facture introuvable" });
    if (ctx.facture.statut === "annulee") return res.status(409).json({ error: "Cette facture est annulée" });
    const ei = (await query("select statut, teif_xml from facture_einvoice where facture_id = $1", [req.params.id])).rows[0];
    if (!ei) return res.status(409).json({ error: "Préparez d'abord la facture électronique.", code: "NON_PREPAREE" });
    if (ei.statut !== "prete") return res.status(409).json({ error: "Cette facture électronique est déjà signée.", code: "DEJA_SIGNEE" });
    const materiel = materielDeverrouille();
    if (!materiel)
      return res.status(409).json({ error: "La signature est verrouillée : saisissez le mot de passe du certificat pour la déverrouiller.", code: "SIGNATURE_VERROUILLEE" });

    let racine;
    try {
      ({ racine } = construireTeif(ctx));
    } catch (e) {
      if (e instanceof ErreurTeif)
        return res.status(422).json({ error: "La facture n'est pas conforme au format de la facture électronique.", problemes: e.problemes });
      throw e;
    }
    const xml = texteTeif(racine);
    // On ne signe que le fichier préparé : si les données ont changé depuis, il faut le régénérer (et le relire) avant de le signer.
    if (xml !== ei.teif_xml)
      return res.status(409).json({
        error: "Les informations de la facture, du cabinet ou du client ont changé depuis la préparation : régénérez le fichier avant de le signer.",
        code: "A_REGENERER",
      });

    const signe = signerTeif({ racine, xml, materiel, maintenant: new Date() });
    const { rowCount } = await query(
      `update facture_einvoice
          set statut = 'signee', teif_signe_xml = $2, teif_signe_sha256 = $3, signe_le = $4, signe_empreinte_certificat = $5, maj_le = now()
        where facture_id = $1 and statut = 'prete' and teif_xml = $6`,
      [req.params.id, signe.xmlSigne, signe.sha256, signe.signeLe, signe.empreinteCertificat, ei.teif_xml],
    );
    if (!rowCount) return res.status(409).json({ error: "La facture électronique a changé pendant la signature : réessayez.", code: "CONFLIT" });
    logAction(req.session.nom, "modification", "facture", `${ctx.facture.numero} — facture électronique signée (certificat ${signe.empreinteCertificat.slice(0, 16)}…)`, req.params.id);
    res.json({ einvoice: await resumeEinvoice(req.params.id), version: TEIF_VERSION, problemes: [], pret: true });
  } catch (e) {
    if (e instanceof ErreurSignature) return res.status(e.statut).json({ error: e.message, code: e.code });
    console.error("[signature] signer", e?.name, e?.message);
    res.status(500).json({ error: "Erreur interne lors de la signature de la facture électronique" });
  }
});
