import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardFileActivity } from "@/lib/dashboard/dashboardData";
import { formatRelative } from "@/lib/utils";

export function FilesActivity({ files, onOpen }: { files: DashboardFileActivity[]; onOpen: () => void }) {
  if (files.length === 0) return <DashboardEmptyState icon={FileText} title="Aucun fichier récent" />;
  return (
    <ul>
      {files.map((file, index) => (
        <li key={file.id}>
          {index > 0 && <Separator />}
          <div className="flex min-w-0 items-center gap-3 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                </TooltipTrigger>
                <TooltipContent>{file.name}</TooltipContent>
              </Tooltip>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {file.societeName} · {formatRelative(file.updatedAt)}
              </p>
            </div>
            {file.format && <Badge variant="outline" className="shrink-0 uppercase">{file.format}</Badge>}
            <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label={`Ouvrir ${file.name}`}>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
