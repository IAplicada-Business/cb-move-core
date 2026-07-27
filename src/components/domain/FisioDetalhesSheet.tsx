import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarCheck2, ClipboardCheck, Pencil, Trash2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import { fetchFisioMetrics, type Fisio } from "@/lib/queries/fisioterapeutas";
import { cn } from "@/lib/utils";

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

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
