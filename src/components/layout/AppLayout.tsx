import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "./Sidebar";
import { AppTopbar } from "./AppTopbar";
import { cn } from "@/lib/utils";

function NavigationProgress() {
  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  if (!isPending) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] overflow-hidden bg-cb-cyan-100"
      aria-hidden
    >
      <div className="h-full w-1/3 animate-[cb-nav-progress_0.9s_ease-in-out_infinite] bg-cb-cyan-600" />
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const isPending = useRouterState({ select: (s) => s.status === "pending" });

  return (
    <SidebarProvider className="h-svh overflow-hidden bg-cb-bg dark:bg-background">
      <Sidebar />
      <SidebarInset className="relative min-h-0 overflow-hidden bg-cb-bg dark:bg-background">
        <div className="cb-rainbow-strip h-[3px] shrink-0" aria-hidden />
        <NavigationProgress />
        <AppTopbar />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-cb-bg dark:bg-background">
          <div
            className={cn(
              "mx-auto w-full max-w-none px-6 py-8 transition-opacity duration-150 md:px-8 lg:px-10",
              isPending && "opacity-70",
            )}
          >
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
