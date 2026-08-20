import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, MoreHorizontal, Users, UserCheck, Briefcase, Scale } from "lucide-react";
import { toast } from "sonner";

import { KpiCard } from "@/components/domain/KpiCard";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { PacienteTipoDistribution } from "@/components/domain/DashboardLists";
import { PageHeader } from "@/components/brand/PageHeader";
import { DataToolbar, DataToolbarSearch } from "@/components/brand/DataToolbar";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { TipoBadge } from "@/components/domain/TipoBadge";
import { PacienteCadastroDialog } from "@/components/domain/PacienteCadastroDialog";
import { queryKeys } from "@/lib/queries";
import { formatPhone } from "@/lib/format";
import {
  fetchPacientes,
  deletePaciente,
  setPacienteAtivo,
  type Paciente,
} from "@/lib/queries/pacientes";
import type { PacienteTipo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { matchesPatientSearch } from "@/lib/search-text";

export const Route = createFileRoute("/app/pacientes/")({
  head: () => ({ meta: [{ title: "Pacientes · CB MOVE" }] }),
  component: PacientesPage,
});

function maskCPF(cpf: string | null | undefined) {
  if (!cpf) return "—";
  const v = cpf.replace(/\D/g, "").padStart(11, "0").slice(0, 11);
  const part3 = v.slice(6, 9);
  const part4 = v.slice(9, 11);
  return `***.***.${part3}-${part4}`;
}

function PacientesPage() {
  const qc = useQueryClient();
  const { roles, fisioterapeutaId } = useAuth();
  const podeGerirPacientes = can.managePacientes(roles, fisioterapeutaId);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<PacienteTipo | "todos">("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Paciente | null>(null);
  const [deleting, setDeleting] = useState<Paciente | null>(null);

  const {
    data: pacientesRaw = [],
    isPending: pacientesPending,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.pacientes.list({
      tipo: filterTipo === "todos" ? undefined : filterTipo,
    }),
    queryFn: () =>
      fetchPacientes({
        tipo: filterTipo === "todos" ? undefined : filterTipo,
      }),
    placeholderData: (prev) => prev,
  });

  const pacientes = useMemo(() => {
    if (!search.trim()) return pacientesRaw;
    return pacientesRaw.filter((p) => matchesPatientSearch(p.nome, p.cpf, search));
  }, [pacientesRaw, search]);

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => setPacienteAtivo(id, ativo),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pacientes.all }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaciente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pacientes.all });
      toast.success("Paciente excluído");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Paciente) {
    setEditing(p);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  const total = pacientes.length;
  const nParticular = pacientes.filter((p) => p.tipo === "particular").length;
  const nConvenio = pacientes.filter((p) => p.tipo === "convenio").length;
  const nJudicial = pacientes.filter((p) => p.tipo === "judicial").length;

  const nPuc = pacientes.filter((p) => p.tipo === "puc").length;

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Operação" }, { label: "Pacientes" }]}
        title="Pacientes"
        actions={
          podeGerirPacientes ? (
            <Button onClick={openNew} className="gap-2 bg-cb-cyan-600 hover:bg-cb-cyan-700">
              <Plus className="h-4 w-4" /> Novo paciente
            </Button>
          ) : undefined
        }
      />

      <KpiGrid columns={4}>
        <KpiCard label="Total" value={total} accent="cyan" icon={<Users className="h-5 w-5" />} />
        <KpiCard
          label="Particular"
          value={nParticular}
          accent="cyan"
          icon={<UserCheck className="h-5 w-5" />}
          share={total > 0 ? (nParticular / total) * 100 : 0}
        />
        <KpiCard
          label="Convênio"
          value={nConvenio}
          accent="purple"
          icon={<Briefcase className="h-5 w-5" />}
          share={total > 0 ? (nConvenio / total) * 100 : 0}
        />
        <KpiCard
          label="Judicial"
          value={nJudicial}
          accent="magenta"
          icon={<Scale className="h-5 w-5" />}
          share={total > 0 ? (nJudicial / total) * 100 : 0}
        />
      </KpiGrid>

      {total > 0 && (
        <PacienteTipoDistribution
          total={total}
          particular={nParticular}
          convenio={nConvenio}
          judicial={nJudicial}
          puc={nPuc}
        />
      )}

      <DataToolbar>
        <DataToolbarSearch>
          <Search className="h-4 w-4 shrink-0 text-cb-muted" />
          <Input
            placeholder="Buscar por nome ou CPF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </DataToolbarSearch>
        <Select
          value={filterTipo}
          onValueChange={(v) => setFilterTipo(v as PacienteTipo | "todos")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="particular">Particular</SelectItem>
            <SelectItem value="convenio">Convênio</SelectItem>
            <SelectItem value="judicial">Judicial</SelectItem>
            <SelectItem value="puc">PUC</SelectItem>
          </SelectContent>
        </Select>
      </DataToolbar>

      {isError ? (
        <EmptyState
          title="Erro ao carregar pacientes"
          description={error instanceof Error ? error.message : "Tente novamente em instantes."}
        />
      ) : pacientesPending && pacientesRaw.length === 0 ? (
        <LoadingState />
      ) : pacientes.length === 0 ? (
        <EmptyState
          title="Nenhum paciente encontrado"
          description={
            podeGerirPacientes
              ? "Crie o primeiro paciente ou ajuste os filtros."
              : "Nenhum paciente vinculado à sua agenda ainda."
          }
          action={
            podeGerirPacientes ? (
              <Button onClick={openNew} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Novo paciente
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DashboardSection
          eyebrow="Cadastro"
          accent="cyan"
          title="Pacientes"
          badge={<DashboardSectionBadge accent="cyan">{pacientes.length}</DashboardSectionBadge>}
          noPadding
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Convênio / Processo</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Modelo relatório</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacientes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/app/pacientes/$pacienteId"
                      params={{ pacienteId: p.id }}
                      className="text-cb-cyan-800 hover:underline"
                    >
                      {p.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {maskCPF(p.cpf)}
                  </TableCell>
                  <TableCell>
                    <TipoBadge value={p.tipo} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.convenioNome ?? p.numeroProcesso ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{formatPhone(p.telefone) || "—"}</TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">
                    {p.modeloRelatorio ?? "convencional"}
                  </TableCell>
                  <TableCell>
                    {podeGerirPacientes ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.ativo}
                          onCheckedChange={(v) =>
                            toggleAtivoMutation.mutate({ id: p.id, ativo: v })
                          }
                        />
                        <span
                          className={cn(
                            "text-xs",
                            p.ativo ? "text-[#047857]" : "text-muted-foreground",
                          )}
                        >
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "text-xs",
                          p.ativo ? "text-[#047857]" : "text-muted-foreground",
                        )}
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {podeGerirPacientes ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/app/pacientes/$pacienteId" params={{ pacienteId: p.id }}>
                              Ver ficha
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(p)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(p)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/app/pacientes/$pacienteId" params={{ pacienteId: p.id }}>
                          Ver ficha
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DashboardSection>
      )}

      <PacienteCadastroDialog
        open={modalOpen}
        onOpenChange={(o) => {
          if (!o) closeModal();
        }}
        paciente={editing}
        onSuccess={closeModal}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome}</strong>? Só é possível
              excluir pacientes sem histórico de cobranças, sessões ou agendamentos. Caso já tenha
              histórico, use o botão de status na tabela para inativá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPage>
  );
}
