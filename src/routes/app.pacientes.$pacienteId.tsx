import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User, ClipboardCheck, FileText } from "lucide-react";

import { LoadingState } from "@/components/domain/LoadingState";
import { HistoricoComparecimentoTable } from "@/components/domain/HistoricoComparecimentoTable";
import { MonthPicker, monthPickerLabel } from "@/components/domain/MonthPicker";
import { PacienteComparecimentoCard } from "@/components/domain/PacienteComparecimentoCard";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { queryKeys } from "@/lib/queries";
import { fetchPaciente } from "@/lib/queries/pacientes";
import {
  fetchComparecimentoMesPaciente,
  fetchHistoricoComparecimentoPaciente,
} from "@/lib/queries/sessoes";
import { formatPhone } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/pacientes/$pacienteId")({
  head: () => ({
    meta: [{ title: "Paciente · CB MOVE" }],
  }),
  component: PacienteDetalhe,
});

function PacienteDetalhe() {
  const { pacienteId } = Route.useParams();
  const now = React.useMemo(() => new Date(), []);
  const [mesSelecionado, setMesSelecionado] = React.useState(now.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = React.useState(now.getFullYear());

  function selecionarMes(mes: number, ano: number) {
    setMesSelecionado(mes);
    setAnoSelecionado(ano);
  }

  const { data: paciente, isLoading: loadPac } = useQuery({
    queryKey: queryKeys.pacientes.byId(pacienteId),
    queryFn: () => fetchPaciente(pacienteId),
    enabled: !!pacienteId,
  });

  const { data: comparecimentoAtual, isLoading: loadComparecimento } = useQuery({
    queryKey: queryKeys.sessoes.comparecimentoMes(pacienteId, mesSelecionado, anoSelecionado),
    queryFn: () => fetchComparecimentoMesPaciente(pacienteId, mesSelecionado, anoSelecionado),
    enabled: !!pacienteId,
  });

  const { data: historico = [], isLoading: loadHistorico } = useQuery({
    queryKey: queryKeys.sessoes.comparecimentoHistorico(pacienteId, 12),
    queryFn: () => fetchHistoricoComparecimentoPaciente(pacienteId, 12),
    enabled: !!pacienteId,
  });

  if (loadPac) return <LoadingState />;
  if (!paciente) return <div className="p-6 text-muted-foreground">Paciente não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/app/pacientes" className="rounded-md p-1.5 hover:bg-accent">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{paciente.nome}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <TipoBadge value={paciente.tipo} />
              {paciente.convenioNome && (
                <span className="text-sm text-muted-foreground">{paciente.convenioNome}</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/prontuario" search={{ pacienteId }}>
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Abrir prontuário
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">
            <User className="mr-1.5 h-3.5 w-3.5" />
            Dados
          </TabsTrigger>
          <TabsTrigger value="comparecimento">
            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
            Comparecimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-6">
          <div className="space-y-4 rounded-xl border bg-card p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Nome</p>
                <p className="mt-1 font-medium text-foreground">{paciente.nome}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Tipo</p>
                <p className="mt-1 capitalize text-foreground">{paciente.tipo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Telefone</p>
                <p className="mt-1 text-foreground">{formatPhone(paciente.telefone) || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">E-mail</p>
                <p className="mt-1 text-foreground">{paciente.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Convênio / processo</p>
                <p className="mt-1 text-foreground">
                  {paciente.convenioNome ?? paciente.numeroProcesso ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Frequência</p>
                <p className="mt-1 text-foreground">{paciente.frequenciaAtendimento ?? "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Dias da semana</p>
                <p className="mt-1 text-foreground">{paciente.diasSemana ?? "—"}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="comparecimento" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Comparecimento mensal</h2>
              <p className="text-sm text-muted-foreground">
                Selecione o mês para ver frequência prevista × realizadas
              </p>
            </div>
            <MonthPicker
              mes={mesSelecionado}
              ano={anoSelecionado}
              onChange={selecionarMes}
            />
          </div>

          {loadComparecimento ? (
            <LoadingState />
          ) : comparecimentoAtual ? (
            <PacienteComparecimentoCard
              metrica={comparecimentoAtual}
              mesLabel={monthPickerLabel(mesSelecionado, anoSelecionado)}
              showHeader={false}
            />
          ) : null}

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Histórico mensal</h2>
              <p className="text-sm text-muted-foreground">
                Últimos 12 meses — clique em uma linha para trocar o mês selecionado
              </p>
            </div>
            {loadHistorico ? (
              <LoadingState />
            ) : (
              <HistoricoComparecimentoTable
                historico={historico}
                mesSelecionado={mesSelecionado}
                anoSelecionado={anoSelecionado}
                onSelectMes={selecionarMes}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
