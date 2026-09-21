import type { JournalEntry } from "@/store/journal";
import type {
  AppNotification,
  Bordereau,
  Collecte,
  CollecteStatut,
  Conversation,
  Employe,
  Noeud,
  Societe,
  Tache,
  TacheStatut,
} from "@/types";

export type DashboardRole = "admin" | "collaborateur" | "societe_employe";
export type DashboardTone = "neutral" | "primary" | "warning" | "destructive" | "success";

export interface DashboardKpi {
  id: "clients" | "collectes" | "tasks" | "messages" | "deadline" | "documents";
  label: string;
  value: number | string;
  supportingText: string;
  tone?: DashboardTone;
}

export type AttentionGroup = "urgent" | "review" | "communication" | "other";

export interface DashboardAttentionItem {
  id: string;
  type: "collecte" | "message" | "notification" | "societe" | "bordereau";
  group: AttentionGroup;
  severity: "critical" | "warning" | "review" | "information";
  title: string;
  description: string;
  date: string;
  route: string;
  badge: string;
}

export type DeadlineBucket = "overdue" | "today" | "week" | "later";

export interface DashboardDeadline {
  id: string;
  societeName: string;
  periode: string;
  echeance: string;
  daysFromToday: number;
  bucket: DeadlineBucket;
  badge: string;
  route: string;
}

export interface DashboardTeamMember {
  id: string;
  name: string;
  initials: string;
  active: boolean;
  online: boolean;
  aFaire: number;
  enCours: number;
  done: number;
  open: number;
  total: number;
}

export interface DashboardFileActivity {
  id: string;
  name: string;
  format?: string;
  societeName: string;
  updatedAt: string;
}

export interface DashboardMessageActivity {
  id: string;
  label: string;
  initials: string;
  preview: string;
  updatedAt: string;
  unread: number;
  online: boolean;
}

export interface DashboardCollectionCounts {
  brouillon: number;
  transmis: number;
  a_corriger: number;
  valide: number;
}

export interface DashboardCollectionActivity {
  id: string;
  periode: string;
  statut: CollecteStatut;
  echeance: string | null;
  updatedAt: string;
  route: string;
}

export interface DashboardTaskCounts {
  a_faire: number;
  en_cours: number;
  termine: number;
}

export interface DashboardViewModel {
  role: DashboardRole;
  kpis: DashboardKpi[];
  attentionItems: DashboardAttentionItem[];
  deadlines: DashboardDeadline[];
  taskCounts: DashboardTaskCounts;
  collectionCounts: DashboardCollectionCounts;
  team: DashboardTeamMember[];
  recentFiles: DashboardFileActivity[];
  recentMessages: DashboardMessageActivity[];
  collections: DashboardCollectionActivity[];
  journalEntries: JournalEntry[];
  currentCollection: Collecte | null;
  nextDeadline: DashboardDeadline | null;
  unpointedBordereaux: number;
  unpointedAmount: number;
}

