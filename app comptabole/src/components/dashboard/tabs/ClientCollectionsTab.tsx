import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardCollectionActivity } from "@/lib/dashboard/dashboardData";
import { cn, formatDate, formatRelative } from "@/lib/utils";

interface Group {
  key: "todo" | "waiting" | "done";
  title: string;
  hint: string;
  match: (collection: DashboardCollectionActivity) => boolean;
  defaultOpen: boolean;
}

const GROUPS: Group[] = [
  { key: "todo", title: "À compléter", hint: "Le cabinet attend votre saisie", match: (c) => c.statut === "brouillon" || c.statut === "a_corriger", defaultOpen: true },
  { key: "waiting", title: "En attente du cabinet", hint: "Transmises, en cours de vérification", match: (c) => c.statut === "transmis", defaultOpen: true },
  { key: "done", title: "Validées", hint: "Terminées avec le cabinet", match: (c) => c.statut === "valide", defaultOpen: false },
];

const STORAGE_KEY = "dashboard-client-collectes-groupes";

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** Jours entre aujourd'hui et la date d'échéance (négatif = en retard). */
function daysUntil(date: string): number {
  const today = new Date();
  const target = new Date(date);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) - start) / 86_400_000);
}

function deadlineText(echeance: string): { text: string; urgent: boolean } {
  const days = daysUntil(echeance);
  if (days < 0) return { text: `En retard de ${-days} jour${days === -1 ? "" : "s"}`, urgent: true };
  if (days === 0) return { text: "Échéance aujourd'hui", urgent: true };
  if (days <= 7) return { text: `Échéance dans ${days} jour${days === 1 ? "" : "s"}`, urgent: true };
  return { text: `Échéance ${formatDate(echeance)}`, urgent: false };
}

/** Collectes du responsable de société, rangées par ce qu'il doit faire : à compléter d'abord, le reste replié. */
export function ClientCollectionsTab({ collections, loading }: { collections: DashboardCollectionActivity[]; loading: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen);
  const toggle = (key: string, current: boolean) => {
    const next = { ...open, [key]: !current };
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Le repli reste valable pour cette visite.
    }
  };
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="py-3"><h2 className="text-base font-semibold text-primary">Collectes</h2><p className="mt-0.5 text-xs text-muted-foreground">Ce qui vous attend en premier, le reste est rangé dessous</p></header>
      {loading ? <div className="space-y-2">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : collections.length === 0 ? <DashboardEmptyState icon={ClipboardCheck} title="Aucune collecte pour le moment" description="Le cabinet vous préviendra dès qu'il vous en envoie une." /> : (
        <div className="space-y-3">
          {GROUPS.map((group) => {
            const items = collections.filter(group.match);
            if (items.length === 0 && group.key !== "todo") return null;
            const isOpen = open[group.key] ?? group.defaultOpen;
            const panelId = `collectes-${group.key}`;
            return (
              <div key={group.key} className={cn("rounded-md border bg-card", group.key === "todo" && items.length > 0 ? "border-accent" : "border-border")}>
                <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(group.key, isOpen)} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !isOpen && "-rotate-90")} aria-hidden="true" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{group.title}</span><span className="block truncate text-xs text-muted-foreground">{group.hint}</span></span>
                  <Badge variant={group.key === "todo" && items.length > 0 ? "warning" : "outline"}>{items.length}</Badge>
                </button>
                {isOpen && (
                  <ul id={panelId} className="border-t border-border">
                    {items.length === 0 ? <li className="px-4 py-4 text-sm text-muted-foreground">Rien à compléter pour le moment.</li> : items.map((collection) => <CollectionRow key={collection.id} collection={collection} primary={group.key === "todo"} />)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CollectionRow({ collection, primary }: { collection: DashboardCollectionActivity; primary: boolean }) {
  const navigate = useNavigate();
  const deadline = collection.echeance && collection.statut !== "valide" ? deadlineText(collection.echeance) : null;
  return (
    <li className="grid min-w-0 grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{collection.libelle}</p>
          {collection.statut === "a_corriger" && <Badge variant="warning">À corriger</Badge>}
        </div>
        <p className={cn("mt-0.5 text-xs", deadline?.urgent ? "font-semibold text-warning" : "text-muted-foreground")}>
          {deadline ? `${deadline.text} · ` : ""}mise à jour {formatRelative(collection.updatedAt)}
        </p>
      </div>
      {collection.progress !== null ? (
        <div className="flex items-center gap-2" role="img" aria-label={`Avancement ${collection.progress} %`}>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${collection.progress}%` }} /></div>
          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{collection.progress}%</span>
        </div>
      ) : <span aria-hidden="true" className="hidden sm:block" />}
      <Button variant={primary ? "default" : "outline"} size="sm" className="min-h-11 sm:min-w-28" onClick={() => navigate(collection.route)} aria-label={`${primary ? "Compléter" : "Ouvrir"} la collecte ${collection.libelle}`}>
        {primary ? "Compléter" : "Ouvrir"}
      </Button>
    </li>
  );
}
