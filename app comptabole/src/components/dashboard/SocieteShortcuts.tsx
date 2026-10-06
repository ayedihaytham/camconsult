import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BookText,
  Boxes,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderTree,
  ListChecks,
  Receipt,
  X,
  type LucideIcon,
} from "lucide-react";
import { visibleNavigation } from "@/components/layout/sidebar/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { useChoisirSociete } from "@/hooks/useSocieteActive";
import { estEnRetard } from "@/lib/facturation";
import { lienDeSociete } from "@/lib/societeContext";
import { useCollectes } from "@/store/collectes";
import { useTaches } from "@/store/data";
import { useFacturation } from "@/store/facturation";
import { useStock } from "@/store/stock";
import type { Societe } from "@/types";

const RACCOURCIS: { label: string; base: string; icon: LucideIcon }[] = [
  { label: "Tâches", base: "/taches", icon: ListChecks },
  { label: "Gestion de stock", base: "/stock", icon: Boxes },
  { label: "États financiers", base: "/etats-financiers", icon: Calculator },
  { label: "Collecte de pièces", base: "/collectes", icon: ClipboardList },
  { label: "Facturation", base: "/facturation", icon: FileText },
  { label: "État client", base: "/honoraires", icon: Receipt },
  { label: "Suivi client devise", base: "/suivi-devise", icon: CircleDollarSign },
  { label: "Souche de chèques", base: "/souche-cheques", icon: BookText },
  { label: "Structuration", base: "/structuration", icon: FolderTree },
];

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Accès directs aux modules du client sélectionné : un clic suffit, sans repasser
 * par la liste des sociétés. Seuls les modules que l'utilisateur peut ouvrir sont proposés. */
export function SocieteShortcuts({ societe }: { societe: Societe }) {
  const { isAdmin, lectureSeule, can, canManageCollaborateurs, isResponsableSociete } = usePermissions();
  const choisir = useChoisirSociete();

  const destinations = new Set(
    visibleNavigation({ isAdmin, lectureSeule, can, canManageCollaborateurs, isResponsableSociete }).flatMap((groupe) =>
      groupe.items.flatMap((item) => (item.children ? item.children.map((c) => c.to) : item.to ? [item.to] : [])),
    ),
  );
  const raccourcis = RACCOURCIS.filter((r) => destinations.has(r.base));

  // Chiffres du dossier, tirés des données déjà en mémoire ; le stock et les
  // factures ne sont chargés que si l'utilisateur peut ouvrir ces modules.
  const collectes = useCollectes((s) => s.list);
  const taches = useTaches();
  const mouvements = useStock((s) => s.counts);
  const fetchMouvements = useStock((s) => s.fetchCounts);
  const factures = useFacturation((s) => s.list);
  const fetchFactures = useFacturation((s) => s.fetchList);
  const voitStock = destinations.has("/stock");
  const voitFactures = destinations.has("/facturation");
  useEffect(() => {
    if (voitStock) void fetchMouvements().catch(() => {});
  }, [voitStock, fetchMouvements]);
  useEffect(() => {
    if (voitFactures) void fetchFactures().catch(() => {});
  }, [voitFactures, fetchFactures]);

  const details: Record<string, string | null> = {};
  const collectesActives = collectes.filter((c) => c.societeId === societe.id && c.statut !== "archive").length;
  details["/collectes"] = collectesActives ? pluriel(collectesActives, "collecte active", "collectes actives") : null;
  const tachesOuvertes = taches.filter((t) => t.societeId === societe.id && t.statut !== "termine").length;
  details["/taches"] = tachesOuvertes ? pluriel(tachesOuvertes, "tâche ouverte", "tâches ouvertes") : null;
  const nbMouvements = mouvements[societe.id] ?? 0;
  details["/stock"] = nbMouvements ? pluriel(nbMouvements, "mouvement", "mouvements") : null;
  const impayees = factures.filter((f) => f.societeId === societe.id && f.statut === "emise");
  const enRetard = impayees.filter((f) => estEnRetard(f)).length;
  details["/facturation"] = impayees.length
    ? `${pluriel(impayees.length, "impayée", "impayées")}${enRetard ? ` · ${enRetard} en retard` : ""}`
    : null;

  if (raccourcis.length === 0) return null;

  return (
    <section
      aria-label={`Accès rapides au dossier ${societe.raisonSociale}`}
      className="rounded-xl border border-accent/30 bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Dossier · <span className="text-primary">{societe.raisonSociale}</span>
        </p>
        <button
          type="button"
          onClick={() => choisir(null)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Toutes les sociétés
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {raccourcis.map(({ label, base, icon: Icon }) => (
          <Link
            key={base}
            to={lienDeSociete(base, societe.id)}
            className="group flex min-w-0 flex-col gap-2 rounded-lg border border-accent/25 bg-secondary/40 p-3 transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center justify-between">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <ArrowUpRight
                className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{label}</span>
              {details[base] && (
                <span className={`block truncate text-xs ${base === "/facturation" && details[base]?.includes("retard") ? "font-semibold text-warning" : "text-muted-foreground"}`}>
                  {details[base]}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
