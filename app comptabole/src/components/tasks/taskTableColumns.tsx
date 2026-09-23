import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskActivity } from "./TaskActivity";
import { TaskAssignee } from "./TaskAssignee";
import { compareTaskStatuses } from "./taskSorting";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { getTaskActivityDate } from "./taskTypes";
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
      cell: ({ row }) => <span className="block truncate text-xs text-foreground/75" title={row.original.societeName}>{row.original.societeName}</span>,
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
      accessorFn: (row) => getTaskActivityDate(row.task),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Activité" />
      ),
      cell: ({ row }) => <TaskActivity task={row.original.task} />,
      sortingFn: (left, right) =>
        new Date(getTaskActivityDate(left.original.task)).getTime() -
        new Date(getTaskActivityDate(right.original.task)).getTime(),
      meta: {
        cellClassName: "hidden w-[14%] lg:table-cell",
        headerClassName: "hidden w-[14%] lg:table-cell",
        label: "Activité",
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
          isPending={actions.pendingTaskIds.has(row.original.task.id)}
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