export interface DashboardDataInput {
  role: DashboardRole;
  viewerEmployeId: string | null;
  canUseMessaging: boolean;
  now: Date;
  societes: Societe[];
  collaborateurs: Employe[];
  noeuds: Noeud[];
  taches: Tache[];
  conversations: Conversation[];
  notifications: AppNotification[];
  collectes: Collecte[];
  bordereaux: Bordereau[];
  journalEntries: JournalEntry[];
  adminName: string;
}

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(date: string, now: Date): number {
  return Math.round((startOfDay(parseDateOnly(date)).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

function isCurrentMonth(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

export function isOpenTask(task: Pick<Tache, "statut">): boolean {
  return task.statut === "a_faire" || task.statut === "en_cours";
}

export function isClosedCollection(collecte: Pick<Collecte, "statut">): boolean {
  return collecte.statut === "valide" || collecte.statut === "archive";
}

export function isOverdueCollection(
  collecte: Pick<Collecte, "statut" | "echeance">,
  now: Date,
): boolean {
  return Boolean(
    collecte.echeance && !isClosedCollection(collecte) && daysBetween(collecte.echeance, now) < 0,
  );
}

export function isActionableCollection(
  collecte: Pick<Collecte, "statut" | "echeance">,
  now: Date,
): boolean {
  return (
    collecte.statut === "transmis" ||
    collecte.statut === "a_corriger" ||
    isOverdueCollection(collecte, now)
  );
}

export function getDeadlineBucket(echeance: string, now: Date): DeadlineBucket {
  const days = daysBetween(echeance, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

function deadlineBadge(days: number): string {
  if (days < 0) return `En retard de ${plural(Math.abs(days), "jour")}`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

function initials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function taskCounts(taches: Tache[]): DashboardTaskCounts {
  return {
    a_faire: taches.filter((task) => task.statut === "a_faire").length,
    en_cours: taches.filter((task) => task.statut === "en_cours").length,
    termine: taches.filter((task) => task.statut === "termine").length,
  };
}

function collectionCounts(collectes: Collecte[]): DashboardCollectionCounts {
  return {
    brouillon: collectes.filter((item) => item.statut === "brouillon").length,
    transmis: collectes.filter((item) => item.statut === "transmis").length,
    a_corriger: collectes.filter((item) => item.statut === "a_corriger").length,
    valide: collectes.filter((item) => item.statut === "valide").length,
  };
}

function buildDeadlines(
  collectes: Collecte[],
  societyNames: Map<string, string>,
  now: Date,
): DashboardDeadline[] {
  return collectes
    .filter((collecte) => collecte.echeance && !isClosedCollection(collecte))
    .map((collecte) => {
      const daysFromToday = daysBetween(collecte.echeance!, now);
      return {
        id: collecte.id,
        societeName: societyNames.get(collecte.societeId) ?? "Société",
        periode: collecte.periode,
        echeance: collecte.echeance!,
        daysFromToday,
        bucket: getDeadlineBucket(collecte.echeance!, now),
        badge: deadlineBadge(daysFromToday),
        route: `/collectes/${collecte.id}`,
      };
    })
    .sort((left, right) => left.daysFromToday - right.daysFromToday || left.societeName.localeCompare(right.societeName));
}

function buildAttentionItems(
  input: DashboardDataInput,
  societyNames: Map<string, string>,
): DashboardAttentionItem[] {
  const collectionItems = input.collectes.flatMap<DashboardAttentionItem>((collecte) => {
    const title = societyNames.get(collecte.societeId) ?? "Société";
    if (isOverdueCollection(collecte, input.now)) {
      const days = Math.abs(daysBetween(collecte.echeance!, input.now));
      return [{
        id: `collecte-overdue-${collecte.id}`,
        type: "collecte",
        group: "urgent",
        severity: "critical",
        title,
        description: `${collecte.periode} · échéance dépassée de ${plural(days, "jour")}`,
        date: collecte.echeance!,
        route: `/collectes/${collecte.id}`,
        badge: "En retard",
      }];
    }
    if (collecte.statut === "a_corriger") {
      return [{
        id: `collecte-correction-${collecte.id}`,
        type: "collecte",
        group: "urgent",
        severity: "warning",
        title,
        description: `${collecte.periode} · des éléments doivent être corrigés`,
        date: collecte.majLe,
        route: `/collectes/${collecte.id}`,
        badge: "Correction",
      }];
    }
    if (collecte.statut === "transmis") {
      return [{
        id: `collecte-review-${collecte.id}`,
        type: "collecte",
        group: "review",
        severity: "review",
        title,
        description: `${collecte.periode} · collecte transmise au cabinet`,
        date: collecte.transmisLe ?? collecte.majLe,
        route: `/collectes/${collecte.id}`,
        badge: "À vérifier",
      }];
    }
    return [];
  });

  const messageItems = input.canUseMessaging
    ? input.conversations
        .filter((conversation) => conversation.nonLus > 0)
        .map<DashboardAttentionItem>((conversation) => ({
          id: `message-${conversation.id}`,
          type: "message",
          group: "communication",
          severity: "information",
          title: conversation.type === "groupe"
            ? conversation.titre ?? "Conversation de groupe"
            : input.adminName,
          description: conversation.dernierMessage || "Nouveau message",
          date: conversation.dernierMessageLe,
          route: "/messagerie",
          badge: `${conversation.nonLus} non lu${conversation.nonLus > 1 ? "s" : ""}`,
        }))
    : [];

  const notificationItems = input.notifications
    .filter((notification) => !notification.lu && !["message", "collecte"].includes(notification.type))
    .map<DashboardAttentionItem>((notification) => ({
      id: `notification-${notification.id}`,
      type: "notification",
      group: "other",
      severity: "information",
      title: notification.titre,
      description: notification.corps,
      date: notification.creeLe,
      route: notification.lien || "/",
      badge: "À consulter",
    }));

  const pendingSocieties = input.role === "societe_employe"
    ? []
    : input.societes
        .filter((societe) => societe.statut === "en_attente")
        .map<DashboardAttentionItem>((societe) => ({
          id: `societe-${societe.id}`,
          type: "societe",
          group: "review",
          severity: "review",
          title: societe.raisonSociale,
          description: "Société en attente de traitement",
          date: societe.creeLe,
          route: "/societes",
          badge: "En attente",
        }));

  const unpointed = input.role === "admin"
    ? input.bordereaux.filter((bordereau) => !bordereau.pointe)
    : [];
  const bordereauItems: DashboardAttentionItem[] = unpointed.length > 0
    ? [{
        id: "bordereaux-unpointed",
        type: "bordereau",
        group: "other",
        severity: "information",
        title: "Bordereaux à pointer",
        description: `${plural(unpointed.length, "bordereau")} non pointé${unpointed.length > 1 ? "s" : ""}`,
        date: unpointed.map((item) => item.majLe).sort()[0] ?? input.now.toISOString(),
        route: "/bordereaux",
        badge: "À pointer",
      }]
    : [];

  const groupOrder: Record<AttentionGroup, number> = {
    urgent: 0,
    review: 1,
    communication: 2,
    other: 3,
  };

  return [...collectionItems, ...messageItems, ...notificationItems, ...pendingSocieties, ...bordereauItems]
    .sort((left, right) => groupOrder[left.group] - groupOrder[right.group] || left.date.localeCompare(right.date));
}

export function buildDashboardData(input: DashboardDataInput): DashboardViewModel {
  const societyNames = new Map(input.societes.map((societe) => [societe.id, societe.raisonSociale]));
  const deadlines = buildDeadlines(input.collectes, societyNames, input.now);
  const tasks = taskCounts(input.taches);
  const collections = collectionCounts(input.collectes.filter((item) => item.statut !== "archive"));
  const openTasks = tasks.a_faire + tasks.en_cours;
  const actionableCollections = input.collectes.filter((item) => isActionableCollection(item, input.now));
  const overdueCollections = input.collectes.filter((item) => isOverdueCollection(item, input.now));
  const unreadMessages = input.canUseMessaging
    ? input.conversations.reduce((total, conversation) => total + conversation.nonLus, 0)
    : 0;
  const unreadThreads = input.canUseMessaging
    ? input.conversations.filter((conversation) => conversation.nonLus > 0).length
    : 0;
  const activeSocieties = input.societes.filter((societe) => societe.statut === "actif");
  const files = input.noeuds.filter((node) => node.type === "fichier");
  const openCollections = input.collectes.filter((item) => !isClosedCollection(item));
  const nextDeadline = deadlines.find((deadline) => deadline.daysFromToday >= 0) ?? deadlines[0] ?? null;
  const currentCollection = [...openCollections].sort((left, right) => {
    if (left.echeance && right.echeance) return left.echeance.localeCompare(right.echeance);
    if (left.echeance) return -1;
    if (right.echeance) return 1;
    return right.majLe.localeCompare(left.majLe);
  })[0] ?? null;

  const kpis: DashboardKpi[] = input.role === "societe_employe"
    ? [
        {
          id: "collectes",
          label: "Collectes ouvertes",
          value: openCollections.length,
          supportingText: overdueCollections.length > 0
            ? `${plural(overdueCollections.length, "échéance")} en retard`
            : "Aucune échéance en retard",
          tone: overdueCollections.length > 0 ? "destructive" : "neutral",
        },
        {
          id: "deadline",
          label: "Prochaine échéance",
          value: nextDeadline
            ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(parseDateOnly(nextDeadline.echeance))
            : "—",
          supportingText: nextDeadline?.periode ?? "Aucune échéance à venir",
          tone: nextDeadline?.daysFromToday !== undefined && nextDeadline.daysFromToday <= 0 ? "warning" : "neutral",
        },
        {
          id: "documents",
          label: "Documents récents",
          value: files.length,
          supportingText: `${files.filter((file) => isCurrentMonth(file.creeLe, input.now)).length} ajoutés ce mois`,
        },
        ...(input.canUseMessaging ? [{
          id: "messages" as const,
          label: "Messages non lus",
          value: unreadMessages,
          supportingText: unreadThreads > 0 ? plural(unreadThreads, "conversation") : "Aucun message non lu",
          tone: unreadMessages > 0 ? "primary" as const : "neutral" as const,
        }] : []),
      ]
    : [
        {
          id: "clients",
          label: input.role === "admin" ? "Clients actifs" : "Mes sociétés",
          value: input.role === "admin" ? activeSocieties.length : input.societes.length,
          supportingText: `${input.societes.filter((societe) => isCurrentMonth(societe.creeLe, input.now)).length} ajoutées ce mois`,
        },
        {
          id: "collectes",
          label: "Collectes à traiter",
          value: actionableCollections.length,
          supportingText: overdueCollections.length > 0
            ? `${plural(overdueCollections.length, "échéance")} en retard`
            : "Aucune échéance en retard",
          tone: overdueCollections.length > 0 ? "destructive" : "neutral",
        },
        {
          id: "tasks",
          label: input.role === "admin" ? "Tâches ouvertes" : "Mes tâches ouvertes",
          value: openTasks,
          supportingText: `${input.taches.filter((task) => isCurrentMonth(task.creeLe, input.now)).length} créées ce mois`,
        },
        ...(input.canUseMessaging ? [{
          id: "messages" as const,
          label: "Messages non lus",
          value: unreadMessages,
          supportingText: unreadThreads > 0 ? plural(unreadThreads, "conversation") : "Aucun message non lu",
          tone: unreadMessages > 0 ? "primary" as const : "neutral" as const,
        }] : []),
      ];

  const presence = new Map(
    input.conversations.flatMap((conversation) =>
      conversation.type === "direct" && conversation.employeId
        ? [[conversation.employeId, conversation.enLigne] as const]
        : [],
    ),
  );
  const team = input.collaborateurs
    .map<DashboardTeamMember>((collaborateur) => {
      const assigned = input.taches.filter((task) => task.assigneId === collaborateur.id);
      const count = (status: TacheStatut) => assigned.filter((task) => task.statut === status).length;
      const aFaire = count("a_faire");
      const enCours = count("en_cours");
      const done = count("termine");
      const name = `${collaborateur.prenom} ${collaborateur.nom}`;
      return {
        id: collaborateur.id,
        name,
        initials: initials(name),
        active: collaborateur.statut === "actif",
        online: presence.get(collaborateur.id) ?? false,
        aFaire,
        enCours,
        done,
        open: aFaire + enCours,
        total: assigned.length,
      };
    })
    .sort((left, right) => right.open - left.open || left.name.localeCompare(right.name));

  const recentFiles = [...files]
    .sort((left, right) => right.majLe.localeCompare(left.majLe))
    .slice(0, 8)
    .map<DashboardFileActivity>((file) => ({
      id: file.id,
      name: file.libelle,
      format: file.format,
      societeName: file.societeId ? societyNames.get(file.societeId) ?? "Société" : "Cabinet",
      updatedAt: file.majLe,
    }));

  const recentMessages = input.canUseMessaging
    ? [...input.conversations]
        .sort((left, right) => right.dernierMessageLe.localeCompare(left.dernierMessageLe))
        .slice(0, 8)
        .map<DashboardMessageActivity>((conversation) => {
          const directEmployee = input.collaborateurs.find((employee) => employee.id === conversation.employeId);
          const label = conversation.type === "groupe"
            ? conversation.titre ?? "Conversation de groupe"
            : input.role !== "admin" && conversation.employeId === input.viewerEmployeId
              ? input.adminName
            : directEmployee
              ? `${directEmployee.prenom} ${directEmployee.nom}`
              : input.adminName;
          return {
            id: conversation.id,
            label,
            initials: initials(label),
            preview: conversation.dernierMessage,
            updatedAt: conversation.dernierMessageLe,
            unread: conversation.nonLus,
            online: conversation.enLigne,
          };
        })
    : [];

  const unpointed = input.bordereaux.filter((bordereau) => !bordereau.pointe);

  return {
    role: input.role,
    kpis,
    attentionItems: buildAttentionItems(input, societyNames),
    deadlines,
    taskCounts: tasks,
    collectionCounts: collections,
    team,
    recentFiles,
    recentMessages,
    collections: [...openCollections]
      .sort((left, right) => right.majLe.localeCompare(left.majLe))
      .map((collecte) => ({
        id: collecte.id,
        periode: collecte.periode,
        statut: collecte.statut,
        echeance: collecte.echeance,
        updatedAt: collecte.majLe,
        route: `/collectes/${collecte.id}`,
      })),
    journalEntries: [...input.journalEntries].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 8),
    currentCollection,
    nextDeadline,
    unpointedBordereaux: unpointed.length,
    unpointedAmount: unpointed.reduce(
      (total, bordereau) => total + bordereau.lignes.reduce((sum, line) => sum + (Number(line.montant) || 0), 0),
      0,
    ),
  };
}
