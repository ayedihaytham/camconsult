import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";
import { ChatBubble } from "./ChatBubble";
import { AppSidebar } from "./sidebar/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUi } from "@/store/ui";

export function AppLayout() {
  const collapsed = useUi((state) => state.collapsed);
  const setCollapsed = useUi((state) => state.setCollapsed);

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className="h-full min-h-0"
    >
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0">
        <Topbar />
        <div className="flex flex-1 flex-col overflow-y-auto bg-muted print-full">
          {/* flex-1 (flex-grow) plutôt que min-h-full (%) : une chaîne de
              flex-grow calée sur des tailles déjà définies ailleurs, jamais
              un pourcentage — plus fiable pour qu'une page courte remplisse
              vraiment la hauteur restante (constaté en usage réel : min-h-full
              ne se répercutait pas de façon fiable ici). */}
          <div className="authenticated-page-shell flex w-full min-w-0 flex-1 flex-col p-3 sm:p-4">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <ChatBubble />
    </SidebarProvider>
  );
}
