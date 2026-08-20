import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/40 bg-cb-glass-bg px-4 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-cb-glass-bg md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5 md:hidden">
        <SidebarTrigger className="text-cb-ink" />
        <span className="truncate text-sm font-bold tracking-tight text-cb-ink">CB MOVE</span>
      </div>
      <div className="hidden min-w-0 flex-1 md:block" aria-hidden />
      <UserProfileMenu />
    </header>
  );
}
