import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/domain/LoadingState";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = (createFileRoute as any)("/portal/notas-fiscais")({
  component: PortalNotasFiscais,
});

type NF = {
  id: string;
  competencia: string | null;
  valor_servicos: number | null;
  status: string | null;
};

function traduzirStatus(s: string | null): { label: string; color: string } {
  if (s === "emitida") return { label: "Disponível", color: "bg-green-100 text-green-700" };
  if (s === "cancelada") return { label: "Cancelada", color: "bg-red-100 text-red-700" };
  return { label: "Em processamento", color: "bg-orange-100 text-orange-700" };
}

function PortalNotasFiscais() {
  const { pacienteId } = useAuth();
  const [nfs, setNfs] = React.useState<NF[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [exportando, setExportando] = React.useState(false);

  React.useEffect(() => {
    if (!pacienteId) return;
    (supabase as any)
      .from("notas_fiscais")
      .select("id, competencia, valor_servicos, status")
      .eq("paciente_id", pacienteId)
      .order("competencia", { ascending: false })
      .then(({ data }: { data: NF[] | null }) => {
        setNfs(data ?? []);
        setLoading(false);
      });
  }, [pacienteId]);

  async function exportarIR() {
    if (!pacienteId) return;
    setExportando(true);
    try {
      const { error } = await supabase.functions.invoke("gerar-relatorio-ir", {
        body: { paciente_id: pacienteId },
      });
      if (error) throw error;
      toast.success("Relatório de IR enviado para o seu e-mail!");
    } catch {
      toast.error("Não foi possível gerar o relatório agora. Tente mais tarde.");
    } finally {
      setExportando(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Notas fiscais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para sua declaração de imposto de renda
        </p>
      </div>

      <Button
        className="w-full bg-cb-cyan-600 hover:bg-cb-cyan-700"
        onClick={exportarIR}
        disabled={exportando}
      >
        {exportando ? "Gerando..." : "Exportar para declaração de IR"}
      </Button>

      {nfs.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhuma nota fiscal encontrada.
        </p>
      )}

      {nfs.length > 0 && (
        <ul className="space-y-2">
          {nfs.map((nf) => {
            const { label, color } = traduzirStatus(nf.status);
            const comp = nf.competencia
              ? new Date(nf.competencia + "-01T12:00:00").toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })
              : "—";
            const valor =
              nf.valor_servicos != null
                ? nf.valor_servicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
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
