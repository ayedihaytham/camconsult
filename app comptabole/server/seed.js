import "dotenv/config";
import { ensureSchema } from "./ensureSchema.js";
import { pool, query, withTransaction } from "./db.js";

const DEMO_PASSWORD = "Demo1234!";

function seedUuid(prefix, index) {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

// Deterministic IDs are deliberately grouped so cleanup can target only seed-owned rows.
const SEED_COMPANY_IDS = Array.from({ length: 15 }, (_, index) => seedUuid("10000000", index + 1));
const SEED_EMPLOYEE_IDS = Array.from({ length: 6 }, (_, index) => seedUuid("20000000", index + 1));
const SEED_FOLDER_IDS = Array.from({ length: 19 }, (_, index) => seedUuid("30000000", index + 1));
const SEED_FILE_IDS = Array.from({ length: 19 }, (_, index) => seedUuid("40000000", index + 1));
const SEED_CONVERSATION_IDS = Array.from({ length: 5 }, (_, index) => seedUuid("50000000", index + 1));
const SEED_MESSAGE_IDS = Array.from({ length: 32 }, (_, index) => seedUuid("60000000", index + 1));
const SEED_TASK_IDS = Array.from({ length: 24 }, (_, index) => seedUuid("70000000", index + 1));
const SEED_NOTIFICATION_IDS = Array.from({ length: 8 }, (_, index) => seedUuid("80000000", index + 1));

function dayOffset(daysAgo) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function timeOffset(hoursAgo) {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
}

function assertSeedEnvironment() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[seed] Refusé : le seed ne peut jamais s'exécuter en production.");
  }
  if (process.env.NODE_ENV !== "development" || process.env.ALLOW_DB_SEED !== "true") {
    throw new Error(
      "[seed] Refusé : définissez NODE_ENV=development et ALLOW_DB_SEED=true pour utiliser le seed local.",
    );
  }
}

const companySpecs = [
  ["Atlas Conseil SARL", "PME", "actif", 0],
  ["Medina Textile", "Grande entreprise", "actif", 1],
  ["Carthage Digital", "PME", "actif", 3],
  ["Olive & Co", "Auto-entrepreneur", "en_attente", 5],
  ["Association El Wafa", "Association", "actif", 8],
  ["Cabinet Dr Ben Salem", "Profession libérale", "actif", 12],
  ["Sahara Export", "Grande entreprise", "actif", 18],
  ["Nour Distribution", "PME", "inactif", 26],
  ["Blue Lagoon Services", "PME", "actif", 37],
  ["Kairouan Artisanat", "Association", "actif", 52],
  ["Sfax Mécanique", "Grande entreprise", "actif", 74],
  ["Yasmine Architecture", "Profession libérale", "actif", 96],
  ["Djerba Évasion", "PME", "en_attente", 121],
  ["Tunis Food Lab", "Auto-entrepreneur", "actif", 148],
  ["Zitouna Immobilier", "PME", "actif", 181],
];

const employeeSpecs = [
  ["Ben Amor", "Haytham", "Comptable"],
  ["Trabelsi", "Sana", "Gestionnaire de paie"],
  ["Gharbi", "Youssef", "Comptable"],
  ["Mansouri", "Lina", "Assistant"],
  ["Kallel", "Rim", "Assistant"],
  ["Chaabane", "Walid", "Stagiaire"],
];

const fileLabels = [
  "Balance générale août 2026.xlsx", "Déclaration TVA T3.pdf", "Factures fournisseurs septembre.pdf",
  "Relevé bancaire BNA.pdf", "Journal des ventes.xlsx", "Contrat de prestation.pdf",
  "État de rapprochement bancaire.xlsx", "Registre des immobilisations.xlsx", "Décompte CNSS.pdf",
  "Situation mensuelle août.pdf", "Lettrage clients.xlsx", "Bordereau de remise.pdf",
  "Prévisionnel de trésorerie.xlsx", "Factures export août.pdf", "Rapport de gestion.pdf",
  "Liste du personnel.xlsx", "Attestation fiscale.pdf", "Grand livre auxiliaire.xlsx", "Pièces justificatives.zip",
];

