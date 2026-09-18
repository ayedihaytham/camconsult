import { Clock } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { formatRelative } from "@/lib/utils";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskAssignee } from "./TaskAssignee";
import { TaskCompanyBadge } from "./TaskCompanyBadge";
import { compareTaskStatuses } from "./taskSorting";
import { TaskStatusBadge } from "./TaskStatusBadge";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

export function createTaskTableColumns(
  actions: TaskPresentationActions,
): ColumnDef<PresentedTask, unknown>[] {
  return [
    {
      id: "task",
      accessorFn: (row) => row.task.titre,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tâche" />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p
            className="truncate font-semibold leading-snug text-foreground"
            title={row.original.task.titre}
          >
            {row.original.task.titre}
          </p>
          {row.original.task.description && (
            <p
              className="mt-0.5 hidden truncate text-xs leading-snug text-muted-foreground lg:block"
              title={row.original.task.description}
            >
              {row.original.task.description}
            </p>
          )}
        </div>
      ),
      enableHiding: false,
      sortingFn: (left, right) =>
        left.original.task.titre.localeCompare(
          right.original.task.titre,
          "fr",
        ),
      meta: {
        cellClassName: "w-[34%]",
        headerClassName: "w-[34%]",
        label: "Tâche",
      },
    },
    {
      id: "company",
      accessorFn: (row) => row.societeName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Société" />
      ),
      cell: ({ row }) => (
        <TaskCompanyBadge name={row.original.societeName} />
      ),
      sortingFn: (left, right) =>
        left.original.societeName.localeCompare(
          right.original.societeName,
          "fr",
        ),
      meta: {
        cellClassName: "w-[17%]",
        headerClassName: "w-[17%]",
        label: "Société",
      },
    },
    {
      id: "assignee",
      accessorFn: (row) => row.assigneeName,
      header: "Assigné à",
      cell: ({ row }) => (
        <div className="min-w-0">
          <TaskAssignee task={row.original} />
        </div>
      ),
      enableSorting: false,
      meta: {
        cellClassName: "w-[20%]",
        headerClassName: "w-[20%]",
        label: "Assigné à",
      },
    },
    {
      id: "status",
      accessorFn: (row) => row.task.statut,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Statut" />
      ),
      cell: ({ row }) => <TaskStatusBadge status={row.original.task.statut} />,
      sortingFn: (left, right) =>
        compareTaskStatuses(
          left.original.task.statut,
          right.original.task.statut,
        ),
      meta: {
        cellClassName: "w-[11%]",
        headerClassName: "w-[11%]",
        label: "Statut",
      },
    },
    {
      id: "updatedAt",
      accessorFn: (row) => row.task.termineLe ?? row.task.majLe,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mise à jour" />
      ),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatRelative(
            row.original.task.termineLe ?? row.original.task.majLe,
          )}
        </span>
      ),
      sortingFn: (left, right) =>
        new Date(
          left.original.task.termineLe ?? left.original.task.majLe,
        ).getTime() -
        new Date(
          right.original.task.termineLe ?? right.original.task.majLe,
        ).getTime(),
      meta: {
        cellClassName: "hidden w-[14%] lg:table-cell",
        headerClassName: "hidden w-[14%] lg:table-cell",
        label: "Mise à jour",
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <TaskActionsMenu
          task={row.original.task}
          canManage={actions.canManage}
          canChangeStatus={actions.canChangeStatus}
          onStatusChange={actions.onStatusChange}
          onEdit={actions.onEdit}
          onDelete={actions.onDelete}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      size: 40,
      meta: {
        cellClassName: "w-12 text-right",
        headerClassName: "w-12",
        label: "Actions",
      },
    },
  ];
}
