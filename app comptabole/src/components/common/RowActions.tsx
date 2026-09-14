import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RowAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-0 whitespace-nowrap">
      {actions.map((action) => (
        <Tooltip key={action.label}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={action.onClick}
              aria-label={action.label}
              className={cn(
                "h-7 w-7 text-muted-foreground hover:text-foreground",
                action.destructive &&
                  "hover:bg-destructive/10 hover:text-destructive",
              )}
            >
              <action.icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{action.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
