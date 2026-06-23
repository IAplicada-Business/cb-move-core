import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDate } from "@/lib/format";
import type { CobrancaStatus, NfStatus, FrequenciaSigla } from "@/lib/types";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

// ─── helpers ─────────────────────────────────────────────────────────────────

const SIGLA_COLORS: Record<FrequenciaSigla, string> = {
  P:  "bg-[#F7FEE7] text-cb-lime border-[#BEF264]",
  F:  "bg-[#FDF2F8] text-cb-magenta border-[#FBCFE8]",
  FJ: "bg-[#FFF7ED] text-cb-orange border-[#FED7AA]",
  NJ: "bg-[#FFFBEB] text-yellow-700 border-[#FDE68A]",
  RC: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100",
  NR: "bg-muted text-muted-foreground border-border",
};

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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

// ─── page ─────────────────────────────────────────────────────────────────────

function ProntuarioPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [obsLocal, setObsLocal] = useState<string | null>(null);

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

  const obsMutation = useMutation({
    mutationFn: ({ id, obs }: { id: string; obs: string }) => saveObs(id, obs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prontuario", "paciente", selectedId] });
      toast.success("Anotações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function selectPaciente(p: PacienteOption) {
    setSelectedId(p.id);
    setSearch(p.nome);
    setShowDropdown(false);
    setObsLocal(null);
  }

  const obsValue = obsLocal ?? paciente?.observacoes ?? "";

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
            <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
            <TabsTrigger value="nfs">Notas fiscais</TabsTrigger>
            <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
          </TabsList>

          {/* SESSOES */}
          <TabsContent value="sessoes">
            {loadSessoes ? (
              <LoadingState />
            ) : sessoes.length === 0 ? (
              <EmptyState title="Sem sessões" description="Nenhuma sessão registrada para este paciente." />
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
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                            SIGLA_COLORS[s.sigla]
                          )}>
                            {s.sigla}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.observacoes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* COBRANCAS */}
          <TabsContent value="cobrancas">
            {loadCob ? (
              <LoadingState />
            ) : cobrancas.length === 0 ? (
              <EmptyState title="Sem cobranças" description="Nenhuma cobrança registrada para este paciente." />
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
                        <TableCell><StatusBadge kind="cobranca" value={c.status} /></TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(c.vencimento)}</TableCell>
                        <TableCell className="text-muted-foreground">{formaPgtoLabel(c.forma_pagamento)}</TableCell>
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
              <EmptyState title="Sem notas fiscais" description="Nenhuma nota fiscal emitida para este paciente." />
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
                        <TableCell className="text-muted-foreground">{formatDate(n.emissao)}</TableCell>
                        <TableCell className="font-medium">{brl(n.valor)}</TableCell>
                        <TableCell><StatusBadge kind="nf" value={n.status} /></TableCell>
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
    </div>
  );
}
