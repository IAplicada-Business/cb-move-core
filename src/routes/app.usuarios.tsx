import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Lock, Plus, Search, Shield, Trash2, UserCheck, UserCog, Users } from "lucide-react";
import { toast } from "sonner";

import { DataToolbar, DataToolbarSearch } from "@/components/brand/DataToolbar";
import { PageHeader } from "@/components/brand/PageHeader";
import {
  DashboardPage,
  DashboardSection,
  DashboardSectionBadge,
  KpiGrid,
} from "@/components/domain/DashboardSection";
import { KpiCard } from "@/components/domain/KpiCard";
import { StatusDistributionBar } from "@/components/domain/MetricVisuals";
import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { UsuarioCardGrid, type UsuarioCardRow } from "@/components/domain/UsuarioCardGrid";
import { queryKeys } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { createUser, deleteUser, fetchUsers, type UserRow } from "@/lib/queries/usuarios";
import { normalizeRole, type PrimaryRole } from "@/lib/permissions";
import { COLABORADORES_REFERENCIA } from "@/lib/colaboradores-referencia";
import { DEFAULT_INITIAL_PASSWORD } from "@/lib/default-password";
import {
  cadastroPerfilFromUsuarioRow,
  equipeInputFromUsuarioRow,
  USUARIO_CADASTRO_PERFIL_OPTIONS,
  USUARIO_PERFIL_FILTER_OPTIONS,
  usuarioEquipeTag,
  type UsuarioCadastroPerfil,
  type UsuarioPerfilFilter,
} from "@/lib/usuario-equipe";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · CB MOVE" }] }),
  component: UsuariosPage,
});

function findUserByEmail(users: UserRow[], email: string): UserRow | undefined {
  const target = email.toLowerCase();
  return users.find((u) => u.email?.toLowerCase() === target);
}

function buildUsuarioRows(users: UserRow[]): UsuarioCardRow[] {
  const referenceEmails = new Set(COLABORADORES_REFERENCIA.map((c) => c.email.toLowerCase()));

  const rows: UsuarioCardRow[] = COLABORADORES_REFERENCIA.map((c) => ({
    key: c.email,
    nome: c.nome,
    email: c.email,
    perfil: c.perfil,
    registered: findUserByEmail(users, c.email),
    isReference: true,
    tipoEquipeReferencia: c.tipoEquipe ?? (c.perfil === "membro" ? "fisio" : undefined),
    observacaoReferencia: c.observacao,
  }));

  const extras = users
    .filter((u) => u.email && !referenceEmails.has(u.email.toLowerCase()))
    .sort((a, b) => (a.nome ?? a.email ?? "").localeCompare(b.nome ?? b.email ?? "", "pt-BR"));

  for (const u of extras) {
    rows.push({
      key: u.id,
      nome: u.nome ?? u.email ?? "—",
      email: u.email ?? "—",
      perfil: normalizeRole(u.role) ?? "membro",
      registered: u,
      isReference: false,
    });
  }

  return rows;
}

