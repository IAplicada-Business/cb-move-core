import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = createFileRoute("/portal/sessoes")({
  component: PortalSessoes,
});

type SessaoRow = {
  id: string;
  data: string;
  sigla: string | null;
};

const SIGLAS: Record<string, { label: string; color: string }> = {
  P: { label: "Compareci", color: "bg-green-100 text-green-700" },
  F: { label: "Não compareci", color: "bg-red-100 text-red-700" },
  FJ: { label: "Cancelei com aviso", color: "bg-orange-100 text-orange-700" },
  NJ: { label: "A recuperar", color: "bg-orange-200 text-orange-900" },
  RC: { label: "Sessão recuperada", color: "bg-blue-100 text-blue-700" },
  NR: { label: "Sem atendimento", color: "bg-gray-100 text-gray-600" },
};

function mesLabel(ano: number, mes: number) {
  return new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function PortalSessoes() {
  const { pacienteId } = useAuth();
  const now = new Date();
  const [ano, setAno] = React.useState(now.getFullYear());
  const [mes, setMes] = React.useState(now.getMonth()); // 0-based
  const [sessoes, setSessoes] = React.useState<SessaoRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!pacienteId) return;
    setLoading(true);
    const inicio = new Date(ano, mes, 1).toISOString().split("T")[0];
    const fim = new Date(ano, mes + 1, 0).toISOString().split("T")[0];
    supabase
      .from("sessoes")
      .select("id, data, sigla")
      .eq("paciente_id", pacienteId)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: true })
      .then(({ data }: { data: SessaoRow[] | null }) => {
        setSessoes(data ?? []);
        setLoading(false);
      });
  }, [pacienteId, ano, mes]);

  function navMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) {
      m = 11;
      a--;
    }
    if (m > 11) {
      m = 0;
      a++;
    }
    setMes(m);
    setAno(a);
  }

  const realizados = sessoes.filter((s) => s.sigla === "P" || s.sigla === "RC").length;
  const total = sessoes.length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Meus encontros</h1>

      {/* Seletor de mês */}
      <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => navMes(-1)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
        >
          ←
        </button>
        <span className="text-sm font-semibold capitalize">{mesLabel(ano, mes)}</span>
        <button
          type="button"
          onClick={() => navMes(1)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
        >
          →
        </button>
      </div>

      {/* Totais */}
      <div className="rounded-xl border bg-cb-cyan-050 px-4 py-3 text-sm">
        <span className="font-semibold text-cb-cyan-800">
          {realizados} de {total}
        </span>
        <span className="text-cb-cyan-700"> encontros realizados neste mês</span>
      </div>

      {loading && sessoes.length === 0 && <LoadingState />}

      {/* Lista */}
      {!loading && sessoes.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Nenhum registro neste mês.</p>
      )}

      {!loading && sessoes.length > 0 && (
        <ul className="space-y-2">
          {sessoes.map((s) => {
            const info = SIGLAS[s.sigla ?? "NR"] ?? SIGLAS["NR"];
            const data = new Date(s.data + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm"
              >
                <span className="text-sm font-medium capitalize text-foreground">{data}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${info.color}`}>
                  {info.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
