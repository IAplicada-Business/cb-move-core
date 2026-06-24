import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Search, FlaskConical, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { EvolucaoCard } from "@/components/domain/EvolucaoCard";
import { EvolucaoEditor } from "@/components/domain/EvolucaoEditor";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDate } from "@/lib/format";
import {
  fetchEvolucoes,
  createEvolucao,
  updateEvolucao,
  type Evolucao,
} from "@/lib/queries/prontuario";
import type { CobrancaStatus, NfStatus, FrequenciaSigla } from "@/lib/types";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/prontuario")({
  head: () => ({ meta: [{ title: "Prontuário · CB MOVE" }] }),
  component: ProntuarioPage,
});

// ─── types ───────────────────────────────────────────────────────────────────

type PacienteOption = { id: string; nome: string };

type Sessao = {
  id: string;
  data: string;
  hora: string | null;
  sigla: FrequenciaSigla;
  observacoes: string | null;
  fisioterapeutas?: { nome: string } | null;
};

type Cobranca = {
  id: string;
  competencia_mes: number | null;
  competencia_ano: number | null;
  valor: number;
  status: CobrancaStatus;
  vencimento: string | null;
  forma_pagamento: string | null;
};

type NF = {
  id: string;
  numero: string | null;
  emissao: string | null;
  valor: number;
  status: NfStatus;
};

type Paciente = {
  id: string;
  nome: string;
  observacoes: string | null;
};

type Fisioterapeuta = { id: string; nome: string };

type InstrumentoCampo = {
  id: string;
  label: string;
  tipo: "select" | "number" | "textarea" | "text";
  opcoes?: string[];
  min?: number;
  max?: number;
};

type Instrumento = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  versao: number;
  status: string;
  campos: InstrumentoCampo[];
};

type InstrumentoAplicado = {
  id: string;
  instrumento_id: string;
  aplicado_em: string;
  resultados: Record<string, unknown>;
  instrumentos_clinicos?: { nome: string; codigo: string } | null;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const SIGLA_COLORS: Record<FrequenciaSigla, string> = {
  P: "bg-[#F7FEE7] text-cb-lime border-[#BEF264]",
  F: "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8]",
  FJ: "bg-[#FFF7ED] text-cb-orange border-[#FED7AA]",
  NJ: "bg-[#FFFBEB] text-yellow-700 border-[#FDE68A]",
  RC: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100",
  NR: "bg-muted text-muted-foreground border-border",
};

const MESES_ABREV = [
  "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez",
];

function mesLabel(mes: number | null, ano: number | null) {
  if (!mes || !ano) return "—";
  return `${MESES_ABREV[mes - 1]}/${ano}`;
}

function formaPgtoLabel(f: string | null) {
  if (!f) return "—";
  const map: Record<string, string> = {
    boleto: "Boleto",
    deposito: "Depósito",
    transferencia: "Transferência",
    alvara_judicial: "Alvará",
    convenio_direto: "Convênio",
  };
  return map[f] ?? f;
}

// ─── queries ─────────────────────────────────────────────────────────────────

async function searchPacientes(q: string): Promise<PacienteOption[]> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nome")
    .ilike("nome", `%${q}%`)
    .order("nome")
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

async function fetchSessoes(pacienteId: string): Promise<Sessao[]> {
  const { data, error } = await supabase
    .from("sessoes")
    .select("id, data, hora, sigla, observacoes, fisioterapeutas(nome)")
    .eq("paciente_id", pacienteId)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Sessao[];
}

async function fetchCobrancasPaciente(pacienteId: string): Promise<Cobranca[]> {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("id, competencia_mes, competencia_ano, valor, status, vencimento, forma_pagamento")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Cobranca[];
}

async function fetchNFsPaciente(pacienteId: string): Promise<NF[]> {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select("id, numero, emissao, valor, status")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NF[];
}

async function fetchPaciente(id: string): Promise<Paciente | null> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nome, observacoes")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Paciente | null;
}

