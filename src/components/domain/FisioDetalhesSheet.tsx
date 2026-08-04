import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarCheck2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Pencil,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDate, formatDateTimeDDMMYY, initials } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import {
  fetchFisioContaVinculada,
  fetchFisioMetrics,
  fetchFisioUltimasSessoes,
  fetchFisioUsoLogs,
  type Fisio,
  type FisioUsoLogCategoria,
} from "@/lib/queries/fisioterapeutas";
import { cn } from "@/lib/utils";

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

const CATEGORIA_LABEL: Record<FisioUsoLogCategoria, string> = {
  sessao: "Agenda",
  evolucao: "Prontuário",
  relatorio: "Documento",
  avaliacao: "Avaliação",
  agenda: "Agenda",
  periodizacao: "Periodização",
};

const CATEGORIA_ICON: Record<FisioUsoLogCategoria, React.ReactNode> = {
  sessao: <CalendarCheck2 className="h-3.5 w-3.5" />,
  evolucao: <ClipboardCheck className="h-3.5 w-3.5" />,
  relatorio: <FileText className="h-3.5 w-3.5" />,
  avaliacao: <Stethoscope className="h-3.5 w-3.5" />,
  agenda: <Activity className="h-3.5 w-3.5" />,
  periodizacao: <FileText className="h-3.5 w-3.5" />,
};

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FisioSheetCollapsible({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        <span className="flex items-center gap-2">
          {title}
          {count != null && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case text-foreground">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function FisioDetalhesSheet({
  fisio,
  onClose,
  onEdit,
  onDelete,
}: {
  fisio: Fisio | null;
  onClose: () => void;
  onEdit: (f: Fisio) => void;
  onDelete: (f: Fisio) => void;
}) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: queryKeys.fisioterapeutas.metrics(fisio?.id ?? ""),
    queryFn: () => fetchFisioMetrics(fisio!.id),
    enabled: !!fisio,
  });

  const { data: conta } = useQuery({
    queryKey: queryKeys.fisioterapeutas.contaVinculada(fisio?.id ?? ""),
    queryFn: () => fetchFisioContaVinculada(fisio!.id),
    enabled: !!fisio,
  });

  const { data: usoLogs = [], isLoading: loadLogs } = useQuery({
    queryKey: queryKeys.fisioterapeutas.usoLogs(fisio?.id ?? ""),
    queryFn: () => fetchFisioUsoLogs(fisio!.id),
    enabled: !!fisio,
  });

  const { data: ultimasSessoes = [], isLoading: loadSessoes } = useQuery({
    queryKey: queryKeys.fisioterapeutas.ultimasSessoes(fisio?.id ?? ""),
    queryFn: () => fetchFisioUltimasSessoes(fisio!.id),
    enabled: !!fisio,
  });

  return (
    <Sheet
      open={!!fisio}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {fisio && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cb-cyan-600 text-sm font-bold text-white">
                  {initials(fisio.nome)}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{fisio.nome}</SheetTitle>
                  <SheetDescription>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        fisio.ativo
                          ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                          : "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {fisio.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-5 space-y-4">
              <div className="space-y-1 text-sm">
                {fisio.registro_profissional && (
                  <p>
                    <span className="text-muted-foreground">CREFITO:</span>{" "}
                    {fisio.registro_profissional}
                  </p>
                )}
                {fisio.email && (
                  <p>
                    <span className="text-muted-foreground">E-mail:</span> {fisio.email}
                  </p>
                )}
                {conta?.email && conta.email !== fisio.email && (
                  <p>
                    <span className="text-muted-foreground">Conta de acesso:</span> {conta.email}
                  </p>
                )}
                {!conta && (
                  <p className="text-muted-foreground">Sem conta de login vinculada ao cadastro.</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Métricas de atendimento
                </p>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <MetricCard
                      icon={<CalendarCheck2 className="h-4 w-4" />}
                      label="Consultas"
                      value={String(metrics?.totalConsultas ?? 0)}
                      hint="total registradas"
                    />
                    <MetricCard
                      icon={<Activity className="h-4 w-4" />}
                      label="Comparecimento"
                      value={formatPct(metrics?.comparecimento ?? null)}
                      hint="presenças / total"
                    />
                    <MetricCard
                      icon={<ClipboardCheck className="h-4 w-4" />}
                      label="Aderência"
                      value={formatPct(metrics?.aderencia ?? null)}
                      hint="sem falta não justificada"
                    />
                  </div>
                )}
              </div>

              <FisioSheetCollapsible title="Últimas sessões" count={ultimasSessoes.length}>
                {loadSessoes ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : ultimasSessoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
                ) : (
                  <ul className="divide-y rounded-lg border text-sm">
                    {ultimasSessoes.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="truncate text-muted-foreground">{formatDate(s.data)}</span>
                        <span className="truncate font-medium">{s.pacienteNome ?? "—"}</span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                          {s.sigla}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </FisioSheetCollapsible>

              <FisioSheetCollapsible title="Logs de uso do sistema" count={usoLogs.length}>
                {loadLogs ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : usoLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma atividade registrada ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {usoLogs.map((log) => (
                      <li key={log.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground">{log.titulo}</p>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                            {CATEGORIA_ICON[log.categoria]}
                            {CATEGORIA_LABEL[log.categoria]}
                          </span>
                        </div>
                        {log.detalhe && (
                          <p className="mt-0.5 text-muted-foreground">{log.detalhe}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatDateTimeDDMMYY(log.ts)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </FisioSheetCollapsible>

              <div className="flex gap-2 border-t pt-4">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(fisio)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-destructive hover:text-destructive"
                  onClick={() => onDelete(fisio)}
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
