import { CheckCircle2, type LucideIcon } from "lucide-react";

interface DashboardEmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export function DashboardEmptyState({ title, description, icon: Icon = CheckCircle2 }: DashboardEmptyStateProps) {
  return (
    <div className="flex items-start gap-3 py-3 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
