import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-3 bg-cb-bg/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-cb-bg/80 dark:bg-background/95 dark:supports-[backdrop-filter]:bg-background/60 md:px-8 lg:px-10">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <SidebarTrigger />
        <span className="truncate text-sm font-semibold text-cb-ink">CB MOVE</span>
      </div>
      <div className="hidden min-w-0 flex-1 md:block" aria-hidden />
      <UserProfileMenu />
    </header>
  );
}
