import { CalendarDays } from "lucide-react";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import type { DashboardRole } from "@/lib/dashboard/dashboardData";

interface DashboardHeaderProps {
  salutation: string;
  dateLabel: string;
  role: DashboardRole;
  canAddSociete: boolean;
  canUseMessaging: boolean;
}

export function DashboardHeader({ salutation, dateLabel, role, canAddSociete, canUseMessaging }: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{salutation}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "societe_employe"
            ? "Voici les éléments utiles pour suivre vos échanges avec le cabinet."
            : "Voici les éléments qui demandent votre attention aujourd'hui."}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {dateLabel}
        </p>
      </div>
      <DashboardQuickActions role={role} canAddSociete={canAddSociete} canUseMessaging={canUseMessaging} />
    </header>
  );
}
