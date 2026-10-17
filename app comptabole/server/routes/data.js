import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin, canSeeSociete, porteeSocietes } from "../auth.js";
import { logAction } from "../journal.js";
import {
  societeDto,
  employeDto,
  employeDtoFor,
  noeudDto,
  noeudDtoLeger,
  NOEUD_COLONNES_LEGERES,
  messageDto,
  messageDtoLeger,
  MESSAGE_COLONNES_LEGERES,
  conversationDto,
  tacheDto,
  notificationDto,
} from "../mappers.js";
import { notifKey } from "../notifications.js";
import { hashPassword } from "../passwords.js";
import { tachesVisibles } from "./taches.js";
import { taskPlanningError } from "../../shared/taskPlanning.js";

export const dataRouter = Router();
dataRouter.use(requireAuth);

/** Toutes les données visibles par la session, en un appel. */
dataRouter.get("/bootstrap", async (req, res) => {
  const s = req.session;

  const portee = porteeSocietes(s);
  const societes = (await query("select * from societes where ($1::uuid[] is null or id = any($1::uuid[])) order by raison_sociale", [portee])).rows
    .filter((r) => canSeeSociete(s, r.id))
    .map(societeDto);

  // Sans le contenu des fichiers : récupéré à la demande (GET /noeuds/:id/contenu).
  const noeuds = (await query(`select ${NOEUD_COLONNES_LEGERES} from noeuds where ($1::uuid[] is null or societe_id is null or societe_id = any($1::uuid[])) order by maj_le desc`, [portee])).rows
    .filter((r) => canSeeSociete(s, r.societe_id))
    .map(noeudDtoLeger);

  const allGroups = (
    await query("select * from conversations where type = 'groupe' order by cree_le desc")
  ).rows;
  const groupConversations = (
    s.role === "admin"
      ? allGroups
      : allGroups.filter((g) =>
          (Array.isArray(g.membre_ids) ? g.membre_ids : []).includes(s.employeId),
        )
  ).map(conversationDto);
  const groupIds = groupConversations.map((g) => g.id);

  let employes;
  let messages;
  let taches;
  if (s.role === "admin") {
    employes = (await query("select * from employes order by nom, prenom")).rows.map(employeDto);
    messages = (await query(`select ${MESSAGE_COLONNES_LEGERES} from messages order by envoye_le`)).rows.map(messageDtoLeger);
    taches = (await query("select * from taches order by cree_le desc")).rows.map(tacheDto);
  } else {
    // Collaborateur : sa fiche + les employés des sociétés de son périmètre (pour la messagerie).
    // Employé de société : seulement sa fiche.
    const perimetre =
      s.poste === "societe_employe"
        ? []
        : (
            await query(
              "select * from employes where role = 'societe_employe' and statut = 'actif' and societe_id = any($1::uuid[])",
              [s.societeIds ?? []],
            )
          ).rows;
    const own = (await query("select * from employes where id = $1", [s.employeId])).rows;
    // Employé de société : aussi les autres comptes de SA société (le
    // responsable doit pouvoir choisir un délégué, le délégué voir qui lui
    // confie une tâche).
    const collegues =
      s.poste === "societe_employe"
        ? (
            await query(
              "select * from employes where role = 'societe_employe' and statut = 'actif' and societe_id = any($1::uuid[]) and id <> $2",
              [s.societeIds ?? [], s.employeId],
            )
          ).rows
        : [];
    // Responsable des collaborateurs : toute l'équipe du cabinet (actifs ou
    // non), sinon sa page Collaborateurs n'a personne à gérer.
    const equipe =
      s.poste === "responsable_collaborateurs"
        ? (
            await query(
              "select * from employes where role <> 'societe_employe' and id <> $1 order by nom, prenom",
              [s.employeId],
            )
          ).rows
        : [];
    // Jamais de mot de passe hors admin (voir employeDtoFor).
    employes = [...own, ...equipe, ...perimetre, ...collegues].map(employeDtoFor(s));
    const convIds = [
      `conv-${s.employeId}`,
      ...perimetre.map((e) => `conv-${e.id}`),
      ...groupIds,
    ];
    messages = (
      await query(
        `select ${MESSAGE_COLONNES_LEGERES} from messages where conversation_id = any($1) order by envoye_le`,
        [convIds],
      )
    ).rows.map(messageDtoLeger);
    taches = (await tachesVisibles(s)).map(tacheDto);
  }

  const notifications = (
    await query(
      "select * from notifications where user_key = $1 and (type <> 'apurement' or ($2::boolean and ($3::text[] is null or split_part(lien,'/',3)=any($3)))) order by cree_le desc limit 50",
      [notifKey(s),s.role==='admin'||['collaborateur','responsable_collaborateurs'].includes(s.poste),porteeSocietes(s)],
    )
  ).rows.map(notificationDto);

  res.json({
    societes,
    employes,
    noeuds,
    messages,
    groupConversations,
    taches,
    notifications,
  });
});

