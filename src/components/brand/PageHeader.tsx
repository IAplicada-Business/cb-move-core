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

export function PageHeader({ crumbs, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {crumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cb-muted">
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
                        <BreadcrumbLink asChild className="text-cb-muted hover:text-cb-ink">
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

        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-cb-ink sm:text-[30px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-cb-muted">{description}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
