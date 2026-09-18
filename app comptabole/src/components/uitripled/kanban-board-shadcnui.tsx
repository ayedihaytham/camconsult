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
  MoreHorizontal,
  Plus,
  Search,
  Table2,
} from "lucide-react";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import {
  paginateTasks,
  TASKS_PAGE_SIZE,
} from "@/components/tasks/taskPagination";
import type { TaskPage } from "@/components/tasks/taskPagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatRelative } from "@/lib/utils";
import { TACHE_STATUT_LABELS } from "@/types";
import type { Employe, Societe, Tache, TacheStatut } from "@/types";

type Column = {
  id: TacheStatut;
  title: string;
};

type TasksView = "board" | "list" | "table";

type PresentedTask = {
  task: Tache;
  columnId: TacheStatut;
  societeName: string;
  assigneeName: string;
  assigneeInitials: string;
  assigneeOnline: boolean | null;
};

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
  const [activeTask, setActiveTask] = useState<PresentedTask | null>(null);
  const [view, setView] = useState<TasksView>("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
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
    const collaborateursById = new Map(
      collaborateurs.map((collaborateur) => [collaborateur.id, collaborateur]),
    );

    return tasks.map((task): PresentedTask => {
      const assignee = task.assigneId
        ? collaborateursById.get(task.assigneId)
        : null;
      const assigneeName = task.assigneId
        ? assignee
          ? `${assignee.prenom} ${assignee.nom}`
          : "Collaborateur retiré"
        : "Non assignée";
      const assigneeInitials = task.assigneId
        ? assigneeName
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "—";

      return {
        task,
        columnId: statusOverrides[task.id] ?? task.statut,
        societeName: societesById.get(task.societeId) ?? "Société supprimée",
        assigneeName,
        assigneeInitials,
        assigneeOnline:
          task.assigneId && assignee
            ? (collaboratorPresence.get(task.assigneId) ?? false)
            : null,
      };
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

  const paginatedTasks = useMemo(
    () => paginateTasks(filteredTasks, page, TASKS_PAGE_SIZE),
    [filteredTasks, page],
  );

  useEffect(() => {
    setPage(1);
  }, [filterKey, searchQuery]);

  useEffect(() => {
    if (page !== paginatedTasks.page) setPage(paginatedTasks.page);
  }, [page, paginatedTasks.page]);

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

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-5 overflow-hidden p-4 font-sans sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tâches
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="inline-flex w-fit items-center rounded-lg border border-border bg-muted p-0.5"
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:w-[240px] sm:flex-none">
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
          {canManage && (
            <Button
              type="button"
              className="h-9 w-full shadow-none sm:w-auto"
              onClick={onCreate}
            >
              <Plus className="h-4 w-4" />
              Nouvelle tâche
            </Button>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="rounded-xl border border-border bg-card p-4">
          {filterControls}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <TasksEmptyState message={emptyMessage} />
      ) : view === "board" ? (
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

      {filteredTasks.length > 0 && view === "list" && (
        <div className="space-y-3">
          <TasksListView
            tasks={paginatedTasks.items}
            canManage={canManage}
            canChangeStatus={canChangeStatus}
            pendingTaskIds={pendingTaskIds}
            onStatusChange={changeTaskStatus}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <TaskPagination
            pagination={paginatedTasks}
            onPageChange={setPage}
          />
        </div>
      )}

      {filteredTasks.length > 0 && view === "table" && (
        <div className="space-y-3">
          <TasksTableView
            tasks={paginatedTasks.items}
            canManage={canManage}
            canChangeStatus={canChangeStatus}
            pendingTaskIds={pendingTaskIds}
            onStatusChange={changeTaskStatus}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <TaskPagination
            pagination={paginatedTasks}
            onPageChange={setPage}
          />
        </div>
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
  const availableStatuses = COLUMNS.filter(
    (column) =>
      column.id !== task.task.statut && canChangeStatus(task.task, column.id),
  );
  const hasActions = canManage || availableStatuses.length > 0;
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
        <Badge
          variant="outline"
          className="max-w-[250px] border-border bg-transparent px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          <span className="truncate">{task.societeName}</span>
        </Badge>
        {hasActions && !isOverlay && (
          <TaskActionsMenu
            task={task.task}
            canManage={canManage}
            availableStatuses={availableStatuses}
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

interface TasksPresentationProps {
  tasks: PresentedTask[];
  canManage: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  pendingTaskIds: Set<string>;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
}

function TaskPagination({
  pagination,
  onPageChange,
}: {
  pagination: TaskPage<PresentedTask>;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        {pagination.firstItem}–{pagination.lastItem} sur {pagination.totalItems}{" "}
        tâches
      </span>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shadow-none"
          disabled={pagination.page === 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Précédent
        </Button>
        <span className="min-w-[88px] text-center font-medium text-foreground">
          Page {pagination.page} sur {pagination.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shadow-none"
          disabled={pagination.page === pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}

function TasksListView({ tasks, ...actions }: TasksPresentationProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {tasks.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Aucune tâche ne correspond à vos filtres.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {tasks.map((task) => {
            const statuses = availableStatuses(
              task.task,
              actions.canChangeStatus,
            );
            const hasActions = actions.canManage || statuses.length > 0;
            const displayDate = task.task.termineLe ?? task.task.majLe;

            return (
              <article
                key={task.task.id}
                className={cn(
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                  actions.pendingTaskIds.has(task.task.id) && "opacity-70",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {task.task.titre}
                  </p>
                  {task.task.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {task.task.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    <Badge
                      variant="outline"
                      className="max-w-full border-border bg-transparent text-[10px] text-muted-foreground"
                    >
                      <span className="truncate">{task.societeName}</span>
                    </Badge>
                    <div className="min-w-0 max-w-full sm:max-w-[200px]">
                      <TaskAssignee task={task} />
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border/60 pt-3 sm:w-auto sm:border-0 sm:pt-0">
                  <TaskStatusBadge status={task.task.statut} />
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatRelative(displayDate)}</span>
                  </div>
                  {hasActions && (
                    <TaskActionsMenu
                      task={task.task}
                      canManage={actions.canManage}
                      availableStatuses={statuses}
                      onStatusChange={actions.onStatusChange}
                      onEdit={actions.onEdit}
                      onDelete={actions.onDelete}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TasksTableView(props: TasksPresentationProps) {
  return (
    <>
      <div className="md:hidden">
        <TasksListView {...props} />
      </div>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <Table>
          <TableHeader className="[&_th]:!h-9 [&_th]:!text-xs [&_th]:!font-semibold [&_th]:!normal-case [&_th]:!tracking-normal">
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Tâche</TableHead>
              <TableHead>Société</TableHead>
              <TableHead>Assigné à</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Mise à jour</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.tasks.map((task) => {
              const statuses = availableStatuses(
                task.task,
                props.canChangeStatus,
              );
              const hasActions = props.canManage || statuses.length > 0;
              const displayDate = task.task.termineLe ?? task.task.majLe;

              return (
                <TableRow
                  key={task.task.id}
                  className={cn(
                    "even:bg-transparent hover:bg-transparent",
                    props.pendingTaskIds.has(task.task.id) && "opacity-70",
                  )}
                >
                  <TableCell className="max-w-[320px]">
                    <p className="truncate font-semibold text-foreground">
                      {task.task.titre}
                    </p>
                    {task.task.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {task.task.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <Badge
                      variant="outline"
                      className="max-w-full border-border bg-transparent text-[10px] text-muted-foreground"
                    >
                      <span className="truncate">{task.societeName}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[190px]">
                    <TaskAssignee task={task} />
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.task.statut} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {formatRelative(displayDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {hasActions && (
                      <TaskActionsMenu
                        task={task.task}
                        canManage={props.canManage}
                        availableStatuses={statuses}
                        onStatusChange={props.onStatusChange}
                        onEdit={props.onEdit}
                        onDelete={props.onDelete}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {props.tasks.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucune tâche ne correspond à vos filtres.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function TaskAssignee({ task }: { task: PresentedTask }) {
  const presenceLabel = task.assigneeOnline ? "En ligne" : "Hors ligne";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative shrink-0">
        <Avatar className="h-7 w-7 border border-border">
          <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
            {task.assigneeInitials}
          </AvatarFallback>
        </Avatar>
        {task.assigneeOnline !== null && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background",
              task.assigneeOnline
                ? "bg-success"
                : "bg-muted-foreground/40",
            )}
            role="img"
            aria-label={presenceLabel}
            title={`${task.assigneeName} — ${presenceLabel}`}
          />
        )}
      </span>
      <span className="truncate text-xs font-medium text-foreground/75">
        {task.assigneeName}
      </span>
    </div>
  );
}

function availableStatuses(
  task: Tache,
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean,
) {
  return COLUMNS.filter(
    (column) => column.id !== task.statut && canChangeStatus(task, column.id),
  );
}

function TaskActionsMenu({
  task,
  canManage,
  availableStatuses,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: Tache;
  canManage: boolean;
  availableStatuses: Column[];
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground opacity-60 shadow-none transition-opacity hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Actions pour ${task.titre}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableStatuses.map((column) => (
          <DropdownMenuItem
            key={column.id}
            onSelect={() => void onStatusChange(task, column.id)}
          >
            Passer à « {TACHE_STATUT_LABELS[column.id]} »
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
