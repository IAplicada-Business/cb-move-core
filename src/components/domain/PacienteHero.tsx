import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Mail, Phone, User } from "lucide-react";

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
  telefone?: string | null;
  email?: string | null;
  ativo?: boolean;
  actions?: ReactNode;
};

function MetaChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-cb-cyan-050/40 px-3.5 py-3">
      <div className="mt-0.5 text-cb-cyan-700">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cb-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-cb-ink">{value}</p>
      </div>
    </div>
  );
}

export function PacienteHero({
  pacienteId,
  nome,
  tipo,
  convenioNome,
  numeroProcesso,
  telefone,
  email,
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

      <div className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_1px_2px_rgba(15,75,80,0.06)]">
        <div className="cb-rainbow-strip h-[3px]" aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cb-cyan-050 text-cb-cyan-700 ring-1 ring-cb-cyan-100">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-cb-ink">
                  {nome}
                </h1>
                <BrandBadgeTipo value={tipo} />
                {!ativo && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cb-muted">
                    Inativo
                  </span>
                )}
              </div>
              {(convenioNome || numeroProcesso) && (
                <p className="mt-1.5 text-sm text-cb-muted">{convenioNome ?? numeroProcesso}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <Button size="sm" className="gap-1.5 bg-cb-cyan-600 hover:bg-cb-cyan-700" asChild>
              <Link to="/app/prontuario" search={{ pacienteId }}>
                <FileText className="h-4 w-4" />
                Prontuário
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-border bg-background/40 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetaChip
            icon={<Phone className="h-4 w-4" />}
            label="Telefone"
            value={telefone?.trim() || "—"}
          />
          <MetaChip
            icon={<Mail className="h-4 w-4" />}
            label="E-mail"
            value={email?.trim() || "—"}
          />
          <MetaChip
            icon={<FileText className="h-4 w-4" />}
            label="Convênio / processo"
            value={convenioNome ?? numeroProcesso ?? "—"}
          />
        </div>
      </div>
    </div>
  );
}

export function PacienteInfoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function PacienteInfoField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-background/50 px-4 py-3.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-cb-muted">{label}</p>
      <div className="mt-1.5 text-sm font-medium text-cb-ink">{children}</div>
    </div>
  );
}
