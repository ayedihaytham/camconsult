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
  Columns3,
  List,
  Table2,
} from "lucide-react";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { useDataTable } from "@/components/data-table/useDataTable";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerPage,
  OperationalLedgerToolbar,
  OperationalMobileHeader,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { TaskActionsMenu } from "@/components/tasks/TaskActionsMenu";
import { TaskAssignee } from "@/components/tasks/TaskAssignee";
import { TaskActivity } from "@/components/tasks/TaskActivity";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskTableView } from "@/components/tasks/TaskTableView";
import { createTaskTableColumns } from "@/components/tasks/taskTableColumns";
import { presentTasks } from "@/components/tasks/taskTypes";
import type { PresentedTask } from "@/components/tasks/taskTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Employe, Societe, Tache, TacheStatut } from "@/types";

type Column = {
  id: TacheStatut;
  title: string;
};

type TasksView = "board" | "list" | "table";

const COLUMNS: Column[] = [
  { id: "a_faire", title: "À faire" },
  { id: "en_cours", title: "En cours" },
  { id: "termine", title: "Terminées" },
];

interface TasksKanbanProps {
  tasks: Tache[];
  hasAnyTasks: boolean;
  activeFilterCount: number;
  societes: Societe[];
  collaborateurs: Employe[];
  collaboratorPresence: ReadonlyMap<string, boolean>;
  description: string;
  summary: { open: number; todo: number; doing: number; done: number };
  canManage: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onCreate: () => void;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
  filterControls: ReactNode;
  filterKey: string;
  onResetFilters: () => void;
}

export function TasksKanban({
  tasks,
  hasAnyTasks,
  activeFilterCount,
  societes,
  collaborateurs,
  collaboratorPresence,
  description,
  summary,
  canManage,
  canChangeStatus,
  onStatusChange,
  onCreate,
  onEdit,
  onDelete,
  filterControls,
  filterKey,
  onResetFilters,
}: TasksKanbanProps) {
  const isMobile = useIsMobile();
  const [activeTask, setActiveTask] = useState<PresentedTask | null>(null);
  const [view, setView] = useState<TasksView>("list");
  const activeView: TasksView = isMobile ? "table" : view;
  const [searchQuery, setSearchQuery] = useState("");
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
    if (pendingTaskIds.has(task.id) || status === task.statut || !canChangeStatus(task, status)) {
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

  const renderSearchFilter = (className?: string) => (
    <LedgerSearchFilter
      value={searchQuery}
      onValueChange={setSearchQuery}
      placeholder="Rechercher une tâche..."
      searchLabel="Rechercher une tâche"
      filterLabel="Filtrer les tâches"
      activeFilterCount={activeFilterCount}
      onReset={onResetFilters}
      className={className}
    >
      {filterControls}
    </LedgerSearchFilter>
  );

  const viewTools = (
    <>
      {activeView === "table" && <DataTableViewOptions table={taskTable} />}
      <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5" role="group" aria-label="Mode d'affichage des tâches">
        {([
          { value: "list", label: "Liste", icon: List },
          { value: "table", label: "Table", icon: Table2 },
          { value: "board", label: "Kanban", icon: Columns3 },
        ] as const).map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 rounded px-2.5 text-xs shadow-none",
              view === value ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>
    </>
  );

  return (
    <OperationalLedgerPage className="taches-work-ledger min-h-0 overflow-hidden font-sans lg:min-h-full">
      <SignatureLedgerBanner
        className="operational-signature-banner"
        eyebrow="Clients & travail · Work Ledger"
        title="Tâches"
        description={description}
        metrics={[
          { label: "Ouvertes", value: summary.open },
          { label: "À faire", value: summary.todo },
          { label: "En cours", value: summary.doing },
          { label: "Terminées", value: summary.done },
        ]}
        action={canManage ? { label: "Nouvelle tâche", onClick: onCreate } : undefined}
      />

      <LedgerWorkSurface className="taches-work-surface flex min-h-0 flex-col">
      <OperationalLedgerToolbar
        label="Outils des tâches"
        search={renderSearchFilter("max-w-none")}
        resultCount={`${filteredTasks.length} tâches`}
        tools={viewTools}
      />
      <OperationalMobileUtility label="Recherche et filtres des tâches">
        {renderSearchFilter()}
      </OperationalMobileUtility>

      {filteredTasks.length === 0 ? (
        <>
          <OperationalContentHeader className="hidden lg:flex">
            <h2 className="text-sm font-semibold text-foreground">
              {activeView === "board"
                ? "Flux Kanban"
                : activeView === "table"
                  ? "Vue comparaison"
                  : "File de travail"}
            </h2>
          </OperationalContentHeader>
          <OperationalMobileHeader>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            File de travail
            </h2>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              0 tâches
            </span>
          </OperationalMobileHeader>
          <TasksEmptyState message={emptyMessage} />
        </>
      ) : activeView === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <OperationalContentHeader>
            <h2 className="text-sm font-semibold text-foreground">Flux Kanban</h2>
          </OperationalContentHeader>
          <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto bg-transparent p-2.5">
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
      </LedgerWorkSurface>

    </OperationalLedgerPage>
  );
}

function TasksEmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-center">
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
        "flex h-full w-[285px] min-w-[285px] flex-col overflow-hidden rounded-md border border-border/80 bg-card lg:flex-1",
        isOver && "border-primary/35 ring-1 ring-primary/10",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-foreground">
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

      <div className="flex flex-1 flex-col gap-2 p-2">
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
          <div className="border-t border-border px-3 py-5 text-center text-xs text-muted-foreground">
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
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded border border-border/80 bg-card p-2.5 transition-colors hover:bg-muted/15",
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging && "opacity-30",
        isPending && "pointer-events-none opacity-70",
        isOverlay && "z-50 cursor-grabbing bg-card opacity-100 shadow-pop",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={task.societeName}>{task.societeName}</span>
        {!isOverlay && (
          <TaskActionsMenu
            task={task.task}
            canManage={canManage}
            canChangeStatus={canChangeStatus}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onDelete={onDelete}
            isPending={isPending}
          />
        )}
      </div>

      <div className="space-y-1">
        <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
          {task.task.titre}
        </p>
        {task.task.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {task.task.description}
          </p>
        )}
      </div>

      <TaskAssignee task={task} />

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <TaskStatusBadge status={task.task.statut} />
        <TaskActivity task={task.task} className="truncate text-[11px]" />
      </div>
    </div>
  );
}
