import { Activity, Database, FilePlus2, LogIn, Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { JournalAction, JournalEntry } from "@/store/journal";
import { formatRelative } from "@/lib/utils";

const ACTION_ICONS: Partial<Record<JournalAction, typeof Activity>> = {
  creation: FilePlus2,
  modification: Pencil,
  suppression: Trash2,
  connexion: LogIn,
  import: Database,
};

export function JournalActivity({ entries }: { entries: JournalEntry[] }) {
  if (entries.length === 0) return <DashboardEmptyState icon={Activity} title="Aucune activité journalisée" />;
  return (
    <ul>
      {entries.map((entry, index) => {
        const Icon = ACTION_ICONS[entry.action] ?? Activity;
        return (
          <li key={entry.id}>
            {index > 0 && <Separator />}
            <div className="flex min-w-0 items-center gap-3 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{entry.actor}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{entry.label}</p>
              </div>
              <time dateTime={entry.at} className="shrink-0 text-[0.68rem] text-muted-foreground">
                {formatRelative(entry.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
