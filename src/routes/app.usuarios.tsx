import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Search, Shield, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
import {
  UsuarioCadastroDialog,
  emptyCadastroForm,
  type CadastroFormState,
} from "@/components/domain/UsuarioCadastroDialog";
import { queryKeys } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import {
  createUser,
  deleteUser,
  fetchUserMenuPermissions,
  fetchUsers,
  saveUserMenuPermissions,
  type UserRow,
} from "@/lib/queries/usuarios";
import { can } from "@/lib/permissions";
import { assertAdminAccess } from "@/lib/route-access";
import { COLABORADORES_REFERENCIA } from "@/lib/colaboradores-referencia";
import { DEFAULT_INITIAL_PASSWORD } from "@/lib/default-password";
import { DEFAULT_MENU_FOR_OPERACIONAL } from "@/lib/menu-access";
import {
  cadastroPerfilFromUsuarioRow,
  USUARIO_PERFIL_FILTER_OPTIONS,
  usuarioDisplayPerfilFromRow,
  type UsuarioCadastroPerfil,
  type UsuarioPerfilFilter,
} from "@/lib/usuario-equipe";
import { fetchFisioByEmail, invalidateFisioListQueries } from "@/lib/queries/fisioterapeutas";
import { supabase } from "@/integrations/supabase/client";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const usuariosSearchSchema = z.object({
  edit: z.string().optional(),
});

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · CB MOVE" }] }),
  validateSearch: usuariosSearchSchema,
  beforeLoad: () => assertAdminAccess(),
  component: UsuariosPage,
});

const CADASTRO_FORM_DEFAULTS: CadastroFormState = emptyCadastroForm("fisio");

function findUserByEmail(users: UserRow[], email: string): UserRow | undefined {
  const target = email.toLowerCase();
  return users.find((u) => u.email?.toLowerCase() === target);
}

function resolvePerfilFromUser(u: UserRow): UsuarioCadastroPerfil {
  if (u.fisioterapeuta_id) return "fisio";
  if (u.role === "admin") return "admin";
  if (u.role === "cliente" || u.role === "paciente") return "cliente";
  return "operacional";
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
      perfil: resolvePerfilFromUser(u),
      registered: u,
      isReference: false,
    });
  }

  return rows;
}