dataRouter.get("/backup", requireAdmin, async (_req, res) => {
  const [societes, employes, noeuds, messages, conversations, taches] =
    await Promise.all([
      query("select * from societes"),
      query("select * from employes"),
      query("select * from noeuds"),
      query("select * from messages"),
      query("select * from conversations"),
      query("select * from taches"),
    ]);
  res.json({
    _app: "cabinet-comptable",
    _exportedAt: new Date().toISOString(),
    societes: societes.rows.map(societeDto),
    employes: employes.rows.map(employeDto),
    noeuds: noeuds.rows.map(noeudDto),
    messages: messages.rows.map(messageDto),
    conversations: conversations.rows.map(conversationDto),
    taches: taches.rows.map(tacheDto),
  });
});

/** Tables que la restauration efface sans que la sauvegarde JSON les contienne (elle ne couvre que sociétés, employés, dossiers,
 * messages, conversations et tâches) : tout ce qui s'y trouve serait perdu. */
const HORS_SAUVEGARDE = [
  ["collectes", "collecte(s)"],
  ["stock_mouvements", "mouvement(s) de stock"],
  ["balances", "balance(s)"],
  ["bordereaux", "bordereau(x)"],
  ["immo_biens", "immobilisation(s)"],
  ["factures", "facture(s)"],
  ["honoraires_lignes", "ligne(s) d'honoraires"],
  ["fournisseur_reglements", "règlement(s) fournisseur"],
  ["comptes_bancaires", "compte(s) bancaire(s)"],
  ["swift_virements", "virement(s) SWIFT"],
  ["souche_cheques", "chèque(s) de souche"],
  ["suivi_devise", "suivi(s) en devise"],
];

