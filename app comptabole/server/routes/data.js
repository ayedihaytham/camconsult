import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin, canSeeSociete } from "../auth.js";
import { logAction } from "../journal.js";
import {
  societeDto,
  employeDto,
  noeudDto,
  messageDto,
  conversationDto,
  tacheDto,
  notificationDto,
} from "../mappers.js";
import { notifKey } from "../notifications.js";
import { tachesVisibles } from "./taches.js";

export const dataRouter = Router();
dataRouter.use(requireAuth);

/** Toutes les données visibles par la session, en un appel. */
dataRouter.get("/bootstrap", async (req, res) => {
  const s = req.session;

  const societes = (await query("select * from societes order by raison_sociale")).rows
    .filter((r) => canSeeSociete(s, r.id))
    .map(societeDto);

  const noeuds = (await query("select * from noeuds order by maj_le desc")).rows
    .filter((r) => canSeeSociete(s, r.societe_id))
    .map(noeudDto);

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
    messages = (await query("select * from messages order by envoye_le")).rows.map(messageDto);
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
    // confie une tâche) — sans jamais leur mot de passe.
    const collegues =
      s.poste === "societe_employe"
        ? (
            await query(
              "select * from employes where role = 'societe_employe' and statut = 'actif' and societe_id = any($1::uuid[]) and id <> $2",
              [s.societeIds ?? [], s.employeId],
            )
          ).rows.map((r) => ({ ...employeDto(r), motDePasse: "" }))
        : [];
    employes = [...[...own, ...perimetre].map(employeDto), ...collegues];
    const convIds = [
      `conv-${s.employeId}`,
      ...perimetre.map((e) => `conv-${e.id}`),
      ...groupIds,
    ];
    messages = (
      await query(
        "select * from messages where conversation_id = any($1) order by envoye_le",
        [convIds],
      )
    ).rows.map(messageDto);
    taches = (await tachesVisibles(s)).map(tacheDto);
  }

  const notifications = (
    await query(
      "select * from notifications where user_key = $1 order by cree_le desc limit 50",
      [notifKey(s)],
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

dataRouter.post("/restore", requireAuth, requireAdmin, async (req, res) => {
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
        `insert into societes (id, raison_sociale, rne, tva, theme, code, identifiant, mot_de_passe, statut, telephone, email, adresse, cree_le)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, coalesce($13::date, current_date))`,
        [
          uuidOrNull(s.id), s.raisonSociale, s.rne ?? "", s.tva ?? "", s.theme ?? "PME",
          s.code ?? "", s.identifiant ?? "", s.motDePasse ?? "", s.statut ?? "actif",
          s.telephone ?? "", s.email ?? "", s.adresse ?? "", s.creeLe ?? null,
        ],
      );
    }
    for (const e of employes) {
      await client.query(
        `insert into employes (id, nom, prenom, identifiant, mot_de_passe, type, role, societe_id, email, statut, societes_assignees, permissions, cree_le)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb, coalesce($13::date, current_date))`,
        [
          uuidOrNull(e.id), e.nom, e.prenom, e.identifiant, e.motDePasse, e.type ?? "Assistant",
          e.role === "societe_employe" ? "societe_employe" : "collaborateur",
          uuidOrNull(e.societeId),
          e.email ?? "", e.statut ?? "actif",
          JSON.stringify(e.societesAssignees ?? []), JSON.stringify(e.permissions ?? {}),
          e.creeLe ?? null,
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
      await client.query(
        `insert into taches (id, titre, description, societe_id, assigne_id, statut, cree_par, cree_le, maj_le, termine_le)
         values ($1,$2,$3,$4,$5,$6,$7, coalesce($8::timestamptz, now()), coalesce($9::timestamptz, now()), $10::timestamptz)`,
        [
          uuidOrNull(t.id), t.titre, t.description ?? "", uuidOrNull(t.societeId),
          uuidOrNull(t.assigneId),
          ["a_faire", "en_cours", "termine"].includes(t.statut) ? t.statut : "a_faire",
          t.creePar ?? "", t.creeLe ?? null, t.majLe ?? null, t.termineLe ?? null,
        ],
      );
    }
  });

  logAction(req.session.nom, "import", "donnees", "Restauration d'une sauvegarde");
  res.json({ ok: true });
});

dataRouter.post("/reset", requireAuth, requireAdmin, async (req, res) => {
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
