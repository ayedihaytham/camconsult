import { Badge } from "@/components/ui/badge";
import type { EmployeType, SocieteTheme, Statut } from "@/types";

export const STATUT_LABELS: Record<Statut, string> = {
  actif: "Actif",
  inactif: "Inactif",
  en_attente: "En attente",
};

const STATUT_VARIANT: Record<Statut, "success" | "muted" | "warning"> = {
  actif: "success",
  inactif: "muted",
  en_attente: "warning",
};

export function StatusBadge({ statut }: { statut: Statut }) {
  return (
    <Badge variant={STATUT_VARIANT[statut]}>
      <span
        className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden
      />
      {STATUT_LABELS[statut]}
    </Badge>
  );
}

// Teintes dérivées de la palette de graphiques (voir index.css --chart-*),
// jamais de couleurs brutes hors palette — cohérent avec l'identité CAMCONSULT.
const themeStyles: Record<SocieteTheme, string> = {
  PME: "bg-chart-1/10 text-chart-1",
  "Grande entreprise": "bg-chart-2/10 text-chart-2",
  Association: "bg-warning/12 text-warning",
  "Profession libérale": "bg-chart-4/10 text-chart-4",
  "Auto-entrepreneur": "bg-chart-5/12 text-chart-5",
};

export function ThemeBadge({ theme }: { theme: SocieteTheme }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${themeStyles[theme]}`}
    >
      {theme}
    </span>
  );
}

const roleStyles: Record<EmployeType, string> = {
  Comptable: "bg-chart-1/10 text-chart-1",
  Assistant: "bg-chart-4/10 text-chart-4",
  Stagiaire: "bg-warning/12 text-warning",
  "Gestionnaire de paie": "bg-chart-2/10 text-chart-2",
};

export function RoleBadge({ type }: { type: EmployeType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleStyles[type]}`}
    >
      {type}
    </span>
  );
}
