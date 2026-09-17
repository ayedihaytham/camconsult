import { useNavigate } from "react-router-dom";
import { Building2, FileText, ListChecks, Users, type LucideIcon } from "lucide-react";
import { ClientDistributionCard } from "@/components/dashboard/ClientDistributionCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { RecentCompaniesCard } from "@/components/dashboard/RecentCompaniesCard";
import { TaskProgressCard } from "@/components/dashboard/TaskProgressCard";
import { avatarColor, formatDate, isCurrentMonth, toTitleCase } from "@/lib/utils";
import { useCollaborateurs, useConversations, useEmployes, useNoeuds, useSocietes, useTaches } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/store/auth";
import { employeNomComplet } from "@/data/employes";

interface Kpi {
  key: string;
  label: string;
  value: number;
  delta: number;
  icon: LucideIcon;
}

const TODAY_LABEL = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { isAdmin, can, canSeeSociete, employeId, lectureSeule } = usePermissions();
  const allSocietes = useSocietes();
  const employes = useEmployes();
  const collaborateurs = useCollaborateurs();
  const allNoeuds = useNoeuds();
  const taches = useTaches();
  const adminName = toTitleCase(useAuth((state) => state.session?.cabinetNom ?? "Cabinet"));
  const sessionNom = toTitleCase(useAuth((state) => state.session?.nom ?? ""));
  const prenom = sessionNom.split(" ")[0] || "";

  const societes = allSocietes.filter((societe) => canSeeSociete(societe.id));
  const noeuds = allNoeuds.filter((noeud) => canSeeSociete(noeud.societeId));
  const fichiers = noeuds.filter((noeud) => noeud.type === "fichier");
  const tachesOuvertes = taches.filter((tache) => tache.statut !== "termine").length;
  const conversations = useConversations(isAdmin ? "me" : (employeId ?? "me")).filter(
    (conversation) => isAdmin || conversation.type === "groupe" || conversation.employeId === employeId,
  );

  const kpis: Kpi[] = [
    { key: "clients", label: isAdmin ? "Nombre de clients" : "Mes sociétés", value: societes.length, delta: societes.filter((societe) => isCurrentMonth(societe.creeLe)).length, icon: Building2 },
    { key: "fichiers", label: "Nombre de fichiers", value: fichiers.length, delta: fichiers.filter((fichier) => isCurrentMonth(fichier.creeLe)).length, icon: FileText },
    ...(isAdmin ? [{ key: "collaborateurs", label: "Collaborateurs", value: collaborateurs.length, delta: collaborateurs.filter((collaborateur) => isCurrentMonth(collaborateur.creeLe)).length, icon: Users }] : []),
    { key: "taches", label: isAdmin ? "Tâches ouvertes" : "Mes tâches ouvertes", value: tachesOuvertes, delta: taches.filter((tache) => isCurrentMonth(tache.creeLe)).length, icon: ListChecks },
  ];

  const themeCounts = societes.reduce<Record<string, number>>((counts, societe) => {
    counts[societe.theme] = (counts[societe.theme] ?? 0) + 1;
    return counts;
  }, {});
  const themeEntries = Object.entries(themeCounts).sort((left, right) => right[1] - left[1]);
  const dotColors = ["bg-primary", "bg-primary/70", "bg-muted-foreground", "bg-muted-foreground/70", "bg-muted"];

  const recentFiles = [...fichiers]
    .sort((left, right) => right.majLe.localeCompare(left.majLe))
    .slice(0, 5)
    .map((file) => ({ id: file.id, label: file.libelle, format: file.format, modifiedLabel: `Modifié le ${formatDate(file.majLe)}` }));

  const recentConversations = [...conversations]
    .sort((left, right) => right.dernierMessageLe.localeCompare(left.dernierMessageLe))
    .slice(0, 4)
    .map((conversation) => {
      const employe = employes.find((candidate) => candidate.id === conversation.employeId);
      const label = conversation.type === "groupe"
        ? toTitleCase(conversation.titre ?? "Groupe")
        : isAdmin ? employe ? employeNomComplet(employe) : "—" : adminName;
      return {
        id: conversation.id,
        label,
        message: conversation.dernierMessage,
        initials: label.slice(0, 2).toUpperCase(),
        avatarClassName: conversation.type === "groupe" ? "bg-accent/15 text-accent-foreground" : avatarColor(conversation.employeId ?? conversation.id),
      };
    });

  const taskCounts = {
    aFaire: taches.filter((tache) => tache.statut === "a_faire").length,
    enCours: taches.filter((tache) => tache.statut === "en_cours").length,
    termine: taches.filter((tache) => tache.statut === "termine").length,
  };
  const workloads = collaborateurs
    .map((collaborateur) => {
      const assigned = taches.filter((tache) => tache.assigneId === collaborateur.id);
      return { id: collaborateur.id, label: `${collaborateur.prenom} ${collaborateur.nom}`, total: assigned.length, done: assigned.filter((tache) => tache.statut === "termine").length };
    })
    .filter((workload) => workload.total > 0)
    .sort((left, right) => right.total - left.total)
    .slice(0, 6);
  const recentSocietes = [...societes].sort((left, right) => right.creeLe.localeCompare(left.creeLe)).slice(0, 3);
  const canAddSociete = !lectureSeule && (isAdmin || can("modifierSocietes"));

  return (
    <div className="space-y-4 md:space-y-6">
      <DashboardHeader
        salutation={`${greeting()}${prenom ? ` ${prenom}` : ""}`}
        description="Voici un aperçu de l'activité de votre cabinet."
        dateLabel={toTitleCase(TODAY_LABEL)}
        onAddSociete={canAddSociete ? () => navigate("/societes") : undefined}
      />

      <section aria-label="Indicateurs clés" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {kpis.map(({ key, ...kpi }) => <KpiCard key={key} {...kpi} />)}
      </section>

      <section aria-label="Informations récentes" className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <ClientDistributionCard entries={themeEntries} dotColors={dotColors} activeCount={societes.filter((societe) => societe.statut === "actif").length} totalCount={societes.length} />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <RecentActivityCard files={recentFiles} conversations={recentConversations} onOpenFiles={() => navigate("/structuration")} onOpenConversations={() => navigate("/messagerie")} />
        </div>
      </section>

      {isAdmin && <TaskProgressCard counts={taskCounts} workloads={workloads} onOpenTasks={() => navigate("/taches")} />}
      <RecentCompaniesCard societes={recentSocietes} onOpenSocietes={() => navigate("/societes")} />
    </div>
  );
}
