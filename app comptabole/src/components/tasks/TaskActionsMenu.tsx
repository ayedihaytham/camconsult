import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const availableStatuses = STATUSES.filter(
    (status) => status !== task.statut && canChangeStatus(task, status),
  );

  if (!canManage && availableStatuses.length === 0) return null;

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
        {canManage && availableStatuses.length > 0 && <DropdownMenuSeparator />}
        {canManage && (
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
