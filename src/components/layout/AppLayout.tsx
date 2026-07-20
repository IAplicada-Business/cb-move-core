import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="h-svh overflow-hidden bg-background">
      <Sidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <Topbar />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full p-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
