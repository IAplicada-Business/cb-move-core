import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { BrandBadgeTipo } from "@/components/brand/BrandBadge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import type { PacienteTipo } from "@/lib/types";

type PacienteHeroProps = {
  pacienteId: string;
  nome: string;
  tipo: PacienteTipo;
  convenioNome?: string | null;
  numeroProcesso?: string | null;
  ativo?: boolean;
  actions?: ReactNode;
};

export function PacienteHero({
  pacienteId,
  nome,
  tipo,
  convenioNome,
  numeroProcesso,
  ativo = true,
  actions,
}: PacienteHeroProps) {
  return (
    <div className="space-y-5">
      <Breadcrumb>
        <BreadcrumbList className="text-[11px] font-medium uppercase tracking-[0.12em] text-cb-muted">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app/pacientes">Operação</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-cb-muted/50" />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app/pacientes">Pacientes</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-cb-muted/50" />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-cb-ink">{nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="cb-rainbow-strip h-[3px]" aria-hidden />

        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center sm:px-8">
          <h1 className="font-serif text-[2rem] font-bold leading-tight tracking-tight text-cb-ink">
            {nome}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <BrandBadgeTipo value={tipo} />
            {!ativo && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cb-muted">
                Inativo
              </span>
            )}
          </div>

          {(convenioNome || numeroProcesso) && (
            <p className="mt-2 max-w-md text-sm text-cb-muted">{convenioNome ?? numeroProcesso}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {actions}
            <Button size="sm" className="gap-1.5 bg-cb-cyan-600 hover:bg-cb-cyan-700" asChild>
              <Link to="/app/prontuario/$pacienteId" params={{ pacienteId }}>
                <FileText className="h-4 w-4" />
                Prontuário
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PacienteProfileList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PacienteProfileRow({
  label,
  children,
  stacked = false,
  className,
}: {
  label: string;
  children: ReactNode;
  stacked?: boolean;
  className?: string;
}) {
  if (stacked) {
    return (
      <div className={cn("border-b border-border/60 px-5 py-4 last:border-b-0 sm:px-6", className)}>
        <p className="text-sm text-cb-muted">{label}</p>
        <div className="mt-2 text-sm font-medium leading-relaxed text-cb-ink">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-6 border-b border-border/60 px-5 py-4 last:border-b-0 sm:px-6",
        className,
      )}
    >
      <span className="shrink-0 text-sm text-cb-muted">{label}</span>
      <div className="min-w-0 text-right text-sm font-medium text-cb-ink">{children}</div>
    </div>
  );
}

/** @deprecated Use PacienteProfileList + PacienteProfileRow */
export function PacienteInfoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <PacienteProfileList className={className}>{children}</PacienteProfileList>;
}

/** @deprecated Use PacienteProfileRow */
export function PacienteInfoField({
  label,
  children,
  className,
  stacked,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  stacked?: boolean;
}) {
  return (
    <PacienteProfileRow label={label} stacked={stacked} className={className}>
      {children}
    </PacienteProfileRow>
  );
}
