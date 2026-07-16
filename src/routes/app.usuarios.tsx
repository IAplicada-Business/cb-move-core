import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, Shield, Users } from "lucide-react";
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
  fetchMenuPermissions,
  fetchUsers,
  saveMenuPermissions,
  type UserRow,
} from "@/lib/queries/usuarios";
import {
  normalizeRole,
  PRIMARY_ROLES,
  ROLE_LABELS,
  type PrimaryRole,
} from "@/lib/permissions";
import type { AppRole } from "@/lib/types";
import { COLABORADORES_REFERENCIA } from "@/lib/colaboradores-referencia";
import { DEFAULT_INITIAL_PASSWORD } from "@/lib/default-password";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", ROLE_BADGE[primary])}>
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
  const referenceEmails = new Set(
    COLABORADORES_REFERENCIA.map((c) => c.email.toLowerCase()),
  );

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
    .sort((a, b) =>
      (a.nome ?? a.email ?? "").localeCompare(b.nome ?? b.email ?? "", "pt-BR"),
    );

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

function UsuariosPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const [tab, setTab] = useState<"usuarios" | "acessos">("usuarios");
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [cadastroForm, setCadastroForm] = useState({
    nome: "",
    email: "",
    role: "membro" as PrimaryRole,
    paciente_id: "",
  });
  const [pacienteQuery, setPacienteQuery] = useState("");
  const [menuDraft, setMenuDraft] = useState<Partial<Record<MenuKey, boolean>>>({});

  const { data: users = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: fetchUsers,
    enabled: isAdmin,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: menuPerms, isLoading: loadingMenu } = useQuery({
    queryKey: queryKeys.usuarios.menuPermissions("membro"),
    queryFn: () => fetchMenuPermissions("membro"),
    enabled: isAdmin && tab === "acessos",
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
      let q = supabase.from("pacientes").select("id, nome, email, user_id").is("user_id", null).order("nome").limit(20);
      if (pacienteQuery.trim()) q = q.ilike("nome", `%${pacienteQuery.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin && cadastroOpen && cadastroForm.role === "cliente",
  });

  const cadastroMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success(res.message ?? "Usuário cadastrado");
      setCadastroOpen(false);
      setCadastroForm({ nome: "", email: "", role: "membro", paciente_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const menuMutation = useMutation({
    mutationFn: () => saveMenuPermissions("membro", menuDraft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuPermissions("membro") });
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.menuAccess });
      toast.success("Acessos ao menu salvos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabledCount = useMemo(
    () => ALL_MENU_KEYS.filter((k) => menuDraft[k]).length,
    [menuDraft],
  );

  const cadastradosCount = useMemo(
    () => COLABORADORES_REFERENCIA.filter((c) => findUserByEmail(users, c.email)).length,
    [users],
  );

  const usuarioRows = useMemo(() => buildUsuarioRows(users), [users]);

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
          <h1 className="text-2xl font-bold text-foreground">Usuários e acessos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Equipe de referência — cadastre com senha inicial <strong>{DEFAULT_INITIAL_PASSWORD}</strong>.
            No primeiro login, cada pessoa define a senha pessoal.
          </p>
        </div>
        <Button onClick={() => openCadastro()}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar usuário
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="acessos">Acessos ao menu</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <Users className="mr-2 inline h-4 w-4" />
            Lista extraída de <em>Informações Colaboradores.docx</em>, mais usuários cadastrados no sistema.
            {" "}
            <strong>{users.length}</strong> cadastrados
            {" "}
            (<strong>{cadastradosCount}</strong> da equipe de referência).
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
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarioRows.map((row) => {
                    const displayRole = (row.registered?.role ?? row.perfil) as AppRole;
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCadastro({
                              nome: row.nome,
                              email: row.email,
                              role: normalizeRole(row.registered?.role) ?? row.perfil,
                            })}
                          >
                            {row.registered ? "Atualizar cadastro" : "Cadastrar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="acessos" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <Shield className="mr-2 inline h-4 w-4" />
            Administradores veem tudo. Aqui você define o que o perfil <strong>Membro</strong> enxerga no menu.
            Clientes usam o portal e veem apenas suas sessões e documentos.
          </div>

          {loadingMenu ? (
            <LoadingState />
          ) : (
            <div className="space-y-4 rounded-xl border bg-card p-4">
              {MENU_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.items.map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
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

              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  {enabledCount} de {ALL_MENU_KEYS.length} itens habilitados para Membro
                </p>
                <Button disabled={menuMutation.isPending} onClick={() => menuMutation.mutate()}>
                  {menuMutation.isPending ? "Salvando…" : "Salvar acessos"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={cadastroOpen} onOpenChange={setCadastroOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {findUserByEmail(users, cadastroForm.email) ? "Atualizar cadastro" : "Cadastrar usuário"}
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
                onValueChange={(v) => setCadastroForm((f) => ({ ...f, role: v as PrimaryRole, paciente_id: "" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIMARY_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                  <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Senha inicial padrão: <strong>{DEFAULT_INITIAL_PASSWORD}</strong>. No primeiro login, a pessoa será redirecionada para definir a senha pessoal.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCadastroOpen(false)}>Cancelar</Button>
            <Button
              disabled={cadastroMutation.isPending}
              onClick={() => cadastroMutation.mutate({
                nome: cadastroForm.nome.trim(),
                email: cadastroForm.email.trim(),
                role: cadastroForm.role,
                paciente_id: cadastroForm.role === "cliente" ? cadastroForm.paciente_id : null,
              })}
            >
              {cadastroMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
