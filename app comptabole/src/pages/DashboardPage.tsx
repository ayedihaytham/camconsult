import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  FileSpreadsheet,
  FileText,
  FolderTree,
  ListChecks,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LedgerSheet, LedgerSheetHeader, LedgerSheetLink } from "@/components/ledger/LedgerSheet";
import { StatutDot } from "@/components/ledger/StatusDot";
import { RadialBarChart, type RadialSegment } from "@/components/charts/RadialBarChart";
import { avatarColor, cn, formatNumber, formatDate, isCurrentMonth, toTitleCase } from "@/lib/utils";
import {
  useSocietes,
  useEmployes,
  useCollaborateurs,
  useNoeuds,
  useTaches,
  useConversations,
} from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/store/auth";
import { employeNomComplet } from "@/data/employes";
import { TACHE_STATUT_LABELS } from "@/types";

interface Kpi {
  key: string;
  label: string;
  value: number;
  delta: number;
  icon: LucideIcon;
  to: string;
  iconClassName: string;
  barClassName: string;
}

const TODAY_LABEL = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/** Silhouette carrée + pictogramme dédié au type de fichier — jamais la couleur seule
 * pour distinguer (voir DESIGN-SYSTEM.md §5). Le format reste aussi affiché en texte. */
function FileMark({ format }: { format?: string }) {
  const isSheet = /^(xlsx?|csv|ods)$/i.test(format ?? "");
  const Icon = isSheet ? FileSpreadsheet : FileText;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border text-muted-foreground">
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { isAdmin, canSeeSociete, employeId } = usePermissions();
  const allSocietes = useSocietes();
  const employes = useEmployes();
  const collaborateurs = useCollaborateurs();
  const allNoeuds = useNoeuds();
  const taches = useTaches();
  const adminName = toTitleCase(useAuth((s) => s.session?.cabinetNom ?? "Cabinet"));
  const sessionNom = toTitleCase(useAuth((s) => s.session?.nom ?? ""));
  const prenom = sessionNom.split(" ")[0] || "";

  const societes = allSocietes.filter((s) => canSeeSociete(s.id));
  const noeuds = allNoeuds.filter((n) => canSeeSociete(n.societeId));
  const tachesOuvertes = taches.filter((t) => t.statut !== "termine").length;
  const conversations = useConversations(
    isAdmin ? "me" : (employeId ?? "me"),
  ).filter((c) => isAdmin || c.type === "groupe" || c.employeId === employeId);

  const fichiers = noeuds.filter((n) => n.type === "fichier");
  const nbFichiers = fichiers.length;
  const isEmpty =
    isAdmin &&
    societes.length === 0 &&
    collaborateurs.length === 0 &&
    noeuds.length === 0 &&
    taches.length === 0;

  const kpis: Kpi[] = [
    {
      key: "clients",
      label: isAdmin ? "Nombre de clients" : "Mes sociétés",
      value: societes.length,
      delta: societes.filter((s) => isCurrentMonth(s.creeLe)).length,
      icon: Building2,
      to: "/societes",
      iconClassName: "bg-chart-1/10 text-chart-1",
      barClassName: "bg-chart-1",
    },
    {
      key: "fichiers",
      label: "Nombre de fichiers",
      value: nbFichiers,
      delta: fichiers.filter((n) => isCurrentMonth(n.creeLe)).length,
      icon: FileText,
      to: "/structuration",
      iconClassName: "bg-chart-3/10 text-chart-3",
      barClassName: "bg-chart-3",
    },
    ...(isAdmin
      ? [
          {
            key: "collaborateurs",
            label: "Collaborateurs",
            value: collaborateurs.length,
            delta: collaborateurs.filter((e) => isCurrentMonth(e.creeLe))
              .length,
            icon: Users,
            to: "/employes",
            iconClassName: "bg-chart-4/10 text-chart-4",
            barClassName: "bg-chart-4",
          },
        ]
      : []),
    {
      key: "taches",
      label: isAdmin ? "Tâches en cours" : "Mes tâches à faire",
      value: tachesOuvertes,
      delta: taches.filter((t) => isCurrentMonth(t.creeLe)).length,
      icon: ListChecks,
      to: "/taches",
      iconClassName: "bg-chart-2/10 text-chart-2",
      barClassName: "bg-chart-2",
    },
  ];
  const themeCounts = societes.reduce<Record<string, number>>((acc, s) => {
    acc[s.theme] = (acc[s.theme] ?? 0) + 1;
    return acc;
  }, {});
  const themeEntries = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  const RADIAL_COLORS = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4", "stroke-chart-5"];
  const DOT_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
  const themeSegments: RadialSegment[] = themeEntries.map(([theme, count], i) => ({
    label: theme,
    value: count,
    colorClassName: RADIAL_COLORS[i % RADIAL_COLORS.length],
  }));

  const recentFiles = [...noeuds]
    .filter((n) => n.type === "fichier")
    .sort((a, b) => b.majLe.localeCompare(a.majLe))
    .slice(0, 5);

  const recentConversations = [...conversations]
    .sort((a, b) => b.dernierMessageLe.localeCompare(a.dernierMessageLe))
    .slice(0, 4);

  const actifs = societes.filter((s) => s.statut === "actif").length;

  const tacheParStatut = {
    a_faire: taches.filter((t) => t.statut === "a_faire").length,
    en_cours: taches.filter((t) => t.statut === "en_cours").length,
    termine: taches.filter((t) => t.statut === "termine").length,
  };
  const chargeParCollaborateur = collaborateurs
    .map((c) => {
      const list = taches.filter((t) => t.assigneId === c.id);
      const done = list.filter((t) => t.statut === "termine").length;
      return { c, total: list.length, done };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return (
    <div>
      {/* Bandeau d'accueil — identité de marque (marine + or), personnalisé
          plutôt qu'un simple titre de page générique. */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* Motif géométrique discret — filet diagonal fin, sous les cercles */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, hsl(var(--accent)) 0, hsl(var(--accent)) 1px, transparent 1px, transparent 22px)",
            }}
          />
          <div className="absolute -right-16 -top-24 size-72 rounded-full border border-accent/25" />
          <div className="absolute -right-4 top-10 size-40 rounded-full border border-accent/15" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 88% 15%, hsl(var(--accent) / 0.18), transparent 48%)",
            }}
          />
        </div>
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">
            {TODAY_LABEL}
          </p>
          <h1 className="mt-2 font-serif text-[1.9rem] font-bold leading-tight sm:text-[2.15rem]">
            {greeting()}
            {prenom ? `, ${prenom}` : ""}
          </h1>
          <p className="mt-1.5 max-w-md text-sm text-primary-foreground/80">
            Vue d'ensemble de l'activité du cabinet.
          </p>
        </div>
      </div>

      {/* KPI — jauges circulaires ; la progression encode value/max du
          groupe affiché (pas un pourcentage inventé), la couleur n'est
          jamais le seul repère puisque le libellé et la valeur restent en
          texte à côté. */}
      <div
        className={cn(
          "grid gap-4",
          kpis.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3",
        )}
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.key}
              onClick={() => navigate(kpi.to)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <span
                className={cn("absolute inset-x-0 top-0 h-[3px]", kpi.barClassName)}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
                    kpi.iconClassName,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {kpi.delta > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success">
                    <TrendingUp className="h-3 w-3" aria-hidden />
                    +{kpi.delta}
                  </span>
                )}
              </div>
              <p className="mt-4 text-[1.75rem] font-extrabold tabular-nums leading-none tracking-tight text-foreground">
                {formatNumber(kpi.value)}
              </p>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                {kpi.label}
              </p>
              {kpi.delta > 0 && (
                <p className="mt-2 text-[0.72rem] text-muted-foreground/80">
                  +{kpi.delta} ce mois-ci
                </p>
              )}
            </button>
          );
        })}
      </div>

      {isEmpty ? (
        <LedgerSheet className="mt-7">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70">
              Premiers pas
            </p>
            <h2 className="mt-1.5 font-serif text-2xl font-bold text-foreground">
              Bienvenue — commençons la configuration
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Aucune donnée n'est encore enregistrée. Créez vos premières fiches
              pour alimenter le cabinet.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <OnboardingStep
                index="01"
                icon={Building2}
                title="Ajouter des sociétés"
                desc="Enregistrez vos clients et leurs accès."
                onClick={() => navigate("/societes")}
              />
              <OnboardingStep
                index="02"
                icon={Users}
                title="Ajouter des collaborateurs"
                desc="Créez les comptes de votre équipe."
                onClick={() => navigate("/employes")}
              />
              <OnboardingStep
                index="03"
                icon={FolderTree}
                title="Structurer les dossiers"
                desc="Montez l'arborescence documentaire."
                onClick={() => navigate("/structuration")}
              />
            </div>
          </div>
        </LedgerSheet>
      ) : (
        <>
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            <LedgerSheet>
              <LedgerSheetHeader title="Répartition des clients" />
              <div className="space-y-4 p-[18px]">
                {themeEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucune société enregistrée.
                  </p>
                )}
                {themeEntries.length > 0 && (
                  <div className="flex items-center gap-5">
                    <RadialBarChart segments={themeSegments} size={132} strokeWidth={9} gap={3} />
                    <div className="flex-1 space-y-1.5">
                      {themeEntries.map(([theme, count], i) => (
                        <div key={theme} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLORS[i % DOT_COLORS.length])} />
                            {theme}
                          </span>
                          <span className="font-bold tabular-nums text-foreground">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {societes.length > 0 && (
                  <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                      Sociétés actives
                    </span>
                    <span className="font-bold tabular-nums text-foreground">
                      {actifs} / {societes.length}
                    </span>
                  </div>
                )}
              </div>
            </LedgerSheet>

            <LedgerSheet>
              <LedgerSheetHeader
                title="Fichiers récents"
                action={
                  <LedgerSheetLink onClick={() => navigate("/structuration")}>
                    Tout voir
                  </LedgerSheetLink>
                }
              />
              <div className="p-1.5">
                {recentFiles.length === 0 && (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    Aucun fichier.
                  </p>
                )}
                {recentFiles.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => navigate("/structuration")}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <FileMark format={f.format} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {f.libelle}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Modifié le {formatDate(f.majLe)}
                      </span>
                    </span>
                    {f.format && (
                      <span className="shrink-0 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
                        {f.format}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </LedgerSheet>

            <LedgerSheet>
              <LedgerSheetHeader
                title="Échanges récents"
                action={
                  <LedgerSheetLink onClick={() => navigate("/messagerie")}>
                    Ouvrir
                  </LedgerSheetLink>
                }
              />
              <div className="p-1.5">
                {recentConversations.length === 0 && (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    Aucune conversation.
                  </p>
                )}
                {recentConversations.map((c) => {
                  const emp = employes.find((e) => e.id === c.employeId);
                  const label =
                    c.type === "groupe"
                      ? toTitleCase(c.titre ?? "Groupe")
                      : isAdmin
                        ? emp
                          ? employeNomComplet(emp)
                          : "—"
                        : adminName;
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate("/messagerie")}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                    >
                      {/* Cercle = personne, carré arrondi = groupe (silhouette,
                          pas seulement la couleur — voir DESIGN-SYSTEM.md §5) */}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold",
                          c.type === "groupe" ? "rounded-[9px] bg-accent/12 text-accent" : cn("rounded-full", avatarColor(c.employeId ?? c.id)),
                        )}
                      >
                        {label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.dernierMessage}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </LedgerSheet>
          </div>

          {isAdmin && taches.length > 0 && (
            <LedgerSheet className="mt-7">
              <LedgerSheetHeader
                title="Avancement des tâches"
                action={
                  <LedgerSheetLink onClick={() => navigate("/taches")}>
                    Ouvrir les tâches
                  </LedgerSheetLink>
                }
              />
              <div className="grid grid-cols-3 divide-x divide-border">
                {(["a_faire", "en_cours", "termine"] as const).map((k) => (
                  <div key={k} className="px-3 py-4 text-center">
                    <p className="text-2xl font-extrabold tabular-nums text-foreground">
                      {tacheParStatut[k]}
                    </p>
                    <p className="mt-0.5 text-[0.72rem] font-bold uppercase tracking-wide text-muted-foreground">
                      {TACHE_STATUT_LABELS[k]}
                    </p>
                  </div>
                ))}
              </div>
              {chargeParCollaborateur.length > 0 && (
                <div className="space-y-3 border-t border-border p-[18px]">
                  {chargeParCollaborateur.map(({ c, total, done }) => (
                    <div key={c.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {c.prenom} {c.nom}
                        </span>
                        <span className="font-bold tabular-nums text-foreground">
                          {done}/{total}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${total ? (done / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </LedgerSheet>
          )}

          {societes.length > 0 && (
            <LedgerSheet className="mt-7">
              <LedgerSheetHeader
                title="Dernières sociétés ajoutées"
                action={
                  <LedgerSheetLink onClick={() => navigate("/societes")}>
                    Voir toutes les sociétés
                  </LedgerSheetLink>
                }
              />
              <div>
                {[...societes]
                  .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
                  .slice(0, 3)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate("/societes")}
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-[18px] py-3 text-left transition-colors last:border-b-0 hover:bg-primary/[0.03]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {s.raisonSociale}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {s.code} · Ajoutée le {formatDate(s.creeLe)}
                        </span>
                      </span>
                      <StatutDot statut={s.statut} />
                    </button>
                  ))}
              </div>
            </LedgerSheet>
          )}
        </>
      )}
    </div>
  );
}

function OnboardingStep({
  index,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  index: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/[0.03] hover:shadow-card-hover"
    >
      <span
        className="pointer-events-none absolute -right-2 -top-2 select-none font-serif text-4xl font-bold text-primary/[0.05] transition-colors duration-200 group-hover:text-accent/[0.12]"
        aria-hidden="true"
      >
        {index}
      </span>
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <span className="relative text-sm font-semibold text-foreground">{title}</span>
      <span className="relative text-xs text-muted-foreground">{desc}</span>
      <span className="relative mt-1 inline-flex items-center gap-1 text-xs font-bold text-foreground">
        Commencer
        <ArrowUpRight className="h-3.5 w-3.5 text-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
