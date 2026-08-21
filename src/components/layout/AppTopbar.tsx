import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-cb-cyan-100/80 bg-white/90 px-4 backdrop-blur-xl dark:border-border/50 dark:bg-card/90 md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5 md:hidden">
        <SidebarTrigger className="rounded-lg text-cb-ink hover:bg-cb-cyan-050" />
        <span className="truncate text-sm font-extrabold tracking-tight text-cb-ink">CB MOVE</span>
      </div>
      <div className="hidden min-w-0 flex-1 md:block" aria-hidden />
      <UserProfileMenu />
    </header>
  );
}
