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
        <div className="flex-1 overflow-y-auto bg-muted px-4 py-6 lg:px-8 print-full">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <ChatBubble />
    </SidebarProvider>
  );
}
