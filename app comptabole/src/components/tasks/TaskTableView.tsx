import type { Table } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { TaskTableMobileCard } from "./TaskTableMobileCard";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

export function TaskTableView({
  table,
  emptyMessage,
  ...actions
}: TaskPresentationActions & {
  table: Table<PresentedTask>;
  emptyMessage: string;
}) {
  return (
    <DataTable
      table={table}
      emptyMessage={emptyMessage}
      getRowClassName={(row) =>
        actions.pendingTaskIds.has(row.original.task.id)
          ? "opacity-70"
          : undefined
      }
      mobileRow={(row) => (
        <TaskTableMobileCard row={row} actions={actions} />
      )}
      mobileFooter={
        <DataTablePagination
          table={table}
          itemLabel="tâches"
          variant="mobile"
        />
      }
    />
  );
}
