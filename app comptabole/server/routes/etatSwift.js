import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, canSeeSociete } from "../auth.js";
import { logAction } from "../journal.js";
import { notifyMany, concernedBySociete, notifKey } from "../notifications.js";
import { safeRouter } from "../asyncRoutes.js";

/** État SWIFT : un virement SWIFT sorti de la banque en dinars dont le détail en devise manque.
 * Le cabinet pose la date, le montant, le libellé et la banque ; le responsable ou le délégué de la société
 * justifie ce montant par ses factures d'achat (n° de facture, montant en devise, taux de change, montant en TND),
 * une à une, jusqu'à atteindre le montant demandé.
 * Écriture des virements : le cabinet (admin, responsable des collaborateurs, collaborateurs de la société).
 * Factures : le cabinet et la société concernée, une fois le virement envoyé à la société. */
export const etatSwiftRouter = safeRouter(Router());
etatSwiftRouter.use(requireAuth);

const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const estClient = (s) => s.poste === "societe_employe";
const ownSociete = (s, societeId) => (s.societeIds || []).includes(societeId);
const peutEcrireVirements = (s, societeId) => !estClient(s) && canSeeSociete(s, societeId);
const peutVoir = (s, societeId) => (estClient(s) ? ownSociete(s, societeId) : canSeeSociete(s, societeId));