function UsuariosPage() {
  const { roles, user, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { edit: editEmailParam } = Route.useSearch();
  const isAdmin = can.manageUsers(roles);

  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [cadastroForm, setCadastroForm] = useState<CadastroFormState>(CADASTRO_FORM_DEFAULTS);
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

  const editingExistingUser = !!findUserByEmail(users, cadastroForm.email);
  const editingUserId = findUserByEmail(users, cadastroForm.email)?.id ?? null;
  const cadastroPerfil = cadastroForm.perfil;
  const pacienteVinculadoId =
    cadastroOpen && cadastroPerfil === "cliente" && cadastroForm.paciente_id
      ? cadastroForm.paciente_id
      : null;

  const { data: pacientes = [], isLoading: loadingPacientes } = useQuery({
    queryKey: ["pacientes", "invite-search", pacienteQuery, pacienteVinculadoId],
    queryFn: async () => {
      let q = supabase.from("pacientes").select("id, nome, email, user_id").order("nome").limit(20);
      if (pacienteVinculadoId) {
        q = q.or(`user_id.is.null,id.eq.${pacienteVinculadoId}`);
      } else {
        q = q.is("user_id", null);
      }
      if (pacienteQuery.trim()) q = q.ilike("nome", `%${pacienteQuery.trim()}%`);
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      return data ?? [];
    },
    enabled: isAdmin && cadastroOpen && cadastroPerfil === "cliente",
  });

  const { isFetching: loadingMenus } = useQuery({
    queryKey: queryKeys.usuarios.userMenuPermissions(editingUserId ?? "new"),
    queryFn: () => fetchUserMenuPermissions(editingUserId!),
    enabled: isAdmin && cadastroOpen && cadastroPerfil === "operacional" && !!editingUserId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!cadastroOpen || cadastroPerfil !== "operacional" || !editingUserId) return;
    let cancelled = false;
    void fetchUserMenuPermissions(editingUserId)
      .then((menus) => {
        if (cancelled) return;
        setCadastroForm((f) => ({
          ...f,
          menu_permissions: { ...DEFAULT_MENU_FOR_OPERACIONAL, ...menus },
        }));
      })
      .catch(() => {
        /* mantém padrão */
      });
    return () => {
      cancelled = true;
    };
  }, [cadastroOpen, cadastroPerfil, editingUserId]);

  useEffect(() => {
    if (!cadastroOpen || cadastroPerfil !== "fisio" || !editingExistingUser) return;
    const email = cadastroForm.email.trim();
    if (!email) return;
    let cancelled = false;
    void fetchFisioByEmail(email)
      .then((fisio) => {
        if (cancelled || !fisio) return;
        setCadastroForm((f) => ({
          ...f,
          registro_profissional: f.registro_profissional || fisio.registro_profissional || "",
          ativo: fisio.ativo,
          nome: f.nome || fisio.nome,
        }));
      })
      .catch(() => {
        /* prefill opcional */
      });
    return () => {
      cancelled = true;
    };
  }, [cadastroOpen, cadastroPerfil, editingExistingUser, cadastroForm.email]);

  const cadastroMutation = useMutation({
    mutationFn: async (input: {
      nome: string;
      email: string;
      perfil: UsuarioCadastroPerfil;
      paciente_id: string | null;
      fisio?: { registro_profissional: string | null; ativo: boolean };
      menu_permissions?: CadastroFormState["menu_permissions"];
    }) => {
      const res = await createUser({
        nome: input.nome,
        email: input.email,
        perfil: input.perfil,
        paciente_id: input.paciente_id,
        ...(input.fisio ? { fisio: input.fisio } : {}),
      });
      if (input.perfil === "operacional" && res.user_id && input.menu_permissions) {
        await saveUserMenuPermissions(res.user_id, {
          ...DEFAULT_MENU_FOR_OPERACIONAL,
          ...input.menu_permissions,
          "team.usuarios": false,
        });
      }
      return res;
    },
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      qc.invalidateQueries({ queryKey: ["usuarios", "user-menu-permissions"] });
      invalidateFisioListQueries(qc);
      if (!roles.includes("admin")) {
        await refreshRoles();
      }
      toast.success(res.message ?? "Usuário salvo");
      setCadastroOpen(false);
      setCadastroForm(emptyCadastroForm("fisio"));
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

  const usuarioRows = useMemo(() => buildUsuarioRows(users), [users]);

  const filteredUsuarioRows = useMemo(() => {
    let rows = usuarioRows;
    if (filterPerfil !== "todos") {
      rows = rows.filter((row) => usuarioDisplayPerfilFromRow(row) === filterPerfil);
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
    const counts = { admin: 0, fisio: 0, cliente: 0, operacional: 0 };
    for (const row of usuarioRows) {
      if (!row.registered) continue;
      counts[usuarioDisplayPerfilFromRow(row)] += 1;
    }
    return counts;
  }, [usuarioRows]);

  const perfilRosterCounts = useMemo(() => {
    const counts = { admin: 0, fisio: 0, cliente: 0, operacional: 0 };
    for (const row of usuarioRows) {
      counts[usuarioDisplayPerfilFromRow(row)] += 1;
    }
    return counts;
  }, [usuarioRows]);

  async function openCadastro(prefill?: {
    nome: string;
    email: string;
    perfil: UsuarioCadastroPerfil;
    paciente_id?: string;
  }) {
    const perfil = prefill?.perfil ?? "fisio";
    let form: CadastroFormState = {
      ...emptyCadastroForm(perfil),
      nome: prefill?.nome ?? "",
      email: prefill?.email ?? "",
      perfil,
      paciente_id: prefill?.paciente_id ?? "",
    };

    if (perfil === "fisio" && prefill?.email.trim()) {
      try {
        const fisio = await fetchFisioByEmail(prefill.email);
        if (fisio) {
          form = {
            ...form,
            nome: form.nome || fisio.nome,
            registro_profissional: form.registro_profissional || fisio.registro_profissional || "",
            ativo: fisio.ativo,
          };
        }
      } catch {
        /* prefill opcional */
      }
    }

    setCadastroForm(form);
    setPacienteQuery("");
    setCadastroOpen(true);
  }

  function openCadastroFromRow(row: UsuarioCardRow) {
    void openCadastro({
      nome: row.nome,
      email: row.email,
      perfil: cadastroPerfilFromUsuarioRow(row),
      paciente_id: row.registered?.paciente_id ?? undefined,
    });
  }

  function openCadastroNovo() {
    void openCadastro({ nome: "", email: "", perfil: "fisio" });
  }

  function handleSaveCadastro() {
    const nome = cadastroForm.nome.trim();
    const email = cadastroForm.email.trim();
    if (nome.length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres.");
      return;
    }
    if (!email) {
      toast.error("E-mail é obrigatório.");
      return;
    }
    if (
      (cadastroPerfil === "fisio" || cadastroPerfil === "operacional") &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      toast.error("E-mail inválido.");
      return;
    }
    if (cadastroPerfil === "cliente" && !cadastroForm.paciente_id) {
      toast.error("Selecione o paciente vinculado.");
      return;
    }
    cadastroMutation.mutate({
      nome,
      email,
      perfil: cadastroPerfil,
      paciente_id: cadastroPerfil === "cliente" ? cadastroForm.paciente_id : null,
      ...(cadastroPerfil === "fisio"
        ? {
            fisio: {
              registro_profissional: cadastroForm.registro_profissional.trim() || null,
              ativo: cadastroForm.ativo,
            },
          }
        : {}),
      ...(cadastroPerfil === "operacional"
        ? { menu_permissions: cadastroForm.menu_permissions }
        : {}),
    });
  }

  const deepLinkHandled = useRef<string | null>(null);

  useEffect(() => {
    if (!editEmailParam || !isAdmin || isLoading) return;
    if (deepLinkHandled.current === editEmailParam) return;

    const target = editEmailParam.toLowerCase();
    const row = usuarioRows.find((r) => r.email.toLowerCase() === target);
    deepLinkHandled.current = editEmailParam;

    if (row) {
      void openCadastro({
        nome: row.nome,
        email: row.email,
        perfil: cadastroPerfilFromUsuarioRow(row),
        paciente_id: row.registered?.paciente_id ?? undefined,
      });
    } else {
      void openCadastro({ nome: "", email: editEmailParam, perfil: "fisio" });
    }
    void navigate({ to: "/app/usuarios", search: {}, replace: true });
  }, [editEmailParam, isAdmin, isLoading, usuarioRows, navigate]);

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
        description={`Cadastre administradores, equipe com módulos liberados, fisioterapeutas e clientes. Senha inicial ${DEFAULT_INITIAL_PASSWORD}.`}
        actions={
          <Button onClick={openCadastroNovo} className="gap-2 bg-cb-cyan-600 hover:bg-cb-cyan-700">
            <UserPlus className="h-4 w-4" />
            Cadastrar
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
          label="Fisioterapeutas"
          value={perfilCounts.fisio}
          accent="purple"
          icon={<UserCheck className="h-5 w-5" />}
          share={users.length > 0 ? (perfilCounts.fisio / users.length) * 100 : 0}
        />
        <KpiCard
          label="Equipe / Admin"
          value={perfilCounts.admin + perfilCounts.operacional}
          accent="lime"
          icon={<Shield className="h-5 w-5" />}
          share={
            users.length > 0
              ? ((perfilCounts.admin + perfilCounts.operacional) / users.length) * 100
              : 0
          }
        />
        <KpiCard
          label="Clientes"
          value={perfilCounts.cliente}
          accent="orange"
          icon={<Users className="h-5 w-5" />}
          share={users.length > 0 ? (perfilCounts.cliente / users.length) * 100 : 0}
        />
      </KpiGrid>

      {usuarioRows.length > 0 && (
        <StatusDistributionBar
          totalLabel="Equipe prevista por perfil"
          formatValue={(n) => String(n)}
          segments={[
            {
              label: "Fisioterapeuta",
              value: perfilRosterCounts.fisio,
              colorClass: "bg-cb-cyan-600",
            },
            { label: "Admin", value: perfilRosterCounts.admin, colorClass: "bg-cb-lime" },
            {
              label: "Equipe",
              value: perfilRosterCounts.operacional,
              colorClass: "bg-cb-purple",
            },
            {
              label: "Cliente",
              value: perfilRosterCounts.cliente,
              colorClass: "bg-muted-foreground",
            },
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
          <SelectTrigger className="w-full sm:w-48">
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

      <UsuarioCadastroDialog
        open={cadastroOpen}
        onOpenChange={setCadastroOpen}
        form={cadastroForm}
        setForm={setCadastroForm}
        editingExistingUser={editingExistingUser}
        users={users}
        pacienteQuery={pacienteQuery}
        setPacienteQuery={setPacienteQuery}
        pacientes={pacientes}
        loadingPacientes={loadingPacientes}
        loadingMenus={loadingMenus && cadastroPerfil === "operacional" && !!editingUserId}
        onSave={handleSaveCadastro}
        pending={cadastroMutation.isPending}
      />

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
