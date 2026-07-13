import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = (createFileRoute as any)("/portal/historico")({
  component: PortalHistorico,
});

type SessaoRow = {
  id: string;
  data: string;
  sigla: string | null;
  fisioterapeutas?: { nome: string } | null;
};

type GrupoMes = {
  chave: string;
  label: string;
  realizados: number;
  total: number;
  fisio: string;
};

function PortalHistorico() {
  const { pacienteId } = useAuth();
  const [grupos, setGrupos] = React.useState<GrupoMes[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!pacienteId) return;
    (supabase as any)
      .from("sessoes")
      .select("id, data, sigla, fisioterapeutas(nome)")
      .eq("paciente_id", pacienteId)
      .order("data", { ascending: false })
      .then(({ data }: { data: SessaoRow[] | null }) => {
        const rows = data ?? [];
        const map = new Map<string, GrupoMes>();
        for (const s of rows) {
          const d = new Date(s.data + "T12:00:00");
          const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
          const fisio =
            s.fisioterapeutas && "nome" in s.fisioterapeutas
              ? (s.fisioterapeutas as { nome: string }).nome
              : "—";
          if (!map.has(chave)) {
            map.set(chave, { chave, label, realizados: 0, total: 0, fisio });
          }
          const g = map.get(chave)!;
          g.total++;
          if (s.sigla === "P" || s.sigla === "RC") g.realizados++;
        }
        setGrupos(Array.from(map.values()));
        setLoading(false);
      });
  }, [pacienteId]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Histórico de encontros</h1>

      {grupos.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum histórico disponível ainda.
        </p>
      )}

      {grupos.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-center">Realizados</th>
                <th className="px-4 py-3 text-right">Fisioterapeuta</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g, i) => (
                <tr key={g.chave} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                  <td className="px-4 py-3 capitalize font-medium text-foreground">{g.label}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {g.realizados} de {g.total}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{g.fisio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
