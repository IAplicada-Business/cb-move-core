import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type PageHeaderCrumb = {
  label: string;
  to?: string;
};

type PageHeaderProps = {
  crumbs: PageHeaderCrumb[];
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Cabeçalho de página alinhado ao mockup CB MOVE.
 * Staged — usar nas rotas somente após autorização de produção.
 */
export function PageHeader({ crumbs, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 space-y-2">
        {crumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList className="text-[11px] font-medium uppercase tracking-[0.12em] text-cb-muted">
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;

                return (
                  <span key={`${crumb.label}-${index}`} className="contents">
                    <BreadcrumbItem>
                      {isLast || !crumb.to ? (
                        <BreadcrumbPage className="text-cb-muted">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild className="text-cb-muted hover:text-cb-ink">
                          <Link to={crumb.to}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator className="text-cb-muted/50 [&>svg]:size-3" />}
                  </span>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.025em] text-cb-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-cb-muted">{description}</p>}
        </div>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
