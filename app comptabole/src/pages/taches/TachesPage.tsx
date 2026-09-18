import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ListChecks,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatRelative } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useData,
  useTaches,
  useSocietes,
  useCollaborateurs,
} from "@/store/data";
import { TACHE_STATUT_LABELS } from "@/types";
import type { Tache, TacheStatut } from "@/types";
import { TacheFormSheet } from "./TacheFormSheet";

const ALL = "all";
const COLUMNS: TacheStatut[] = ["a_faire", "en_cours", "termine"];
const ORDER: TacheStatut[] = ["a_faire", "en_cours", "termine"];

/** Classes Tailwind écrites en toutes lettres (jamais construites par
 * interpolation, sinon le scanner JIT ne les détecte pas). */
const COLUMN_META: Record<
  TacheStatut,
  { icon: typeof ListTodo; wash: string; badge: string; bar: string; dot: string }
> = {
  a_faire: {
    icon: ListTodo,
    wash: "bg-chart-5/[0.06]",
    badge: "bg-chart-5/15 text-chart-5",
    bar: "bg-chart-5",
    dot: "bg-chart-5",
  },
  en_cours: {
    icon: CircleDot,
    wash: "bg-chart-2/[0.06]",
    badge: "bg-chart-2/15 text-chart-2",
    bar: "bg-chart-2",
    dot: "bg-chart-2",
  },
  termine: {
    icon: Check,
    wash: "bg-chart-3/[0.06]",
    badge: "bg-chart-3/15 text-chart-3",
    bar: "bg-chart-3",
    dot: "bg-chart-3",
  },
};

const selectTriggerClass =
  "h-auto w-auto gap-1.5 rounded-none border-0 border-b border-border bg-transparent px-0 pb-1.5 text-sm shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

