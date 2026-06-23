import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/domain/LoadingState";

export const Route = (createFileRoute as any)("/portal/")({
  component: PortalInicio,
});

type Paciente = {
  id: string;
  nome: string;
  tipo: string | null;
};

type Agendamento = {
  id: string;
  data_hora: string;
  fisioterapeutas?: { nome: string } | null;
};

type Relatorio = {
  id: string;
  created_at: string;
  pdf_url: string | null;
};

function PortalInicio() {
  const { user, pacienteId } = useAuth();
  const [paciente, setPaciente] = React.useState<Paciente | null>(null);
  const [sessoesCount, setSessoesCount] = React.useState(0);
  const [proximas, setProximas] = React.useState<Agendamento[]>([]);
  const [documentos, setDocumentos] = React.useState<Relatorio[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || !pacienteId) return;
    const db = supabase as any;
    const hoje = new Date();
    const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
    const mesFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0];

    Promise.all([
      db.from("pacientes").select("id, nome, tipo").eq("user_id", user.id).single(),
      db.from("sessoes")
        .select("id")
        .eq("paciente_id", pacienteId)
        .in("frequencia", ["P", "RC"])
        .gte("data", mesInicio)
        .lte("data", mesFim),
      db.from("agendamentos")
        .select("id, data_hora, fisioterapeutas(nome)")
        .eq("paciente_id", pacienteId)
        .gte("data_hora", hoje.toISOString())
        .in("status", ["agendado", "confirmado"])
        .order("data_hora", { ascending: true })
        .limit(3),
      db.from("relatorios_atendimento")
        .select("id, created_at, pdf_url")
        .eq("paciente_id", pacienteId)
        .eq("status", "assinado")
        .order("created_at", { ascending: false })
        .limit(3),
    ]).then(([pacRes, sesRes, agRes, relRes]) => {
      setPaciente(pacRes.data);
      setSessoesCount((sesRes.data ?? []).length);
      setProximas(agRes.data ?? []);
      setDocumentos(relRes.data ?? []);
      setLoading(false);
    });
  }, [user, pacienteId]);

  if (loading) return <LoadingState />;

  const firstName = paciente?.nome?.split(" ")[0] ?? "Olá";

  function formatDataHora(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatMes(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-cb-cyan-600 to-teal-500 p-6 text-white shadow-md">
        <p className="text-sm font-medium opacity-80">Bem-vinda de volta,</p>
        <h1 className="mt-1 text-2xl font-bold">{firstName}!</h1>
        <p className="mt-2 text-sm opacity-90">Acompanhe sua jornada de reabilitação</p>
      </div>

      {/* Sessões do mês */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Suas sessões este mês
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="relative grid h-20 w-20 place-items-center">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="#0e7490" strokeWidth="3"
                strokeDasharray={`${Math.min(sessoesCount * 4, 100)} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-2xl font-bold text-cb-cyan-700">{sessoesCount}</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {sessoesCount} {sessoesCount === 1 ? "encontro realizado" : "encontros realizados"}
            </p>
            <p className="text-sm text-muted-foreground">neste mês</p>
          </div>
        </div>
      </div>

      {/* Próximas visitas */}
      {proximas.length > 0 && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Próximas visitas
          </p>
          <ul className="space-y-3">
            {proximas.map((ag) => {
              const fisioNome =
                ag.fisioterapeutas && "nome" in ag.fisioterapeutas
                  ? (ag.fisioterapeutas as { nome: string }).nome
                  : "Sua fisioterapeuta";
              return (
                <li key={ag.id} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-cb-cyan-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {formatDataHora(ag.data_hora)}
                    </p>
                    <p className="text-xs text-muted-foreground">com {fisioNome}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Seus documentos */}
      {documentos.length > 0 && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Seus documentos
          </p>
          <ul className="space-y-2">
            {documentos.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between">
                <span className="text-sm text-foreground capitalize">
                  Relatório de {formatMes(doc.created_at)}
                </span>
                {doc.pdf_url && (
                  <a
                    href={doc.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-cb-cyan-600 hover:underline"
                  >
                    Baixar
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
