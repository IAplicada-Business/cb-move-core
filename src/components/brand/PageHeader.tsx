import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { HeaderInfoTooltip } from "@/components/brand/HeaderInfoTooltip";
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

export function PageHeader({ crumbs, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "cb-glass-card flex w-full min-w-0 flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {crumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList className="text-[10px] font-bold uppercase tracking-[0.16em] text-cb-muted">
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;

                return (
                  <span key={`${crumb.label}-${index}`} className="contents">
                    <BreadcrumbItem>
                      {isLast || !crumb.to ? (
                        <BreadcrumbPage className="text-cb-cyan-700 dark:text-cb-cyan-400">
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild className="text-cb-muted hover:text-cb-cyan-700">
                          <Link to={crumb.to}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator className="text-cb-muted/40 [&>svg]:size-3" />}
                  </span>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] font-extrabold tracking-[-0.04em] text-cb-ink sm:text-[32px]">
              {title}
            </h1>
            {description ? <HeaderInfoTooltip description={description} /> : null}
          </div>
        </div>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
