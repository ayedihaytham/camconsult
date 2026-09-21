import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { useDashboardData } from "@/hooks/dashboard/useDashboardData";
import { usePermissions } from "@/hooks/usePermissions";
import { toTitleCase } from "@/lib/utils";
import { useAuth } from "@/store/auth";

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function DashboardPage() {
  const now = new Date();
  const sessionName = toTitleCase(useAuth((state) => state.session?.nom ?? ""));
  const firstName = sessionName.split(" ")[0] || "";
  const { isAdmin, can, lectureSeule } = usePermissions();
  const {
    data,
    role,
    canUseMessaging,
    collectesLoading,
    collectesError,
    retryCollectes,
  } = useDashboardData();
  const dateLabel = toTitleCase(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(now),
  );
  const canAddSociete = !lectureSeule && (isAdmin || can("modifierSocietes"));

  return (
    <div className="min-w-0 space-y-4">
      <DashboardHeader
        salutation={`${greeting(now)}${firstName ? ` ${firstName}` : ""}`}
        dateLabel={dateLabel}
        data={data}
        loading={collectesLoading}
        role={role}
        canAddSociete={canAddSociete}
        canUseMessaging={canUseMessaging}
      />
      <DashboardTabs
        data={data}
        canUseMessaging={canUseMessaging}
        collectesLoading={collectesLoading}
        collectesError={collectesError}
        onRetryCollectes={() => void retryCollectes()}
      />
    </div>
  );
}
