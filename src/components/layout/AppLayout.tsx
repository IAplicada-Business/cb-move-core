import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "./Sidebar";
import { AppTopbar } from "./AppTopbar";

function NavigationProgress() {
  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  if (!isPending) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] overflow-hidden bg-cb-cyan-600/20"
      aria-hidden
    >
      <div className="h-full w-1/3 animate-[cb-nav-progress_0.9s_ease-in-out_infinite] bg-cb-cyan-500" />
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="h-svh overflow-hidden bg-cb-bg dark:bg-background">
      <Sidebar />
      <SidebarInset className="relative min-h-0 overflow-hidden cb-app-bg">
        <div className="cb-rainbow-strip h-[3px] shrink-0" aria-hidden />
        <NavigationProgress />
        <AppTopbar />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden cb-app-bg">
          <div className="w-full px-4 pb-8 pt-4 sm:px-5 md:px-6 lg:px-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
