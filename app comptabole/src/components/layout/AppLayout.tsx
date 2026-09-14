import { Outlet } from "react-router-dom";
import { Sidenav } from "./Sidenav";
import { Topbar } from "./Topbar";
import { ChatBubble } from "./ChatBubble";

export function AppLayout() {
  return (
    <div className="flex h-full">
      <Sidenav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-muted px-4 py-6 lg:px-8 print-full">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatBubble />
    </div>
  );
}
