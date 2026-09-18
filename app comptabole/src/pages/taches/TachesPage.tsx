import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TasksKanban } from "@/components/uitripled/kanban-board-shadcnui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCollaborateurs,
  useConversations,
  useData,
  useSocietes,
  useTaches,
} from "@/store/data";
import type { Tache, TacheStatut } from "@/types";
import { TacheFormSheet } from "./TacheFormSheet";

const ALL = "all";
const STATUS_ORDER: TacheStatut[] = ["a_faire", "en_cours", "termine"];

export function TachesPage() {
  const { isAdmin, employeId } = usePermissions();
  const taches = useTaches();
  const societes = useSocietes();
  const collaborateurs = useCollaborateurs();
  const conversations = useConversations(
    isAdmin ? "me" : (employeId ?? "me"),
  );
  const addTache = useData((state) => state.addTache);
  const updateTache = useData((state) => state.updateTache);
  const setTacheStatut = useData((state) => state.setTacheStatut);
  const deleteTache = useData((state) => state.deleteTache);

  const [societeFilter, setSocieteFilter] = useState(ALL);
  const [assigneFilter, setAssigneFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tache | null>(null);
  const [toDelete, setToDelete] = useState<Tache | null>(null);

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
        return assigneFilter === "none"
          ? !task.assigneId
          : task.assigneId === assigneFilter;
      }
      return true;
    });
  }, [assigneFilter, isAdmin, societeFilter, taches]);

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

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(task: Tache) {
    setEditing(task);
    setFormOpen(true);
  }

  return (
    <div className="min-w-0">
      <TasksKanban
        tasks={filteredTasks}
        hasAnyTasks={taches.length > 0}
        activeFilterCount={
          (societeFilter !== ALL ? 1 : 0) +
          (isAdmin && assigneFilter !== ALL ? 1 : 0)
        }
        societes={societes}
        collaborateurs={collaborateurs}
        collaboratorPresence={collaboratorPresence}
        description={
          isAdmin
            ? "Travail confié aux collaborateurs, par société. Suivez l'avancement."
            : "Votre travail à faire. Faites avancer chaque tâche jusqu'à « Terminé »."
        }
        canManage={isAdmin}
        canChangeStatus={canChangeStatus}
        onStatusChange={handleStatusChange}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={setToDelete}
        filterKey={`${societeFilter}:${assigneFilter}`}
        filterControls={
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={societeFilter}
              onValueChange={setSocieteFilter}
            >
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

            {isAdmin && (
              <Select
                value={assigneFilter}
                onValueChange={setAssigneFilter}
              >
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
            )}
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

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
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
