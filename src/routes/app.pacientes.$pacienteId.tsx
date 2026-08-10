import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  PacienteProfileList,
  PacienteProfileRow,
} from "@/components/domain/PacienteHero";
import { BrandBadgeTipo } from "@/components/brand/BrandBadge";
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
        ativo={paciente.ativo}
        actions={
          podeGerirPacientes ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Editar cadastro
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

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="dados" className="mt-2">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl border border-border/70 bg-muted/30 p-1.5">
          <TabsTrigger
            value="dados"
            className="gap-1.5 rounded-xl px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <User className="h-3.5 w-3.5" />
            Dados
          </TabsTrigger>
          <TabsTrigger
            value="comparecimento"
            className="gap-1.5 rounded-xl px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Comparecimento
          </TabsTrigger>
          {podeVerFinanceiro && (
            <TabsTrigger
              value="financeiro"
              className="gap-1.5 rounded-xl px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Receipt className="h-3.5 w-3.5" />
              Financeiro
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dados" className="mt-6">
          <DashboardSection
            eyebrow="Paciente"
            accent="cyan"
            title="Perfil do paciente"
            description="Informações de cadastro e acompanhamento"
            noPadding
            bodyClassName="p-0"
          >
            <PacienteProfileList>
              <PacienteProfileRow label="Nome">{paciente.nome}</PacienteProfileRow>
              <PacienteProfileRow label="Tipo">
                <BrandBadgeTipo value={paciente.tipo} />
              </PacienteProfileRow>
              <PacienteProfileRow label="Telefone">
                {formatPhone(paciente.telefone) || "—"}
              </PacienteProfileRow>
              <PacienteProfileRow label="E-mail">{paciente.email ?? "—"}</PacienteProfileRow>
              <PacienteProfileRow label="Convênio / processo">
                {paciente.convenioNome ?? paciente.numeroProcesso ?? "—"}
              </PacienteProfileRow>
              <PacienteProfileRow label="Frequência">
                {paciente.frequenciaAtendimento ?? "—"}
              </PacienteProfileRow>
              <PacienteProfileRow label="Fisio responsável">
                {paciente.fisioterapeutaNome ?? "—"}
              </PacienteProfileRow>
              <PacienteProfileRow label="Dias da semana">
                {paciente.diasSemana ?? "—"}
              </PacienteProfileRow>
              <PacienteProfileRow label="Motivo do acompanhamento" stacked>
                <span className="whitespace-pre-wrap font-normal text-cb-muted">
                  {paciente.motivoAcompanhamento ?? "—"}
                </span>
              </PacienteProfileRow>
            </PacienteProfileList>
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