dataRouter.post("/restore", requireAuth, requireAdmin, async (req, res) => {
  // Remplace les données : même protection que la réinitialisation (désactivée en production sans ALLOW_DATA_RESET, confirmation
  // exigée par le serveur) et refus si des données absentes de la sauvegarde seraient détruites en cascade.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DATA_RESET !== "true")
    return res.status(403).json({ error: "La restauration est désactivée sur ce serveur (ALLOW_DATA_RESET)." });
  if (req.body?.confirmation !== "RESTAURER")
    return res.status(400).json({ error: "Confirmation requise pour restaurer une sauvegarde" });
  if (req.body?.confirmationDefinitive !== "SUPPRIMER DEFINITIVEMENT") {
    const comptes = (
      await query(HORS_SAUVEGARDE.map(([t]) => `select '${t}' t, count(*)::int n from ${t}`).join(" union all "))
    ).rows.filter((r) => r.n > 0);
    if (comptes.length > 0) {
      const detail = comptes.map((r) => `${r.n} ${HORS_SAUVEGARDE.find(([t]) => t === r.t)[1]}`).join(", ");
      return res.status(409).json({
        error: `Restauration refusée : elle détruirait des données absentes de la sauvegarde (${detail}). Cette sauvegarde ne contient que les sociétés, employés, dossiers, messages et tâches.`,
      });
    }
  }
  const p = req.body ?? {};
  const societes = Array.isArray(p.societes) ? p.societes : [];
  const employes = Array.isArray(p.employes) ? p.employes : [];
  const noeuds = Array.isArray(p.noeuds) ? p.noeuds : [];
  const messages = Array.isArray(p.messages) ? p.messages : [];
  const conversations = Array.isArray(p.conversations) ? p.conversations : [];
  const taches = Array.isArray(p.taches) ? p.taches : [];

  const allIds = [
    ...societes.map((s) => s.id),
    ...employes.map((e) => e.id),
    ...noeuds.map((n) => n.id),
    ...conversations.map((g) => g.id),
    ...taches.map((t) => t.id),
  ];
  if (allIds.some((id) => uuidOrNull(id) === null)) {
    return res.status(400).json({
      error:
        "Sauvegarde incompatible : identifiants non valides. Utilisez une sauvegarde exportée depuis cette application.",
    });
  }

  await withTransaction(async (client) => {
    await client.query(
      "truncate balance_lignes, balances, immo_mouvements, financement_mouvements, tdrf_lignes, tdrf_parametres, notes_exercice, fiche_societe, notes_modele, immo_biens, immo_categories, grille_comptes, grille_affectat_codes, stock_mouvements, bordereau_lignes, bordereaux, collecte_lignes, collecte_sections, collectes, notifications, taches, messages, noeuds, employes, societes, conversations restart identity cascade",
    );

    for (const g of conversations) {
      await client.query(
        `insert into conversations (id, type, titre, membre_ids, cree_le)
         values ($1, coalesce($2,'groupe'), $3, $4::jsonb, coalesce($5::timestamptz, now()))`,
        [
          uuidOrNull(g.id),
          g.type ?? "groupe",
          g.titre ?? "",
          JSON.stringify(g.membreIds ?? []),
          g.creeLe ?? null,
        ],
      );
    }

    for (const s of societes) {
      await client.query(
        `insert into societes (id, raison_sociale, rne, tva, theme, code, statut, telephone, email, adresse, cree_le)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, coalesce($11::date, current_date))`,
        [
          uuidOrNull(s.id), s.raisonSociale, s.rne ?? "", s.tva ?? "", s.theme ?? "PME",
          s.code ?? "", s.statut ?? "actif",
          s.telephone ?? "", s.email ?? "", s.adresse ?? "", s.creeLe ?? null,
        ],
      );
    }
    for (const e of employes) {
      await client.query(
        `insert into employes (id, nom, prenom, identifiant, mot_de_passe, mdp_hash, type, role, societe_id, email, statut, societes_assignees, permissions, cree_le, delegue, doit_changer_mdp)
         values ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb, coalesce($13::date, current_date), $14, $15)`,
        [
          // Une ancienne sauvegarde peut contenir un mot de passe en clair : il est converti en empreinte, jamais réécrit tel quel.
          uuidOrNull(e.id), e.nom, e.prenom, e.identifiant, e.motDePasse ? await hashPassword(e.motDePasse) : null, e.type ?? "Assistant",
          ["societe_employe", "responsable_collaborateurs"].includes(e.role)
            ? e.role
            : "collaborateur",
          uuidOrNull(e.societeId),
          e.email ?? "", e.statut ?? "actif",
          JSON.stringify(e.societesAssignees ?? []), JSON.stringify(e.permissions ?? {}),
          e.creeLe ?? null,
          e.role === "societe_employe" && Boolean(e.delegue),
          Boolean(e.doitChangerMotDePasse),
        ],
      );
    }
    // Noeuds : insérer sans parent d'abord, puis mettre à jour les parents (FK)
    for (const n of noeuds) {
      await client.query(
        `insert into noeuds (id, libelle, description, type, societe_id, parent_id, format, taille, data_url, maj_le)
         values ($1,$2,$3,$4,$5,null,$6,$7,$8, coalesce($9::date, current_date))`,
        [
          uuidOrNull(n.id), n.libelle, n.description ?? "", n.type ?? "dossier",
          uuidOrNull(n.societeId), n.format ?? null, n.taille ?? null,
          n.dataUrl ?? null, n.majLe ?? null,
        ],
      );
    }
    for (const n of noeuds) {
      if (n.parentId) {
        await client.query("update noeuds set parent_id = $1 where id = $2", [
          n.parentId, n.id,
        ]);
      }
    }
    for (const m of messages) {
      await client.query(
        `insert into messages (id, conversation_id, auteur_id, contenu, envoye_le, statut, piece_jointe)
         values ($1,$2,$3,$4, coalesce($5::timestamptz, now()), $6, $7::jsonb)`,
        [
          uuidOrNull(m.id), m.conversationId, m.auteurId, m.contenu ?? "",
          m.envoyeLe ?? null, m.statut ?? "envoye",
          m.pieceJointe ? JSON.stringify(m.pieceJointe) : null,
        ],
      );
    }
    for (const t of taches) {
      const planningError = taskPlanningError(t.debutPrevu, t.finPrevue);
      if (planningError) throw new Error(planningError);
      await client.query(
        `insert into taches (id, titre, description, societe_id, assigne_id, statut, cree_par, cree_le, maj_le, termine_le, origine, module, debut_prevu, fin_prevue)
         values ($1,$2,$3,$4,$5,$6,$7, coalesce($8::timestamptz, now()), coalesce($9::timestamptz, now()), $10::timestamptz, $11, $12, $13::date, $14::date)`,
        [
          uuidOrNull(t.id), t.titre, t.description ?? "", uuidOrNull(t.societeId),
          uuidOrNull(t.assigneId),
          ["a_faire", "en_cours", "termine"].includes(t.statut) ? t.statut : "a_faire",
          t.creePar ?? "", t.creeLe ?? null, t.majLe ?? null, t.termineLe ?? null,
          t.origine === "societe" ? "societe" : "cabinet",
          ["collectes", "structuration", "messagerie"].includes(t.module) ? t.module : null,
          t.debutPrevu || null, t.finPrevue || null,
        ],
      );
    }
  });

  logAction(req.session.nom, "import", "donnees", "Restauration d'une sauvegarde");
  res.json({ ok: true });
});

dataRouter.post("/reset", requireAuth, requireAdmin, async (req, res) => {
  // Action destructrice : en production elle est désactivée tant que ALLOW_DATA_RESET=true n'est pas posé volontairement sur le serveur.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DATA_RESET !== "true")
    return res.status(403).json({ error: "La réinitialisation est désactivée sur ce serveur (ALLOW_DATA_RESET)." });
  // Le serveur exige lui-même la confirmation, pas seulement l'écran.
  if (req.body?.confirmation !== "RÉINITIALISER")
    return res.status(400).json({ error: "Confirmation requise pour réinitialiser les données" });
  await query(
    "truncate balance_lignes, balances, immo_mouvements, financement_mouvements, tdrf_lignes, tdrf_parametres, notes_exercice, fiche_societe, notes_modele, immo_biens, immo_categories, grille_comptes, grille_affectat_codes, stock_mouvements, bordereau_lignes, bordereaux, collecte_lignes, collecte_sections, collectes, notifications, taches, messages, noeuds, employes, societes, conversations restart identity cascade",
  );
  logAction(req.session.nom, "reinitialisation", "donnees", "Toutes les données");
  res.json({ ok: true });
});

function uuidOrNull(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v ?? ""),
  )
    ? v
    : null;
}