const taskTitles = [
  "Contrôler la déclaration TVA", "Préparer le rapprochement bancaire", "Relancer les pièces manquantes",
  "Réviser les comptes fournisseurs", "Mettre à jour le dossier permanent", "Préparer les états financiers",
  "Vérifier les écritures de paie", "Classer les justificatifs du mois", "Analyser les écarts de trésorerie",
  "Préparer la déclaration CNSS", "Contrôler les factures d'export", "Mettre à jour le tableau des immobilisations",
  "Valider le grand livre auxiliaire", "Répondre aux questions du client", "Préparer le bordereau bancaire",
  "Réviser le chiffre d'affaires", "Mettre à jour les provisions", "Contrôler les règlements clients",
  "Préparer la clôture mensuelle", "Vérifier les notes de frais", "Analyser les comptes d'attente",
  "Archiver les pièces validées", "Préparer le reporting de direction", "Finaliser le dossier de révision",
];

function companies() {
  return companySpecs.map(([raisonSociale, theme, statut, daysAgo], index) => ({
    id: SEED_COMPANY_IDS[index],
    raisonSociale,
    theme,
    statut,
    code: `DEV-${String(index + 1).padStart(3, "0")}`,
    creeLe: dayOffset(daysAgo),
  }));
}

function employees() {
  return employeeSpecs.map(([nom, prenom, type], index) => ({
    id: SEED_EMPLOYEE_IDS[index],
    nom,
    prenom,
    type,
    identifiant: `${prenom.toLowerCase()}.${nom.toLowerCase().replaceAll(" ", "-")}.demo`,
    email: `${prenom.toLowerCase()}.${nom.toLowerCase().replaceAll(" ", "-")}@camconsult.test`,
    creeLe: dayOffset([0, 2, 6, 15, 44, 98][index]),
    societesAssignees: [SEED_COMPANY_IDS[index], SEED_COMPANY_IDS[(index + 5) % SEED_COMPANY_IDS.length]],
  }));
}

function folders() {
  const roots = SEED_COMPANY_IDS.map((societeId, index) => ({
    id: SEED_FOLDER_IDS[index],
    libelle: `Dossier ${companySpecs[index][0]}`,
    societeId,
    parentId: null,
    majLe: dayOffset(index + 1),
  }));
  const children = [0, 1, 3, 6].map((companyIndex, index) => ({
    id: SEED_FOLDER_IDS[index + 15],
    libelle: ["Comptabilité 2026", "Pièces fiscales", "Paie", "Export"][index],
    societeId: SEED_COMPANY_IDS[companyIndex],
    parentId: SEED_FOLDER_IDS[companyIndex],
    majLe: dayOffset(index + 1),
  }));
  return [...roots, ...children];
}

function files() {
  return fileLabels.map((libelle, index) => {
    const companyIndex = index % SEED_COMPANY_IDS.length;
    const childFolderIndex = [0, 1, 3, 6].indexOf(companyIndex);
    return {
      id: SEED_FILE_IDS[index],
      libelle,
      societeId: SEED_COMPANY_IDS[companyIndex],
      parentId: childFolderIndex >= 0 ? SEED_FOLDER_IDS[15 + childFolderIndex] : SEED_FOLDER_IDS[companyIndex],
      format: libelle.split(".").pop(),
      taille: `${(0.4 + ((index * 17) % 45) / 10).toFixed(1)} Mo`,
      majLe: dayOffset([0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 8, 9, 11, 14, 17, 23, 31, 42, 68][index]),
    };
  });
}

function groupConversations() {
  return [
    ["Revue TVA septembre", [0, 1, 2]],
    ["Clôture Atlas Conseil", [0, 3, 4]],
    ["Suivi dossiers export", [1, 2, 5]],
    ["Organisation du cabinet", [0, 1, 2, 3, 4, 5]],
    ["Préparation reporting", [2, 3, 4]],
  ].map(([titre, members], index) => ({
    id: SEED_CONVERSATION_IDS[index],
    titre,
    membreIds: members.map((member) => SEED_EMPLOYEE_IDS[member]),
    creeLe: timeOffset(72 - index * 9),
  }));
}

