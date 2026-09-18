"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  Columns3,
  Filter,
  List,
  Plus,
  Search,
  Table2,
} from "lucide-react";
import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { useDataTable } from "@/components/data-table/useDataTable";
import { TaskActionsMenu } from "@/components/tasks/TaskActionsMenu";
import { TaskAssignee } from "@/components/tasks/TaskAssignee";
import { TaskCompanyBadge } from "@/components/tasks/TaskCompanyBadge";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskTableView } from "@/components/tasks/TaskTableView";
import { createTaskTableColumns } from "@/components/tasks/taskTableColumns";
import { presentTasks } from "@/components/tasks/taskTypes";
import type { PresentedTask } from "@/components/tasks/taskTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatRelative } from "@/lib/utils";
import type { Employe, Societe, Tache, TacheStatut } from "@/types";

type Column = {
  id: TacheStatut;
  title: string;
};

type TasksView = "board" | "list" | "table";

const COLUMNS: Column[] = [
  { id: "a_faire", title: "À faire" },
  { id: "en_cours", title: "En cours" },
  { id: "termine", title: "Terminé" },
];

interface TasksKanbanProps {
  tasks: Tache[];
  hasAnyTasks: boolean;
  activeFilterCount: number;
  societes: Societe[];
  collaborateurs: Employe[];
  collaboratorPresence: ReadonlyMap<string, boolean>;
  description: string;
  canManage: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onCreate: () => void;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
  filterControls: ReactNode;
  filterKey: string;
}

