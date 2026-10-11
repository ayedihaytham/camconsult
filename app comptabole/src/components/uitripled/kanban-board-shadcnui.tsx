"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { CalendarDays, ChartNoAxesGantt, Columns3, GripVertical, List, ListChecks } from "lucide-react";
import { useDataTable } from "@/components/data-table/useDataTable";
import { useOperationalPageSize } from "@/components/data-table/useOperationalPageSize";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerPage,
  OperationalLedgerToolbar,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { TaskActionsMenu } from "@/components/tasks/TaskActionsMenu";
import { TaskAssignee } from "@/components/tasks/TaskAssignee";
import { TaskActivity } from "@/components/tasks/TaskActivity";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskTableView } from "@/components/tasks/TaskTableView";
import { TaskGanttView } from "@/components/tasks/TaskGanttView";
import { TaskNextAction } from "@/components/tasks/TaskNextAction";
import { createTaskTableColumns } from "@/components/tasks/taskTableColumns";
import { presentTasks } from "@/components/tasks/taskTypes";
import type { PresentedTask } from "@/components/tasks/taskTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import "@/components/tasks/tasks-views.css";
import type { Employe, Societe, Tache, TacheStatut } from "@/types";

type Column = {
  id: TacheStatut;
  title: string;
};

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
  canEditTask: (task: Tache) => boolean;
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
  canEditTask,
  canChangeStatus,
  onStatusChange,
  onCreate,
  onEdit,
  onDelete,
  filterControls,
  filterKey,
  onResetFilters,
}: TasksKanbanProps) {
  const [activeTask, setActiveTask] = useState<PresentedTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"kanban" | "list" | "gantt">(() => typeof window !== "undefined" && window.innerWidth < 1024 ? "list" : "kanban");
  const [mobileStatus, setMobileStatus] = useState<TacheStatut>("a_faire");
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, TacheStatut>
  >({});
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const pendingRef = useRef(new Set<string>());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
  const mobileColumn = filteredTasks.some((item) => item.columnId === mobileStatus) ? mobileStatus : filteredTasks[0]?.columnId ?? mobileStatus;

  function clearStatusOverride(taskId: string) {
    setStatusOverrides((current) => {
      if (!(taskId in current)) return current;
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }

  function statusFromOver(event: Pick<DragOverEvent, "over">) {
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
    if (
      pendingRef.current.has(task.id) ||
      status === task.statut ||
      !canChangeStatus(task, status)
    ) {
      clearStatusOverride(task.id);
      return;
    }

    setStatusOverrides((current) => ({ ...current, [task.id]: status }));
    pendingRef.current.add(task.id);
    setPendingTaskIds((current) => new Set(current).add(task.id));

    try {
      await onStatusChange(task, status);
    } catch {
      clearStatusOverride(task.id);
    } finally {
      pendingRef.current.delete(task.id);
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
    canEditTask,
    canChangeStatus,
    pendingTaskIds,
    onStatusChange: changeTaskStatus,
    onEdit,
    onDelete,
  };
  const taskPageSize = useOperationalPageSize(10);
  const taskTable = useDataTable({
    columns: createTaskTableColumns(taskActions),
    data: filteredTasks,
    getRowId: (task) => task.task.id,
    pageSize: taskPageSize,
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

  const kanbanBoard = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ screenReaderInstructions: { draggable: "Appuyez sur Espace pour déplacer la tâche, puis utilisez les flèches. Espace confirme, Échap annule." }, announcements: {
        onDragStart: ({ active }) => `Déplacement de ${(active.data.current?.task as PresentedTask | undefined)?.task.titre ?? "la tâche"}.`,
        onDragOver: (event) => { const destination = statusFromOver(event); return destination ? `Colonne ${COLUMNS.find((column) => column.id === destination)?.title}.` : undefined; },
        onDragEnd: () => "Déplacement terminé.",
        onDragCancel: () => "Déplacement annulé.",
      } }}
    >
      <OperationalContentHeader>
        <h2 className="text-sm font-semibold text-foreground">Tableau Kanban</h2>
        <p className="hidden text-xs text-muted-foreground lg:block">Déplacez une tâche par sa poignée ou utilisez ses actions.</p>
      </OperationalContentHeader>
      <div className="task-kanban-mobile-status" role="group" aria-label="Colonne du Kanban">{COLUMNS.map((column) => { const count = filteredTasks.filter((task) => task.columnId === column.id).length; return <Button key={column.id} type="button" variant="ghost" aria-pressed={mobileColumn === column.id} disabled={count === 0} onClick={() => setMobileStatus(column.id)}>{column.title}<span>{count}</span></Button>; })}</div>
      <div className="task-kanban-board">
        {COLUMNS.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={filteredTasks.filter((task) => task.columnId === column.id)}
            visibleOnMobile={column.id === mobileColumn}
            canManage={canManage}
            canEditTask={canEditTask}
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
            canEditTask={canEditTask}
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
  );

  return (
    <OperationalLedgerPage className="taches-work-ledger font-sans">
      <SignatureLedgerBanner
        icon={ListChecks}
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
        action={
          canManage ? { label: "Nouvelle tâche", onClick: onCreate } : undefined
        }
      />

      <LedgerWorkSurface className="taches-work-surface flex min-w-0 flex-col">
        <OperationalLedgerToolbar
          label="Outils des tâches"
          search={renderSearchFilter("max-w-none")}
          resultCount={`${filteredTasks.length} tâches`}
        />
        <OperationalMobileUtility label="Recherche et filtres des tâches">
          {renderSearchFilter()}
        </OperationalMobileUtility>
        <div className="task-views-toolbar" data-tour="tasks-views"><div className="task-view-options" role="group" aria-label="Vue des tâches">{([{ id: "kanban", label: "Kanban", icon: Columns3 }, { id: "list", label: "Liste", icon: List }, { id: "gantt", label: "Gantt", icon: ChartNoAxesGantt }] as const).map(({ id, label, icon: Icon }) => <Button key={id} type="button" variant="ghost" className="h-10 px-3 text-xs" aria-pressed={view === id} onClick={() => { setView(id); setActiveTask(null); }}><Icon className="size-4" aria-hidden="true" />{label}</Button>)}</div><span className="text-xs tabular-nums text-muted-foreground">{filteredTasks.length} tâche{filteredTasks.length > 1 ? "s" : ""}</span></div>
        <div data-tour="tasks-board" className="min-w-0">
          {filteredTasks.length === 0 ? <TasksEmptyState message={emptyMessage} /> : view === "gantt" ? <TaskGanttView tasks={filteredTasks} {...taskActions} /> : view === "list" ? <TaskTableView table={taskTable} emptyMessage={emptyMessage} {...taskActions} /> : kanbanBoard}
        </div>
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
  canEditTask: (task: Tache) => boolean;
  visibleOnMobile: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  pendingTaskIds: Set<string>;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
}

function BoardColumn({ column, tasks, visibleOnMobile, ...taskActions }: BoardColumnProps) {
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
        "task-board-column",
        !visibleOnMobile && "is-mobile-hidden",
        isOver && "border-primary/35 ring-1 ring-primary/10",
      )}
    >
      <div className="task-board-column-heading">
        <div className="flex items-center gap-2.5">
          <span className={`task-column-dot task-column-dot--${column.id}`} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-primary">
            {column.title}
          </h2>
          <Badge
            variant="secondary"
            className="rounded-md border-0 bg-card px-2 text-xs font-medium tabular-nums text-primary"
          >
            {tasks.length}
          </Badge>
        </div>
      </div>

      <div className="task-board-column-body">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.task.id}
              task={task}
              canManage={taskActions.canManage}
              canEditTask={taskActions.canEditTask}
              canChangeStatus={taskActions.canChangeStatus}
              isPending={taskActions.pendingTaskIds.has(task.task.id)}
              onStatusChange={taskActions.onStatusChange}
              onEdit={taskActions.onEdit}
              onDelete={taskActions.onDelete}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="px-3 py-8 text-center text-base text-muted-foreground">
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
  canEditTask: (task: Tache) => boolean;
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
  canEditTask,
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
      className={cn(
        "task-kanban-card",
        isDragging && "opacity-30",
        isPending && "pointer-events-none opacity-70",
        isOverlay && "z-50 cursor-grabbing bg-card opacity-100 shadow-pop",
      )}
    >
      <div className="flex items-center gap-2">
        {canDrag && !isOverlay && <button type="button" {...attributes} {...listeners} aria-label={`Déplacer la tâche : ${task.task.titre}`} className="task-drag-handle"><GripVertical className="size-4" aria-hidden="true" /></button>}
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={task.societeName}>{task.societeName}</span>
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
        {canEditTask(task.task) && !isOverlay ? <button type="button" className="task-card-title text-left" onClick={() => onEdit(task.task)} disabled={isPending}>{task.task.titre}</button> : <p className="task-card-title">{task.task.titre}</p>}
        {task.task.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground" title={task.task.description}>
            {task.task.description}
          </p>
        )}
      </div>

      <TaskAssignee task={task} />
      {task.task.origine === "societe" && !canEditTask(task.task) && <p className="text-[11px] text-muted-foreground">Tâche de société{!canDrag ? " · Lecture seule" : ""}</p>}
      <p className="task-card-planning"><CalendarDays className="size-3.5" aria-hidden="true" />{task.task.debutPrevu && task.task.finPrevue ? `${formatDate(task.task.debutPrevu).slice(0, 5)} – ${formatDate(task.task.finPrevue).slice(0, 5)}` : "Non planifiée"}</p>

      <div className="task-card-footer">
        <TaskStatusBadge status={task.columnId} />
        {!isOverlay && <TaskNextAction task={task.task} canChangeStatus={canChangeStatus} onStatusChange={onStatusChange} isPending={isPending} />}
      </div>
      <TaskActivity task={task.task} className="truncate text-[10px]" />
    </div>
  );
}
