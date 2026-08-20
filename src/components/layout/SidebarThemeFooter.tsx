import { ThemeTabs } from "@/components/ui/theme-tabs";
import { cn } from "@/lib/utils";

type SidebarThemeFooterProps = {
  compact?: boolean;
  className?: string;
};

/** Toggle claro/escuro no rodapé da sidebar — padrão Behance (perfil fica no topbar). */
export function SidebarThemeFooter({ compact, className }: SidebarThemeFooterProps) {
  if (compact) {
    return (
      <div className={cn("flex w-full justify-center px-1 py-2", className)}>
        <ThemeTabs size="sm" variant="icon-stack" layoutId="cb-sidebar-theme-tab-bg" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full px-3 py-3 [&_[role=tablist]]:border-sidebar-border [&_[role=tablist]]:bg-sidebar-accent/40",
        className,
      )}
    >
      <ThemeTabs size="sm" stretch layoutId="cb-sidebar-theme-tab-bg" className="w-full" />
    </div>
  );
}
