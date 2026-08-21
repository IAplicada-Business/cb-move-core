import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Building2, FilePlus2, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { HeaderInfoTooltip } from "@/components/brand/HeaderInfoTooltip";
import { PageHeader } from "@/components/brand/PageHeader";
import { internalTabItemClass } from "@/components/brand/internal-tab-nav";
import { InternalTabNav } from "@/components/brand/InternalTabNav";
import { DashboardPage } from "@/components/domain/DashboardSection";

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

      <InternalTabNav aria-label="Módulos de configuração">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(pathname, tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              preload="intent"
              aria-current={active ? "page" : undefined}
              className={internalTabItemClass(active)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </Link>
          );
        })}
      </InternalTabNav>

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
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold tracking-tight text-cb-ink sm:text-xl">{title}</h2>
          {description ? (
            <HeaderInfoTooltip description={description} iconClassName="h-3.5 w-3.5" />
          ) : null}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
