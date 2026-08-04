import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import {
  ALL_MENU_KEYS,
  DEFAULT_MENU_FOR_MEMBRO,
  MENU_GROUPS,
  type MenuKey,
} from "@/lib/menu-access";
import {
  createUser,
  deleteUser,
  fetchMenuPermissions,
  fetchUsers,
  saveMenuPermissions,
  type UserRow,
} from "@/lib/queries/usuarios";
import { normalizeRole, PRIMARY_ROLES, ROLE_LABELS, type PrimaryRole } from "@/lib/permissions";
import { COLABORADORES_REFERENCIA } from "@/lib/colaboradores-referencia";
import { DEFAULT_INITIAL_PASSWORD } from "@/lib/default-password";

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
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
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

function AcessosMatrix({
  loading,
  menuDraft,
  setMenuDraft,
  enabledCount,
}: {
  loading: boolean;
  menuDraft: Partial<Record<MenuKey, boolean>>;
  setMenuDraft: (
    updater: (prev: Partial<Record<MenuKey, boolean>>) => Partial<Record<MenuKey, boolean>>,
  ) => void;
  enabledCount: number;
}) {
  if (loading) return <LoadingState />;
  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      {MENU_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.items.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted/30"
              >
                <Checkbox
                  checked={!!menuDraft[item.key]}
                  onCheckedChange={(checked) =>
                    setMenuDraft((prev) => ({ ...prev, [item.key]: !!checked }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        {enabledCount} de {ALL_MENU_KEYS.length} itens habilitados para Membro
      </p>
    </div>
  );
}

function UsuariosPage() {
  const { roles, user, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [cadastroForm, setCadastroForm] = useState({
    nome: "",
    email: "",
    role: "membro" as PrimaryRole,
    paciente_id: "",
  });
  const [pacienteQuery, setPacienteQuery] = useState("");
  const [menuDraft, setMenuDraft] = useState<Partial<Record<MenuKey, boolean>>>({});
  const [searchQuery, setSearchQuery] = useState("");
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

  const { data: menuPerms, isLoading: loadingMenu } = useQuery({
    queryKey: queryKeys.usuarios.menuPermissions("membro"),
    queryFn: () => fetchMenuPermissions("membro"),
    enabled: isAdmin && cadastroOpen && cadastroForm.role === "membro",
  });

  useEffect(() => {
    if (!menuPerms) return;
    const merged: Partial<Record<MenuKey, boolean>> = {};
    for (const key of ALL_MENU_KEYS) {
      merged[key] = menuPerms[key] ?? DEFAULT_MENU_FOR_MEMBRO[key];
    }
    setMenuDraft(merged);
  }, [menuPerms]);

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
    enabled: isAdmin && cadastroOpen && cadastroForm.role === "cliente",
  });

  const cadastroMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createUser>[0]) => {
      const result = await createUser(input);
      if (input.role === "membro") {
        await saveMenuPermissions("membro", menuDraft);
      }
      return result;
    },
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuPermissions("membro") });
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuAccess });
      if (!roles.includes("admin")) {
        await refreshRoles();
      }
      toast.success(res.message ?? "Usuário salvo");
      setCadastroOpen(false);
      setCadastroForm({ nome: "", email: "", role: "membro", paciente_id: "" });
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

  const enabledCount = useMemo(() => ALL_MENU_KEYS.filter((k) => menuDraft[k]).length, [menuDraft]);

  const cadastradosCount = useMemo(
    () => COLABORADORES_REFERENCIA.filter((c) => findUserByEmail(users, c.email)).length,
    [users],
  );

  const usuarioRows = useMemo(() => buildUsuarioRows(users), [users]);

  const filteredUsuarioRows = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return usuarioRows;
    return usuarioRows.filter(
      (row) => row.nome.toLowerCase().includes(term) || row.email.toLowerCase().includes(term),
    );
  }, [usuarioRows, searchQuery]);

  const nAdmin = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === "admin").length,
    [users],
  );
  const nMembro = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === "membro").length,
    [users],
  );
  const nCliente = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === "cliente").length,
    [users],
  );
  const nPendentes = useMemo(() => usuarioRows.filter((r) => !r.registered).length, [usuarioRows]);

  function openCadastroFromRow(row: UsuarioCardRow) {
    openCadastro({
      nome: row.nome,
      email: row.email,
      role: normalizeRole(row.registered?.role) ?? row.perfil,
    });
  }

  function openCadastro(prefill?: { nome: string; email: string; role: PrimaryRole }) {
    setCadastroForm({
      nome: prefill?.nome ?? "",
      email: prefill?.email ?? "",
      role: prefill?.role ?? "membro",
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
        description={`Cadastre a equipe com senha inicial ${DEFAULT_INITIAL_PASSWORD}. Para perfil Membro, defina os acessos ao menu no mesmo fluxo.`}
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

      {users.length > 0 && (
        <StatusDistributionBar
          totalLabel="Usuários por perfil"
          formatValue={(n) => String(n)}
          segments={[
            { label: "Admin", value: nAdmin, colorClass: "bg-cb-cyan-600" },
            { label: "Membro", value: nMembro, colorClass: "bg-cb-lime" },
            { label: "Cliente", value: nCliente, colorClass: "bg-cb-purple" },
          ]}
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
          description="Tente buscar por outro nome ou e-mail."
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
        <DialogContent
          className={cn(
            "max-h-[85vh] overflow-y-auto",
            cadastroForm.role === "membro" ? "max-w-2xl" : "max-w-md",
          )}
        >
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
                value={cadastroForm.role}
                onValueChange={(v) =>
                  setCadastroForm((f) => ({ ...f, role: v as PrimaryRole, paciente_id: "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIMARY_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cadastroForm.role === "membro" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Label className="mb-0">Acessos ao menu (Membro)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Define o que todos os usuários com perfil Membro enxergam no menu lateral.
                  Administradores veem tudo; clientes usam o portal.
                </p>
                <AcessosMatrix
                  loading={loadingMenu}
                  menuDraft={menuDraft}
                  setMenuDraft={setMenuDraft}
                  enabledCount={enabledCount}
                />
              </div>
            )}

            {cadastroForm.role === "cliente" && (
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
                  role: cadastroForm.role,
                  paciente_id: cadastroForm.role === "cliente" ? cadastroForm.paciente_id : null,
                })
              }
            >
              {cadastroMutation.isPending
                ? "Salvando…"
                : cadastroForm.role === "membro"
                  ? "Salvar usuário e acessos"
                  : "Salvar"}
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