async function saveObs(id: string, observacoes: string): Promise<void> {
  const { error } = await supabase
    .from("pacientes")
    .update({ observacoes: observacoes || null })
    .eq("id", id);
  if (error) throw error;
}

async function fetchFisios(): Promise<Fisioterapeuta[]> {
  const { data, error } = await supabase
    .from("fisioterapeutas")
    .select("id, nome")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Fisioterapeuta[];
}

async function fetchInstrumentosAtivos(): Promise<Instrumento[]> {
  const { data, error } = await supabase
    .from("instrumentos_clinicos")
    .select("id, codigo, nome, categoria, versao, status, campos")
    .eq("status", "ativo")
    .order("categoria")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as unknown as Instrumento[];
}

async function fetchInstrumentosAplicados(pacienteId: string): Promise<InstrumentoAplicado[]> {
  const { data, error } = await supabase
    .from("instrumentos_aplicados")
    .select("id, instrumento_id, aplicado_em, resultados, instrumentos_clinicos(nome, codigo)")
    .eq("paciente_id", pacienteId)
    .order("aplicado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InstrumentoAplicado[];
}

// ─── subcomponentes ───────────────────────────────────────────────────────────

function AplicarInstrumentoDialog({
  open,
  onOpenChange,
  instrumentos,
  pacienteId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instrumentos: Instrumento[];
  pacienteId: string;
  onSaved: () => void;
}) {
  const [instrumentoId, setInstrumentoId] = useState("");
  const [resultados, setResultados] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const instrumento = instrumentos.find((i) => i.id === instrumentoId);

  async function handleSave() {
    if (!instrumento) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("instrumentos_aplicados").insert({
        paciente_id: pacienteId,
        instrumento_id: instrumento.id,
        versao_aplicada: instrumento.versao,
        resultados,
        aplicado_em: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Instrumento aplicado com sucesso");
      onSaved();
      onOpenChange(false);
      setInstrumentoId("");
      setResultados({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function setField(id: string, value: string) {
    setResultados((r) => ({ ...r, [id]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar instrumento clínico</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Instrumento</Label>
            <Select
              value={instrumentoId}
              onValueChange={(v) => {
                setInstrumentoId(v);
                setResultados({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o instrumento" />
              </SelectTrigger>
              <SelectContent>
                {instrumentos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} ({i.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {instrumento && instrumento.campos.map((campo) => (
            <div key={campo.id} className="space-y-1.5">
              <Label>{campo.label}</Label>
              {campo.tipo === "select" && campo.opcoes ? (
                <Select
                  value={resultados[campo.id] ?? ""}
                  onValueChange={(v) => setField(campo.id, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {campo.opcoes.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : campo.tipo === "number" ? (
                <Input
                  type="number"
                  min={campo.min}
                  max={campo.max}
                  value={resultados[campo.id] ?? ""}
                  onChange={(e) => setField(campo.id, e.target.value)}
                />
              ) : campo.tipo === "textarea" ? (
                <Textarea
                  value={resultados[campo.id] ?? ""}
                  onChange={(e) => setField(campo.id, e.target.value)}
                  className="min-h-[80px] resize-y"
                />
              ) : (
                <Input
                  type="text"
                  value={resultados[campo.id] ?? ""}
                  onChange={(e) => setField(campo.id, e.target.value)}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !instrumentoId}>
              {saving ? "Salvando..." : "Registrar aplicação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

function ProntuarioPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [obsLocal, setObsLocal] = useState<string | null>(null);

  // Evolução state
  const [evolucaoDialogOpen, setEvolucaoDialogOpen] = useState(false);
  const [editingEvolucao, setEditingEvolucao] = useState<Evolucao | null>(null);

  // Avaliação state
  const [avaliacaoDialogOpen, setAvaliacaoDialogOpen] = useState(false);

  // Relatório mensal state
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [relatorioMes, setRelatorioMes] = useState(new Date().getMonth() + 1);
  const [relatorioAno, setRelatorioAno] = useState(new Date().getFullYear());

  const { data: searchResults = [] } = useQuery({
    queryKey: ["prontuario", "search", search],
    queryFn: () => searchPacientes(search),
    enabled: search.length >= 2,
  });

  const { data: paciente } = useQuery({
    queryKey: ["prontuario", "paciente", selectedId],
    queryFn: () => (selectedId ? fetchPaciente(selectedId) : null),
    enabled: !!selectedId,
  });

  const { data: sessoes = [], isLoading: loadSessoes } = useQuery({
    queryKey: ["prontuario", "sessoes", selectedId],
    queryFn: () => (selectedId ? fetchSessoes(selectedId) : []),
    enabled: !!selectedId,
  });

  const { data: cobrancas = [], isLoading: loadCob } = useQuery({
    queryKey: ["prontuario", "cobrancas", selectedId],
    queryFn: () => (selectedId ? fetchCobrancasPaciente(selectedId) : []),
    enabled: !!selectedId,
  });

  const { data: nfs = [], isLoading: loadNF } = useQuery({
    queryKey: ["prontuario", "nfs", selectedId],
    queryFn: () => (selectedId ? fetchNFsPaciente(selectedId) : []),
    enabled: !!selectedId,
  });

  const { data: evolucoes = [], isLoading: loadEvolucoes } = useQuery({
    queryKey: ["prontuario", "evolucoes", selectedId],
    queryFn: () => (selectedId ? fetchEvolucoes(selectedId) : []),
    enabled: !!selectedId,
  });

  const { data: fisios = [] } = useQuery({
    queryKey: ["fisios"],
    queryFn: fetchFisios,
  });

  const { data: instrumentosAtivos = [] } = useQuery({
    queryKey: ["instrumentos", "ativos"],
    queryFn: fetchInstrumentosAtivos,
    enabled: !!selectedId,
  });

  const { data: instrumentosAplicados = [], isLoading: loadAvaliacoes } = useQuery({
    queryKey: ["prontuario", "avaliacoes", selectedId],
    queryFn: () => (selectedId ? fetchInstrumentosAplicados(selectedId) : []),
    enabled: !!selectedId,
  });

  const obsMutation = useMutation({
    mutationFn: ({ id, obs }: { id: string; obs: string }) => saveObs(id, obs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prontuario", "paciente", selectedId] });
      toast.success("Anotações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createEvolucaoMutation = useMutation({
    mutationFn: (ev: Partial<Evolucao>) => createEvolucao(ev),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prontuario", "evolucoes", selectedId] });
      toast.success("Evolução registrada");
      setEvolucaoDialogOpen(false);
      setEditingEvolucao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvolucaoMutation = useMutation({
    mutationFn: ({ id, ev }: { id: string; ev: Partial<Evolucao> }) => updateEvolucao(id, ev),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prontuario", "evolucoes", selectedId] });
      toast.success("Evolução atualizada");
      setEvolucaoDialogOpen(false);
      setEditingEvolucao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function selectPaciente(p: PacienteOption) {
    setSelectedId(p.id);
    setSearch(p.nome);
    setShowDropdown(false);
    setObsLocal(null);
  }

  function handleSaveEvolucao(ev: Partial<Evolucao>) {
    if (!selectedId) return;
    if (editingEvolucao) {
      updateEvolucaoMutation.mutate({ id: editingEvolucao.id, ev });
    } else {
      createEvolucaoMutation.mutate({ ...ev, paciente_id: selectedId });
    }
  }

  async function handleGerarRelatorio() {
    if (!selectedId) return;
    setGerandoRelatorio(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-relatorio-mensal`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paciente_id: selectedId,
            mes: relatorioMes,
            ano: relatorioAno,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        if (res.status === 501) {
          toast.info("Aguardando credenciais para geração de PDF");
          return;
        }
        throw new Error(err.error || "Erro na geração");
      }
      const data = await res.json();
      toast.success(`Relatório gerado: ${data.competencia} — ${data.total_sessoes} sessões`);
      if (data.aviso) toast.info(data.aviso);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar relatório");
    } finally {
      setGerandoRelatorio(false);
    }
  }

  const obsValue = obsLocal ?? paciente?.observacoes ?? "";
  const evolucaoLoading =
    createEvolucaoMutation.isPending || updateEvolucaoMutation.isPending;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Prontuário</h1>
      </header>

      {/* Patient selector */}
      <div className="relative max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar paciente…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) {
                setSelectedId(null);
                setObsLocal(null);
              }
            }}
            onFocus={() => setShowDropdown(true)}
          />
        </div>
        {showDropdown && search.length >= 2 && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 rounded-md border bg-popover shadow-md text-sm">
            {searchResults.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                onMouseDown={() => selectPaciente(p)}
              >
                {p.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedId ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Selecione um paciente"
          description="Busque pelo nome do paciente para visualizar o prontuário."
        />
      ) : (
        <Tabs defaultValue="sessoes">
          <TabsList>
            <TabsTrigger value="sessoes">Histórico de sessões</TabsTrigger>
            <TabsTrigger value="avaliacoes">Avaliações clínicas</TabsTrigger>
            <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
            <TabsTrigger value="nfs">Notas fiscais</TabsTrigger>
            <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
          </TabsList>

          {/* SESSOES */}
          <TabsContent value="sessoes" className="space-y-6">
            {loadSessoes ? (
              <LoadingState />
            ) : sessoes.length === 0 ? (
              <EmptyState
                title="Sem sessões"
                description="Nenhuma sessão registrada para este paciente."
              />
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Fisio</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessoes.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{formatDate(s.data)}</TableCell>
                        <TableCell className="text-muted-foreground">{s.hora ?? "—"}</TableCell>
                        <TableCell>{s.fisioterapeutas?.nome ?? "—"}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                              SIGLA_COLORS[s.sigla]
                            )}
                          >
                            {s.sigla}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.observacoes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* ─── Evoluções S/O/P ─── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Evoluções clínicas</h2>
                  <p className="text-xs text-muted-foreground">Registros S/O/P por sessão</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Gerar relatório mensal */}
                  <div className="flex items-center gap-1">
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      value={relatorioMes}
                      onChange={(e) => setRelatorioMes(Number(e.target.value))}
                    >
                      {MESES_ABREV.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="h-8 w-16 rounded-md border bg-background px-2 text-xs"
                      value={relatorioAno}
                      onChange={(e) => setRelatorioAno(Number(e.target.value))}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGerarRelatorio}
                      disabled={gerandoRelatorio}
                    >
                      {gerandoRelatorio ? "Gerando..." : "Gerar relatório"}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingEvolucao(null);
                      setEvolucaoDialogOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Nova evolução
                  </Button>
                </div>
              </div>

              {loadEvolucoes ? (
                <LoadingState />
              ) : evolucoes.length === 0 ? (
                <EmptyState
                  title="Nenhuma evolução registrada"
                  description="Clique em '+ Nova evolução' para registrar a primeira evolução clínica."
                />
              ) : (
                <div className="space-y-3">
                  {evolucoes.map((ev) => (
                    <EvolucaoCard
                      key={ev.id}
                      evolucao={ev as Evolucao & { fisioterapeutas?: { nome: string } | null }}
                      onEdit={(e) => {
                        setEditingEvolucao(e);
                        setEvolucaoDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* AVALIAÇÕES CLÍNICAS */}
          <TabsContent value="avaliacoes" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Avaliações clínicas</h2>
                <p className="text-xs text-muted-foreground">
                  Instrumentos padronizados aplicados ao paciente
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setAvaliacaoDialogOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Aplicar instrumento
              </Button>
            </div>

            {loadAvaliacoes ? (
              <LoadingState />
            ) : instrumentosAplicados.length === 0 ? (
              <EmptyState
                icon={<FlaskConical className="h-8 w-8" />}
                title="Nenhuma avaliação registrada"
                description="Clique em '+ Aplicar instrumento' para registrar uma avaliação."
              />
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrumento</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Data de aplicação</TableHead>
                      <TableHead>Resultados (resumo)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instrumentosAplicados.map((ia) => (
                      <TableRow key={ia.id}>
                        <TableCell className="font-medium">
                          {ia.instrumentos_clinicos?.nome ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ia.instrumentos_clinicos?.codigo ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(ia.aplicado_em)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                          {Object.entries(ia.resultados)
                            .filter(([, v]) => v !== "" && v !== null && v !== undefined)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <AplicarInstrumentoDialog
              open={avaliacaoDialogOpen}
              onOpenChange={setAvaliacaoDialogOpen}
              instrumentos={instrumentosAtivos}
              pacienteId={selectedId}
              onSaved={() =>
                qc.invalidateQueries({ queryKey: ["prontuario", "avaliacoes", selectedId] })
              }
            />
          </TabsContent>

          {/* COBRANCAS */}
          <TabsContent value="cobrancas">
            {loadCob ? (
              <LoadingState />
            ) : cobrancas.length === 0 ? (
              <EmptyState
                title="Sem cobranças"
                description="Nenhuma cobrança registrada para este paciente."
              />
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Forma pgto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cobrancas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{mesLabel(c.competencia_mes, c.competencia_ano)}</TableCell>
                        <TableCell className="font-medium">{brl(c.valor)}</TableCell>
                        <TableCell>
                          <StatusBadge kind="cobranca" value={c.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(c.vencimento)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formaPgtoLabel(c.forma_pagamento)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* NFS */}
          <TabsContent value="nfs">
            {loadNF ? (
              <LoadingState />
            ) : nfs.length === 0 ? (
              <EmptyState
                title="Sem notas fiscais"
                description="Nenhuma nota fiscal emitida para este paciente."
              />
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nfs.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-xs">{n.numero ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(n.emissao)}
                        </TableCell>
                        <TableCell className="font-medium">{brl(n.valor)}</TableCell>
                        <TableCell>
                          <StatusBadge kind="nf" value={n.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ANOTACOES */}
          <TabsContent value="anotacoes">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs text-muted-foreground">
                Anotações clínicas livres — salvas no cadastro do paciente.
              </p>
              <Textarea
                rows={12}
                value={obsValue}
                onChange={(e) => setObsLocal(e.target.value)}
                placeholder="Escreva suas anotações clínicas aqui…"
              />
              <Button
                onClick={() => {
                  if (selectedId) {
                    obsMutation.mutate({ id: selectedId, obs: obsValue });
                  }
                }}
                disabled={obsMutation.isPending}
              >
                {obsMutation.isPending ? "Salvando…" : "Salvar anotações"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog Nova/Editar Evolução */}
      <Dialog
        open={evolucaoDialogOpen}
        onOpenChange={(v) => {
          setEvolucaoDialogOpen(v);
          if (!v) setEditingEvolucao(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvolucao ? "Editar evolução" : "Nova evolução clínica"}
            </DialogTitle>
          </DialogHeader>
          {selectedId && (
            <EvolucaoEditor
              key={editingEvolucao?.id ?? "nova"}
              evolucao={editingEvolucao ?? undefined}
              fisios={fisios}
              pacienteId={selectedId}
              onSave={handleSaveEvolucao}
              onCancel={() => {
                setEvolucaoDialogOpen(false);
                setEditingEvolucao(null);
              }}
              loading={evolucaoLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
