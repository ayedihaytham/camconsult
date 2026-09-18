import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  salutation: string;
  description: string;
  dateLabel: string;
  onAddSociete?: () => void;
}

export function DashboardHeader({
  salutation,
  description,
  dateLabel,
  onAddSociete,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{salutation}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
      </div>
      {onAddSociete && (
        <Button onClick={onAddSociete} className="w-full sm:w-auto">
          <Plus aria-hidden="true" />
          Ajouter une société
        </Button>
      )}
    </header>
  );
}
