import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Pencil, Receipt, User } from "lucide-react";

import { LoadingState } from "@/components/domain/LoadingState";
import { PacienteCadastroDialog } from "@/components/domain/PacienteCadastroDialog";
import { HistoricoComparecimentoTable } from "@/components/domain/HistoricoComparecimentoTable";
import { MonthPicker, monthPickerLabel } from "@/components/domain/MonthPicker";
import { PacienteComparecimentoCard } from "@/components/domain/PacienteComparecimentoCard";
import { PacienteFinanceiroTab } from "@/components/domain/PacienteFinanceiroTab";
import {
  PacienteHero,
  PacienteInfoField,
  PacienteInfoGrid,
} from "@/components/domain/PacienteHero";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
} from "@/components/domain/DashboardSection";
import { queryKeys } from "@/lib/queries";
import { fetchPaciente } from "@/lib/queries/pacientes";
import {
  fetchComparecimentoMesPaciente,
  fetchHistoricoComparecimentoPaciente,
} from "@/lib/queries/sessoes";
import { formatPhone } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/pacientes/$pacienteId")({
  head: () => ({
    meta: [{ title: "Paciente · CB MOVE" }],
  }),
  component: PacienteDetalhe,
});

function PacienteDetalhe() {
  const { pacienteId } = Route.useParams();
  const qc = useQueryClient();
  const { roles, fisioterapeutaId } = useAuth();
  const podeVerFinanceiro = can.viewFinance(roles, fisioterapeutaId);
  const podeGerirPacientes = can.managePacientes(roles, fisioterapeutaId);
  const now = React.useMemo(() => new Date(), []);
  const [mesSelecionado, setMesSelecionado] = React.useState(now.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = React.useState(now.getFullYear());
  const [activeTab, setActiveTab] = React.useState("dados");
  const [editOpen, setEditOpen] = React.useState(false);

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
    enabled: !!pacienteId && activeTab === "comparecimento",
  });

  const { data: historico = [], isLoading: loadHistorico } = useQuery({
    queryKey: queryKeys.sessoes.comparecimentoHistorico(pacienteId, 12),
    queryFn: () => fetchHistoricoComparecimentoPaciente(pacienteId, 12),
    enabled: !!pacienteId && activeTab === "comparecimento",
  });

  if (loadPac) return <LoadingState />;
  if (!paciente) return <div className="text-cb-muted">Paciente não encontrado.</div>;

  return (
    <DashboardPage>
      <PacienteHero
        pacienteId={pacienteId}
        nome={paciente.nome}
        tipo={paciente.tipo}
        convenioNome={paciente.convenioNome}
        numeroProcesso={paciente.numeroProcesso}
        telefone={formatPhone(paciente.telefone)}
        email={paciente.email}
        ativo={paciente.ativo}
        actions={
          podeGerirPacientes ? (
            <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : undefined
        }
      />

      <PacienteCadastroDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        paciente={paciente}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: queryKeys.pacientes.byId(pacienteId) });
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="dados">
        <TabsList className="h-auto flex-wrap gap-1 bg-cb-cyan-050/60 p-1">
          <TabsTrigger value="dados" className="gap-1.5 data-[state=active]:bg-white">
            <User className="h-3.5 w-3.5" />
            Dados
          </TabsTrigger>
          <TabsTrigger value="comparecimento" className="gap-1.5 data-[state=active]:bg-white">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Comparecimento
          </TabsTrigger>
          {podeVerFinanceiro && (
            <TabsTrigger value="financeiro" className="gap-1.5 data-[state=active]:bg-white">
              <Receipt className="h-3.5 w-3.5" />
              Financeiro
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dados" className="mt-6">
          <DashboardSection
            eyebrow="Paciente"
            accent="cyan"
            title="Cadastro clínico"
            description="Informações principais do paciente"
          >
            <PacienteInfoGrid>
              <PacienteInfoField label="Nome">{paciente.nome}</PacienteInfoField>
              <PacienteInfoField label="Tipo">
                <span className="capitalize">{paciente.tipo}</span>
              </PacienteInfoField>
              <PacienteInfoField label="Telefone">
                {formatPhone(paciente.telefone) || "—"}
              </PacienteInfoField>
              <PacienteInfoField label="E-mail">{paciente.email ?? "—"}</PacienteInfoField>
              <PacienteInfoField label="Convênio / processo">
                {paciente.convenioNome ?? paciente.numeroProcesso ?? "—"}
              </PacienteInfoField>
              <PacienteInfoField label="Frequência">
                {paciente.frequenciaAtendimento ?? "—"}
              </PacienteInfoField>
              <PacienteInfoField label="Fisio responsável">
                {paciente.fisioterapeutaNome ?? "—"}
              </PacienteInfoField>
              <PacienteInfoField label="Dias da semana" className="sm:col-span-2">
                {paciente.diasSemana ?? "—"}
              </PacienteInfoField>
              <PacienteInfoField label="Motivo do acompanhamento" className="sm:col-span-2">
                <span className="whitespace-pre-wrap font-normal text-cb-muted">
                  {paciente.motivoAcompanhamento ?? "—"}
                </span>
              </PacienteInfoField>
            </PacienteInfoGrid>
          </DashboardSection>
        </TabsContent>

        <TabsContent value="comparecimento" className="mt-6 space-y-6">
          <DashboardSection
            eyebrow="Frequência"
            accent="lime"
            title="Comparecimento mensal"
            badge={
              <DashboardSectionBadge accent="lime">
                {monthPickerLabel(mesSelecionado, anoSelecionado)}
              </DashboardSectionBadge>
            }
            description="Frequência prevista × realizadas no mês selecionado"
            actions={
              <MonthPicker mes={mesSelecionado} ano={anoSelecionado} onChange={selecionarMes} />
            }
            noPadding
            bodyClassName="p-6"
          >
            {loadComparecimento ? (
              <LoadingState />
            ) : comparecimentoAtual ? (
              <PacienteComparecimentoCard
                metrica={comparecimentoAtual}
                mesLabel={monthPickerLabel(mesSelecionado, anoSelecionado)}
                showHeader={false}
              />
            ) : null}
          </DashboardSection>

          <DashboardSection
            eyebrow="Histórico"
            accent="purple"
            title="Histórico mensal"
            description="Últimos 12 meses — clique em uma linha para trocar o mês selecionado"
            noPadding
            bodyClassName="overflow-x-auto p-2"
          >
            {loadHistorico ? (
              <div className="p-4">
                <LoadingState />
              </div>
            ) : (
              <HistoricoComparecimentoTable
                historico={historico}
                mesSelecionado={mesSelecionado}
                anoSelecionado={anoSelecionado}
                onSelectMes={selecionarMes}
              />
            )}
          </DashboardSection>
        </TabsContent>

        {podeVerFinanceiro && (
          <TabsContent value="financeiro" className="mt-6">
            <DashboardSection
              eyebrow="Financeiro"
              accent="orange"
              title="Financeiro do paciente"
              description="Cobranças, notas fiscais e histórico de pagamentos"
              noPadding
              bodyClassName="p-6"
            >
              <PacienteFinanceiroTab pacienteId={pacienteId} />
            </DashboardSection>
          </TabsContent>
        )}
      </Tabs>
    </DashboardPage>
  );
}
