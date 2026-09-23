import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { TasksKanban } from "@/components/uitripled/kanban-board-shadcnui";
import { summarizeTasks } from "@/components/tasks/taskTypes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import {
  useCollaborateurs,
  useConversations,
  useData,
  useSocietes,
  useTaches,
} from "@/store/data";
import { TACHE_STATUT_LABELS } from "@/types";
import type { Tache, TacheStatut } from "@/types";
import { TacheFormSheet } from "./TacheFormSheet";

const ALL = "all";
const STATUS_ORDER: TacheStatut[] = ["a_faire", "en_cours", "termine"];

export function TachesPage() {
  const { isAdmin, employeId } = usePermissions();
  const taches = useTaches();
  const societes = useSocietes();
  const collaborateurs = useCollaborateurs();
  const conversations = useConversations(isAdmin ? "me" : (employeId ?? "me"));
  const addTache = useData((state) => state.addTache);
  const updateTache = useData((state) => state.updateTache);
  const setTacheStatut = useData((state) => state.setTacheStatut);
  const deleteTache = useData((state) => state.deleteTache);

  const [societeFilter, setSocieteFilter] = useState(ALL);
  const [assigneFilter, setAssigneFilter] = useState(ALL);
  const [statutFilter, setStatutFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tache | null>(null);
  const [toDelete, setToDelete] = useState<Tache | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const summary = useMemo(() => summarizeTasks(taches), [taches]);

  const collaboratorPresence = useMemo(
    () =>
      new Map(
        conversations.flatMap((conversation) =>
          conversation.type === "direct" && conversation.employeId
            ? [[conversation.employeId, conversation.enLigne] as const]
            : [],
        ),
      ),
    [conversations],
  );

  const filteredTasks = useMemo(() => {
    return taches.filter((task) => {
      if (societeFilter !== ALL && task.societeId !== societeFilter) {
        return false;
      }
      if (isAdmin && assigneFilter !== ALL) {
        const matchesAssignee = assigneFilter === "none"
          ? !task.assigneId
          : task.assigneId === assigneFilter;
        if (!matchesAssignee) return false;
      }
      return statutFilter === ALL || task.statut === statutFilter;
    });
  }, [assigneFilter, isAdmin, societeFilter, statutFilter, taches]);

  function canChangeStatus(task: Tache, status: TacheStatut) {
    if (status === task.statut) return true;
    if (isAdmin) return true;
    return (
      task.assigneId === employeId &&
      STATUS_ORDER.indexOf(status) > STATUS_ORDER.indexOf(task.statut)
    );
  }

  async function handleStatusChange(task: Tache, status: TacheStatut) {
    if (!canChangeStatus(task, status) || status === task.statut) return;
    await setTacheStatut(task.id, status);
  }

  async function handleSubmit(values: {
    titre: string;
    description: string;
    societeId: string;
    assigneId: string | null;
  }) {
    if (editing) {
      await updateTache(editing.id, values);
      toast.success("Tâche modifiée", { description: values.titre });
    } else {
      await addTache(values);
      toast.success("Tâche créée", { description: values.titre });
    }
  }

  async function handleDelete() {
    if (!toDelete || deletePending) return;
    setDeletePending(true);
    try {
      await deleteTache(toDelete.id);
      toast.success("Tâche supprimée", { description: toDelete.titre });
      setToDelete(null);
    } catch {
      // The store shows the API error; keep the confirmation and task visible.
    } finally {
      setDeletePending(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(task: Tache) {
    setEditing(task);
    setFormOpen(true);
  }

  return (
    <div className={cn("min-w-0", isAdmin && !formOpen && "ledger-fab-clearance lg:pb-0")}>
      <TasksKanban
        tasks={filteredTasks}
        hasAnyTasks={taches.length > 0}
        activeFilterCount={
          (societeFilter !== ALL ? 1 : 0) +
          (isAdmin && assigneFilter !== ALL ? 1 : 0) +
          (statutFilter !== ALL ? 1 : 0)
        }
        societes={societes}
        collaborateurs={collaborateurs}
        collaboratorPresence={collaboratorPresence}
        description={
          isAdmin
            ? "Travail confié aux collaborateurs, par société. Suivez l'avancement."
            : "Votre travail à faire. Faites avancer chaque tâche jusqu'à « Terminé »."
        }
        summary={summary}
        canManage={isAdmin}
        canChangeStatus={canChangeStatus}
        onStatusChange={handleStatusChange}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={setToDelete}
        filterKey={`${societeFilter}:${assigneFilter}:${statutFilter}`}
        onResetFilters={() => {
          setSocieteFilter(ALL);
          setAssigneFilter(ALL);
          setStatutFilter(ALL);
        }}
        filterControls={
          <div className="grid gap-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Société</p>
              <Select value={societeFilter} onValueChange={setSocieteFilter}>
                <SelectTrigger aria-label="Filtrer par société">
                  <SelectValue placeholder="Société" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Toutes les sociétés</SelectItem>
                  {societes.map((societe) => (
                    <SelectItem key={societe.id} value={societe.id}>
                      {societe.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

              {isAdmin && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Collaborateur</p>
                  <Select value={assigneFilter} onValueChange={setAssigneFilter}>
                    <SelectTrigger aria-label="Filtrer par collaborateur">
                      <SelectValue placeholder="Collaborateur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les collaborateurs</SelectItem>
                      <SelectItem value="none">Non assignées</SelectItem>
                      {collaborateurs.map((collaborateur) => (
                        <SelectItem key={collaborateur.id} value={collaborateur.id}>
                          {collaborateur.prenom} {collaborateur.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Statut</p>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger aria-label="Filtrer par statut">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les statuts</SelectItem>
                  {STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TACHE_STATUT_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      {isAdmin && (
        <TacheFormSheet
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditing(null);
          }}
          tache={editing}
          defaultSocieteId={societeFilter !== ALL ? societeFilter : null}
          onSubmit={handleSubmit}
        />
      )}

      {isAdmin && !formOpen && (
        <OperationalFab label="Créer une tâche" onClick={openCreate} />
      )}

      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => {
          if (!open && !deletePending) setToDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette tâche ?</DialogTitle>
            <DialogDescription>
              La tâche <span className="font-medium text-foreground">{toDelete?.titre}</span> sera définitivement supprimée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deletePending} onClick={() => setToDelete(null)}>Annuler</Button>
            <Button type="button" variant="destructive" disabled={deletePending} onClick={() => void handleDelete()}>
              {deletePending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