export function TasksKanban({
  tasks,
  hasAnyTasks,
  activeFilterCount,
  societes,
  collaborateurs,
  collaboratorPresence,
  description,
  canManage,
  canChangeStatus,
  onStatusChange,
  onCreate,
  onEdit,
  onDelete,
  filterControls,
  filterKey,
}: TasksKanbanProps) {
  const isMobile = useIsMobile();
  const [activeTask, setActiveTask] = useState<PresentedTask | null>(null);
  const [view, setView] = useState<TasksView>("board");
  const activeView: TasksView = isMobile ? "table" : view;
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, TacheStatut>
  >({});
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    setStatusOverrides((current) => {
      let changed = false;
      const next = { ...current };

      Object.entries(current).forEach(([taskId, status]) => {
        const task = tasks.find((candidate) => candidate.id === taskId);
        if (!task || task.statut === status) {
          delete next[taskId];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [tasks]);

  const presentedTasks = useMemo(() => {
    const societesById = new Map(
      societes.map((societe) => [societe.id, societe.raisonSociale]),
    );
    return presentTasks({
      tasks,
      societesById,
      collaborateurs,
      collaboratorPresence,
      statusOverrides,
    });
  }, [
    collaboratorPresence,
    collaborateurs,
    societes,
    statusOverrides,
    tasks,
  ]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("fr");
    if (!query) return presentedTasks;

    return presentedTasks.filter(({ task, societeName, assigneeName }) =>
      [task.titre, task.description, societeName, assigneeName].some((value) =>
        value.toLocaleLowerCase("fr").includes(query),
      ),
    );
  }, [presentedTasks, searchQuery]);

  function clearStatusOverride(taskId: string) {
    setStatusOverrides((current) => {
      if (!(taskId in current)) return current;
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }

  function statusFromOver(event: DragOverEvent | DragEndEvent) {
    const over = event.over;
    if (!over) return null;
    if (over.data.current?.type === "Column") {
      return over.id as TacheStatut;
    }
    if (over.data.current?.type === "Task") {
      return (over.data.current.task as PresentedTask).columnId;
    }
    return null;
  }

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type !== "Task") return;
    setActiveTask(event.active.data.current.task as PresentedTask);
  }

  function onDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type !== "Task") return;
    if (event.over?.id === event.active.id) return;

    const presented = event.active.data.current.task as PresentedTask;
    const destination = statusFromOver(event);
    if (!destination) return;

    if (destination === presented.task.statut) {
      clearStatusOverride(presented.task.id);
      return;
    }

    if (!canChangeStatus(presented.task, destination)) {
      clearStatusOverride(presented.task.id);
      return;
    }

    setStatusOverrides((current) => ({
      ...current,
      [presented.task.id]: destination,
    }));
  }

  async function changeTaskStatus(task: Tache, status: TacheStatut) {
    if (status === task.statut || !canChangeStatus(task, status)) {
      clearStatusOverride(task.id);
      return;
    }

    setStatusOverrides((current) => ({ ...current, [task.id]: status }));
    setPendingTaskIds((current) => new Set(current).add(task.id));

    try {
      await onStatusChange(task, status);
    } catch {
      clearStatusOverride(task.id);
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const presented =
      event.active.data.current?.type === "Task"
        ? (event.active.data.current.task as PresentedTask)
        : null;
    const destination = presented
      ? (statusOverrides[presented.task.id] ?? statusFromOver(event))
      : null;

    setActiveTask(null);

    if (!presented || !destination) {
      if (presented) clearStatusOverride(presented.task.id);
      return;
    }

    void changeTaskStatus(presented.task, destination);
  }

  function onDragCancel(_event: DragCancelEvent) {
    if (activeTask) clearStatusOverride(activeTask.task.id);
    setActiveTask(null);
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };
  const emptyMessage = hasAnyTasks
    ? "Aucune tâche ne correspond à vos filtres."
    : "Aucune tâche pour le moment.";
  const taskActions = {
    canManage,
    canChangeStatus,
    pendingTaskIds,
    onStatusChange: changeTaskStatus,
    onEdit,
    onDelete,
  };
  const taskTable = useDataTable({
    columns: createTaskTableColumns(taskActions),
    data: filteredTasks,
    getRowId: (task) => task.task.id,
    resetKey: `${filterKey}\u0000${searchQuery}`,
  });
  const createTaskButton = canManage ? (
    <Button
      type="button"
      className={cn(
        "h-9 shadow-none",
        activeView === "table"
          ? "w-9 shrink-0 px-0 sm:w-auto sm:px-4"
          : "w-full sm:w-auto",
      )}
      onClick={onCreate}
      aria-label="Nouvelle tâche"
    >
      <Plus className="h-4 w-4" />
      <span className={cn(activeView === "table" && "hidden sm:inline")}>
        Nouvelle tâche
      </span>
    </Button>
  ) : null;

  return (
    <div
      className={cn(
        "flex min-h-full min-w-0 flex-col overflow-hidden font-sans",
        activeView === "table"
          ? "tasks-table-workspace gap-2 p-3 sm:p-4"
          : "mx-auto w-full gap-5 px-8 py-10 sm:px-10 sm:py-12 lg:max-w-[1464px] lg:px-14",
      )}
    >
      <div
        className={cn(
          activeView === "table" && "flex items-start justify-between gap-3",
        )}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tâches
          </h1>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {activeView === "table" && createTaskButton}
      </div>

      <DataTableToolbar
        compact={activeView === "table"}
        table={taskTable}
        showViewOptions={activeView === "table"}
        primaryAction={activeView === "table" ? null : createTaskButton}
        trailing={
          activeView === "table" ? (
            <>
              <DataTablePagination
                table={taskTable}
                itemLabel="tâches"
                variant="metadata"
                className="hidden lg:block"
              />
              <DataTablePagination
                table={taskTable}
                itemLabel="tâches"
                variant="controls"
              />
            </>
          ) : null
        }
        leading={
          isMobile ? null : (
            <div
              className="hidden w-fit items-center rounded-lg border border-border bg-muted p-0.5 lg:inline-flex"
              role="group"
              aria-label="Mode d'affichage des tâches"
            >
              {(
                [
                  { value: "board", label: "Board", icon: Columns3 },
                  { value: "list", label: "Liste", icon: List },
                  { value: "table", label: "Table", icon: Table2 },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 rounded-md px-2.5 shadow-none",
                    view === value
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          )
        }
      >
          <div
            className={cn(
              "relative min-w-0 flex-1 sm:flex-none",
              activeView === "table" && "w-full",
              activeView === "table" ? "sm:w-56 lg:w-64" : "sm:w-[240px]",
            )}
          >
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une tâche..."
              aria-label="Rechercher une tâche"
              className="h-9 w-full bg-card pl-9 shadow-none"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-full shadow-none sm:w-auto",
              filtersOpen && "bg-muted",
            )}
            aria-label={`Afficher les filtres${activeFilterCount > 0 ? ` (${activeFilterCount} actifs)` : ""}`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Filter className="h-4 w-4" />
            Filtres
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
      </DataTableToolbar>

      {filtersOpen && (
        <div className="rounded-xl border border-border bg-card p-4">
          {filterControls}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <TasksEmptyState message={emptyMessage} />
      ) : activeView === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-3">
            {COLUMNS.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={filteredTasks.filter(
                  (task) => task.columnId === column.id,
                )}
                canManage={canManage}
                canChangeStatus={canChangeStatus}
                pendingTaskIds={pendingTaskIds}
                onStatusChange={changeTaskStatus}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={dropAnimation}>
            {activeTask && (
              <TaskCard
                task={activeTask}
                canManage={canManage}
                canChangeStatus={canChangeStatus}
                isPending={pendingTaskIds.has(activeTask.task.id)}
                onStatusChange={changeTaskStatus}
                onEdit={onEdit}
                onDelete={onDelete}
                isOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      ) : null}

      {filteredTasks.length > 0 && activeView === "list" && (
        <TaskListView
          table={taskTable}
          emptyMessage={emptyMessage}
          {...taskActions}
        />
      )}

      {filteredTasks.length > 0 && activeView === "table" && (
        <TaskTableView
          table={taskTable}
          emptyMessage={emptyMessage}
          {...taskActions}
        />
      )}
    </div>
  );
}

function TasksEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{message}</p>
    </div>
  );
}

interface BoardColumnProps {
  column: Column;
  tasks: PresentedTask[];
  canManage: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  pendingTaskIds: Set<string>;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
}

function BoardColumn({ column, tasks, ...taskActions }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });
  const taskIds = useMemo(() => tasks.map((task) => task.task.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-[320px] min-w-[320px] flex-col overflow-hidden rounded-xl border border-border/50 bg-muted/40 lg:min-w-[300px] lg:flex-1",
        isOver && "border-primary/30 bg-muted/60",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {column.title}
          </h2>
          <Badge
            variant="secondary"
            className="h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums"
          >
            {tasks.length}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.task.id}
              task={task}
              canManage={taskActions.canManage}
              canChangeStatus={taskActions.canChangeStatus}
              isPending={taskActions.pendingTaskIds.has(task.task.id)}
              onStatusChange={taskActions.onStatusChange}
              onEdit={taskActions.onEdit}
              onDelete={taskActions.onDelete}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aucune tâche
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: PresentedTask;
  canManage: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  isPending: boolean;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
  isOverlay?: boolean;
}

function TaskCard({
  task,
  canManage,
  canChangeStatus,
  isPending,
  onStatusChange,
  onEdit,
  onDelete,
  isOverlay,
}: TaskCardProps) {
  const canDrag =
    !isPending &&
    COLUMNS.some(
      (column) =>
        column.id !== task.task.statut && canChangeStatus(task.task, column.id),
    );
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.task.id,
    data: {
      type: "Task",
      task,
    },
    disabled: !canDrag || isOverlay,
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };
  const displayDate = task.task.termineLe ?? task.task.majLe;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-border hover:shadow-sm",
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging && "opacity-30",
        isPending && "pointer-events-none opacity-70",
        isOverlay &&
          "z-50 rotate-2 scale-[1.02] cursor-grabbing bg-card opacity-100 shadow-xl",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <TaskCompanyBadge name={task.societeName} className="max-w-[250px]" />
        {!isOverlay && (
          <TaskActionsMenu
            task={task.task}
            canManage={canManage}
            canChangeStatus={canChangeStatus}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {task.task.titre}
        </p>
        {task.task.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {task.task.description}
          </p>
        )}
      </div>

      <TaskAssignee task={task} />

      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <TaskStatusBadge status={task.task.statut} />
        <div className="flex min-w-0 items-center gap-2">
          <Clock className="h-3 w-3" />
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatRelative(displayDate)}
          </span>
        </div>
      </div>
    </div>
  );
}