function messages() {
  const text = [
    "La balance d'août est disponible.", "Je vérifie les pièces avant midi.", "La TVA est prête pour validation.",
    "Merci, je regarde le rapprochement bancaire.", "Le client a envoyé les justificatifs manquants.", "Parfait, je les classe dans le dossier.",
    "Peut-on planifier la revue demain matin ?", "Oui, je prépare les points à traiter.", "Les écritures de paie sont contrôlées.",
    "Il reste deux factures à rapprocher.", "Le reporting est presque finalisé.", "Je vous envoie la version relue cet après-midi.",
    "La CNSS a été déposée.", "Merci pour le suivi.", "Le dossier export demande une dernière vérification.",
    "Je m'en occupe avant la clôture.", "Les pièces sont désormais complètes.", "Très bien, on peut avancer sur la révision.",
    "Le client souhaite un point de situation.", "Je lui réponds avec les éléments validés.", "La réunion cabinet est confirmée à 15 h.",
    "Bien reçu, je serai présente.", "Le bordereau bancaire est prêt.", "Je contrôle les références avant envoi.",
    "Les comptes d'attente ont été analysés.", "Il faut documenter deux écarts.", "Le grand livre auxiliaire est à jour.",
    "Merci, je passe à la validation finale.", "Le prévisionnel de trésorerie est partagé.", "Je note les hypothèses à revoir.",
    "Le dossier de révision est finalisé.", "Excellent travail, merci à tous.",
  ];
  return text.map((contenu, index) => {
    const isGroup = index < 15;
    const employeeIndex = index % SEED_EMPLOYEE_IDS.length;
    return {
      id: SEED_MESSAGE_IDS[index],
      conversationId: isGroup
        ? SEED_CONVERSATION_IDS[index % SEED_CONVERSATION_IDS.length]
        : `conv-${SEED_EMPLOYEE_IDS[employeeIndex]}`,
      auteurId: index % 3 === 0 ? "me" : SEED_EMPLOYEE_IDS[employeeIndex],
      contenu,
      envoyeLe: timeOffset(2 + index * 3),
      statut: index % 4 === 0 ? "envoye" : "lu",
    };
  });
}

function tasks() {
  const statuses = ["a_faire", "en_cours", "termine"];
  return taskTitles.map((titre, index) => {
    const statut = statuses[index % statuses.length];
    const createdDaysAgo = [0, 1, 2, 3, 5, 7, 9, 12, 16, 21, 28, 34, 41, 49, 56, 68, 76, 88, 101, 116, 132, 149, 173, 205][index];
    return {
      id: SEED_TASK_IDS[index],
      titre,
      description: `Suivi de dossier : ${companySpecs[index % companySpecs.length][0]}.`,
      societeId: SEED_COMPANY_IDS[index % SEED_COMPANY_IDS.length],
      assigneId: SEED_EMPLOYEE_IDS[index % SEED_EMPLOYEE_IDS.length],
      statut,
      creeLe: timeOffset(createdDaysAgo * 24),
      majLe: timeOffset(Math.max(1, createdDaysAgo * 12)),
      termineLe: statut === "termine" ? timeOffset(Math.max(1, createdDaysAgo * 10)) : null,
    };
  });
}

function notifications() {
  return [
    ["admin", "tache_assignee", "Tâches à suivre", "Trois tâches sont en attente de validation.", "/taches", false],
    ["admin", "document", "Nouveaux documents", "Des pièces ont été ajoutées à Atlas Conseil.", "/structuration", false],
    [SEED_EMPLOYEE_IDS[0], "tache_assignee", "Nouvelle tâche assignée", "Préparer le rapprochement bancaire.", "/taches", false],
    [SEED_EMPLOYEE_IDS[1], "message", "Nouveau message", "Une réponse est arrivée dans Suivi dossiers export.", "/messagerie", false],
    [SEED_EMPLOYEE_IDS[2], "document", "Document disponible", "La balance générale a été ajoutée.", "/structuration", true],
    ["admin", "societe", "Société mise à jour", "Le dossier Atlas Conseil a été complété.", "/societes", true],
    [SEED_EMPLOYEE_IDS[3], "tache_modifiee", "Tâche terminée", "Les écritures de paie sont contrôlées.", "/taches", true],
    ["admin", "message", "Point client", "Une demande client nécessite votre attention.", "/messagerie", false],
  ].map(([userKey, type, titre, corps, lien, lu], index) => ({
    id: SEED_NOTIFICATION_IDS[index], userKey, type, titre, corps, lien, lu, creeLe: timeOffset(1 + index * 4),
  }));
}

