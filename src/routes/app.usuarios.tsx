import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Lock, Mail, MoreHorizontal, Plus, Shield, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/domain/EmptyState";
import { LoadingState } from "@/components/domain/LoadingState";
import { queryKeys } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
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
  sendUserInvite,
  updateUserRole,
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function UsuariosPage() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");

  const [tab, setTab] = useState<"usuarios" | "acessos">("usuarios");
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState<PrimaryRole>("membro");
  const [cadastroForm, setCadastroForm] = useState({
    nome: "",
    email: "",
    role: "membro" as PrimaryRole,
    paciente_id: "",
  });
  const [pacienteQuery, setPacienteQuery] = useState("");
  const [menuDraft, setMenuDraft] = useState<Partial<Record<MenuKey, boolean>>>({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: fetchUsers,
    enabled: isAdmin,
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

  const inviteMutation = useMutation({
    mutationFn: sendUserInvite,
    onSuccess: (res) => {
      toast.success(res.message ?? "Convite enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: PrimaryRole }) =>
      updateUserRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast.success("Perfil atualizado");
      setChangeRoleUser(null);
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
            Cadastre no sistema com senha inicial <strong>{DEFAULT_INITIAL_PASSWORD}</strong>. Envie o convite por e-mail quando quiser.
          </p>
        </div>
        <Button onClick={() => setCadastroOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar usuário
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="acessos">Acessos ao menu</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          {isLoading ? (
            <LoadingState />
          ) : users.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Nenhum usuário"
              description="Cadastre o primeiro usuário para começar."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                      <TableCell><RoleBadge role={u.role} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.paciente_nome ? `Cliente · ${u.paciente_nome}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                inviteMutation.mutate({
                                  user_id: u.id,
                                  email: u.email ?? undefined,
                                });
                              }}
                              disabled={inviteMutation.isPending || !u.email}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Enviar convite
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setChangeRoleUser(u);
                                setSelectedRole(normalizeRole(u.role) ?? "membro");
                              }}
                            >
                              Alterar perfil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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

      <section className="rounded-xl border bg-muted/10 p-4">
        <h2 className="text-sm font-semibold text-foreground">Equipe de referência (Drive)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Lista extraída de <em>Informações Colaboradores.docx</em> — cadastre no sistema e envie o convite depois.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil sugerido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {COLABORADORES_REFERENCIA.map((c) => {
                const cadastrado = users.some(
                  (u) => u.email?.toLowerCase() === c.email.toLowerCase(),
                );
                return (
                  <TableRow key={c.email}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={(c.perfil === "admin" ? "admin" : c.perfil === "cliente" ? "cliente" : "membro") as AppRole} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {cadastrado ? "Cadastrado — convite pendente" : "Não cadastrado"}
                    </TableCell>
                    <TableCell>
                      {!cadastrado ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCadastroForm({
                              nome: c.nome,
                              email: c.email,
                              role: c.perfil as PrimaryRole,
                              paciente_id: "",
                            });
                            setCadastroOpen(true);
                          }}
                        >
                          Cadastrar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={inviteMutation.isPending}
                          onClick={() => inviteMutation.mutate({ email: c.email })}
                        >
                          <Mail className="mr-1 h-3.5 w-3.5" />
                          Enviar convite
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={cadastroOpen} onOpenChange={setCadastroOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar usuário</DialogTitle>
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
              Senha inicial padrão: <strong>{DEFAULT_INITIAL_PASSWORD}</strong>. O cadastro não envia e-mail — use <strong>Enviar convite</strong> depois, se necessário.
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
              {cadastroMutation.isPending ? "Salvando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!changeRoleUser} onOpenChange={(o) => { if (!o) setChangeRoleUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar perfil — {changeRoleUser?.nome ?? changeRoleUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Novo perfil</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as PrimaryRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIMARY_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleUser(null)}>Cancelar</Button>
            <Button
              disabled={roleMutation.isPending}
              onClick={() => {
                if (changeRoleUser) {
                  roleMutation.mutate({ userId: changeRoleUser.id, role: selectedRole });
                }
              }}
            >
              {roleMutation.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
