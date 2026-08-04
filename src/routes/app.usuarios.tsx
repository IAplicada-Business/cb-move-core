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
import { UsuarioAcessosPanel } from "@/components/domain/UsuarioAcessosPanel";
import { UsuarioCardGrid, type UsuarioCardRow } from "@/components/domain/UsuarioCardGrid";
import { UsuarioFormDialog, type UsuarioFormValues } from "@/components/domain/UsuarioFormDialog";
import { queryKeys } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { deleteUser, fetchUsers, type UserRow } from "@/lib/queries/usuarios";
import { COLABORADORES_REFERENCIA } from "@/lib/colaboradores-referencia";
import { operationalRoleFromUser, type OperationalRoleUi } from "@/lib/user-access";

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

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · CB MOVE" }] }),
  component: UsuariosPage,
});

function findUserByEmail(users: UserRow[], email: string): UserRow | undefined {
  const target = email.toLowerCase();
  return users.find((u) => u.email?.toLowerCase() === target);
}

function suggestedOperationalRole(email: string): OperationalRoleUi {
  const ref = COLABORADORES_REFERENCIA.find((c) => c.email.toLowerCase() === email.toLowerCase());
  if (ref?.observacao?.toLowerCase().includes("secretaria")) return "secretaria";
  if (ref?.perfil === "admin") return "admin";
  if (ref?.perfil === "cliente") return "cliente";
  return "fisio";
}

function buildUsuarioRows(users: UserRow[]): UsuarioCardRow[] {
  const referenceEmails = new Set(COLABORADORES_REFERENCIA.map((c) => c.email.toLowerCase()));

  const rows: UsuarioCardRow[] = COLABORADORES_REFERENCIA.map((c) => ({
    key: c.email,
    nome: c.nome,
    email: c.email,
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
      registered: u,
      isReference: false,
    });
  }

  return rows;
}

function UsuariosPage() {
  const { roles, user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const [formOpen, setFormOpen] = useState(false);
  const [formPrefill, setFormPrefill] = useState<Partial<UsuarioFormValues> | undefined>();
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<OperationalRoleUi | "todos">("todos");
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
    const term = searchQuery.trim().toLowerCase();
    return usuarioRows.filter((row) => {
      if (term) {
        const hit = row.nome.toLowerCase().includes(term) || row.email.toLowerCase().includes(term);
        if (!hit) return false;
      }
      if (filterRole === "todos" || !row.registered) return true;
      const ui = operationalRoleFromUser(row.registered.role, row.registered.fisioterapeuta_id);
      return ui === filterRole;
    });
  }, [usuarioRows, searchQuery, filterRole]);

  const nAdmin = useMemo(
    () =>
      users.filter((u) => operationalRoleFromUser(u.role, u.fisioterapeuta_id) === "admin").length,
    [users],
  );
  const nSecretaria = useMemo(
    () =>
      users.filter((u) => operationalRoleFromUser(u.role, u.fisioterapeuta_id) === "secretaria")
        .length,
    [users],
  );
  const nFisio = useMemo(
    () =>
      users.filter((u) => operationalRoleFromUser(u.role, u.fisioterapeuta_id) === "fisio").length,
    [users],
  );
  const nCliente = useMemo(
    () =>
      users.filter((u) => operationalRoleFromUser(u.role, u.fisioterapeuta_id) === "cliente")
        .length,
    [users],
  );
  const nPendentes = useMemo(() => usuarioRows.filter((r) => !r.registered).length, [usuarioRows]);

  function openCadastro(row?: UsuarioCardRow) {
    if (row?.registered) {
      setEditingUser(row.registered);
      setFormPrefill({
        nome: row.nome,
        email: row.email,
        operationalRole: operationalRoleFromUser(
          row.registered.role,
          row.registered.fisioterapeuta_id,
        ),
        fisioterapeuta_id: row.registered.fisioterapeuta_id ?? "",
      });
    } else if (row) {
      setEditingUser(null);
      setFormPrefill({
        nome: row.nome,
        email: row.email,
        operationalRole: suggestedOperationalRole(row.email),
      });
    } else {
      setEditingUser(null);
      setFormPrefill(undefined);
    }
    setFormOpen(true);
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
        title="Usuários e permissões"
        description="Cadastre a equipe com perfil operacional (secretária, fisio, gestão) e configure o menu lateral compartilhado."
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
            { label: "Secretária", value: nSecretaria, colorClass: "bg-cb-lime" },
            { label: "Fisio", value: nFisio, colorClass: "bg-cb-purple" },
            { label: "Cliente", value: nCliente, colorClass: "bg-cb-orange" },
          ]}
        />
      )}

      <DashboardSection
        eyebrow="Permissões"
        accent="purple"
        title="Menu lateral — perfis operacionais"
        description="Presets rápidos e checkboxes para secretária, gestão e recepção. Fisioterapeutas usam menu clínico fixo."
      >
        <UsuarioAcessosPanel />
      </DashboardSection>

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
          value={filterRole}
          onValueChange={(v) => setFilterRole(v as OperationalRoleUi | "todos")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="secretaria">Secretária</SelectItem>
            <SelectItem value="gestao">Gestão</SelectItem>
            <SelectItem value="fisio">Fisioterapeuta</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs font-medium text-cb-muted">
          {filteredUsuarioRows.length} na lista · {users.length} cadastrados
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
          description="Tente buscar por outro nome, e-mail ou perfil."
        />
      ) : (
        <DashboardSection
          eyebrow="Equipe"
          accent="cyan"
          title="Usuários cadastrados"
          badge={
            <DashboardSectionBadge accent="cyan">
              {filteredUsuarioRows.length}
            </DashboardSectionBadge>
          }
          description="Referência de colaboradores + usuários extras. Clique para editar perfil e vínculos."
          noPadding
        >
          <UsuarioCardGrid
            rows={filteredUsuarioRows}
            currentUserId={user?.id}
            onEdit={openCadastro}
            onDelete={setUserToDelete}
          />
        </DashboardSection>
      )}

      <UsuarioFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        existingUser={editingUser}
        prefill={formPrefill}
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