async function existingAdminPresent() {
  const table = await query("select to_regclass('public.app_meta') as name");
  if (!table.rows[0]?.name) return false;
  const meta = await query("select id from app_meta where id = 1");
  return meta.rows.length > 0;
}

async function cleanup(client) {
  await client.query("delete from notifications where id = any($1::uuid[])", [SEED_NOTIFICATION_IDS]);
  await client.query("delete from messages where id = any($1::uuid[])", [SEED_MESSAGE_IDS]);
  await client.query("delete from conversations where id = any($1::uuid[])", [SEED_CONVERSATION_IDS]);
  await client.query("delete from taches where id = any($1::uuid[])", [SEED_TASK_IDS]);
  await client.query("delete from noeuds where id = any($1::uuid[])", [SEED_FILE_IDS]);
  await client.query("delete from noeuds where id = any($1::uuid[])", [SEED_FOLDER_IDS]);
  await client.query("delete from employes where id = any($1::uuid[])", [SEED_EMPLOYEE_IDS]);
  await client.query("delete from societes where id = any($1::uuid[])", [SEED_COMPANY_IDS]);
}

async function insertSeed(client) {
  const seededCompanies = companies();
  const seededEmployees = employees();
  const seededFolders = folders();
  const seededFiles = files();
  const seededConversations = groupConversations();
  const seededMessages = messages();
  const seededTasks = tasks();
  const seededNotifications = notifications();

  for (const company of seededCompanies) {
    await client.query(
      `insert into societes (id, raison_sociale, rne, tva, theme, code, statut, telephone, email, adresse, cree_le)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [company.id, company.raisonSociale, `RNE-${company.code}`, `TN${company.code.replace("DEV-", "")}`, company.theme, company.code, company.statut, "+216 70 000 000", `contact@${company.code.toLowerCase()}.test`, "Tunis, Tunisie", company.creeLe],
    );
  }

  for (const employee of seededEmployees) {
    // The current employee login compares mot_de_passe directly; this development-only value mirrors that existing behavior.
    await client.query(
      `insert into employes (id, nom, prenom, identifiant, mot_de_passe, type, role, email, statut, societes_assignees, permissions, cree_le)
       values ($1,$2,$3,$4,$5,$6,'collaborateur',$7,'actif',$8::jsonb,$9::jsonb,$10)`,
      [employee.id, employee.nom, employee.prenom, employee.identifiant, DEMO_PASSWORD, employee.type, employee.email, JSON.stringify(employee.societesAssignees), JSON.stringify({ consulterDossiers: true, deposerFichiers: true, modifierSocietes: employee.type === "Comptable", supprimer: false, messagerie: true }), employee.creeLe],
    );
  }

  for (const folder of seededFolders) {
    await client.query(
      `insert into noeuds (id, libelle, description, type, societe_id, parent_id, maj_le, cree_le)
       values ($1,$2,$3,'dossier',$4,$5,$6,$7)`,
      [folder.id, folder.libelle, "Structure de démonstration", folder.societeId, folder.parentId, folder.majLe, folder.majLe],
    );
  }
  for (const file of seededFiles) {
    await client.query(
      `insert into noeuds (id, libelle, description, type, societe_id, parent_id, format, taille, maj_le, cree_le)
       values ($1,$2,$3,'fichier',$4,$5,$6,$7,$8,$9)`,
      [file.id, file.libelle, "Document de démonstration", file.societeId, file.parentId, file.format, file.taille, file.majLe, file.majLe],
    );
  }
  for (const conversation of seededConversations) {
    await client.query(
      "insert into conversations (id, type, titre, membre_ids, cree_le) values ($1,'groupe',$2,$3::jsonb,$4)",
      [conversation.id, conversation.titre, JSON.stringify(conversation.membreIds), conversation.creeLe],
    );
  }
  for (const message of seededMessages) {
    await client.query(
      "insert into messages (id, conversation_id, auteur_id, contenu, envoye_le, statut) values ($1,$2,$3,$4,$5,$6)",
      [message.id, message.conversationId, message.auteurId, message.contenu, message.envoyeLe, message.statut],
    );
  }
  for (const task of seededTasks) {
    await client.query(
      `insert into taches (id, titre, description, societe_id, assigne_id, statut, cree_par, cree_le, maj_le, termine_le)
       values ($1,$2,$3,$4,$5,$6,'admin',$7,$8,$9)`,
      [task.id, task.titre, task.description, task.societeId, task.assigneId, task.statut, task.creeLe, task.majLe, task.termineLe],
    );
  }
  for (const notification of seededNotifications) {
    await client.query(
      `insert into notifications (id, user_key, type, titre, corps, lien, lu, cree_le)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [notification.id, notification.userKey, notification.type, notification.titre, notification.corps, notification.lien, notification.lu, notification.creeLe],
    );
  }
}

