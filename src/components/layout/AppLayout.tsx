import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="w-full p-6">{children}</div>
      </main>
    </div>
  );
}
