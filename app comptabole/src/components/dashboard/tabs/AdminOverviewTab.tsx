import { type DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { AdminVueEnsemble } from "./AdminVueEnsemble";

interface Props {
  data: DashboardViewModel;
  loading: boolean;
  error: boolean;
  canUseMessaging: boolean;
  now?: Date;
}

/** Onglet « Synthèse » du cabinet : indicateurs, portefeuille clients, registre de révision et colonne de suivi. */
export function AdminOverviewTab({ data, loading, error, canUseMessaging, now = new Date() }: Props) {
  return (
    <div className="admin-overview admin-bureau">
      <AdminVueEnsemble data={data} loading={loading} error={error} canUseMessaging={canUseMessaging} now={now} />
    </div>
  );
}
