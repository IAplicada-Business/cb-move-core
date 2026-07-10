import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Mic } from "lucide-react";
import { toast } from "sonner";

import { tipoPacienteLabel, pacienteCodigoCurto, plazoSessoesLabel } from "@/components/domain/prontuario/utils";
import type { ProntuarioPaciente } from "@/lib/queries/prontuario";
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

type Props = {
  paciente: ProntuarioPaciente;
  sessoesRealizadas: number;
  canEdit: boolean;
  onGravarEvolucao: () => void;
};

function InfoCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

export function ProntuarioPatientHero({
  paciente,
  sessoesRealizadas,
  canEdit,
  onGravarEvolucao,
}: Props) {
  const tipoLabel = tipoPacienteLabel(paciente.tipo, paciente.convenioNome);

  return (
    <div className="space-y-5">
      <Breadcrumb>
        <BreadcrumbList className="text-[11px] uppercase tracking-wide text-muted-foreground">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app">Operação</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app/pacientes">Pacientes</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/app/pacientes/$pacienteId" params={{ pacienteId: paciente.id }}>
                {paciente.nome}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-foreground">Prontuário</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{paciente.nome}</h1>
          <span className="text-sm font-mono text-muted-foreground">{pacienteCodigoCurto(paciente.id)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Exportação do prontuário em breve.")}
          >
            <Download className="h-4 w-4" />
            Exportar prontuário
          </Button>
          {canEdit && (
            <Button size="sm" className="gap-1.5 bg-cb-cyan-600 hover:bg-cb-cyan-700 text-white" onClick={onGravarEvolucao}>
              <Mic className="h-4 w-4" />
              Gravar evolução
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-6">
        <InfoCell label="Tipo">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              paciente.tipo === "judicial"
                ? "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8]"
                : paciente.tipo === "convenio"
                  ? "bg-[#F5F3FF] text-cb-purple border-[#DDD6FE]"
                  : "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100",
            )}
          >
            {tipoLabel}
          </span>
        </InfoCell>
        <InfoCell label="Processo">
          {paciente.numeroProcesso ?? "—"}
        </InfoCell>
        <InfoCell label="Fisio responsável">
          {paciente.fisioterapeutaNome ?? "—"}
        </InfoCell>
        <InfoCell label="Plano">
          {plazoSessoesLabel(sessoesRealizadas)}
        </InfoCell>
      </div>
    </div>
  );
}
