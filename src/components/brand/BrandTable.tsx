import type { ReactNode } from "react";

import {
  DashboardSection,
  type DashboardSectionAccent,
} from "@/components/domain/DashboardSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type BrandTableShellProps = {
  title?: ReactNode;
  eyebrow?: string;
  accent?: DashboardSectionAccent;
  badge?: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

/**
 * Card + tabela com cabeçalho alinhado ao DashboardSection.
 */
export function BrandTableShell({
  title,
  eyebrow,
  accent = "cyan",
  badge,
  description,
  actions,
  children,
  className,
  noPadding,
}: BrandTableShellProps) {
  if (title) {
    return (
      <DashboardSection
        title={title}
        eyebrow={eyebrow}
        accent={accent}
        badge={badge}
        description={description}
        actions={actions}
        noPadding={noPadding ?? true}
        className={className}
      >
        {children}
      </DashboardSection>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-border bg-card",
        "shadow-[0_1px_2px_rgba(15,75,80,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BrandTable({ className, ...props }: React.ComponentProps<typeof Table>) {
  return <Table className={cn("text-[13px]", className)} {...props} />;
}

export function BrandTableHeader({
  className,
  ...props
}: React.ComponentProps<typeof TableHeader>) {
  return (
    <TableHeader className={cn("[&_tr]:border-b [&_tr]:bg-cb-cyan-050", className)} {...props} />
  );
}

export function BrandTableHead({ className, ...props }: React.ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      className={cn(
        "h-11 px-4 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cb-muted",
        className,
      )}
      {...props}
    />
  );
}

export function BrandTableBody(props: React.ComponentProps<typeof TableBody>) {
  return <TableBody {...props} />;
}

export function BrandTableRow({ className, ...props }: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        "border-b hover:bg-cb-cyan-050/80 data-[state=selected]:bg-cb-cyan-050",
        className,
      )}
      {...props}
    />
  );
}

export function BrandTableCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return <TableCell className={cn("px-4 py-3", className)} {...props} />;
}

export function BrandTableNumCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return <BrandTableCell className={cn("text-right tabular-nums", className)} {...props} />;
}
