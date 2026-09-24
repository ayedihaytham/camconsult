import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/usePermissions";
import { TACHE_STATUT_LABELS } from "@/types";
import type { Tache, TacheStatut } from "@/types";

const STATUSES: TacheStatut[] = ["a_faire", "en_cours", "termine"];

export function TaskActionsMenu({
  task,
  canManage,
  canChangeStatus,
  onStatusChange,
  onEdit,
  onDelete,
  isPending = false,
}: {
  task: Tache;
  canManage: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
  isPending?: boolean;
}) {
  const { isResponsableSociete } = usePermissions();
  // Chaque circuit n'est géré que par son côté : le cabinet ne modifie pas
  // les tâches internes d'une société (lecture seule), et inversement.
  const manageable =
    canManage && (task.origine === "societe") === isResponsableSociete;
  const availableStatuses = STATUSES.filter(
    (status) => status !== task.statut && canChangeStatus(task, status),
  );

  if (!manageable && availableStatuses.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground opacity-60 shadow-none transition-opacity hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Actions pour ${task.titre}`}
          disabled={isPending}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableStatuses.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => void onStatusChange(task, status)}
          >
            Passer à « {TACHE_STATUT_LABELS[status]} »
          </DropdownMenuItem>
        ))}
        {manageable && availableStatuses.length > 0 && <DropdownMenuSeparator />}
        {manageable && (
          <>
            <DropdownMenuItem onSelect={() => onEdit(task)}>
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(task)}
            >
              Supprimer
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
