import { useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Landmark,
  ListChecks,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DashboardRole } from "@/lib/dashboard/dashboardData";

interface DashboardQuickActionsProps {
  role: DashboardRole;
  canAddSociete: boolean;
  canUseMessaging: boolean;
}

interface QuickAction {
  label: string;
  route: string;
  icon: LucideIcon;
}

export function DashboardQuickActions({ role, canAddSociete, canUseMessaging }: DashboardQuickActionsProps) {
  const navigate = useNavigate();
  const actions: QuickAction[] = role === "admin"
    ? [
        { label: "Nouvelle tâche", route: "/taches", icon: ListChecks },
        { label: "Nouvelle collecte", route: "/collectes", icon: ClipboardCheck },
        ...(canAddSociete ? [{ label: "Ajouter une société", route: "/societes", icon: Building2 }] : []),
        { label: "Nouveau bordereau", route: "/bordereaux", icon: Landmark },
      ]
    : role === "collaborateur"
      ? [
          { label: "Mes tâches", route: "/taches", icon: ListChecks },
          { label: "Collectes", route: "/collectes", icon: ClipboardCheck },
          ...(canAddSociete ? [{ label: "Ajouter une société", route: "/societes", icon: Building2 }] : []),
          ...(canUseMessaging ? [{ label: "Messagerie", route: "/messagerie", icon: MessageCircle }] : []),
        ]
      : [
          { label: "Mes collectes", route: "/collectes", icon: ClipboardCheck },
          { label: "Mes documents", route: "/structuration", icon: FileText },
          ...(canUseMessaging ? [{ label: "Messagerie", route: "/messagerie", icon: MessageCircle }] : []),
        ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full shadow-none sm:w-auto">
          Actions rapides
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem key={action.label} onSelect={() => navigate(action.route)}>
              <Icon aria-hidden="true" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