function UsuariosPage() {
  const { roles, user, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [cadastroForm, setCadastroForm] = useState({
    nome: "",
    email: "",
    perfil: "fisio" as UsuarioCadastroPerfil,
    paciente_id: "",
  });
  const [pacienteQuery, setPacienteQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPerfil, setFilterPerfil] = useState<UsuarioPerfilFilter>("todos");
  const [userToDelete, setUserToDelete] = useState<UsuarioCardRow | null>(null);

  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: fetchUsers,
    enabled: isAdmin,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes", "invite-search", pacienteQuery],
    queryFn: async () => {
      let q = supabase
        .from("pacientes")
        .select("id, nome, email, user_id")
        .is("user_id", null)
        .order("nome")
        .limit(20);
      if (pacienteQuery.trim()) q = q.ilike("nome", `%${pacienteQuery.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin && cadastroOpen && cadastroForm.perfil === "cliente",
  });

  const cadastroMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      if (!roles.includes("admin")) {
        await refreshRoles();
      }
      toast.success(res.message ?? "Usuário salvo");
      setCadastroOpen(false);
      setCadastroForm({ nome: "", email: "", perfil: "fisio", paciente_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success(res.message ?? "Usuário excluído");
      setUserToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cadastradosCount = useMemo(
    () => COLABORADORES_REFERENCIA.filter((c) => findUserByEmail(users, c.email)).length,
    [users],
  );

  const usuarioRows = useMemo(() => buildUsuarioRows(users), [users]);

  const filteredUsuarioRows = useMemo(() => {
    let rows = usuarioRows;
    if (filterPerfil !== "todos") {
      rows = rows.filter(
        (row) => usuarioEquipeTag(equipeInputFromUsuarioRow(row)) === filterPerfil,
      );
    }
    const term = searchQuery.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (row) => row.nome.toLowerCase().includes(term) || row.email.toLowerCase().includes(term),
      );
    }
    return rows;
  }, [usuarioRows, searchQuery, filterPerfil]);

  const perfilCounts = useMemo(() => {
    const counts: Record<Exclude<UsuarioPerfilFilter, "todos">, number> = {
      admin: 0,
      fisio: 0,
      secretaria: 0,
      gestao: 0,
      cliente: 0,
      membro: 0,
    };
    for (const row of usuarioRows) {
      const tag = usuarioEquipeTag(equipeInputFromUsuarioRow(row));
      counts[tag] += 1;
    }
    return counts;
  }, [usuarioRows]);

  const nAdmin = perfilCounts.admin;
  const nFisio = perfilCounts.fisio;
  const nSecretaria = perfilCounts.secretaria;
  const nCliente = perfilCounts.cliente;
  const nPendentes = useMemo(() => usuarioRows.filter((r) => !r.registered).length, [usuarioRows]);

  function openCadastroFromRow(row: UsuarioCardRow) {
    openCadastro({
      nome: row.nome,
      email: row.email,
      perfil: cadastroPerfilFromUsuarioRow(row),
    });
  }

  function openCadastro(prefill?: { nome: string; email: string; perfil: UsuarioCadastroPerfil }) {
    setCadastroForm({
      nome: prefill?.nome ?? "",
      email: prefill?.email ?? "",
      perfil: prefill?.perfil ?? "fisio",
      paciente_id: "",
    });
    setPacienteQuery("");
    setCadastroOpen(true);
  }

  if (!isAdmin) {
    return (
      <DashboardPage>
        <PageHeader
          crumbs={[{ label: "Equipe" }, { label: "Usuários" }]}
          title="Usuários do sistema"
        />
        <EmptyState
          icon={<Lock className="h-8 w-8" />}
          title="Acesso restrito"
          description="Esta seção é visível apenas para administradores."
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <PageHeader
        crumbs={[{ label: "Equipe" }, { label: "Usuários" }]}
        title="Usuários do sistema"
        description={`Cadastre a equipe com senha inicial ${DEFAULT_INITIAL_PASSWORD}. Fisioterapeutas recebem menu clínico fixo; secretária e demais perfis usam os acessos padrão do sistema.`}
        actions={
          <Button
            onClick={() => openCadastro()}
            className="gap-2 bg-cb-cyan-600 hover:bg-cb-cyan-700"
          >
            <Plus className="h-4 w-4" />
            Cadastrar usuário
          </Button>
        }
      />

      <KpiGrid columns={4}>
        <KpiCard
          label="Cadastrados"
          value={users.length}
          accent="cyan"
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          label="Equipe ref."
          value={cadastradosCount}
          accent="purple"
          icon={<UserCheck className="h-5 w-5" />}
          share={
            COLABORADORES_REFERENCIA.length > 0
              ? (cadastradosCount / COLABORADORES_REFERENCIA.length) * 100
              : 0
          }
        />
        <KpiCard
          label="Administradores"
          value={nAdmin}
          accent="lime"
          icon={<Shield className="h-5 w-5" />}
        />
        <KpiCard
          label="Pendentes"
          value={nPendentes}
          accent="orange"
          icon={<UserCog className="h-5 w-5" />}
        />
      </KpiGrid>

      {usuarioRows.length > 0 && (
        <StatusDistributionBar
          totalLabel="Equipe por perfil"
          formatValue={(n) => String(n)}
          segments={[
            { label: "Fisioterapeuta", value: nFisio, colorClass: "bg-cb-cyan-600" },
            { label: "Admin", value: nAdmin, colorClass: "bg-cb-lime" },
            { label: "Secretária", value: nSecretaria, colorClass: "bg-cb-purple" },
            { label: "Cliente", value: nCliente, colorClass: "bg-muted-foreground" },
          ].filter((s) => s.value > 0)}
        />
      )}

      <DataToolbar>
        <DataToolbarSearch>
          <Search className="h-4 w-4 shrink-0 text-cb-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </DataToolbarSearch>
        <Select
          value={filterPerfil}
          onValueChange={(v) => setFilterPerfil(v as UsuarioPerfilFilter)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            {USUARIO_PERFIL_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs font-medium text-cb-muted">
          {usuarioRows.length} na lista · {users.length} cadastrados
        </p>
      </DataToolbar>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Erro ao carregar usuários"
          description={error instanceof Error ? error.message : "Tente novamente."}
          action={
            <Button onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Carregando…" : "Tentar novamente"}
            </Button>
          }
        />
      ) : filteredUsuarioRows.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="Nenhum usuário encontrado"
          description={
            searchQuery.trim() || filterPerfil !== "todos"
              ? "Tente buscar por outro nome, e-mail ou ajuste o filtro de perfil."
              : "Nenhum usuário na lista."
          }
        />
      ) : (
        <DashboardSection
          eyebrow="Equipe"
          accent="cyan"
          title="Equipe e acessos"
          badge={
            <DashboardSectionBadge accent="cyan">
              {filteredUsuarioRows.length}
            </DashboardSectionBadge>
          }
          description="Referência de colaboradores + usuários extras cadastrados no sistema"
          noPadding
        >
          <UsuarioCardGrid
            rows={filteredUsuarioRows}
            currentUserId={user?.id}
            onEdit={openCadastroFromRow}
            onDelete={setUserToDelete}
          />
        </DashboardSection>
      )}

      <Dialog open={cadastroOpen} onOpenChange={setCadastroOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {findUserByEmail(users, cadastroForm.email)
                ? "Atualizar cadastro"
                : "Cadastrar usuário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={cadastroForm.nome}
                onChange={(e) => setCadastroForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={cadastroForm.email}
                onChange={(e) => setCadastroForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select
                value={cadastroForm.perfil}
                onValueChange={(v) =>
                  setCadastroForm((f) => ({
                    ...f,
                    perfil: v as UsuarioCadastroPerfil,
                    paciente_id: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USUARIO_CADASTRO_PERFIL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cadastroForm.perfil === "fisio" && (
              <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                Acesso clínico filtrado: pacientes vinculados ao profissional. O e-mail precisa
                existir no cadastro de <strong>Fisioterapeutas</strong> (Equipe → Fisioterapeutas).
                O menu lateral é fixo (Meus pacientes, Minha agenda, Prontuário).
              </p>
            )}

            {cadastroForm.perfil === "secretaria" && (
              <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                Acesso operacional amplo — agenda, pacientes e rotinas de recepção, sem visão
                financeira restrita ao perfil fisio.
              </p>
            )}

            {cadastroForm.perfil === "cliente" && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <Label>Paciente vinculado</Label>
                <Input
                  value={pacienteQuery}
                  onChange={(e) => setPacienteQuery(e.target.value)}
                  placeholder="Buscar paciente…"
                />
                <Select
                  value={cadastroForm.paciente_id}
                  onValueChange={(v) => setCadastroForm((f) => ({ ...f, paciente_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Senha inicial padrão: <strong>{DEFAULT_INITIAL_PASSWORD}</strong>. No primeiro login,
              a pessoa será redirecionada para definir a senha pessoal.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCadastroOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={cadastroMutation.isPending}
              onClick={() =>
                cadastroMutation.mutate({
                  nome: cadastroForm.nome.trim(),
                  email: cadastroForm.email.trim(),
                  perfil: cadastroForm.perfil,
                  paciente_id: cadastroForm.perfil === "cliente" ? cadastroForm.paciente_id : null,
                })
              }
            >
              {cadastroMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{userToDelete?.nome}</strong> (
              {userToDelete?.email})? Essa ação remove o acesso ao sistema e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (userToDelete?.registered?.id) {
                  deleteMutation.mutate(userToDelete.registered.id);
                }
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