async function seedCounts() {
  const count = async (table, ids) => Number((await query(`select count(*)::int as count from ${table} where id = any($1::uuid[])`, [ids])).rows[0].count);
  return {
    companies: await count("societes", SEED_COMPANY_IDS),
    employees: await count("employes", SEED_EMPLOYEE_IDS),
    nodes: await count("noeuds", [...SEED_FOLDER_IDS, ...SEED_FILE_IDS]),
    tasks: await count("taches", SEED_TASK_IDS),
    conversations: await count("conversations", SEED_CONVERSATION_IDS),
    messages: await count("messages", SEED_MESSAGE_IDS),
    notifications: await count("notifications", SEED_NOTIFICATION_IDS),
  };
}

async function verifyIntegrity() {
  const checks = [
    "select count(*)::int as count from noeuds n left join noeuds p on p.id = n.parent_id where n.id = any($1::uuid[]) and n.parent_id is not null and p.id is null",
    "select count(*)::int as count from taches t left join societes s on s.id = t.societe_id where t.id = any($1::uuid[]) and s.id is null",
    "select count(*)::int as count from taches t left join employes e on e.id = t.assigne_id where t.id = any($1::uuid[]) and t.assigne_id is not null and e.id is null",
  ];
  const ids = [[...SEED_FOLDER_IDS, ...SEED_FILE_IDS], SEED_TASK_IDS, SEED_TASK_IDS];
  for (let index = 0; index < checks.length; index += 1) {
    const result = await query(checks[index], [ids[index]]);
    if (Number(result.rows[0].count) !== 0) throw new Error("[seed] Vérification d'intégrité relationnelle échouée.");
  }
}

async function main() {
  assertSeedEnvironment();
  const adminAlreadyExisted = await existingAdminPresent();
  await ensureSchema();
  await withTransaction(async (client) => {
    await cleanup(client);
    await insertSeed(client);
  });
  await verifyIntegrity();
  const counts = await seedCounts();

  console.log("\nCamConsult development seed completed.\n");
  console.log(`Companies: ${counts.companies}`);
  console.log(`Employees: ${counts.employees}`);
  console.log(`Nodes: ${counts.nodes}`);
  console.log(`Tasks: ${counts.tasks}`);
  console.log(`Conversations: ${counts.conversations}`);
  console.log(`Messages: ${counts.messages}`);
  console.log(`Notifications: ${counts.notifications}`);
  console.log("\nSeed can safely be run again.");
  if (!adminAlreadyExisted) {
    console.log("\nA development administrator was created by schema initialization. Use the local ADMIN_* values from .env.");
  }
  console.log("\nDevelopment employee accounts (all use Demo1234!):");
  for (const employee of employees()) console.log(`- ${employee.identifiant}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
