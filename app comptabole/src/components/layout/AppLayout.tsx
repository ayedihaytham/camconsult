import { Outlet, useLocation } from "react-router-dom";
import { Topbar } from "./Topbar";
import { ChatBubble } from "./ChatBubble";
import { AppSidebar } from "./sidebar/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { pathname } = useLocation();
  const collapsed = useUi((state) => state.collapsed);
  const setCollapsed = useUi((state) => state.setCollapsed);
  const isTasksWorkspace = pathname === "/taches";

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className="h-full min-h-0"
    >
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0">
        <Topbar />
        <div
          className={cn(
            "flex flex-1 flex-col overflow-y-auto bg-muted print-full",
            isTasksWorkspace ? "p-0" : "px-4 py-6 lg:px-8",
          )}
        >
          {/* flex-1 (flex-grow) plutôt que min-h-full (%) : une chaîne de
              flex-grow calée sur des tailles déjà définies ailleurs, jamais
              un pourcentage — plus fiable pour qu'une page courte remplisse
              vraiment la hauteur restante (constaté en usage réel : min-h-full
              ne se répercutait pas de façon fiable ici). */}
          <div
            className={cn(
              "flex w-full flex-1 flex-col",
              isTasksWorkspace ? "max-w-none" : "mx-auto max-w-[1400px]",
            )}
          >
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <ChatBubble />
    </SidebarProvider>
  );
}
