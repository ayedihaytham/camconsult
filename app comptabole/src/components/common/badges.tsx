import { Badge } from "@/components/ui/badge";
import type { EmployeType, SocieteTheme, Statut } from "@/types";

export function StatusBadge({ statut }: { statut: Statut }) {
  const map: Record<Statut, { label: string; variant: "success" | "muted" | "warning" }> = {
    actif: { label: "Actif", variant: "success" },
    inactif: { label: "Inactif", variant: "muted" },
    en_attente: { label: "En attente", variant: "warning" },
  };
  const { label, variant } = map[statut];
  return (
    <Badge variant={variant}>
      <span
        className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden
      />
      {label}
    </Badge>
  );
}

const themeStyles: Record<SocieteTheme, string> = {
  PME: "bg-primary/10 text-primary",
  "Grande entreprise": "bg-indigo-100 text-indigo-700",
  Association: "bg-amber-100 text-amber-700",
  "Profession libérale": "bg-teal-100 text-teal-700",
  "Auto-entrepreneur": "bg-slate-200 text-slate-700",
};

export function ThemeBadge({ theme }: { theme: SocieteTheme }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${themeStyles[theme]}`}
    >
      {theme}
    </span>
  );
}

const roleStyles: Record<EmployeType, string> = {
  Comptable: "bg-primary/10 text-primary",
  Assistant: "bg-teal-100 text-teal-700",
  Stagiaire: "bg-amber-100 text-amber-700",
  "Gestionnaire de paie": "bg-indigo-100 text-indigo-700",
};

export function RoleBadge({ type }: { type: EmployeType }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${roleStyles[type]}`}
    >
      {type}
    </span>
  );
}
