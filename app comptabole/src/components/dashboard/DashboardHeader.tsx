import { LedgerCompactHeader } from "@/components/ledger/LedgerCompactHeader";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import type { DashboardRole, DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { formatNumber } from "@/lib/utils";

interface DashboardHeaderProps {
  salutation: string;
  dateLabel: string;
  data: DashboardViewModel;
  loading: boolean;
  role: DashboardRole;
  canAddSociete: boolean;
  canUseMessaging: boolean;
  error?: boolean;
  now?: Date;
  /** Société active : le Dashboard porte alors sur son dossier uniquement. */
  societeNom?: string | null;
}

export function DashboardHeader({ salutation, dateLabel, data, loading, role, canAddSociete, canUseMessaging, error = false, societeNom = null }: DashboardHeaderProps) {
  const companyView = role === "societe_employe";
  const title = companyView ? salutation : societeNom ?? (role === "admin" ? "Tableau de bord du cabinet" : "Mon espace de travail");
  const description = companyView
    ? "Voici les éléments utiles pour suivre vos échanges avec le cabinet."
    : role === "admin" ? undefined
    : societeNom ? "Tâches, collectes et échéances de ce client." : "Reprendre, avancer et préparer les prochaines transmissions.";
  return (
    <LedgerCompactHeader
      tourTarget="dashboard-summary"
      eyebrow={companyView ? dateLabel : <>{salutation} · {dateLabel}</>}
      title={title}
      description={description}
      contextLabel={!companyView && societeNom ? "Vue limitée à cette société" : undefined}
      actions={<DashboardQuickActions role={role} canAddSociete={canAddSociete} canUseMessaging={canUseMessaging} inverse />}
      metrics={companyView ? data.kpis.map((metric) => {
        const collectionDependent = ["deadline", "collectes", "toComplete", "validated"].includes(metric.id);
        return {
          label: metric.label,
          loading: loading && collectionDependent,
          value: error && collectionDependent ? "Indisponible" : typeof metric.value === "number" ? formatNumber(metric.value) : metric.value,
        };
      }) : []}
    />
  );
}
