import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/domain/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadPdfBase64, gerarRelatorioIrPdf } from "@/lib/queries/relatorio-ir";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/notas-fiscais")({
  component: PortalNotasFiscais,
});

type NF = {
  id: string;
  competencia_mes: number | null;
  competencia_ano: number | null;
  valor: number | null;
  status: string | null;
};

function traduzirStatus(s: string | null): { label: string; color: string } {
  if (s === "emitida") return { label: "Disponível", color: "bg-green-100 text-green-700" };
  if (s === "cancelada") return { label: "Cancelada", color: "bg-red-100 text-red-700" };
  return { label: "Em processamento", color: "bg-orange-100 text-orange-700" };
}

function formatCompetencia(mes: number | null, ano: number | null): string {
  if (!mes || !ano) return "—";
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function PortalNotasFiscais() {
  const { pacienteId } = useAuth();
  const [nfs, setNfs] = React.useState<NF[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [exportando, setExportando] = React.useState(false);
  const anoAtual = new Date().getFullYear();
  const [anoIr, setAnoIr] = React.useState(String(anoAtual));

  React.useEffect(() => {
    if (!pacienteId) return;
    supabase
      .from("notas_fiscais")
      .select("id, competencia_mes, competencia_ano, valor, status")
      .eq("paciente_id", pacienteId)
      .order("competencia_ano", { ascending: false })
      .order("competencia_mes", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[portal/notas-fiscais]", error);
          toast.error("Não foi possível carregar as notas fiscais.");
        }
        const rows = (data as NF[] | null) ?? [];
        setNfs(rows);
        const anos = rows
          .map((n) => n.competencia_ano)
          .filter((a): a is number => typeof a === "number");
        if (anos.length > 0) setAnoIr(String(Math.max(...anos)));
        setLoading(false);
      });
  }, [pacienteId]);

  const anosDisponiveis = React.useMemo(() => {
    const set = new Set<number>([anoAtual, anoAtual - 1]);
    for (const n of nfs) {
      if (n.competencia_ano) set.add(n.competencia_ano);
    }
    return [...set].sort((a, b) => b - a);
  }, [nfs, anoAtual]);

  async function exportarIR() {
    if (!pacienteId) return;
    setExportando(true);
    try {
      const result = await gerarRelatorioIrPdf(pacienteId, Number(anoIr));
      downloadPdfBase64(result.pdf_base64, result.filename);
      toast.success(`PDF de IR ${anoIr} baixado`);
    } catch {
      toast.error("Não foi possível gerar o relatório agora. Tente mais tarde.");
    } finally {
      setExportando(false);
    }
  }

  if (loading && nfs.length === 0) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Notas fiscais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para sua declaração de imposto de renda
        </p>
      </div>

      <div className="flex gap-2">
        <Select value={anoIr} onValueChange={setAnoIr}>
          <SelectTrigger className="w-[110px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="flex-1 bg-cb-cyan-600 hover:bg-cb-cyan-700"
          onClick={() => void exportarIR()}
          disabled={exportando}
        >
          {exportando ? "Gerando..." : "Baixar PDF para IR"}
        </Button>
      </div>

      {nfs.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhuma nota fiscal encontrada.
        </p>
      )}

      {nfs.length > 0 && (
        <ul className="space-y-2">
          {nfs.map((nf) => {
            const { label, color } = traduzirStatus(nf.status);
            const comp = formatCompetencia(nf.competencia_mes, nf.competencia_ano);
            const valor =
              nf.valor != null
                ? nf.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "—";
            return (
              <li key={nf.id} className="rounded-xl border bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold capitalize text-foreground">{comp}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{valor}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
                    {label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
