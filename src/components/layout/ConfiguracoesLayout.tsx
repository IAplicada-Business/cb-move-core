import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Building2, FilePlus2, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/brand/PageHeader";
import { DashboardPage } from "@/components/domain/DashboardSection";
import { cn } from "@/lib/utils";

const TABS: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/app/configuracoes/convenios", label: "Convênios", icon: Building2 },
  { to: "/app/configuracoes/instrumentos", label: "Instrumentos", icon: Wrench },
  { to: "/app/configuracoes/templates", label: "Templates", icon: FilePlus2 },
];

function isTabActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function ConfiguracoesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Sistema" }, { label: "Configurações" }]}
        title="Configurações"
        description="Gerencie cadastros base, templates e parâmetros do CB MOVE."
      />

      <nav
        className="cb-glass-toolbar flex w-full min-w-0 flex-wrap gap-1.5 p-1.5"
        aria-label="Módulos de configuração"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(pathname, tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              preload="intent"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                active
                  ? "bg-cb-cyan-600 text-white shadow-[0_4px_14px_rgba(63,181,188,0.35)]"
                  : "text-cb-muted hover:bg-cb-cyan-050 hover:text-cb-ink dark:hover:bg-secondary/80",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="min-w-0 w-full">
        <Outlet />
      </div>
    </DashboardPage>
  );
}

type ConfiguracoesModuleHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function ConfiguracoesModuleHeader({
  title,
  description,
  actions,
}: ConfiguracoesModuleHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-cb-ink sm:text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-cb-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