function jour(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Statut d'un virement d'après le total de ses factures : à justifier, en cours, justifié, ou écart (dépassement). */
export function statutSwift(montant, justifie, nbFactures) {
  if (nbFactures === 0) return "a_justifier";
  const reste = r3(montant - justifie);
  if (Math.abs(reste) < 0.0005) return "justifie";
  return reste < 0 ? "ecart" : "en_cours";
}

const factureDto = (r) => ({
  id: r.id,
  numFacture: r.num_facture,
  montantDevise: Number(r.montant_devise),
  devise: r.devise,
  taux: Number(r.taux),
  montantTnd: Number(r.montant_tnd),
  pieceNom: r.piece_nom || "",
  creePar: r.cree_par || "",
});

function virementDto(r, factures) {
  const montant = Number(r.montant);
  const justifie = r3(factures.reduce((s, f) => s + Number(f.montant_tnd), 0));
  return {
    id: r.id,
    societeId: r.societe_id,
    date: jour(r.date_operation),
    montant,
    libelle: r.libelle,
    banque: r.banque,
    envoye: Boolean(r.envoye),
    justifie,
    reste: r3(montant - justifie),
    statut: statutSwift(montant, justifie, factures.length),
    factures: factures.map(factureDto),
  };
}

async function charger(societeId, session) {
  const virements = (
    await query(
      `select * from swift_virements where societe_id = $1 ${estClient(session) ? "and envoye" : ""} order by date_operation desc nulls last, cree_le desc`,
      [societeId],
    )
  ).rows;
  const factures = virements.length
    ? (
        await query(
          "select id, virement_id, num_facture, montant_devise, devise, taux, montant_tnd, piece_nom, cree_par from swift_factures where virement_id = any($1::uuid[]) order by ordre, cree_le",
          [virements.map((v) => v.id)],
        )
      ).rows
    : [];
  return virements.map((v) => virementDto(v, factures.filter((f) => f.virement_id === v.id)));
}

etatSwiftRouter.get("/", async (req, res) => {
  const societeId = String(req.query.societeId || "");
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!peutVoir(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  res.json(await charger(societeId, req.session));
});

const virementSchema = z.object({
  societeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  montant: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  libelle: z.string().trim().min(1, "Libellé requis").max(300),
  banque: z.string().trim().min(1, "Banque requise").max(120),
  envoyer: z.boolean().default(false),
});

async function societeNom(societeId) {
  return (await query("select raison_sociale from societes where id = $1", [societeId])).rows[0]?.raison_sociale ?? "";
}

async function prevenirSociete(societeId, titre, corps) {
  const clients = (
    await query("select id from employes where role = 'societe_employe' and societe_id = $1 and statut = 'actif'", [societeId])
  ).rows.map((r) => r.id);
  notifyMany(clients, "swift", titre, corps, `/etat-swift/${societeId}`);
}

const fmt = (n) => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

etatSwiftRouter.post("/", async (req, res) => {
  const parsed = virementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!peutEcrireVirements(req.session, v.societeId)) return res.status(403).json({ error: "Création non autorisée" });
  const { rows } = await query(
    `insert into swift_virements (societe_id, date_operation, montant, libelle, banque, envoye, cree_par)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [v.societeId, v.date, r3(v.montant), v.libelle, v.banque, v.envoyer, req.session.nom],
  );
  logAction(req.session.nom, "creation", "etat_swift", `${v.libelle} — ${fmt(v.montant)} TND`, rows[0].id);
  if (v.envoyer) await prevenirSociete(v.societeId, `État SWIFT : ${fmt(v.montant)} TND à justifier`, `${v.libelle} · ${v.banque}`);
  res.status(201).json(virementDto(rows[0], []));
});

etatSwiftRouter.patch("/:id", async (req, res) => {
  const existant = (await query("select * from swift_virements where id = $1", [req.params.id])).rows[0];
  if (!existant) return res.status(404).json({ error: "Virement introuvable" });
  if (!peutEcrireVirements(req.session, existant.societe_id)) return res.status(403).json({ error: "Modification non autorisée" });
  const parsed = virementSchema.omit({ societeId: true }).partial().safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rows } = await query(
    `update swift_virements set date_operation = $2, montant = $3, libelle = $4, banque = $5, envoye = $6, maj_le = now() where id = $1 returning *`,
    [
      existant.id,
      v.date ?? jour(existant.date_operation),
      v.montant !== undefined ? r3(v.montant) : existant.montant,
      v.libelle ?? existant.libelle,
      v.banque ?? existant.banque,
      existant.envoye || v.envoyer === true,
    ],
  );
  logAction(req.session.nom, "modification", "etat_swift", `${rows[0].libelle} — ${fmt(rows[0].montant)} TND`, existant.id);
  if (!existant.envoye && rows[0].envoye)
    await prevenirSociete(existant.societe_id, `État SWIFT : ${fmt(rows[0].montant)} TND à justifier`, `${rows[0].libelle} · ${rows[0].banque}`);
  const factures = (await query("select * from swift_factures where virement_id = $1 order by ordre, cree_le", [existant.id])).rows;
  res.json(virementDto(rows[0], factures));
});

etatSwiftRouter.delete("/:id", async (req, res) => {
  const existant = (await query("select * from swift_virements where id = $1", [req.params.id])).rows[0];
  if (!existant) return res.status(404).json({ error: "Virement introuvable" });
  if (!peutEcrireVirements(req.session, existant.societe_id)) return res.status(403).json({ error: "Suppression non autorisée" });
  await query("delete from swift_virements where id = $1", [existant.id]);
  logAction(req.session.nom, "suppression", "etat_swift", `${existant.libelle} — ${fmt(existant.montant)} TND`, existant.id);
  res.json({ ok: true });
});

const factureSchema = z.object({
  id: z.string().uuid().optional(),
  numFacture: z.string().trim().min(1, "N° de facture requis").max(120),
  montantDevise: z.coerce.number().min(0),
  devise: z.string().trim().min(1, "Devise requise").max(8).transform((d) => d.toUpperCase()),
  taux: z.coerce.number().min(0),
  montantTnd: z.coerce.number().min(0),
  pieceNom: z.string().max(300).optional(),
  pieceDataUrl: z.string().max(12_000_000).optional(),
});

/** Remplace la liste des factures d'un virement (la société les ajoute une à une, le cabinet peut les corriger). */
etatSwiftRouter.put("/:id/factures", async (req, res) => {
  const existant = (await query("select * from swift_virements where id = $1", [req.params.id])).rows[0];
  if (!existant) return res.status(404).json({ error: "Virement introuvable" });
  if (!peutVoir(req.session, existant.societe_id) || (estClient(req.session) && !existant.envoye))
    return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = z.object({ factures: z.array(factureSchema).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  await withTransaction(async (client) => {
    const anciennes = (await client.query("select * from swift_factures where virement_id = $1", [existant.id])).rows;
    const gardees = new Set(parsed.data.factures.map((f) => f.id).filter(Boolean));
    await client.query("delete from swift_factures where virement_id = $1 and not (id = any($2::uuid[]))", [existant.id, [...gardees]]);
    let ordre = 0;
    for (const f of parsed.data.factures) {
      const ancienne = f.id ? anciennes.find((a) => a.id === f.id) : null;
      const pieceNom = f.pieceDataUrl ? f.pieceNom || "Pièce" : ancienne?.piece_nom ?? "";
      if (ancienne) {
        await client.query(
          `update swift_factures set num_facture=$2, montant_devise=$3, devise=$4, taux=$5, montant_tnd=$6, ordre=$7,
             piece_nom=$8, piece_data_url = coalesce($9, piece_data_url) where id = $1`,
          [ancienne.id, f.numFacture, r3(f.montantDevise), f.devise, f.taux, r3(f.montantTnd), ordre, pieceNom, f.pieceDataUrl ?? null],
        );
      } else {
        await client.query(
          `insert into swift_factures (virement_id, num_facture, montant_devise, devise, taux, montant_tnd, ordre, piece_nom, piece_data_url, cree_par)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [existant.id, f.numFacture, r3(f.montantDevise), f.devise, f.taux, r3(f.montantTnd), ordre, pieceNom, f.pieceDataUrl ?? null, req.session.nom],
        );
      }
      ordre++;
    }
  });

  const factures = (await query("select * from swift_factures where virement_id = $1 order by ordre, cree_le", [existant.id])).rows;
  const dto = virementDto(existant, factures);
  logAction(req.session.nom, "modification", "etat_swift", `Factures de « ${existant.libelle} » : ${fmt(dto.justifie)} / ${fmt(dto.montant)} TND`, existant.id);

  if (estClient(req.session)) {
    const nom = await societeNom(existant.societe_id);
    const clientsIds = new Set(
      (await query("select id from employes where role = 'societe_employe' and societe_id = $1", [existant.societe_id])).rows.map((r) => r.id),
    );
    const cabinet = (await concernedBySociete(existant.societe_id, { includeAdmin: true })).filter((k) => k !== notifKey(req.session) && !clientsIds.has(k));
    const titre = dto.statut === "justifie" ? `État SWIFT justifié : ${nom}` : `État SWIFT : factures reçues de ${nom}`;
    notifyMany(cabinet, "swift", titre, `${existant.libelle} · ${fmt(dto.justifie)} / ${fmt(dto.montant)} TND`, `/etat-swift/${existant.societe_id}`);
  }
  res.json(dto);
});

/** Pièce jointe d'une facture (téléchargée à la demande : elle n'est pas dans les listes). */
etatSwiftRouter.get("/factures/:id/piece", async (req, res) => {
  const f = (
    await query(
      `select f.piece_nom, f.piece_data_url, v.societe_id, v.envoye from swift_factures f join swift_virements v on v.id = f.virement_id where f.id = $1`,
      [req.params.id],
    )
  ).rows[0];
  if (!f || !f.piece_data_url) return res.status(404).json({ error: "Pièce introuvable" });
  if (!peutVoir(req.session, f.societe_id) || (estClient(req.session) && !f.envoye)) return res.status(403).json({ error: "Accès non autorisé" });
  res.json({ nom: f.piece_nom, dataUrl: f.piece_data_url });
});
