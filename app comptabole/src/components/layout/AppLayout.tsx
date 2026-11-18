import { Outlet, useLocation } from "react-router-dom";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { AppSidebar } from "./sidebar/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUi } from "@/store/ui";
import { cn } from "@/lib/utils";
import { TourProvider } from "@/components/tour/TourProvider";
import { useSocieteRouteSync } from "@/hooks/useSocieteActive";
import { useSuiviReprise } from "@/store/reprise";
import { BandeExercice } from "./BandeExercice";
import { BarreOnglets } from "./sidebar/BarreOnglets";
import { useConfig } from "@/store/config";

const EDGE_TO_EDGE_REGISTERS = new Set(["/societes", "/employes", "/collectes", "/taches", "/etats-financiers"]);

export function AppLayout() {
  const { pathname } = useLocation();
  const collapsed = useUi((state) => state.collapsed);
  const setCollapsed = useUi((state) => state.setCollapsed);
  const bandeauIntegre = useUi((state) => state.bandeauIntegre > 0);
  const edgeToEdgeMobile = EDGE_TO_EDGE_REGISTERS.has(pathname);
  const environnement = useConfig((s) => s.environnement);
  useSocieteRouteSync();
  useSuiviReprise();

  return (
    <TourProvider>
      {environnement === "test" && (
        <div role="status" className="no-print pointer-events-none fixed bottom-[4.75rem] left-3 z-[60] rounded-full bg-[#C9A96A] px-2.5 py-px text-[9.5px] lg:bottom-0.5 lg:left-[17rem] font-extrabold uppercase tracking-[0.14em] text-[#0B2545] shadow-md">
          Environnement de test
        </div>
      )}
      <SidebarProvider
        open={!collapsed}
        onOpenChange={(open) => setCollapsed(!open)}
        className="h-full min-h-0"
      >
        <AppSidebar />
        <CommandPalette />
        <SidebarInset className="min-h-0 min-w-0 bg-sidebar print:bg-white">
          <Topbar />
          {/* Feuille claire posée sur le cadre marine (menu + barre du haut) ; son filet doré rappelle la signature du cabinet. */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--sheet))] before:pointer-events-none before:absolute before:left-[30px] before:top-0 before:z-10 before:hidden before:h-[2px] before:w-[72px] before:bg-accent lg:rounded-tl-[22px] print:overflow-visible print:rounded-none">
          <div className="flex flex-1 flex-col overflow-y-auto bg-[hsl(var(--sheet))] max-lg:pb-[calc(4rem+env(safe-area-inset-bottom,0px))] print-full">
          {/* Dans la zone qui défile : même largeur utile que le bandeau et le tableau (la barre de défilement ne passe plus dessous), et reste en haut. */}
          {!bandeauIntegre && pathname !== "/messagerie" && <BandeExercice />}
          {/* flex-1 (flex-grow) plutôt que min-h-full (%) : une chaîne de
              flex-grow calée sur des tailles déjà définies ailleurs, jamais
              un pourcentage — plus fiable pour qu'une page courte remplisse
              vraiment la hauteur restante (constaté en usage réel : min-h-full
              ne se répercutait pas de façon fiable ici). */}
            <div
              data-tour="page-workspace"
              className={cn(
                "authenticated-page-shell flex w-full min-w-0 flex-1 flex-col",
                edgeToEdgeMobile ? "authenticated-page-shell--bord-a-bord px-0 pt-0 pb-2 sm:p-4" : "p-3 sm:p-4",
              )}
            >
              <Outlet />
            </div>
          </div>
          </div>
        </SidebarInset>
        <BarreOnglets />
        {/* Le bouton « Aide » est retiré pour le moment : la visite guidée sera proposée à la première visite. */}
      </SidebarProvider>
    </TourProvider>
  );
}
