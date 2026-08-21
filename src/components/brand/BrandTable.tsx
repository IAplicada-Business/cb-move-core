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

  return <div className={cn("cb-glass-card overflow-hidden", className)}>{children}</div>;
}

export function BrandTable({ className, ...props }: React.ComponentProps<typeof Table>) {
  return <Table className={cn("text-[13px]", className)} {...props} />;
}

export function BrandTableHeader({
  className,
  ...props
}: React.ComponentProps<typeof TableHeader>) {
  return <TableHeader className={className} {...props} />;
}

export function BrandTableHead({ className, ...props }: React.ComponentProps<typeof TableHead>) {
  return <TableHead className={className} {...props} />;
}

export function BrandTableBody(props: React.ComponentProps<typeof TableBody>) {
  return <TableBody {...props} />;
}

export function BrandTableRow({ className, ...props }: React.ComponentProps<typeof TableRow>) {
  return <TableRow className={className} {...props} />;
}

export function BrandTableCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return <TableCell className={className} {...props} />;
}

export function BrandTableNumCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return <BrandTableCell className={cn("text-right tabular-nums", className)} {...props} />;
}
