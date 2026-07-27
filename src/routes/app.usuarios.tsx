import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, Search, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
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
import type { AppRole } from "@/lib/types";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({ meta: [{ title: "Usuários · CB MOVE" }] }),
  component: UsuariosPage,
});

const ROLE_BADGE: Record<PrimaryRole, string> = {
  admin: "bg-cb-cyan-050 text-cb-cyan-800 border-cb-cyan-100",
  membro: "bg-[#F7FEE7] text-cb-lime border-[#BEF264]",
  cliente: "bg-slate-100 text-slate-700 border-slate-200",
};

function RoleBadge({ role }: { role: AppRole | null }) {
  const primary = normalizeRole(role);
  if (!primary) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        ROLE_BADGE[primary],
      )}
    >
      {ROLE_LABELS[primary]}
    </span>
  );
}

function findUserByEmail(users: UserRow[], email: string): UserRow | undefined {
  const target = email.toLowerCase();
  return users.find((u) => u.email?.toLowerCase() === target);
}

type UsuarioTableRow = {
  key: string;
  nome: string;
  email: string;
  perfil: PrimaryRole;
  registered: UserRow | undefined;
  isReference: boolean;
};

function buildUsuarioRows(users: UserRow[]): UsuarioTableRow[] {
  const referenceEmails = new Set(COLABORADORES_REFERENCIA.map((c) => c.email.toLowerCase()));

  const rows: UsuarioTableRow[] = COLABORADORES_REFERENCIA.map((c) => ({
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

function statusLabel(user: UserRow | undefined): string {
  if (!user) return "Não cadastrado";
  return "Cadastrado — aguardando 1º acesso";
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
  const { roles, user } = useAuth();
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
  const [userToDelete, setUserToDelete] = useState<UsuarioTableRow | null>(null);

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
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuPermissions("membro") });
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuAccess });
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
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">Usuários do sistema</h1>
        </header>
        <EmptyState
          icon={<Lock className="h-8 w-8" />}
          title="Acesso restrito"
          description="Esta seção é visível apenas para administradores."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários do sistema</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre a equipe com senha inicial <strong>{DEFAULT_INITIAL_PASSWORD}</strong>. Para
            perfil Membro, defina os acessos ao menu no mesmo fluxo de cadastro.
          </p>
        </div>
        <Button onClick={() => openCadastro()}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar usuário
        </Button>
      </header>

      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <Users className="mr-2 inline h-4 w-4" />
          Lista extraída de <em>Informações Colaboradores.docx</em>, mais usuários cadastrados no
          sistema. <strong>{users.length}</strong> cadastrados (<strong>{cadastradosCount}</strong>{" "}
          da equipe de referência).
        </div>

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="pl-9"
          />
        </div>

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
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-56 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsuarioRows.map((row) => {
                  const displayRole = (row.registered?.role ?? row.perfil) as AppRole;
                  const isSelf = row.registered?.id === user?.id;
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                      <TableCell>
                        <RoleBadge role={displayRole} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {statusLabel(row.registered)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openCadastro({
                                nome: row.nome,
                                email: row.email,
                                role: normalizeRole(row.registered?.role) ?? row.perfil,
                              })
                            }
                          >
                            {row.registered ? "Editar" : "Cadastrar"}
                          </Button>
                          {row.registered && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "Você não pode excluir seu próprio usuário"
                                  : "Excluir usuário"
                              }
                              onClick={() => setUserToDelete(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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
    </div>
  );
}