export function TachesPage() {
  const { isAdmin, employeId } = usePermissions();
  const taches = useTaches();
  const societes = useSocietes();
  const collaborateurs = useCollaborateurs();
  const addTache = useData((s) => s.addTache);
  const updateTache = useData((s) => s.updateTache);
  const setTacheStatut = useData((s) => s.setTacheStatut);
  const deleteTache = useData((s) => s.deleteTache);

  const [societeFilter, setSocieteFilter] = useState(ALL);
  const [assigneFilter, setAssigneFilter] = useState(ALL);
  const [statutFilter, setStatutFilter] = useState(ALL);
  const [vue, setVue] = useState<"board" | "list">("board");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tache | null>(null);
  const [toDelete, setToDelete] = useState<Tache | null>(null);

  const societeNom = (id: string) =>
    societes.find((s) => s.id === id)?.raisonSociale ?? "Société supprimée";
  const collabNom = (id: string | null) => {
    if (!id) return "Non assignée";
    const c = collaborateurs.find((x) => x.id === id);
    return c ? `${c.prenom} ${c.nom}` : "Collaborateur retiré";
  };

  // Filtres société/collaborateur, communs aux deux vues. Le statut n'y est
  // volontairement pas inclus : dans le Tableau, les colonnes SONT déjà le
  // regroupement par statut — y appliquer en plus un filtre de statut actif
  // dans l'onglet Liste ferait disparaître une carte du tableau dès qu'on la
  // fait changer de colonne (elle ne correspondrait plus au filtre resté actif).
  const filteredBase = useMemo(() => {
    return taches.filter((t) => {
      if (societeFilter !== ALL && t.societeId !== societeFilter) return false;
      if (isAdmin && assigneFilter !== ALL) {
        if (assigneFilter === "none" ? t.assigneId : t.assigneId !== assigneFilter)
          return false;
      }
      return true;
    });
  }, [taches, societeFilter, assigneFilter, isAdmin]);

  // Vue Liste uniquement : ajoute le filtre de statut (son sélecteur n'existe
  // que dans cette vue).
  const filtered = useMemo(() => {
    return filteredBase.filter(
      (t) => statutFilter === ALL || t.statut === statutFilter,
    );
  }, [filteredBase, statutFilter]);

  // Un collaborateur peut faire avancer sa propre tâche, mais seul l'admin
  // peut la faire reculer (revenir sur un statut déjà dépassé doit rester
  // une décision du cabinet, pas de l'exécutant).
  const canMoveForward = (t: Tache) => isAdmin || t.assigneId === employeId;
  const canMoveBackward = (_t: Tache) => isAdmin;

  function move(t: Tache, dir: -1 | 1) {
    const i = ORDER.indexOf(t.statut);
    const next = ORDER[i + dir];
    if (!next) return;
    setTacheStatut(t.id, next);
  }

  function handleSubmit(values: {
    titre: string;
    description: string;
    societeId: string;
    assigneId: string | null;
  }) {
    if (editing) {
      updateTache(editing.id, values);
      toast.success("Tâche modifiée", { description: values.titre });
    } else {
      addTache(values);
      toast.success("Tâche créée", { description: values.titre });
    }
    setEditing(null);
  }

  const empty = taches.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        title="Tâches"
        description={
          isAdmin
            ? "Travail confié aux collaborateurs, par société. Suivez l'avancement."
            : "Votre travail à faire. Faites avancer chaque tâche jusqu'à « Terminé »."
        }
        actions={
          isAdmin ? (
            <Button
              variant="ledger"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouvelle tâche
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 mt-3 flex flex-wrap items-end gap-6">
        <Select value={societeFilter} onValueChange={setSocieteFilter}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Société" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les sociétés</SelectItem>
            {societes.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.raisonSociale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <Select value={assigneFilter} onValueChange={setAssigneFilter}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Collaborateur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les collaborateurs</SelectItem>
              <SelectItem value="none">Non assignées</SelectItem>
              {collaborateurs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.prenom} {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {empty ? (
        <LedgerSheet className="flex-1">
          <EmptyState
            icon={ListChecks}
            title="Aucune tâche"
            description={
              isAdmin
                ? "Créez une première tâche et assignez-la à un collaborateur."
                : "Aucune tâche ne vous est assignée pour le moment."
            }
            action={
              isAdmin ? (
                <Button
                  variant="ledger"
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle tâche
                </Button>
              ) : undefined
            }
          />
        </LedgerSheet>
      ) : (
        <div className="flex flex-1 flex-col">
          <LedgerSegmented
            value={vue}
            onChange={setVue}
            options={[
              { value: "board", label: "Tableau" },
              { value: "list", label: "Liste" },
            ]}
          />

          {/* ── Kanban ─────────────────────────────── */}
          {/* Une carte par colonne, teinte de fond propre au statut (même
              palette que les jauges du dashboard) : lecture immédiate de la
              répartition sans avoir à lire les libellés. */}
          {vue === "board" && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {COLUMNS.map((col) => {
                const items = filteredBase.filter((t) => t.statut === col);
                const meta = COLUMN_META[col];
                const ColIcon = meta.icon;
                return (
                  <div
                    key={col}
                    className={cn("rounded-2xl border border-border shadow-card", meta.wash)}
                  >
                    <div className="flex items-center gap-2.5 px-4 py-3.5">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", meta.badge)}>
                        <ColIcon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {TACHE_STATUT_LABELS[col]}
                      </span>
                      <span className={cn("ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums", meta.badge)}>
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-2.5 px-2.5 pb-2.5">
                      {items.map((t) => {
                        const initiales = collabNom(t.assigneId)
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <article
                            key={t.id}
                            className="group relative overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-card-hover"
                          >
                            <span className={cn("absolute inset-y-0 left-0 w-1", meta.bar)} aria-hidden />
                            <div className="flex items-start justify-between gap-2 pl-1.5">
                              <p className="text-sm font-semibold leading-snug text-foreground">
                                {t.titre}
                              </p>
                              {isAdmin && (
                                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                    onClick={() => {
                                      setEditing(t);
                                      setFormOpen(true);
                                    }}
                                    title="Modifier"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setToDelete(t)}
                                    title="Supprimer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {t.description && (
                              <p className="mt-1 line-clamp-2 pl-1.5 text-xs text-muted-foreground">
                                {t.description}
                              </p>
                            )}

                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.68rem] font-medium text-foreground">
                                <Building2 className="h-2.5 w-2.5" />
                                {societeNom(t.societeId)}
                              </span>
                              {isAdmin && t.assigneId && (
                                <span
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
                                  title={collabNom(t.assigneId)}
                                >
                                  {initiales}
                                </span>
                              )}
                            </div>

                            <div className="mt-2.5 flex items-center justify-between pl-1.5 pt-2">
                              <span className="text-[11px] text-muted-foreground">
                                {formatRelative(t.creeLe)}
                              </span>
                              {(canMoveBackward(t) || canMoveForward(t)) && (
                                <div className="flex gap-1">
                                  {canMoveBackward(t) && (
                                    <button
                                      disabled={t.statut === "a_faire"}
                                      onClick={() => move(t, -1)}
                                      className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground enabled:hover:bg-secondary enabled:hover:text-foreground disabled:opacity-30"
                                      title="Reculer"
                                    >
                                      <ChevronLeft className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {canMoveForward(t) && (
                                    <button
                                      disabled={t.statut === "termine"}
                                      onClick={() => move(t, 1)}
                                      className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground enabled:hover:bg-secondary enabled:hover:text-foreground disabled:opacity-30"
                                      title="Avancer"
                                    >
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                      {items.length === 0 && (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                          Rien ici
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Liste ──────────────────────────────── */}
          {vue === "list" && (
            <div className="mt-4 flex flex-1 flex-col">
              <div className="mb-3">
                <Select value={statutFilter} onValueChange={setStatutFilter}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Tous les statuts</SelectItem>
                    {COLUMNS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {TACHE_STATUT_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <LedgerSheet className="flex-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-border bg-secondary/50 px-3 py-3 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                          Tâche
                        </th>
                        <th className="border-b border-border bg-secondary/50 px-3 py-3 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                          Société
                        </th>
                        {isAdmin && (
                          <th className="border-b border-border bg-secondary/50 px-3 py-3 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                            Assigné
                          </th>
                        )}
                        <th className="border-b border-border bg-secondary/50 px-3 py-3 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                          Statut
                        </th>
                        <th className="border-b border-border bg-secondary/50 px-3 py-3 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                          Créée
                        </th>
                        {isAdmin && (
                          <th className="w-[1%] border-b border-border bg-secondary/50 px-3 py-3" />
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-border/70 transition-colors last:border-b-0 hover:bg-secondary/40"
                        >
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-foreground">{t.titre}</p>
                            {t.description && (
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {t.description}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {societeNom(t.societeId)}
                          </td>
                          {isAdmin && (
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {collabNom(t.assigneId)}
                            </td>
                          )}
                          <td className="px-3 py-2.5">
                            {canMoveForward(t) || canMoveBackward(t) ? (
                              <Select
                                value={t.statut}
                                onValueChange={(v) =>
                                  setTacheStatut(t.id, v as TacheStatut)
                                }
                              >
                                <SelectTrigger className="h-8 w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COLUMNS.filter(
                                    (c) =>
                                      canMoveBackward(t) ||
                                      ORDER.indexOf(c) >= ORDER.indexOf(t.statut),
                                  ).map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {TACHE_STATUT_LABELS[c]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">
                                {TACHE_STATUT_LABELS[t.statut]}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {formatRelative(t.creeLe)}
                          </td>
                          {isAdmin && (
                            <td className="px-3 py-2.5">
                              <div className="flex gap-0.5">
                                <button
                                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  onClick={() => {
                                    setEditing(t);
                                    setFormOpen(true);
                                  }}
                                  title="Modifier"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setToDelete(t)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td
                            colSpan={isAdmin ? 6 : 4}
                            className="px-3 py-10 text-center text-sm text-muted-foreground"
                          >
                            Aucune tâche ne correspond aux filtres.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </LedgerSheet>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <TacheFormSheet
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) setEditing(null);
          }}
          tache={editing}
          defaultSocieteId={societeFilter !== ALL ? societeFilter : null}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette tâche ?"
        description={
          <>
            La tâche{" "}
            <span className="font-medium text-foreground">
              {toDelete?.titre}
            </span>{" "}
            sera définitivement supprimée.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) deleteTache(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
